import { AccessControlProvider, CanParams } from "@refinedev/core";
import { supabaseClient } from "./utility/supabaseClient";

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }: CanParams) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return { can: false, reason: "Unauthorized" };

    // Ambil Role real-time dari DB
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // Pastikan selalu huruf kecil agar tidak error (Misal 'BENDAHARA' jadi 'bendahara')
    const role = (profile?.role || "").toLowerCase();

    // 1. SUPER ADMIN, ROIS, & DEWAN (Bebas Akses Semua Sidebar)
    if (["super_admin", "rois", "dewan"].includes(role)) {
        // Dewan hanya Read-Only (Tidak bisa Create/Edit/Delete)
        if (role === "dewan" && ["create", "edit", "delete"].includes(action || "")) {
            return { can: false, reason: "Dewan hanya memiliki akses pemantauan (Read-Only)." };
        }
        return { can: true };
    }

    // 2. KESANTRIAN
    if (role === "kesantrian") {
        const allowedKesantrian = [
            "kesantrian_menu", "pelanggaran_santri", "kesehatan_santri", "perizinan_santri", // Grup Kesantrian
            "tahfidz_menu", "hafalan_tahfidz", "murojaah_tahfidz", // Grup Tahfidz
            "santri", "diklat", "berita" // Menu Lainnya
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
            // Bendahara hanya boleh MELIHAT data santri, tidak boleh Edit/Hapus
            if (resource === "santri" && ["create", "edit", "delete"].includes(action || "")) {
                return { can: false, reason: "Bendahara tidak bisa mengedit data santri." };
            }
            return { can: true };
        }
        return { can: false, reason: "Akses ditolak. Khusus Bendahara." };
    }

    // Default: Tolak semua akses jika tidak terdaftar
    return { can: false };
  },
};