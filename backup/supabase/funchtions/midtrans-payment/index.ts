import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const notification = await req.json()
    console.log('🔔 WEBHOOK MASUK:', JSON.stringify(notification))

    const orderIdRaw = notification.order_id 
    const transactionStatus = notification.transaction_status
    const tagihanId = orderIdRaw.split('_')[0]

    let isPaid = false
    if (['capture', 'settlement'].includes(transactionStatus)) {
        if (notification.fraud_status !== 'challenge') isPaid = true
    }

    if (isPaid) {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Ambil data tagihan untuk referensi (Audit Trail & Metadata)
        const { data: tagihan } = await supabase
            .from('tagihan_santri')
            .select('*, santri(wali_id, nama)')
            .eq('id', tagihanId)
            .single()

        console.log(`[PAYMENT] Processing payment for Santri: ${tagihan?.santri?.nama || 'Unknown'}`)

        // 2. Tandai Tagihan LUNAS
        await supabase.from('tagihan_santri').update({ status: 'LUNAS' }).eq('id', tagihanId)

        // 3. UPSERT KE BUKU BESAR (Enum: success)
        const { error: errTrx } = await supabase
            .from('transaksi_keuangan')
            .upsert({
                midtrans_order_id: orderIdRaw,
                jumlah: Math.round(Number(notification.gross_amount)),
                tanggal_transaksi: new Date().toISOString(),
                waktu_bayar_sukses: new Date().toISOString(),
                status_transaksi: transactionStatus, // Simpan status asli Midtrans (settlement/capture)
                status: 'success',                   // Enum tipe_status_transaksi WAJIB 'success'
                metode_pembayaran: notification.payment_type || 'digital',
                jenis_transaksi: 'masuk',
                santri_nis: tagihan?.santri_nis,
                wali_id: tagihan?.santri?.wali_id,
                admin_pencatat_id: null,              // FIX: Webhook tidak punya context Admin
                keterangan: `[MIDTRANS] Pembayaran Berhasil (${notification.payment_type || 'online'})`
            }, { onConflict: 'midtrans_order_id' }) 

        if (errTrx) {
            console.error('❌ Gagal mencatat Buku Besar (Upsert Error):', errTrx)
        } else {
            console.log(`✅ DATABASE SYNCHRONIZED: ${tagihanId} | Order: ${orderIdRaw}`)
        }
    }

    return new Response(JSON.stringify({ message: 'OK' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
    })

  } catch (err: any) {
    console.error("🔥 Webhook Catch Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
    })
  }
})
