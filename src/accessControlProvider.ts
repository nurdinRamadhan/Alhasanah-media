import { AccessControlProvider, CanParams } from "@refinedev/core";
import { authProvider } from "./authProvider";
import { IUserIdentity } from "./types";

// In-memory cache to prevent redundant API calls during a single render cycle or session
let cachedRole: string | null = null;
let cachedUserId: string | null = null;
let identityPromise: Promise<IUserIdentity | null> | null = null;

const getCachedIdentity = async () => {
    if (!identityPromise) {
        identityPromise = Promise.resolve(authProvider.getIdentity?.() as Promise<IUserIdentity | null>)
            .finally(() => {
                identityPromise = null;
            });
    }

    return identityPromise;
};

const getCanonicalResource = (resource?: string) => {
    if (!resource) return "";
    if (resource === "diklat_list" || resource === "diklat_master") return "diklat";
    if (resource === "forum_threads") return "forum_moderation_actions";
    if (resource === "alumni_data" || resource === "forum_reports" || resource === "chat_monitoring" || resource === "forum_moderation_actions") return resource;
    return resource;
};

const backendCommandCenterResources = [
    "backend_command_center",
    "backend_self_healing",
    "backend_diagnostics",
    "backend_private_audit_log",
];

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }: CanParams) => {
    const identity = await getCachedIdentity();
    if (!identity) {
      cachedRole = null;
      cachedUserId = null;
      return { can: false, reason: "Unauthorized" };
    }

    let role = "";
    if (cachedUserId === identity.id && cachedRole !== null) {
      role = cachedRole;
    } else {
      role = (identity.role || "").toLowerCase();
      cachedRole = role;
      cachedUserId = identity.id;
    }

    const targetResource = getCanonicalResource(resource);

    if (backendCommandCenterResources.includes(targetResource)) {
        return role === "super_admin"
            ? { can: true }
            : { can: false, reason: "Akses ditolak. Backend Command Center khusus super admin." };
    }

    // 1. SUPER ADMIN, ROIS, & DEWAN (Bebas Akses Semua Sidebar)
    if (["super_admin", "rois", "dewan"].includes(role)) {
        if (role === "dewan") {
            if (targetResource === "notification_queue" && action === "create") {
                return { can: true };
            }
            if (targetResource === "rag_knowledge" && ["list", "show"].includes(action || "")) {
                return { can: true };
            }
            // Dewan diizinkan CRUD untuk modul absensi
            if (["attendance_sessions", "attendance_types"].includes(targetResource)) {
                return { can: true };
            }
            if (["create", "edit", "delete"].includes(action || "")) {
                return { can: false, reason: "Dewan hanya memiliki akses pemantauan (Read-Only) pada modul lain." };
            }
        }
        return { can: true };
    }

    // 2. KESANTRIAN
    if (role === "kesantrian") {
        const allowedKesantrian = [
            "data_pesantren_menu",
            "kesantrian_menu", "pelanggaran_santri", "kesehatan_santri", "perizinan_santri",
            "prestasi_santri", "akademik_menu", "tahfidz_menu", "hafalan_tahfidz", "murojaah_tahfidz", "hafalan_kitab",
            "ulangan_menu", "weekly_tests", "ulangan_arsip",
            "santri", "diklat", "berita", "komunikasi_menu", "alumni_menu", "alumni_data", "forum_reports", "chat_monitoring",
            "forum_threads", "forum_comments", "forum_moderation_actions",
            "attendance_sessions" // Izin untuk fitur absensi
        ];
        
        if (allowedKesantrian.includes(targetResource)) {
            // Kesantrian tidak diizinkan akses attendance_types
            if (targetResource === "attendance_types") {
                return { can: false, reason: "Akses ditolak. Pengaturan tipe absensi khusus Dewan/Rois/Admin." };
            }
            return { can: true };
        }
        return { can: false, reason: "Akses ditolak. Khusus Kesantrian." };
    }

    // 3. BENDAHARA
    if (role === "bendahara") {
        const allowedBendahara = [
            "data_pesantren_menu", "keuangan_menu", "ref_jenis_pembayaran", "tagihan_santri", "transaksi_keuangan",
            "dompet_menu", "dompet_santri", "dompet_operasional", "dompet_security_audit",
            "kantin_management", "pengeluaran", "santri", "akademik_menu", "diklat",
            "operasional_menu", "inventaris"
        ];

        if (allowedBendahara.includes(targetResource)) {
            if (targetResource === "santri" && ["create", "edit", "delete"].includes(action || "")) {
                return { can: false, reason: "Bendahara tidak bisa mengedit data santri." };
            }
            return { can: true };
        }
        return { can: false, reason: "Akses ditolak. Khusus Bendahara." };
    }

    // 4. KANTIN
    if (role === "kantin") {
        const allowedKantin = ["dompet_menu", "dompet_santri"];
        if (allowedKantin.includes(targetResource)) {
            if (["create", "edit", "delete"].includes(action || "")) {
                return { can: false, reason: "Kantin hanya dapat melihat dan memproses transaksi melalui alur QR." };
            }
            return { can: true };
        }
        return { can: false, reason: "Akses ditolak. Khusus Kantin." };
    }

    return { can: false };
  },
};
