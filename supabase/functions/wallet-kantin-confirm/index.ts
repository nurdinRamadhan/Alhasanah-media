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

const decodeBase64 = (value: string) => {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const decodeHex = (value: string) => {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    throw new Error("Hex payload tidak valid.");
  }
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const decodeBytes = (value: string, encoding = "base64") => {
  if (encoding === "hex") return decodeHex(value);
  if (encoding === "base64" || encoding === "base64url") return decodeBase64(value);
  throw new Error("Encoding signature/public key tidak didukung.");
};

const canonicalMessage = (input: {
  authorizationSessionId: string;
  paymentIntentId: string;
  santriNis: string;
  amount: number;
  challenge: string;
  nonce: string;
  expiresAt: string;
}) => [
  "DOMPET_SANTRI_KANTIN_V1",
  input.authorizationSessionId,
  input.paymentIntentId,
  input.santriNis,
  String(input.amount),
  input.challenge,
  input.nonce,
  input.expiresAt,
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
    if (!profile?.is_active || cleanText(profile.role).toLowerCase() !== "wali") {
      return json({ error: "Konfirmasi pembayaran kantin harus dilakukan oleh wali yang sah." }, 403);
    }

    const body = await req.json();
    const authorizationSessionId = cleanText(body.authorization_session_id);
    const deviceId = cleanText(body.device_id);
    const signature = cleanText(body.signature);
    const signatureEncoding = cleanText(body.signature_encoding ?? body.encoding) || "base64";
    const publicKeyEncoding = cleanText(body.public_key_encoding ?? body.encoding) || "base64";

    if (!authorizationSessionId) throw new Error("authorization_session_id wajib diisi.");
    if (!deviceId) throw new Error("device_id wajib diisi.");
    if (!signature) throw new Error("signature wajib diisi.");

    const { data: session, error: sessionError } = await service
      .from("wallet_authorization_sessions")
      .select("id,payment_intent_id,santri_nis,amount,status,challenge,nonce,expires_at,kantin_user_id,merchant_id,outlet_id")
      .eq("id", authorizationSessionId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return json({ error: "Authorization session tidak ditemukan." }, 404);
    if (!["requires_authorization", "authorized"].includes(session.status)) {
      return json({ error: "Authorization session tidak bisa dikonfirmasi." }, 400);
    }

    const { data: santri, error: santriError } = await service
      .from("santri")
      .select("nis,wali_id")
      .eq("nis", session.santri_nis)
      .eq("wali_id", profile.id)
      .maybeSingle();
    if (santriError) throw santriError;
    if (!santri) return json({ error: "Santri tidak terhubung dengan wali ini." }, 403);

    const { data: device, error: deviceError } = await service
      .from("wallet_devices")
      .select("device_id,public_key,key_algorithm,status")
      .eq("profile_id", profile.id)
      .eq("santri_nis", session.santri_nis)
      .eq("device_id", deviceId)
      .eq("status", "active")
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!device) return json({ error: "Device tidak aktif untuk dompet santri ini." }, 403);
    if (device.key_algorithm !== "Ed25519") throw new Error("Device key algorithm tidak didukung.");

    const signedMessage = canonicalMessage({
      authorizationSessionId: session.id,
      paymentIntentId: session.payment_intent_id,
      santriNis: session.santri_nis,
      amount: Number(session.amount),
      challenge: session.challenge,
      nonce: session.nonce,
      expiresAt: session.expires_at,
    });

    const messageBytes = new TextEncoder().encode(signedMessage);
    const signatureBytes = decodeBytes(signature, signatureEncoding);
    const publicKeyBytes = decodeBytes(device.public_key, publicKeyEncoding);

    if (publicKeyBytes.length !== nacl.sign.publicKeyLength) {
      throw new Error("Public key Ed25519 harus 32 byte.");
    }
    if (signatureBytes.length !== nacl.sign.signatureLength) {
      throw new Error("Signature Ed25519 harus 64 byte.");
    }

    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!verified) return json({ error: "Signature transaksi tidak valid." }, 403);

    const { data, error } = await service.rpc("wallet_confirm_kantin_payment", {
      p_authorization_session_id: authorizationSessionId,
      p_approved_by: profile.id,
      p_approved_device_id: deviceId,
      p_signature: signature,
      p_signature_public_key: device.public_key,
      p_idempotency_key: `wallet-kantin-confirm:${authorizationSessionId}`,
      p_metadata: {
        source: "wallet-kantin-confirm",
        signer_role: "wali",
        signed_message: signedMessage,
      },
    });
    if (error) throw error;

    return json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet kantin confirm failed.";
    return json({ error: message }, 400);
  }
});
