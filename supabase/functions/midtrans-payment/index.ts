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

async function sha512(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyMidtransSignature(notification: Record<string, unknown>) {
  const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
  if (!serverKey || !notification?.signature_key) return;
  const expected = await sha512(
    `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`,
  );
  if (expected !== notification.signature_key) {
    throw new Error("Invalid Midtrans signature");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const notification = await req.json();
    await verifyMidtransSignature(notification);

    const orderIdRaw = String(notification.order_id ?? "");
    const transactionStatus = String(notification.transaction_status ?? "");
    const fraudStatus = String(notification.fraud_status ?? "");
    const paymentType = String(notification.payment_type ?? "digital");
    const grossAmount = Math.round(Number(notification.gross_amount ?? 0));

    if (!orderIdRaw) throw new Error("Missing order_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const isPaid = ["capture", "settlement"].includes(transactionStatus) && fraudStatus !== "challenge";
    const isTerminalFailure = ["deny", "cancel", "expire", "failure"].includes(transactionStatus);

    const walletTopup = await supabase
      .from("wallet_payment_intents")
      .select("id,santri_nis,type,status,amount,created_by,created_by_role,posted_ledger_id,midtrans_order_id,metadata")
      .eq("midtrans_order_id", orderIdRaw)
      .maybeSingle();

    if (walletTopup.data?.type === "midtrans_topup") {
      const intent = walletTopup.data;
      const metadata = (intent.metadata && typeof intent.metadata === "object" ? intent.metadata : {}) as Record<string, unknown>;
      const isAdminAssisted = metadata.channel === "admin_panel" || String(intent.created_by_role || "").toLowerCase() !== "wali";
      const keterangan = isAdminAssisted
        ? "Top up Dompet Santri titipan via Midtrans"
        : "Top up Dompet Santri via Midtrans";

      if (isTerminalFailure && intent.status !== "posted") {
        await supabase
          .from("wallet_payment_intents")
          .update({
            status: transactionStatus === "expire" ? "expired" : "failed",
            provider_payload: notification,
            updated_at: new Date().toISOString(),
          })
          .eq("id", intent.id);
        return jsonResponse({ message: "OK" });
      }

      if (!isPaid) return jsonResponse({ message: "OK" });

      if (intent.status === "posted") {
        return jsonResponse({ message: "OK", idempotent: true });
      }

      if (grossAmount !== Number(intent.amount)) {
        await supabase
          .from("wallet_payment_intents")
          .update({
            status: "failed",
            provider_payload: { ...notification, failure_reason: "amount_mismatch" },
            updated_at: new Date().toISOString(),
          })
          .eq("id", intent.id);
        throw new Error("Wallet top up amount mismatch");
      }

      const { data: trx, error: trxError } = await supabase
        .from("transaksi_keuangan")
        .upsert({
          midtrans_order_id: orderIdRaw,
          jumlah: grossAmount,
          tanggal_transaksi: new Date().toISOString(),
          waktu_bayar_sukses: new Date().toISOString(),
          status_transaksi: transactionStatus,
          status: "success",
          metode_pembayaran: paymentType,
          jenis_transaksi: "masuk",
          kategori: "wallet_topup",
          santri_nis: intent.santri_nis,
          wali_id: isAdminAssisted ? null : intent.created_by,
          admin_pencatat_id: isAdminAssisted ? intent.created_by : null,
          keterangan: `[MIDTRANS] ${keterangan} berhasil`,
        }, { onConflict: "midtrans_order_id" })
        .select("id")
        .single();

      if (trxError) throw trxError;

      await supabase
        .from("wallet_payment_intents")
        .update({
          status: "processing",
          provider_payload: notification,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intent.id);

      const { error: postError } = await supabase.rpc("wallet_post_transaction", {
        p_santri_nis: intent.santri_nis,
        p_direction: "credit",
        p_category: "topup",
        p_amount: grossAmount,
        p_actor_id: intent.created_by,
        p_actor_role: "midtrans",
        p_idempotency_key: `wallet-topup-post:${orderIdRaw}`,
        p_keterangan: keterangan,
        p_counterparty_id: null,
        p_counterparty_role: "midtrans",
        p_transaksi_keuangan_id: trx?.id ?? null,
        p_payment_intent_id: intent.id,
        p_nonce: null,
        p_signature: null,
        p_signature_public_key: null,
        p_metadata: {
          midtrans_order_id: orderIdRaw,
          transaction_status: transactionStatus,
          payment_type: paymentType,
          topup_channel: metadata.channel || "android_wali",
          initiated_by_role: intent.created_by_role || null,
          depositor_name: metadata.depositor_name || null,
        },
      });

      if (postError) throw postError;

      return jsonResponse({ message: "OK" });
    }

    if (isTerminalFailure) {
      await supabase
        .from("transaksi_keuangan")
        .update({
          status_transaksi: transactionStatus,
          status: "failed",
          metode_pembayaran: paymentType,
          keterangan: `[MIDTRANS] Pembayaran gagal atau kedaluwarsa (${transactionStatus})`,
        })
        .eq("midtrans_order_id", orderIdRaw);
      return jsonResponse({ message: "OK" });
    }

    if (!isPaid) return jsonResponse({ message: "OK" });

    const tagihanId = orderIdRaw.split("_")[0];
    const isDonasi = orderIdRaw.startsWith("DONASI");
    let santriNis = null;
    let waliId = null;
    let deskripsiFinal = `[MIDTRANS] Pembayaran Berhasil (${paymentType})`;
    let trxId: string | null = null;

    if (!isDonasi) {
      const { data: tagihan } = await supabase
        .from("tagihan_santri")
        .select("*, santri(wali_id, nama, nis)")
        .eq("id", tagihanId)
        .single();

      if (tagihan) {
        santriNis = tagihan.santri_nis;
        waliId = tagihan.santri?.wali_id;
        deskripsiFinal = `[MIDTRANS] Pembayaran Tagihan: ${tagihan.deskripsi_tagihan}`;
      }
    } else {
      const { data: existingTrx } = await supabase
        .from("transaksi_keuangan")
        .select("*")
        .eq("midtrans_order_id", orderIdRaw)
        .maybeSingle();

      if (existingTrx) {
        santriNis = existingTrx.santri_nis;
        waliId = existingTrx.wali_id;
        if (existingTrx.keterangan) {
          deskripsiFinal = existingTrx.keterangan.replace("Menunggu Pembayaran", "Berhasil");
        }
      }
    }

    const { data: trx, error: errTrx } = await supabase
      .from("transaksi_keuangan")
      .upsert({
        midtrans_order_id: orderIdRaw,
        jumlah: grossAmount,
        tanggal_transaksi: new Date().toISOString(),
        waktu_bayar_sukses: new Date().toISOString(),
        status_transaksi: transactionStatus,
        status: "success",
        metode_pembayaran: paymentType,
        jenis_transaksi: "masuk",
        santri_nis: santriNis,
        wali_id: waliId,
        admin_pencatat_id: null,
        keterangan: deskripsiFinal,
      }, { onConflict: "midtrans_order_id" })
      .select("id")
      .single();

    if (errTrx) throw errTrx;
    trxId = trx?.id ?? null;

    if (!isDonasi) {
      const { error: paymentError } = await supabase.rpc("record_tagihan_payment", {
        p_tagihan_id: tagihanId,
        p_amount: grossAmount,
        p_metode_pembayaran: paymentType,
        p_source: "midtrans",
        p_provider_order_id: orderIdRaw,
        p_transaksi_id: trxId,
        p_keterangan: deskripsiFinal,
        p_idempotency_key: `midtrans-tagihan:${orderIdRaw}`,
        p_provider_payload: notification,
      });

      if (paymentError) throw paymentError;
    }

    return jsonResponse({ message: "OK" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook gagal diproses.";
    console.error("[MIDTRANS_PAYMENT]", message);
    return jsonResponse({ error: message }, 400);
  }
});
