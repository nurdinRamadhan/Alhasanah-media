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
    });

    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Token tidak valid." }, 401);

    const body = await req.json();
    const ledgerId = Number(body.ledger_id);
    const reason = cleanText(body.reason);
    const evidence = body.evidence && typeof body.evidence === "object" ? body.evidence : {};

    if (!Number.isInteger(ledgerId) || ledgerId <= 0) throw new Error("Transaksi yang dilaporkan tidak valid.");
    if (reason.length < 10) throw new Error("Alasan laporan minimal 10 karakter.");

    const { data, error } = await service.rpc("wallet_open_dispute", {
      p_ledger_id: ledgerId,
      p_reported_by: userData.user.id,
      p_reason: reason,
      p_evidence: evidence,
    });
    if (error) throw error;

    return json({ data });
  } catch (error) {
    const message = getErrorMessage(error) || "Laporan transaksi gagal dikirim.";
    return json({ error: message }, 400);
  }
});
