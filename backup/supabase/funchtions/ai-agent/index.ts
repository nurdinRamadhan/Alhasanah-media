// ╔══════════════════════════════════════════════════════════════════╗
// ║          AI AGENT - SUPABASE EDGE FUNCTION                      ║
// ║          Sistem Manajemen Pesantren                             ║
// ║          Version: 2.0 | Multi-turn | HITL | Role-Aware         ║
// ╚══════════════════════════════════════════════════════════════════╝

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── TYPES ────────────────────────────────────────────────────────
type TRole = "super_admin" | "rois" | "bendahara" | "kesantrian" | "dewan" | "alumni";
interface CallerProfile {
  id: string;
  full_name: string;
  role: TRole;
  akses_gender: "L" | "P" | "ALL";
  akses_jurusan: "KITAB" | "TAHFIDZ" | "ALL";
}

// ── PERMISSIONS ──────────────────────────────────────────────────
const ROLE_TOOL_PERMISSIONS: Record<TRole, string[]> = {
  super_admin: ["*"],
  rois: ["*"],
  dewan: ["query_santri", "query_tagihan", "query_keuangan", "query_pelanggaran", "query_kesehatan", "query_perizinan", "query_hafalan", "query_prestasi", "query_inventaris", "query_ref_jenis_pembayaran", "query_dompet"],
  kesantrian: ["query_santri", "query_pelanggaran", "query_kesehatan", "query_perizinan", "query_hafalan", "query_prestasi", "insert_pelanggaran", "insert_pelanggaran_massal", "insert_kesehatan", "insert_perizinan", "insert_prestasi", "insert_hafalan_tahfidz", "insert_hafalan_kitab", "insert_murojaah", "update_status_santri", "update_santri_data", "kirim_notifikasi"],
  bendahara: ["query_santri", "query_tagihan", "query_keuangan", "query_ref_jenis_pembayaran", "query_dompet", "generate_tagihan_massal", "generate_tagihan_individual", "update_status_tagihan", "insert_pengeluaran", "topup_dompet", "kirim_notifikasi"],
  alumni: [],
};

const QUERY_TOOLS = new Set(["query_santri", "query_tagihan", "query_keuangan", "query_pelanggaran", "query_kesehatan", "query_perizinan", "query_hafalan", "query_prestasi", "query_inventaris", "query_ref_jenis_pembayaran", "query_dompet"]);
const ACTION_TOOLS = new Set(["generate_tagihan_massal", "generate_tagihan_individual", "update_status_tagihan", "update_status_santri", "update_santri_data", "insert_pelanggaran", "insert_pelanggaran_massal", "insert_kesehatan", "insert_perizinan", "insert_prestasi", "insert_hafalan_tahfidz", "insert_hafalan_kitab", "insert_murojaah", "insert_pengeluaran", "topup_dompet", "kirim_notifikasi"]);

function canUse(role: TRole, toolName: string): boolean {
  const perms = ROLE_TOOL_PERMISSIONS[role] || [];
  return perms.includes("*") || perms.includes(toolName);
}

// ── TOOL DEFINITIONS ─────────────────────────────────────────────
const ALL_TOOLS = [
  { name: "query_santri", description: "Cari data santri (NIS, nama, kelas, jurusan, status).", parameters: { type: "object", properties: { kelas: { type: "string", enum: ["1", "2", "3"] }, jurusan: { type: "string", enum: ["KITAB", "TAHFIDZ"] }, status_santri: { type: "string", enum: ["AKTIF", "LULUS", "KELUAR", "ALUMNI"] }, jenis_kelamin: { type: "string", enum: ["L", "P"] }, nama_search: { type: "string" }, nis: { type: "string" }, limit: { type: "number" } } } },
  { name: "query_tagihan", description: "Cari data tagihan santri.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, status: { type: "string", enum: ["LUNAS", "BELUM", "CICILAN"] }, kelas: { type: "string", enum: ["1", "2", "3"] }, jurusan: { type: "string", enum: ["KITAB", "TAHFIDZ"] }, jenis_pembayaran_id: { type: "number" }, bulan: { type: "string", description: "YYYY-MM" }, limit: { type: "number" } } } },
  { name: "query_ref_jenis_pembayaran", description: "Daftar jenis pembayaran aktif.", parameters: { type: "object", properties: {} } },
  { name: "query_keuangan", description: "Data pengeluaran/transaksi.", parameters: { type: "object", properties: { jenis: { type: "string", enum: ["pengeluaran", "transaksi"] }, bulan: { type: "string" }, kategori: { type: "string" }, limit: { type: "number" } }, required: ["jenis"] } },
  { name: "query_pelanggaran", description: "Data pelanggaran santri.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, kelas: { type: "string" }, jurusan: { type: "string" }, tanggal_dari: { type: "string" }, tanggal_sampai: { type: "string" }, jenis_pelanggaran: { type: "string" }, limit: { type: "number" } } } },
  { name: "query_kesehatan", description: "Data riwayat kesehatan.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, keluhan: { type: "string" }, limit: { type: "number" } } } },
  { name: "query_perizinan", description: "Data perizinan santri.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, status: { type: "string" }, limit: { type: "number" } } } },
  { name: "query_hafalan", description: "Data hafalan (tahfidz/kitab/murojaah).", parameters: { type: "object", properties: { jenis: { type: "string", enum: ["tahfidz", "kitab", "murojaah"] }, santri_nis: { type: "string" }, limit: { type: "number" } }, required: ["jenis"] } },
  { name: "query_prestasi", description: "Data prestasi santri.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, kategori: { type: "string" } } } },
  { name: "query_inventaris", description: "Data aset/inventaris.", parameters: { type: "object", properties: { kondisi: { type: "string" }, nama_search: { type: "string" } } } },
  { name: "query_dompet", description: "Saldo & riwayat dompet.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, include_history: { type: "boolean" } }, required: ["santri_nis"] } },
  { name: "generate_tagihan_massal", description: "Buat tagihan massal.", parameters: { type: "object", properties: { filter_kelas: { type: "string" }, filter_jurusan: { type: "string" }, jenis_pembayaran_id: { type: "number" }, deskripsi_tagihan: { type: "string" }, nominal_tagihan: { type: "number" }, tanggal_jatuh_tempo: { type: "string" } }, required: ["filter_kelas", "filter_jurusan", "jenis_pembayaran_id", "deskripsi_tagihan", "nominal_tagihan", "tanggal_jatuh_tempo"] } },
  { name: "generate_tagihan_individual", description: "Buat satu tagihan.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, jenis_pembayaran_id: { type: "number" }, deskripsi_tagihan: { type: "string" }, nominal_tagihan: { type: "number" }, tanggal_jatuh_tempo: { type: "string" } }, required: ["santri_nis", "jenis_pembayaran_id", "deskripsi_tagihan", "nominal_tagihan", "tanggal_jatuh_tempo"] } },
  { name: "update_status_tagihan", description: "Update status tagihan.", parameters: { type: "object", properties: { tagihan_id: { type: "string" }, status_baru: { type: "string", enum: ["LUNAS", "BELUM", "CICILAN"] }, sisa_tagihan: { type: "number" } }, required: ["tagihan_id", "status_baru"] } },
  { name: "update_status_santri", description: "Update status (aktif/alumni/lulus).", parameters: { type: "object", properties: { target: { type: "string", enum: ["individual", "bulk"] }, santri_nis: { type: "string" }, status_baru: { type: "string" } }, required: ["target", "status_baru"] } },
  { name: "update_santri_data", description: "Update profil santri.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, fields: { type: "object" } }, required: ["santri_nis", "fields"] } },
  { name: "insert_pelanggaran", description: "Catat pelanggaran.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, jenis_pelanggaran: { type: "string" }, poin: { type: "number" } }, required: ["santri_nis", "jenis_pelanggaran", "poin"] } },
  { name: "insert_kesehatan", description: "Catat rekam medis.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, keluhan: { type: "string" }, tindakan: { type: "string" } }, required: ["santri_nis", "keluhan", "tindakan"] } },
  { name: "insert_perizinan", description: "Catat perizinan.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, jenis_izin: { type: "string" }, tanggal_kembali: { type: "string" } }, required: ["santri_nis", "jenis_izin", "tanggal_kembali"] } },
  { name: "insert_hafalan_tahfidz", description: "Catat hafalan Quran.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, surat: { type: "string" }, ayat_awal: { type: "number" }, ayat_akhir: { type: "number" }, status: { type: "string" }, predikat: { type: "string" } }, required: ["santri_nis", "surat", "ayat_awal", "ayat_akhir", "status", "predikat"] } },
  { name: "insert_pengeluaran", description: "Catat pengeluaran.", parameters: { type: "object", properties: { judul: { type: "string" }, kategori: { type: "string" }, nominal: { type: "number" }, tanggal_pengeluaran: { type: "string" } }, required: ["judul", "kategori", "nominal", "tanggal_pengeluaran"] } },
  { name: "topup_dompet", description: "Top-up saldo dompet.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, nominal: { type: "number" } }, required: ["santri_nis", "nominal"] } },
  { name: "kirim_notifikasi", description: "Kirim push notification.", parameters: { type: "object", properties: { target: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["target", "title", "body"] } },
];

// ── UTILS ────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split("T")[0]; }
function formatRp(n: number) { try { return `Rp ${Number(n).toLocaleString("id-ID")}`; } catch { return `Rp ${n}`; } }
function getNextMonthStart(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const nY = m === 12 ? y + 1 : y;
  const nM = m === 12 ? 1 : m + 1;
  return `${nY}-${String(nM).padStart(2, "0")}-01`;
}

// ── EXECUTORS ─────────────────────────────────────────────────────
async function executeQueryTool(supabase: any, toolName: string, args: any, caller: CallerProfile) {
  const applyScope = (q: any) => {
    if (caller.akses_jurusan !== "ALL") q = q.eq("jurusan", caller.akses_jurusan);
    if (caller.akses_gender !== "ALL") q = q.eq("jenis_kelamin", caller.akses_gender);
    return q;
  };
  switch (toolName) {
    case "query_santri": {
      let q = supabase.from("santri").select("*");
      if (args.kelas) q = q.eq("kelas", args.kelas);
      if (args.jurusan) q = q.eq("jurusan", args.jurusan);
      if (args.nama_search) q = q.ilike("nama", `%${args.nama_search}%`);
      if (args.nis) q = q.eq("nis", args.nis);
      const { data, error } = await applyScope(q).limit(args.limit || 100);
      if (error) throw error; return { data, total: data?.length };
    }
    case "query_tagihan": {
      let q = supabase.from("tagihan_santri").select("*, santri:santri_nis(nama, kelas, jurusan), jenis_bayar:jenis_pembayaran_id(nama_pembayaran)");
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.status) q = q.eq("status", args.status);
      if (args.bulan) q = q.gte("created_at", `${args.bulan}-01`).lt("created_at", getNextMonthStart(args.bulan));
      const { data, error } = await q.limit(args.limit || 100);
      if (error) throw error;
      const totalSisa = data?.reduce((s: number, t: any) => s + (t.sisa_tagihan || 0), 0);
      return { data, summary: { total_sisa: totalSisa, total_record: data?.length } };
    }
    case "query_ref_jenis_pembayaran": {
      const { data, error } = await supabase.from("ref_jenis_pembayaran").select("*").eq("is_aktif", true);
      if (error) throw error; return { data };
    }
    case "query_keuangan": {
      const table = args.jenis === "pengeluaran" ? "pengeluaran" : "transaksi_keuangan";
      let q = supabase.from(table).select("*");
      if (args.bulan) q = q.gte(args.jenis === "pengeluaran" ? "tanggal_pengeluaran" : "created_at", `${args.bulan}-01`);
      const { data, error } = await q.limit(args.limit || 100);
      if (error) throw error; return { data };
    }
    case "query_pelanggaran": {
      let q = supabase.from("pelanggaran_santri").select("*, santri:santri_nis(nama, kelas, jurusan)");
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      const { data, error } = await q.limit(args.limit || 100);
      if (error) throw error; return { data, total_poin: data?.reduce((s: number, p: any) => s + (p.poin || 0), 0) };
    }
    case "query_dompet": {
      const { data: dompet, error } = await supabase.from("dompet_santri").select("*").eq("santri_nis", args.santri_nis).single();
      if (error && error.code !== "PGRST116") throw error;
      return { dompet: dompet || { saldo: 0 } };
    }
    default: return { error: "Query tool not implemented in this version." };
  }
}

async function executeActionTool(supabase: any, toolName: string, args: any, caller: CallerProfile) {
  const tStr = today();
  switch (toolName) {
    case "insert_pelanggaran": {
      const { error } = await supabase.from("pelanggaran_santri").insert({ santri_nis: args.santri_nis, jenis_pelanggaran: args.jenis_pelanggaran, poin: args.poin, tanggal: tStr, dicatat_oleh_id: caller.id });
      if (error) throw error; return { success: true };
    }
    case "topup_dompet": {
      const { data: ext } = await supabase.from("dompet_santri").select("saldo").eq("santri_nis", args.santri_nis).single();
      const nS = (ext?.saldo || 0) + args.nominal;
      await supabase.from("dompet_santri").upsert({ santri_nis: args.santri_nis, saldo: nS }, { onConflict: "santri_nis" });
      await supabase.from("transaksi_dompet").insert({ santri_nis: args.santri_nis, jenis: "masuk", nominal: args.nominal, keterangan: "Top-up via AI", dicatat_oleh_id: caller.id });
      return { success: true, saldo_baru: nS };
    }
    default: return { error: "Action tool not implemented in this version." };
  }
}

function buildActionSummary(toolName: string, args: any): string {
  return `**Aksi: ${toolName}**\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``;
}

function buildSystemPrompt(caller: CallerProfile, toolNames: string[]) {
  return `Kamu adalah AI Agent Pesantren Al-Hasanah. Nama: ${caller.full_name}, Role: ${caller.role}. Hari ini: ${today()}.\nTools: ${toolNames.join(", ")}.\nAturan: 1. Query sebelum action. 2. Action butuh konfirmasi. 3. Respek scope user.`;
}

// ── MAIN HANDLER ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { mode = "chat", userMessage, conversationHistory = [], actionToExecute, callerProfile } = body;
    if (!callerProfile?.id) return jsonResponse({ error: "Missing callerProfile" }, 401);
    const caller = callerProfile as CallerProfile;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (mode === "execute") {
      const { toolName, args } = actionToExecute || {};
      const res = await executeActionTool(supabase, toolName, args, caller);
      return jsonResponse({ ...res, toolName });
    }
    if (mode === "rejected") return jsonResponse({ message: "Dibatalkan" });

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const rolePerms = ROLE_TOOL_PERMISSIONS[caller.role] || [];
    const availableTools = rolePerms.includes("*") ? ALL_TOOLS : ALL_TOOLS.filter(t => rolePerms.includes(t.name));
    const systemPrompt = buildSystemPrompt(caller, availableTools.map(t => t.name));

    let messages = [...conversationHistory, { role: "user", parts: [{ text: userMessage || "Halo" }] }];
    
    // Model Call
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        tools: availableTools.length > 0 ? [{ function_declarations: availableTools }] : undefined,
        tool_config: { function_calling_config: { mode: "AUTO" } },
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      return jsonResponse({ error: "Gemini API Error", detail: err }, 500);
    }

    const data = await geminiRes.json();
    const candidate = data.candidates?.[0]?.content;
    if (!candidate) return jsonResponse({ type: "text", answer: "Maaf, AI tidak merespons." });

    messages.push({ role: "model", parts: candidate.parts });
    const fnCall = candidate.parts.find((p: any) => p.functionCall);
    const textPart = candidate.parts.find((p: any) => p.text);

    if (fnCall) {
      const { name, args } = fnCall.functionCall;
      if (ACTION_TOOLS.has(name)) {
        return jsonResponse({ type: "action_required", toolName: name, args, actionSummary: buildActionSummary(name, args), aiPreMessage: textPart?.text, updatedHistory: messages });
      }
      if (QUERY_TOOLS.has(name)) {
        const qRes = await executeQueryTool(supabase, name, args, caller);
        // Single turn for now to ensure stability
        return jsonResponse({ type: "text", answer: `Hasil query ${name}: ${JSON.stringify(qRes)}`, updatedHistory: messages });
      }
    }

    return jsonResponse({ type: "text", answer: textPart?.text || "Selesai.", updatedHistory: messages });

  } catch (e: any) {
    console.error("Agent Error:", e.message);
    return jsonResponse({ error: e.message }, 500);
  }
});
