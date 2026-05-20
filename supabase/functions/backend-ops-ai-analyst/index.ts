import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { completionModel, generateJsonAnswer } from "../_shared/gemini.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { sanitizeForAI, truncate } from "../_shared/sanitize.ts";
import {
  createServiceClient,
  getAuthenticatedProfile,
  getBearerToken,
  requireRole,
} from "../_shared/supabase.ts";

type JsonRecord = Record<string, unknown>;
type AnalysisScope = "self_healing" | "diagnostics" | "private_audit" | "combined";

const MASTER_PROMPT = [
  "Kamu adalah AI Operations Analyst untuk Backend Command Center Al-Hasanah.",
  "Sumber kebenaran hanya data JSON yang diberikan. Jangan mengarang fakta.",
  "Tugasmu: membaca incident, alert, cron, notification queue, token health, Midtrans queue, pg_net, dan audit finance.",
  "Berikan saran eksekusi operasional yang konkret, berurutan, dan berbasis bukti.",
  "AI bersifat read-only. Jangan menjalankan action, jangan meminta tool write, dan jangan menginstruksikan auto-write.",
  "Dilarang menyarankan update langsung status pembayaran, saldo, tagihan, transaksi, atau ledger.",
  "Untuk Midtrans, queue/recommendation bukan bukti sukses. Semua perubahan uang wajib melalui worker/flow backend yang memverifikasi Midtrans Status API.",
  "Jika data belum cukup, sebutkan sebagai 'belum cukup bukti', bukan kesimpulan.",
  "Gunakan Bahasa Indonesia yang ringkas untuk super admin.",
  "Balas hanya JSON valid tanpa markdown.",
  "Schema JSON wajib:",
  "{",
  '  "executive_summary": "string",',
  '  "facts": ["string"],',
  '  "critical_findings": ["string"],',
  '  "execution_recommendations": ["string"],',
  '  "guardrails": ["string"],',
  '  "needs_human_review": ["string"],',
  '  "midtrans_notes": ["string"],',
  '  "confidence": "low|medium|high",',
  '  "next_refresh_minutes": number',
  "}",
  "Setiap array maksimal 5 item. Setiap item maksimal 180 karakter. executive_summary maksimal 900 karakter.",
].join("\n");

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeScope(value: unknown): AnalysisScope {
  if (
    value === "self_healing" ||
    value === "diagnostics" ||
    value === "private_audit" ||
    value === "combined"
  ) return value;
  return "combined";
}

function normalizeHours(value: unknown) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 24;
  return Math.max(1, Math.min(168, Math.floor(raw)));
}

function normalizeStringArray(value: unknown, maxItems = 5) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => truncate(String(item ?? "").trim(), 180))
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
  const nextRefresh = Number(parsed.next_refresh_minutes);

  return {
    executive_summary: truncate(String(parsed.executive_summary || "AI tidak memberikan ringkasan."), 900),
    facts: normalizeStringArray(parsed.facts),
    critical_findings: normalizeStringArray(parsed.critical_findings),
    execution_recommendations: normalizeStringArray(parsed.execution_recommendations),
    guardrails: normalizeStringArray(parsed.guardrails),
    needs_human_review: normalizeStringArray(parsed.needs_human_review),
    midtrans_notes: normalizeStringArray(parsed.midtrans_notes),
    confidence: confidence === "low" || confidence === "high" ? confidence : "medium",
    next_refresh_minutes: Number.isFinite(nextRefresh)
      ? Math.max(5, Math.min(120, Math.floor(nextRefresh)))
      : 15,
  };
}

function getUserClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = getBearerToken(req);
  if (!url || !anonKey) throw new Error("SUPABASE_URL atau SUPABASE_ANON_KEY belum tersedia.");
  if (!token) throw new Error("Token autentikasi wajib dikirim.");

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadOpsContext(req: Request, scope: AnalysisScope, hours: number) {
  const userClient = getUserClient(req);
  const payload: JsonRecord = { scope, window_hours: hours };

  if (scope === "self_healing" || scope === "combined") {
    const { data: center, error: centerError } = await userClient.rpc("get_self_healing_center");
    if (centerError) throw centerError;
    const { data: incidentContext, error: incidentContextError } = await userClient.rpc("get_ai_incident_context", {
      p_hours: hours,
    });
    if (incidentContextError) throw incidentContextError;
    payload.self_healing_center = center;
    payload.incident_context = incidentContext;
  }

  if (scope === "diagnostics" || scope === "combined") {
    const { data: diagnostics, error: diagnosticsError } = await userClient.rpc("get_backend_diagnostics");
    if (diagnosticsError) throw diagnosticsError;
    payload.backend_diagnostics = diagnostics;
  }

  if (scope === "private_audit" || scope === "combined") {
    const { data: auditContext, error: auditContextError } = await userClient.rpc("get_private_audit_ai_context", {
      p_hours: hours,
    });
    if (auditContextError) throw auditContextError;
    payload.private_audit_context = auditContext;
  }

  return sanitizeForAI(payload);
}

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method tidak didukung." }, 405);

  const startedAt = Date.now();
  const service = createServiceClient();

  try {
    const profile = await getAuthenticatedProfile(req, service);
    requireRole(profile, ["super_admin"]);

    const rate = await checkRateLimit(service, `backend-ops-ai:${profile.id}`, 12, 60);
    if (!rate.allowed) {
      return jsonResponse({ error: "Terlalu banyak analisis AI. Coba lagi sebentar lagi." }, 429);
    }

    const body = asObject(await req.json().catch(() => ({})));
    const scope = normalizeScope(body.scope);
    const hours = normalizeHours(body.hours);
    const question = truncate(String(body.question || "").trim(), 600);
    const context = await loadOpsContext(req, scope, hours);

    const userPrompt = [
      "Analisis konteks backend operations berikut.",
      `Scope: ${scope}`,
      `Window jam: ${hours}`,
      question ? `Pertanyaan super admin: ${question}` : "",
      "Konteks JSON tersanitasi dari RPC public wrapper:",
      JSON.stringify(context, null, 2),
    ].filter(Boolean).join("\n\n");

    const rawAnswer = await generateJsonAnswer(MASTER_PROMPT, userPrompt);
    const analysis = normalizeAnalysis(rawAnswer);

    return jsonResponse({
      data: {
        ...analysis,
        provider: "gemini",
        model: completionModel(),
        scope,
        window_hours: hours,
        generated_at: new Date().toISOString(),
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    console.error("backend-ops-ai-analyst error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Analisis AI gagal dijalankan.",
    }, 500);
  }
});

