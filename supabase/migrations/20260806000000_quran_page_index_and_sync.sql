-- ============================================================
-- QURAN PAGE INDEX + AUTO-SYNC PETa HAFALAN
-- Migration: 20260806000000
--
-- TAMBAHAN SAJA — tidak mengubah tabel/fungsi yang sudah ada
--
-- 1. quran_page_index      — referensi halaman per ayat (6236 baris)
-- 2. surah_name_map         — lookup nama → ID surah
-- 3. get_surah_id_from_name — resolve nama surat → surah_id
-- 4. sync_peta_hafalan_from_hafalan — hitung progress per juz
-- 5. trigger_sync_peta_hafalan — auto-sync saat INSERT/UPDATE hafalan_tahfidz
-- ============================================================

-- ── 1. Tabel quran_page_index ──
CREATE TABLE IF NOT EXISTS public.quran_page_index (
    surah_id INTEGER NOT NULL CHECK (surah_id >= 1 AND surah_id <= 114),
    ayat     INTEGER NOT NULL CHECK (ayat >= 1),
    page     INTEGER NOT NULL CHECK (page >= 1 AND page <= 604),
    juz      INTEGER NOT NULL CHECK (juz >= 1 AND juz <= 30),
    PRIMARY KEY (surah_id, ayat)
);

COMMENT ON TABLE public.quran_page_index
    IS 'Ref: mapping (surah_id, ayat) → Mushaf page + juz. Source: Kemenag Quran JSON.';

CREATE INDEX IF NOT EXISTS idx_qpi_juz  ON public.quran_page_index(juz);
CREATE INDEX IF NOT EXISTS idx_qpi_page ON public.quran_page_index(page);

-- RLS: read-only untuk semua authenticated user
ALTER TABLE public.quran_page_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qpi_read_auth" ON public.quran_page_index
    FOR SELECT TO authenticated USING (true);

-- ── 2. Tabel surah_name_map ──
CREATE TABLE IF NOT EXISTS public.surah_name_map (
    surah_id    INTEGER PRIMARY KEY CHECK (surah_id >= 1 AND surah_id <= 114),
    nama_standar TEXT   NOT NULL,
    nama_variasi TEXT[] NOT NULL
);

COMMENT ON TABLE public.surah_name_map
    IS 'Flexible surah name → ID mapping. Handles admin input variations.';

ALTER TABLE public.surah_name_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snm_read_auth" ON public.surah_name_map
    FOR SELECT TO authenticated USING (true);

-- Seed: semua 114 surat dengan variasi nama umum
INSERT INTO public.surah_name_map (surah_id, nama_standar, nama_variasi) VALUES
(1,   'Al-Fatihah',      ARRAY['Al-Fatihah','Al-Fatihah']),
(2,   'Al-Baqarah',      ARRAY['Al-Baqarah']),
(3,   'Ali Imran',       ARRAY['Ali Imran','Ali ''Imran']),
(4,   'An-Nisa',         ARRAY['An-Nisa','An-Nisa''']),
(5,   'Al-Maidah',       ARRAY['Al-Maidah','Al-Ma''idah']),
(6,   'Al-Anam',         ARRAY['Al-Anam','Al-An''am']),
(7,   'Al-Araf',         ARRAY['Al-Araf','Al-A''raf']),
(8,   'Al-Anfal',        ARRAY['Al-Anfal']),
(9,   'At-Tawbah',       ARRAY['At-Tawbah','At-Taubah']),
(10,  'Yunus',           ARRAY['Yunus']),
(11,  'Hud',             ARRAY['Hud']),
(12,  'Yusuf',           ARRAY['Yusuf']),
(13,  'Ar-Rad',          ARRAY['Ar-Rad','Ar-Ra''d']),
(14,  'Ibrahim',         ARRAY['Ibrahim']),
(15,  'Al-Hijr',         ARRAY['Al-Hijr']),
(16,  'An-Nahl',         ARRAY['An-Nahl']),
(17,  'Al-Isra',         ARRAY['Al-Isra','Al-Isra''']),
(18,  'Al-Kahf',         ARRAY['Al-Kahf']),
(19,  'Maryam',          ARRAY['Maryam']),
(20,  'Ta-Ha',           ARRAY['Ta-Ha','Thaha']),
(21,  'Al-Anbiya',       ARRAY['Al-Anbiya','Al-Anbiya''']),
(22,  'Al-Hajj',         ARRAY['Al-Hajj']),
(23,  'Al-Muminun',      ARRAY['Al-Muminun','Al-Mu''minun']),
(24,  'An-Nur',          ARRAY['An-Nur']),
(25,  'Al-Furqan',       ARRAY['Al-Furqan']),
(26,  'Ash-Shuara',      ARRAY['Ash-Shuara','Ash-Shu''ara''']),
(27,  'An-Naml',         ARRAY['An-Naml']),
(28,  'Al-Qasas',        ARRAY['Al-Qasas']),
(29,  'Al-Ankabut',      ARRAY['Al-Ankabut','Al-''Ankabut']),
(30,  'Ar-Rum',          ARRAY['Ar-Rum']),
(31,  'Luqman',          ARRAY['Luqman']),
(32,  'As-Sajdah',       ARRAY['As-Sajdah']),
(33,  'Al-Ahzab',        ARRAY['Al-Ahzab']),
(34,  'Saba',            ARRAY['Saba','Saba''']),
(35,  'Fatir',           ARRAY['Fatir']),
(36,  'Ya-Sin',          ARRAY['Ya-Sin','Yasin']),
(37,  'As-Saffat',       ARRAY['As-Saffat']),
(38,  'Sad',             ARRAY['Sad']),
(39,  'Az-Zumar',        ARRAY['Az-Zumar']),
(40,  'Gafir',           ARRAY['Gafir','Ghafir']),
(41,  'Fussilat',        ARRAY['Fussilat']),
(42,  'Ash-Shura',       ARRAY['Ash-Shura']),
(43,  'Az-Zukhruf',      ARRAY['Az-Zukhruf']),
(44,  'Ad-Dukhan',       ARRAY['Ad-Dukhan']),
(45,  'Al-Jasiyah',      ARRAY['Al-Jasiyah']),
(46,  'Al-Ahqaf',        ARRAY['Al-Ahqaf']),
(47,  'Muhammad',        ARRAY['Muhammad']),
(48,  'Al-Fath',         ARRAY['Al-Fath']),
(49,  'Al-Hujurat',      ARRAY['Al-Hujurat']),
(50,  'Qaf',             ARRAY['Qaf']),
(51,  'Adz-Dzariyat',    ARRAY['Adz-Dzariyat','Adh-Dhariyat']),
(52,  'At-Tur',          ARRAY['At-Tur']),
(53,  'An-Najm',         ARRAY['An-Najm']),
(54,  'Al-Qamar',        ARRAY['Al-Qamar']),
(55,  'Ar-Rahman',       ARRAY['Ar-Rahman']),
(56,  'Al-Waqiah',       ARRAY['Al-Waqiah','Al-Waqi''ah']),
(57,  'Al-Hadid',        ARRAY['Al-Hadid']),
(58,  'Al-Mujadilah',    ARRAY['Al-Mujadilah']),
(59,  'Al-Hashr',        ARRAY['Al-Hashr']),
(60,  'Al-Mumtahanah',   ARRAY['Al-Mumtahanah']),
(61,  'As-Saff',         ARRAY['As-Saff']),
(62,  'Al-Jumuah',       ARRAY['Al-Jumuah','Al-Jumu''ah']),
(63,  'Al-Munafiqun',    ARRAY['Al-Munafiqun']),
(64,  'At-Taghabun',     ARRAY['At-Taghabun']),
(65,  'At-Talaq',        ARRAY['At-Talaq']),
(66,  'At-Tahrim',       ARRAY['At-Tahrim']),
(67,  'Al-Mulk',         ARRAY['Al-Mulk']),
(68,  'Al-Qalam',        ARRAY['Al-Qalam']),
(69,  'Al-Haqqah',       ARRAY['Al-Haqqah']),
(70,  'Al-Maarij',       ARRAY['Al-Maarij','Al-Ma''arij']),
(71,  'Nuh',             ARRAY['Nuh']),
(72,  'Al-Jinn',         ARRAY['Al-Jinn']),
(73,  'Al-Muzzammil',    ARRAY['Al-Muzzammil']),
(74,  'Al-Muddaththir',  ARRAY['Al-Muddaththir','Al-Muddassir','Al-Muddathir']),
(75,  'Al-Qiyamah',      ARRAY['Al-Qiyamah']),
(76,  'Al-Insan',        ARRAY['Al-Insan','Ad-Dahr']),
(77,  'Al-Mursalat',     ARRAY['Al-Mursalat']),
(78,  'An-Naba',         ARRAY['An-Naba','An-Naba''']),
(79,  'An-Naziat',       ARRAY['An-Naziat']),
(80,  'Abasa',           ARRAY['Abasa']),
(81,  'At-Takwir',       ARRAY['At-Takwir']),
(82,  'Al-Infitar',      ARRAY['Al-Infitar']),
(83,  'Al-Mutaffifin',   ARRAY['Al-Mutaffifin']),
(84,  'Al-Insyiqaq',     ARRAY['Al-Insyiqaq','Al-Inshiqaq']),
(85,  'Al-Buruj',        ARRAY['Al-Buruj']),
(86,  'At-Tariq',        ARRAY['At-Tariq']),
(87,  'Al-Ala',          ARRAY['Al-Ala','Al-''Ala']),
(88,  'Al-Ghashiyah',    ARRAY['Al-Ghashiyah']),
(89,  'Al-Fajr',         ARRAY['Al-Fajr']),
(90,  'Al-Balad',        ARRAY['Al-Balad']),
(91,  'Ash-Shams',       ARRAY['Ash-Shams']),
(92,  'Al-Lail',         ARRAY['Al-Lail','Al-Layl']),
(93,  'Ad-Duha',         ARRAY['Ad-Duha']),
(94,  'Ash-Sharh',       ARRAY['Ash-Sharh','Al-Insyhiraah']),
(95,  'At-Tin',          ARRAY['At-Tin']),
(96,  'Al-Alaq',         ARRAY['Al-Alaq','Al-''Alaq']),
(97,  'Al-Qadr',         ARRAY['Al-Qadr']),
(98,  'Al-Bayyinah',     ARRAY['Al-Bayyinah']),
(99,  'Az-Zalzalah',     ARRAY['Az-Zalzalah']),
(100, 'Al-Adiyat',       ARRAY['Al-Adiyat','Al-''Adiyat']),
(101, 'Al-Qariah',       ARRAY['Al-Qariah','Al-Qari''ah']),
(102, 'At-Takathur',     ARRAY['At-Takathur','At-Takatsur']),
(103, 'Al-Asr',          ARRAY['Al-Asr','Al-''Asr']),
(104, 'Al-Humazah',      ARRAY['Al-Humazah']),
(105, 'Al-Fil',          ARRAY['Al-Fil']),
(106, 'Quraysh',         ARRAY['Quraysh','Quraisy']),
(107, 'Al-Maun',         ARRAY['Al-Maun','Al-Ma''un']),
(108, 'Al-Kawthar',      ARRAY['Al-Kawthar','Al-Kautsar']),
(109, 'Al-Kafirun',      ARRAY['Al-Kafirun']),
(110, 'An-Nasr',         ARRAY['An-Nasr']),
(111, 'Al-Masad',        ARRAY['Al-Masad','Al-Lahab']),
(112, 'Al-Ikhlas',       ARRAY['Al-Ikhlas']),
(113, 'Al-Falaq',        ARRAY['Al-Falaq']),
(114, 'An-Nas',          ARRAY['An-Nas'])
ON CONFLICT (surah_id) DO NOTHING;

-- ── 3. Function: get_surah_id_from_name ──
CREATE OR REPLACE FUNCTION public.get_surah_id_from_name(p_surat_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id INTEGER;
    v_norm TEXT;
BEGIN
    IF p_surat_name IS NULL OR TRIM(p_surat_name) = '' THEN
        RETURN NULL;
    END IF;
    v_norm := LOWER(TRIM(p_surat_name));

    -- exact match pada nama_standar
    SELECT s.surah_id INTO v_id
    FROM public.surah_name_map s
    WHERE LOWER(s.nama_standar) = v_norm
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    -- match pada salah satu variasi
    SELECT s.surah_id INTO v_id
    FROM public.surah_name_map s, unnest(s.nama_variasi) v
    WHERE LOWER(v) = v_norm
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    -- prefix match: input 'Al-Baq' cocok dengan 'Al-Baqarah'
    SELECT s.surah_id INTO v_id
    FROM public.surah_name_map s
    WHERE LOWER(s.nama_standar) LIKE v_norm || '%'
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_surah_id_from_name IS
    'Resolve surah name (text) → surah_id (int). Handles variations like Al-Muddassir→Al-Muddaththir.';

-- ── 4. Function: sync_peta_hafalan_from_hafalan ──
-- Menghitung total halaman unik per juz dari semua setoran santri
-- dan meng-upsert santri_peta_hafalan.
CREATE OR REPLACE FUNCTION public.sync_peta_hafalan_from_hafalan(
    p_santri_nis TEXT,
    p_juz INTEGER DEFAULT NULL
)
RETURNS TABLE (
    out_juz           INTEGER,
    out_halaman_total INTEGER,
    out_ayat_total    INTEGER,
    out_is_completed  BOOLEAN,
    out_action        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_juz            INTEGER;
    v_pages          INTEGER;  -- total halaman unik di juz ini
    v_total_in_juz   INTEGER;  -- total halaman dalam 1 juz
    v_ayat_total     INTEGER;
    v_is_completed   BOOLEAN;
    v_existing_hal   INTEGER;
    v_existing_done  BOOLEAN;
    v_action         TEXT;
    v_kuartal        INTEGER;  -- halaman × 4 (1 halaman = 4 kuartal)
BEGIN
    -- Loop per juz yang punya setoran untuk santri ini
    FOR v_juz IN
        SELECT DISTINCT ht.juz
        FROM public.hafalan_tahfidz ht
        WHERE ht.santri_nis = p_santri_nis
          AND ht.ayat_awal IS NOT NULL
          AND ht.ayat_akhir IS NOT NULL
          AND (p_juz IS NULL OR ht.juz = p_juz)
        ORDER BY ht.juz
    LOOP
        -- Hitung halaman unik yang sudah disetor (tidak termasuk MENGULANG)
        -- Metode: ambil page awal dan page akhir per setoran, lalu hitung
        -- total page unik dari semua range yang overlap
        SELECT
            COUNT(DISTINCT qpi.page),
            COALESCE(SUM(ht2.ayat_akhir - ht2.ayat_awal + 1), 0)
        INTO v_pages, v_ayat_total
        FROM public.hafalan_tahfidz ht2
        JOIN public.quran_page_index qpi
            ON qpi.surah_id = public.get_surah_id_from_name(ht2.surat)
            AND qpi.ayat BETWEEN ht2.ayat_awal AND ht2.ayat_akhir
        WHERE ht2.santri_nis = p_santri_nis
          AND ht2.juz = v_juz
          AND ht2.ayat_awal IS NOT NULL
          AND ht2.ayat_akhir IS NOT NULL
          AND (ht2.status_setoran IS NULL OR ht2.status_setoran != 'MENGULANG');

        -- Total halaman dalam juz ini
        SELECT COUNT(*) INTO v_total_in_juz
        FROM public.quran_page_index
        WHERE juz = v_juz;

        -- Konversi halaman ke kuartal (1 halaman = 4 kuartal)
        v_kuartal := v_pages * 4;

        -- is_completed jika sudah >= total halaman juz
        v_is_completed := (v_pages >= v_total_in_juz AND v_total_in_juz > 0);

        -- Ambil data yang sudah ada
        SELECT halaman_progress, is_completed
        INTO v_existing_hal, v_existing_done
        FROM public.santri_peta_hafalan
        WHERE santri_nis = p_santri_nis AND juz = v_juz;

        IF v_existing_hal IS NULL THEN
            INSERT INTO public.santri_peta_hafalan
                (santri_nis, juz, halaman_progress, is_completed)
            VALUES
                (p_santri_nis, v_juz, v_kuartal, v_is_completed);
            v_action := 'INSERT';
        ELSIF v_kuartal != v_existing_hal OR v_is_completed != v_existing_done THEN
            UPDATE public.santri_peta_hafalan
            SET halaman_progress = v_kuartal,
                is_completed     = v_is_completed
            WHERE santri_nis = p_santri_nis AND juz = v_juz;
            v_action := 'UPDATE';
        ELSE
            v_action := 'NO_CHANGE';
        END IF;

        out_juz           := v_juz;
        out_halaman_total := v_pages;
        out_ayat_total    := v_ayat_total;
        out_is_completed  := v_is_completed;
        out_action        := v_action;
        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.sync_peta_hafalan_from_hafalan IS
    'Hitung total halaman unik per juz dari hafalan_tahfidz, konversi ke kuartal, upsert ke santri_peta_hafalan.';

-- ── 5. Trigger function: auto-sync on hafalan_tahfidz ──
CREATE OR REPLACE FUNCTION public.trigger_sync_peta_hafalan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Sync hanya jika ada data ayat yang valid
    IF NEW.ayat_awal IS NOT NULL AND NEW.ayat_akhir IS NOT NULL THEN
        PERFORM public.sync_peta_hafalan_from_hafalan(NEW.santri_nis, NEW.juz);
    END IF;

    -- Jika DELETE, sync ulang tanpa juz spesifik
    -- (trigger ini juga dipanggil saat UPDATE, tapi untuk DELETE
    --  kita handle di AFTER DELETE terpisah jika diperlukan)

    RETURN NEW;
END;
$$;

-- ── 6. Create trigger ──
DROP TRIGGER IF EXISTS trigger_sync_peta_hafalan ON public.hafalan_tahfidz;
CREATE TRIGGER trigger_sync_peta_hafalan
    AFTER INSERT OR UPDATE ON public.hafalan_tahfidz
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_sync_peta_hafalan();

-- ── 7. Verify ──
DO $$
DECLARE
    v_qpi  INTEGER;
    v_snm  INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_qpi FROM public.quran_page_index;
    SELECT COUNT(*) INTO v_snm FROM public.surah_name_map;
    RAISE NOTICE 'surah_name_map: % rows, quran_page_index: % rows', v_snm, v_qpi;
    IF v_qpi = 0 THEN
        RAISE WARNING 'quran_page_index KOSONG! Jalankan: psql -f scripts/quran_page_index_seed.sql';
    END IF;
END $$;
