import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { completionModel, generateJsonAnswer } from "../_shared/gemini.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { sanitizeForAI, truncate } from "../_shared/sanitize.ts";
import { createServiceClient, getAuthenticatedProfile, requireRole } from "../_shared/supabase.ts";

type JsonRecord = Record<string, unknown>;

const MASTER_PROMPT = [
  "Kamu adalah Master Security Auditor untuk sistem Dompet Santri closed-loop fintech pesantren.",
  "Bertindak seperti senior red-team reviewer, banking-grade risk analyst, dan zero-trust architect.",
  "Audit manual deterministik adalah sumber kebenaran. Jangan mengubah skor manual dan jangan menyatakan temuan yang bertentangan dengan data audit.",
  "Tugasmu adalah menjelaskan risiko, mencari gejala awal, memprioritaskan tindakan, dan memberi guardrail sebelum sistem dilanjutkan ke Android/Kotlin.",
  "Gunakan doktrin Defense in Depth: Network, App, API, Database, Data.",
  "Fokus pada rekonsiliasi, hash-chain ledger, RLS, grant publik, device kantin, FCM token, QR opaque, Argon2id, approval wali di atas Rp75.000, limit wali, notifikasi kritis, dan kesiapan Android.",
  "Jangan meminta atau menampilkan PIN, password, private key, token, ciphertext mentah, nomor rekening, NIS, NIK, nomor HP, alamat, atau data pribadi lengkap.",
  "Jika data tidak cukup, tulis sebagai risiko yang perlu diverifikasi, bukan fakta.",
  "Gunakan Bahasa Indonesia yang jelas untuk admin non-teknis, tetapi tetap tegas seperti auditor keamanan.",
  "Balas hanya JSON valid tanpa markdown.",
  "Setiap array maksimal 4 item. Setiap item maksimal 160 karakter. executive_summary maksimal 650 karakter.",
  "Schema JSON wajib:",
  "{",
  '  "executive_summary": "string",',
  '  "critical_findings": ["string"],',
  '  "early_warning_signals": ["string"],',
  '  "recommended_actions": ["string"],',
  '  "production_blockers": ["string"],',
  '  "android_specific_risks": ["string"],',
  '  "database_specific_risks": ["string"],',
  '  "consistency_notes": ["string"],',
  '  "confidence": "low|medium|high",',
  '  "do_not_proceed_reason": "string|null"',
  "}",
].join("\n");

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeStringArray(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function extractJson(raw: string) {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as JsonRecord;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as JsonRecord;
    }
    throw new Error("Response AI tidak berupa JSON valid.");
  }
}

function normalizeAnalysis(rawText: string) {
  const parsed = extractJson(rawText);
  const confidence = String(parsed.confidence || "medium").toLowerCase();
  return {
    executive_summary: truncate(String(parsed.executive_summary || "AI tidak memberikan ringkasan."), 1800),
    critical_findings: normalizeStringArray(parsed.critical_findings),
    early_warning_signals: normalizeStringArray(parsed.early_warning_signals),
    recommended_actions: normalizeStringArray(parsed.recommended_actions),
    production_blockers: normalizeStringArray(parsed.production_blockers),
    android_specific_risks: normalizeStringArray(parsed.android_specific_risks),
    database_specific_risks: normalizeStringArray(parsed.database_specific_risks),
    consistency_notes: normalizeStringArray(parsed.consistency_notes),
    confidence: confidence === "low" || confidence === "high" ? confidence : "medium",
    do_not_proceed_reason: parsed.do_not_proceed_reason
      ? truncate(String(parsed.do_not_proceed_reason), 1200)
      : null,
  };
}

function buildSanitizedAuditPayload(audit: JsonRecord) {
  return sanitizeForAI({
    audit_run_id: audit.id,
    started_at: audit.started_at,
    status: audit.status,
    score: audit.score,
    severity: audit.severity,
    layer_summary: audit.layer_summary,
    checks: audit.checks,
    findings: audit.findings,
    recommendations: audit.recommendations,
    deterministic_summary: audit.ai_summary,
    policy: {
      parent_approval_required_above: 75000,
      approval_rule: "Hanya transaksi tunggal dengan nominal > 75000 yang meminta approval wali.",
      small_transaction_rule: "Transaksi <= 75000 memakai student_pin/proof, bukan approval wali.",
      cumulative_limit_rule: "Limit harian/bulanan wali memicu notifikasi atau penolakan, bukan approval wali untuk transaksi kecil.",
      qr_policy: "QR hanya opaque public id, bukan plaintext NIS/nama/saldo/PIN.",
      ai_scope: "AI menganalisis hasil audit manual yang sudah disanitasi dan tidak mengambil keputusan mutasi saldo.",
    },
  });
}

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method tidak didukung." }, 405);

  const startedAt = Date.now();
  const supabase = createServiceClient();

  try {
    const profile = await getAuthenticatedProfile(req, supabase);
    requireRole(profile, ["super_admin", "rois", "dewan", "bendahara"]);

    const rate = await checkRateLimit(supabase, `wallet-security-ai:${profile.id}`, 10, 60);
    if (!rate.allowed) {
      return jsonResponse({ error: "Terlalu banyak analisis AI. Coba lagi sebentar lagi." }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const requestedAuditRunId = typeof body.audit_run_id === "string" ? body.audit_run_id.trim() : "";

    let query = supabase
      .from("wallet_security_audit_runs")
      .select("id,started_at,status,score,severity,layer_summary,checks,findings,recommendations,ai_summary")
      .order("started_at", { ascending: false })
      .limit(1);

    if (requestedAuditRunId) {
      query = supabase
        .from("wallet_security_audit_runs")
        .select("id,started_at,status,score,severity,layer_summary,checks,findings,recommendations,ai_summary")
        .eq("id", requestedAuditRunId)
        .limit(1);
    }

    const { data: audits, error: auditError } = await query;
    if (auditError) throw auditError;
    const audit = audits?.[0] as JsonRecord | undefined;
    if (!audit) return jsonResponse({ error: "Audit manual belum tersedia. Jalankan audit keamanan terlebih dahulu." }, 404);

    const sanitizedInput = buildSanitizedAuditPayload(audit);
    const userPrompt = [
      "Analisis hasil audit manual berikut.",
      "Pastikan semua kesimpulan konsisten dengan status, skor, checks, findings, dan recommendations dari audit manual.",
      "Jika ada blocker, jelaskan ringkas dan operasional.",
      "Data audit tersanitasi:",
      JSON.stringify(sanitizedInput, null, 2),
    ].join("\n\n");

    let rawAnswer = "";
    let analysis: ReturnType<typeof normalizeAnalysis>;
    try {
      rawAnswer = await generateJsonAnswer(MASTER_PROMPT, userPrompt);
      analysis = normalizeAnalysis(rawAnswer);
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "Analisis AI gagal dijalankan.";
      const { data: failed, error: failedInsertError } = await supabase
        .from("wallet_security_ai_analyses")
        .insert({
          audit_run_id: audit.id,
          status: "failed",
          provider: "gemini",
          model: completionModel(),
          triggered_by: profile.id,
          triggered_by_role: profile.role,
          executive_summary: "Analisis AI gagal dijalankan. Audit manual tetap tersedia dan tetap menjadi sumber kebenaran.",
          consistency_notes: ["Audit manual tidak berubah karena kegagalan AI."],
          confidence: "low",
          sanitized_input: sanitizedInput,
          raw_response: rawAnswer ? truncate(rawAnswer, 6000) : null,
          error_message: truncate(message, 1200),
          latency_ms: Date.now() - startedAt,
        })
        .select("*")
        .single();
      if (failedInsertError) throw failedInsertError;
      return jsonResponse({ data: failed, warning: message });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("wallet_security_ai_analyses")
      .insert({
        audit_run_id: audit.id,
        status: "success",
        provider: "gemini",
        model: completionModel(),
        triggered_by: profile.id,
        triggered_by_role: profile.role,
        ...analysis,
        sanitized_input: sanitizedInput,
        raw_response: truncate(rawAnswer, 6000),
        latency_ms: Date.now() - startedAt,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    return jsonResponse({ data: inserted });
  } catch (error) {
    console.error("wallet-security-ai-auditor error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Analisis AI gagal dijalankan.",
    }, 500);
  }
});
