import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanText = (value: unknown) => String(value ?? "").trim();
const optionalUuid = (value: unknown) => {
  const text = cleanText(value);
  return text.length > 0 ? text : null;
};
const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : "";
    const details = typeof record.details === "string" ? record.details : "";
    const hint = typeof record.hint === "string" ? record.hint : "";
    return [message, details, hint].filter(Boolean).join(" | ");
  }
  return "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment is not configured.");
    if (!token) return json({ error: "Authorization token wajib dikirim." }, 401);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Token tidak valid." }, 401);

    const body = await req.json();
    const merchantId = cleanText(body.merchant_id);
    const outletId = optionalUuid(body.outlet_id);
    const amount = Number(body.amount);
    const destinationNote = cleanText(body.destination_note);

    if (!merchantId) throw new Error("merchant_id wajib diisi.");
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Nominal pencairan tidak valid.");

    const { data, error } = await service.rpc("wallet_request_merchant_settlement_for_actor", {
      p_actor_id: userData.user.id,
      p_merchant_id: merchantId,
      p_outlet_id: outletId,
      p_amount: amount,
      p_destination_note: destinationNote || null,
    });
    if (error) throw error;

    return json({ data });
  } catch (error) {
    const message = getErrorMessage(error) || "Pengajuan pencairan saldo kantin gagal.";
    return json({ error: message }, 400);
  }
});
