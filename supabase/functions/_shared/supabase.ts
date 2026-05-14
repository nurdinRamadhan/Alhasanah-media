import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export type SupabaseClient = ReturnType<typeof createClient>;

export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum tersedia.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function getAuthenticatedProfile(req: Request, supabase: SupabaseClient) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Token autentikasi wajib dikirim.");

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Token autentikasi tidak valid.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, akses_gender, akses_jurusan, is_active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) throw new Error("Profil pengguna tidak ditemukan.");
  if (profile.is_active === false) throw new Error("Akun tidak aktif.");

  return {
    id: userData.user.id,
    full_name: profile.full_name || userData.user.email || "User",
    role: String(profile.role || "").toLowerCase(),
    akses_gender: profile.akses_gender || "ALL",
    akses_jurusan: profile.akses_jurusan || "ALL",
  };
}

export function requireRole(profile: { role: string }, allowedRoles: string[]) {
  if (!allowedRoles.includes(profile.role)) {
    throw new Error("Role tidak memiliki akses.");
  }
}
