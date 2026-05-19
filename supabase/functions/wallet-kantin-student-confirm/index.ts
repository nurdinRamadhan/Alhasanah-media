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

const canonicalMessage = (input: {
  authorizationSessionId: string;
  paymentIntentId: string;
  santriNis: string;
  amount: number;
  challenge: string;
  nonce: string;
  expiresAt: string;
  deviceId: string;
}) => [
  "DOMPET_SANTRI_STUDENT_PIN_V1",
  input.authorizationSessionId,
  input.paymentIntentId,
  input.santriNis,
  String(input.amount),
  input.challenge,
  input.nonce,
  input.expiresAt,
  input.deviceId,
].join("\n");

const decodeBase64 = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const encodeHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

const constantTimeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

const hmacSha256 = async (keyBase64: string, message: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    decodeBase64(keyBase64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
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
      return json({ error: "Konfirmasi PIN santri hanya boleh dilakukan oleh kantin." }, 403);
    }

    const body = await req.json();
    const authorizationSessionId = cleanText(body.authorization_session_id);
    const deviceId = cleanText(body.device_id);
    const pinProof = cleanText(body.pin_proof);
    const idempotencyKey = cleanText(body.idempotency_key) || `wallet-kantin-student-confirm:${authorizationSessionId}`;

    if (!authorizationSessionId) throw new Error("authorization_session_id wajib diisi.");
    if (!deviceId) throw new Error("device_id kantin wajib diisi.");
    if (!pinProof || pinProof.length < 32) throw new Error("PIN proof tidak valid.");

    const { data: kantinDevice, error: deviceError } = await service
      .from("kantin_devices")
      .select("id, device_id, status")
      .eq("kantin_user_id", profile.id)
      .eq("device_id", deviceId)
      .eq("status", "active")
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!kantinDevice) return json({ error: "Perangkat kantin belum aktif." }, 403);

    const { data: session, error: sessionError } = await service
      .from("wallet_authorization_sessions")
      .select("id,payment_intent_id,santri_nis,amount,status,challenge,nonce,expires_at,kantin_user_id")
      .eq("id", authorizationSessionId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return json({ error: "Authorization session tidak ditemukan." }, 404);
    if (session.kantin_user_id !== profile.id) return json({ error: "Session bukan milik kantin ini." }, 403);

    const { data: wallet, error: walletError } = await service
      .from("dompet_santri")
      .select("student_pin_verifier, student_pin_version")
      .eq("santri_nis", session.santri_nis)
      .maybeSingle();
    if (walletError) throw walletError;
    if (!wallet?.student_pin_verifier) return json({ error: "PIN dompet santri belum aktif." }, 400);

    const message = canonicalMessage({
      authorizationSessionId: session.id,
      paymentIntentId: session.payment_intent_id,
      santriNis: session.santri_nis,
      amount: Number(session.amount),
      challenge: session.challenge,
      nonce: session.nonce ?? "",
      expiresAt: session.expires_at,
      deviceId,
    });

    const expected = await hmacSha256(wallet.student_pin_verifier, message);
    const provided = decodeBase64(pinProof);
    if (!constantTimeEqual(expected, provided)) {
      await service.rpc("wallet_record_pin_failure", {
        p_santri_nis: session.santri_nis,
        p_actor_id: profile.id,
        p_actor_role: "kantin",
        p_device_id: deviceId,
        p_metadata: { source: "wallet-kantin-student-confirm", authorization_session_id: session.id },
      });
      return json({ error: "PIN tidak sesuai." }, 403);
    }

    const proofDigest = encodeHex(await crypto.subtle.digest("SHA-256", provided));
    const { data, error } = await service.rpc("wallet_confirm_kantin_student_payment", {
      p_authorization_session_id: authorizationSessionId,
      p_student_proof_reference: `pin-proof:v${wallet.student_pin_version}:${proofDigest.slice(0, 32)}`,
      p_idempotency_key: idempotencyKey,
      p_metadata: {
        source: "wallet-kantin-student-confirm",
        kantin_device_id: deviceId,
        proof_algorithm: "Argon2id+HMAC-SHA256",
      },
    });
    if (error) throw error;

    return json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet student confirmation failed.";
    return json({ error: message }, 400);
  }
});
