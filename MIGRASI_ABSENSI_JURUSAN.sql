-- ============================================================
-- MIGRATION: FULL ATTENDANCE AUTOMATION & RBAC JURUSAN
-- Jalankan script ini di SQL Editor Dashboard Supabase Anda
-- ============================================================

-- 1. ENHANCE ATTENDANCE TYPES (MASTER DATA)
-- Menambahkan default waktu dan target jurusan ke tipe kegiatan
ALTER TABLE public.attendance_types 
ADD COLUMN IF NOT EXISTS default_starts_at TIME,
ADD COLUMN IF NOT EXISTS default_ends_at TIME,
ADD COLUMN IF NOT EXISTS target_jurusan TEXT;

-- 2. ENHANCE ATTENDANCE SESSIONS
-- Menambahkan kolom jurusan agar filter RBAC di frontend berfungsi
ALTER TABLE public.attendance_sessions 
ADD COLUMN IF NOT EXISTS jurusan TEXT;

-- 3. PENGETATAN RBAC JURUSAN (FUNCTION)
-- Mengecek apakah seorang admin boleh mengelola tipe kegiatan tertentu
CREATE OR REPLACE FUNCTION public.can_manage_attendance_type(p_type_id UUID)
RETURNS boolean AS $$
DECLARE
    v_user_jurusan TEXT;
    v_target_jurusan TEXT;
    v_user_role TEXT;
BEGIN
    SELECT role, akses_jurusan INTO v_user_role, v_user_jurusan FROM public.profiles WHERE id = auth.uid();
    
    -- Super Admin & Rois bypass semua
    IF v_user_role IN ('super_admin', 'rois') THEN RETURN true; END IF;
    
    -- Ambil target jurusan dari tipe kegiatan
    SELECT target_jurusan INTO v_target_jurusan FROM public.attendance_types WHERE id = p_type_id;
    
    -- Jika user punya scope jurusan tertentu (bukan ALL), maka harus match
    IF v_user_jurusan != 'ALL' THEN
        IF v_target_jurusan IS NOT NULL AND v_target_jurusan != v_user_jurusan THEN
            RETURN false;
        END IF;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC UNTUK QUICK START SESSION (AUTOMATIC DATE & TIME)
-- Membuat sesi otomatis hanya dengan type_id
CREATE OR REPLACE FUNCTION public.quick_start_attendance_session(p_type_id UUID)
RETURNS public.attendance_sessions AS $$
DECLARE
    v_type public.attendance_types;
    v_new_session public.attendance_sessions;
BEGIN
    -- 1. Validasi akses
    IF NOT public.can_manage_attendance_type(p_type_id) THEN
        RAISE EXCEPTION 'Anda tidak memiliki akses untuk membuat sesi kegiatan ini.';
    END IF;

    -- 2. Ambil master data
    SELECT * INTO v_type FROM public.attendance_types WHERE id = p_type_id;

    -- 3. Insert sesi baru
    -- TANGGAL (attendance_date) otomatis terisi CURRENT_DATE (Hari ini)
    -- WAKTU (starts/ends) otomatis terisi dari Master Data
    INSERT INTO public.attendance_sessions (
        type_id,
        jurusan,
        attendance_date,
        starts_at,
        ends_at,
        status,
        created_by
    ) VALUES (
        p_type_id,
        v_type.target_jurusan,
        CURRENT_DATE, 
        COALESCE(v_type.default_starts_at, '07:00'::TIME),
        COALESCE(v_type.default_ends_at, '08:00'::TIME),
        'open',
        auth.uid()
    )
    RETURNING * INTO v_new_session;

    RETURN v_new_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. SINKRONISASI DATA LAMA
UPDATE public.attendance_sessions s
SET jurusan = t.target_jurusan
FROM public.attendance_types t
WHERE s.type_id = t.id AND s.jurusan IS NULL;

-- 6. PERMISSION
GRANT EXECUTE ON FUNCTION public.quick_start_attendance_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_attendance_type(UUID) TO authenticated;
