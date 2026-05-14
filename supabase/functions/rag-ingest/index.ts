import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { smartChunk } from "../_shared/chunking.ts";
import { embedText, embeddingModel } from "../_shared/gemini.ts";
import { sanitizeForAI, truncate } from "../_shared/sanitize.ts";
import { createServiceClient, getAuthenticatedProfile, requireRole } from "../_shared/supabase.ts";
import {
  assertDocumentType,
  assertSourceType,
  clampNumber,
  cleanText,
  RAG_LIMITS,
} from "../_shared/validation.ts";

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method tidak didukung." }, 405);
  }

  const startedAt = Date.now();
  const supabase = createServiceClient();

  try {
    const profile = await getAuthenticatedProfile(req, supabase);
    requireRole(profile, ["super_admin", "rois"]);

    const body = await req.json();
    const sourceType = assertSourceType(body.source_type || body.table);
    const documentType = assertDocumentType(body.document_type || (sourceType === "kitab" ? "kitab" : "general"));
    const title = cleanText(body.title);
    const content = cleanText(body.content);
    const chunkSize = clampNumber(body.chunk_size, 500, RAG_LIMITS.minChunkSize, RAG_LIMITS.maxChunkSize);
    const chunkOverlap = clampNumber(body.chunk_overlap, 50, 0, RAG_LIMITS.maxChunkOverlap);
    const metadata = sanitizeForAI(body.metadata && typeof body.metadata === "object" ? body.metadata : {});

    if (!title || title.length > RAG_LIMITS.maxTitleLength) {
      return jsonResponse({ error: "Judul wajib diisi dan maksimal 180 karakter." }, 400);
    }

    if (!content || content.length > RAG_LIMITS.maxContentLength) {
      return jsonResponse({ error: "Konten wajib diisi dan maksimal 250.000 karakter." }, 400);
    }

    const chunks = smartChunk(content, chunkSize, chunkOverlap, documentType, title);
    if (!chunks.length) return jsonResponse({ error: "Konten tidak menghasilkan chunk valid." }, 400);

    const model = embeddingModel();
    const { data: document, error: documentError } = await supabase
      .from("rag_documents")
      .insert({
        title,
        source_type: sourceType,
        document_type: documentType,
        status: body.status === "draft" ? "draft" : "active",
        content_preview: truncate(content, 500),
        metadata,
        created_by: profile.id,
        embedding_model: model,
        embedding_dimension: 768,
      })
      .select("id")
      .single();

    if (documentError || !document) {
      console.error("rag document insert error:", documentError);
      return jsonResponse({ error: "Gagal menyimpan dokumen RAG." }, 500);
    }

    const documentIds: string[] = [];
    const failedChunks: Array<{ index: number; reason: string }> = [];

    for (const [index, chunk] of chunks.entries()) {
      try {
        const embedding = await embedText(chunk);
        if (embedding.length !== 768) {
          throw new Error(`Dimensi embedding ${embedding.length}, expected 768.`);
        }

        const { data: insertedChunk, error: chunkError } = await supabase
          .from("rag_document_chunks")
          .insert({
            document_id: document.id,
            chunk_index: index,
            title,
            content: chunk,
            embedding,
            embedding_model: model,
            metadata: {
              ...metadata,
              chunk_index: index,
              chunk_total: chunks.length,
            },
            token_count: Math.ceil(chunk.length / 4),
          })
          .select("id")
          .single();

        if (chunkError || !insertedChunk) {
          console.error("rag chunk insert error:", chunkError);
          throw new Error("insert chunk gagal");
        }

        documentIds.push(insertedChunk.id);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`rag ingest chunk ${index} failed:`, reason);
        failedChunks.push({ index, reason });
      }
    }

    if (!documentIds.length) {
      await supabase.from("rag_documents").delete().eq("id", document.id);
      return jsonResponse({ error: "Semua chunk gagal diproses." }, 500);
    }

    await supabase.from("rag_query_logs").insert({
      user_id: profile.id,
      query_text: `INGEST: ${title}`,
      source_type: sourceType,
      context_type: "ingest_test",
      retrieved_chunk_ids: documentIds,
      response_preview: `${documentIds.length}/${chunks.length} chunk berhasil dibuat.`,
      latency_ms: Date.now() - startedAt,
      metadata: {
        document_id: document.id,
        failed_chunks: failedChunks.length,
      },
    });

    return jsonResponse({
      success: true,
      document_id: document.id,
      chunks_created: documentIds.length,
      chunks_failed: failedChunks.length,
      chunk_ids: documentIds,
      failed_chunks: failedChunks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
    const status = /token|akses|role|profil|aktif/i.test(message) ? 403 : 500;
    console.error("rag-ingest error:", message);
    return jsonResponse({ error: status === 403 ? message : "Gagal memproses dokumen RAG." }, status);
  }
});
