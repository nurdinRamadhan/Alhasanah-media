-- ============================================================
-- PETA HAFALAN: Interactive juz progress grid per santri
-- Tables: santri_peta_hafalan, peta_hafalan_snapshot
-- RPCs: get_peta_hafalan (admin), get_wali_peta_hafalan (wali),
--        upsert_peta_hafalan (admin write), get_peta_hafalan_mingguan,
--        capture_peta_snapshot
-- ============================================================

-- ── 1. Tabel santri_peta_hafalan (current state) ──
CREATE TABLE IF NOT EXISTS public.santri_peta_hafalan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    santri_nis TEXT NOT NULL REFERENCES public.santri(nis) ON DELETE CASCADE,
    juz INTEGER NOT NULL CHECK (juz >= 1 AND juz <= 30),
    is_completed BOOLEAN NOT NULL DEFAULT false,
    halaman_progress INTEGER NOT NULL DEFAULT 0 CHECK (halaman_progress >= 0),
    -- halaman_progress stored in quarter-pages: 1=¼, 2=½, 3=¾, 4=1, 5=1¼, ...
    catatan TEXT,
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_santri_juz UNIQUE (santri_nis, juz)
);

CREATE INDEX idx_peta_hafalan_santri ON public.santri_peta_hafalan(santri_nis);
CREATE INDEX idx_peta_hafalan_juz ON public.santri_peta_hafalan(juz);

COMMENT ON TABLE public.santri_peta_hafalan IS 'Current hafalan progress per santri per juz (Peta Hafalan feature)';

-- ── 2. Tabel peta_hafalan_snapshot (period snapshots) ──
CREATE TABLE IF NOT EXISTS public.peta_hafalan_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    santri_nis TEXT NOT NULL REFERENCES public.santri(nis) ON DELETE CASCADE,
    juz INTEGER NOT NULL CHECK (juz >= 1 AND juz <= 30),
    is_completed BOOLEAN NOT NULL DEFAULT false,
    halaman_progress INTEGER NOT NULL DEFAULT 0,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    snapshot_label TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_snapshot_santri_juz_date UNIQUE (santri_nis, juz, snapshot_date)
);

CREATE INDEX idx_snapshot_date ON public.peta_hafalan_snapshot(snapshot_date);
CREATE INDEX idx_snapshot_santri ON public.peta_hafalan_snapshot(santri_nis);

COMMENT ON TABLE public.peta_hafalan_snapshot IS 'Weekly snapshots of peta hafalan for delta comparison';

-- ── 3. Trigger updated_at ──
CREATE OR REPLACE FUNCTION public.handle_peta_hafalan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_peta_hafalan_updated_at
    BEFORE UPDATE ON public.santri_peta_hafalan
    FOR EACH ROW EXECUTE FUNCTION public.handle_peta_hafalan_updated_at();

-- ── 4. RLS Policies ──
ALTER TABLE public.santri_peta_hafalan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peta_hafalan_snapshot ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD
CREATE POLICY "peta_hafalan_admin_all"
    ON public.santri_peta_hafalan FOR ALL
    USING (public.is_admin_in_roles(ARRAY['super_admin', 'admin_akademik_tahfidz', 'kesantrian', 'rois']));

CREATE POLICY "peta_snapshot_admin_all"
    ON public.peta_hafalan_snapshot FOR ALL
    USING (public.is_admin_in_roles(ARRAY['super_admin', 'admin_akademik_tahfidz', 'kesantrian', 'rois']));

-- Wali: read-only own santri
CREATE POLICY "peta_hafalan_wali_select"
    ON public.santri_peta_hafalan FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.santri
        WHERE santri.nis = santri_peta_hafalan.santri_nis
        AND santri.wali_id = auth.uid()
    ));

CREATE POLICY "peta_snapshot_wali_select"
    ON public.peta_hafalan_snapshot FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.santri
        WHERE santri.nis = peta_hafalan_snapshot.santri_nis
        AND santri.wali_id = auth.uid()
    ));

-- ── 5. RPC: get_peta_hafalan (admin — all TAHFIDZ santri) ──
CREATE OR REPLACE FUNCTION public.get_peta_hafalan(
    p_kelas TEXT DEFAULT NULL
)
RETURNS TABLE (
    santri_nis TEXT,
    santri_nama TEXT,
    santri_kelas TEXT,
    santri_jurusan TEXT,
    santri_foto_url TEXT,
    juz INTEGER,
    is_completed BOOLEAN,
    halaman_progress INTEGER,
    total_juz_selesai BIGINT,
    total_halaman_progress NUMERIC
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH santri_totals AS (
        SELECT p3.santri_nis,
               COUNT(*) FILTER (WHERE p3.is_completed) AS total_juz_selesai,
               SUM(COALESCE(p3.halaman_progress, 0)) AS total_halaman_progress
        FROM public.santri_peta_hafalan p3
        GROUP BY p3.santri_nis
    )
    SELECT s.nis, s.nama, s.kelas::text, s.jurusan::text, s.foto_url,
           j, COALESCE(p.is_completed, false), COALESCE(p.halaman_progress, 0),
           COALESCE(st.total_juz_selesai, 0),
           COALESCE(st.total_halaman_progress, 0)
    FROM public.santri s
    CROSS JOIN generate_series(1, 30) AS j
    LEFT JOIN public.santri_peta_hafalan p ON p.santri_nis = s.nis AND p.juz = j
    LEFT JOIN santri_totals st ON st.santri_nis = s.nis
    WHERE s.status_santri = 'AKTIF'
      AND s.jurusan = 'TAHFIDZ'
      AND (p_kelas IS NULL OR s.kelas::text = p_kelas)
    ORDER BY s.nama, j;
$$;

GRANT EXECUTE ON FUNCTION public.get_peta_hafalan TO authenticated;

-- ── 6. RPC: get_wali_peta_hafalan (wali — own santri only) ──
CREATE OR REPLACE FUNCTION public.get_wali_peta_hafalan()
RETURNS TABLE (
    santri_nis TEXT,
    santri_nama TEXT,
    santri_kelas TEXT,
    santri_jurusan TEXT,
    santri_foto_url TEXT,
    juz INTEGER,
    is_completed BOOLEAN,
    halaman_progress INTEGER,
    total_juz_selesai BIGINT,
    total_halaman_progress NUMERIC
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    RETURN QUERY
    WITH santri_totals AS (
        SELECT p3.santri_nis,
               COUNT(*) FILTER (WHERE p3.is_completed) AS total_juz_selesai,
               SUM(COALESCE(p3.halaman_progress, 0)) AS total_halaman_progress
        FROM public.santri_peta_hafalan p3
        INNER JOIN public.santri s3 ON s3.nis = p3.santri_nis
        WHERE s3.wali_id = auth.uid()
        GROUP BY p3.santri_nis
    )
    SELECT s.nis, s.nama, s.kelas::text, s.jurusan::text, s.foto_url,
           j, COALESCE(pt.is_completed, false), COALESCE(pt.halaman_progress, 0),
           COALESCE(st.total_juz_selesai, 0),
           COALESCE(st.total_halaman_progress, 0)
    FROM public.santri s
    CROSS JOIN generate_series(1, 30) AS j
    LEFT JOIN public.santri_peta_hafalan pt ON pt.santri_nis = s.nis AND pt.juz = j
    LEFT JOIN santri_totals st ON st.santri_nis = s.nis
    WHERE s.status_santri = 'AKTIF'
      AND s.jurusan = 'TAHFIDZ'
      AND s.wali_id = auth.uid()
    ORDER BY s.nama, j;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wali_peta_hafalan TO authenticated;

-- ── 7. RPC: upsert_peta_hafalan (admin write only) ──
CREATE OR REPLACE FUNCTION public.upsert_peta_hafalan(
    p_santri_nis TEXT,
    p_juz INTEGER,
    p_is_completed BOOLEAN,
    p_halaman_progress INTEGER DEFAULT 0,
    p_catatan TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin_in_roles(ARRAY['super_admin', 'admin_akademik_tahfidz', 'kesantrian', 'rois']) THEN
        RAISE EXCEPTION 'Access denied: admin role required';
    END IF;

    INSERT INTO public.santri_peta_hafalan
        (santri_nis, juz, is_completed, halaman_progress, catatan, updated_by)
    VALUES (p_santri_nis, p_juz, p_is_completed, p_halaman_progress, p_catatan, auth.uid())
    ON CONFLICT (santri_nis, juz) DO UPDATE SET
        is_completed = EXCLUDED.is_completed,
        halaman_progress = EXCLUDED.halaman_progress,
        catatan = EXCLUDED.catatan,
        updated_by = auth.uid(),
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_peta_hafalan TO authenticated;

-- ── 8. RPC: get_peta_hafalan_mingguan (for weekly export) ──
CREATE OR REPLACE FUNCTION public.get_peta_hafalan_mingguan(
    p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    santri_nis TEXT,
    santri_nama TEXT,
    santri_kelas TEXT,
    juz INTEGER,
    awal_is_completed BOOLEAN,
    awal_halaman_progress INTEGER,
    akhir_is_completed BOOLEAN,
    akhir_halaman_progress INTEGER,
    delta_halaman INTEGER,
    delta_juz_selesai INTEGER
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH last_snapshot AS (
        SELECT DISTINCT santri_nis, juz, is_completed, halaman_progress
        FROM public.peta_hafalan_snapshot
        WHERE snapshot_date = (
            SELECT MAX(snapshot_date) FROM public.peta_hafalan_snapshot
            WHERE snapshot_date < p_snapshot_date
        )
    )
    SELECT s.nis, s.nama, s.kelas::text, p.juz,
           COALESCE(ls.is_completed, false), COALESCE(ls.halaman_progress, 0),
           p.is_completed, p.halaman_progress,
           ((CASE WHEN p.is_completed THEN 120 ELSE 0 END) + p.halaman_progress)
           - ((CASE WHEN COALESCE(ls.is_completed, false) THEN 120 ELSE 0 END)
              + COALESCE(ls.halaman_progress, 0)),
           (CASE WHEN p.is_completed THEN 1 ELSE 0 END)
           - (CASE WHEN COALESCE(ls.is_completed, false) THEN 1 ELSE 0 END)
    FROM public.santri s
    INNER JOIN public.santri_peta_hafalan p ON p.santri_nis = s.nis
    LEFT JOIN last_snapshot ls ON ls.santri_nis = s.nis AND ls.juz = p.juz
    WHERE s.status_santri = 'AKTIF'
      AND s.jurusan = 'TAHFIDZ'
    ORDER BY s.nama, p.juz;
$$;

GRANT EXECUTE ON FUNCTION public.get_peta_hafalan_mingguan TO authenticated;

-- ── 9. RPC: capture_peta_snapshot ──
CREATE OR REPLACE FUNCTION public.capture_peta_snapshot(
    p_snapshot_date DATE DEFAULT CURRENT_DATE,
    p_label TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF NOT public.is_admin_in_roles(ARRAY['super_admin', 'admin_akademik_tahfidz', 'kesantrian', 'rois']) THEN
        RAISE EXCEPTION 'Access denied: admin role required';
    END IF;

    INSERT INTO public.peta_hafalan_snapshot
        (santri_nis, juz, is_completed, halaman_progress, snapshot_date, snapshot_label)
    SELECT santri_nis, juz, is_completed, halaman_progress, p_snapshot_date, p_label
    FROM public.santri_peta_hafalan
    ON CONFLICT (santri_nis, juz, snapshot_date) DO UPDATE SET
        is_completed = EXCLUDED.is_completed,
        halaman_progress = EXCLUDED.halaman_progress,
        snapshot_label = EXCLUDED.snapshot_label;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_peta_snapshot TO authenticated;

-- ── 10. RPC: get_hafalan_surah_per_juz (for Daftar Surah export) ──
CREATE OR REPLACE FUNCTION public.get_hafalan_surah_per_juz(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    santri_nis TEXT,
    juz INTEGER,
    surah_list TEXT
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT h.santri_nis, h.juz,
           string_agg(DISTINCT h.surat, ', ' ORDER BY h.surat) AS surah_list
    FROM public.hafalan_tahfidz h
    INNER JOIN public.santri s ON s.nis = h.santri_nis
    WHERE s.status_santri = 'AKTIF'
      AND s.jurusan = 'TAHFIDZ'
      AND h.surat IS NOT NULL
      AND (p_start_date IS NULL OR h.tanggal >= p_start_date)
      AND (p_end_date IS NULL OR h.tanggal <= p_end_date)
    GROUP BY h.santri_nis, h.juz
    ORDER BY h.santri_nis, h.juz;
$$;

GRANT EXECUTE ON FUNCTION public.get_hafalan_surah_per_juz TO authenticated;

-- ── 11. Pre-populate rows for all active TAHFIDZ santri ──
INSERT INTO public.santri_peta_hafalan (santri_nis, juz, is_completed, halaman_progress)
SELECT s.nis, j, false, 0
FROM public.santri s
CROSS JOIN generate_series(1, 30) AS j
WHERE s.status_santri = 'AKTIF' AND s.jurusan = 'TAHFIDZ'
ON CONFLICT (santri_nis, juz) DO NOTHING;
