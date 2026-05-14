import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { embedQuery, generateAnswer } from "../_shared/gemini.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { sanitizeForAI, truncate } from "../_shared/sanitize.ts";
import { createServiceClient, getAuthenticatedProfile, requireRole } from "../_shared/supabase.ts";
import { cleanText, RAG_LIMITS } from "../_shared/validation.ts";

type AdminContextType = "financial" | "academic" | "santri" | "kitab" | "operational";

type MatchResult = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

function normalizeContextType(value: unknown): AdminContextType {
  if (
    value === "financial" ||
    value === "academic" ||
    value === "santri" ||
    value === "kitab" ||
    value === "operational"
  ) return value;
  return "operational";
}

function buildContextSection(title: string, content: unknown) {
  if (!content) return "";
  const body = typeof content === "string" ? content : JSON.stringify(sanitizeForAI(content), null, 2);
  return `## ${title}\n${body}`;
}

function buildRagText(label: string, matches: MatchResult[]) {
  if (!matches.length) return "";
  return [
    `## ${label}`,
    ...matches.map((match, index) => [
      `Sumber ${index + 1}: ${match.title}`,
      `Similarity: ${Number(match.similarity || 0).toFixed(3)}`,
      `Metadata: ${JSON.stringify(sanitizeForAI(match.metadata || {}))}`,
      `Isi: ${match.content}`,
    ].join("\n")),
  ].join("\n\n");
}

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "Method tidak didukung." }, 405);

  const startedAt = Date.now();
  const supabase = createServiceClient();

  try {
    const profile = await getAuthenticatedProfile(req, supabase);
    requireRole(profile, ["super_admin", "rois", "dewan"]);

    const rate = await checkRateLimit(supabase, `rag-admin:${profile.id}`, 60, 60);
    if (!rate.allowed) {
      return jsonResponse({ error: "Terlalu banyak request. Coba lagi sebentar lagi." }, 429);
    }

    const body = await req.json();
    const query = cleanText(body.query);
    const contextType = normalizeContextType(body.context_type);
    const includeKitab = Boolean(body.include_kitab);
    const includeDbContext = Boolean(body.include_db_context);
    const includeInternal = body.include_internal !== false && includeDbContext;
    const filters = body.filters && typeof body.filters === "object" ? body.filters : {};

    if (!query || query.length > RAG_LIMITS.maxQueryLength) {
      return jsonResponse({ error: "Query wajib diisi dan maksimal 500 karakter." }, 400);
    }

    const embedding = await embedQuery(query);
    if (embedding.length !== 768) {
      throw new Error(`Dimensi embedding query ${embedding.length}, expected 768.`);
    }

    let dbContext: unknown = null;
    if (includeDbContext && contextType !== "kitab") {
      const { data, error } = await supabase.rpc("get_rag_admin_context", {
        p_context_type: contextType,
        p_filters: filters,
      });
      if (error) {
        console.error("admin context rpc error:", error);
      } else {
        dbContext = sanitizeForAI(data);
      }
    }

    let kitabMatches: MatchResult[] = [];
    if (includeKitab || contextType === "kitab") {
      const { data, error } = await supabase.rpc("match_kitab_documents", {
        query_embedding: embedding,
        match_threshold: Number(Deno.env.get("RAG_MATCH_THRESHOLD_KITAB") || 0.65),
        match_count: Math.min(Number(Deno.env.get("RAG_MAX_CHUNKS") || 5), 5),
      });
      if (error) console.error("kitab match error:", error);
      kitabMatches = ((data || []) as MatchResult[]).map((match) => sanitizeForAI(match));
    }

    let internalMatches: MatchResult[] = [];
    if (includeInternal) {
      const { data, error } = await supabase.rpc("match_internal_documents", {
        query_embedding: embedding,
        match_threshold: Number(Deno.env.get("RAG_MATCH_THRESHOLD_INTERNAL") || 0.7),
        match_count: Math.min(Number(Deno.env.get("RAG_MAX_CHUNKS") || 5), 5),
      });
      if (error) console.error("internal match error:", error);
      internalMatches = ((data || []) as MatchResult[]).map((match) => sanitizeForAI(match));
    }

    const contextText = [
      buildContextSection("Data Real Database Agregat", dbContext),
      buildRagText("Referensi Kitab", kitabMatches),
      buildRagText("Dokumen Internal", internalMatches),
    ].filter(Boolean).join("\n\n").slice(0, Number(Deno.env.get("RAG_MAX_CONTEXT_CHARS") || 4000));

    const systemPrompt = [
      "Kamu adalah asisten pengambilan keputusan untuk manajemen Pesantren Al-Hasanah.",
      "Berikan rekomendasi berdasarkan data agregat dan referensi yang diberikan.",
      "Jangan mengarang data yang tidak tersedia dalam konteks.",
      "Bedakan dengan jelas antara temuan berbasis data, referensi kitab, dan rekomendasi operasional.",
      "Jangan meminta, menampilkan, atau menyimpulkan data sensitif seperti NIK, NIS, alamat lengkap, nomor HP, token, rekening, atau data pribadi rinci.",
      "Gunakan Bahasa Indonesia yang jelas, sopan, dan ringkas.",
    ].join("\n");

    const answer = contextText
      ? await generateAnswer(systemPrompt, [`Konteks:`, contextText, `Pertanyaan admin: ${query}`].join("\n\n"))
      : "Belum ada konteks data atau dokumen yang relevan untuk menjawab pertanyaan tersebut.";

    const retrievedIds = [
      ...kitabMatches.map((match) => match.id),
      ...internalMatches.map((match) => match.id),
    ];

    await supabase.from("rag_query_logs").insert({
      session_id: `admin-${profile.id}`,
      user_id: profile.id,
      query_text: query,
      source_type: includeKitab && includeInternal ? "mixed" : includeKitab ? "kitab" : includeInternal ? "internal" : "mixed",
      context_type: "admin_decision",
      retrieved_chunk_ids: retrievedIds,
      response_preview: truncate(answer, 220),
      latency_ms: Date.now() - startedAt,
      metadata: {
        context_type: contextType,
        include_kitab: includeKitab,
        include_db_context: includeDbContext,
        include_internal: includeInternal,
        filters,
        db_context_used: Boolean(dbContext),
        kitab_matches: kitabMatches.length,
        internal_matches: internalMatches.length,
      },
    });

    return jsonResponse({
      answer,
      data_sources: {
        db_context: Boolean(dbContext),
        kitab_references: kitabMatches.map((match) => ({
          title: match.title,
          metadata: match.metadata,
          similarity: match.similarity,
        })),
        internal_docs: internalMatches.map((match) => ({
          title: match.title,
          metadata: match.metadata,
          similarity: match.similarity,
        })),
      },
      confidence_note: "Jawaban bergantung pada kelengkapan dokumen RAG dan data agregat yang tersedia pada periode/filter yang dipilih.",
      remaining_requests: rate.remaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /token|akses|role|profil|aktif/i.test(message) ? 403 : 500;
    console.error("rag-query-admin error:", message);
    return jsonResponse({ error: status === 403 ? message : "Gagal memproses query admin RAG." }, status);
  }
});
