import { AuthBindings } from "@refinedev/core";
import { supabaseClient } from "./utility/supabaseClient";
import { IUserIdentity, TRole, TGenderScope, TJurusanScope } from "./types";

export const authProvider: AuthBindings = {
  // --- BAGIAN INI TIDAK DIUBAH (Sesuai kode asli Anda) ---
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
          error: { 
            message: error.message, 
            name: "Login Error" 
          } 
        };
      }

      if (data.session) {
        // Ambil profil user
        const { data: profile, error: profileError } = await supabaseClient
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single();

        if (profileError) {
          console.warn("Profile fetch error (login tetap dilanjutkan):", profileError.message);
        }

        // Tentukan redirect URL berdasarkan role (fallback ke dashboard /)
        let targetUrl = "/";
        const role = profile?.role || "dewan"; // Gunakan default jika null

        if (role === "kesantrian") {
          targetUrl = "/santri";
        } else if (role === "bendahara") {
          targetUrl = "/tagihan";
        }

        return {
          success: true,
          redirectTo: targetUrl,
        };
      }

      return { 
        success: false, 
        error: { 
          message: "Gagal memuat sesi", 
          name: "Session Error" 
        } 
      };
    } catch (err: Error | unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("Unexpected login error:", error);
      return {
        success: false,
        error: {
          message: error.message || "Terjadi kesalahan tidak terduga",
          name: "Unknown Error"
        }
      };
    }
  },
  logout: async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) return { success: false, error };
    return { success: true, redirectTo: "/login" };
  },
  check: async () => {
    const { data } = await supabaseClient.auth.getSession();
    const { session } = data;
    if (!session) return { authenticated: false, redirectTo: "/login" };
    return { authenticated: true };
  },
  onError: async (error) => {
    console.error(error);
    return { error };
  },

  // --- BAGIAN YANGDIREVISI (Untuk RBAC) ---
  
  getPermissions: async () => {
    const { data: userDat } = await supabaseClient.auth.getUser();
    if (userDat.user) {
      const { data } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", userDat.user.id)
        .single();
      return data?.role || "dewan"; // Default fallback
    }
    return null;
  },

  getIdentity: async (): Promise<IUserIdentity | null> => {
    try {
      const { data: userDat } = await supabaseClient.auth.getUser();
      const { user } = userDat;

      if (user) {
        // Mengambil data lengkap dari tabel profiles sesuai skema baru
        const { data, error } = await supabaseClient
          .from("profiles")
          .select("full_name, foto_url, role, akses_gender, akses_jurusan")
          .eq("id", user.id)
          .single();

        if (error) {
          console.warn("Gagal mengambil data profil identity:", error.message);
        }

        return {
          id: user.id,
          name: data?.full_name || user.email || "User",
          avatar: data?.foto_url || user.user_metadata?.avatar_url,
          role: (data?.role as TRole) || "dewan",
          scopeGender: (data?.akses_gender as TGenderScope) || "ALL", 
          scopeJurusan: (data?.akses_jurusan as TJurusanScope) || "ALL"
        };
      }
    } catch (e) {
      console.error("Error in getIdentity:", e);
    }
    return null;
  },
};