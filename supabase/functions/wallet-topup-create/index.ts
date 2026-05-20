import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

function cleanAmount(value: unknown): number {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount < 10_000) {
    throw new Error("Nominal top up minimal Rp10.000.");
  }
  if (amount > 5_000_000) {
    throw new Error("Nominal top up terlalu besar. Hubungi bendahara pesantren.");
  }
  return amount;
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

type MethodSpec = { code: string; label: string; paymentType: string; bank?: string; store?: string };

const METHODS: Record<string, MethodSpec> = {
  qris: { code: "qris", label: "QRIS", paymentType: "qris" },
  gopay: { code: "gopay", label: "GoPay", paymentType: "gopay" },
  bca_va: { code: "bca_va", label: "BCA Virtual Account", paymentType: "bank_transfer", bank: "bca" },
  bni_va: { code: "bni_va", label: "BNI Virtual Account", paymentType: "bank_transfer", bank: "bni" },
  bri_va: { code: "bri_va", label: "BRI Virtual Account", paymentType: "bank_transfer", bank: "bri" },
  permata_va: { code: "permata_va", label: "Permata Virtual Account", paymentType: "bank_transfer", bank: "permata" },
  mandiri_bill: { code: "mandiri_bill", label: "Mandiri Bill Payment", paymentType: "echannel" },
  alfamart: { code: "alfamart", label: "Alfamart", paymentType: "cstore", store: "alfamart" },
  indomaret: { code: "indomaret", label: "Indomaret", paymentType: "cstore", store: "indomaret" },
};

function pickActionUrl(data: Record<string, unknown>, actionName: string): string | null {
  const actions = Array.isArray(data.actions) ? data.actions as Record<string, unknown>[] : [];
  const action = actions.find((item) => cleanText(item.name) === actionName);
  return action ? cleanText(action.url) || null : null;
}

function normalizeCoreResponse(data: Record<string, unknown>, method: MethodSpec, amount: number) {
  const vaNumbers = Array.isArray(data.va_numbers) ? data.va_numbers as Record<string, unknown>[] : [];
  const firstVa = vaNumbers[0] ?? {};
  const qrUrl = pickActionUrl(data, "generate-qr-code") ?? pickActionUrl(data, "generate-qr-code-v2");
  const deeplinkUrl = pickActionUrl(data, "deeplink-redirect") ?? pickActionUrl(data, "mobile_deeplink_redirect");
  return {
    order_id: cleanText(data.order_id),
    transaction_id: cleanText(data.transaction_id) || null,
    payment_type: cleanText(data.payment_type) || method.paymentType,
    method_code: method.code,
    method_label: method.label,
    amount,
    status: cleanText(data.transaction_status) || "pending",
    expires_at: cleanText(data.expiry_time) || null,
    qr_url: qrUrl,
    deeplink_url: deeplinkUrl,
    va_number: cleanText(firstVa.va_number) || null,
    bank: cleanText(firstVa.bank || method.bank) || null,
    biller_code: cleanText(data.biller_code) || null,
    bill_key: cleanText(data.bill_key) || null,
    permata_va_number: cleanText(data.permata_va_number) || null,
    payment_code: cleanText(data.payment_code) || null,
    store: cleanText(data.store || method.store) || null,
  };
}

function buildChargePayload(method: MethodSpec, orderId: string, amount: number, profile: Record<string, unknown>, santri: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    payment_type: method.paymentType,
    transaction_details: { order_id: orderId, gross_amount: amount },
    customer_details: {
      first_name: profile.full_name || "Wali Santri",
      email: profile.email || "wali@alhasanah.local",
      phone: profile.no_hp || undefined,
    },
    item_details: [{
      id: "DOMPET-SANTRI-TOPUP",
      name: `Top Up Dompet Santri ${santri.nama || santri.nis}`,
      price: amount,
      quantity: 1,
    }],
  };
  if (method.paymentType === "bank_transfer") payload.bank_transfer = { bank: method.bank };
  if (method.paymentType === "echannel") {
    payload.echannel = { bill_info1: "Payment For", bill_info2: "Al-Hasanah Media" };
  }
  if (method.paymentType === "gopay") {
    payload.gopay = { enable_callback: true, callback_url: "alhasanahmedia://payment-return" };
  }
  if (method.paymentType === "cstore") {
    const cstore: Record<string, unknown> = {
      store: method.store,
      message: "Al-Hasanah",
    };
    if (method.store === "alfamart") {
      cstore.alfamart_free_text_1 = "TOP UP DOMPET SANTRI";
      cstore.alfamart_free_text_2 = String(santri.nis || "").slice(0, 40);
      cstore.alfamart_free_text_3 = "Simpan struk pembayaran";
    }
    payload.cstore = cstore;
  }
  return payload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const midtransServerKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    const isProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";

    if (!midtransServerKey) throw new Error("Konfigurasi pembayaran belum tersedia.");

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "Sesi login tidak valid." }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse({ error: "Sesi login tidak valid." }, 401);

    const userId = userData.user.id;
    const body = await req.json();
    const santriNis = String(body?.santri_nis ?? "").trim();
    const idempotencyKey = String(body?.idempotency_key ?? "").trim();
    const amount = cleanAmount(body?.amount);
    const method = METHODS[cleanText(body?.payment_method)] ?? METHODS.qris;

    if (!santriNis) throw new Error("Data santri wajib diisi.");
    if (idempotencyKey.length < 12) throw new Error("Idempotency key tidak valid.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name, email, no_hp, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_active || String(profile.role).toLowerCase() !== "wali") {
      return jsonResponse({ error: "Top up hanya bisa dilakukan oleh wali santri." }, 403);
    }

    const { data: santri } = await supabase
      .from("santri")
      .select("nis,nama,wali_id")
      .eq("nis", santriNis)
      .eq("wali_id", userId)
      .maybeSingle();

    if (!santri) return jsonResponse({ error: "Santri tidak terhubung dengan akun wali ini." }, 403);

    const { data: wallet } = await supabase
      .from("dompet_santri")
      .select("santri_nis,status")
      .eq("santri_nis", santriNis)
      .maybeSingle();

    if (!wallet || wallet.status !== "active") {
      return jsonResponse({ error: "Dompet santri belum aktif." }, 400);
    }

    const existing = await supabase
      .from("wallet_payment_intents")
      .select("id,santri_nis,amount,status,expires_at,midtrans_order_id,midtrans_snap_token,provider_payload")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing.data) {
      if (existing.data.santri_nis !== santriNis || Number(existing.data.amount) !== amount) {
        return jsonResponse({ error: "Permintaan top up tidak konsisten. Buat ulang top up." }, 409);
      }
      if (existing.data.status === "posted") {
        const paymentData = (existing.data.provider_payload as Record<string, unknown> | null)?.payment_data as Record<string, unknown> | undefined;
        return jsonResponse({
          data: {
            payment_intent_id: existing.data.id,
            order_id: existing.data.midtrans_order_id,
            snap_token: existing.data.midtrans_snap_token,
            amount: existing.data.amount,
            status: existing.data.status,
            expires_at: existing.data.expires_at,
            ...(paymentData ?? {}),
          },
        });
      }
      const existingPaymentData = (existing.data.provider_payload as Record<string, unknown> | null)?.payment_data as Record<string, unknown> | undefined;
      if (existingPaymentData || existing.data.midtrans_snap_token) {
        return jsonResponse({
          data: {
            payment_intent_id: existing.data.id,
            order_id: existing.data.midtrans_order_id,
            snap_token: existing.data.midtrans_snap_token,
            amount: existing.data.amount,
            status: existing.data.status,
            expires_at: existing.data.expires_at,
            ...(existingPaymentData ?? {}),
          },
        });
      }
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: intent, error: intentError } = await supabase
      .from("wallet_payment_intents")
      .insert({
        santri_nis: santriNis,
        type: "midtrans_topup",
        status: "pending",
        amount,
        created_by: userId,
        created_by_role: "wali",
        expires_at: expiresAt,
        idempotency_key: idempotencyKey,
        metadata: { channel: "android_wali", purpose: "wallet_topup" },
      })
      .select("id,expires_at")
      .single();

    if (intentError || !intent) {
      throw new Error("Gagal membuat sesi top up.");
    }

    const orderId = `WALLET-TOPUP-${intent.id}`;
    const midtransPayload = buildChargePayload(
      method,
      orderId,
      amount,
      { ...profile, email: profile.email || userData.user.email },
      santri,
    );

    const coreUrl = isProduction
      ? "https://api.midtrans.com/v2/charge"
      : "https://api.sandbox.midtrans.com/v2/charge";

    const response = await fetch(coreUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${midtransServerKey}:`)}`,
      },
      body: JSON.stringify(midtransPayload),
    });

    const midtransData = await response.json();
    if (!response.ok) {
      await supabase
        .from("wallet_payment_intents")
        .update({
          status: "failed",
          midtrans_order_id: orderId,
          provider_payload: { error: midtransData },
          updated_at: new Date().toISOString(),
        })
        .eq("id", intent.id);
      return jsonResponse({ error: "Pembayaran top up belum bisa dibuat." }, 400);
    }

    const paymentData = normalizeCoreResponse(midtransData, method, amount);

    await supabase
      .from("wallet_payment_intents")
      .update({
        midtrans_order_id: orderId,
        midtrans_snap_token: null,
        provider_payload: {
          payment_data: paymentData,
          raw_response: midtransData,
          order_id: orderId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id);

    await supabase.from("transaksi_keuangan").insert({
      jumlah: amount,
      tanggal_transaksi: new Date().toISOString(),
      status_transaksi: paymentData.status,
      status: "pending",
      metode_pembayaran: method.code,
      jenis_pembayaran: method.label,
      jenis_transaksi: "masuk",
      kategori: "wallet_topup",
      santri_nis: santriNis,
      wali_id: userId,
      admin_pencatat_id: null,
      midtrans_order_id: orderId,
      midtrans_snap_token: null,
      keterangan: "[MIDTRANS CORE] Menunggu top up Dompet Santri",
    });

    return jsonResponse({
      data: {
        payment_intent_id: intent.id,
        order_id: orderId,
        snap_token: null,
        amount,
        status: "pending",
        expires_at: intent.expires_at,
        ...paymentData,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Top up gagal diproses.";
    return jsonResponse({ error: message }, 400);
  }
});
