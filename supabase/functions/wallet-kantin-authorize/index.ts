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

const canonicalMessage = (params: {
  walletPublicId: string;
  amount: number;
  profileId: string;
  deviceId: string;
  idempotencyKey: string;
  media: string;
  merchantId: string | null;
  outletId: string | null;
  deviceNonce: string;
}) =>
  [
    "DOMPET_SANTRI_KANTIN_AUTHORIZE_V1",
    params.walletPublicId,
    String(params.amount),
    params.profileId,
    params.deviceId,
    params.idempotencyKey,
    params.media,
    params.merchantId ?? "",
    params.outletId ?? "",
    params.deviceNonce,
  ].join("\n");

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

const classifyError = (message: string) => {
  const lower = message.toLowerCase();
  if (!message || lower === "wallet kantin authorization failed.") {
    return {
      code: "KANTIN_AUTHORIZATION_FAILED",
      message: "Transaksi kantin belum bisa diproses. Coba ulang, lalu hubungi admin jika masih gagal.",
      status: 400,
    };
  }
  if (lower.includes("single transaction limit")) {
    return {
      code: "LIMIT_SINGLE_TRANSACTION",
      message: "Nominal transaksi melebihi batas per transaksi yang diatur wali santri.",
      status: 400,
    };
  }
  if (lower.includes("wallet transactions are frozen")) {
    return {
      code: "WALLET_SYSTEM_FROZEN",
      message: "Transaksi dompet sedang dibekukan oleh sistem.",
      status: 423,
    };
  }
  if (lower.includes("wallet qr/nfc token not found")) {
    return { code: "WALLET_CARD_NOT_FOUND", message: "QR/NFC dompet tidak ditemukan.", status: 404 };
  }
  if (lower.includes("wallet account is not active")) {
    return { code: "WALLET_NOT_ACTIVE", message: "Dompet santri tidak aktif.", status: 403 };
  }
  if (lower.includes("assigned to this merchant")) {
    return {
      code: "KANTIN_MERCHANT_ASSIGNMENT_INVALID",
      message: "Akun kantin belum dihubungkan ke merchant/outlet ini.",
      status: 403,
    };
  }
  return { code: "KANTIN_AUTHORIZATION_FAILED", message, status: 400 };
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : "";
    const details = typeof record.details === "string" ? record.details : "";
    const hint = typeof record.hint === "string" ? record.hint : "";
    return [message, details, hint].filter(Boolean).join(" | ");
  }
  return "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let service: ReturnType<typeof createClient> | null = null;
  let profileId: string | null = null;
  let profileRole: string | null = null;
  let walletPublicIdForLog: string | null = null;
  let amountForLog: number | null = null;
  let deviceIdForLog: string | null = null;
  let merchantIdForLog: string | null = null;
  let outletIdForLog: string | null = null;

  const auditFailure = async (code: string, message: string, extra: Record<string, unknown> = {}) => {
    if (!service || !profileId) return;
    await service.from("wallet_audit_logs").insert({
      actor_id: profileId,
      actor_role: profileRole ?? "kantin",
      action: "wallet_kantin_authorize_failed",
      resource: "wallet-kantin-authorize",
      record_id: walletPublicIdForLog,
      metadata: {
        code,
        message,
        amount: amountForLog,
        device_id: deviceIdForLog,
        merchant_id: merchantIdForLog,
        outlet_id: outletIdForLog,
        ...extra,
      },
    });
  };

  const riskFailure = async (
    severity: "low" | "medium" | "high" | "critical",
    ruleCode: string,
    action: "log" | "alert" | "block" | "freeze" | "require_parent_approval",
    details: Record<string, unknown> = {},
  ) => {
    if (!service || !profileId) return;
    await service.from("wallet_risk_events").insert({
      severity,
      actor_id: profileId,
      device_id: deviceIdForLog,
      merchant_id: merchantIdForLog,
      outlet_id: outletIdForLog,
      rule_code: ruleCode,
      score: severity === "critical" ? 100 : severity === "high" ? 80 : severity === "medium" ? 50 : 20,
      action,
      details: {
        wallet_public_id: walletPublicIdForLog,
        amount: amountForLog,
        source: "wallet-kantin-authorize",
        ...details,
      },
    });
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment is not configured.");
    if (!token) return json({ error: "Authorization token wajib dikirim." }, 401);

    service = createClient(supabaseUrl, serviceKey, {
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
    profileId = profile?.id ?? null;
    profileRole = cleanText(profile?.role).toLowerCase();
    if (!profile?.is_active || cleanText(profile.role).toLowerCase() !== "kantin") {
      await auditFailure("KANTIN_ROLE_FORBIDDEN", "Authorization session kantin hanya boleh dibuat oleh role kantin.");
      return json(
        {
          code: "KANTIN_ROLE_FORBIDDEN",
          error: "Authorization session kantin hanya boleh dibuat oleh role kantin.",
        },
        403,
      );
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

    walletPublicIdForLog = walletPublicId;
    amountForLog = Number.isFinite(amount) ? amount : null;
    deviceIdForLog = deviceId || null;
    merchantIdForLog = merchantId;
    outletIdForLog = outletId;

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
    if (!kantinDevice) {
      await riskFailure("critical", "KANTIN_DEVICE_NOT_ACTIVE", "block");
      await auditFailure("KANTIN_DEVICE_NOT_ACTIVE", "Perangkat kantin belum terdaftar atau belum aktif.");
      return json({ code: "KANTIN_DEVICE_NOT_ACTIVE", error: "Perangkat kantin belum terdaftar atau belum aktif." }, 403);
    }

    const signatureBytes = decodeBytes(deviceSignature, signatureEncoding);
    const publicKeyBytes = decodeBytes(kantinDevice.public_key, publicKeyEncoding);
    const verify = (signedMerchantId: string | null, signedOutletId: string | null) =>
      nacl.sign.detached.verify(
        new TextEncoder().encode(
          canonicalMessage({
            walletPublicId,
            amount,
            profileId: profile.id,
            deviceId,
            idempotencyKey,
            media,
            merchantId: signedMerchantId,
            outletId: signedOutletId,
            deviceNonce,
          }),
        ),
        signatureBytes,
        publicKeyBytes,
      );

    let effectiveMerchantId = merchantId;
    let effectiveOutletId = outletId;
    let signatureMode = "strict";
    let isValidSignature = verify(merchantId, outletId);

    if (!isValidSignature && (merchantId || outletId) && verify(null, null)) {
      signatureMode = "compat_blank_merchant_outlet";
      isValidSignature = true;
      await auditFailure("KANTIN_SIGNATURE_COMPAT_MODE", "Signature perangkat valid memakai format lama tanpa merchant/outlet.", {
        requested_merchant_id: merchantId,
        requested_outlet_id: outletId,
      });
    }

    if (!isValidSignature) {
      await riskFailure("critical", "KANTIN_DEVICE_SIGNATURE_INVALID", "block", {
        signature_encoding: signatureEncoding,
        signature_length: deviceSignature.length,
        device_nonce_length: deviceNonce.length,
        has_merchant_id: Boolean(merchantId),
        has_outlet_id: Boolean(outletId),
      });
      await auditFailure("KANTIN_DEVICE_SIGNATURE_INVALID", "Signature perangkat kantin tidak valid.", {
        signature_encoding: signatureEncoding,
        signature_length: deviceSignature.length,
        device_nonce_length: deviceNonce.length,
        has_merchant_id: Boolean(merchantId),
        has_outlet_id: Boolean(outletId),
      });
      return json({ code: "KANTIN_DEVICE_SIGNATURE_INVALID", error: "Signature perangkat kantin tidak valid." }, 403);
    }

    if (!effectiveMerchantId) {
      const { data: assignments, error: assignmentError } = await service
        .from("wallet_merchant_users")
        .select("merchant_id, outlet_id, wallet_merchants!inner(status), wallet_merchant_outlets(status)")
        .eq("profile_id", profile.id)
        .eq("status", "active")
        .eq("wallet_merchants.status", "active");
      if (assignmentError) throw assignmentError;

      const activeAssignments = (assignments ?? []).filter((assignment) => {
        const outlet = assignment.wallet_merchant_outlets as { status?: string } | null;
        return !assignment.outlet_id || outlet?.status === "active";
      });

      if (activeAssignments.length === 1) {
        effectiveMerchantId = activeAssignments[0].merchant_id;
        effectiveOutletId = activeAssignments[0].outlet_id;
        merchantIdForLog = effectiveMerchantId;
        outletIdForLog = effectiveOutletId;
      } else if (activeAssignments.length === 0) {
        await auditFailure("KANTIN_MERCHANT_ASSIGNMENT_MISSING", "Akun kantin belum punya merchant/outlet aktif.");
        return json(
          { code: "KANTIN_MERCHANT_ASSIGNMENT_MISSING", error: "Akun kantin belum punya merchant/outlet aktif." },
          403,
        );
      } else {
        await auditFailure(
          "KANTIN_MERCHANT_SELECTION_REQUIRED",
          "Akun kantin memiliki lebih dari satu merchant/outlet aktif, aplikasi wajib mengirim merchant_id dan outlet_id.",
        );
        return json(
          {
            code: "KANTIN_MERCHANT_SELECTION_REQUIRED",
            error: "Akun kantin memiliki lebih dari satu merchant/outlet aktif. Pilih merchant/outlet dari aplikasi kantin.",
          },
          400,
        );
      }
    }

    const { data, error } = await service.rpc("wallet_create_kantin_authorization_session", {
      p_wallet_public_id: walletPublicId,
      p_amount: amount,
      p_kantin_user_id: profile.id,
      p_merchant_id: effectiveMerchantId,
      p_outlet_id: effectiveOutletId,
      p_idempotency_key: idempotencyKey,
      p_metadata: {
        source: "wallet-kantin-authorize",
        media,
        signature_mode: signatureMode,
        kantin_device_id: deviceId,
        kantin_device_public_key: kantinDevice.public_key,
        kantin_device_nonce: deviceNonce,
        kantin_device_signature: deviceSignature,
        user_agent: req.headers.get("User-Agent"),
      },
    });
    if (error) throw error;

    if (data?.authorization_mode === "student_pin" && data?.santri_nis) {
      const { data: walletPin, error: pinError } = await service
        .from("dompet_santri")
        .select("student_pin_salt, student_pin_kdf, student_pin_version")
        .eq("santri_nis", data.santri_nis)
        .maybeSingle();
      if (pinError) throw pinError;
      if (!walletPin?.student_pin_salt) {
        return json({ code: "STUDENT_PIN_NOT_ACTIVE", error: "PIN dompet santri belum dibuat oleh wali." }, 400);
      }
      data.pin_kdf = {
        salt: walletPin.student_pin_salt,
        version: walletPin.student_pin_version,
        ...(walletPin.student_pin_kdf ?? {}),
      };
    }

    return json({ data });
  } catch (error) {
    const message = getErrorMessage(error) || "Wallet kantin authorization failed.";
    const classified = classifyError(message);
    await auditFailure(classified.code, classified.message, { raw_error: message });
    if (["KANTIN_MERCHANT_ASSIGNMENT_INVALID", "WALLET_SYSTEM_FROZEN"].includes(classified.code)) {
      await riskFailure("high", classified.code, "block", { raw_error: message });
    }
    return json({ code: classified.code, error: classified.message }, classified.status);
  }
});
