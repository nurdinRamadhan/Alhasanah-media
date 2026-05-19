import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

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

const decodeBytes = (value: string, encoding = "base64") => {
  if (encoding === "hex") {
    if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2 !== 0) throw new Error("Encoding hex tidak valid.");
    return new Uint8Array(value.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)));
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const parseQrPayload = (value: unknown) => {
  const raw = cleanText(value);
  if (!raw) throw new Error("Payload QR/NFC wajib diisi.");
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type !== "santri_wallet_card") throw new Error("Tipe QR tidak didukung.");
    const walletPublicId = cleanText(parsed.wallet_public_id);
    if (!walletPublicId) throw new Error("wallet_public_id tidak ada di payload.");
    return walletPublicId;
  } catch {
    if (raw.startsWith("{")) throw new Error("Payload QR/NFC tidak valid.");
    return raw;
  }
};

const canonicalMessage = (params: {
  walletPublicId: string;
  profileId: string;
  deviceId: string;
  deviceNonce: string;
}) =>
  [
    "DOMPET_SANTRI_KANTIN_CARD_LOOKUP_V1",
    params.walletPublicId,
    params.profileId,
    params.deviceId,
    params.deviceNonce,
  ].join("\n");

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
      return json({ error: "Lookup kartu hanya boleh dilakukan oleh akun kantin aktif." }, 403);
    }

    const body = await req.json();
    const walletPublicId = parseQrPayload(body.wallet_public_id ?? body.qr_payload ?? body.nfc_payload);
    const deviceId = cleanText(body.device_id);
    const deviceSignature = cleanText(body.device_signature);
    const deviceNonce = cleanText(body.device_nonce);
    const signatureEncoding = cleanText(body.signature_encoding) || "base64";
    const publicKeyEncoding = cleanText(body.public_key_encoding) || "base64";

    if (!deviceId) throw new Error("device_id kantin wajib dikirim.");
    if (!deviceSignature) throw new Error("device_signature kantin wajib dikirim.");
    if (!deviceNonce || deviceNonce.length < 12) throw new Error("device_nonce kantin wajib kuat dan unik.");

    const { data: kantinDevice, error: deviceError } = await service
      .from("kantin_devices")
      .select("public_key")
      .eq("kantin_user_id", profile.id)
      .eq("device_id", deviceId)
      .eq("status", "active")
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!kantinDevice) return json({ error: "Perangkat kantin belum terdaftar atau belum aktif." }, 403);

    const isValidSignature = nacl.sign.detached.verify(
      new TextEncoder().encode(canonicalMessage({ walletPublicId, profileId: profile.id, deviceId, deviceNonce })),
      decodeBytes(deviceSignature, signatureEncoding),
      decodeBytes(kantinDevice.public_key, publicKeyEncoding),
    );
    if (!isValidSignature) return json({ error: "Signature perangkat kantin tidak valid." }, 403);

    const { data: assignment, error: assignmentError } = await service
      .from("wallet_merchant_users")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) return json({ error: "Akun kantin belum siap. Minta admin menekan Siapkan Otomatis." }, 403);

    const { data: wallet, error: walletError } = await service
      .from("dompet_santri")
      .select("wallet_public_id,status,santri(nama,kelas,jurusan,status_santri)")
      .eq("wallet_public_id", walletPublicId)
      .maybeSingle();
    if (walletError) throw walletError;
    if (!wallet) return json({ error: "Kartu dompet santri tidak dikenali." }, 404);

    const santri = wallet.santri as {
      nama?: string | null;
      kelas?: string | null;
      jurusan?: string | null;
      status_santri?: string | null;
    } | null;

    await service.from("wallet_audit_logs").insert({
      actor_id: profile.id,
      actor_role: "kantin",
      action: "wallet_kantin_card_lookup",
      resource: "dompet_santri",
      record_id: walletPublicId,
      metadata: { device_id: deviceId },
    });

    return json({
      data: {
        wallet_public_id: wallet.wallet_public_id,
        student_name: santri?.nama ?? "Santri",
        student_class: santri?.kelas ?? null,
        student_major: santri?.jurusan ?? null,
        wallet_status: wallet.status,
        student_status: santri?.status_santri ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup kartu kantin gagal.";
    return json({ error: message }, 400);
  }
});
