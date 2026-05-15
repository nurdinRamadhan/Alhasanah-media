import { supabaseClient } from "./supabaseClient";

interface LogParams {
    user: any; 
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT';
    resource: string;
    record_id?: string;
    details?: any;
}

const SENSITIVE_KEY_PATTERN = /(nama|nik|nisn|alamat|kontak|no_hp|phone|email|ayah|ibu|wali|tanggal_lahir|tempat_lahir|no_kk|no_kip|rekening|password)/i;

const sanitizeAuditDetails = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitizeAuditDetails);
    if (!value || typeof value !== "object") return value;
    if (value instanceof HTMLElement) return undefined;

    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key.startsWith("_")) continue;
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            out[key] = "[REDACTED]";
            continue;
        }
        if (child && typeof child === "object" && "type" in child && "props" in child) continue;
        out[key] = sanitizeAuditDetails(child);
    }
    return out;
};

export const logActivity = async ({ user, action, resource, record_id, details }: LogParams) => {
    // 1. CEGAH ERROR: Jika user kosong, batalkan
    if (!user) return;

    try {
        // 2. SANITASI USER (Hanya ambil data penting, buang sampah React)
        // Kita paksa ambil string/number saja
        const cleanUser = {
            id: user.id,
            name: typeof user.name === 'string' ? user.name : (user.email || 'Admin'),
            role: typeof user.role === 'string' ? user.role : 'Staff'
        };

        // 3. SANITASI DETAILS (Hapus Objek Circular/React Event)
        let cleanDetails = null;
        if (details) {
            try {
                // Trik: Stringify lalu Parse ulang untuk membuang referensi memori
                // Menggunakan replacer untuk membuang key yang berawalan '_' (biasanya internal React)
                const jsonString = JSON.stringify(sanitizeAuditDetails(details));
                cleanDetails = JSON.parse(jsonString);
            } catch (e) {
                cleanDetails = { error: "Data detail terlalu kompleks untuk disimpan" };
            }
        }

        // 4. KIRIM KE DATABASE
        await supabaseClient.from('audit_logs').insert({
            user_id: cleanUser.id,
            user_name: cleanUser.name,
            user_role: cleanUser.role,
            action,
            resource,
            record_id: record_id ? String(record_id) : '-',
            details: cleanDetails
        });

    } catch (error) {
        // Silent Error: Jangan biarkan aplikasi crash hanya karena gagal log
        console.warn("Gagal mencatat log aktivitas:", error);
    }
};
