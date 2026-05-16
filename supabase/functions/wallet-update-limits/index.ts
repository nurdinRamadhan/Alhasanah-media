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
const optionalInteger = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error("Limit harus bilangan bulat >= 0.");
  return n;
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
      .select("id, role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.is_active || cleanText(profile.role).toLowerCase() !== "wali") {
      return json({ error: "Limit dompet hanya boleh diubah oleh wali." }, 403);
    }

    const body = await req.json();
    const santriNis = cleanText(body.santri_nis);
    if (!santriNis) throw new Error("santri_nis wajib diisi.");

    const { data: santri, error: santriError } = await service
      .from("santri")
      .select("nis")
      .eq("nis", santriNis)
      .eq("wali_id", profile.id)
      .maybeSingle();
    if (santriError) throw santriError;
    if (!santri) return json({ error: "Santri tidak terhubung dengan wali ini." }, 403);

    const allowedCategories = Array.isArray(body.allowed_merchant_categories)
      ? body.allowed_merchant_categories
      : [];
    const spendingSchedule = body.spending_schedule && typeof body.spending_schedule === "object" && !Array.isArray(body.spending_schedule)
      ? body.spending_schedule
      : {};

    const { data, error } = await service.rpc("wallet_update_limits", {
      p_santri_nis: santriNis,
      p_actor_id: profile.id,
      p_actor_role: "wali",
      p_low_balance_threshold: optionalInteger(body.low_balance_threshold),
      p_daily_spend_limit: optionalInteger(body.daily_spend_limit),
      p_single_transaction_limit: optionalInteger(body.single_transaction_limit),
      p_monthly_spend_limit: optionalInteger(body.monthly_spend_limit),
      p_large_transaction_threshold: optionalInteger(body.large_transaction_threshold),
      p_allowed_merchant_categories: allowedCategories,
      p_spending_schedule: spendingSchedule,
    });
    if (error) throw error;

    return json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet limit update failed.";
    return json({ error: message }, 400);
  }
});
