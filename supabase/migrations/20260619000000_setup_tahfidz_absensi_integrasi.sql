-- ============================================================
-- MIGRATION: Setup Absensi Tahfidz Terintegrasi
-- Created: 2026-06-19
-- Tabel baru untuk absensi tahfidz + integrasi dengan
-- hafalan_tahfidz, murojaah_tahfidz, dan tabel eksternal
-- ============================================================

-- 1. Master kegiatan tahfidz (extensible)
CREATE TABLE IF NOT EXISTS public.kegiatan_tahfidz (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  ada_setoran BOOLEAN DEFAULT FALSE,
  ada_sesi_waktu BOOLEAN DEFAULT TRUE,
  aktif BOOLEAN DEFAULT TRUE
);

INSERT INTO public.kegiatan_tahfidz (id, label, ada_setoran, ada_sesi_waktu) VALUES
  ('ZIYADAH', 'Ziyadah (Hafalan Baru)', TRUE, TRUE),
  ('MUROJAAH', 'Murojaah (Ulang)', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Sesi absensi
CREATE TABLE IF NOT EXISTS public.tahfidz_sesi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id TEXT NOT NULL REFERENCES public.kegiatan_tahfidz(id),
  tanggal DATE NOT NULL,
  sesi TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_sesi CHECK (sesi IN ('PAGI', 'SIANG')),
  CONSTRAINT valid_status CHECK (status IN ('OPEN', 'CLOSED'))
);

-- 3. Record absensi per santri per sesi
CREATE TABLE IF NOT EXISTS public.tahfidz_absensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesi_id UUID NOT NULL REFERENCES public.tahfidz_sesi(id) ON DELETE CASCADE,
  santri_nis TEXT NOT NULL REFERENCES public.santri(nis),
  status TEXT NOT NULL DEFAULT 'HADIR',
  setoran BOOLEAN DEFAULT FALSE,
  keterangan TEXT,
  -- FK ke tabel eksternal (optional, untuk integrasi masa depan)
  kesehatan_id BIGINT REFERENCES public.kesehatan_santri(id) ON DELETE SET NULL,
  perizinan_id BIGINT REFERENCES public.perizinan_santri(id) ON DELETE SET NULL,
  pelanggaran_id BIGINT REFERENCES public.pelanggaran_santri(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_status_absensi CHECK (status IN ('HADIR', 'GOIB', 'SEKOLAH', 'PULANG', 'SAKIT')),
  UNIQUE(sesi_id, santri_nis)
);

-- 4. Tambah FK ke tabel hafalan & murojaah existing
ALTER TABLE public.hafalan_tahfidz ADD COLUMN IF NOT EXISTS absensi_id UUID REFERENCES public.tahfidz_absensi(id) ON DELETE SET NULL;
ALTER TABLE public.murojaah_tahfidz ADD COLUMN IF NOT EXISTS absensi_id UUID REFERENCES public.tahfidz_absensi(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_tahfidz_sesi_tanggal ON public.tahfidz_sesi(tanggal);
CREATE INDEX IF NOT EXISTS idx_tahfidz_sesi_kegiatan ON public.tahfidz_sesi(kegiatan_id);
CREATE INDEX IF NOT EXISTS idx_tahfidz_absensi_sesi ON public.tahfidz_absensi(sesi_id);
CREATE INDEX IF NOT EXISTS idx_tahfidz_absensi_santri ON public.tahfidz_absensi(santri_nis);
CREATE INDEX IF NOT EXISTS idx_tahfidz_absensi_status ON public.tahfidz_absensi(status);
CREATE INDEX IF NOT EXISTS idx_tahfidz_absensi_created ON public.tahfidz_absensi(created_at);

-- 6. RLS
ALTER TABLE public.kegiatan_tahfidz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_sesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_absensi ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kegiatan_tahfidz' AND policyname = 'kegiatan_tahfidz_read_all') THEN
    CREATE POLICY kegiatan_tahfidz_read_all ON public.kegiatan_tahfidz FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tahfidz_sesi' AND policyname = 'tahfidz_sesi_read_all') THEN
    CREATE POLICY tahfidz_sesi_read_all ON public.tahfidz_sesi FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tahfidz_sesi' AND policyname = 'tahfidz_sesi_all_staff') THEN
    CREATE POLICY tahfidz_sesi_all_staff ON public.tahfidz_sesi FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tahfidz_absensi' AND policyname = 'tahfidz_absensi_read_all') THEN
    CREATE POLICY tahfidz_absensi_read_all ON public.tahfidz_absensi FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tahfidz_absensi' AND policyname = 'tahfidz_absensi_all_staff') THEN
    CREATE POLICY tahfidz_absensi_all_staff ON public.tahfidz_absensi FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 7. Grant
GRANT ALL ON public.kegiatan_tahfidz TO authenticated;
GRANT ALL ON public.tahfidz_sesi TO authenticated;
GRANT ALL ON public.tahfidz_absensi TO authenticated;
