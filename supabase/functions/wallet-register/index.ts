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
      .select("id, role, full_name, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.is_active || cleanText(profile.role).toLowerCase() !== "wali") {
      return json({ error: "Pembuatan dompet hanya boleh dilakukan oleh akun wali." }, 403);
    }

    const body = await req.json();
    const santriNis = cleanText(body.santri_nis);
    const deviceId = cleanText(body.device_id);
    const deviceName = cleanText(body.device_name);
    const publicKey = cleanText(body.public_key);
    const keyAlgorithm = cleanText(body.key_algorithm) || "Ed25519";

    if (!santriNis) throw new Error("santri_nis wajib diisi.");
    if (!deviceId || deviceId.length < 8) throw new Error("device_id tidak valid.");
    if (!publicKey || publicKey.length < 32) throw new Error("public_key tidak valid.");
    if (keyAlgorithm !== "Ed25519") throw new Error("Hanya key_algorithm Ed25519 yang didukung.");

    const { data: santri, error: santriError } = await service
      .from("santri")
      .select("nis, wali_id, nama, kelas, jurusan, status_santri")
      .eq("nis", santriNis)
      .eq("wali_id", profile.id)
      .maybeSingle();
    if (santriError) throw santriError;
    if (!santri) return json({ error: "Santri tidak terhubung dengan wali ini." }, 403);
    if (santri.status_santri !== "AKTIF") return json({ error: "Dompet hanya bisa dibuat untuk santri aktif." }, 400);

    const { data: wallet, error: walletError } = await service.rpc("wallet_create_account", {
      p_santri_nis: santriNis,
      p_actor_id: profile.id,
      p_actor_role: "wali",
    });
    if (walletError) throw walletError;

    const { data: existingDevice, error: deviceLookupError } = await service
      .from("wallet_devices")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (deviceLookupError) throw deviceLookupError;

    if (existingDevice?.id) {
      const { error } = await service
        .from("wallet_devices")
        .update({
          santri_nis: santriNis,
          device_name: deviceName || null,
          public_key: publicKey,
          key_algorithm: keyAlgorithm,
          status: "active",
          last_seen_at: new Date().toISOString(),
          revoked_at: null,
        })
        .eq("id", existingDevice.id);
      if (error) throw error;
    } else {
      const { error } = await service.from("wallet_devices").insert({
        profile_id: profile.id,
        santri_nis: santriNis,
        device_id: deviceId,
        device_name: deviceName || null,
        public_key: publicKey,
        key_algorithm: keyAlgorithm,
        status: "active",
        last_seen_at: new Date().toISOString(),
      });
      if (error) throw error;
    }

    const walletPublicId = wallet?.wallet_public_id;
    if (walletPublicId) {
      const { data: activeToken } = await service
        .from("wallet_card_tokens")
        .select("token_public_id")
        .eq("santri_nis", santriNis)
        .eq("wallet_public_id", walletPublicId)
        .eq("status", "active")
        .in("media", ["qr", "both"])
        .maybeSingle();

      if (!activeToken) {
        await service.from("wallet_card_tokens").insert({
          santri_nis: santriNis,
          wallet_public_id: walletPublicId,
          media: "qr",
          status: "active",
          issued_by: profile.id,
          metadata: { source: "wallet-register" },
        });
      }
    }

    return json({
      data: {
        wallet,
        santri,
        device: { device_id: deviceId, key_algorithm: keyAlgorithm, status: "active" },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet register failed.";
    return json({ error: message }, 400);
  }
});
