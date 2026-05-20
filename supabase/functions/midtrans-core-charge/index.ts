import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MethodSpec = {
  code: string;
  label: string;
  paymentType: string;
  bank?: string;
  store?: string;
};

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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanAmount(value: unknown): number {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount < 1_000) throw new Error("Nominal pembayaran tidak valid.");
  return amount;
}

function safeItemName(value: unknown, fallback: string): string {
  return cleanText(value).slice(0, 50) || fallback;
}

function buildChargePayload(params: {
  method: MethodSpec;
  orderId: string;
  amount: number;
  customer: Record<string, unknown>;
  itemDetails: Record<string, unknown>[];
}) {
  const payload: Record<string, unknown> = {
    payment_type: params.method.paymentType,
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.amount,
    },
    customer_details: params.customer,
    item_details: params.itemDetails,
  };

  if (params.method.paymentType === "bank_transfer") {
    payload.bank_transfer = { bank: params.method.bank };
  }
  if (params.method.paymentType === "echannel") {
    payload.echannel = {
      bill_info1: "Payment For",
      bill_info2: "Al-Hasanah Media",
    };
  }
  if (params.method.paymentType === "gopay") {
    payload.gopay = {
      enable_callback: true,
      callback_url: "alhasanahmedia://payment-return",
    };
  }
  if (params.method.paymentType === "cstore") {
    const cstore: Record<string, unknown> = {
      store: params.method.store,
      message: "Al-Hasanah",
    };
    if (params.method.store === "alfamart") {
      cstore.alfamart_free_text_1 = "AL-HASANAH MEDIA";
      cstore.alfamart_free_text_2 = params.orderId.slice(0, 40);
      cstore.alfamart_free_text_3 = "Simpan struk pembayaran";
    }
    payload.cstore = cstore;
  }

  return payload;
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    const isProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serverKey) throw new Error("Konfigurasi Midtrans belum tersedia.");

    const service = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const transactionType = cleanText(body.transaction_type);
    const method = METHODS[cleanText(body.payment_method)] ?? METHODS.qris;
    const requestedAmount = cleanAmount(body.gross_amount);
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    let userId: string | null = null;
    if (token) {
      const { data: userData } = await service.auth.getUser(token);
      userId = userData.user?.id ?? null;
    }

    let orderId = "";
    let amount = requestedAmount;
    let santriNis: string | null = cleanText(body.santri_nis) || null;
    let waliId: string | null = userId;
    let description = "Pembayaran Digital";
    let category: string | null = null;

    if (transactionType === "tagihan") {
      if (!userId) return json({ error: "Sesi login tidak valid." }, 401);
      const tagihanId = cleanText(body.order_id);
      if (!tagihanId) throw new Error("Tagihan tidak valid.");

      const { data: tagihan, error: tagihanError } = await service
        .from("tagihan_santri")
        .select("id,santri_nis,deskripsi_tagihan,sisa_tagihan,status,santri(wali_id,nama)")
        .eq("id", tagihanId)
        .maybeSingle();
      if (tagihanError) throw tagihanError;
      if (!tagihan) return json({ error: "Tagihan tidak ditemukan." }, 404);

      const tagihanWaliId = (tagihan.santri as Record<string, unknown> | null)?.wali_id;
      if (cleanText(tagihanWaliId) !== userId) return json({ error: "Tagihan bukan milik wali ini." }, 403);
      if (cleanText(tagihan.status).toUpperCase() === "LUNAS") {
        return json({ error: "Tagihan sudah lunas." }, 409);
      }

      amount = cleanAmount(tagihan.sisa_tagihan);
      orderId = `${tagihan.id}_${Date.now()}`;
      santriNis = cleanText(tagihan.santri_nis);
      waliId = userId;
      description = safeItemName(tagihan.deskripsi_tagihan, "Pembayaran Tagihan");
      category = "tagihan";
    } else if (transactionType === "donation") {
      const donationName = safeItemName(body.item_details?.[0]?.name, "Donasi");
      orderId = `DONASI-${donationName.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${Date.now()}`;
      description = `[DONASI] ${donationName}`;
      category = "donasi";
      waliId = userId;
      santriNis = santriNis || null;
    } else {
      return json({ error: "Jenis transaksi tidak didukung." }, 400);
    }

    const customer = body.customer_details && typeof body.customer_details === "object"
      ? body.customer_details as Record<string, unknown>
      : { first_name: "Wali Santri" };
    const itemDetails = Array.isArray(body.item_details) && body.item_details.length > 0
      ? body.item_details
      : [{ id: category ?? "PAYMENT", name: description, price: amount, quantity: 1 }];

    const chargePayload = buildChargePayload({
      method,
      orderId,
      amount,
      customer,
      itemDetails,
    });

    const url = isProduction
      ? "https://api.midtrans.com/v2/charge"
      : "https://api.sandbox.midtrans.com/v2/charge";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${serverKey}:`)}`,
      },
      body: JSON.stringify(chargePayload),
    });
    const midtransData = await response.json();
    if (!response.ok) {
      return json({ error: "Midtrans menolak transaksi.", details: midtransData }, 400);
    }

    const normalized = normalizeCoreResponse(midtransData, method, amount);
    const { error: insertError } = await service.from("transaksi_keuangan").insert({
      jumlah: amount,
      tanggal_transaksi: new Date().toISOString(),
      status_transaksi: normalized.status,
      status: "pending",
      metode_pembayaran: method.code,
      jenis_transaksi: "masuk",
      kategori: category,
      jenis_pembayaran: method.label,
      santri_nis: santriNis,
      wali_id: waliId,
      admin_pencatat_id: null,
      midtrans_order_id: orderId,
      midtrans_snap_token: null,
      pesan_donatur: cleanText(body.notes) || null,
      keterangan: `[MIDTRANS CORE] Menunggu Pembayaran: ${description}`,
    });
    if (insertError) throw insertError;

    return json({ data: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pembayaran gagal dibuat.";
    console.error("[MIDTRANS_CORE_CHARGE]", message);
    return json({ error: message }, 400);
  }
});
