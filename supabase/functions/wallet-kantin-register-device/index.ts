import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment is not configured.");
    if (!token) return json({ error: "Authorization token wajib dikirim." }, 401);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Token tidak valid." }, 401);

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.is_active || cleanText(profile.role).toLowerCase() !== "kantin") {
      return json({ error: "Registrasi perangkat hanya untuk akun kantin aktif." }, 403);
    }

    const body = await req.json();
    const deviceId = cleanText(body.device_id);
    const deviceFingerprint = cleanText(body.device_fingerprint);
    const publicKey = cleanText(body.public_key);

    if (deviceId.length < 8) throw new Error("device_id tidak valid.");
    if (deviceFingerprint.length < 8) throw new Error("fingerprint perangkat tidak valid.");
    if (publicKey.length < 32) throw new Error("public_key perangkat tidak valid.");

    const { data, error } = await service.rpc("wallet_register_kantin_device", {
      p_kantin_user_id: profile.id,
      p_device_id: deviceId,
      p_device_fingerprint: deviceFingerprint,
      p_public_key: publicKey,
      p_registered_by: profile.id,
      p_metadata: {
        source: "wallet-kantin-register-device",
        user_agent: req.headers.get("User-Agent"),
      },
    });
    if (error) throw error;

    return json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registrasi perangkat kantin gagal.";
    return json({ error: message }, 400);
  }
});
