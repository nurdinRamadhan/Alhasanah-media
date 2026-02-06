import { AuthBindings } from "@refinedev/core";
import { supabaseClient } from "./utility/supabaseClient";

// PERHATIKAN: Ada kata 'export' sebelum 'const'
export const authProvider: AuthBindings = {
  login: async ({ email, password }) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: {
          message: "Login Gagal",
          name: error.message,
        },
      };
    }

    if (data.session) {
      return {
        success: true,
        redirectTo: "/",
      };
    }

    return {
      success: false,
      error: {
        message: "Login Gagal",
        name: "Email atau password salah",
      },
    };
  },
  logout: async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      return { success: false, error };
    }
    return { success: true, redirectTo: "/login" };
  },
  check: async () => {
    const { data } = await supabaseClient.auth.getSession();
    const { session } = data;
    if (!session) {
      return { authenticated: false, redirectTo: "/login" };
    }
    return { authenticated: true };
  },
  getPermissions: async () => {
    const { data: userDat } = await supabaseClient.auth.getUser();
    if (userDat.user) {
      const { data } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", userDat.user.id)
        .single();
      return data?.role || "guest";
    }
    return null;
  },
  getIdentity: async () => {
    const { data: userDat } = await supabaseClient.auth.getUser();
    const { user } = userDat;
    if (user) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("nama_lengkap, avatar_url, role")
        .eq("id", user.id)
        .single();
      return {
        id: user.id,
        name: profile?.nama_lengkap || user.email,
        avatar: profile?.avatar_url || user.user_metadata?.avatar_url,
        role: profile?.role,
      };
    }
    return null;
  },
  onError: async (error) => {
    console.error(error);
    return { error };
  },
};