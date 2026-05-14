import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { embedQuery, generateAnswer } from "../_shared/gemini.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { sanitizeForAI, truncate } from "../_shared/sanitize.ts";
import { createServiceClient, getAuthenticatedProfile, requireRole } from "../_shared/supabase.ts";
import { cleanText, RAG_LIMITS } from "../_shared/validation.ts";

type MatchResult = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

type ChildRow = {
  nis: string;
  nama: string | null;
  kelas: string | null;
  jurusan: string | null;
  status_santri: string | null;
  status_spp: string | null;
  total_hafalan: string | number | null;
  hafalan_kitab: string | null;
};

function childRef(index: number) {
  return `child_${index + 1}`;
}

function resolveSelectedChild(children: ChildRow[], value: unknown) {
  if (!children.length) return null;
  const requested = cleanText(value);
  if (!requested) return children[0];
  const byRef = children.find((_, index) => childRef(index) === requested);
  return byRef || null;
}

function sumNumber(rows: Record<string, unknown>[], field: string) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function groupCount(rows: Record<string, unknown>[], field: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = cleanText(row[field]) || "LAINNYA";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function compactRows<T extends Record<string, unknown>>(rows: T[], fields: string[], limit = 8) {
  return rows.slice(0, limit).map((row) => {
    const output: Record<string, unknown> = {};
    for (const field of fields) output[field] = row[field] ?? null;
    return output;
  });
}

function buildRagContext(matches: MatchResult[]) {
  let total = "";
  for (const [index, match] of matches.entries()) {
    const next = [
      `Sumber ${index + 1}: ${match.title}`,
      `Metadata: ${JSON.stringify(sanitizeForAI(match.metadata || {}))}`,
      `Isi: ${match.content}`,
    ].join("\n");

    if ((total + "\n\n" + next).length > 1800) break;
    total = `${total}\n\n${next}`.trim();
  }
  return total;
}

async function getChildContext(supabase: ReturnType<typeof createServiceClient>, child: ChildRow) {
  const nis = child.nis;

  const [
    tagihanResult,
    tahfidzResult,
    kitabResult,
    kesehatanResult,
    pelanggaranResult,
    perizinanResult,
    prestasiResult,
  ] = await Promise.all([
    supabase
      .from("tagihan_santri")
      .select("deskripsi_tagihan, nominal_tagihan, sisa_tagihan, tanggal_jatuh_tempo, status, created_at")
      .eq("santri_nis", nis)
      .order("tanggal_jatuh_tempo", { ascending: false })
      .limit(30),
    supabase
      .from("hafalan_tahfidz")
      .select("tanggal, surat, ayat_awal, ayat_akhir, juz, status, predikat, total_hafalan")
      .eq("santri_nis", nis)
      .order("tanggal", { ascending: false })
      .limit(12),
    supabase
      .from("hafalan_kitab")
      .select("tanggal, nama_kitab, bab_materi, bait_awal, bait_akhir, predikat, status")
      .eq("santri_nis", nis)
      .order("tanggal", { ascending: false })
      .limit(12),
    supabase
      .from("kesehatan_santri")
      .select("tanggal")
      .eq("santri_nis", nis)
      .order("tanggal", { ascending: false })
      .limit(12),
    supabase
      .from("pelanggaran_santri")
      .select("tanggal, jenis_pelanggaran, poin")
      .eq("santri_nis", nis)
      .order("tanggal", { ascending: false })
      .limit(12),
    supabase
      .from("perizinan_santri")
      .select("tanggal, tanggal_kembali, jenis_izin, status")
      .eq("santri_nis", nis)
      .order("tanggal", { ascending: false })
      .limit(12),
    supabase
      .from("prestasi_santri")
      .select("tanggal_prestasi, kategori, judul_prestasi, poin_prestasi")
      .eq("santri_nis", nis)
      .order("tanggal_prestasi", { ascending: false })
      .limit(12),
  ]);

  for (const result of [
    tagihanResult,
    tahfidzResult,
    kitabResult,
    kesehatanResult,
    pelanggaranResult,
    perizinanResult,
    prestasiResult,
  ]) {
    if (result.error) console.error("rag-query-wali context query error:", result.error);
  }

  const tagihan = (tagihanResult.data || []) as Record<string, unknown>[];
  const tahfidz = (tahfidzResult.data || []) as Record<string, unknown>[];
  const kitab = (kitabResult.data || []) as Record<string, unknown>[];
  const kesehatan = (kesehatanResult.data || []) as Record<string, unknown>[];
  const pelanggaran = (pelanggaranResult.data || []) as Record<string, unknown>[];
  const perizinan = (perizinanResult.data || []) as Record<string, unknown>[];
  const prestasi = (prestasiResult.data || []) as Record<string, unknown>[];

  return sanitizeForAI({
    santri: {
      nama: child.nama,
      kelas: child.kelas,
      jurusan: child.jurusan,
      status_santri: child.status_santri,
      status_spp: child.status_spp,
      total_hafalan: child.total_hafalan,
      hafalan_kitab: child.hafalan_kitab,
    },
    tagihan: {
      total_dokumen: tagihan.length,
      total_nominal: sumNumber(tagihan, "nominal_tagihan"),
      total_sisa: sumNumber(tagihan, "sisa_tagihan"),
      status_count: groupCount(tagihan, "status"),
      terbaru: compactRows(tagihan, ["deskripsi_tagihan", "nominal_tagihan", "sisa_tagihan", "tanggal_jatuh_tempo", "status"], 8),
    },
    tahfidz: {
      total_setoran_terbaru: tahfidz.length,
      status_count: groupCount(tahfidz, "status"),
      terbaru: compactRows(tahfidz, ["tanggal", "surat", "ayat_awal", "ayat_akhir", "juz", "status", "predikat", "total_hafalan"], 6),
    },
    kitab: {
      total_setoran_terbaru: kitab.length,
      status_count: groupCount(kitab, "status"),
      terbaru: compactRows(kitab, ["tanggal", "nama_kitab", "bab_materi", "bait_awal", "bait_akhir", "predikat", "status"], 6),
    },
    kesehatan: {
      total_catatan_terbaru: kesehatan.length,
      tanggal_terakhir: kesehatan[0]?.tanggal || null,
    },
    kedisiplinan: {
      total_catatan_terbaru: pelanggaran.length,
      total_poin_terbaru: sumNumber(pelanggaran, "poin"),
      terbaru: compactRows(pelanggaran, ["tanggal", "jenis_pelanggaran", "poin"], 6),
    },
    perizinan: {
      total_catatan_terbaru: perizinan.length,
      status_count: groupCount(perizinan, "status"),
      terbaru: compactRows(perizinan, ["tanggal", "tanggal_kembali", "jenis_izin", "status"], 6),
    },
    prestasi: {
      total_catatan_terbaru: prestasi.length,
      terbaru: compactRows(prestasi, ["tanggal_prestasi", "kategori", "judul_prestasi", "poin_prestasi"], 6),
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
    requireRole(profile, ["wali"]);

    const rate = await checkRateLimit(supabase, `rag-wali:${profile.id}`, 40, 60);
    if (!rate.allowed) {
      return jsonResponse({ error: "Terlalu banyak request. Coba lagi sebentar lagi." }, 429);
    }

    const body = await req.json();
    const query = cleanText(body.query);
    const includePublicKnowledge = body.include_public_knowledge !== false;

    if (!query || query.length > RAG_LIMITS.maxQueryLength) {
      return jsonResponse({ error: "Query wajib diisi dan maksimal 500 karakter." }, 400);
    }

    const { data: childrenRaw, error: childError } = await supabase
      .from("santri")
      .select("nis, nama, kelas, jurusan, status_santri, status_spp, total_hafalan, hafalan_kitab")
      .eq("wali_id", profile.id)
      .order("nama", { ascending: true });

    if (childError) {
      console.error("rag-query-wali child lookup error:", childError);
      return jsonResponse({ error: "Gagal mengambil data santri wali." }, 500);
    }

    const children = (childrenRaw || []) as ChildRow[];
    if (!children.length) {
      return jsonResponse({ error: "Akun wali belum terhubung dengan data santri." }, 403);
    }

    const selectedChild = resolveSelectedChild(children, body.child_ref);
    if (!selectedChild) {
      return jsonResponse({ error: "Referensi santri tidak valid untuk akun wali ini." }, 403);
    }

    const childContext = await getChildContext(supabase, selectedChild);

    const embedding = await embedQuery(query);
    if (embedding.length !== 768) {
      throw new Error(`Dimensi embedding query ${embedding.length}, expected 768.`);
    }

    let publicMatches: MatchResult[] = [];
    if (includePublicKnowledge) {
      const { data, error } = await supabase.rpc("match_public_documents", {
        query_embedding: embedding,
        match_threshold: Number(Deno.env.get("RAG_MATCH_THRESHOLD_PUBLIC") || 0.70),
        match_count: Math.min(Number(Deno.env.get("RAG_MAX_CHUNKS") || 3), 3),
      });
      if (error) console.error("rag-query-wali public match error:", error);
      publicMatches = ((data || []) as MatchResult[]).map((match) => sanitizeForAI(match));
    }

    const ragContext = buildRagContext(publicMatches);
    const contextText = [
      "## Data Santri Milik Wali",
      JSON.stringify(childContext, null, 2),
      ragContext ? `## Knowledge Base Publik\n${ragContext}` : "",
    ].filter(Boolean).join("\n\n").slice(0, Number(Deno.env.get("RAG_MAX_CONTEXT_CHARS") || 4000));

    const systemPrompt = [
      "Kamu adalah asisten wali santri Pesantren Al-Hasanah.",
      "Jawab hanya berdasarkan data santri milik wali dan knowledge base yang diberikan.",
      "Jangan mengarang data yang tidak tersedia.",
      "Jangan menampilkan NIS, NIK, alamat lengkap, nomor HP, token, rekening, atau data pribadi rinci.",
      "Untuk data kesehatan, jawab ringkas berdasarkan jumlah catatan dan tanggal terakhir saja.",
      "Jika pertanyaan meminta data santri lain, tolak dengan sopan.",
      "Gunakan Bahasa Indonesia yang jelas, santun, dan mudah dipahami wali santri.",
    ].join("\n");

    const answer = await generateAnswer(
      systemPrompt,
      [`Konteks:`, contextText, `Pertanyaan wali: ${query}`].join("\n\n"),
    );

    await supabase.from("rag_query_logs").insert({
      session_id: `wali-${profile.id}`,
      user_id: profile.id,
      query_text: query,
      source_type: includePublicKnowledge ? "mixed" : "internal",
      context_type: "wali_chatbot",
      retrieved_chunk_ids: publicMatches.map((match) => match.id),
      response_preview: truncate(answer, 220),
      latency_ms: Date.now() - startedAt,
      metadata: {
        selected_child_ref: childRef(children.findIndex((child) => child.nis === selectedChild.nis)),
        children_count: children.length,
        include_public_knowledge: includePublicKnowledge,
        public_matches: publicMatches.length,
      },
    });

    return jsonResponse({
      answer,
      children: children.map((child, index) => ({
        child_ref: childRef(index),
        nama: child.nama,
        kelas: child.kelas,
        jurusan: child.jurusan,
        status_santri: child.status_santri,
      })),
      selected_child_ref: childRef(children.findIndex((child) => child.nis === selectedChild.nis)),
      sources: publicMatches.map((match) => ({
        title: match.title,
        metadata: sanitizeForAI(match.metadata || {}),
        similarity: match.similarity,
      })),
      remaining_requests: rate.remaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /token|akses|role|profil|aktif/i.test(message) ? 403 : 500;
    console.error("rag-query-wali error:", message);
    return jsonResponse({ error: status === 403 ? message : "Gagal memproses query wali RAG." }, status);
  }
});
