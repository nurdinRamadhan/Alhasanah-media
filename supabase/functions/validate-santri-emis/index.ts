import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sesi admin tidak ditemukan. Silakan login ulang.");

    const body = await req.json().catch(() => ({}));
    const nisList = Array.isArray(body.nis_list)
      ? body.nis_list.map((item: unknown) => String(item)).filter(Boolean)
      : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      },
    );

    const { data, error } = await supabase.rpc("validate_santri_emis", {
      p_nis_list: nisList,
      p_status: body.status || null,
    });

    if (error) throw error;
    return json({ success: true, data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validasi EMIS gagal.";
    return json({ success: false, error: message }, 400);
  }
});
