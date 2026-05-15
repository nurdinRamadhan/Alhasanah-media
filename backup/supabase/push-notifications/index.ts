import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import admin from "npm:firebase-admin@12.0.0"

// Inisialisasi Firebase Admin
const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY")!);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // 1. Ambil data dari request (bisa dari Webhook Supabase atau trigger manual)
    const payload = await req.json().catch(() => ({}));
    const recordId = payload?.record?.id || payload?.id;

    let itemsToProcess = [];

    if (recordId) {
      // Jika dipicu oleh Webhook (satu record)
      const { data, error } = await supabase
        .from('notification_queue')
        .select('id, user_id, title, body, data, status')
        .eq('id', recordId)
        .single();
      
      if (data && (data.status === 'pending' || data.status === 'sending')) {
        itemsToProcess = [data];
      }
    } else {
      // Fallback: Ambil max 10 yang pending dan "tandai" sebagai sending secara atomic
      const { data } = await supabase
        .from('notification_queue')
        .update({ status: 'sending' })
        .eq('status', 'pending')
        .select()
        .limit(10);
      
      if (data) itemsToProcess = data;
    }

    if (itemsToProcess.length === 0) {
      return new Response("No pending notifications to process", { status: 200 });
    }

    const results = [];

    for (const item of itemsToProcess) {
      // Tandai sebagai sedang diproses jika recordId ada (mencegah double trigger dari webhook)
      if (recordId) {
        await supabase.from('notification_queue').update({ status: 'sending' }).eq('id', item.id);
      }

      // 2. Ambil token perangkat user
      const { data: devices } = await supabase
        .from('user_devices')
        .select('fcm_token')
        .eq('user_id', item.user_id);

      const tokens = devices?.map((d: any) => d.fcm_token).filter(t => t != null) || [];

      if (tokens.length > 0) {
        try {
          // 3. Kirim ke FCM
          const response = await admin.messaging().sendEachForMulticast({
            notification: { 
              title: item.title, 
              body: item.body 
            },
            data: { 
              // Masukkan semua data kustom yang ada
              ...Object.fromEntries(
                Object.entries(item.data || {}).map(([k, v]) => [k, String(v)])
              ),
              // Tambahkan metadata penting untuk validasi di Android
              notification_id: String(item.id),
              user_id: String(item.user_id), // SANGAT PENTING: Untuk validasi di sisi Android
              source: String(item.source_table || 'manual')
            },
            tokens: tokens,
          });

          console.log(`Notification ${item.id}: Berhasil ${response.successCount}, Gagal ${response.failureCount}`);

          // 4. Update status menjadi sent
          await supabase.from('notification_queue')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', item.id);
            
          results.push({ id: item.id, status: 'sent' });
        } catch (e) {
          console.error(`FCM Error ID ${item.id}:`, e);
          await supabase.from('notification_queue')
            .update({ status: 'failed', error_message: e.message }).eq('id', item.id);
          results.push({ id: item.id, status: 'failed' });
        }
      } else {
        await supabase.from('notification_queue')
          .update({ status: 'failed', error_message: "No registered tokens" }).eq('id', item.id);
        results.push({ id: item.id, status: 'failed', reason: 'no_tokens' });
      }
    }

    return new Response(JSON.stringify(results), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("Critical Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
})
