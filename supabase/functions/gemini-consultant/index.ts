import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key hilang" }), { status: 500, headers: corsHeaders });
    }

    const guardedPrompt = `Instruksi keuangan penting:
- Pendapatan/kas masuk dihitung dari transaksi_keuangan yang sudah sukses/settlement.
- Nominal tagihan yang belum dibayar adalah invoice/piutang, bukan pendapatan kas.
- Status CICILAN berarti pembayaran sebagian sudah diterima; sisa_tagihan adalah piutang.
- Untuk SPP, listrik, kas, dan jenis tagihan lain, bedakan total tertagih, total terpenuhi/terbayar, dan sisa piutang.

${String(prompt || "")}`;

    // PENTING: Gunakan model stabil & support token banyak
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: guardedPrompt }]
        }],
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 9192, // <--- NAIKKAN INI (Supaya tidak terpotong)
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Error:", JSON.stringify(data));
      return new Response(JSON.stringify({ 
        error: "Google Gemini Error", 
        detail: data.error?.message 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, tidak ada jawaban.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
