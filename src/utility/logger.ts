import { supabaseClient } from "./supabaseClient";

interface LogParams {
    user: any; 
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT';
    resource: string;
    record_id?: string;
    details?: any;
}

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
                const jsonString = JSON.stringify(details, (key, value) => {
                    if (key.startsWith('_')) return undefined; // Buang internal React
                    if (value && value.type && value.props) return undefined; // Buang Komponen React
                    if (value instanceof HTMLElement) return undefined; // Buang elemen HTML
                    return value;
                });
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