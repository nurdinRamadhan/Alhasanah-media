-- ============================================================
-- MIGRATION: Absensi Optimization for Production Readiness
-- Created: 2026-06-18
-- Changes:
--   1. Enable RLS on attendance_types & attendance_categories
--   2. Add RLS policies for both tables
--   3. Recreate view_attendance_reports with security_invoker
--   4. Add missing indexes for performance
--   5. Add SET search_path to SECURITY DEFINER functions
--   6. Create bulk_mark_attendance RPC
--   7. Create close_attendance_session RPC
--   8. Create populate_session_records RPC
--   9. Create ALPA notification trigger
--  10. Add recorded_at column to attendance_records
--  11. Add mode column to attendance_sessions (manual/live)
--  12. Add qr_code_id column to santri
--  13. Update quick_start_attendance_session with p_mode param
--  14. Update mark_attendance & bulk_mark_attendance for recorded_at
--  15. Create finalize_scan RPC
--  16. Create trigger for auto qr_code_id on santri
-- ============================================================

-- 1. Enable RLS
ALTER TABLE public.attendance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_categories ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies for attendance_categories
DROP POLICY IF EXISTS "Categories read all authenticated" ON public.attendance_categories;
CREATE POLICY "Categories read all authenticated" ON public.attendance_categories
  FOR SELECT TO authenticated USING (true);

-- 3. RLS Policies for attendance_types
DROP POLICY IF EXISTS "Staff manage attendance types" ON public.attendance_types;
CREATE POLICY "Staff manage attendance types" ON public.attendance_types
  FOR ALL TO authenticated
  USING (is_attendance_staff())
  WITH CHECK (is_attendance_staff());

DROP POLICY IF EXISTS "authenticated view attendance types" ON public.attendance_types;
CREATE POLICY "authenticated view attendance types" ON public.attendance_types
  FOR SELECT TO authenticated USING (true);

-- 4. Recreate view with security_invoker
DROP VIEW IF EXISTS public.view_attendance_reports;
CREATE VIEW public.view_attendance_reports WITH (security_invoker = true) AS
SELECT
  r.id AS record_id,
  s.id AS session_id,
  t.name AS activity_name,
  cat.label AS category_label,
  s.attendance_date,
  sn.nis,
  sn.nama AS santri_nama,
  sn.kelas,
  sn.jurusan,
  r.status,
  r.note,
  r.marked_at,
  p.full_name AS marked_by_name
FROM public.attendance_records r
  JOIN public.attendance_sessions s ON r.session_id = s.id
  JOIN public.attendance_types t ON s.type_id = t.id
  JOIN public.attendance_categories cat ON t.category_id = cat.id
  JOIN public.santri sn ON r.santri_nis = sn.nis
  LEFT JOIN public.profiles p ON r.marked_by = p.id;

-- 5. Missing indexes
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_type_id ON public.attendance_sessions (type_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_jurusan ON public.attendance_sessions (jurusan);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_created_by ON public.attendance_sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date_status ON public.attendance_sessions (attendance_date, status);
CREATE INDEX IF NOT EXISTS idx_attendance_types_category_id ON public.attendance_types (category_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_by ON public.attendance_records (marked_by);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_marked ON public.attendance_records (session_id, marked_at DESC);

-- 6. Fix SECURITY DEFINER functions with search_path
CREATE OR REPLACE FUNCTION public.can_manage_attendance_type(p_type_id UUID)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_jurusan TEXT;
    v_target_jurusan TEXT;
    v_user_role TEXT;
BEGIN
    SELECT role, akses_jurusan INTO v_user_role, v_user_jurusan FROM public.profiles WHERE id = auth.uid();

    IF v_user_role IN ('super_admin', 'rois') THEN RETURN true; END IF;

    SELECT target_jurusan INTO v_target_jurusan FROM public.attendance_types WHERE id = p_type_id;

    IF v_user_jurusan != 'ALL' THEN
        IF v_target_jurusan IS NOT NULL AND v_target_jurusan != v_user_jurusan THEN
            RETURN false;
        END IF;
    END IF;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_start_attendance_session(p_type_id UUID)
RETURNS public.attendance_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_type public.attendance_types;
    v_new_session public.attendance_sessions;
BEGIN
    IF NOT public.can_manage_attendance_type(p_type_id) THEN
        RAISE EXCEPTION 'Anda tidak memiliki akses untuk membuat sesi kegiatan ini.';
    END IF;

    SELECT * INTO v_type FROM public.attendance_types WHERE id = p_type_id;

    INSERT INTO public.attendance_sessions (
        type_id, jurusan, attendance_date, starts_at, ends_at, status, created_by
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
$$;

DROP FUNCTION IF EXISTS public.mark_attendance(p_session_id UUID, p_santri_nis TEXT, p_status TEXT, p_note TEXT);

CREATE OR REPLACE FUNCTION public.mark_attendance(
    p_session_id UUID,
    p_santri_nis TEXT,
    p_status TEXT,
    p_note TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'manual'
)
RETURNS public.attendance_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_record public.attendance_records;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;

    INSERT INTO public.attendance_records (
        session_id, santri_nis, status, note, source, marked_by, marked_at, created_at, updated_at
    ) VALUES (
        p_session_id, p_santri_nis, p_status, p_note, p_source, auth.uid(), now(), now(), now()
    )
    ON CONFLICT (session_id, santri_nis)
    DO UPDATE SET
        status = EXCLUDED.status,
        note = COALESCE(EXCLUDED.note, attendance_records.note),
        source = EXCLUDED.source,
        marked_by = EXCLUDED.marked_by,
        marked_at = EXCLUDED.marked_at,
        updated_at = now()
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;

-- 7. Bulk mark_attendance RPC
CREATE OR REPLACE FUNCTION public.bulk_mark_attendance(
    p_session_id UUID,
    p_entries JSONB,
    p_source TEXT DEFAULT 'bulk'
)
RETURNS TABLE(affected_rows INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_entry JSONB;
    v_santri_nis TEXT;
    v_status TEXT;
    v_note TEXT;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;

    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
    LOOP
        v_santri_nis := v_entry->>'santri_nis';
        v_status := v_entry->>'status';
        v_note := v_entry->>'note';

        INSERT INTO public.attendance_records (
            session_id, santri_nis, status, note, source, marked_by, marked_at, created_at, updated_at
        ) VALUES (
            p_session_id, v_santri_nis, v_status, v_note, p_source, auth.uid(), now(), now(), now()
        )
        ON CONFLICT (session_id, santri_nis)
        DO UPDATE SET
            status = EXCLUDED.status,
            note = COALESCE(EXCLUDED.note, attendance_records.note),
            source = EXCLUDED.source,
            marked_by = EXCLUDED.marked_by,
            marked_at = EXCLUDED.marked_at,
            updated_at = now();

        v_count := v_count + 1;
    END LOOP;

    RETURN QUERY SELECT v_count;
END;
$$;

-- 8. Session auto-close RPC
CREATE OR REPLACE FUNCTION public.close_attendance_session(p_session_id UUID)
RETURNS public.attendance_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_session public.attendance_sessions;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;

    UPDATE public.attendance_sessions
    SET status = 'closed',
        closed_by = auth.uid(),
        closed_at = now(),
        updated_at = now()
    WHERE id = p_session_id AND status = 'open'
    RETURNING * INTO v_session;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesi tidak ditemukan atau sudah ditutup.';
    END IF;

    RETURN v_session;
END;
$$;

-- 9. Auto-populate attendance records for a session
CREATE OR REPLACE FUNCTION public.populate_session_records(p_session_id UUID)
RETURNS TABLE(santri_nis TEXT, santri_nama TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_session public.attendance_sessions;
    v_jurusan_filter TEXT;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;

    SELECT * INTO v_session FROM public.attendance_sessions WHERE id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesi tidak ditemukan.';
    END IF;

    v_jurusan_filter := v_session.jurusan;

    INSERT INTO public.attendance_records (session_id, santri_nis, status, source, marked_by, marked_at)
    SELECT
        p_session_id,
        s.nis,
        'BELUM_DIABSEN',
        'system',
        auth.uid(),
        now()
    FROM public.santri s
    WHERE (s.status_santri IS NULL OR s.status_santri = 'AKTIF')
      AND (v_jurusan_filter IS NULL OR s.jurusan = v_jurusan_filter)
      AND NOT EXISTS (
          SELECT 1 FROM public.attendance_records r
          WHERE r.session_id = p_session_id AND r.santri_nis = s.nis
      )
    RETURNING nis, (SELECT nama FROM public.santri WHERE nis = santri_nis);
END;
$$;

-- 10. ALPA notification trigger
CREATE OR REPLACE FUNCTION public.notify_wali_on_alpa()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_session_info RECORD;
    v_santri_nama TEXT;
BEGIN
    IF NEW.status IN ('ALFA', 'ALPA') AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT s.attendance_date, t.name AS activity_name
        INTO v_session_info
        FROM public.attendance_sessions s
        JOIN public.attendance_types t ON t.id = s.type_id
        WHERE s.id = NEW.session_id;

        SELECT nama INTO v_santri_nama FROM public.santri WHERE nis = NEW.santri_nis;

        PERFORM public.wallet_notify_wali(
            NEW.santri_nis,
            'Ketidakhadiran Santri',
            v_santri_nama || ' tercatat ALPA pada kegiatan ' || COALESCE(v_session_info.activity_name, '-') ||
            ' tanggal ' || COALESCE(v_session_info.attendance_date::TEXT, '-') || '.',
            'absensi.alpa',
            'attendance_records',
            jsonb_build_object(
                'santri_nis', NEW.santri_nis,
                'santri_nama', v_santri_nama,
                'session_id', NEW.session_id,
                'activity_name', v_session_info.activity_name,
                'attendance_date', v_session_info.attendance_date
            ),
            'high',
            NEW.id::TEXT
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_attendance_notify_wali_on_alpa ON public.attendance_records;
CREATE TRIGGER tr_attendance_notify_wali_on_alpa
    AFTER INSERT OR UPDATE OF status ON public.attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_wali_on_alpa();

-- 11. Permissions
GRANT EXECUTE ON FUNCTION public.bulk_mark_attendance(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_attendance_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.populate_session_records(UUID) TO authenticated;

-- ============================================================
-- PHASE 2: recorded_at, mode, QR scan support
-- ============================================================

-- 12. recorded_at di attendance_records
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ;
COMMENT ON COLUMN public.attendance_records.recorded_at IS 
  'Waktu kejadian absensi sebenarnya. Manual mode = session.starts_at, Live mode = now(), QR scan = now()';

-- 13. mode di attendance_sessions
ALTER TABLE public.attendance_sessions
ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'manual'
CHECK (mode IN ('manual', 'live'));
COMMENT ON COLUMN public.attendance_sessions.mode IS 
  'manual = catat setelah kegiatan, live = real-time saat kegiatan';

-- 14. qr_code_id di santri
ALTER TABLE public.santri 
ADD COLUMN IF NOT EXISTS qr_code_id UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_santri_qr_code_id ON public.santri (qr_code_id);

-- 15. Update quick_start_attendance_session — tambah p_mode
DROP FUNCTION IF EXISTS public.quick_start_attendance_session(UUID);
CREATE OR REPLACE FUNCTION public.quick_start_attendance_session(
    p_type_id UUID,
    p_mode TEXT DEFAULT 'manual'
)
RETURNS public.attendance_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_type public.attendance_types;
    v_new_session public.attendance_sessions;
BEGIN
    IF p_mode NOT IN ('manual', 'live') THEN
        RAISE EXCEPTION 'Mode harus manual atau live';
    END IF;
    IF NOT public.can_manage_attendance_type(p_type_id) THEN
        RAISE EXCEPTION 'Anda tidak memiliki akses untuk membuat sesi kegiatan ini.';
    END IF;
    SELECT * INTO v_type FROM public.attendance_types WHERE id = p_type_id;

    -- Derive session_type from time (pagi/siang/sore/malam)
    INSERT INTO public.attendance_sessions (
        type_id, jurusan, attendance_date, starts_at, ends_at,
        status, mode, session_type, created_by
    ) VALUES (
        p_type_id,
        v_type.target_jurusan,
        CURRENT_DATE,
        (CURRENT_DATE + COALESCE(v_type.default_starts_at, '07:00'::TIME))::timestamptz,
        (CURRENT_DATE + COALESCE(v_type.default_ends_at, '08:00'::TIME))::timestamptz,
        'open',
        p_mode,
        CASE
            WHEN COALESCE(v_type.default_starts_at, '07:00'::TIME) < '12:00'::TIME THEN 'pagi'
            WHEN COALESCE(v_type.default_starts_at, '07:00'::TIME) < '15:00'::TIME THEN 'siang'
            WHEN COALESCE(v_type.default_starts_at, '07:00'::TIME) < '18:00'::TIME THEN 'sore'
            ELSE 'malam'
        END,
        auth.uid()
    )
    RETURNING * INTO v_new_session;
    RETURN v_new_session;
END;
$$;

-- 16. Update populate_session_records — recorded_at sesuai mode
DROP FUNCTION IF EXISTS public.populate_session_records(UUID);
CREATE OR REPLACE FUNCTION public.populate_session_records(p_session_id UUID)
RETURNS TABLE(santri_nis TEXT, santri_nama TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_session public.attendance_sessions;
    v_jurusan_filter TEXT;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;
    SELECT * INTO v_session FROM public.attendance_sessions WHERE id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesi tidak ditemukan.';
    END IF;
    v_jurusan_filter := v_session.jurusan;
    INSERT INTO public.attendance_records (session_id, santri_nis, status, source, marked_by, marked_at, recorded_at)
    SELECT
        p_session_id, s.nis, 'BELUM_DIABSEN', 'system', auth.uid(), now(),
        CASE WHEN v_session.mode = 'live' THEN now() ELSE v_session.starts_at END
    FROM public.santri s
    WHERE (s.status_santri IS NULL OR s.status_santri = 'AKTIF')
      AND (v_jurusan_filter IS NULL OR s.jurusan = v_jurusan_filter)
      AND NOT EXISTS (
          SELECT 1 FROM public.attendance_records r
          WHERE r.session_id = p_session_id AND r.santri_nis = s.nis
      )
    RETURNING nis, (SELECT nama FROM public.santri WHERE nis = santri_nis);
END;
$$;

-- 17. Update mark_attendance — recorded_at logic
DROP FUNCTION IF EXISTS public.mark_attendance(UUID, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.mark_attendance(
    p_session_id UUID, p_santri_nis TEXT, p_status TEXT,
    p_note TEXT DEFAULT NULL, p_source TEXT DEFAULT 'manual'
)
RETURNS public.attendance_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_record public.attendance_records;
    v_session public.attendance_sessions;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;
    SELECT * INTO v_session FROM public.attendance_sessions WHERE id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesi tidak ditemukan.';
    END IF;
    INSERT INTO public.attendance_records (
        session_id, santri_nis, status, note, source,
        marked_by, marked_at, recorded_at, created_at, updated_at
    ) VALUES (
        p_session_id, p_santri_nis, p_status, p_note, p_source,
        auth.uid(), now(),
        CASE 
            WHEN p_source = 'qr' THEN now()
            WHEN v_session.mode = 'live' THEN now()
            ELSE v_session.starts_at
        END,
        now(), now()
    )
    ON CONFLICT (session_id, santri_nis)
    DO UPDATE SET
        status = EXCLUDED.status,
        note = COALESCE(EXCLUDED.note, attendance_records.note),
        source = EXCLUDED.source,
        marked_by = EXCLUDED.marked_by,
        marked_at = EXCLUDED.marked_at,
        recorded_at = COALESCE(attendance_records.recorded_at, EXCLUDED.recorded_at),
        updated_at = now()
    RETURNING * INTO v_record;
    RETURN v_record;
END;
$$;

-- 18. Update bulk_mark_attendance — recorded_at logic
DROP FUNCTION IF EXISTS public.bulk_mark_attendance(UUID, JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.bulk_mark_attendance(
    p_session_id UUID, p_entries JSONB, p_source TEXT DEFAULT 'bulk'
)
RETURNS TABLE(affected_rows INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_entry JSONB;
    v_santri_nis TEXT;
    v_status TEXT;
    v_note TEXT;
    v_session public.attendance_sessions;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;
    SELECT * INTO v_session FROM public.attendance_sessions WHERE id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesi tidak ditemukan.';
    END IF;
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
    LOOP
        v_santri_nis := v_entry->>'santri_nis';
        v_status := v_entry->>'status';
        v_note := v_entry->>'note';
        INSERT INTO public.attendance_records (
            session_id, santri_nis, status, note, source,
            marked_by, marked_at, recorded_at, created_at, updated_at
        ) VALUES (
            p_session_id, v_santri_nis, v_status, v_note, p_source,
            auth.uid(), now(),
            CASE WHEN v_session.mode = 'live' THEN now() ELSE v_session.starts_at END,
            now(), now()
        )
        ON CONFLICT (session_id, santri_nis)
        DO UPDATE SET
            status = EXCLUDED.status,
            note = COALESCE(EXCLUDED.note, attendance_records.note),
            source = EXCLUDED.source,
            marked_by = EXCLUDED.marked_by,
            marked_at = EXCLUDED.marked_at,
            recorded_at = COALESCE(attendance_records.recorded_at, EXCLUDED.recorded_at),
            updated_at = now();
        v_count := v_count + 1;
    END LOOP;
    RETURN QUERY SELECT v_count;
END;
$$;

-- 19. finalize_scan — set BELUM_DIABSEN jadi ALFA
CREATE OR REPLACE FUNCTION public.finalize_scan(p_session_id UUID)
RETURNS TABLE(affected_rows INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_count INT;
    v_session public.attendance_sessions;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;
    SELECT * INTO v_session FROM public.attendance_sessions WHERE id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesi tidak ditemukan.';
    END IF;
    IF v_session.mode != 'live' THEN
        RAISE EXCEPTION 'finalize_scan hanya untuk sesi mode live';
    END IF;
    UPDATE public.attendance_records
    SET status = 'ALFA', source = 'system',
        recorded_at = COALESCE(recorded_at, now()), updated_at = now()
    WHERE session_id = p_session_id
      AND (status = 'BELUM_DIABSEN' OR status IS NULL);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$;

-- 20. Trigger otomatis qr_code_id untuk santri baru
CREATE OR REPLACE FUNCTION public.ensure_santri_qr_code()
RETURNS TRIGGER
LANGUAGE plpgsQL SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NEW.qr_code_id IS NULL THEN
        NEW.qr_code_id := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_santri_ensure_qr_code ON public.santri;
CREATE TRIGGER tr_santri_ensure_qr_code
    BEFORE INSERT ON public.santri
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_santri_qr_code();

-- 21. Backfill QR code untuk santri existing
UPDATE public.santri SET qr_code_id = gen_random_uuid() WHERE qr_code_id IS NULL;

-- 22. Fix populate_attendance_records_for_session — NEW.kelas reference + tipe_jurusan vs text type mismatch
CREATE OR REPLACE FUNCTION public.populate_attendance_records_for_session()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.attendance_records (session_id, santri_nis, status, source, marked_by, marked_at)
    SELECT NEW.id, s.nis, 'BELUM_DIABSEN', 'system', NEW.created_by, now()
    FROM public.santri s
    WHERE s.status_santri = 'AKTIF'
      AND (NEW.jurusan IS NULL OR s.jurusan::text = NEW.jurusan)
    ON CONFLICT (session_id, santri_nis) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 23. Fix populate_session_records — tipe_jurusan vs text type mismatch
DROP FUNCTION IF EXISTS public.populate_session_records(UUID);
CREATE OR REPLACE FUNCTION public.populate_session_records(p_session_id UUID)
RETURNS TABLE(santri_nis TEXT, santri_nama TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_session public.attendance_sessions;
    v_jurusan_filter TEXT;
BEGIN
    IF NOT public.is_attendance_staff() THEN
        RAISE EXCEPTION 'Akses ditolak. Anda bukan staff absensi.';
    END IF;
    SELECT * INTO v_session FROM public.attendance_sessions WHERE id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesi tidak ditemukan.';
    END IF;
    v_jurusan_filter := v_session.jurusan;
    INSERT INTO public.attendance_records (session_id, santri_nis, status, source, marked_by, marked_at, recorded_at)
    SELECT
        p_session_id, s.nis, 'BELUM_DIABSEN', 'system', auth.uid(), now(),
        CASE WHEN v_session.mode = 'live' THEN now() ELSE v_session.starts_at END
    FROM public.santri s
    WHERE (s.status_santri IS NULL OR s.status_santri = 'AKTIF')
      AND (v_jurusan_filter IS NULL OR s.jurusan::text = v_jurusan_filter)
      AND NOT EXISTS (
          SELECT 1 FROM public.attendance_records r
          WHERE r.session_id = p_session_id AND r.santri_nis = s.nis
      )
    RETURNING nis, (SELECT nama FROM public.santri WHERE nis = santri_nis);
END;
$$;

-- 24. Grant permissions
GRANT EXECUTE ON FUNCTION public.finalize_scan(UUID) TO authenticated;
