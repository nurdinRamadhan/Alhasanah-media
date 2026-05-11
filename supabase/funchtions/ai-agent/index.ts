// ╔══════════════════════════════════════════════════════════════════╗
// ║          AI AGENT - SUPABASE EDGE FUNCTION                      ║
// ║          Sistem Manajemen Pesantren                             ║
// ║          Version: 3.0 | Multi-turn | HITL | Role-Aware         ║
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
  { name: "kirim_notifikasi", description: "Kirim push notification ke Wali.", parameters: { type: "object", properties: { santri_nis: { type: "string" }, title: { type: "string" }, body: { type: "string" }, type: { type: "string" } }, required: ["santri_nis", "title", "body"] } },
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
      if (args.status_santri) q = q.eq("status_santri", args.status_santri);
      if (args.jenis_kelamin) q = q.eq("jenis_kelamin", args.jenis_kelamin);
      if (args.nama_search) q = q.ilike("nama", `%${args.nama_search}%`);
      if (args.nis) q = q.eq("nis", args.nis);
      const { data, error } = await applyScope(q).limit(args.limit || 100);
      if (error) throw error; return { data, total: data?.length };
    }
    case "query_tagihan": {
      // Use correct relationship names from schema: santri_nis (santri) and jenis_pembayaran_id (ref_jenis_pembayaran)
      let q = supabase.from("tagihan_santri").select("*, santri:santri_nis(nama, kelas, jurusan), jenis_bayar:jenis_pembayaran_id(nama_pembayaran)");
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.status) q = q.eq("status", args.status);
      if (args.bulan) q = q.gte("created_at", `${args.bulan}-01`).lt("created_at", getNextMonthStart(args.bulan));
      if (args.jenis_pembayaran_id) q = q.eq("jenis_pembayaran_id", args.jenis_pembayaran_id);
      
      const { data, error } = await q.limit(args.limit || 100);
      if (error) throw error;
      const totalSisa = data?.reduce((s: number, t: any) => s + (Number(t.sisa_tagihan) || 0), 0);
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
      if (args.kategori) q = q.eq("kategori", args.kategori);
      const { data, error } = await q.limit(args.limit || 100);
      if (error) throw error; return { data };
    }
    case "query_pelanggaran": {
      let q = supabase.from("pelanggaran_santri").select("*, santri:santri_nis(nama, kelas, jurusan)");
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.jenis_pelanggaran) q = q.ilike("jenis_pelanggaran", `%${args.jenis_pelanggaran}%`);
      const { data, error } = await q.limit(args.limit || 100);
      if (error) throw error; return { data, total_poin: data?.reduce((s: number, p: any) => s + (p.poin || 0), 0) };
    }
    case "query_kesehatan": {
      let q = supabase.from("kesehatan_santri").select("*, santri:santri_nis(nama, kelas, jurusan)");
      if (args.santri_nis) q = q.eq("santri_nis", args.santri_nis);
      if (args.keluhan) q = q.ilike("keluhan", `%${args.keluhan}%`);
      const { data, error } = await q.limit(args.limit || 100);
      if (error) throw error; return { data };
    }
    case "query_dompet": {
      const { data: dompet, error } = await supabase.from("dompet_santri").select("*").eq("santri_nis", args.santri_nis).single();
      if (error && error.code !== "PGRST116") throw error;
      
      let history = [];
      if (args.include_history) {
        const { data } = await supabase.from("transaksi_dompet").select("*").eq("santri_nis", args.santri_nis).order("created_at", { ascending: false }).limit(10);
        history = data || [];
      }
      return { dompet: dompet || { saldo: 0 }, history };
    }
    default: return { error: `Query tool '${toolName}' not implemented.` };
  }
}

async function executeActionTool(supabase: any, toolName: string, args: any, caller: CallerProfile) {
  const tStr = today();
  switch (toolName) {
    case "insert_pelanggaran": {
      const { error } = await supabase.from("pelanggaran_santri").insert({ santri_nis: args.santri_nis, jenis_pelanggaran: args.jenis_pelanggaran, poin: args.poin, tanggal: tStr, dicatat_oleh_id: caller.id });
      if (error) throw error; return { success: true };
    }
    case "insert_kesehatan": {
      const { error } = await supabase.from("kesehatan_santri").insert({ santri_nis: args.santri_nis, keluhan: args.keluhan, tindakan: args.tindakan, tanggal: tStr, dicatat_oleh_id: caller.id });
      if (error) throw error; return { success: true };
    }
    case "update_status_tagihan": {
      const updateData: any = { status: args.status_baru, updated_at: new Date().toISOString() };
      if (args.sisa_tagihan !== undefined) updateData.sisa_tagihan = args.sisa_tagihan;
      const { error } = await supabase.from("tagihan_santri").update(updateData).eq("id", args.tagihan_id);
      if (error) throw error; return { success: true };
    }
    case "topup_dompet": {
      const { data: ext } = await supabase.from("dompet_santri").select("saldo").eq("santri_nis", args.santri_nis).single();
      const nS = (Number(ext?.saldo) || 0) + Number(args.nominal);
      await supabase.from("dompet_santri").upsert({ santri_nis: args.santri_nis, saldo: nS }, { onConflict: "santri_nis" });
      await supabase.from("transaksi_dompet").insert({ santri_nis: args.santri_nis, jenis: "masuk", nominal: args.nominal, keterangan: "Top-up via AI", dicatat_oleh_id: caller.id });
      return { success: true, saldo_baru: nS };
    }
    case "kirim_notifikasi": {
      // Logic from push-notifications/SUPABASE_SETUP.txt
      const { data: santri } = await supabase.from("santri").select("wali_id").eq("nis", args.santri_nis).single();
      if (!santri?.wali_id) throw new Error("Wali tidak ditemukan untuk santri ini.");
      
      const { error } = await supabase.from("notification_queue").insert({
        user_id: santri.wali_id,
        title: args.title,
        body: args.body,
        data: { type: args.type || "general", nis: args.santri_nis },
        source_table: "ai_agent"
      });
      if (error) throw error; return { success: true, detail: "Notifikasi dimasukkan ke antrean." };
    }
    default: return { error: `Action tool '${toolName}' not implemented.` };
  }
}

function buildActionSummary(toolName: string, args: any): string {
  let summary = `**Aksi: ${toolName.replace(/_/g, " ").toUpperCase()}**\n\n`;
  for (const [key, value] of Object.entries(args)) {
    summary += `- **${key}**: ${typeof value === "object" ? JSON.stringify(value) : value}\n`;
  }
  return summary;
}

function buildSystemPrompt(caller: CallerProfile, toolNames: string[]) {
  return `Kamu adalah AI Agent Pesantren Al-Hasanah yang sangat cerdas dan takzim.
Nama User: ${caller.full_name}
Role User: ${caller.role} (Pastikan aksi sesuai dengan wewenang role ini)
Hari ini: ${today()}

TOOLS YANG TERSEDIA:
${toolNames.join(", ")}

ATURAN KERJA:
1. Selalu gunakan QUERY sebelum melakukan ACTION untuk memastikan data (seperti NIS santri) akurat.
2. Setiap ACTION (seperti insert, update, topup) WAJIB melalui konfirmasi user (HITL).
3. Berikan jawaban dalam Bahasa Indonesia yang formal dan sopan.
4. Jika user bertanya hal umum, jawab secara informatif berdasarkan data yang ada.
5. Jika data tidak ditemukan, informasikan dengan santun.
6. PENTING: Jika kamu memanggil tool, jangan memberikan asumsi hasil sebelum tool tersebut benar-benar dieksekusi.

STRUKTUR DATA:
- Santri diidentifikasi dengan 'nis' (String).
- Nominal uang selalu dalam integer (Rupiah).
- Tanggal gunakan format YYYY-MM-DD.`;
}

// ── MAIN HANDLER ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    return jsonResponse({ error: "Configuration Error: API Keys are missing in Edge Function secrets." }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { mode = "chat", userMessage, conversationHistory = [], actionToExecute, callerProfile } = body;
    
    if (!callerProfile?.id) return jsonResponse({ error: "Missing callerProfile" }, 401);
    const caller = callerProfile as CallerProfile;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── EXECUTE MODE (After User Approval) ────────────────────────
    if (mode === "execute") {
      const { toolName, args } = actionToExecute || {};
      try {
        const res = await executeActionTool(supabase, toolName, args, caller);
        
        // Add function response to history for multi-turn consistency
        const updatedHistory = [...conversationHistory, {
          role: "model",
          parts: [{ functionCall: { name: toolName, args } }]
        }, {
          role: "model", // In Gemini, tool results are often part of a specific flow
          parts: [{ functionResponse: { name: toolName, response: { content: res } } }]
        }];

        return jsonResponse({ ...res, toolName, updatedHistory });
      } catch (e: any) {
        return jsonResponse({ success: false, error: e.message, toolName }, 400);
      }
    }

    if (mode === "rejected") return jsonResponse({ message: "Aksi dibatalkan oleh pengguna." });

    // CHAT MODE (Gemini Core Loop)
    const rolePerms = ROLE_TOOL_PERMISSIONS[caller.role] || [];
    const availableTools = rolePerms.includes("*") ? ALL_TOOLS : ALL_TOOLS.filter(t => rolePerms.includes(t.name));
    const systemPrompt = buildSystemPrompt(caller, availableTools.map(t => t.name));

    let messages = [...conversationHistory];
    
    // Move system prompt to the beginning if history is empty, or as a prefix
    if (messages.length === 0) {
      messages.push({ role: "user", parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}\n\nUSER MESSAGE: ${userMessage || "Halo"}` }] });
    } else if (userMessage) {
      messages.push({ role: "user", parts: [{ text: userMessage }] });
    }

    let turnCount = 0;
    while (turnCount < 5) {
      turnCount++;
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages,
          tools: availableTools.length > 0 ? [{ function_declarations: availableTools }] : undefined,
          tool_config: { function_calling_config: { mode: "AUTO" } },
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });

      if (!geminiRes.ok) {
        const err = await geminiRes.json().catch(() => ({}));
        console.error("Gemini API Error:", JSON.stringify(err));
        return jsonResponse({ error: "Gemini API Error", detail: err.error?.message || "Unknown" }, 500);
      }

      const data = await geminiRes.json();
      const candidate = data.candidates?.[0]?.content;
      if (!candidate) return jsonResponse({ type: "text", answer: "Maaf, AI sedang tidak tersedia." });

      messages.push({ role: "model", parts: candidate.parts });
      const fnCallPart = candidate.parts.find((p: any) => p.functionCall);
      const textPart = candidate.parts.find((p: any) => p.text);

      if (fnCallPart) {
        const { name, args } = fnCallPart.functionCall;
        
        // Jika ACTION TOOL: Berhenti dan minta konfirmasi (HITL)
        if (ACTION_TOOLS.has(name)) {
          // Remove last model message (the call) from history before returning to avoid duplication when re-submitting
          // Wait, actually we NEED it in history for the NEXT turn.
          return jsonResponse({ 
            type: "action_required", 
            toolName: name, 
            args, 
            actionSummary: buildActionSummary(name, args), 
            aiPreMessage: textPart?.text, 
            updatedHistory: messages 
          });
        }
        
        // Jika QUERY TOOL: Eksekusi langsung dan lanjut turn berikutnya
        if (QUERY_TOOLS.has(name)) {
          try {
            const qRes = await executeQueryTool(supabase, name, args, caller);
            messages.push({
              role: "model", // Note: parts after functionCall in same turn
              parts: [{ functionResponse: { name, response: { content: qRes } } }]
            });
            // Continue loop to let Gemini analyze the query result
            continue;
          } catch (e: any) {
            messages.push({
              role: "model",
              parts: [{ functionResponse: { name, response: { content: { error: e.message } } } }]
            });
            continue;
          }
        }
      }

      // Jika hanya TEXT: Berikan jawaban akhir
      return jsonResponse({ type: "text", answer: textPart?.text || "Selesai.", updatedHistory: messages });
    }

    return jsonResponse({ type: "text", answer: "Terlalu banyak langkah eksekusi. Mohon persempit permintaan Anda.", updatedHistory: messages });

  } catch (e: any) {
    console.error("Global Agent Error:", e.message);
    return jsonResponse({ error: e.message }, 500);
  }
});
