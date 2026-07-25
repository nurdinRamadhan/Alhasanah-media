-- ============================================================
-- MIGRATION: Jadwal Kegiatan Pesantren
-- Created: 2026-06-25
-- Purpose: Tabel jadwal kegiatan (info/agenda) + kategori dinamis
--          + notifikasi otomatis ke wali santri via notification_queue
-- ============================================================

-- 1. TABEL: jadwal_kategori (Master Kategori Dinamis)
CREATE TABLE IF NOT EXISTS public.jadwal_kategori (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  warna TEXT NOT NULL DEFAULT '#1890ff',
  icon TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  urutan INT NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.jadwal_kategori IS 'Master kategori untuk jadwal kegiatan pesantren. Mendukung kategori statis (seed) dan custom (ditambah admin).';

-- 2. TABEL: jadwal_kegiatan (Data Inti Jadwal)
CREATE TABLE IF NOT EXISTS public.jadwal_kegiatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kegiatan TEXT NOT NULL,
  deskripsi TEXT,
  kategori_id TEXT NOT NULL REFERENCES public.jadwal_kategori(id) ON DELETE RESTRICT,
  
  -- Frekuensi
  frekuensi TEXT NOT NULL CHECK (frekuensi IN ('harian','mingguan','bulanan','tahunan','khusus')),
  
  -- Waktu Gregorian (untuk event spesifik)
  tanggal_mulai DATE,
  tanggal_selesai DATE,
  waktu_mulai TIME,
  waktu_selesai TIME,
  
  -- Waktu Hijri Recurring (tanpa tanggal pasti)
  catatan_waktu TEXT,
  
  -- Tampilan
  lokasi TEXT NOT NULL DEFAULT '',
  gambar_url TEXT,
  urutan INT NOT NULL DEFAULT 0,
  
  -- Status & Akses
  is_publik BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','nonaktif','selesai')),
  
  -- Notifikasi
  notifikasi_aktif BOOLEAN NOT NULL DEFAULT false,
  notifikasi_hari INT NOT NULL DEFAULT 3 CHECK (notifikasi_hari BETWEEN 1 AND 7),
  
  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.jadwal_kegiatan IS 'Jadwal/Agenda kegiatan pesantren. Bersifat info-only (tidak terhubung ke sistem absensi).';

-- 3. SEED DATA: Kategori Statis
INSERT INTO public.jadwal_kategori (id, label, warna, icon, is_custom, urutan) VALUES
  ('akademik',     'Akademik',     '#1890ff', '📚', false, 1),
  ('keagamaan',    'Keagamaan',    '#52c41a', '🕌', false, 2),
  ('sosial',       'Sosial',       '#faad14', '🤝', false, 3),
  ('operasional',  'Operasional',  '#722ed1', '📋', false, 4),
  ('khusus',       'Khusus',       '#f5222d', '⭐', false, 5)
ON CONFLICT (id) DO NOTHING;

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_jadwal_kegiatan_frekuensi ON public.jadwal_kegiatan(frekuensi);
CREATE INDEX IF NOT EXISTS idx_jadwal_kegiatan_status ON public.jadwal_kegiatan(status);
CREATE INDEX IF NOT EXISTS idx_jadwal_kegiatan_tanggal_mulai ON public.jadwal_kegiatan(tanggal_mulai);
CREATE INDEX IF NOT EXISTS idx_jadwal_kegiatan_kategori ON public.jadwal_kegiatan(kategori_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_kegiatan_urutan ON public.jadwal_kegiatan(urutan);
CREATE INDEX IF NOT EXISTS idx_jadwal_kegiatan_notifikasi ON public.jadwal_kegiatan(notifikasi_aktif, status, tanggal_mulai);

-- 5. RLS POLICIES
ALTER TABLE public.jadwal_kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_kegiatan ENABLE ROW LEVEL SECURITY;

-- Public bisa baca kategori yang aktif
CREATE POLICY "jadwal_kategori_public_read"
  ON public.jadwal_kategori FOR SELECT
  USING (aktif = true);

-- Admin bisa full CRUD kategori
CREATE POLICY "jadwal_kategori_admin_all"
  ON public.jadwal_kategori FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin','rois','kesantrian')
      AND profiles.is_active = true
    )
  );

-- Public bisa baca kegiatan aktif & publik
CREATE POLICY "jadwal_kegiatan_public_read"
  ON public.jadwal_kegiatan FOR SELECT
  USING (is_publik = true AND status = 'aktif');

-- Admin bisa full CRUD kegiatan
CREATE POLICY "jadwal_kegiatan_admin_all"
  ON public.jadwal_kegiatan FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin','rois','kesantrian')
      AND profiles.is_active = true
    )
  );

-- 6. TRIGGER: Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_jadwal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_jadwal_kategori_updated_at
  BEFORE UPDATE ON public.jadwal_kategori
  FOR EACH ROW EXECUTE FUNCTION public.handle_jadwal_updated_at();

CREATE TRIGGER trigger_jadwal_kegiatan_updated_at
  BEFORE UPDATE ON public.jadwal_kegiatan
  FOR EACH ROW EXECUTE FUNCTION public.handle_jadwal_updated_at();
