-- Add penyimak support, GHAIB status (from GOIB), and setoran result tracking

-- 1. Update CHECK constraint on tahfidz_absensi: GOIB -> GHAIB
ALTER TABLE public.tahfidz_absensi DROP CONSTRAINT IF EXISTS valid_status_absensi;
UPDATE public.tahfidz_absensi SET status = 'GHAIB' WHERE status = 'GOIB';
ALTER TABLE public.tahfidz_absensi ADD CONSTRAINT valid_status_absensi CHECK (status IN ('HADIR', 'GHAIB', 'SEKOLAH', 'PULANG', 'SAKIT'));

-- 2. Add penyimak_id to tahfidz_absensi (who listened/witnessed the setoran)
ALTER TABLE public.tahfidz_absensi ADD COLUMN penyimak_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Add penyimak_mode to santri (how to determine default penyimak)
ALTER TABLE public.santri ADD COLUMN penyimak_mode TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE public.santri ADD CONSTRAINT valid_penyimak_mode CHECK (penyimak_mode IN ('pembimbing', 'admin', 'manual'));

-- 4. Add status_setoran + alasan_tolak to hafalan_tahfidz
ALTER TABLE public.hafalan_tahfidz ADD COLUMN IF NOT EXISTS status_setoran TEXT DEFAULT 'LANCAR';
ALTER TABLE public.hafalan_tahfidz ADD COLUMN IF NOT EXISTS alasan_tolak TEXT;
-- Migrate old status values and update constraint
UPDATE public.hafalan_tahfidz SET status_setoran = 'LANCAR' WHERE status_setoran = 'DITERIMA';
UPDATE public.hafalan_tahfidz SET status_setoran = 'MENGULANG' WHERE status_setoran = 'DITOLAK';
ALTER TABLE public.hafalan_tahfidz DROP CONSTRAINT IF EXISTS valid_status_setoran;
ALTER TABLE public.hafalan_tahfidz ADD CONSTRAINT valid_status_setoran CHECK (status_setoran IN ('LANCAR', 'MENGULANG'));

-- 5. Add status_setoran + alasan_tolak to murojaah_tahfidz
ALTER TABLE public.murojaah_tahfidz ADD COLUMN IF NOT EXISTS status_setoran TEXT DEFAULT 'LANCAR';
ALTER TABLE public.murojaah_tahfidz ADD COLUMN IF NOT EXISTS alasan_tolak TEXT;
-- Migrate old status values and update constraint
UPDATE public.murojaah_tahfidz SET status_setoran = 'LANCAR' WHERE status_setoran = 'DITERIMA';
UPDATE public.murojaah_tahfidz SET status_setoran = 'MENGULANG' WHERE status_setoran = 'DITOLAK';
ALTER TABLE public.murojaah_tahfidz DROP CONSTRAINT IF EXISTS valid_status_setoran_mur;
ALTER TABLE public.murojaah_tahfidz ADD CONSTRAINT valid_status_setoran_mur CHECK (status_setoran IN ('LANCAR', 'MENGULANG'));

-- 6. Add UNIQUE constraints on absensi_id to prevent duplicate setoran per absensi
-- Remove existing duplicate absensi_id rows first (keep the latest)
DELETE FROM public.hafalan_tahfidz a USING (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY absensi_id ORDER BY id DESC) as rn
  FROM public.hafalan_tahfidz WHERE absensi_id IS NOT NULL
) b WHERE a.id = b.id AND b.rn > 1;

DELETE FROM public.murojaah_tahfidz a USING (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY absensi_id ORDER BY id DESC) as rn
  FROM public.murojaah_tahfidz WHERE absensi_id IS NOT NULL
) b WHERE a.id = b.id AND b.rn > 1;

ALTER TABLE public.hafalan_tahfidz DROP CONSTRAINT IF EXISTS hafalan_tahfidz_absensi_id_unique;
ALTER TABLE public.hafalan_tahfidz ADD CONSTRAINT hafalan_tahfidz_absensi_id_unique UNIQUE (absensi_id);

ALTER TABLE public.murojaah_tahfidz DROP CONSTRAINT IF EXISTS murojaah_tahfidz_absensi_id_unique;
ALTER TABLE public.murojaah_tahfidz ADD CONSTRAINT murojaah_tahfidz_absensi_id_unique UNIQUE (absensi_id);

-- 7. Add UNIQUE constraint on tahfidz_sesi to prevent duplicate sesi records
ALTER TABLE public.tahfidz_sesi DROP CONSTRAINT IF EXISTS tahfidz_sesi_tanggal_kegiatan_sesi_unique;
ALTER TABLE public.tahfidz_sesi ADD CONSTRAINT tahfidz_sesi_tanggal_kegiatan_sesi_unique UNIQUE (tanggal, kegiatan_id, sesi);
