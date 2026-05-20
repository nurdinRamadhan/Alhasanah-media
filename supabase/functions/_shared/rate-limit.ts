import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
) {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("rate limit error:", error);
    return { allowed: true, remaining: maxAttempts };
  }

  return {
    allowed: Boolean(data?.allowed ?? true),
    remaining: Number(data?.remaining ?? maxAttempts),
  };
}
