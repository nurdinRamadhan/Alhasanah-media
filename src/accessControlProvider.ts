import { AccessControlProvider, CanParams } from "@refinedev/core";
import { supabaseClient } from "./utility/supabaseClient";

// In-memory cache to prevent redundant API calls during a single render cycle or session
let cachedRole: string | null = null;
let cachedUserId: string | null = null;

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }: CanParams) => {
    // 1. Dapatkan user session
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      cachedRole = null;
      cachedUserId = null;
      return { can: false, reason: "Unauthorized" };
    }

    // 2. Gunakan cache jika userId sama, untuk menghindari pemanggilan DB berulang (30-60x)
    let role = "";
    if (cachedUserId === user.id && cachedRole !== null) {
      role = cachedRole;
    } else {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      role = (profile?.role || "").toLowerCase();
      cachedRole = role;
      cachedUserId = user.id;
    }

    // 1. SUPER ADMIN, ROIS, & DEWAN (Bebas Akses Semua Sidebar)
    if (["super_admin", "rois", "dewan"].includes(role)) {
        if (role === "dewan") {
            if (resource === "notification_queue" && action === "create") {
                return { can: true };
            }
            if (resource === "rag_knowledge" && ["list", "show"].includes(action || "")) {
                return { can: true };
            }
            if (["create", "edit", "delete"].includes(action || "")) {
                return { can: false, reason: "Dewan hanya memiliki akses pemantauan (Read-Only)." };
            }
        }
        return { can: true };
    }

    // 2. KESANTRIAN
    if (role === "kesantrian") {
        const allowedKesantrian = [
            "kesantrian_menu", "pelanggaran_santri", "kesehatan_santri", "perizinan_santri",
            "tahfidz_menu", "hafalan_tahfidz", "murojaah_tahfidz", "hafalan_kitab",
            "ulangan_menu", "weekly_tests", "ulangan_arsip",
            "santri", "diklat", "berita", "alumni_data", "forum_reports",
            "forum_threads", "forum_comments", "forum_moderation_actions"
        ];
        
        if (allowedKesantrian.includes(resource || "")) {
            return { can: true };
        }
        return { can: false, reason: "Akses ditolak. Khusus Kesantrian." };
    }

    // 3. BENDAHARA
    if (role === "bendahara") {
        const allowedBendahara = [
            "tagihan_santri", "pengeluaran", "santri", "diklat", "inventaris"
        ];

        if (allowedBendahara.includes(resource || "")) {
            if (resource === "santri" && ["create", "edit", "delete"].includes(action || "")) {
                return { can: false, reason: "Bendahara tidak bisa mengedit data santri." };
            }
            return { can: true };
        }
        return { can: false, reason: "Akses ditolak. Khusus Bendahara." };
    }

    return { can: false };
  },
};
