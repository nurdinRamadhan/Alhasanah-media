-- ============================================================
-- MIGRATION: Setup Absensi Mingguan Tahfidz
-- Created: 2026-06-21
-- Tabel khusus untuk absensi kegiatan mingguan santri tahfidz
-- Terpisah dari sistem absensi harian (tahfidz_sesi / tahfidz_absensi)
-- ============================================================

-- 1. Master kegiatan mingguan
CREATE TABLE IF NOT EXISTS public.mingguan_kegiatan (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  tipe_data TEXT NOT NULL DEFAULT 'absensi' CHECK (tipe_data IN ('absensi', 'hafalan')),
  urutan INT DEFAULT 0,
  aktif BOOLEAN DEFAULT TRUE
);

INSERT INTO public.mingguan_kegiatan (id, label, tipe_data, urutan) VALUES
  ('HAFALAN',    'Hafalan',    'hafalan',  1),
  ('ISTIGHOSAH', 'Istighosah', 'absensi',  2),
  ('NGAOS_AANG', 'Ngaos Aang', 'absensi',  3),
  ('TILAWAH',    'Tilawah',    'absensi',  4),
  ('TAWASUL',    'Tawasul',    'absensi',  5),
  ('MHQ',        'MHQ',        'absensi',  6),
  ('MUHADHOROH', 'Muhadhoroh', 'absensi',  7)
ON CONFLICT (id) DO NOTHING;

-- 2. Sesi per kegiatan per minggu (konteks Hijriah)
CREATE TABLE IF NOT EXISTS public.mingguan_sesi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id TEXT NOT NULL REFERENCES public.mingguan_kegiatan(id),
  -- Konteks Hijriah
  bulan_hijriah TEXT NOT NULL,
  tahun_hijriah INT NOT NULL,
  bulan_hijriah_number INT NOT NULL,
  minggu_ke INT NOT NULL CHECK (minggu_ke BETWEEN 1 AND 5),
  -- Tanggal Masehi (untuk kronologis & rekap global)
  tanggal DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kegiatan_id, bulan_hijriah, tahun_hijriah, minggu_ke)
);

-- 3. Absensi per santri per sesi mingguan
CREATE TABLE IF NOT EXISTS public.mingguan_absensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesi_id UUID NOT NULL REFERENCES public.mingguan_sesi(id) ON DELETE CASCADE,
  santri_nis TEXT NOT NULL REFERENCES public.santri(nis),
  status TEXT CHECK (status IN ('HADIR', 'SAKIT', 'IZIN', 'SEKOLAH', 'GHAIB', 'PULANG')),
  nilai_hafalan INT,
  keterangan TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sesi_id, santri_nis)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_mingguan_sesi_kegiatan ON public.mingguan_sesi(kegiatan_id);
CREATE INDEX IF NOT EXISTS idx_mingguan_sesi_bulan ON public.mingguan_sesi(bulan_hijriah, tahun_hijriah);
CREATE INDEX IF NOT EXISTS idx_mingguan_sesi_tanggal ON public.mingguan_sesi(tanggal);
CREATE INDEX IF NOT EXISTS idx_mingguan_absensi_sesi ON public.mingguan_absensi(sesi_id);
CREATE INDEX IF NOT EXISTS idx_mingguan_absensi_santri ON public.mingguan_absensi(santri_nis);

-- 5. RLS
ALTER TABLE public.mingguan_kegiatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mingguan_sesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mingguan_absensi ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mingguan_kegiatan' AND policyname = 'mingguan_kegiatan_read_all') THEN
    CREATE POLICY mingguan_kegiatan_read_all ON public.mingguan_kegiatan FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mingguan_sesi' AND policyname = 'mingguan_sesi_read_all') THEN
    CREATE POLICY mingguan_sesi_read_all ON public.mingguan_sesi FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mingguan_sesi' AND policyname = 'mingguan_sesi_all_staff') THEN
    CREATE POLICY mingguan_sesi_all_staff ON public.mingguan_sesi FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mingguan_absensi' AND policyname = 'mingguan_absensi_read_all') THEN
    CREATE POLICY mingguan_absensi_read_all ON public.mingguan_absensi FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mingguan_absensi' AND policyname = 'mingguan_absensi_all_staff') THEN
    CREATE POLICY mingguan_absensi_all_staff ON public.mingguan_absensi FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Grant
GRANT ALL ON public.mingguan_kegiatan TO authenticated;
GRANT ALL ON public.mingguan_sesi TO authenticated;
GRANT ALL ON public.mingguan_absensi TO authenticated;
