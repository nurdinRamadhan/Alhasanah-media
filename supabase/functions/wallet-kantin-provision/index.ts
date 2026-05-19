import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedRoles = new Set(["super_admin", "rois", "bendahara"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanText = (value: unknown) => String(value ?? "").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment is not configured.");
    if (!token) return json({ error: "Sesi login tidak valid." }, 401);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Sesi login tidak valid." }, 401);

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const role = cleanText(profile?.role).toLowerCase();
    if (!profile?.is_active || !allowedRoles.has(role)) {
      return json({ error: "Hanya super admin, rois, atau bendahara yang boleh menyiapkan akses kantin." }, 403);
    }

    const body = await req.json();
    const kantinUserId = cleanText(body.kantin_user_id);
    const merchantId = cleanText(body.merchant_id) || null;
    const outletId = cleanText(body.outlet_id) || null;
    const reason = cleanText(body.reason) || "Provisioning otomatis kantin";

    if (!kantinUserId) throw new Error("Akun kantin wajib dipilih.");

    const { data, error } = await service.rpc("wallet_ensure_kantin_ready", {
      p_kantin_user_id: kantinUserId,
      p_actor_id: profile.id,
      p_reason: reason,
      p_merchant_id: merchantId,
      p_outlet_id: outletId,
    });

    if (error) throw error;

    return json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provisioning kantin gagal diproses.";
    return json({ error: message }, 400);
  }
});
