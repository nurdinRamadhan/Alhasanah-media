// ═══════════════════════════════════════════════════════════════════════════
// supabase/functions/telegram-webhook/index.ts
//
// Al-Hasanah AI Command Center — Telegram Bot Webhook Handler
// Revision 2.0 — Schema-Accurate, Production-Ready
//
// ARSITEKTUR:
//   Telegram → POST /telegram-webhook → verifySecret → getAdminProfile
//   → rateLimit → routeCommand → buildDataContext → gemini-consultant
//   → formatResponse → Telegram
//
// CATATAN:
//   Fungsi buildDataContext()  → akan dipindah ke _shared/buildDataContext.ts
//   Fungsi sendMessage()       → akan dipindah ke _shared/telegramSender.ts
//
// ENV VARIABLES YANG DIBUTUHKAN:
//   TELEGRAM_BOT_TOKEN          → dari @BotFather
//   TELEGRAM_WEBHOOK_SECRET     → string acak min 32 karakter
//   SUPABASE_URL                → otomatis tersedia
//   SUPABASE_SERVICE_ROLE_KEY   → otomatis tersedia
//   GEMINI_API_KEY              → dibutuhkan oleh gemini-consultant
//
// SQL MIGRASI — JALANKAN SEKALI SEBELUM DEPLOY:
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id       BIGINT UNIQUE;
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_bot_query   TIMESTAMPTZ;
//   CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ───────────────────────────────────────────────────────────────────────────
// TYPES — Telegram API
// ───────────────────────────────────────────────────────────────────────────
interface TelegramUser {
    id:          number;
    is_bot:      boolean;
    first_name:  string;
    last_name?:  string;
    username?:   string;
}

interface TelegramChat {
    id:     number;
    type:   "private" | "group" | "supergroup" | "channel";
    title?: string;
}

interface TelegramMessage {
    message_id: number;
    from:       TelegramUser;
    chat:       TelegramChat;
    date:       number;
    text?:      string;
}

interface TelegramUpdate {
    update_id:        number;
    message?:         TelegramMessage;
    edited_message?:  TelegramMessage;
}

// ───────────────────────────────────────────────────────────────────────────
// TYPES — Sistem Al-Hasanah
// Sesuai schema aktual tabel profiles
// ───────────────────────────────────────────────────────────────────────────
interface AdminProfile {
    id:                 string;
    full_name:          string;
    role:               string;
    akses_gender:       string;   // 'L' | 'P' | 'ALL'
    akses_jurusan:      string;   // 'KITAB' | 'TAHFIDZ' | 'ALL'
    telegram_id:        number;
    telegram_username?: string;
    last_bot_query?:    string | null;
}

type TopicKey =
    | "LAPORAN"
    | "KESEHATAN"
    | "KEUANGAN"
    | "DISIPLIN"
    | "TAHFIDZ"
    | "IZIN"
    | "PRESTASI"
    | "BEBAS";

type FreeQuestionMode = "rag_knowledge" | "system_ops";
type RagSourceScope = "public" | "kitab" | "internal";

// ───────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ───────────────────────────────────────────────────────────────────────────

// Role aktual sesuai tabel profiles.role di database
// CATATAN: Gunakan nilai lowercase persis seperti di DB
const ALLOWED_ROLES = [
    "super_admin",
    "rois",
    "kesantrian",
    "bendahara",
    "dewan",       // dewan: read-only (analisis saja, tidak bisa execute agent)
] as const;

type AllowedRole = typeof ALLOWED_ROLES[number];

// Role yang boleh melihat data keuangan
const FINANCE_ROLES: AllowedRole[] = ["super_admin", "rois", "bendahara"];

// Jeda minimal antar request per user (detik) — cegah spam ke Gemini
const RATE_LIMIT_SECONDS = 12;
const MAX_FREE_QUESTION_CHARS = 700;
const GEMINI_TIMEOUT_MS = Number(Deno.env.get("TELEGRAM_GEMINI_TIMEOUT_MS") || 25_000);

// Env variables
const BOT_TOKEN        = Deno.env.get("TELEGRAM_BOT_TOKEN")        ?? "";
const WEBHOOK_SECRET   = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")   ?? "";
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")              ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const ALLOW_INSECURE_DEV = Deno.env.get("TELEGRAM_ALLOW_INSECURE_DEV") === "true";

// Base URL Telegram Bot API
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Emoji per topik
const TOPIC_EMOJI: Record<TopicKey, string> = {
    LAPORAN:  "📊",
    KESEHATAN:"🏥",
    KEUANGAN: "💰",
    DISIPLIN: "⚖️",
    TAHFIDZ:  "📖",
    IZIN:     "🚪",
    PRESTASI: "🏆",
    BEBAS:    "🤖",
};

// Task description per topik untuk buildPrompt
const TOPIC_TASK: Record<TopicKey, string> = {
    LAPORAN:   "Buat laporan eksekutif menyeluruh lintas modul: santri, kesehatan, kedisiplinan, keuangan bila berwenang, tahfidz, perizinan, prestasi, dan operasional. Sajikan kondisi, risiko, prioritas, dan tindak lanjut.",
    KESEHATAN: "Analisa kondisi kesehatan santri secara menyeluruh. Deteksi pola keluhan, potensi wabah, santri yang perlu dipantau, dan rekomendasikan tindakan.",
    KEUANGAN:  "Buat laporan kas bulan ini. Tampilkan pemasukan lunas, pengeluaran, saldo bersih, tagihan belum lunas/cicilan, kategori pengeluaran terbesar, risiko, dan prioritas tindak lanjut.",
    DISIPLIN:  "Evaluasi kedisiplinan santri 7 hari terakhir. Tampilkan total kasus, jenis dominan, top pelanggar, santri bersih, risiko pembinaan, dan tindak lanjut.",
    TAHFIDZ:   "Buat laporan progres hafalan. Tampilkan rata-rata hafalan, top hafidz, setoran minggu ini, santri butuh bimbingan, tren murojaah, dan rekomendasi pembinaan.",
    IZIN:      "Ringkas data perizinan aktif. Tampilkan izin aktif, pending, santri belum kembali sesuai jadwal, risiko, dan tindak lanjut.",
    PRESTASI:  "Rekap prestasi santri terbaru. Tampilkan jumlah, top prestasi, kategori dominan, santri potensial, dan tindak lanjut apresiasi.",
    BEBAS:     "", // diisi dari customQuestion
};

const REPORT_LIMITS: Record<TopicKey, { maxWords: number; maxOutputTokens: number }> = {
    LAPORAN:   { maxWords: 900, maxOutputTokens: 4096 },
    KESEHATAN: { maxWords: 650, maxOutputTokens: 3072 },
    KEUANGAN:  { maxWords: 650, maxOutputTokens: 3072 },
    DISIPLIN:  { maxWords: 600, maxOutputTokens: 3072 },
    TAHFIDZ:   { maxWords: 650, maxOutputTokens: 3072 },
    IZIN:      { maxWords: 550, maxOutputTokens: 2560 },
    PRESTASI:  { maxWords: 550, maxOutputTokens: 2560 },
    BEBAS:     { maxWords: 700, maxOutputTokens: 3072 },
};

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 1 — SECURITY
// ═══════════════════════════════════════════════════════════════════════════

function verifyWebhookSecret(req: Request): boolean {
    if (!WEBHOOK_SECRET) {
        console.error("[Security] WEBHOOK_SECRET belum diset — request ditolak. Set TELEGRAM_ALLOW_INSECURE_DEV=true hanya untuk dev lokal.");
        return ALLOW_INSECURE_DEV;
    }
    const incoming = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    return incoming === WEBHOOK_SECRET;
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 2 — TELEGRAM SENDER
// Akan dipindah ke: supabase/functions/_shared/telegramSender.ts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Kirim pesan teks ke chat Telegram.
 * parse_mode "Markdown" (v1): *bold*, _italic_, `code`, [link](url)
 * Teks panjang di-split otomatis jika melebihi 4096 karakter.
 */
async function sendMessage(
    chatId:    number,
    text:      string,
    parseMode: "Markdown" | "HTML" = "Markdown"
): Promise<void> {
    // Telegram max message length: 4096 char
    const MAX = 4000;
    const chunks = text.length <= MAX
        ? [text]
        : splitTextSafely(text, MAX);

    for (const chunk of chunks) {
        try {
            const res = await fetch(`${TG_API}/sendMessage`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id:                  chatId,
                    text:                     chunk,
                    parse_mode:               parseMode,
                    disable_web_page_preview: true,
                }),
            });
            if (!res.ok) {
                const err = await res.text();
                console.error("[sendMessage] Telegram error:", err);
                // Coba kirim tanpa parse mode jika gagal (biasanya karena karakter khusus)
                await fetch(`${TG_API}/sendMessage`, {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id:                  chatId,
                        text:                     stripMarkdown(chunk),
                        disable_web_page_preview: true,
                    }),
                }).catch(() => null);
            }
        } catch (err) {
            console.error("[sendMessage] Fetch error:", err);
        }
    }
}

/**
 * Split teks panjang di batas baris agar tidak memotong di tengah kata.
 */
function splitTextSafely(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        let end = start + maxLen;
        if (end >= text.length) { chunks.push(text.slice(start)); break; }
        // Cari newline terdekat sebelum maxLen
        const newline = text.lastIndexOf("\n", end);
        if (newline > start + 1000) {
            end = newline;
        } else {
            const sentence = text.lastIndexOf(". ", end);
            if (sentence > start + 1000) end = sentence + 1;
        }
        chunks.push(text.slice(start, end));
        start = text[end] === "\n" || text[end] === " " ? end + 1 : end;
    }
    return chunks;
}

/**
 * Hapus format Markdown agar plain text tidak error di Telegram.
 */
function stripMarkdown(text: string): string {
    return text.replace(/[*_`[\]]/g, "");
}

function sanitizeAiAnswer(text: string, topic: TopicKey, requireAction = true): string {
    let answer = (text || "").trim();
    if (!answer) return "Maaf, AI tidak memberikan jawaban untuk permintaan ini.";

    // Hindari kegagalan parse Markdown Telegram akibat format tabel.
    answer = answer
        .replace(/\r\n/g, "\n")
        .replace(/^\s*\|(.+\|)+\s*$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (requireAction && !/⚡\s*\*?Aksi:/i.test(answer)) {
        answer += `\n\n⚡ *Aksi:* Tinjau prioritas ${TOPIC_EMOJI[topic]} hari ini melalui dashboard dan tindak lanjuti data yang berisiko.`;
    }

    return answer;
}

function cleanTelegramInput(value: string, max = MAX_FREE_QUESTION_CHARS): string {
    return value
        .split("\u0000").join("")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

function normalizeForIntent(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function includesAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term));
}

function isKitabKnowledgeQuestion(question: string): boolean {
    const text = normalizeForIntent(question);
    return includesAny(text, [
        "kitab", "hukum", "fiqih", "fikih", "fatwa", "dalil", "bab", "pasal",
        "syarah", "matan", "adab", "akhlak", "thaharah", "taharah", "wudhu",
        "wudu", "najis", "shalat", "sholat", "puasa", "zakat", "muamalah",
    ]);
}

function isSystemOpsQuestion(question: string): boolean {
    const text = normalizeForIntent(question);
    return includesAny(text, [
        "santri aktif", "jumlah santri", "data santri", "tagihan", "spp", "belum lunas",
        "cicilan", "keuangan", "kas", "pengeluaran", "pemasukan", "saldo", "dompet",
        "hafalan", "tahfidz", "murojaah", "kesehatan", "sakit", "keluhan",
        "pelanggaran", "disiplin", "kedisiplinan", "izin", "perizinan", "prestasi",
        "inventaris", "laporan", "ringkasan", "kinerja", "dashboard", "bulan ini",
        "minggu ini", "hari ini", "terakhir", "risiko operasional", "siapa santri",
        "kelas", "jurusan", "nis",
    ]);
}

function resolveFreeQuestionMode(question: string): FreeQuestionMode {
    return isSystemOpsQuestion(question) ? "system_ops" : "rag_knowledge";
}

function resolveRagScopes(question: string, mode: FreeQuestionMode, canUseInternal: boolean): RagSourceScope[] {
    if (mode === "system_ops") {
        return canUseInternal ? ["internal", "public", "kitab"] : ["public", "kitab"];
    }
    if (isKitabKnowledgeQuestion(question)) return ["kitab", "public"];
    return ["public", "kitab"];
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Tampilkan indikator "mengetik..." — UX feedback saat AI bekerja.
 */
async function sendTypingAction(chatId: number): Promise<void> {
    try {
        await fetch(`${TG_API}/sendChatAction`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, action: "typing" }),
        });
    } catch {
        // Non-critical — abaikan error
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 3 — AUTH & RATE LIMIT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ambil profil admin dari tabel profiles berdasarkan telegram_id.
 * Kolom telegram_id, telegram_username, last_bot_query harus ditambah dulu
 * via SQL migrasi (lihat header file ini).
 */
async function getAdminProfile(
    supabase:   ReturnType<typeof createClient>,
    telegramId: number
): Promise<AdminProfile | null> {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, akses_gender, akses_jurusan, telegram_id, telegram_username, last_bot_query")
        .eq("telegram_id", telegramId)
        .eq("is_active", true) // hanya akun aktif
        .maybeSingle();

    if (error) {
        console.error("[getAdminProfile] DB error:", error.message);
        return null;
    }
    if (!data) return null;

    // Validasi role — harus lowercase persis seperti di DB
    if (!ALLOWED_ROLES.includes(data.role as AllowedRole)) {
        console.warn(`[Auth] Role tidak diizinkan: "${data.role}" — user: ${data.full_name}`);
        return null;
    }

    return data as AdminProfile;
}

/**
 * Rate limit per user. Persistent via kolom last_bot_query di DB.
 * Aman dari cold start karena state disimpan di database.
 */
async function checkRateLimit(
    supabase: ReturnType<typeof createClient>,
    admin:    AdminProfile
): Promise<{ allowed: boolean; waitSeconds?: number }> {
    if (!admin.last_bot_query) {
        await updateLastQuery(supabase, admin.id);
        return { allowed: true };
    }

    const diffSec = (Date.now() - new Date(admin.last_bot_query).getTime()) / 1000;

    if (diffSec < RATE_LIMIT_SECONDS) {
        return {
            allowed:     false,
            waitSeconds: Math.ceil(RATE_LIMIT_SECONDS - diffSec),
        };
    }

    await updateLastQuery(supabase, admin.id);
    return { allowed: true };
}

async function updateLastQuery(
    supabase: ReturnType<typeof createClient>,
    userId:   string
): Promise<void> {
    await supabase
        .from("profiles")
        .update({ last_bot_query: new Date().toISOString() })
        .eq("id", userId);
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 4 — AUDIT LOG
// Menggunakan tabel audit_logs sesuai schema aktual
// ═══════════════════════════════════════════════════════════════════════════

async function logBotActivity(
    supabase:  ReturnType<typeof createClient>,
    admin:     AdminProfile,
    command:   string,
    details:   Record<string, unknown> = {}
): Promise<void> {
    try {
        await supabase.from("audit_logs").insert({
            user_id:   admin.id,
            user_name: admin.full_name,
            user_role: admin.role,
            action:    "BOT_QUERY",
            resource:  "telegram_bot",
            record_id: String(admin.telegram_id),
            details:   { command, via: "telegram", ...details },
            meta_info: `[TELEGRAM_BOT] ${command} | By: ${admin.full_name} (${admin.role})`,
        });
    } catch (err) {
        // Jangan hentikan flow utama jika audit log gagal
        console.error("[logBotActivity] Error:", err);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 5 — DATA CONTEXT BUILDER
// Akan dipindah ke: supabase/functions/_shared/buildDataContext.ts
//
// Query seluruh data pesantren dari Supabase secara paralel.
// Sesuai schema aktual — tabel absensi & guru TIDAK ADA di schema ini.
// Filtering sesuai akses_jurusan dan akses_gender admin yang meminta.
// ═══════════════════════════════════════════════════════════════════════════

async function buildDataContext(
    supabase: ReturnType<typeof createClient>,
    admin:    AdminProfile
): Promise<string> {
    const now        = new Date();
    const weekAgo    = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const toISO      = (d: Date) => d.toISOString().split("T")[0];
    const idr        = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

    // ── Scope filter berdasarkan akses admin ──────────────────────
    // Jika admin hanya boleh lihat jurusan/gender tertentu, filter di sini
    const hasJurusanScope = admin.akses_jurusan !== "ALL";
    const hasGenderScope  = admin.akses_gender  !== "ALL";

    // Builder query santri dengan scope
    // deno-lint-ignore no-explicit-any
    const buildSantriQuery = (fields: string) => {
        let q = supabase
            .from("santri")
            .select(fields)
            .eq("status_santri", "AKTIF");
        if (hasJurusanScope) q = q.eq("jurusan", admin.akses_jurusan);
        if (hasGenderScope)  q = q.eq("jenis_kelamin", admin.akses_gender);
        return q;
    };

    // ── Query paralel semua resource ──────────────────────────────
    const [
        resSantri,
        resSakitWeek,
        resPelanggaranWeek,
        resPengeluaranMonth,
        resTagihanMonth,
        resHafalanTahfidz,
        resMurojaah,
        resHafalanKitab,
        resPerizinanAktif,
        resPrestasiMonth,
        resInventarisRusak,
    ] = await Promise.allSettled([
        // Santri aktif — kolom yang benar-benar ada di schema
        buildSantriQuery("nis, kelas, jurusan, jenis_kelamin, total_hafalan, hafalan_kitab, pembimbing"),

        // Kesehatan 7 hari — field: keluhan, tindakan, catatan (bukan keterangan!)
        supabase
            .from("kesehatan_santri")
            .select("santri_nis, tanggal, keluhan, tindakan")
            .gte("tanggal", toISO(weekAgo)),

        // Pelanggaran 7 hari — aggregate poin per santri
        supabase
            .from("pelanggaran_santri")
            .select("santri_nis, jenis_pelanggaran, poin, tanggal")
            .gte("tanggal", toISO(weekAgo))
            .order("tanggal", { ascending: false }),

        // Pengeluaran bulan ini
        supabase
            .from("pengeluaran")
            .select("nominal, kategori, judul, tanggal_pengeluaran")
            .gte("tanggal_pengeluaran", toISO(monthStart)),

        // Tagihan bulan ini — status LUNAS | BELUM | CICILAN
        supabase
            .from("tagihan_santri")
            .select("nominal_tagihan, sisa_tagihan, status, deskripsi_tagihan")
            .gte("created_at", toISO(monthStart)),

        // Hafalan tahfidz 7 hari — predikat MUMTAZ | JAYYID | KURANG
        supabase
            .from("hafalan_tahfidz")
            .select("santri_nis, surat, juz, predikat, status, total_hafalan, tanggal")
            .gte("tanggal", toISO(weekAgo))
            .order("tanggal", { ascending: false }),

        // Murojaah 7 hari
        supabase
            .from("murojaah_tahfidz")
            .select("santri_nis, jenis_murojaah, juz, predikat, tanggal")
            .gte("tanggal", toISO(weekAgo)),

        // Hafalan kitab 7 hari
        supabase
            .from("hafalan_kitab")
            .select("santri_nis, nama_kitab, bab_materi, predikat, status, tanggal")
            .gte("tanggal", toISO(weekAgo))
            .order("tanggal", { ascending: false }),

        // Perizinan aktif — status PENDING | APPROVED | REJECTED
        supabase
            .from("perizinan_santri")
            .select("santri_nis, jenis_izin, tanggal, tanggal_kembali, status, keterangan")
            .gte("tanggal", toISO(weekAgo))
            .order("tanggal", { ascending: false }),

        // Prestasi bulan ini
        supabase
            .from("prestasi_santri")
            .select("santri_nis, kategori, judul_prestasi, poin_prestasi, tanggal_prestasi")
            .gte("tanggal_prestasi", toISO(monthStart))
            .order("poin_prestasi", { ascending: false }),

        // Inventaris kondisi bermasalah — kondisi: RUSAK_RINGAN | RUSAK_BERAT | HILANG
        supabase
            .from("inventaris")
            .select("nama_barang, kondisi, jumlah")
            .in("kondisi", ["RUSAK_RINGAN", "RUSAK_BERAT", "HILANG"]),
    ]);

    // Helper: ambil data safely
    // deno-lint-ignore no-explicit-any
    const safe = <T>(r: PromiseSettledResult<{ data: T[] | null; error: unknown }>): T[] =>
        r.status === "fulfilled" ? (r.value.data ?? []) : [];

    // deno-lint-ignore no-explicit-any
    const santriList       = safe<any>(resSantri);
    // deno-lint-ignore no-explicit-any
    const sakitList        = safe<any>(resSakitWeek);
    // deno-lint-ignore no-explicit-any
    const pelList          = safe<any>(resPelanggaranWeek);
    // deno-lint-ignore no-explicit-any
    const pengeluaranList  = safe<any>(resPengeluaranMonth);
    // deno-lint-ignore no-explicit-any
    const tagihanList      = safe<any>(resTagihanMonth);
    // deno-lint-ignore no-explicit-any
    const hafalanList      = safe<any>(resHafalanTahfidz);
    // deno-lint-ignore no-explicit-any
    const murojaahList     = safe<any>(resMurojaah);
    // deno-lint-ignore no-explicit-any
    const kitabList        = safe<any>(resHafalanKitab);
    // deno-lint-ignore no-explicit-any
    const perizinanList    = safe<any>(resPerizinanAktif);
    // deno-lint-ignore no-explicit-any
    const prestasiList     = safe<any>(resPrestasiMonth);
    // deno-lint-ignore no-explicit-any
    const inventarisRusak  = safe<any>(resInventarisRusak);
    const queryLabels = [
        "santri", "kesehatan", "pelanggaran", "pengeluaran", "tagihan",
        "hafalan_tahfidz", "murojaah", "hafalan_kitab", "perizinan",
        "prestasi", "inventaris",
    ];
    const queryResults = [
        resSantri, resSakitWeek, resPelanggaranWeek, resPengeluaranMonth, resTagihanMonth,
        resHafalanTahfidz, resMurojaah, resHafalanKitab, resPerizinanAktif,
        resPrestasiMonth, resInventarisRusak,
    ];
    const failedSources = queryResults
        .map((r, idx) => {
            if (r.status === "rejected") return queryLabels[idx];
            return r.value.error ? queryLabels[idx] : null;
        })
        .filter(Boolean);
    const canSeeFinance = FINANCE_ROLES.includes(admin.role as AllowedRole);

    // ── Buat lookup nama santri ──────────────────────────────────
    // deno-lint-ignore no-explicit-any
    const santriMap: Record<string, any> = {};
    // deno-lint-ignore no-explicit-any
    santriList.forEach((s: any) => { santriMap[s.nis] = s; });

    const namaOf = (nis: string, short = false): string => {
        void short;
        const safeNis = String(nis || "").replace(/[^0-9A-Za-z]/g, "");
        return `Santri-${safeNis.slice(-4) || "XXXX"}`;
    };
    const kelasOf = (nis: string): string => santriMap[nis]?.kelas ?? "?";

    // ── Kalkulasi SANTRI ──────────────────────────────────────────
    const totalSantri  = santriList.length;
    const perKelas: Record<string, number> = {};
    // deno-lint-ignore no-explicit-any
    santriList.forEach((s: any) => {
        perKelas[`${s.jurusan}-${s.kelas}`] = (perKelas[`${s.jurusan}-${s.kelas}`] || 0) + 1;
    });
    const distribusiKelas = Object.entries(perKelas)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}:${v}`)
        .join(", ") || "-";

    // ── Kalkulasi KESEHATAN ───────────────────────────────────────
    const sakitCount = sakitList.length;
    // Deteksi keluhan yang muncul > 1 kali (potensi wabah)
    const keluhanFreq: Record<string, number> = {};
    // deno-lint-ignore no-explicit-any
    sakitList.forEach((s: any) => {
        const k = (s.keluhan ?? "tidak diketahui").toLowerCase();
        keluhanFreq[k] = (keluhanFreq[k] || 0) + 1;
    });
    const dominanKeluhan = Object.entries(keluhanFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, n]) => `${k}(${n}x)`)
        .join(", ") || "nihil";
    const pasienDetail = sakitList.slice(0, 4)
        // deno-lint-ignore no-explicit-any
        .map((s: any) => `${namaOf(s.santri_nis, true)}[${s.keluhan ?? "sakit"}]`)
        .join(", ") || "nihil";
    const potensialWabah = Object.values(keluhanFreq).some(n => n >= 3) ? "⚠️ WASPADAI" : "Normal";

    // ── Kalkulasi KEDISIPLINAN ────────────────────────────────────
    // Aggregate poin per santri dari pelanggaran_santri
    const poinAgg: Record<string, number> = {};
    // deno-lint-ignore no-explicit-any
    pelList.forEach((p: any) => {
        poinAgg[p.santri_nis] = (poinAgg[p.santri_nis] || 0) + (Number(p.poin) || 0);
    });
    const topPelanggar = Object.entries(poinAgg)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([nis, poin]) => `${namaOf(nis, true)}(${kelasOf(nis)},${poin}poin)`)
        .join(", ") || "alhamdulillah nihil";
    const jenisDominan: Record<string, number> = {};
    // deno-lint-ignore no-explicit-any
    pelList.forEach((p: any) => {
        const j = p.jenis_pelanggaran ?? "lainnya";
        jenisDominan[j] = (jenisDominan[j] || 0) + 1;
    });
    const jenisTop = Object.entries(jenisDominan)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, v]) => `${k}(${v}x)`)
        .join(", ") || "-";
    const santriKleanCount = santriList.filter(
        // deno-lint-ignore no-explicit-any
        (s: any) => !poinAgg[s.nis]
    ).length;

    // ── Kalkulasi KEUANGAN ────────────────────────────────────────
    const totalKeluar = pengeluaranList.reduce(
        // deno-lint-ignore no-explicit-any
        (a: number, b: any) => a + Number(b.nominal ?? 0), 0
    );
    const totalMasuk = tagihanList
        // deno-lint-ignore no-explicit-any
        .filter((t: any) => t.status === "LUNAS")
        // deno-lint-ignore no-explicit-any
        .reduce((a: number, b: any) => a + Number(b.nominal_tagihan ?? 0), 0);
    const totalBelum = tagihanList
        // deno-lint-ignore no-explicit-any
        .filter((t: any) => t.status === "BELUM")
        // deno-lint-ignore no-explicit-any
        .reduce((a: number, b: any) => a + Number(b.nominal_tagihan ?? 0), 0);
    const totalCicilan = tagihanList
        // deno-lint-ignore no-explicit-any
        .filter((t: any) => t.status === "CICILAN")
        // deno-lint-ignore no-explicit-any
        .reduce((a: number, b: any) => a + Number(b.sisa_tagihan ?? 0), 0);
    const saldo = totalMasuk - totalKeluar;

    // Distribusi pengeluaran per kategori
    const katMap: Record<string, number> = {};
    // deno-lint-ignore no-explicit-any
    pengeluaranList.forEach((d: any) => {
        katMap[d.kategori ?? "Lainnya"] = (katMap[d.kategori ?? "Lainnya"] || 0) + Number(d.nominal);
    });
    const topKategori = Object.entries(katMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}:${idr(v)}`)
        .join(", ") || "-";

    // ── Kalkulasi TAHFIDZ ─────────────────────────────────────────
    // total_hafalan di santri bertipe TEXT di schema — konversi ke number
    const hafalanNumbers = santriList
        // deno-lint-ignore no-explicit-any
        .map((s: any) => parseInt(s.total_hafalan ?? "0", 10))
        .filter((n: number) => !isNaN(n));
    const avgHafalan = hafalanNumbers.length > 0
        ? (hafalanNumbers.reduce((a: number, b: number) => a + b, 0) / hafalanNumbers.length).toFixed(1)
        : "0";
    const topHafidz = [...santriList]
        // deno-lint-ignore no-explicit-any
        .sort((a: any, b: any) => parseInt(b.total_hafalan ?? "0", 10) - parseInt(a.total_hafalan ?? "0", 10))
        .slice(0, 3)
        // deno-lint-ignore no-explicit-any
        .map((s: any) => `${namaOf(s.nis, true)}(${s.total_hafalan ?? 0}juz)`)
        .join(", ") || "-";
    const mumtazWeek  = hafalanList.filter((h: { predikat: string }) => h.predikat === "MUMTAZ").length;
    const kurangWeek  = hafalanList.filter((h: { predikat: string }) => h.predikat === "KURANG").length;
    const ulangWeek   = hafalanList.filter((h: { status: string }) => h.status === "ULANG").length;
    const murojaahCount = murojaahList.length;
    const mumtazKitab = kitabList.filter((k: { predikat: string }) => k.predikat === "MUMTAZ").length;

    // ── Kalkulasi PERIZINAN ───────────────────────────────────────
    const izinAktif   = perizinanList.filter((p: { status: string }) => p.status === "APPROVED");
    const izinPending = perizinanList.filter((p: { status: string }) => p.status === "PENDING");
    const today       = toISO(new Date());
    const belumKembali = izinAktif.filter(
        (p: { tanggal_kembali: string }) => p.tanggal_kembali && p.tanggal_kembali < today
    );
    const detailIzin = izinAktif.slice(0, 4)
        .map((p: { santri_nis: string; jenis_izin: string; tanggal_kembali: string }) =>
            `${namaOf(p.santri_nis, true)}[${p.jenis_izin ?? "izin"},kembali:${p.tanggal_kembali ?? "?"}]`
        ).join(", ") || "nihil";

    // ── Kalkulasi PRESTASI ────────────────────────────────────────
    const totalPrestasi = prestasiList.length;
    const topPrestasiDetail = prestasiList.slice(0, 3)
        .map((p: { santri_nis: string; judul_prestasi: string; poin_prestasi: number }) =>
            `${namaOf(p.santri_nis, true)}: ${p.judul_prestasi}(+${p.poin_prestasi})`
        ).join("\n• ") || "nihil";
    const kategoriPrestasi: Record<string, number> = {};
    prestasiList.forEach((p: { kategori: string }) => {
        kategoriPrestasi[p.kategori ?? "UMUM"] = (kategoriPrestasi[p.kategori ?? "UMUM"] || 0) + 1;
    });

    // ── Inventaris ────────────────────────────────────────────────
    const rusak       = inventarisRusak.filter((i: { kondisi: string }) => i.kondisi === "RUSAK_BERAT").length;
    const rusakRingan = inventarisRusak.filter((i: { kondisi: string }) => i.kondisi === "RUSAK_RINGAN").length;
    const hilang      = inventarisRusak.filter((i: { kondisi: string }) => i.kondisi === "HILANG").length;

    // ── Waktu & identitas request ─────────────────────────────────
    const namaHari = now.toLocaleDateString("id-ID", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
        timeZone: "Asia/Jakarta",
    });
    const namaJam = now.toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
    });

    // Scope info untuk AI
    const scopeInfo = hasJurusanScope || hasGenderScope
        ? `Scope: ${hasJurusanScope ? `Jurusan ${admin.akses_jurusan}` : ""}${hasJurusanScope && hasGenderScope ? " + " : ""}${hasGenderScope ? `Gender ${admin.akses_gender}` : ""}`
        : "Scope: Semua santri";

    const financeSection = canSeeFinance
        ? `[KEUANGAN — BULAN ${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" }).toUpperCase()}]
Masuk (Lunas): ${idr(totalMasuk)} | Keluar: ${idr(totalKeluar)}
Saldo Bersih: ${idr(saldo)} | Status: ${saldo >= 0 ? "SURPLUS" : "DEFISIT"}
Tagihan Belum Lunas: ${idr(totalBelum)} | Cicilan: ${idr(totalCicilan)}
Pengeluaran per Kategori: ${topKategori}`
        : `[KEUANGAN]
Data keuangan disembunyikan karena role ${admin.role} tidak memiliki akses keuangan.`;

    // ── Susun konteks teks final ───────────────────────────────────
    return `
SNAPSHOT PESANTREN AL-HASANAH
Waktu: ${namaHari} pukul ${namaJam} WIB
Admin: ${admin.full_name} (${admin.role}) | ${scopeInfo}
Kualitas Data: ${failedSources.length ? `Sebagian data gagal dimuat: ${failedSources.join(", ")}` : "Semua sumber utama berhasil dimuat"}

[SANTRI AKTIF]
Total: ${totalSantri} santri | Distribusi: ${distribusiKelas}

[KESEHATAN — 7 HARI TERAKHIR]
Sakit: ${sakitCount} santri | Status Wabah: ${potensialWabah}
Keluhan Dominan: ${dominanKeluhan}
Detail Pasien: ${pasienDetail}

[KEDISIPLINAN — 7 HARI TERAKHIR]
Total Pelanggaran: ${pelList.length} kasus | Santri Bersih: ${santriKleanCount}/${totalSantri}
Jenis Dominan: ${jenisTop}
Top Pelanggar: ${topPelanggar}

${financeSection}

[TAHFIDZ — SETORAN MINGGU INI]
Rata-rata Hafalan: ${avgHafalan} juz/santri
Top Hafidz: ${topHafidz}
Setoran: Mumtaz ${mumtazWeek}, Perlu Ulang ${ulangWeek}, Kurang ${kurangWeek}
Murojaah: ${murojaahCount} sesi | Kitab Mumtaz: ${mumtazKitab}

[PERIZINAN — 7 HARI TERAKHIR]
Izin Aktif: ${izinAktif.length} | Pending: ${izinPending.length} | Belum Kembali: ${belumKembali.length}
Detail: ${detailIzin}

[PRESTASI — BULAN INI]
Total: ${totalPrestasi} | Top:
• ${topPrestasiDetail}

[OPERASIONAL]
Inventaris Rusak Berat: ${rusak} | Rusak Ringan: ${rusakRingan} | Hilang: ${hilang}
`.trim();
}

async function embedTelegramQuery(query: string): Promise<number[]> {
    const model = Deno.env.get("AI_EMBEDDING_MODEL") || "gemini-embedding-001";
    const preparedText = model.startsWith("gemini-embedding")
        ? `task: question answering | query: ${query}`
        : query;

    const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(model.startsWith("gemini-embedding") ? {
                content: { parts: [{ text: preparedText }] },
                output_dimensionality: 768,
            } : {
                content: { parts: [{ text: query }] },
                taskType: "RETRIEVAL_QUERY",
                output_dimensionality: 768,
            }),
        },
        GEMINI_TIMEOUT_MS,
    );

    const data = await response.json();
    if (!response.ok) {
        console.error("[Telegram RAG] embedding error:", JSON.stringify(data));
        return [];
    }

    const values = data.embedding?.values;
    return Array.isArray(values) ? values as number[] : [];
}

async function buildTelegramRagContext(
    supabase: ReturnType<typeof createClient>,
    admin: AdminProfile,
    question: string,
    mode: FreeQuestionMode,
): Promise<{ context: string; sources: string[] }> {
    if (!question || !GEMINI_API_KEY) return { context: "", sources: [] };

    const embedding = await embedTelegramQuery(question);
    if (embedding.length !== 768) return { context: "", sources: [] };

    const canUseInternal = ["super_admin", "rois", "dewan"].includes(admin.role);
    const scopes = resolveRagScopes(question, mode, canUseInternal);
    const matchCount = Math.min(Number(Deno.env.get("RAG_MAX_CHUNKS") || 4), 4);

    const publicPromise = scopes.includes("public")
        ? supabase.rpc("match_public_documents", {
            query_embedding: embedding,
            match_threshold: Number(Deno.env.get("RAG_MATCH_THRESHOLD_PUBLIC") || 0.70),
            match_count: matchCount,
        })
        : Promise.resolve({ data: [], error: null });
    const kitabPromise = scopes.includes("kitab")
        ? supabase.rpc("match_kitab_documents", {
            query_embedding: embedding,
            match_threshold: Number(Deno.env.get("RAG_MATCH_THRESHOLD_KITAB") || 0.65),
            match_count: isKitabKnowledgeQuestion(question) ? matchCount : 2,
        })
        : Promise.resolve({ data: [], error: null });
    const internalPromise = scopes.includes("internal") && canUseInternal
        ? supabase.rpc("match_internal_documents", {
            query_embedding: embedding,
            match_threshold: Number(Deno.env.get("RAG_MATCH_THRESHOLD_INTERNAL") || 0.72),
            match_count: matchCount,
        })
        : Promise.resolve({ data: [], error: null });

    const [publicResult, kitabResult, internalResult] = await Promise.all([
        publicPromise,
        kitabPromise,
        internalPromise,
    ]);

    for (const [label, result] of [
        ["public", publicResult],
        ["kitab", kitabResult],
        ["internal", internalResult],
    ] as const) {
        if (result.error) console.error(`[Telegram RAG] ${label} match error:`, result.error);
    }

    const matches = [
        ...((publicResult.data || []) as Array<Record<string, unknown>>).map((row) => ({ ...row, source_label: "Publik" })),
        ...((kitabResult.data || []) as Array<Record<string, unknown>>).map((row) => ({ ...row, source_label: "Kitab" })),
        ...((internalResult.data || []) as Array<Record<string, unknown>>).map((row) => ({ ...row, source_label: "Internal" })),
    ]
        .filter((row) => scopes.includes(
            String(row.source_label || "").toLowerCase() === "publik"
                ? "public"
                : String(row.source_label || "").toLowerCase() as RagSourceScope,
        ))
        .sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0))
        .slice(0, 5);

    const sources: string[] = [];
    let context = "";
    for (const [index, match] of matches.entries()) {
        const title = String(match.title || "Dokumen");
        const similarity = Number(match.similarity || 0).toFixed(3);
        const content = String(match.content || "").slice(0, 900);
        const sourceLabel = String(match.source_label || "RAG");
        sources.push(`${sourceLabel}: ${title} (${similarity})`);
        const next = [
            `Sumber RAG ${index + 1}: ${sourceLabel} - ${title}`,
            `Similarity: ${similarity}`,
            `Isi: ${content}`,
        ].join("\n");
        if ((context + "\n\n" + next).length > 3200) break;
        context = `${context}\n\n${next}`.trim();
    }

    return { context, sources };
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 6 — PROMPT BUILDER
// Format output disesuaikan untuk Telegram (bukan tabel, tapi bullet).
// ═══════════════════════════════════════════════════════════════════════════

function buildPrompt(
    topic:           TopicKey,
    dataContext:     string,
    admin:           AdminProfile,
    customQuestion?: string,
    ragContext?: string,
    freeQuestionMode?: FreeQuestionMode,
): string {
    // Instruksi scope untuk AI
    const scopeNote = admin.akses_jurusan !== "ALL" || admin.akses_gender !== "ALL"
        ? `\nCATATAN: Admin ini hanya punya akses jurusan ${admin.akses_jurusan} & gender ${admin.akses_gender}. Batasi analisa sesuai scope ini.`
        : "";
    const limits = REPORT_LIMITS[topic];
    const isFullReport = topic === "LAPORAN";
    const isKnowledgeFree = topic === "BEBAS" && freeQuestionMode === "rag_knowledge";

    const SYSTEM_PROMPT = isKnowledgeFree
        ? `Anda adalah asisten knowledge base Pesantren Al-Hasanah. Jawaban dikirim via Telegram.${scopeNote}

ATURAN OUTPUT:
① Maksimal 450 kata.
② Format Telegram (parse_mode Markdown v1): *bold*, _italic_, \`code\`
③ Jawab langsung sesuai pertanyaan, profesional, dan mudah dipahami.
④ Utamakan KONTEKS RAG. Jangan mengarang isi dokumen yang tidak ada.
⑤ Jangan membuat laporan kinerja, laporan santri, atau audit operasional kecuali user memintanya secara eksplisit.
⑥ Jika pertanyaan kitab/hukum, jawaban adalah ringkasan referensi, bukan fatwa final; sarankan konfirmasi ke ustadz/pengasuh untuk keputusan amaliah penting.
⑦ Sebutkan sumber dokumen secara ringkas jika tersedia.

FORMAT:
*[JAWABAN SINGKAT]*
• [poin utama]
• [poin pendukung]
• [catatan sumber/keterbatasan bila perlu]`
        : `Anda adalah Analis Data Eksekutif Pesantren Al-Hasanah. Jawaban dikirim via Telegram.${scopeNote}

ATURAN OUTPUT:
① Maksimal ${limits.maxWords} kata. Jangan terlalu ringkas; semua angka penting dan risiko harus muncul.
② Format Telegram (parse_mode Markdown v1): *bold*, _italic_, \`code\`
③ Jangan gunakan tabel Markdown. Gunakan heading pendek dan bullet •.
④ Jangan mengarang data. Jika data nihil, tulis "nihil"; jika sumber gagal, sebutkan keterbatasannya.
⑤ Beri analisis, bukan hanya salin angka: jelaskan implikasi, risiko, dan prioritas.
⑥ Untuk laporan menyeluruh, bahas semua modul yang ada di data. Untuk topik spesifik, tetap sebutkan konteks lintas modul jika relevan.
⑦ Jika ada KONTEKS RAG, gunakan sebagai referensi pendukung dan sebutkan sumbernya secara ringkas.
⑧ Akhiri SELALU dengan: ⚡ *Aksi:* [2-3 tindakan konkret dan spesifik]

FORMAT WAJIB:
*[EMOJI] [JUDUL SINGKAT]*
*Status:* [🟢/🟡/🔴] — [keterangan singkat]

${isFullReport ? `*Ringkasan Eksekutif*
• [3-5 poin kondisi utama]

*Temuan Per Modul*
• Santri: [angka + makna]
• Kesehatan: [angka + risiko]
• Disiplin: [angka + risiko]
• Keuangan: [angka + risiko, jika berwenang]
• Tahfidz: [angka + risiko]
• Perizinan/Prestasi/Operasional: [angka + risiko]

*Prioritas*
• [prioritas 1]
• [prioritas 2]
• [prioritas 3]` : `*Temuan Utama*
• [data spesifik 1 + makna]
• [data spesifik 2 + makna]
• [data spesifik 3 + makna]

*Risiko & Catatan*
• [risiko atau keterbatasan data]
• [santri/kategori yang perlu dipantau bila ada]`}

⚡ *Aksi:* [2-3 tindakan konkret]`;

    const dataSection = dataContext
        ? `\n\n━━━ DATA REAL-TIME SISTEM ━━━\n${dataContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        : "";
    const ragSection = ragContext
        ? `\n\n━━━ KONTEKS RAG TERKAIT ━━━\n${ragContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        : "";

    if (topic === "BEBAS") {
        const modeInstruction = freeQuestionMode === "rag_knowledge"
            ? [
                "MODE TANYA KNOWLEDGE:",
                "1. Jawab pertanyaan dari KONTEKS RAG sebagai sumber utama.",
                "2. Jangan mengubah pertanyaan umum/kitab/profil pesantren menjadi laporan kinerja, laporan santri, atau audit operasional.",
                "3. Jika KONTEKS RAG tersedia, jangan mengawali jawaban dengan jumlah santri, status kinerja, tagihan, atau data operasional kecuali user memang menanyakannya.",
                "4. Jika konteks RAG tidak cukup, katakan bahwa referensi belum cukup dan beri jawaban umum singkat hanya bila aman.",
            ].join("\n")
            : [
                "MODE TANYA OPERASIONAL:",
                "1. Gunakan DATA REAL-TIME SISTEM sebagai sumber utama.",
                "2. Gunakan KONTEKS RAG hanya sebagai pendukung kebijakan, referensi, atau definisi.",
            ].join("\n");

        return `${SYSTEM_PROMPT}${dataSection}${ragSection}\n\n${modeInstruction}\n\nPERTANYAAN ADMIN (${admin.full_name}): ${customQuestion ?? "tidak ada pertanyaan"}`;
    }

    return `${SYSTEM_PROMPT}${dataSection}${ragSection}\n\nTUGAS ANALISA: ${TOPIC_TASK[topic]}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 7 — COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * /start — Handler untuk pengguna terdaftar maupun belum.
 * Dipanggil SEBELUM auth check agar user yang belum terdaftar
 * tetap mendapat instruksi cara mendaftar.
 */
async function handleStart(
    supabase:     ReturnType<typeof createClient>,
    chatId:       number,
    telegramUser: TelegramUser
): Promise<void> {
    const profile = await getAdminProfile(supabase, telegramUser.id);

    if (profile) {
        await sendMessage(chatId,
            `✅ *Assalamu'alaikum, ${profile.full_name}!*\n\n` +
            `Role: *${profile.role}*\n` +
            `Akses: Jurusan *${profile.akses_jurusan}* | Gender *${profile.akses_gender}*\n\n` +
            `Sistem Al-Hasanah siap melayani. Ketik /help untuk daftar perintah.`
        );
        return;
    }

    // Belum terdaftar — tampilkan ID Telegram untuk didaftarkan admin
    await sendMessage(chatId,
        `🤖 *Al-Hasanah AI Command Center*\n\n` +
        `Halo, *${telegramUser.first_name}!*\n\n` +
        `Akun Telegram Anda belum terhubung ke sistem.\n\n` +
        `📋 *Cara mendaftarkan akun:*\n` +
        `1. Login ke dashboard admin Al-Hasanah\n` +
        `2. Buka *Pengaturan → Profil Saya*\n` +
        `3. Klik *"Hubungkan Telegram"*\n` +
        `4. Masukkan Telegram ID Anda:\n\n` +
        `\`${telegramUser.id}\`\n\n` +
        `_Salin angka di atas dan paste di form dashboard._\n\n` +
        `Hubungi administrator jika butuh bantuan.`
    );
}

/** /help — Tampilkan semua command */
async function handleHelp(chatId: number, admin: AdminProfile): Promise<void> {
    const isFinance = FINANCE_ROLES.includes(admin.role as AllowedRole);

    await sendMessage(chatId,
        `🤖 *Al-Hasanah AI Command Center*\n` +
        `_Login: ${admin.full_name} · ${admin.role}_\n\n` +
        `*Perintah tersedia:*\n\n` +
        `📊 /laporan — Ringkasan harian menyeluruh\n` +
        `🏥 /kesehatan — Kondisi kesehatan santri\n` +
        `⚖️ /disiplin — Rekap kedisiplinan & pelanggaran\n` +
        `📖 /tahfidz — Progres hafalan santri\n` +
        `🚪 /izin — Status perizinan aktif\n` +
        `🏆 /prestasi — Prestasi santri bulan ini\n` +
        (isFinance ? `💰 /keuangan — Laporan kas bulan ini\n` : "") +
        `🤖 /tanya [pertanyaan] — Konsultasi bebas AI\n\n` +
        `*Contoh:*\n` +
        `\`/tanya siapa santri yang sering sakit?\`\n` +
        `\`/tanya santri kelas 2 hafalan berapa?\`\n\n` +
        `_Data real-time langsung dari database._`
    );
}

/**
 * Handler utama untuk semua topik analisa.
 * Alur: buildDataContext → buildPrompt → invoke(gemini-consultant) → sendMessage
 */
async function handleTopicCommand(
    supabase:        ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.0").createClient>,
    admin:           AdminProfile,
    chatId:          number,
    topic:           TopicKey,
    customQuestion?: string
): Promise<void> {

    // 1. Tampilkan indikator "mengetik..." — feedback penting agar admin
    //    tidak mengira bot hang selama AI memproses (bisa 5-10 detik)
    await sendTypingAction(chatId);

    // 2. Guard: GEMINI_API_KEY wajib ada
    if (!GEMINI_API_KEY) {
        console.error("[handleTopicCommand] GEMINI_API_KEY tidak ter-set di Supabase Secrets");
        await sendMessage(chatId,
            `⚠️ *Konfigurasi Error*\n\n` +
            `\`GEMINI_API_KEY\` belum diset di Supabase Edge Function Secrets.\n\n` +
            `Buka: *Dashboard → Settings → Edge Functions → Secrets*`
        );
        return;
    }

    // 3. Guard: role bendahara tidak bisa akses keuangan
    //    (sesuai FINANCE_ROLES yang sudah didefinisikan di constants)
    if (topic === "KEUANGAN" && !FINANCE_ROLES.includes(admin.role as AllowedRole)) {
        await sendMessage(chatId,
            `🔒 *Akses Terbatas*\n\n` +
            `Data keuangan hanya dapat diakses oleh:\n` +
            `• super\\_admin\n• rois\n• bendahara\n\n` +
            `Role Anda saat ini: *${admin.role}*`
        );
        return;
    }

    const safeQuestion = customQuestion ? cleanTelegramInput(customQuestion) : undefined;
    if (customQuestion && !safeQuestion) {
        await sendMessage(chatId, "❓ Pertanyaan kosong setelah dibersihkan. Coba tulis ulang pertanyaannya.");
        return;
    }

    const freeQuestionMode: FreeQuestionMode | undefined = topic === "BEBAS" && safeQuestion
        ? resolveFreeQuestionMode(safeQuestion)
        : undefined;

    let ragContext = "";
    let ragSources: string[] = [];
    if (safeQuestion && topic === "BEBAS") {
        try {
            const rag = await buildTelegramRagContext(supabase, admin, safeQuestion, freeQuestionMode ?? "rag_knowledge");
            ragContext = rag.context;
            ragSources = rag.sources;
        } catch (err) {
            console.error("[Telegram RAG] context build failed:", err);
        }
    }

    // Ambil snapshot sistem hanya untuk command laporan/topik operasional.
    // Pertanyaan knowledge umum/kitab harus RAG-first agar tidak berubah menjadi laporan kinerja.
    let dataContext = "";
    if (topic !== "BEBAS" || freeQuestionMode === "system_ops") {
        try {
            dataContext = await buildDataContext(supabase, admin);
        } catch (err) {
            console.error("[buildDataContext] Error:", err);
            await sendMessage(chatId,
                `⚠️ *Gagal Mengambil Data*\n\n` +
                `Terjadi kesalahan saat memuat data pesantren.\n` +
                `Coba lagi dalam beberapa saat.`
            );
            return;
        }
    }

    const prompt = buildPrompt(topic, dataContext, admin, safeQuestion, ragContext, freeQuestionMode);
    const limits = freeQuestionMode === "rag_knowledge"
        ? { maxWords: 450, maxOutputTokens: 1600 }
        : REPORT_LIMITS[topic];

    // 6. Panggil Gemini API langsung — tidak melalui gemini-consultant
    //    Ini menghilangkan masalah JWT antar Edge Function
    let answer: string;
    try {
        const GEMINI_URL =
            `https://generativelanguage.googleapis.com/v1beta/models/` +
            `gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const geminiRes = await fetchWithTimeout(GEMINI_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature:     0.35,  // Lebih stabil untuk laporan berbasis data
                    topK:            40,
                    topP:            0.92,
                    maxOutputTokens: limits.maxOutputTokens,
                },
            }),
        }, GEMINI_TIMEOUT_MS);

        // Parse response
        const geminiData = await geminiRes.json();

        if (!geminiRes.ok) {
            // Log detail error Gemini untuk debugging
            const errMsg = geminiData?.error?.message ?? `HTTP ${geminiRes.status}`;
            const errCode = geminiData?.error?.code ?? geminiRes.status;
            console.error(`[Gemini API] Error ${errCode}:`, errMsg);

            // Pesan error spesifik berdasarkan kode
            if (errCode === 429) {
                await sendMessage(chatId,
                    `⏳ *Gemini Sibuk*\n\n` +
                    `API sedang kelebihan permintaan. Coba lagi dalam 30 detik.`
                );
            } else if (errCode === 400) {
                await sendMessage(chatId,
                    `⚠️ *Prompt Error*\n\n` +
                    `Format permintaan tidak valid: \`${errMsg}\`\n` +
                    `Coba perintah lain atau hubungi admin IT.`
                );
            } else {
                await sendMessage(chatId,
                    `⚠️ *Gemini API Error ${errCode}*\n\n` +
                    `${errMsg}\n\nCoba lagi dalam beberapa saat.`
                );
            }
            return;
        }

        // Ambil teks jawaban
        const finishReason = geminiData?.candidates?.[0]?.finishReason;
        answer = sanitizeAiAnswer(
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
                ?? "Maaf, AI tidak memberikan jawaban untuk permintaan ini.",
            topic,
            freeQuestionMode !== "rag_knowledge",
        );
        if (finishReason === "MAX_TOKENS") {
            answer += `\n\n_ Catatan: jawaban mencapai batas token. Gunakan perintah topik spesifik untuk rincian tambahan._`;
        }

    } catch (err) {
        // Network error / timeout
        console.error("[Gemini Fetch] Network error:", err);
        await sendMessage(chatId,
            `⚠️ *Koneksi ke AI Gagal*\n\n` +
            `Tidak dapat menghubungi Gemini API.\n` +
            `Periksa koneksi atau coba lagi dalam 30 detik.`
        );
        return;
    }

    // 7. Kirim jawaban ke Telegram dengan footer identitas
    const timeStr = new Date().toLocaleTimeString("id-ID", {
        hour:     "2-digit",
        minute:   "2-digit",
        timeZone: "Asia/Jakarta",
    });

    const footer =
        `\n\n_${TOPIC_EMOJI[topic]} ${escapeMarkdown(admin.full_name)} · ${timeStr} WIB_` +
        (ragSources.length
            ? `\n_RAG: ${ragSources.slice(0, 3).map((item) => escapeMarkdown(stripMarkdown(item))).join(" | ")}_`
            : "");

    await sendMessage(chatId, answer + footer);
}

// ═══════════════════════════════════════════════════════════════════════════
// BAGIAN 8 — MESSAGE ROUTER
// Parse teks → tentukan command → route ke handler
// ═══════════════════════════════════════════════════════════════════════════

async function routeMessage(
    supabase: ReturnType<typeof createClient>,
    admin:    AdminProfile,
    message:  TelegramMessage
): Promise<void> {
    const chatId  = message.chat.id;
    const rawText = (message.text ?? "").trim();

    // Parse command vs argumen
    const spaceIdx = rawText.indexOf(" ");
    const command  = (spaceIdx === -1 ? rawText : rawText.slice(0, spaceIdx)).toLowerCase();
    const args     = cleanTelegramInput(spaceIdx === -1 ? "" : rawText.slice(spaceIdx + 1), MAX_FREE_QUESTION_CHARS);
    const safeRawText = cleanTelegramInput(rawText, MAX_FREE_QUESTION_CHARS);

    // Catat aktivitas ke audit_logs SEBELUM rate limit check
    // (agar query yang di-throttle pun tetap tercatat)
    await logBotActivity(supabase, admin, command, {
        args:      args || undefined,
        chat_type: message.chat.type,
        topic:     resolveTopicFromCommand(command),
    });

    // Rate limit check
    const rateCheck = await checkRateLimit(supabase, admin);
    if (!rateCheck.allowed) {
        await sendMessage(chatId,
            `⏳ Mohon tunggu *${rateCheck.waitSeconds} detik* lagi.`
        );
        return;
    }

    // Routing
    switch (command) {
        case "/start":
            await handleStart(supabase, chatId, message.from);
            break;

        case "/help":
        case "/bantuan":
            await handleHelp(chatId, admin);
            break;

        case "/laporan":
        case "/report":
        case "/ringkasan":
            await handleTopicCommand(supabase, admin, chatId, "LAPORAN");
            break;

        case "/kesehatan":
        case "/health":
        case "/medis":
            await handleTopicCommand(supabase, admin, chatId, "KESEHATAN");
            break;

        case "/keuangan":
        case "/finance":
        case "/kas":
            await handleTopicCommand(supabase, admin, chatId, "KEUANGAN");
            break;

        case "/disiplin":
        case "/kedisiplinan":
        case "/pelanggaran":
            await handleTopicCommand(supabase, admin, chatId, "DISIPLIN");
            break;

        case "/tahfidz":
        case "/hafalan":
        case "/quran":
            await handleTopicCommand(supabase, admin, chatId, "TAHFIDZ");
            break;

        case "/izin":
        case "/perizinan":
            await handleTopicCommand(supabase, admin, chatId, "IZIN");
            break;

        case "/prestasi":
        case "/achievement":
            await handleTopicCommand(supabase, admin, chatId, "PRESTASI");
            break;

        case "/tanya":
        case "/ask":
        case "/konsultasi": {
            if (!args) {
                await sendMessage(chatId,
                    `❓ *Ketik pertanyaan setelah /tanya*\n\n` +
                    `Contoh:\n` +
                    `\`/tanya siapa santri hafalan terbanyak?\`\n` +
                    `\`/tanya ada berapa santri yang izin minggu ini?\`\n` +
                    `\`/tanya tagihan apa yang paling banyak belum lunas?\``
                );
                break;
            }
            await handleTopicCommand(supabase, admin, chatId, "BEBAS", args);
            break;
        }

        default: {
            // Pesan teks biasa (bukan command) → mode bebas langsung
            if (!rawText.startsWith("/")) {
                await handleTopicCommand(supabase, admin, chatId, "BEBAS", safeRawText);
                break;
            }
            // Command tidak dikenal
            await sendMessage(chatId,
                `❓ Perintah *${escapeMarkdown(command)}* tidak dikenal.\n\nKetik /help untuk daftar perintah.`
            );
        }
    }
}

/** Resolve topic dari command string untuk keperluan audit log */
function resolveTopicFromCommand(cmd: string): string {
    const map: Record<string, string> = {
        "/laporan": "LAPORAN", "/report": "LAPORAN", "/ringkasan": "LAPORAN",
        "/kesehatan": "KESEHATAN", "/health": "KESEHATAN", "/medis": "KESEHATAN",
        "/keuangan": "KEUANGAN", "/finance": "KEUANGAN", "/kas": "KEUANGAN",
        "/disiplin": "DISIPLIN", "/pelanggaran": "DISIPLIN",
        "/tahfidz": "TAHFIDZ", "/hafalan": "TAHFIDZ",
        "/izin": "IZIN", "/perizinan": "IZIN",
        "/prestasi": "PRESTASI",
        "/tanya": "BEBAS", "/ask": "BEBAS", "/konsultasi": "BEBAS",
    };
    return map[cmd] ?? "UNKNOWN";
}

/** Escape karakter Markdown v1 dalam string dinamis */
function escapeMarkdown(text: string): string {
    return text.replace(/([*_`[\]])/g, "\\$1");
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER — Entry point Edge Function
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req: Request): Promise<Response> => {
    // Guard: hanya terima POST
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    // ── Layer 1: Verifikasi webhook secret ────────────────────────
    if (!verifyWebhookSecret(req)) {
        console.warn("[Security] Webhook secret tidak cocok — request ditolak");
        // Return 200 agar attacker tidak tahu apakah URL valid
        return new Response("OK", { status: 200 });
    }

    // ── Layer 2: Parse body JSON ──────────────────────────────────
    let update: TelegramUpdate;
    try {
        update = await req.json() as TelegramUpdate;
    } catch {
        console.error("[Main] Body bukan JSON valid");
        return new Response("OK", { status: 200 });
    }

    // Hanya proses pesan biasa (abaikan edited_message, channel_post, dll)
    const message = update.message;
    if (!message?.from || !message.text || message.from.is_bot) {
        return new Response("OK", { status: 200 });
    }

    // Hanya private chat — tidak merespons di group/channel
    if (message.chat.type !== "private") {
        return new Response("OK", { status: 200 });
    }

    // ── Layer 3: Inisialisasi Supabase client ─────────────────────
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const chatId     = message.chat.id;
    const telegramId = message.from.id;

    // ── Layer 4: Autentikasi ──────────────────────────────────────
    const isStartCommand = message.text.trim().toLowerCase().startsWith("/start");
    const admin          = await getAdminProfile(supabase, telegramId);

    if (!admin) {
        if (isStartCommand) {
            await handleStart(supabase, chatId, message.from);
        } else {
            await sendMessage(chatId,
                `⛔ *Akses Ditolak*\n\n` +
                `Akun Telegram Anda belum terdaftar atau tidak aktif di sistem Al-Hasanah.\n\n` +
                `Ketik /start untuk instruksi pendaftaran.`
            );
        }
        return new Response("OK", { status: 200 });
    }

    // ── Layer 5: Process command ──────────────────────────────────
    try {
        await routeMessage(supabase, admin, message);
    } catch (err) {
        console.error("[Main] Unhandled error:", err);
        try {
            await sendMessage(chatId,
                `⚠️ *Terjadi Kesalahan*\n\n` +
                `Sistem mengalami error yang tidak terduga.\n` +
                `Silakan coba lagi atau akses dashboard langsung.`
            );
        } catch { /* Abaikan jika sendMessage pun gagal */ }
    }

    // Selalu kembalikan 200 — jika tidak, Telegram akan retry berkali-kali
    return new Response("OK", { status: 200 });
});

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════
//
// LANGKAH 1 — JALANKAN SQL MIGRASI DI SUPABASE SQL EDITOR:
//
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id       BIGINT UNIQUE;
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_bot_query   TIMESTAMPTZ;
//   CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);
//
// LANGKAH 2 — SET ENV SECRETS DI SUPABASE DASHBOARD:
//   Settings → Edge Functions → Secrets
//
//   TELEGRAM_BOT_TOKEN      = "1234567890:ABCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
//   TELEGRAM_WEBHOOK_SECRET = "string_acak_minimal_32_karakter_ini"
//   GEMINI_API_KEY          = "AIzaxxxxxxxxxxxxxxxxxx"  ← sudah ada, pastikan ter-set
//
// LANGKAH 3 — DEPLOY:
//   supabase functions deploy telegram-webhook
//
// LANGKAH 4 — REGISTER WEBHOOK KE TELEGRAM (jalankan 1x di browser):
//   https://api.telegram.org/bot{BOT_TOKEN}/setWebhook
//     ?url=https://{PROJECT_REF}.supabase.co/functions/v1/telegram-webhook
//     &secret_token={TELEGRAM_WEBHOOK_SECRET}
//     &allowed_updates=["message"]
//
// LANGKAH 5 — TEST:
//   Kirim /start ke bot dari Telegram Anda
//   Cek Supabase Dashboard → Edge Functions → telegram-webhook → Logs
//
// LANGKAH 6 — DAFTARKAN TELEGRAM ID ADMIN:
//   Buka dashboard → Pengaturan → Profil → input telegram_id
//   (Bot akan memberi tahu ID-nya saat /start)
//
// NEXT STEPS:
//   → Buat supabase/functions/_shared/buildDataContext.ts  (ekstrak buildDataContext)
//   → Buat supabase/functions/_shared/telegramSender.ts    (ekstrak sendMessage, dll)
//   → Buat halaman Pengaturan Bot di dashboard React
//   → (Opsional) pg_cron: laporan otomatis setiap pagi jam 06:00 WIB
// ═══════════════════════════════════════════════════════════════════════════
