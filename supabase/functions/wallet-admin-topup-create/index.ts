import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedRoles = new Set(["bendahara", "super_admin"]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
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
    const santriNis = cleanText(body?.santri_nis, 64);
    const idempotencyKey = cleanText(body?.idempotency_key, 120);
    const depositorName = cleanText(body?.depositor_name, 120);
    const depositorRelation = cleanText(body?.depositor_relation, 80);
    const depositorPhone = cleanText(body?.depositor_phone, 40);
    const note = cleanText(body?.note, 240);
    const amount = cleanAmount(body?.amount);

    if (!santriNis) throw new Error("Data santri wajib diisi.");
    if (idempotencyKey.length < 12) throw new Error("Idempotency key tidak valid.");
    if (depositorName.length < 3) throw new Error("Nama penyetor wajib diisi.");
    if (depositorRelation.length < 2) throw new Error("Hubungan penyetor wajib diisi.");
    if (note.length < 10) throw new Error("Catatan audit minimal 10 karakter.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name, email, no_hp, is_active")
      .eq("id", userId)
      .maybeSingle();

    const actorRole = String(profile?.role || "").toLowerCase();
    if (!profile?.is_active || !allowedRoles.has(actorRole)) {
      return jsonResponse({ error: "Hanya bendahara atau super admin yang boleh membuat top up titipan." }, 403);
    }

    const { data: santri } = await supabase
      .from("santri")
      .select("nis,nama,kelas,jurusan")
      .eq("nis", santriNis)
      .maybeSingle();

    if (!santri) return jsonResponse({ error: "Santri tidak ditemukan." }, 404);

    const { data: wallet } = await supabase
      .from("dompet_santri")
      .select("santri_nis,status")
      .eq("santri_nis", santriNis)
      .maybeSingle();

    if (!wallet || wallet.status !== "active") {
      return jsonResponse({ error: "Dompet santri belum aktif atau sedang terkunci." }, 400);
    }

    const existing = await supabase
      .from("wallet_payment_intents")
      .select("id,santri_nis,amount,status,expires_at,midtrans_order_id,midtrans_snap_token,metadata")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing.data) {
      if (existing.data.santri_nis !== santriNis || Number(existing.data.amount) !== amount) {
        return jsonResponse({ error: "Permintaan top up tidak konsisten. Buat ulang sesi top up." }, 409);
      }
      return jsonResponse({
        data: {
          payment_intent_id: existing.data.id,
          order_id: existing.data.midtrans_order_id,
          snap_token: existing.data.midtrans_snap_token,
          redirect_url: (existing.data.metadata as Record<string, unknown> | null)?.redirect_url ?? null,
          amount: existing.data.amount,
          status: existing.data.status,
          expires_at: existing.data.expires_at,
        },
      });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const intentMetadata = {
      channel: "admin_panel",
      purpose: "wallet_admin_assisted_topup",
      depositor_name: depositorName,
      depositor_relation: depositorRelation,
      depositor_phone: depositorPhone || null,
      admin_note: note,
      created_by_name: profile.full_name || null,
      created_by_role: actorRole,
    };

    const { data: intent, error: intentError } = await supabase
      .from("wallet_payment_intents")
      .insert({
        santri_nis: santriNis,
        type: "midtrans_topup",
        status: "pending",
        amount,
        created_by: userId,
        created_by_role: actorRole,
        expires_at: expiresAt,
        idempotency_key: idempotencyKey,
        metadata: intentMetadata,
      })
      .select("id,expires_at")
      .single();

    if (intentError || !intent) {
      throw new Error("Gagal membuat sesi top up titipan.");
    }

    const orderId = `WAT-${intent.id}`;
    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: depositorName,
        email: userData.user.email || profile.email || "bendahara@alhasanah.local",
        phone: depositorPhone || profile.no_hp || undefined,
      },
      item_details: [
        {
          id: "DOMPET-SANTRI-ADMIN-TOPUP",
          name: `Top Up Titipan Dompet ${santri.nama || santri.nis}`,
          price: amount,
          quantity: 1,
        },
      ],
      credit_card: { secure: true },
      custom_field1: santriNis,
      custom_field2: "admin_assisted_wallet_topup",
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
      return jsonResponse({ error: "Pembayaran top up titipan belum bisa dibuat." }, 400);
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
        metadata: {
          ...intentMetadata,
          redirect_url: midtransData.redirect_url || null,
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
      wali_id: null,
      admin_pencatat_id: userId,
      midtrans_order_id: orderId,
      midtrans_snap_token: midtransData.token,
      keterangan: `[MIDTRANS] Menunggu top up titipan Dompet Santri dari ${depositorName}`,
    });

    await supabase.from("wallet_audit_logs").insert({
      actor_id: userId,
      actor_role: actorRole,
      action: "create_admin_assisted_topup",
      resource: "wallet_payment_intents",
      santri_nis: santriNis,
      record_id: intent.id,
      request_id: idempotencyKey,
      user_agent: req.headers.get("User-Agent"),
      metadata: {
        amount,
        order_id: orderId,
        depositor_name: depositorName,
        depositor_relation: depositorRelation,
        note,
      },
    });

    return jsonResponse({
      data: {
        payment_intent_id: intent.id,
        order_id: orderId,
        snap_token: midtransData.token,
        redirect_url: midtransData.redirect_url || null,
        amount,
        status: "pending",
        expires_at: intent.expires_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Top up titipan gagal diproses.";
    return jsonResponse({ error: message }, 400);
  }
});
