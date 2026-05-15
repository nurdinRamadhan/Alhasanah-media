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

        const isDonasi = orderIdRaw.startsWith('DONASI')
        let santriNis = null
        let waliId = null
        let deskripsiFinal = `[MIDTRANS] Pembayaran Berhasil (${notification.payment_type || 'online'})`

        if (!isDonasi) {
            // --- LOGIKA TAGIHAN SANTRI ---
            const { data: tagihan } = await supabase
                .from('tagihan_santri')
                .select('*, santri(wali_id, nama)')
                .eq('id', tagihanId)
                .single()

            if (tagihan) {
                santriNis = tagihan.santri_nis
                waliId = tagihan.santri?.wali_id
                console.log(`[PAYMENT] Processing payment for Santri: ${tagihan.santri?.nama || 'Unknown'}`)
                
                // Tandai Tagihan LUNAS
                await supabase.from('tagihan_santri').update({ status: 'LUNAS' }).eq('id', tagihanId)
            }
        } else {
            // --- LOGIKA DONASI UMUM ---
            console.log(`[PAYMENT] Processing Donation: ${orderIdRaw}`)
            
            // Ambil data dari log pending untuk mendapatkan info donatur jika ada
            const { data: existingTrx } = await supabase
                .from('transaksi_keuangan')
                .select('*')
                .eq('midtrans_order_id', orderIdRaw)
                .maybeSingle()
            
            if (existingTrx) {
                santriNis = existingTrx.santri_nis
                waliId = existingTrx.wali_id
                if (existingTrx.keterangan) deskripsiFinal = existingTrx.keterangan.replace('Menunggu Pembayaran', 'Berhasil')
            }
        }

        // 3. UPSERT KE BUKU BESAR (Enum: success)
        const { error: errTrx } = await supabase
            .from('transaksi_keuangan')
            .upsert({
                midtrans_order_id: orderIdRaw,
                jumlah: Math.round(Number(notification.gross_amount)),
                tanggal_transaksi: new Date().toISOString(),
                waktu_bayar_sukses: new Date().toISOString(),
                status_transaksi: transactionStatus,
                status: 'success',
                metode_pembayaran: notification.payment_type || 'digital',
                jenis_transaksi: 'masuk',
                santri_nis: santriNis,
                wali_id: waliId,
                admin_pencatat_id: null,
                keterangan: deskripsiFinal
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
