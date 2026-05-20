import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getClientIp, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { embedQuery, generateAnswer } from "../_shared/gemini.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { sanitizeForAI, truncate } from "../_shared/sanitize.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { cleanText, RAG_LIMITS } from "../_shared/validation.ts";

type Source = "pesantren" | "kitab";

type MatchResult = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

function normalizeSource(source: unknown): Source {
  if (source === "kitab") return "kitab";
  return "pesantren";
}

function buildContext(matches: MatchResult[]) {
  let total = "";
  for (const [index, match] of matches.entries()) {
    const sourceInfo = JSON.stringify(sanitizeForAI(match.metadata || {}));
    const next = [
      `Sumber ${index + 1}: ${match.title}`,
      `Metadata: ${sourceInfo}`,
      `Isi: ${match.content}`,
    ].join("\n");

    if ((total + "\n\n" + next).length > RAG_LIMITS.maxContextLength) break;
    total = `${total}\n\n${next}`.trim();
  }
  return total;
}

function topSimilarity(matches: MatchResult[]) {
  return matches.reduce((max, match) => Math.max(max, Number(match.similarity || 0)), 0);
}

function confidenceLabel(matches: MatchResult[]) {
  const top = topSimilarity(matches);
  if (top >= 0.82) return "high";
  if (top >= 0.74) return "medium";
  if (matches.length > 0) return "low";
  return "none";
}

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method tidak didukung." }, 405);
  }

  const startedAt = Date.now();
  const supabase = createServiceClient();

  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit(supabase, `rag-public:${ip}`, 20, 60);
    if (!rate.allowed) {
      return jsonResponse({ error: "Terlalu banyak request. Coba lagi sebentar lagi." }, 429);
    }

    const body = await req.json();
    const query = cleanText(body.query);
    const source = normalizeSource(body.source);
    const sessionId = cleanText(body.session_id || "");

    if (!query || query.length > RAG_LIMITS.maxQueryLength) {
      return jsonResponse({ error: "Query wajib diisi dan maksimal 500 karakter." }, 400);
    }

    const embedding = await embedQuery(query);
    if (embedding.length !== 768) {
      throw new Error(`Dimensi embedding query ${embedding.length}, expected 768.`);
    }

    const rpcName = source === "kitab" ? "match_kitab_documents" : "match_public_documents";
    const threshold = source === "kitab"
      ? Number(Deno.env.get("RAG_MATCH_THRESHOLD_KITAB") || 0.65)
      : Number(Deno.env.get("RAG_MATCH_THRESHOLD_PUBLIC") || 0.70);
    const matchCount = Math.min(
      Number(Deno.env.get("RAG_MAX_CHUNKS") || RAG_LIMITS.maxRetrievedChunks),
      RAG_LIMITS.maxRetrievedChunks,
    );

    const { data: matchesRaw, error: matchError } = await supabase.rpc(rpcName, {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: matchCount,
    });

    if (matchError) {
      console.error("rag public match error:", matchError);
      return jsonResponse({ error: "Gagal mencari knowledge base." }, 500);
    }

    const matches = ((matchesRaw || []) as MatchResult[]).map((match) => sanitizeForAI(match));
    const hasRelevantContext = matches.length > 0;
    const confidence = confidenceLabel(matches);
    const context = buildContext(matches);

    let answer = "";
    if (!hasRelevantContext) {
      answer = source === "kitab"
        ? "Maaf, saya belum menemukan referensi kitab yang relevan untuk pertanyaan tersebut."
        : "Maaf, saya belum memiliki informasi tersebut di knowledge base Pesantren Al-Hasanah.";
    } else {
      const systemPrompt = source === "kitab"
        ? [
          "Kamu adalah asisten referensi kitab Pesantren Al-Hasanah.",
          "Jawab pertanyaan hanya berdasarkan konteks yang diberikan.",
          "Jika konteks tidak cukup, katakan bahwa informasi belum tersedia.",
          "Jangan mengarang dalil, halaman, bab, atau nama kitab.",
          "Sebutkan nama kitab dan bab/pasal jika tersedia di metadata.",
          "Sebutkan sumber yang dipakai secara ringkas jika jawaban berasal dari dokumen.",
          "Gunakan Bahasa Indonesia yang sopan dan santun.",
        ].join("\n")
        : [
          "Kamu adalah asisten informasi Pesantren Al-Hasanah.",
          "Jawab pertanyaan hanya berdasarkan konteks yang diberikan.",
          "Jika informasi tidak tersedia di konteks, katakan dengan jujur bahwa kamu belum memiliki informasi tersebut.",
          "Jangan mengarang informasi.",
          "Sebutkan sumber dokumen yang dipakai secara ringkas jika tersedia.",
          "Jangan menyebut atau meminta data sensitif seperti NIK, NIS, alamat lengkap, nomor telepon, atau data santri pribadi.",
          "Gunakan Bahasa Indonesia yang sopan dan santun.",
        ].join("\n");

      answer = await generateAnswer(
        systemPrompt,
        [`Konteks knowledge base:`, context, `Pertanyaan user: ${query}`].join("\n\n"),
      );
    }

    await supabase.from("rag_query_logs").insert({
      session_id: sessionId || null,
      user_id: null,
      query_text: query,
      source_type: source === "kitab" ? "kitab" : "public",
      context_type: source === "kitab" ? "kitab_chatbot" : "public_chatbot",
      retrieved_chunk_ids: matches.map((match) => match.id),
      response_preview: truncate(answer, 220),
      latency_ms: Date.now() - startedAt,
      metadata: {
        source,
        match_count: matches.length,
        threshold,
        top_similarity: topSimilarity(matches),
        confidence,
      },
    });

    return jsonResponse({
      answer,
      sources: matches.map((match) => ({
        title: match.title,
        metadata: sanitizeForAI(match.metadata || {}),
        similarity: match.similarity,
      })),
      has_relevant_context: hasRelevantContext,
      confidence,
      confidence_note: confidence === "high"
        ? "Jawaban didukung dokumen dengan relevansi tinggi."
        : confidence === "medium"
          ? "Jawaban didukung dokumen relevan, tetapi tetap terbatas pada isi knowledge base."
          : confidence === "low"
            ? "Ada dokumen terkait, tetapi relevansinya rendah. Jawaban perlu dibaca hati-hati."
            : "Tidak ditemukan konteks relevan di knowledge base.",
      remaining_requests: rate.remaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("rag-query-public error:", message);
    return jsonResponse({ error: "Gagal memproses pertanyaan RAG." }, 500);
  }
});
