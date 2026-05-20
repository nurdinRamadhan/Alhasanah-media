// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const DEFAULT_COMPLETION_MODEL = "gemini-2.5-flash";

const RAG_LIMITS = {
  maxQueryLength: 500,
};

const FORBIDDEN_FIELDS = new Set([
  "nik",
  "nis",
  "no_ktp",
  "no_kk",
  "alamat_lengkap",
  "no_telp",
  "no_hp",
  "password",
  "token",
  "refresh_token",
  "bank_account",
  "no_rekening",
]);

type SupabaseClient = ReturnType<typeof createClient>;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function handleOptions(req: Request) {
  if (req.method !== "OPTIONS") return null;
  return new Response("ok", { headers: corsHeaders });
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .split("\u0000").join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function sanitizeForAI<T>(data: T): T {
  if (Array.isArray(data)) return data.map((item) => sanitizeForAI(item)) as T;
  if (!data || typeof data !== "object") return data;

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (FORBIDDEN_FIELDS.has(key.toLowerCase())) continue;
    output[key] = sanitizeForAI(value);
  }
  return output as T;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum tersedia.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function getAuthenticatedProfile(req: Request, supabase: SupabaseClient) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Token autentikasi wajib dikirim.");

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Token autentikasi tidak valid.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, akses_gender, akses_jurusan, is_active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) throw new Error("Profil pengguna tidak ditemukan.");
  if (profile.is_active === false) throw new Error("Akun tidak aktif.");

  return {
    id: userData.user.id,
    full_name: profile.full_name || userData.user.email || "User",
    role: String(profile.role || "").toLowerCase(),
    akses_gender: profile.akses_gender || "ALL",
    akses_jurusan: profile.akses_jurusan || "ALL",
  };
}

function requireRole(profile: { role: string }, allowedRoles: string[]) {
  if (!allowedRoles.includes(profile.role)) {
    throw new Error("Role tidak memiliki akses.");
  }
}

async function checkRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  limit: number,
  windowSeconds = 60,
) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);

  const { data: existing, error: selectError } = await supabase
    .from("rag_rate_limits")
    .select("id, request_count")
    .eq("bucket_key", bucketKey)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (selectError) {
    console.error("rate limit select error:", selectError);
    return { allowed: true, remaining: limit };
  }

  if (!existing) {
    const { error } = await supabase.from("rag_rate_limits").insert({
      bucket_key: bucketKey,
      window_start: windowStart.toISOString(),
      request_count: 1,
    });
    if (error) console.error("rate limit insert error:", error);
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.request_count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  const nextCount = existing.request_count + 1;
  const { error } = await supabase
    .from("rag_rate_limits")
    .update({ request_count: nextCount })
    .eq("id", existing.id);

  if (error) console.error("rate limit update error:", error);
  return { allowed: true, remaining: Math.max(limit - nextCount, 0) };
}

function getGeminiKey() {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY belum tersedia.");
  return apiKey;
}

function embeddingModel() {
  const configured = Deno.env.get("AI_EMBEDDING_MODEL") || DEFAULT_EMBEDDING_MODEL;
  if (configured === "text-embedding-004") return DEFAULT_EMBEDDING_MODEL;
  return configured;
}

function completionModel() {
  return Deno.env.get("AI_COMPLETION_MODEL") || DEFAULT_COMPLETION_MODEL;
}

async function embedQuery(text: string) {
  const apiKey = getGeminiKey();
  const model = embeddingModel();
  const preparedText = model.startsWith("gemini-embedding")
    ? `task: question answering | query: ${text}`
    : text;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model.startsWith("gemini-embedding") ? {
        content: { parts: [{ text: preparedText }] },
        output_dimensionality: 768,
      } : {
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
        output_dimensionality: 768,
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    console.error("Gemini query embedding error:", JSON.stringify(data));
    throw new Error("Gagal membuat embedding query.");
  }

  const values = data.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Response embedding query tidak valid.");
  return values as number[];
}

async function generateAnswer(systemPrompt: string, userPrompt: string) {
  const apiKey = getGeminiKey();
  const model = completionModel();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    console.error("Gemini completion error:", JSON.stringify(data));
    throw new Error("Gagal membuat jawaban AI.");
  }

  return truncate(data.candidates?.[0]?.content?.parts?.[0]?.text || "", 6000);
}

type MatchResult = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

type WaliKnowledgeSource = "auto" | "pesantren" | "kitab";

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

function normalizeKnowledgeSource(value: unknown): WaliKnowledgeSource {
  if (value === "pesantren" || value === "kitab") return value;
  return "auto";
}

function hasAnyKeyword(query: string, keywords: string[]) {
  const normalized = query.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function isChildQuestion(query: string) {
  return hasAnyKeyword(query, [
    "anak saya",
    "santri saya",
    "putra saya",
    "putri saya",
    "tagihan",
    "spp",
    "pembayaran",
    "tunggakan",
    "hafalan",
    "tahfidz",
    "setoran",
    "kesehatan",
    "sakit",
    "pelanggaran",
    "kedisiplinan",
    "izin",
    "perizinan",
    "prestasi",
    "rapor",
    "nilai",
    "progres",
    "perkembangan",
  ]);
}

function isKitabQuestion(query: string) {
  return hasAnyKeyword(query, [
    "kitab",
    "hukum",
    "fiqih",
    "fikih",
    "thaharah",
    "taharah",
    "wudhu",
    "wudu",
    "najis",
    "shalat",
    "sholat",
    "puasa",
    "zakat",
    "adab",
    "akhlak",
    "dalil",
    "bab",
    "pasal",
    "makna",
    "syarah",
  ]);
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

async function matchKnowledge(
  supabase: ReturnType<typeof createServiceClient>,
  embedding: number[],
  source: Exclude<WaliKnowledgeSource, "auto">,
) {
  const rpcName = source === "kitab" ? "match_kitab_documents" : "match_public_documents";
  const threshold = source === "kitab"
    ? Number(Deno.env.get("RAG_MATCH_THRESHOLD_KITAB") || 0.65)
    : Number(Deno.env.get("RAG_MATCH_THRESHOLD_PUBLIC") || 0.70);
  const matchCount = Math.min(Number(Deno.env.get("RAG_MAX_CHUNKS") || 3), 3);

  const { data, error } = await supabase.rpc(rpcName, {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: matchCount,
  });

  if (error) {
    console.error(`rag-query-wali ${source} match error:`, error);
    return [] as MatchResult[];
  }

  return ((data || []) as MatchResult[]).map((match) => sanitizeForAI(match));
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
    const requestedSource = normalizeKnowledgeSource(body.source);

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

    const childQuestion = isChildQuestion(query);
    const kitabQuestion = isKitabQuestion(query);
    const includeChildContext = requestedSource === "auto" ? childQuestion : false;
    let knowledgeMatches: MatchResult[] = [];
    let matchedSources: Array<Exclude<WaliKnowledgeSource, "auto">> = [];

    if (includePublicKnowledge) {
      const sourcesToSearch: Array<Exclude<WaliKnowledgeSource, "auto">> = requestedSource === "pesantren" || requestedSource === "kitab"
        ? [requestedSource]
        : kitabQuestion
          ? ["kitab", "pesantren"]
          : ["pesantren", "kitab"];

      const matchesBySource = await Promise.all(
        sourcesToSearch.map(async (source) => ({
          source,
          matches: await matchKnowledge(supabase, embedding, source),
        })),
      );

      knowledgeMatches = matchesBySource
        .flatMap(({ source, matches }) => matches.map((match) => ({ ...match, source_type: source })))
        .sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0))
        .slice(0, Math.min(Number(Deno.env.get("RAG_MAX_CHUNKS") || 3), 4));

      matchedSources = Array.from(new Set(
        knowledgeMatches.map((match) => (match as MatchResult & { source_type?: Exclude<WaliKnowledgeSource, "auto"> }).source_type)
          .filter(Boolean),
      )) as Array<Exclude<WaliKnowledgeSource, "auto">>;
    }

    const ragContext = buildRagContext(knowledgeMatches);
    const hasRelevantKnowledge = knowledgeMatches.length > 0;
    const confidence = confidenceLabel(knowledgeMatches);
    const contextText = [
      includeChildContext ? "## Data Santri Milik Wali" : "",
      includeChildContext ? JSON.stringify(childContext, null, 2) : "",
      ragContext ? `## Knowledge Base Publik\n${ragContext}` : "",
    ].filter(Boolean).join("\n\n").slice(0, Number(Deno.env.get("RAG_MAX_CONTEXT_CHARS") || 4000));

    const systemPrompt = [
      "Kamu adalah asisten AI Pesantren Al-Hasanah untuk wali santri.",
      "Jawab hanya berdasarkan data santri milik wali dan/atau knowledge base yang diberikan.",
      "Jika pertanyaan tentang profil, informasi pesantren, kitab, hukum, fiqih, adab, atau referensi umum dan Knowledge Base tersedia, jawab dari Knowledge Base. Jangan mengalihkan jawaban ke data anak.",
      "Gunakan data santri milik wali hanya bila pertanyaan jelas menanyakan anak, tagihan, hafalan, kesehatan, kedisiplinan, perizinan, prestasi, atau perkembangan santri.",
      "Jangan mengarang data yang tidak tersedia.",
      "Jangan menampilkan NIS, NIK, alamat lengkap, nomor HP, token, rekening, atau data pribadi rinci.",
      "Untuk data kesehatan, jawab ringkas berdasarkan jumlah catatan dan tanggal terakhir saja.",
      "Jika pertanyaan meminta data santri lain, tolak dengan sopan.",
      "Untuk pertanyaan kitab/hukum, jawab sebagai ringkasan berdasarkan referensi yang tersedia, bukan fatwa final. Sarankan bertanya kepada pengasuh/ustadz untuk keputusan amaliah penting.",
      "Sebutkan sumber dokumen yang dipakai secara ringkas jika tersedia.",
      "Gunakan Bahasa Indonesia yang jelas, santun, dan mudah dipahami wali santri.",
    ].join("\n");

    const answer = contextText
      ? await generateAnswer(
        systemPrompt,
        [
          `Mode sumber: ${requestedSource}`,
          `Pertanyaan terdeteksi tentang data anak: ${includeChildContext ? "ya" : "tidak"}`,
          `Pertanyaan terdeteksi tentang kitab/hukum: ${kitabQuestion ? "ya" : "tidak"}`,
          `Konteks:`,
          contextText,
          `Pertanyaan wali: ${query}`,
        ].join("\n\n"),
      )
      : "Maaf, saya belum menemukan informasi yang relevan di data wali atau knowledge base Pesantren Al-Hasanah.";

    await supabase.from("rag_query_logs").insert({
      session_id: `wali-${profile.id}`,
      user_id: profile.id,
      query_text: query,
      source_type: includePublicKnowledge ? "mixed" : "internal",
      context_type: "wali_chatbot",
      retrieved_chunk_ids: knowledgeMatches.map((match) => match.id),
      response_preview: truncate(answer, 220),
      latency_ms: Date.now() - startedAt,
      metadata: {
        selected_child_ref: childRef(children.findIndex((child) => child.nis === selectedChild.nis)),
        children_count: children.length,
        include_public_knowledge: includePublicKnowledge,
        include_child_context: includeChildContext,
        requested_source: requestedSource,
        matched_sources: matchedSources,
        knowledge_matches: knowledgeMatches.length,
        top_similarity: topSimilarity(knowledgeMatches),
        confidence,
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
      sources: knowledgeMatches.map((match) => ({
        title: match.title,
        metadata: sanitizeForAI(match.metadata || {}),
        similarity: match.similarity,
      })),
      has_relevant_context: hasRelevantKnowledge || includeChildContext,
      confidence,
      confidence_note: confidence === "high"
        ? "Jawaban didukung dokumen dengan relevansi tinggi."
        : confidence === "medium"
          ? "Jawaban didukung dokumen relevan, tetapi tetap terbatas pada isi knowledge base."
          : confidence === "low"
            ? "Ada dokumen terkait, tetapi relevansinya rendah. Jawaban perlu dibaca hati-hati."
            : includeChildContext
              ? "Jawaban terutama memakai data santri yang tertaut ke akun wali."
              : "Tidak ditemukan konteks relevan di knowledge base.",
      remaining_requests: rate.remaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /token|akses|role|profil|aktif/i.test(message) ? 403 : 500;
    console.error("rag-query-wali error:", message);
    return jsonResponse({ error: status === 403 ? message : "Gagal memproses query wali RAG." }, status);
  }
});
