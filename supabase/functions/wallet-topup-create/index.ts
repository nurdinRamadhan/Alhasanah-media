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
      .select("id,santri_nis,amount,status,expires_at,midtrans_order_id,midtrans_snap_token")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing.data) {
      if (existing.data.santri_nis !== santriNis || Number(existing.data.amount) !== amount) {
        return jsonResponse({ error: "Permintaan top up tidak konsisten. Buat ulang top up." }, 409);
      }
      if (existing.data.status === "posted") {
        return jsonResponse({
          data: {
            payment_intent_id: existing.data.id,
            order_id: existing.data.midtrans_order_id,
            snap_token: existing.data.midtrans_snap_token,
            amount: existing.data.amount,
            status: existing.data.status,
            expires_at: existing.data.expires_at,
          },
        });
      }
      if (existing.data.midtrans_snap_token) {
        return jsonResponse({
          data: {
            payment_intent_id: existing.data.id,
            order_id: existing.data.midtrans_order_id,
            snap_token: existing.data.midtrans_snap_token,
            amount: existing.data.amount,
            status: existing.data.status,
            expires_at: existing.data.expires_at,
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
    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: profile.full_name || "Wali Santri",
        email: profile.email || userData.user.email || "wali@alhasanah.local",
        phone: profile.no_hp || undefined,
      },
      item_details: [
        {
          id: "DOMPET-SANTRI-TOPUP",
          name: `Top Up Dompet Santri ${santri.nama || santri.nis}`,
          price: amount,
          quantity: 1,
        },
      ],
      credit_card: { secure: true },
    };

    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const response = await fetch(snapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${midtransServerKey}:`)}`,
      },
      body: JSON.stringify(midtransPayload),
    });

    const midtransData = await response.json();
    if (!response.ok || !midtransData?.token) {
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

    await supabase
      .from("wallet_payment_intents")
      .update({
        midtrans_order_id: orderId,
        midtrans_snap_token: midtransData.token,
        provider_payload: {
          token: midtransData.token,
          redirect_url: midtransData.redirect_url,
          order_id: orderId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id);

    await supabase.from("transaksi_keuangan").insert({
      jumlah: amount,
      tanggal_transaksi: new Date().toISOString(),
      status_transaksi: "pending",
      status: "pending",
      metode_pembayaran: "midtrans",
      jenis_transaksi: "masuk",
      kategori: "wallet_topup",
      santri_nis: santriNis,
      wali_id: userId,
      admin_pencatat_id: null,
      midtrans_order_id: orderId,
      midtrans_snap_token: midtransData.token,
      keterangan: "[MIDTRANS] Menunggu top up Dompet Santri",
    });

    return jsonResponse({
      data: {
        payment_intent_id: intent.id,
        order_id: orderId,
        snap_token: midtransData.token,
        amount,
        status: "pending",
        expires_at: intent.expires_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Top up gagal diproses.";
    return jsonResponse({ error: message }, 400);
  }
});
