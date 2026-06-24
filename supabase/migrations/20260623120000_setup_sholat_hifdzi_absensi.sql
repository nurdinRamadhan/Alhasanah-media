-- ============================================================
-- MIGRATION: Setup Absensi Sholat Hifdzi Tahfidz
-- Created: 2026-06-23
-- Tabel khusus untuk absensi Sholat Hifdzi santri tahfidz
-- Kegiatan mingguan: 1 kegiatan per minggu
-- ============================================================

-- 1. Master kegiatan sholat hifdzi
CREATE TABLE IF NOT EXISTS public.sholat_hifdzi_kegiatan (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  urutan INT DEFAULT 0,
  aktif BOOLEAN DEFAULT TRUE
);

INSERT INTO public.sholat_hifdzi_kegiatan (id, label, urutan) VALUES
  ('SHOLAT_HIFDZI', 'Sholat Hifdzi', 1)
ON CONFLICT (id) DO NOTHING;

-- 2. Sesi per minggu (konteks Hijriah)
CREATE TABLE IF NOT EXISTS public.sholat_hifdzi_sesi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id TEXT NOT NULL REFERENCES public.sholat_hifdzi_kegiatan(id),
  -- Konteks Hijriah
  bulan_hijriah TEXT NOT NULL,
  tahun_hijriah INT NOT NULL,
  bulan_hijriah_number INT NOT NULL,
  minggu_ke INT NOT NULL CHECK (minggu_ke BETWEEN 1 AND 5),
  -- Tanggal Masehi
  tanggal DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kegiatan_id, bulan_hijriah, tahun_hijriah, minggu_ke)
);

-- 3. Absensi per santri per sesi sholat hifdzi
CREATE TABLE IF NOT EXISTS public.sholat_hifdzi_absensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesi_id UUID NOT NULL REFERENCES public.sholat_hifdzi_sesi(id) ON DELETE CASCADE,
  santri_nis TEXT NOT NULL REFERENCES public.santri(nis),
  status TEXT CHECK (status IN ('HADIR', 'SAKIT', 'IZIN', 'GHAIB', 'PULANG')),
  keterangan TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sesi_id, santri_nis)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_sholat_hifdzi_sesi_kegiatan ON public.sholat_hifdzi_sesi(kegiatan_id);
CREATE INDEX IF NOT EXISTS idx_sholat_hifdzi_sesi_bulan ON public.sholat_hifdzi_sesi(bulan_hijriah, tahun_hijriah);
CREATE INDEX IF NOT EXISTS idx_sholat_hifdzi_sesi_tanggal ON public.sholat_hifdzi_sesi(tanggal);
CREATE INDEX IF NOT EXISTS idx_sholat_hifdzi_absensi_sesi ON public.sholat_hifdzi_absensi(sesi_id);
CREATE INDEX IF NOT EXISTS idx_sholat_hifdzi_absensi_santri ON public.sholat_hifdzi_absensi(santri_nis);

-- 5. Helper function untuk pengecekan akses tulis (role + scope)
CREATE OR REPLACE FUNCTION public.can_manage_sholat_hifdzi()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_role TEXT;
  v_gender TEXT;
  v_jurusan TEXT;
BEGIN
  SELECT p.role::TEXT, p.akses_gender::TEXT, p.akses_jurusan::TEXT
  INTO v_role, v_gender, v_jurusan
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- Super admin, rois, dewan: akses penuh
  IF v_role IN ('super_admin', 'rois', 'dewan') THEN
    RETURN TRUE;
  END IF;

  -- Kesantrian: hanya L + TAHFIDZ
  IF v_role = 'kesantrian'
     AND v_gender IN ('L', 'ALL')
     AND v_jurusan IN ('TAHFIDZ', 'ALL') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 6. RLS
ALTER TABLE public.sholat_hifdzi_kegiatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sholat_hifdzi_sesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sholat_hifdzi_absensi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sholat_hifdzi_kegiatan_read_all ON public.sholat_hifdzi_kegiatan;
CREATE POLICY sholat_hifdzi_kegiatan_read_all ON public.sholat_hifdzi_kegiatan
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sholat_hifdzi_sesi_read_all ON public.sholat_hifdzi_sesi;
CREATE POLICY sholat_hifdzi_sesi_read_all ON public.sholat_hifdzi_sesi
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sholat_hifdzi_sesi_all_staff ON public.sholat_hifdzi_sesi;
CREATE POLICY sholat_hifdzi_sesi_insert ON public.sholat_hifdzi_sesi
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_sholat_hifdzi());
CREATE POLICY sholat_hifdzi_sesi_update ON public.sholat_hifdzi_sesi
  FOR UPDATE TO authenticated USING (public.can_manage_sholat_hifdzi()) WITH CHECK (public.can_manage_sholat_hifdzi());
CREATE POLICY sholat_hifdzi_sesi_delete ON public.sholat_hifdzi_sesi
  FOR DELETE TO authenticated USING (public.can_manage_sholat_hifdzi());

DROP POLICY IF EXISTS sholat_hifdzi_absensi_read_all ON public.sholat_hifdzi_absensi;
CREATE POLICY sholat_hifdzi_absensi_read_all ON public.sholat_hifdzi_absensi
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sholat_hifdzi_absensi_all_staff ON public.sholat_hifdzi_absensi;
CREATE POLICY sholat_hifdzi_absensi_insert ON public.sholat_hifdzi_absensi
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_sholat_hifdzi());
CREATE POLICY sholat_hifdzi_absensi_update ON public.sholat_hifdzi_absensi
  FOR UPDATE TO authenticated USING (public.can_manage_sholat_hifdzi()) WITH CHECK (public.can_manage_sholat_hifdzi());
CREATE POLICY sholat_hifdzi_absensi_delete ON public.sholat_hifdzi_absensi
  FOR DELETE TO authenticated USING (public.can_manage_sholat_hifdzi());

-- 7. Grant (read untuk semua, write dikontrol RLS)
GRANT SELECT ON public.sholat_hifdzi_kegiatan TO authenticated;
GRANT SELECT ON public.sholat_hifdzi_sesi TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sholat_hifdzi_sesi TO authenticated;
GRANT SELECT ON public.sholat_hifdzi_absensi TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sholat_hifdzi_absensi TO authenticated;

-- Revoke execute on helper function dari public (hanya digunakan internal RLS)
REVOKE ALL ON FUNCTION public.can_manage_sholat_hifdzi() FROM PUBLIC;
