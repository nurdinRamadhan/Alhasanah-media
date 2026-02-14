import { AuthBindings } from "@refinedev/core";
import { supabaseClient } from "./utility/supabaseClient";
import { IUserIdentity, IProfile } from "./types";

export const authProvider: AuthBindings = {
  // --- BAGIAN INI TIDAK DIUBAH (Sesuai kode asli Anda) ---
  login: async ({ email, password }) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { success: false, error: { message: "Login Gagal", name: error.message } };

    if (data.session) {
      // 1. Cek rolenya dari database
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();

      // 2. Arahkan URL (Redirect) berdasarkan Role
      let targetUrl = "/"; // Default (Super Admin, Dewan, Rois ke Dashboard)
      
      if (profile?.role === "kesantrian") {
          targetUrl = "/santri"; // Arahkan kesantrian langsung ke halaman Data Santri
      } else if (profile?.role === "bendahara") {
          targetUrl = "/tagihan"; // Arahkan bendahara langsung ke halaman Keuangan
      }

      return {
        success: true,
        redirectTo: targetUrl, // <- Arahkan ke target URL yang sesuai
      };
    }

    return { success: false, error: { message: "Login Gagal", name: "Gagal memuat sesi" } };
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
    const { data: userDat } = await supabaseClient.auth.getUser();
    const { user } = userDat;

    if (user) {
      // Mengambil data lengkap dari tabel profiles sesuai skema baru
      const { data } = await supabaseClient
        .from("profiles")
        .select("full_name, foto_url, role, akses_gender, akses_jurusan")
        .eq("id", user.id)
        .single();

      const profile = data as unknown as IProfile; // Casting aman

      return {
        id: user.id,
        name: profile?.full_name || user.email || "User",
        avatar: profile?.foto_url || user.user_metadata?.avatar_url,
        role: profile?.role || "dewan",
        // Penting untuk filter data (Putra/Putri/Kitab/Tahfidz)
        scopeGender: profile?.akses_gender || "ALL", 
        scopeJurusan: profile?.akses_jurusan || "ALL"
      };
    }
    return null;
  },
};