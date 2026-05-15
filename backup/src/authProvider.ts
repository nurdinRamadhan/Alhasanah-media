import { AuthBindings } from "@refinedev/core";
import { supabaseClient } from "./utility/supabaseClient";
import { IUserIdentity, TRole, TGenderScope, TJurusanScope } from "./types";

// ── AUTH CACHE & SINGLETON ──
// Mencegah error "lock request is aborted" dengan memastikan hanya ada 1 request getUser aktif
let identityCache: IUserIdentity | null = null;
let identityPromise: Promise<IUserIdentity | null> | null = null;

export const authProvider: AuthBindings = {
  login: async ({ email, password }) => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("Supabase Auth Error:", error.message);
        return { 
          success: false, 
          error: { message: error.message, name: "Login Error" } 
        };
      }

      if (data.session) {
        // Reset cache setelah login sukses
        identityCache = null;
        identityPromise = null;

        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single();

        let targetUrl = "/";
        const role = profile?.role || "dewan";

        if (role === "kesantrian") targetUrl = "/santri";
        else if (role === "bendahara") targetUrl = "/tagihan";

        return { success: true, redirectTo: targetUrl };
      }

      return { success: false, error: { message: "Gagal memuat sesi", name: "Session Error" } };
    } catch (err: any) {
      return { success: false, error: { message: err.message || "Login gagal", name: "Unknown Error" } };
    }
  },

  logout: async () => {
    identityCache = null;
    identityPromise = null;
    const { error } = await supabaseClient.auth.signOut();
    if (error) return { success: false, error };
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return { authenticated: false, redirectTo: "/login" };
        return { authenticated: true };
    } catch (e) {
        return { authenticated: false, redirectTo: "/login" };
    }
  },

  onError: async (error) => {
    console.error(error);
    return { error };
  },

  getPermissions: async () => {
    const identity = await authProvider.getIdentity?.() as IUserIdentity | null;
    return identity?.role || null;
  },

  getIdentity: async (): Promise<IUserIdentity | null> => {
    // 1. Jika data sudah ada di RAM, langsung kembalikan (Sangat Cepat)
    if (identityCache) return identityCache;

    // 2. Jika ada request yang sedang berjalan, tunggu request yang sama (Singleton)
    // Ini mencegah error "DOMException: The lock request is aborted"
    if (identityPromise) return identityPromise;

    identityPromise = (async () => {
      try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError || !user) {
          identityCache = null;
          return null;
        }

        const { data, error } = await supabaseClient
          .from("profiles")
          .select("full_name, foto_url, role, akses_gender, akses_jurusan")
          .eq("id", user.id)
          .single();

        if (error) {
          console.warn("Gagal mengambil data profil identity:", error.message);
        }

        const result: IUserIdentity = {
          id: user.id,
          name: data?.full_name || user.email || "User",
          avatar: data?.foto_url || user.user_metadata?.avatar_url,
          role: (data?.role as TRole) || "dewan",
          scopeGender: (data?.akses_gender as TGenderScope) || "ALL", 
          scopeJurusan: (data?.akses_jurusan as TJurusanScope) || "ALL"
        };

        identityCache = result;
        return result;
      } catch (e) {
        console.error("Error in getIdentity:", e);
        return null;
      } finally {
        // Reset promise agar request baru bisa dibuat jika nanti dibutuhkan
        identityPromise = null;
      }
    })();

    return identityPromise;
  },
};
