import { SupabaseClient } from "./supabase.ts";

export async function checkRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  limit: number,
  windowSeconds = 60,
) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);

  const { data: existing, error: selectError } = await supabase
    .from("rag_rate_limits")
    .select("id, request_count")
    .eq("bucket_key", bucketKey)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (selectError) {
    console.error("rate limit select error:", selectError);
    return { allowed: true, remaining: limit };
  }

  if (!existing) {
    const { error } = await supabase.from("rag_rate_limits").insert({
      bucket_key: bucketKey,
      window_start: windowStart.toISOString(),
      request_count: 1,
    });
    if (error) console.error("rate limit insert error:", error);
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.request_count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  const nextCount = existing.request_count + 1;
  const { error } = await supabase
    .from("rag_rate_limits")
    .update({ request_count: nextCount })
    .eq("id", existing.id);

  if (error) console.error("rate limit update error:", error);
  return { allowed: true, remaining: Math.max(limit - nextCount, 0) };
}
