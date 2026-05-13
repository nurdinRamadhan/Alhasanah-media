// ╔══════════════════════════════════════════════════════════════════╗
// ║          AI AGENT - SUPABASE EDGE FUNCTION                      ║
// ║          Sistem Manajemen Pesantren                             ║
// ║          Version: 2.0 | Multi-turn | HITL | Role-Aware         ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// ENV REQUIRED:
//   GEMINI_API_KEY              → Google Gemini API Key
//   SUPABASE_URL                → Auto-set by Supabase
//   SUPABASE_SERVICE_ROLE_KEY   → Auto-set by Supabase
//
// REQUEST BODY:
//   mode: 'chat' | 'execute' | 'rejected'
//   userMessage: string                    (mode=chat)
//   conversationHistory: GeminiMessage[]   (mode=chat, multi-turn)
//   actionToExecute: { toolName, args }    (mode=execute | rejected)
//   callerProfile: CallerProfile           (semua mode, wajib)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ══════════════════════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════════════════════
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Gemini function declarations only accept a limited OpenAPI subset.
// Strip keys that are useful for local validation but can make Gemini reject
// the whole request before the agent has a chance to answer.
// deno-lint-ignore no-explicit-any
function toGeminiToolSchema<T extends Record<string, any>>(tool: T): T {
  // deno-lint-ignore no-explicit-any
  const clean = (value: any): any => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;

    // deno-lint-ignore no-explicit-any
    const out: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "additionalProperties") continue;
      out[key] = clean(child);
    }
    return out;
  };

  return clean(tool);
}

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════
type TRole =
  | "super_admin"
  | "rois"
  | "bendahara"
  | "kesantrian"
  | "dewan"
  | "alumni";

interface CallerProfile {
  id: string;
  full_name: string;
  role: TRole;
  akses_gender: "L" | "P" | "ALL";
  akses_jurusan: "KITAB" | "TAHFIDZ" | "ALL";
}

// ══════════════════════════════════════════════════════════════════
// ROLE → TOOL PERMISSIONS
// Setiap role hanya bisa akses tool yang tercantum.
// '*' berarti semua tool.
// ══════════════════════════════════════════════════════════════════
const ROLE_TOOL_PERMISSIONS: Record<TRole, string[]> = {
  super_admin: ["*"],
  rois: ["*"],
  dewan: [
    // Read-only: hanya query tools
    "query_santri",
    "query_tagihan",
    "query_keuangan",
    "query_pelanggaran",
    "query_kesehatan",
    "query_perizinan",
    "query_hafalan",
    "query_prestasi",
    "query_inventaris",
    "query_ref_jenis_pembayaran",
    "query_dompet",
  ],
  kesantrian: [
    "query_santri",
    "query_pelanggaran",
    "query_kesehatan",
    "query_perizinan",
    "query_hafalan",
    "query_prestasi",
    "insert_pelanggaran",
    "insert_pelanggaran_massal",
    "insert_kesehatan",
    "insert_perizinan",
    "insert_prestasi",
    "insert_hafalan_tahfidz",
    "insert_hafalan_kitab",
    "insert_murojaah",
    "update_status_santri",
    "update_santri_data",
    "kirim_notifikasi",
  ],
  bendahara: [
    "query_santri",
    "query_tagihan",
    "query_keuangan",
    "query_ref_jenis_pembayaran",
    "query_dompet",
    "generate_tagihan_massal",
    "generate_tagihan_individual",
    "update_status_tagihan",
    "insert_pengeluaran",
    "topup_dompet",
    "kirim_notifikasi",
  ],
  alumni: [], // Tidak ada akses agent
};

const canUse = (role: TRole, toolName: string): boolean => {
  const perms = ROLE_TOOL_PERMISSIONS[role] || [];
  if (perms.includes("*")) return true;
  return perms.includes(toolName);
};

// Tool yang langsung dieksekusi (tidak butuh konfirmasi HITL)
const QUERY_TOOLS = new Set([
  "query_santri",
  "query_tagihan",
  "query_keuangan",
  "query_pelanggaran",
  "query_kesehatan",
  "query_perizinan",
  "query_hafalan",
  "query_prestasi",
  "query_inventaris",
  "query_ref_jenis_pembayaran",
  "query_dompet",
]);

// Tool yang WAJIB konfirmasi HITL sebelum dieksekusi
const ACTION_TOOLS = new Set([
  "generate_tagihan_massal",
  "generate_tagihan_individual",
  "update_status_tagihan",
  "update_status_santri",
  "update_santri_data",
  "insert_pelanggaran",
  "insert_pelanggaran_massal",
  "insert_kesehatan",
  "insert_perizinan",
  "insert_prestasi",
  "insert_hafalan_tahfidz",
  "insert_hafalan_kitab",
  "insert_murojaah",
  "insert_pengeluaran",
  "topup_dompet",
  "kirim_notifikasi",
]);

// ══════════════════════════════════════════════════════════════════
// GEMINI TOOL DEFINITIONS
// Definisi lengkap sesuai schema Supabase public
// ══════════════════════════════════════════════════════════════════
const ALL_TOOLS = [
  // ─────────────────────────────────────────────────────────
  // QUERY TOOLS (Read-Only, No Confirmation)
  // ─────────────────────────────────────────────────────────
  {
    name: "query_santri",
    description:
      "Mencari dan memfilter data santri dari database. Gunakan untuk mendapatkan NIS, nama, kelas, jurusan, status santri. WAJIB dipanggil sebelum action yang butuh NIS jika user hanya menyebut nama.",
    parameters: {
      type: "object",
      properties: {
        kelas: {
          type: "string",
          enum: ["1", "2", "3"],
          description: "Filter kelas",
        },
        jurusan: {
          type: "string",
          enum: ["KITAB", "TAHFIDZ"],
          description: "Filter jurusan",
        },
        status_santri: {
          type: "string",
          enum: ["AKTIF", "LULUS", "KELUAR", "ALUMNI"],
        },
        jenis_kelamin: { type: "string", enum: ["L", "P"] },
        nama_search: {
          type: "string",
          description: "Cari berdasarkan nama (partial match, case-insensitive)",
        },
        nis: { type: "string", description: "Cari santri spesifik by NIS" },
        limit: {
          type: "number",
          description: "Max data dikembalikan (default: 100)",
        },
      },
      required: [],
    },
  },
  {
    name: "query_tagihan",
    description:
      "Query data tagihan santri. Bisa filter per santri, status, kelas, jurusan, atau bulan. Mengembalikan juga summary total dan jumlah yang belum bayar.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        status: { type: "string", enum: ["LUNAS", "BELUM", "CICILAN"] },
        kelas: { type: "string", enum: ["1", "2", "3"] },
        jurusan: { type: "string", enum: ["KITAB", "TAHFIDZ"] },
        jenis_pembayaran_id: {
          type: "number",
          description: "Filter by jenis pembayaran (ID dari ref_jenis_pembayaran)",
        },
        bulan: {
          type: "string",
          description: "Filter bulan created_at, format: YYYY-MM (contoh: 2025-05)",
        },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "query_ref_jenis_pembayaran",
    description:
      "Mengambil daftar jenis pembayaran yang aktif (SPP, Gedung, Seragam, dll) beserta nominal default dan tipenya. WAJIB dipanggil sebelum membuat tagihan untuk mendapatkan jenis_pembayaran_id yang benar.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "query_keuangan",
    description:
      "Query data keuangan: pengeluaran atau transaksi keuangan umum. Mengembalikan total pengeluaran per kategori/bulan.",
    parameters: {
      type: "object",
      properties: {
        jenis: {
          type: "string",
          enum: ["pengeluaran", "transaksi"],
          description: "Jenis data keuangan yang ingin di-query",
        },
        bulan: {
          type: "string",
          description: "Format YYYY-MM, misal: 2025-05",
        },
        kategori: {
          type: "string",
          enum: [
            "OPERASIONAL",
            "PEMBANGUNAN",
            "DAPUR",
            "KEGIATAN",
            "LAINNYA",
          ],
          description: "Filter kategori pengeluaran",
        },
        limit: { type: "number" },
      },
      required: ["jenis"],
    },
  },
  {
    name: "query_pelanggaran",
    description:
      "Query data pelanggaran santri. Bisa filter per santri, kelas, jurusan, atau rentang tanggal. Mengembalikan total poin pelanggaran.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        kelas: { type: "string", enum: ["1", "2", "3"] },
        jurusan: { type: "string", enum: ["KITAB", "TAHFIDZ"] },
        tanggal_dari: {
          type: "string",
          description: "Format YYYY-MM-DD",
        },
        tanggal_sampai: { type: "string", description: "Format YYYY-MM-DD" },
        jenis_pelanggaran: {
          type: "string",
          description: "Cari berdasarkan jenis (partial match)",
        },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "query_kesehatan",
    description: "Query riwayat kesehatan/sakit santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        tanggal_dari: { type: "string", description: "Format YYYY-MM-DD" },
        tanggal_sampai: { type: "string", description: "Format YYYY-MM-DD" },
        keluhan: {
          type: "string",
          description: "Filter berdasarkan keluhan (partial match)",
        },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "query_perizinan",
    description: "Query data perizinan santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        status: {
          type: "string",
          description: "PENDING | APPROVED | REJECTED",
        },
        jenis_izin: { type: "string" },
        tanggal_dari: { type: "string" },
        tanggal_sampai: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "query_hafalan",
    description:
      "Query data hafalan tahfidz, hafalan kitab, atau murojaah santri.",
    parameters: {
      type: "object",
      properties: {
        jenis: {
          type: "string",
          enum: ["tahfidz", "kitab", "murojaah"],
          description: "Jenis hafalan yang di-query",
        },
        santri_nis: { type: "string" },
        kelas: { type: "string", enum: ["1", "2", "3"] },
        jurusan: { type: "string", enum: ["KITAB", "TAHFIDZ"] },
        tanggal_dari: { type: "string" },
        tanggal_sampai: { type: "string" },
        predikat: {
          type: "string",
          enum: ["MUMTAZ", "JAYYID", "KURANG"],
        },
        limit: { type: "number" },
      },
      required: ["jenis"],
    },
  },
  {
    name: "query_prestasi",
    description: "Query data prestasi santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        kategori: {
          type: "string",
          enum: ["TAHFIDZ", "KITAB", "UMUM", "KHATAM"],
        },
        kelas: { type: "string", enum: ["1", "2", "3"] },
        jurusan: { type: "string", enum: ["KITAB", "TAHFIDZ"] },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "query_inventaris",
    description: "Query data inventaris/aset pesantren.",
    parameters: {
      type: "object",
      properties: {
        kondisi: {
          type: "string",
          enum: ["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT", "HILANG"],
        },
        kategori_id: { type: "number" },
        lokasi_id: { type: "number" },
        nama_search: { type: "string", description: "Cari nama barang" },
        sumber_dana: {
          type: "string",
          enum: ["YAYASAN", "BOS", "WAKAF", "HIBAH"],
        },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "query_dompet",
    description:
      "Query saldo dompet santri dan riwayat transaksi dompet.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string", description: "NIS santri" },
        include_history: {
          type: "boolean",
          description: "Sertakan riwayat transaksi dompet",
        },
        limit_history: { type: "number", description: "Max riwayat transaksi" },
      },
      required: ["santri_nis"],
    },
  },

  // ─────────────────────────────────────────────────────────
  // ACTION TOOLS (Write, HITL Required)
  // ─────────────────────────────────────────────────────────
  {
    name: "generate_tagihan_massal",
    description:
      "Membuat tagihan secara massal untuk banyak santri sekaligus berdasarkan filter kelas dan/atau jurusan. WAJIB panggil query_ref_jenis_pembayaran terlebih dahulu untuk mendapatkan jenis_pembayaran_id yang valid.",
    parameters: {
      type: "object",
      properties: {
        filter_kelas: {
          type: "string",
          enum: ["1", "2", "3", "ALL"],
          description: "Target kelas. Gunakan ALL untuk semua kelas.",
        },
        filter_jurusan: {
          type: "string",
          enum: ["KITAB", "TAHFIDZ", "ALL"],
          description: "Target jurusan. Gunakan ALL untuk semua jurusan.",
        },
        filter_status_santri: {
          type: "string",
          enum: ["AKTIF"],
          description: "Default AKTIF. Biasanya hanya santri aktif yang diberi tagihan.",
        },
        jenis_pembayaran_id: {
          type: "number",
          description:
            "ID dari tabel ref_jenis_pembayaran. Dapatkan dengan memanggil query_ref_jenis_pembayaran terlebih dahulu.",
        },
        deskripsi_tagihan: {
          type: "string",
          description: "Contoh: 'SPP Bulan Mei 2025', 'Iuran Kegiatan Ramadhan'",
        },
        nominal_tagihan: {
          type: "number",
          description: "Nominal dalam Rupiah (integer, tanpa titik/koma). Contoh: 500000",
        },
        tanggal_jatuh_tempo: {
          type: "string",
          description: "Format YYYY-MM-DD",
        },
      },
      required: [
        "filter_kelas",
        "filter_jurusan",
        "jenis_pembayaran_id",
        "deskripsi_tagihan",
        "nominal_tagihan",
        "tanggal_jatuh_tempo",
      ],
    },
  },
  {
    name: "generate_tagihan_individual",
    description:
      "Membuat satu tagihan untuk santri tertentu. Gunakan jika hanya satu santri yang perlu ditagih.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: {
          type: "string",
          description: "NIS santri. Gunakan query_santri jika hanya tahu nama.",
        },
        jenis_pembayaran_id: { type: "number" },
        deskripsi_tagihan: { type: "string" },
        nominal_tagihan: { type: "number" },
        tanggal_jatuh_tempo: {
          type: "string",
          description: "Format YYYY-MM-DD",
        },
      },
      required: [
        "santri_nis",
        "jenis_pembayaran_id",
        "deskripsi_tagihan",
        "nominal_tagihan",
        "tanggal_jatuh_tempo",
      ],
    },
  },
  {
    name: "update_status_tagihan",
    description:
      "Update status tagihan santri menjadi LUNAS, BELUM, atau CICILAN. Jika LUNAS, sisa_tagihan otomatis 0.",
    parameters: {
      type: "object",
      properties: {
        tagihan_id: {
          type: "string",
          description: "UUID tagihan (dari hasil query_tagihan)",
        },
        status_baru: {
          type: "string",
          enum: ["LUNAS", "BELUM", "CICILAN"],
        },
        sisa_tagihan: {
          type: "number",
          description:
            "Wajib jika status CICILAN. Isi dengan sisa yang belum dibayar.",
        },
      },
      required: ["tagihan_id", "status_baru"],
    },
  },
  {
    name: "update_status_santri",
    description:
      "Update status santri (AKTIF/LULUS/KELUAR/ALUMNI). Bisa individual atau bulk per kelas/jurusan. Opsional: pindahkan kelas dan/atau jurusan sekaligus (untuk naik kelas).",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["individual", "bulk"],
          description: "Mode update: individual (satu santri) atau bulk (banyak)",
        },
        santri_nis: {
          type: "string",
          description: "Wajib jika target=individual",
        },
        filter_kelas: {
          type: "string",
          enum: ["1", "2", "3"],
          description: "Wajib jika target=bulk",
        },
        filter_jurusan: {
          type: "string",
          enum: ["KITAB", "TAHFIDZ"],
          description: "Opsional filter jurusan jika target=bulk",
        },
        status_baru: {
          type: "string",
          enum: ["AKTIF", "LULUS", "KELUAR", "ALUMNI"],
        },
        kelas_baru: {
          type: "string",
          enum: ["1", "2", "3"],
          description: "Opsional: pindahkan ke kelas ini sekaligus (untuk naik kelas)",
        },
        jurusan_baru: {
          type: "string",
          enum: ["KITAB", "TAHFIDZ"],
          description: "Opsional: pindahkan ke jurusan ini",
        },
      },
      required: ["target", "status_baru"],
    },
  },
  {
    name: "update_santri_data",
    description:
      "Update data profil santri (pembimbing, no_kontak_wali, alamat, nama, dll). BUKAN untuk mengubah kelas/jurusan/status — gunakan update_status_santri untuk itu.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        fields: {
          type: "object",
          description:
            "Key-value field yang diupdate. Field yang valid: pembimbing, no_kontak_wali, alamat_lengkap, nama, ayah, ibu, tempat_lahir, tanggal_lahir, anak_ke. Field lain akan diabaikan demi keamanan.",
          additionalProperties: true,
        },
      },
      required: ["santri_nis", "fields"],
    },
  },
  {
    name: "insert_pelanggaran",
    description: "Mencatat satu pelanggaran untuk satu santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        tanggal: {
          type: "string",
          description: "Format YYYY-MM-DD. Default: hari ini.",
        },
        jenis_pelanggaran: {
          type: "string",
          description: "Nama/jenis pelanggaran yang dilakukan",
        },
        poin: {
          type: "number",
          description: "Poin penalti (1–100). Semakin berat semakin tinggi.",
        },
        hukuman: {
          type: "string",
          description: "Hukuman yang diberikan (opsional)",
        },
        catatan: { type: "string", description: "Catatan tambahan (opsional)" },
      },
      required: ["santri_nis", "jenis_pelanggaran", "poin"],
    },
  },
  {
    name: "insert_pelanggaran_massal",
    description:
      "Mencatat pelanggaran yang SAMA untuk banyak santri sekaligus. Bisa filter kelas/jurusan atau list NIS langsung.",
    parameters: {
      type: "object",
      properties: {
        filter_kelas: {
          type: "string",
          enum: ["1", "2", "3", "ALL"],
          description: "Filter kelas target",
        },
        filter_jurusan: {
          type: "string",
          enum: ["KITAB", "TAHFIDZ", "ALL"],
          description: "Filter jurusan target",
        },
        santri_nis_list: {
          type: "array",
          items: { type: "string" },
          description:
            "Alternatif: daftar NIS spesifik. Jika diisi, filter_kelas/filter_jurusan diabaikan.",
        },
        tanggal: {
          type: "string",
          description: "Format YYYY-MM-DD. Default: hari ini.",
        },
        jenis_pelanggaran: { type: "string" },
        poin: { type: "number" },
        hukuman: { type: "string" },
        catatan: { type: "string" },
      },
      required: ["jenis_pelanggaran", "poin"],
    },
  },
  {
    name: "insert_kesehatan",
    description: "Mencatat rekam medis/kesehatan santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        tanggal: { type: "string", description: "Format YYYY-MM-DD" },
        keluhan: { type: "string", description: "Keluhan yang dirasakan" },
        tindakan: {
          type: "string",
          description: "Tindakan medis yang diberikan",
        },
        catatan: { type: "string" },
      },
      required: ["santri_nis", "keluhan", "tindakan"],
    },
  },
  {
    name: "insert_perizinan",
    description: "Mencatat perizinan keluar santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        tanggal: {
          type: "string",
          description: "Tanggal izin keluar, format YYYY-MM-DD",
        },
        tanggal_kembali: {
          type: "string",
          description: "Tanggal kembali, format YYYY-MM-DD",
        },
        jenis_izin: {
          type: "string",
          description: "Contoh: Pulang, Sakit, Keperluan Keluarga, Darurat",
        },
        keterangan: { type: "string" },
        status: {
          type: "string",
          enum: ["PENDING", "APPROVED", "REJECTED"],
          description:
            "Default APPROVED jika langsung diizinkan oleh ustadz/pengurus",
        },
      },
      required: ["santri_nis", "tanggal", "tanggal_kembali", "jenis_izin"],
    },
  },
  {
    name: "insert_prestasi",
    description: "Mencatat prestasi yang diraih santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        kategori: {
          type: "string",
          enum: ["TAHFIDZ", "KITAB", "UMUM", "KHATAM"],
        },
        judul_prestasi: {
          type: "string",
          description: "Judul/nama prestasi yang diraih",
        },
        keterangan: { type: "string" },
        tanggal_prestasi: {
          type: "string",
          description: "Format YYYY-MM-DD. Default: hari ini.",
        },
        poin_prestasi: {
          type: "number",
          description: "Poin reward untuk prestasi ini",
        },
      },
      required: ["santri_nis", "kategori", "judul_prestasi", "poin_prestasi"],
    },
  },
  {
    name: "insert_hafalan_tahfidz",
    description: "Mencatat setoran hafalan Al-Quran (tahfidz) santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        tanggal: { type: "string", description: "Format YYYY-MM-DD" },
        surat: { type: "string", description: "Nama surat yang dihafalkan" },
        ayat_awal: { type: "number" },
        ayat_akhir: { type: "number" },
        juz: { type: "number", description: "Nomor juz (1-30)" },
        status: {
          type: "string",
          enum: ["LANJUT", "ULANG"],
          description: "LANJUT = lolos, ULANG = perlu diulang",
        },
        predikat: { type: "string", enum: ["MUMTAZ", "JAYYID", "KURANG"] },
        catatan: { type: "string" },
        total_hafalan: {
          type: "number",
          description: "Snapshot total juz yang sudah dihafal saat ini",
        },
      },
      required: ["santri_nis", "surat", "ayat_awal", "ayat_akhir", "status", "predikat"],
    },
  },
  {
    name: "insert_hafalan_kitab",
    description: "Mencatat setoran hafalan kitab santri.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        tanggal: { type: "string" },
        nama_kitab: {
          type: "string",
          enum: [
            "Jurumiah",
            "Imrity",
            "Nadzmul Maqshud",
            "Alfiyah",
            "Uqudul Juman",
            "Sulam Munawraq",
          ],
        },
        bab_materi: {
          type: "string",
          description: "Nama bab/materi yang disetorkan",
        },
        bait_awal: { type: "number" },
        bait_akhir: { type: "number" },
        halaman_awal: { type: "number" },
        halaman_akhir: { type: "number" },
        predikat: { type: "string", enum: ["MUMTAZ", "JAYYID", "KURANG"] },
        status: {
          type: "string",
          enum: ["LULUS", "MENGULANG"],
        },
        catatan: { type: "string" },
      },
      required: ["santri_nis", "nama_kitab", "bab_materi", "predikat", "status"],
    },
  },
  {
    name: "insert_murojaah",
    description:
      "Mencatat murojaah (pengulangan hafalan) santri tahfidz, baik sabaq maupun manzil.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        tanggal: { type: "string" },
        jenis_murojaah: {
          type: "string",
          enum: ["SABAQ", "MANZIL"],
        },
        juz: { type: "number" },
        surat: { type: "string" },
        ayat_awal: { type: "number" },
        ayat_akhir: { type: "number" },
        halaman_awal: { type: "number" },
        halaman_akhir: { type: "number" },
        status: {
          type: "string",
          description: "Status murojaah (LANCAR, KURANG LANCAR, dll)",
        },
        predikat: { type: "string", enum: ["MUMTAZ", "JAYYID", "KURANG"] },
        catatan: { type: "string" },
      },
      required: ["santri_nis", "jenis_murojaah", "juz", "predikat"],
    },
  },
  {
    name: "insert_pengeluaran",
    description: "Mencatat pengeluaran keuangan pesantren.",
    parameters: {
      type: "object",
      properties: {
        judul: {
          type: "string",
          description: "Judul/nama pengeluaran",
        },
        kategori: {
          type: "string",
          enum: ["OPERASIONAL", "PEMBANGUNAN", "DAPUR", "KEGIATAN", "LAINNYA"],
        },
        nominal: {
          type: "number",
          description: "Nominal dalam Rupiah (integer)",
        },
        tanggal_pengeluaran: {
          type: "string",
          description: "Format YYYY-MM-DD",
        },
        keterangan: { type: "string", description: "Catatan tambahan" },
      },
      required: ["judul", "kategori", "nominal", "tanggal_pengeluaran"],
    },
  },
  {
    name: "topup_dompet",
    description:
      "Menambah saldo dompet santri dan mencatat transaksi masuk ke tabel transaksi_dompet.",
    parameters: {
      type: "object",
      properties: {
        santri_nis: { type: "string" },
        nominal: {
          type: "number",
          description: "Nominal top-up dalam Rupiah",
        },
        keterangan: {
          type: "string",
          description: "Keterangan transaksi (opsional)",
        },
      },
      required: ["santri_nis", "nominal"],
    },
  },
  {
    name: "kirim_notifikasi",
    description:
      "Mengirim push notification ke user tertentu, wali santri, atau semua admin. Notifikasi masuk ke notification_queue dan dikirim oleh edge function push-notifications.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["user_id", "all_admin", "wali_santri"],
          description:
            "user_id: kirim ke satu user. all_admin: kirim ke semua admin aktif. wali_santri: kirim ke wali santri tertentu.",
        },
        user_id: {
          type: "string",
          description: "UUID user (wajib jika target=user_id)",
        },
        santri_nis: {
          type: "string",
          description:
            "NIS santri (wajib jika target=wali_santri, untuk mencari wali_id santri tersebut)",
        },
        title: { type: "string", description: "Judul notifikasi" },
        body: { type: "string", description: "Isi pesan notifikasi" },
        data: {
          type: "object",
          description: "Data payload tambahan (opsional)",
          additionalProperties: true,
        },
      },
      required: ["target", "title", "body"],
    },
  },
];

// ══════════════════════════════════════════════════════════════════
// HELPER: Utility Functions
// ══════════════════════════════════════════════════════════════════
function getNextMonthStart(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// ══════════════════════════════════════════════════════════════════
// QUERY TOOL EXECUTORS
// ══════════════════════════════════════════════════════════════════
// deno-lint-ignore no-explicit-any
async function executeQueryTool(supabase: any, toolName: string, args: any, caller: CallerProfile) {
  // Terapkan scope filter berdasarkan profil caller
  // deno-lint-ignore no-explicit-any
  const applyScope = (q: any, table: "santri" | "via_santri") => {
    if (table === "santri") {
      if (caller.akses_jurusan !== "ALL") q = q.eq("jurusan", caller.akses_jurusan);
      if (caller.akses_gender !== "ALL") q = q.eq("jenis_kelamin", caller.akses_gender);
    }
    return q;
  };

  switch (toolName) {
    // ── query_santri ─────────────────────────────────────────
    case "query_santri": {
      let q = supabase
        .from("santri")
        .select(
          "nis, nama, kelas, jurusan, status_santri, jenis_kelamin, total_hafalan, hafalan_kitab, pembimbing, no_kontak_wali, ayah, ibu"
        );
      if (args.kelas) q = q.eq("kelas", args.kelas);
      if (args.jurusan) q = q.eq("jurusan", args.jurusan);
      if (args.status_santri) q = q.eq("status_santri", args.status_santri);
      if (args.jenis_kelamin) q = q.eq("jenis_kelamin", args.jenis_kelamin);
      if (args.nama_search) q = q.ilike("nama", `%${args.nama_search}%`);
      if (args.nis) q = q.eq("nis", args.nis);
      q = applyScope(q, "santri");
      q = q.order("nama").limit(args.limit || 100);
      const { data, error } = await q;
      if (error) throw error;
      return { data, total: data?.length };
    }

    // ── query_tagihan ────────────────────────────────────────
    case "query_tagihan": {
      // Jika ada filter kelas/jurusan atau scope, resolve NIS dulu
      let nisScopeFilter: string[] | null = null;
      const needScopeFilter =
        args.kelas || args.jurusan || caller.akses_jurusan !== "ALL" || caller.akses_gender !== "ALL";

      if (needScopeFilter) {
        let sq = supabase.from("santri").select("nis");
        if (args.kelas) sq = sq.eq("kelas", args.kelas);
        if (args.jurusan) sq = sq.eq("jurusan", args.jurusan);
        if (caller.akses_jurusan !== "ALL") sq = sq.eq("jurusan", caller.akses_jurusan);
        if (caller.akses_gender !== "ALL") sq = sq.eq("jenis_kelamin", caller.akses_gender);
        const { data: sList } = await sq;
        nisScopeFilter = sList?.map((s: { nis: string }) => s.nis) || [];
      }

      let q = supabase
        .from("tagihan_santri")
        .select(
          "*, santri:santri_nis(nama, kelas, jurusan, jenis_kelamin), jenis_bayar:jenis_pembayaran_id(nama_pembayaran, tipe)"
        )
        .order("created_at", { ascending: false });

      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.status) q = q.eq("status", args.status);
      if (args.jenis_pembayaran_id) q = q.eq("jenis_pembayaran_id", args.jenis_pembayaran_id);
      if (args.bulan) {
        q = q
          .gte("created_at", `${args.bulan}-01`)
          .lt("created_at", getNextMonthStart(args.bulan));
      }
      if (nisScopeFilter) q = q.in("santri_nis", nisScopeFilter);
      q = q.limit(args.limit || 200);

      const { data, error } = await q;
      if (error) throw error;

      const totalNominal = data?.reduce((s: number, t: { nominal_tagihan: number }) => s + (t.nominal_tagihan || 0), 0);
      const totalSisa = data?.reduce((s: number, t: { sisa_tagihan: number }) => s + (t.sisa_tagihan || 0), 0);
      const jumlahBelum = data?.filter((t: { status: string }) => t.status === "BELUM").length;
      const jumlahCicilan = data?.filter((t: { status: string }) => t.status === "CICILAN").length;
      const jumlahLunas = data?.filter((t: { status: string }) => t.status === "LUNAS").length;

      return {
        data,
        summary: {
          total_tagihan: totalNominal,
          total_sisa: totalSisa,
          jumlah_belum: jumlahBelum,
          jumlah_cicilan: jumlahCicilan,
          jumlah_lunas: jumlahLunas,
          total_record: data?.length,
        },
      };
    }

    // ── query_ref_jenis_pembayaran ───────────────────────────
    case "query_ref_jenis_pembayaran": {
      const { data, error } = await supabase
        .from("ref_jenis_pembayaran")
        .select("*")
        .eq("is_aktif", true)
        .order("id");
      if (error) throw error;
      return { data };
    }

    // ── query_keuangan ───────────────────────────────────────
    case "query_keuangan": {
      if (args.jenis === "pengeluaran") {
        let q = supabase.from("pengeluaran").select("*").order("tanggal_pengeluaran", { ascending: false });
        if (args.bulan) {
          q = q
            .gte("tanggal_pengeluaran", `${args.bulan}-01`)
            .lt("tanggal_pengeluaran", getNextMonthStart(args.bulan));
        }
        if (args.kategori) q = q.eq("kategori", args.kategori);
        q = q.limit(args.limit || 100);
        const { data, error } = await q;
        if (error) throw error;
        const totalNominal = data?.reduce((s: number, p: { nominal: number }) => s + Number(p.nominal), 0);
        // Subtotal per kategori
        const perKategori: Record<string, number> = {};
        for (const p of data || []) {
          perKategori[p.kategori] = (perKategori[p.kategori] || 0) + Number(p.nominal);
        }
        return { data, total_pengeluaran: totalNominal, per_kategori: perKategori };
      } else {
        let q = supabase
          .from("transaksi_keuangan")
          .select("*")
          .order("created_at", { ascending: false });
        if (args.bulan) {
          q = q
            .gte("created_at", `${args.bulan}-01`)
            .lt("created_at", getNextMonthStart(args.bulan));
        }
        q = q.limit(args.limit || 100);
        const { data, error } = await q;
        if (error) throw error;
        return { data, total: data?.length };
      }
    }

    // ── query_pelanggaran ────────────────────────────────────
    case "query_pelanggaran": {
      let nisList: string[] | null = null;
      if (args.kelas || args.jurusan || caller.akses_jurusan !== "ALL") {
        let sq = supabase.from("santri").select("nis");
        if (args.kelas) sq = sq.eq("kelas", args.kelas);
        if (args.jurusan) sq = sq.eq("jurusan", args.jurusan);
        if (caller.akses_jurusan !== "ALL") sq = sq.eq("jurusan", caller.akses_jurusan);
        const { data: sList } = await sq;
        nisList = sList?.map((s: { nis: string }) => s.nis) || [];
      }

      let q = supabase
        .from("pelanggaran_santri")
        .select("*, santri:santri_nis(nama, kelas, jurusan)")
        .order("tanggal", { ascending: false });
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.jenis_pelanggaran) q = q.ilike("jenis_pelanggaran", `%${args.jenis_pelanggaran}%`);
      if (args.tanggal_dari) q = q.gte("tanggal", args.tanggal_dari);
      if (args.tanggal_sampai) q = q.lte("tanggal", args.tanggal_sampai);
      if (nisList) q = q.in("santri_nis", nisList);
      q = q.limit(args.limit || 100);

      const { data, error } = await q;
      if (error) throw error;
      return {
        data,
        total_poin: data?.reduce((s: number, p: { poin: number }) => s + (p.poin || 0), 0),
        total_record: data?.length,
      };
    }

    // ── query_kesehatan ──────────────────────────────────────
    case "query_kesehatan": {
      let q = supabase
        .from("kesehatan_santri")
        .select("*, santri:santri_nis(nama, kelas, jurusan)")
        .order("tanggal", { ascending: false });
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.tanggal_dari) q = q.gte("tanggal", args.tanggal_dari);
      if (args.tanggal_sampai) q = q.lte("tanggal", args.tanggal_sampai);
      if (args.keluhan) q = q.ilike("keluhan", `%${args.keluhan}%`);
      q = q.limit(args.limit || 100);
      const { data, error } = await q;
      if (error) throw error;
      return { data, total_record: data?.length };
    }

    // ── query_perizinan ──────────────────────────────────────
    case "query_perizinan": {
      let q = supabase
        .from("perizinan_santri")
        .select("*, santri:santri_nis(nama, kelas, jurusan)")
        .order("tanggal", { ascending: false });
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.status) q = q.eq("status", args.status);
      if (args.jenis_izin) q = q.ilike("jenis_izin", `%${args.jenis_izin}%`);
      if (args.tanggal_dari) q = q.gte("tanggal", args.tanggal_dari);
      if (args.tanggal_sampai) q = q.lte("tanggal", args.tanggal_sampai);
      q = q.limit(args.limit || 100);
      const { data, error } = await q;
      if (error) throw error;
      return { data, total_record: data?.length };
    }

    // ── query_hafalan ────────────────────────────────────────
    case "query_hafalan": {
      const tableMap: Record<string, string> = {
        tahfidz: "hafalan_tahfidz",
        kitab: "hafalan_kitab",
        murojaah: "murojaah_tahfidz",
      };
      const table = tableMap[args.jenis];
      if (!table) throw new Error(`Jenis hafalan tidak valid: ${args.jenis}`);

      let nisList: string[] | null = null;
      if (args.kelas || args.jurusan || caller.akses_jurusan !== "ALL") {
        let sq = supabase.from("santri").select("nis");
        if (args.kelas) sq = sq.eq("kelas", args.kelas);
        if (args.jurusan) sq = sq.eq("jurusan", args.jurusan);
        if (caller.akses_jurusan !== "ALL") sq = sq.eq("jurusan", caller.akses_jurusan);
        const { data: sList } = await sq;
        nisList = sList?.map((s: { nis: string }) => s.nis) || [];
      }

      let q = supabase
        .from(table)
        .select("*, santri:santri_nis(nama, kelas, jurusan)")
        .order("tanggal", { ascending: false });
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.tanggal_dari) q = q.gte("tanggal", args.tanggal_dari);
      if (args.tanggal_sampai) q = q.lte("tanggal", args.tanggal_sampai);
      if (args.predikat) q = q.eq("predikat", args.predikat);
      if (nisList) q = q.in("santri_nis", nisList);
      q = q.limit(args.limit || 100);

      const { data, error } = await q;
      if (error) throw error;
      return { data, total_record: data?.length };
    }

    // ── query_prestasi ───────────────────────────────────────
    case "query_prestasi": {
      let nisList: string[] | null = null;
      if (args.kelas || args.jurusan || caller.akses_jurusan !== "ALL") {
        let sq = supabase.from("santri").select("nis");
        if (args.kelas) sq = sq.eq("kelas", args.kelas);
        if (args.jurusan) sq = sq.eq("jurusan", args.jurusan);
        if (caller.akses_jurusan !== "ALL") sq = sq.eq("jurusan", caller.akses_jurusan);
        const { data: sList } = await sq;
        nisList = sList?.map((s: { nis: string }) => s.nis) || [];
      }

      let q = supabase
        .from("prestasi_santri")
        .select("*, santri:santri_nis(nama, kelas, jurusan)")
        .order("tanggal_prestasi", { ascending: false });
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.kategori) q = q.eq("kategori", args.kategori);
      if (nisList) q = q.in("santri_nis", nisList);
      q = q.limit(args.limit || 100);

      const { data, error } = await q;
      if (error) throw error;
      return { data, total_record: data?.length };
    }

    // ── query_inventaris ─────────────────────────────────────
    case "query_inventaris": {
      let q = supabase
        .from("inventaris")
        .select(
          "*, kategori:kategori_id(nama_kategori, kode_prefix), lokasi:lokasi_id(nama_lokasi, penanggung_jawab)"
        )
        .order("nama_barang");
      if (args.kondisi) q = q.eq("kondisi", args.kondisi);
      if (args.kategori_id) q = q.eq("kategori_id", args.kategori_id);
      if (args.lokasi_id) q = q.eq("lokasi_id", args.lokasi_id);
      if (args.sumber_dana) q = q.eq("sumber_dana", args.sumber_dana);
      if (args.nama_search) q = q.ilike("nama_barang", `%${args.nama_search}%`);
      q = q.limit(args.limit || 100);
      const { data, error } = await q;
      if (error) throw error;
      const totalNilai = data?.reduce((s: number, i: { harga_perolehan: number; jumlah: number }) => s + (Number(i.harga_perolehan) * i.jumlah), 0);
      return { data, total_record: data?.length, total_nilai_aset: totalNilai };
    }

    // ── query_dompet ─────────────────────────────────────────
    case "query_dompet": {
      const { data: dompet, error: dErr } = await supabase
        .from("dompet_santri")
        .select("*, santri:santri_nis(nama, kelas, jurusan)")
        .eq("santri_nis", args.santri_nis)
        .single();
      if (dErr && dErr.code !== "PGRST116") throw dErr;

      let history = null;
      if (args.include_history) {
        const { data: hist } = await supabase
          .from("transaksi_dompet")
          .select("*")
          .eq("santri_nis", args.santri_nis)
          .order("created_at", { ascending: false })
          .limit(args.limit_history || 20);
        history = hist;
      }
      return { dompet: dompet || { santri_nis: args.santri_nis, saldo: 0 }, history };
    }

    default:
      throw new Error(`Unknown query tool: ${toolName}`);
  }
}

// ══════════════════════════════════════════════════════════════════
// ACTION TOOL EXECUTORS (dijalankan SETELAH konfirmasi HITL)
// ══════════════════════════════════════════════════════════════════
// deno-lint-ignore no-explicit-any
async function executeActionTool(supabase: any, toolName: string, args: any, caller: CallerProfile) {
  const todayStr = today();

  switch (toolName) {
    // ── generate_tagihan_massal ──────────────────────────────
    case "generate_tagihan_massal": {
      let q = supabase.from("santri").select("nis, nama");
      q = q.eq("status_santri", args.filter_status_santri || "AKTIF");
      if (args.filter_kelas && args.filter_kelas !== "ALL") q = q.eq("kelas", args.filter_kelas);
      if (args.filter_jurusan && args.filter_jurusan !== "ALL") q = q.eq("jurusan", args.filter_jurusan);
      // Terapkan scope caller
      if (caller.akses_jurusan !== "ALL") q = q.eq("jurusan", caller.akses_jurusan);
      if (caller.akses_gender !== "ALL") q = q.eq("jenis_kelamin", caller.akses_gender);

      const { data: santriList, error: santriErr } = await q;
      if (santriErr) throw santriErr;
      if (!santriList || santriList.length === 0) {
        return { success: false, message: "Tidak ada santri yang memenuhi filter.", affected: 0 };
      }

      const rows = santriList.map((s: { nis: string; nama: string }) => ({
        santri_nis: s.nis,
        jenis_pembayaran_id: args.jenis_pembayaran_id,
        deskripsi_tagihan: args.deskripsi_tagihan,
        nominal_tagihan: args.nominal_tagihan,
        sisa_tagihan: args.nominal_tagihan,
        tanggal_jatuh_tempo: args.tanggal_jatuh_tempo,
        status: "BELUM",
      }));

      const { error } = await supabase.from("tagihan_santri").insert(rows);
      if (error) throw error;

      return {
        success: true,
        affected: rows.length,
        detail: `Berhasil membuat ${rows.length} tagihan "${args.deskripsi_tagihan}" senilai ${formatRp(args.nominal_tagihan)} per santri`,
        total_nilai: rows.length * args.nominal_tagihan,
      };
    }

    // ── generate_tagihan_individual ──────────────────────────
    case "generate_tagihan_individual": {
      const { error } = await supabase.from("tagihan_santri").insert({
        santri_nis: args.santri_nis,
        jenis_pembayaran_id: args.jenis_pembayaran_id,
        deskripsi_tagihan: args.deskripsi_tagihan,
        nominal_tagihan: args.nominal_tagihan,
        sisa_tagihan: args.nominal_tagihan,
        tanggal_jatuh_tempo: args.tanggal_jatuh_tempo,
        status: "BELUM",
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── update_status_tagihan ────────────────────────────────
    case "update_status_tagihan": {
      const updateData: Record<string, unknown> = {
        status: args.status_baru,
        updated_at: new Date().toISOString(),
      };
      if (args.status_baru === "LUNAS") updateData.sisa_tagihan = 0;
      if (args.sisa_tagihan !== undefined) updateData.sisa_tagihan = args.sisa_tagihan;

      const { error } = await supabase.from("tagihan_santri").update(updateData).eq("id", args.tagihan_id);
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── update_status_santri ─────────────────────────────────
    case "update_status_santri": {
      const updateData: Record<string, unknown> = {
        status_santri: args.status_baru,
        updated_at: new Date().toISOString(),
      };
      if (args.kelas_baru) updateData.kelas = args.kelas_baru;
      if (args.jurusan_baru) updateData.jurusan = args.jurusan_baru;

      if (args.target === "individual") {
        if (!args.santri_nis) throw new Error("santri_nis wajib untuk mode individual");
        const { error } = await supabase.from("santri").update(updateData).eq("nis", args.santri_nis);
        if (error) throw error;
        return { success: true, affected: 1 };
      } else {
        // bulk
        let q = supabase.from("santri").update(updateData);
        if (args.filter_kelas) q = q.eq("kelas", args.filter_kelas);
        if (args.filter_jurusan) q = q.eq("jurusan", args.filter_jurusan);
        // Hanya update santri dalam scope caller
        if (caller.akses_jurusan !== "ALL") q = q.eq("jurusan", caller.akses_jurusan);
        const { data: affected, error } = await q.select("nis");
        if (error) throw error;
        return { success: true, affected: affected?.length || 0 };
      }
    }

    // ── update_santri_data ───────────────────────────────────
    case "update_santri_data": {
      // Whitelist field yang aman untuk diupdate (cegah privilege escalation)
      const SAFE_FIELDS = [
        "pembimbing", "no_kontak_wali", "alamat_lengkap",
        "nama", "ayah", "ibu", "tempat_lahir", "tanggal_lahir", "anak_ke",
      ];
      const safeUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const rejectedFields: string[] = [];

      for (const [k, v] of Object.entries(args.fields)) {
        if (SAFE_FIELDS.includes(k)) safeUpdate[k] = v;
        else rejectedFields.push(k);
      }
      if (Object.keys(safeUpdate).length === 1) {
        throw new Error(`Tidak ada field yang valid. Field yang ditolak: ${rejectedFields.join(", ")}`);
      }

      const { error } = await supabase.from("santri").update(safeUpdate).eq("nis", args.santri_nis);
      if (error) throw error;
      return {
        success: true,
        affected: 1,
        updated_fields: Object.keys(safeUpdate).filter((k) => k !== "updated_at"),
        rejected_fields: rejectedFields,
      };
    }

    // ── insert_pelanggaran ───────────────────────────────────
    case "insert_pelanggaran": {
      const { error } = await supabase.from("pelanggaran_santri").insert({
        santri_nis: args.santri_nis,
        tanggal: args.tanggal || todayStr,
        jenis_pelanggaran: args.jenis_pelanggaran,
        poin: args.poin,
        hukuman: args.hukuman || "-",
        catatan: args.catatan || "",
        dicatat_oleh_id: caller.id,
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── insert_pelanggaran_massal ────────────────────────────
    case "insert_pelanggaran_massal": {
      let nisList: string[] = args.santri_nis_list || [];

      if (nisList.length === 0) {
        // Resolve dari filter kelas/jurusan
        let q = supabase.from("santri").select("nis").eq("status_santri", "AKTIF");
        if (args.filter_kelas && args.filter_kelas !== "ALL") q = q.eq("kelas", args.filter_kelas);
        if (args.filter_jurusan && args.filter_jurusan !== "ALL") q = q.eq("jurusan", args.filter_jurusan);
        if (caller.akses_jurusan !== "ALL") q = q.eq("jurusan", caller.akses_jurusan);
        const { data: sList } = await q;
        nisList = sList?.map((s: { nis: string }) => s.nis) || [];
      }

      if (nisList.length === 0) {
        return { success: false, message: "Tidak ada santri target.", affected: 0 };
      }

      const rows = nisList.map((nis: string) => ({
        santri_nis: nis,
        tanggal: args.tanggal || todayStr,
        jenis_pelanggaran: args.jenis_pelanggaran,
        poin: args.poin,
        hukuman: args.hukuman || "-",
        catatan: args.catatan || "",
        dicatat_oleh_id: caller.id,
      }));

      const { error } = await supabase.from("pelanggaran_santri").insert(rows);
      if (error) throw error;
      return { success: true, affected: rows.length };
    }

    // ── insert_kesehatan ─────────────────────────────────────
    case "insert_kesehatan": {
      const { error } = await supabase.from("kesehatan_santri").insert({
        santri_nis: args.santri_nis,
        tanggal: args.tanggal || todayStr,
        keluhan: args.keluhan,
        tindakan: args.tindakan,
        catatan: args.catatan || "",
        dicatat_oleh_id: caller.id,
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── insert_perizinan ─────────────────────────────────────
    case "insert_perizinan": {
      const { error } = await supabase.from("perizinan_santri").insert({
        santri_nis: args.santri_nis,
        tanggal: args.tanggal || todayStr,
        tanggal_kembali: args.tanggal_kembali,
        jenis_izin: args.jenis_izin,
        keterangan: args.keterangan || "",
        status: args.status || "APPROVED",
        dicatat_oleh_id: caller.id,
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── insert_prestasi ──────────────────────────────────────
    case "insert_prestasi": {
      const { error } = await supabase.from("prestasi_santri").insert({
        santri_nis: args.santri_nis,
        kategori: args.kategori,
        judul_prestasi: args.judul_prestasi,
        keterangan: args.keterangan || "",
        tanggal_prestasi: args.tanggal_prestasi || todayStr,
        poin_prestasi: args.poin_prestasi,
        dicatat_oleh_id: caller.id,
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── insert_hafalan_tahfidz ───────────────────────────────
    case "insert_hafalan_tahfidz": {
      const { error } = await supabase.from("hafalan_tahfidz").insert({
        santri_nis: args.santri_nis,
        tanggal: args.tanggal || todayStr,
        surat: args.surat,
        ayat_awal: args.ayat_awal,
        ayat_akhir: args.ayat_akhir,
        juz: args.juz || null,
        status: args.status,
        predikat: args.predikat,
        catatan: args.catatan || "",
        total_hafalan: args.total_hafalan || null,
        dicatat_oleh_id: caller.id,
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── insert_hafalan_kitab ─────────────────────────────────
    case "insert_hafalan_kitab": {
      const { error } = await supabase.from("hafalan_kitab").insert({
        santri_nis: args.santri_nis,
        tanggal: args.tanggal || todayStr,
        nama_kitab: args.nama_kitab,
        bab_materi: args.bab_materi,
        bait_awal: args.bait_awal || null,
        bait_akhir: args.bait_akhir || null,
        halaman_awal: args.halaman_awal || null,
        halaman_akhir: args.halaman_akhir || null,
        predikat: args.predikat,
        status: args.status,
        catatan: args.catatan || "",
        dicatat_oleh_id: caller.id,
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── insert_murojaah ──────────────────────────────────────
    case "insert_murojaah": {
      const { error } = await supabase.from("murojaah_tahfidz").insert({
        santri_nis: args.santri_nis,
        tanggal: args.tanggal || todayStr,
        jenis_murojaah: args.jenis_murojaah,
        juz: args.juz,
        surat: args.surat || null,
        ayat_awal: args.ayat_awal || null,
        ayat_akhir: args.ayat_akhir || null,
        halaman_awal: args.halaman_awal || null,
        halaman_akhir: args.halaman_akhir || null,
        status: args.status || "LANCAR",
        predikat: args.predikat,
        catatan: args.catatan || "",
        dicatat_oleh_id: caller.id,
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── insert_pengeluaran ───────────────────────────────────
    case "insert_pengeluaran": {
      const { error } = await supabase.from("pengeluaran").insert({
        judul: args.judul,
        kategori: args.kategori,
        nominal: args.nominal,
        tanggal_pengeluaran: args.tanggal_pengeluaran || todayStr,
        keterangan: args.keterangan || "",
        dicatat_oleh_id: caller.id,
        dicatat_oleh_nama: caller.full_name,
      });
      if (error) throw error;
      return { success: true, affected: 1 };
    }

    // ── topup_dompet ─────────────────────────────────────────
    case "topup_dompet": {
      // Ambil saldo saat ini
      const { data: existing } = await supabase
        .from("dompet_santri")
        .select("saldo")
        .eq("santri_nis", args.santri_nis)
        .single();

      const saldoLama = existing?.saldo || 0;
      const saldoBaru = saldoLama + args.nominal;

      // Upsert saldo
      const { error: upsertErr } = await supabase.from("dompet_santri").upsert(
        { santri_nis: args.santri_nis, saldo: saldoBaru },
        { onConflict: "santri_nis" }
      );
      if (upsertErr) throw upsertErr;

      // Catat di transaksi_dompet
      const { error: trxErr } = await supabase.from("transaksi_dompet").insert({
        santri_nis: args.santri_nis,
        jenis: "masuk",
        nominal: args.nominal,
        keterangan: args.keterangan || "Top-up via AI Agent",
        dicatat_oleh_id: caller.id,
      });
      if (trxErr) throw trxErr;

      return {
        success: true,
        affected: 1,
        saldo_lama: saldoLama,
        saldo_baru: saldoBaru,
        nominal_topup: args.nominal,
      };
    }

    // ── kirim_notifikasi ─────────────────────────────────────
    case "kirim_notifikasi": {
      let userIds: string[] = [];

      if (args.target === "user_id") {
        if (!args.user_id) throw new Error("user_id wajib jika target=user_id");
        userIds = [args.user_id];
      } else if (args.target === "all_admin") {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .in("role", ["super_admin", "rois", "bendahara", "kesantrian"])
          .eq("is_active", true);
        userIds = admins?.map((a: { id: string }) => a.id) || [];
      } else if (args.target === "wali_santri") {
        if (!args.santri_nis) throw new Error("santri_nis wajib jika target=wali_santri");
        const { data: santri } = await supabase
          .from("santri")
          .select("wali_id, nama")
          .eq("nis", args.santri_nis)
          .single();
        if (santri?.wali_id) userIds = [santri.wali_id];
      }

      if (userIds.length === 0) {
        return { success: false, message: "Tidak ada penerima notifikasi yang valid.", affected: 0 };
      }

      const notifRows = userIds.map((uid: string) => ({
        user_id: uid,
        title: args.title,
        body: args.body,
        data: args.data || {},
        status: "pending",
        source_table: "ai_agent",
      }));

      const { error } = await supabase.from("notification_queue").insert(notifRows);
      if (error) throw error;
      return { success: true, affected: notifRows.length };
    }

    default:
      throw new Error(`Unknown action tool: ${toolName}`);
  }
}

// ══════════════════════════════════════════════════════════════════
// AUDIT LOGGER
// Semua aksi AI (berhasil, gagal, ditolak user) dicatat di audit_logs
// ══════════════════════════════════════════════════════════════════
async function logAudit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  caller: CallerProfile,
  toolName: string,
  // deno-lint-ignore no-explicit-any
  args: any,
  // deno-lint-ignore no-explicit-any
  result: any,
  status: "success" | "failed" | "rejected"
) {
  try {
    await supabase.from("audit_logs").insert({
      user_id: caller.id,
      user_name: caller.full_name,
      user_role: caller.role,
      action: "AI_AGENT",
      resource: toolName,
      record_id: String(args?.santri_nis || args?.tagihan_id || args?.santri_nis_list?.length || "batch"),
      details: {
        ai_agent: true,
        tool: toolName,
        args,
        result: {
          status,
          affected: result?.affected,
          error: result?.error || result?.message,
        },
      },
      meta_info: `[AI_AGENT] ${toolName} | Status: ${status} | By: ${caller.full_name} (${caller.role})`,
    });
  } catch (logErr) {
    // Jangan crash jika logging gagal
    console.error("Audit log error:", logErr);
  }
}

// ══════════════════════════════════════════════════════════════════
// BUILD ACTION SUMMARY (untuk modal konfirmasi HITL di frontend)
// ══════════════════════════════════════════════════════════════════
// deno-lint-ignore no-explicit-any
function buildActionSummary(toolName: string, args: any): string {
  switch (toolName) {
    case "generate_tagihan_massal":
      return `**📋 Generate Tagihan Massal**
- Target Kelas: **${args.filter_kelas === "ALL" ? "Semua Kelas" : `Kelas ${args.filter_kelas}`}**
- Target Jurusan: **${args.filter_jurusan === "ALL" ? "Semua Jurusan" : args.filter_jurusan}**
- Status Santri: ${args.filter_status_santri || "AKTIF"}
- Deskripsi: **${args.deskripsi_tagihan}**
- Nominal: **${formatRp(args.nominal_tagihan)}** per santri
- Jatuh Tempo: ${args.tanggal_jatuh_tempo}`;

    case "generate_tagihan_individual":
      return `**📋 Generate Tagihan Individual**
- Santri NIS: \`${args.santri_nis}\`
- Deskripsi: **${args.deskripsi_tagihan}**
- Nominal: **${formatRp(args.nominal_tagihan)}**
- Jatuh Tempo: ${args.tanggal_jatuh_tempo}`;

    case "update_status_tagihan":
      return `**💰 Update Status Tagihan**
- ID Tagihan: \`${args.tagihan_id}\`
- Status Baru: **${args.status_baru}**
${args.sisa_tagihan !== undefined ? `- Sisa: ${formatRp(args.sisa_tagihan)}` : ""}`;

    case "update_status_santri":
      return `**🔄 Update Status Santri**
- Mode: **${args.target === "bulk" ? "Massal" : "Individual"}**
- ${args.santri_nis ? `NIS: \`${args.santri_nis}\`` : `Kelas: ${args.filter_kelas || "-"}, Jurusan: ${args.filter_jurusan || "-"}`}
- Status Baru: **${args.status_baru}**
${args.kelas_baru ? `- Pindah ke Kelas: **${args.kelas_baru}**` : ""}
${args.jurusan_baru ? `- Pindah Jurusan: **${args.jurusan_baru}**` : ""}`;

    case "update_santri_data":
      return `**✏️ Update Data Santri**
- NIS: \`${args.santri_nis}\`
- Field: ${Object.entries(args.fields).map(([k, v]) => `\`${k}\` → **${v}**`).join(", ")}`;

    case "insert_pelanggaran":
      return `**⚠️ Catat Pelanggaran**
- Santri NIS: \`${args.santri_nis}\`
- Jenis: **${args.jenis_pelanggaran}**
- Poin: **-${args.poin} poin**
- Hukuman: ${args.hukuman || "-"}
- Tanggal: ${args.tanggal || today()}`;

    case "insert_pelanggaran_massal":
      return `**⚠️ Catat Pelanggaran Massal**
- Target: ${args.santri_nis_list?.length ? `${args.santri_nis_list.length} santri spesifik` : `Kelas ${args.filter_kelas || "ALL"}, Jurusan ${args.filter_jurusan || "ALL"}`}
- Jenis: **${args.jenis_pelanggaran}**
- Poin: **-${args.poin} per santri**
- Hukuman: ${args.hukuman || "-"}`;

    case "insert_kesehatan":
      return `**🏥 Catat Rekam Medis**
- Santri NIS: \`${args.santri_nis}\`
- Keluhan: **${args.keluhan}**
- Tindakan: **${args.tindakan}**
- Tanggal: ${args.tanggal || today()}`;

    case "insert_perizinan":
      return `**🚪 Catat Perizinan**
- Santri NIS: \`${args.santri_nis}\`
- Jenis Izin: **${args.jenis_izin}**
- Keluar: ${args.tanggal || today()} → Kembali: **${args.tanggal_kembali}**
- Status: **${args.status || "APPROVED"}**`;

    case "insert_prestasi":
      return `**🏆 Catat Prestasi**
- Santri NIS: \`${args.santri_nis}\`
- Kategori: **${args.kategori}**
- Prestasi: **${args.judul_prestasi}**
- Poin Reward: **+${args.poin_prestasi}**`;

    case "insert_hafalan_tahfidz":
      return `**📖 Catat Hafalan Tahfidz**
- Santri NIS: \`${args.santri_nis}\`
- Surat: **${args.surat}** ayat ${args.ayat_awal}–${args.ayat_akhir}
- Predikat: **${args.predikat}** | Status: **${args.status}**
${args.total_hafalan ? `- Total Hafalan: ${args.total_hafalan} Juz` : ""}`;

    case "insert_hafalan_kitab":
      return `**📚 Catat Hafalan Kitab**
- Santri NIS: \`${args.santri_nis}\`
- Kitab: **${args.nama_kitab}**
- Bab/Materi: **${args.bab_materi}**
- Predikat: **${args.predikat}** | Status: **${args.status}**`;

    case "insert_murojaah":
      return `**🔁 Catat Murojaah**
- Santri NIS: \`${args.santri_nis}\`
- Jenis: **${args.jenis_murojaah}** | Juz: ${args.juz}
- Predikat: **${args.predikat}**`;

    case "insert_pengeluaran":
      return `**💸 Catat Pengeluaran**
- Judul: **${args.judul}**
- Kategori: **${args.kategori}**
- Nominal: **${formatRp(args.nominal)}**
- Tanggal: ${args.tanggal_pengeluaran || today()}`;

    case "topup_dompet":
      return `**💳 Top-up Dompet Santri**
- Santri NIS: \`${args.santri_nis}\`
- Nominal Top-up: **${formatRp(args.nominal)}**
- Keterangan: ${args.keterangan || "Top-up via AI Agent"}`;

    case "kirim_notifikasi":
      return `**🔔 Kirim Push Notification**
- Target: **${args.target}**${args.santri_nis ? ` (wali NIS: ${args.santri_nis})` : ""}
- Judul: **${args.title}**
- Pesan: ${args.body}`;

    default:
      return `**Aksi: ${toolName}**\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``;
  }
}

// ══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// ══════════════════════════════════════════════════════════════════
function buildSystemPrompt(caller: CallerProfile, accessibleToolNames: string[]): string {
  const todayStr = today();
  return `Kamu adalah AI Agent cerdas dan handal untuk sistem manajemen Pesantren Al-Hasanah.

## Identitas Pengguna (Caller)
- Nama: ${caller.full_name}
- Role: ${caller.role}
- Akses Jurusan: ${caller.akses_jurusan}
- Akses Gender: ${caller.akses_gender}
- Tanggal Hari Ini: ${todayStr}

## Tools yang Tersedia Untuk Role Ini
${accessibleToolNames.join(", ")}

## Enum & Nilai Valid (WAJIB DIIKUTI)
- Kelas: "1" | "2" | "3"
- Jurusan: "KITAB" | "TAHFIDZ"
- Status Santri: "AKTIF" | "LULUS" | "KELUAR" | "ALUMNI"
- Status Tagihan: "LUNAS" | "BELUM" | "CICILAN"
- Jenis Kelamin: "L" | "P"
- Predikat Hafalan: "MUMTAZ" | "JAYYID" | "KURANG"
- Status Hafalan Tahfidz: "LANJUT" | "ULANG"
- Status Hafalan Kitab: "LULUS" | "MENGULANG"
- Jenis Murojaah: "SABAQ" | "MANZIL"
- Kategori Pengeluaran: "OPERASIONAL" | "PEMBANGUNAN" | "DAPUR" | "KEGIATAN" | "LAINNYA"
- Kategori Prestasi: "TAHFIDZ" | "KITAB" | "UMUM" | "KHATAM"
- Nama Kitab Valid: "Jurumiah" | "Imrity" | "Nadzmul Maqshud" | "Alfiyah" | "Uqudul Juman" | "Sulam Munawraq"
- Sumber Dana Inventaris: "YAYASAN" | "BOS" | "WAKAF" | "HIBAH"
- Kondisi Inventaris: "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT" | "HILANG"
- Target Notifikasi: "user_id" | "all_admin" | "wali_santri"

## Aturan Penting Agent
1. **QUERY SEBELUM ACTION**: Jika user menyebut nama santri (bukan NIS), WAJIB query_santri dahulu untuk mendapatkan NIS yang valid.
2. **REF JENIS PEMBAYARAN**: Sebelum generate tagihan apapun, WAJIB query_ref_jenis_pembayaran untuk mendapatkan jenis_pembayaran_id yang benar.
3. **QUERY TOOLS**: Dieksekusi LANGSUNG tanpa konfirmasi. Ringkas hasilnya secara informatif.
4. **ACTION TOOLS**: Akan dikembalikan ke user untuk KONFIRMASI terlebih dahulu. JANGAN asumsikan user sudah setuju.
5. **AMBIGUITAS**: Jika instruksi tidak jelas (nama santri tidak unik, nominal tidak disebutkan, dll), TANYAKAN klarifikasi sebelum memanggil tool.
6. **TIDAK BISA DELETE**: Tidak ada kemampuan menghapus data. Sampaikan ini jika user meminta.
7. **NOMINAL RUPIAH**: Selalu integer tanpa titik/koma. Contoh: 500000 (BUKAN 500.000 atau Rp500.000).
8. **FORMAT TANGGAL**: Selalu YYYY-MM-DD.
9. **SCOPE FILTER**: Respek akses_jurusan dan akses_gender caller. Jangan tampilkan data di luar scope.
10. **BAHASA**: Respons dalam Bahasa Indonesia yang ramah dan profesional.
11. **INFORMATIF**: Setelah query, berikan ringkasan yang actionable: temuan utama, insight, dan saran tindak lanjut jika relevan.`;
}

// ══════════════════════════════════════════════════════════════════
// MAIN REQUEST HANDLER
// ══════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({
        error: "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum terkonfigurasi di Edge Function secrets.",
      }, 500);
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey // service role untuk bypass RLS
    );

    const body = await req.json();
    const { mode = "chat", userMessage, conversationHistory = [], actionToExecute, callerProfile } = body;

    // ── Validasi CallerProfile ──────────────────────────────
    if (!callerProfile?.id || !callerProfile?.role) {
      return jsonResponse({ error: "callerProfile tidak valid atau tidak lengkap." }, 401);
    }
    const caller = callerProfile as CallerProfile;

    // ── Role tidak dikenali ─────────────────────────────────
    if (!ROLE_TOOL_PERMISSIONS[caller.role]) {
      return jsonResponse({ error: `Role '${caller.role}' tidak dikenali.` }, 403);
    }

    // ── Alumni tidak punya akses agent ──────────────────────
    if (caller.role === "alumni" || ROLE_TOOL_PERMISSIONS[caller.role].length === 0) {
      return jsonResponse({ error: "Role Anda tidak memiliki akses ke AI Agent." }, 403);
    }

    // ════════════════════════════════════════════════════════
    // MODE: EXECUTE — Eksekusi action setelah approved HITL
    // ════════════════════════════════════════════════════════
    if (mode === "execute") {
      const { toolName, args } = actionToExecute || {};
      if (!toolName || !args) {
        return jsonResponse({ error: "actionToExecute.toolName dan args wajib diisi." }, 400);
      }

      // Verifikasi tool valid dan role punya izin
      if (!ACTION_TOOLS.has(toolName)) {
        return jsonResponse({ error: `Tool '${toolName}' bukan action tool yang valid.` }, 400);
      }
      if (!canUse(caller.role, toolName)) {
        return jsonResponse({
          error: `Role '${caller.role}' tidak memiliki izin untuk tool: ${toolName}`,
        }, 403);
      }

      try {
        const result = await executeActionTool(supabase, toolName, args, caller);
        await logAudit(supabase, caller, toolName, args, result, "success");
        return jsonResponse({ ...result, toolName });
      } catch (execErr: unknown) {
        const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
        await logAudit(supabase, caller, toolName, args, { error: errMsg }, "failed");
        return jsonResponse({ success: false, error: errMsg, toolName }, 400);
      }
    }

    // ════════════════════════════════════════════════════════
    // MODE: REJECTED — User menolak konfirmasi HITL
    // ════════════════════════════════════════════════════════
    if (mode === "rejected") {
      const { toolName, args } = actionToExecute || {};
      if (toolName && args) {
        await logAudit(supabase, caller, toolName, args, null, "rejected");
      }
      return jsonResponse({ logged: true, message: "Aksi dibatalkan dan tercatat di audit log." });
    }

    // ════════════════════════════════════════════════════════
    // MODE: CHAT — AI berpikir dengan Gemini Function Calling
    // ════════════════════════════════════════════════════════
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "GEMINI_API_KEY tidak terkonfigurasi." }, 500);
    if (!userMessage) return jsonResponse({ error: "userMessage wajib diisi untuk mode chat." }, 400);
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    // Filter tools berdasarkan role
    const rolePerms = ROLE_TOOL_PERMISSIONS[caller.role] || [];
    const canAll = rolePerms.includes("*");
    const availableToolsRaw = canAll
      ? ALL_TOOLS
      : ALL_TOOLS.filter((t) => rolePerms.includes(t.name));
    const availableTools = availableToolsRaw.map(toGeminiToolSchema);

    const accessibleToolNames = availableTools.map((t) => t.name);
    const systemPrompt = buildSystemPrompt(caller, accessibleToolNames);

    // Bangun pesan awal
    let messages = [
      ...conversationHistory,
      { role: "user", parts: [{ text: userMessage }] },
    ];

    // Multi-turn agentic loop
    const MAX_ITERATIONS = 10; // Cegah infinite loop
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: messages,
            tools: availableTools.length > 0
              ? [{ function_declarations: availableTools }]
              : undefined,
            tool_config: availableTools.length > 0
              ? { function_calling_config: { mode: "AUTO" } }
              : undefined,
            generationConfig: {
              temperature: 0.1, // Rendah → deterministik untuk agent
              topK: 20,
              topP: 0.9,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        const errData = await geminiRes.json().catch(() => ({}));
        console.error("[AI Agent] Gemini API Error:", JSON.stringify(errData));
        return jsonResponse({
          error: `Gemini API Error: ${errData.error?.message || "Unknown error"}`,
          detail: errData,
        }, 500);
      }

      const geminiData = await geminiRes.json();
      const candidate = geminiData.candidates?.[0]?.content;

      if (!candidate?.parts) {
        // Finish reason mungkin SAFETY atau MAX_TOKENS
        const finishReason = geminiData.candidates?.[0]?.finishReason;
        return jsonResponse({
          type: "text",
          answer: `Maaf, AI tidak dapat memproses permintaan ini. (Reason: ${finishReason || "unknown"})`,
          updatedHistory: messages,
        });
      }

      // Tambahkan respons model ke history
      messages.push({ role: "model", parts: candidate.parts });

      // ── Periksa apakah ada function call ─────────────────
      const functionCallPart = candidate.parts.find(
        // deno-lint-ignore no-explicit-any
        (p: any) => p.functionCall
      );
      // deno-lint-ignore no-explicit-any
      const textPart = candidate.parts.find((p: any) => p.text);

      // Tidak ada function call → AI hanya merespons teks
      if (!functionCallPart) {
        return jsonResponse({
          type: "text",
          answer: textPart?.text || "Maaf, tidak ada respons dari AI.",
          updatedHistory: messages,
        });
      }

      const { name: toolName, args } = functionCallPart.functionCall;

      // ── Cek izin role untuk tool ini ─────────────────────
      if (!canUse(caller.role, toolName)) {
        const deniedMsg = `Maaf, role ${caller.role} tidak punya izin untuk: ${toolName}`;
        messages.push({
          role: "user",
          parts: [{ functionResponse: { name: toolName, response: { error: deniedMsg } } }],
        });
        continue;
      }

      // ── ACTION TOOL → Kembalikan untuk konfirmasi HITL ───
      if (ACTION_TOOLS.has(toolName)) {
        const actionSummary = buildActionSummary(toolName, args);
        return jsonResponse({
          type: "action_required",
          toolName,
          args,
          actionSummary,
          aiPreMessage: textPart?.text || null, // Teks AI sebelum memanggil tool
          updatedHistory: messages,
        });
      }

      // ── QUERY TOOL → Eksekusi langsung, feed ke AI ───────
      if (QUERY_TOOLS.has(toolName)) {
        try {
          const queryResult = await executeQueryTool(supabase, toolName, args, caller);
          // Feed hasil kembali ke AI untuk diproses
          messages.push({
            role: "user",
            parts: [{ functionResponse: { name: toolName, response: queryResult } }],
          });
          continue; // Lanjut loop → AI proses hasilnya
        } catch (qErr: unknown) {
          const errMsg = qErr instanceof Error ? qErr.message : String(qErr);
          messages.push({
            role: "user",
            parts: [{ functionResponse: { name: toolName, response: { error: errMsg } } }],
          });
          continue;
        }
      }

      // Tool tidak dikenali sama sekali
      messages.push({
        role: "user",
        parts: [{ functionResponse: { name: toolName, response: { error: `Tool tidak dikenali: ${toolName}` } } }],
      });
    }

    // Max iterations tercapai
    return jsonResponse({
      type: "text",
      answer: "Maaf, permintaan ini memerlukan terlalu banyak langkah. Coba sederhanakan atau pecah menjadi beberapa perintah.",
      updatedHistory: messages,
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[AI Agent] Fatal error:", error);
    return jsonResponse({ error: errMsg }, 500);
  }
});
