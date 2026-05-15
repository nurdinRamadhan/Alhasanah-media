import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const adminRoles = new Set([
  "super_admin",
  "admin_kesantrian",
  "admin_bendahara",
  "kesantrian",
  "bendahara",
  "rois",
  "dewan",
]);

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Sesi admin tidak valid. Silakan login ulang.");

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role,is_active")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.is_active || !adminRoles.has(profile.role)) {
      throw new Error("Tidak berwenang mengupload foto santri.");
    }

    const formData = await req.formData();
    const nis = String(formData.get("nis") ?? "").replace(/[^0-9A-Za-z_-]/g, "");
    const file = formData.get("file");
    if (!nis) throw new Error("NIS wajib dikirim untuk upload foto.");
    if (!(file instanceof File)) throw new Error("File foto tidak ditemukan.");
    if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Ukuran foto maksimal 2MB.");

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `santri/${nis}_${Date.now()}.${ext}`;
    const { error: uploadError } = await adminClient.storage
      .from("images")
      .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: urlData } = adminClient.storage.from("images").getPublicUrl(path);
    return json({ path, publicUrl: urlData.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal.";
    return json({ error: message }, 400);
  }
});
