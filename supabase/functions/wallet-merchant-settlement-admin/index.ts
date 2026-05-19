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

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const role = cleanText(profile?.role).toLowerCase();
    if (!profile?.is_active || !["super_admin", "bendahara"].includes(role)) {
      return json({ error: "Hanya bendahara/super admin yang boleh memproses pencairan kantin." }, 403);
    }

    const body = await req.json();
    const settlementId = cleanText(body.settlement_request_id);
    const status = cleanText(body.status);
    const note = cleanText(body.note);

    if (!settlementId) throw new Error("settlement_request_id wajib diisi.");
    if (!["approved", "paid", "rejected"].includes(status)) throw new Error("Status pencairan tidak valid.");
    if (note.length < 12) throw new Error("Catatan pencairan minimal 12 karakter.");

    if (status === "paid") {
      const { data, error } = await service.rpc("wallet_mark_merchant_settlement_paid", {
        p_settlement_request_id: settlementId,
        p_actor_id: profile.id,
        p_note: note,
      });
      if (error) throw error;
      return json({ data });
    }

    if (status === "rejected") {
      const { data, error } = await service.rpc("wallet_reject_merchant_settlement", {
        p_settlement_request_id: settlementId,
        p_actor_id: profile.id,
        p_note: note,
      });
      if (error) throw error;
      return json({ data });
    }

    const { data, error } = await service
      .from("wallet_merchant_settlement_requests")
      .update({
        status: "approved",
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settlementId)
      .in("status", ["requested"])
      .select("*")
      .single();
    if (error) throw error;

    await service.from("wallet_audit_logs").insert({
      actor_id: profile.id,
      actor_role: role,
      action: "wallet_approve_merchant_settlement",
      resource: "wallet_merchant_settlement_requests",
      record_id: settlementId,
      metadata: { note_present: true },
    });

    return json({ data });
  } catch (error) {
    const message = getErrorMessage(error) || "Proses pencairan kantin gagal.";
    return json({ error: message }, 400);
  }
});
