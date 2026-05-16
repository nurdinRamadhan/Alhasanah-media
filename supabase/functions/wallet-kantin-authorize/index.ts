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
const optionalUuid = (value: unknown) => {
  const text = cleanText(value);
  return text.length > 0 ? text : null;
};

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
      return json({ error: "Authorization session kantin hanya boleh dibuat oleh role kantin." }, 403);
    }

    const body = await req.json();
    const walletPublicId = parseQrPayload(body.wallet_public_id ?? body.qr_payload ?? body.nfc_payload);
    const amount = Number(body.amount);
    const merchantId = optionalUuid(body.merchant_id);
    const outletId = optionalUuid(body.outlet_id);
    const media = cleanText(body.media) || "qr";
    const idempotencyKey = cleanText(body.idempotency_key) || `kantin:${profile.id}:${crypto.randomUUID()}`;
    const deviceId = cleanText(body.device_id);
    const deviceSignature = cleanText(body.device_signature);
    const deviceNonce = cleanText(body.device_nonce);
    const signatureEncoding = cleanText(body.signature_encoding) || "base64";
    const publicKeyEncoding = cleanText(body.public_key_encoding) || "base64";

    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Nominal harus bilangan bulat lebih dari 0.");
    if (!["qr", "nfc"].includes(media)) throw new Error("Media harus qr atau nfc.");
    if (!deviceId) throw new Error("device_id kantin wajib dikirim.");
    if (!deviceSignature) throw new Error("device_signature kantin wajib dikirim.");
    if (!deviceNonce || deviceNonce.length < 12) throw new Error("device_nonce kantin wajib kuat dan unik.");

    const { data: kantinDevice, error: deviceError } = await service
      .from("kantin_devices")
      .select("id, device_id, public_key, status")
      .eq("kantin_user_id", profile.id)
      .eq("device_id", deviceId)
      .eq("status", "active")
      .maybeSingle();

    if (deviceError) throw deviceError;
    if (!kantinDevice) return json({ error: "Perangkat kantin belum terdaftar atau belum aktif." }, 403);

    const signedMessage = [
      "DOMPET_SANTRI_KANTIN_AUTHORIZE_V1",
      walletPublicId,
      String(amount),
      profile.id,
      deviceId,
      idempotencyKey,
      media,
      merchantId ?? "",
      outletId ?? "",
      deviceNonce,
    ].join("\n");

    const isValidSignature = nacl.sign.detached.verify(
      new TextEncoder().encode(signedMessage),
      decodeBytes(deviceSignature, signatureEncoding),
      decodeBytes(kantinDevice.public_key, publicKeyEncoding),
    );

    if (!isValidSignature) return json({ error: "Signature perangkat kantin tidak valid." }, 403);

    const { data, error } = await service.rpc("wallet_create_kantin_authorization_session", {
      p_wallet_public_id: walletPublicId,
      p_amount: amount,
      p_kantin_user_id: profile.id,
      p_merchant_id: merchantId,
      p_outlet_id: outletId,
      p_idempotency_key: idempotencyKey,
      p_metadata: {
        source: "wallet-kantin-authorize",
        media,
        kantin_device_id: deviceId,
        kantin_device_public_key: kantinDevice.public_key,
        kantin_device_nonce: deviceNonce,
        kantin_device_signature: deviceSignature,
        user_agent: req.headers.get("User-Agent"),
      },
    });
    if (error) throw error;

    return json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet kantin authorization failed.";
    return json({ error: message }, 400);
  }
});
