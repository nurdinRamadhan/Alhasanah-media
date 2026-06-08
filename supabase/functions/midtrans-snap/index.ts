import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const midtransServerKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    const isProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!midtransServerKey) throw new Error("Environment Variable: MIDTRANS_SERVER_KEY is missing");

    const body = await req.json();
    let { order_id, gross_amount, customer_details, item_details, santri_nis, wali_id, is_donation } = body;

    if (!gross_amount) throw new Error("Missing required field: gross_amount");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- LOGIKA IDENTIFIKASI TRANSAKSI ---
    let finalOrderId = order_id;
    let description = "Pembayaran Tagihan Digital";

    const cleanAmount = Math.round(Number(gross_amount));
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      throw new Error("Nominal pembayaran tidak valid.");
    }

    if (is_donation) {
        // Jika Donasi: Buat Order ID khusus
        const donationType = (Array.isArray(item_details) && item_details.length > 0) 
            ? item_details[0].name 
            : "Infaq/Shadaqah";
        
        const timestamp = Date.now();
        finalOrderId = `DONASI-${donationType.toUpperCase().replace(/\s+/g, '-')}-${timestamp}`;
        description = `[DONASI] ${donationType} dari ${customer_details?.first_name || 'Hamba Allah'}`;
        
        console.log(`[SNAP] Processing Donation: ${finalOrderId}`);
    } else {
        // Jika Tagihan: Lakukan lookup identitas jika perlu
        if (!santri_nis || !wali_id) {
            console.log(`[SNAP] Missing identifiers, looking up for Tagihan: ${order_id}`);
            const { data: tagihan, error: dbErr } = await supabase
                .from("tagihan_santri")
                .select(`
                    santri_nis, 
                    sisa_tagihan,
                    status,
                    santri(wali_id)
                `)
                .eq("id", order_id)
                .maybeSingle();
            
            if (tagihan) {
                santri_nis = santri_nis || tagihan.santri_nis;
                const dbWaliId = (tagihan.santri as any)?.wali_id;
                wali_id = wali_id || dbWaliId;
                console.log(`[SNAP] Found Identifiers -> NIS: ${santri_nis}, Wali: ${wali_id}`);
            } else if (dbErr) {
                console.error(`[SNAP] DB Lookup Error:`, dbErr);
            }
        }

        const { data: payableTagihan, error: payableErr } = await supabase
            .from("tagihan_santri")
            .select("id, sisa_tagihan, status")
            .eq("id", order_id)
            .maybeSingle();

        if (payableErr) throw payableErr;
        if (!payableTagihan) throw new Error("Tagihan tidak ditemukan.");
        if (String(payableTagihan.status).toUpperCase() === "LUNAS") {
            throw new Error("Tagihan sudah lunas.");
        }
        if (cleanAmount > Number(payableTagihan.sisa_tagihan || 0)) {
            throw new Error("Nominal pembayaran melebihi sisa tagihan.");
        }
        
        const timestamp = Date.now();
        finalOrderId = `${order_id}_${timestamp}`;
        description = (Array.isArray(item_details) && item_details.length > 0) 
            ? item_details[0].name 
            : "Pembayaran Tagihan Digital";
    }

    // --- FIX 2: MEMBERSIHKAN PAYLOAD MIDTRANS ---
    const midtransPayload: any = {
      transaction_details: {
        order_id: finalOrderId,
        gross_amount: cleanAmount, 
      },
      customer_details: customer_details || { first_name: "Hamba Allah" },
      credit_card: { secure: true }
    };

    if (Array.isArray(item_details) && item_details.length > 0) {
        midtransPayload.item_details = item_details;
    }

    const SNAP_API_URL = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const authHeader = `Basic ${btoa(midtransServerKey + ":")}`;

    const response = await fetch(SNAP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(midtransPayload),
    });

    const midtransData = await response.json();

    if (!response.ok) {
      console.error("[SNAP] Midtrans Rejection:", midtransData);
      return new Response(JSON.stringify({ error: "Midtrans Rejection", details: midtransData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // --- FIX 3: LOG TRANSAKSI (Gunakan Enum yang Benar) ---
    try {
        if (midtransData.token) {
            const { error: logErr } = await supabase.from("transaksi_keuangan").insert({
                jumlah: cleanAmount,
                tanggal_transaksi: new Date().toISOString(),
                status_transaksi: "pending", 
                status: "pending",           
                metode_pembayaran: "midtrans",
                jenis_transaksi: "masuk",
                kategori: is_donation ? "donasi" : "tagihan",
                santri_nis: santri_nis,
                wali_id: wali_id,
                admin_pencatat_id: null,      
                midtrans_order_id: finalOrderId,
                midtrans_snap_token: midtransData.token,
                keterangan: `[MIDTRANS] Menunggu Pembayaran: ${description}`
            });
            
            if (logErr) throw logErr;
            console.log(`[SNAP] Logged pending transaction: ${finalOrderId}`);
        }
    } catch (logErr) {
        console.error("[SNAP] Logging to DB failed:", logErr);
    }

    return new Response(JSON.stringify(midtransData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("[SNAP] Global catch:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
