import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment is not configured.");
    if (!token) return jsonResponse({ error: "Authorization token wajib dikirim." }, 401);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Token tidak valid." }, 401);
    }

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.is_active) return jsonResponse({ error: "Akun tidak aktif." }, 403);
    const role = String(profile.role || "").toLowerCase();
    if (!["super_admin", "bendahara", "rois"].includes(role)) {
      return jsonResponse({ error: "Anda tidak berwenang mencatat pembayaran tagihan." }, 403);
    }

    const body = await req.json();
    const tagihanId = String(body.tagihan_id || "");
    const amount = Math.round(Number(body.amount || 0));
    const metodePembayaran = String(body.metode_pembayaran || "cash");
    const keterangan = body.keterangan ? String(body.keterangan) : null;

    if (!tagihanId) return jsonResponse({ error: "Tagihan wajib dipilih." }, 400);
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "Nominal pembayaran tidak valid." }, 400);
    }

    const { data, error } = await service.rpc("record_tagihan_payment", {
      p_tagihan_id: tagihanId,
      p_amount: amount,
      p_metode_pembayaran: metodePembayaran,
      p_source: "admin_panel",
      p_keterangan: keterangan,
      p_idempotency_key: `admin-tagihan:${tagihanId}:${userData.user.id}:${Date.now()}`,
      p_recorded_by: userData.user.id,
    });

    if (error) throw error;

    return jsonResponse({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mencatat pembayaran.";
    console.error("[TAGIHAN_PAYMENT_RECORD]", message);
    return jsonResponse({ error: message }, 400);
  }
});
