-- ============================================================
-- MIGRATION: Notifikasi GHAIB untuk Absensi Mingguan, Ngaji & Sholat Hifdzi
-- Created: 2026-06-24
--
-- Mengirim notifikasi ke wali santri ketika admin menandai
-- santri sebagai GHAIB pada:
--   1. Absensi Mingguan (mingguan_absensi)
--   2. Absensi Ngaji (ngaji_absensi)
--   3. Absensi Sholat Hifdzi (sholat_hifdzi_absensi)
-- ============================================================

-- 1. Trigger function untuk Absensi Mingguan
CREATE OR REPLACE FUNCTION public.notify_wali_on_mingguan_ghaib()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_santri_nama TEXT;
    v_kegiatan_label TEXT;
    v_tanggal DATE;
    v_hari_nama TEXT;
    v_body TEXT;
BEGIN
    IF NEW.status = 'GHAIB' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'GHAIB') THEN
        SELECT nama INTO v_santri_nama FROM public.santri WHERE nis = NEW.santri_nis;

        SELECT mk.label, ms.tanggal
        INTO v_kegiatan_label, v_tanggal
        FROM public.mingguan_sesi ms
        JOIN public.mingguan_kegiatan mk ON mk.id = ms.kegiatan_id
        WHERE ms.id = NEW.sesi_id;

        IF v_tanggal IS NOT NULL THEN
            v_hari_nama := (ARRAY['Ahad','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[EXTRACT(DOW FROM v_tanggal) + 1];
            v_body := 'Ananda ' || v_santri_nama || ' tercatat tidak mengikuti kegiatan ' || v_kegiatan_label ||
                      ' / ALPHA pada hari ' || v_hari_nama || ', ' || to_char(v_tanggal, 'DD-MM-YYYY') || '.';
        ELSE
            v_body := 'Ananda ' || v_santri_nama || ' tercatat tidak mengikuti kegiatan ' || v_kegiatan_label || ' / ALPHA.';
        END IF;

        PERFORM public.wallet_notify_wali(
            NEW.santri_nis,
            'Kedisiplinan Santri',
            v_body,
            'absensi.ghaib',
            'mingguan_absensi',
            jsonb_build_object(
                'santri_nis', NEW.santri_nis,
                'santri_nama', v_santri_nama,
                'kegiatan', v_kegiatan_label,
                'tanggal', v_tanggal,
                'sesi_id', NEW.sesi_id,
                'absensi_id', NEW.id
            ),
            'high',
            NEW.id::TEXT
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_mingguan_notify_wali_on_ghaib ON public.mingguan_absensi;
CREATE TRIGGER tr_mingguan_notify_wali_on_ghaib
    AFTER INSERT OR UPDATE OF status ON public.mingguan_absensi
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_wali_on_mingguan_ghaib();


-- 2. Trigger function untuk Absensi Ngaji
CREATE OR REPLACE FUNCTION public.notify_wali_on_ngaji_ghaib()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_santri_nama TEXT;
    v_tanggal DATE;
    v_hari_nama TEXT;
    v_body TEXT;
    v_ref_id TEXT;
BEGIN
    IF NEW.status = 'GHAIB' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'GHAIB') THEN
        SELECT nama INTO v_santri_nama FROM public.santri WHERE nis = NEW.santri_nis;

        SELECT s.tanggal
        INTO v_tanggal
        FROM public.ngaji_sesi s
        WHERE s.kegiatan_id = 'NGAJI'
          AND s.tahun_hijriah = NEW.tahun_hijriah
          AND s.bulan_hijriah_number = NEW.bulan_hijriah_number
          AND s.hari_ke = NEW.hari_hijriah
          AND s.sesi_ke = NEW.sesi_ke
        LIMIT 1;

        v_ref_id := 'ngaji_' || NEW.tahun_hijriah || '_' || NEW.bulan_hijriah_number || '_' || NEW.hari_hijriah || '_' || NEW.sesi_ke || '_' || NEW.santri_nis;

        IF v_tanggal IS NOT NULL THEN
            v_hari_nama := (ARRAY['Ahad','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[EXTRACT(DOW FROM v_tanggal) + 1];
            v_body := 'Ananda ' || v_santri_nama || ' tercatat tidak mengikuti kegiatan Ngaji / ALPHA pada hari ' ||
                      v_hari_nama || ', ' || to_char(v_tanggal, 'DD-MM-YYYY') || '.';
        ELSE
            v_body := 'Ananda ' || v_santri_nama || ' tercatat tidak mengikuti kegiatan Ngaji / ALPHA.' ||
                      ' (Hijriah: ' || NEW.tahun_hijriah || '-' || NEW.bulan_hijriah_number || '-' || NEW.hari_hijriah || ')';
        END IF;

        PERFORM public.wallet_notify_wali(
            NEW.santri_nis,
            'Kedisiplinan Santri',
            v_body,
            'absensi.ghaib',
            'ngaji_absensi',
            jsonb_build_object(
                'santri_nis', NEW.santri_nis,
                'santri_nama', v_santri_nama,
                'tanggal', v_tanggal,
                'tahun_hijriah', NEW.tahun_hijriah,
                'bulan_hijriah_number', NEW.bulan_hijriah_number,
                'hari_hijriah', NEW.hari_hijriah,
                'sesi_ke', NEW.sesi_ke
            ),
            'high',
            v_ref_id
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_ngaji_notify_wali_on_ghaib ON public.ngaji_absensi;
CREATE TRIGGER tr_ngaji_notify_wali_on_ghaib
    AFTER INSERT OR UPDATE OF status ON public.ngaji_absensi
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_wali_on_ngaji_ghaib();


-- 3. Trigger function untuk Absensi Sholat Hifdzi
CREATE OR REPLACE FUNCTION public.notify_wali_on_sholat_hifdzi_ghaib()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_santri_nama TEXT;
    v_kegiatan_label TEXT;
    v_tanggal DATE;
    v_hari_nama TEXT;
    v_body TEXT;
BEGIN
    IF NEW.status = 'GHAIB' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'GHAIB') THEN
        SELECT nama INTO v_santri_nama FROM public.santri WHERE nis = NEW.santri_nis;

        SELECT sk.label, ss.tanggal
        INTO v_kegiatan_label, v_tanggal
        FROM public.sholat_hifdzi_sesi ss
        JOIN public.sholat_hifdzi_kegiatan sk ON sk.id = ss.kegiatan_id
        WHERE ss.id = NEW.sesi_id;

        IF v_tanggal IS NOT NULL THEN
            v_hari_nama := (ARRAY['Ahad','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[EXTRACT(DOW FROM v_tanggal) + 1];
            v_body := 'Ananda ' || v_santri_nama || ' tercatat tidak mengikuti kegiatan ' || v_kegiatan_label ||
                      ' / ALPHA pada hari ' || v_hari_nama || ', ' || to_char(v_tanggal, 'DD-MM-YYYY') || '.';
        ELSE
            v_body := 'Ananda ' || v_santri_nama || ' tercatat tidak mengikuti kegiatan ' || v_kegiatan_label || ' / ALPHA.';
        END IF;

        PERFORM public.wallet_notify_wali(
            NEW.santri_nis,
            'Kedisiplinan Santri',
            v_body,
            'absensi.ghaib',
            'sholat_hifdzi_absensi',
            jsonb_build_object(
                'santri_nis', NEW.santri_nis,
                'santri_nama', v_santri_nama,
                'kegiatan', v_kegiatan_label,
                'tanggal', v_tanggal,
                'sesi_id', NEW.sesi_id,
                'absensi_id', NEW.id
            ),
            'high',
            NEW.id::TEXT
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sholat_hifdzi_notify_wali_on_ghaib ON public.sholat_hifdzi_absensi;
CREATE TRIGGER tr_sholat_hifdzi_notify_wali_on_ghaib
    AFTER INSERT OR UPDATE OF status ON public.sholat_hifdzi_absensi
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_wali_on_sholat_hifdzi_ghaib();


-- 4. Trigger function untuk Absensi Tahfidz (Hafalan & Murojaah)
CREATE OR REPLACE FUNCTION public.notify_wali_on_tahfidz_ghaib()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_santri_nama TEXT;
    v_kegiatan_label TEXT;
    v_tanggal DATE;
    v_hari_nama TEXT;
    v_body TEXT;
BEGIN
    IF NEW.status = 'GHAIB' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'GHAIB') THEN
        SELECT nama INTO v_santri_nama FROM public.santri WHERE nis = NEW.santri_nis;

        SELECT kt.label, ts.tanggal
        INTO v_kegiatan_label, v_tanggal
        FROM public.tahfidz_sesi ts
        JOIN public.kegiatan_tahfidz kt ON kt.id = ts.kegiatan_id
        WHERE ts.id = NEW.sesi_id;

        IF v_tanggal IS NOT NULL THEN
            v_hari_nama := (ARRAY['Ahad','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[EXTRACT(DOW FROM v_tanggal) + 1];
            v_body := 'Ananda ' || v_santri_nama || ' tercatat tidak mengikuti kegiatan ' || v_kegiatan_label ||
                      ' / ALPHA pada hari ' || v_hari_nama || ', ' || to_char(v_tanggal, 'DD-MM-YYYY') || '.';
        ELSE
            v_body := 'Ananda ' || v_santri_nama || ' tercatat tidak mengikuti kegiatan ' || v_kegiatan_label || ' / ALPHA.';
        END IF;

        PERFORM public.wallet_notify_wali(
            NEW.santri_nis,
            'Kedisiplinan Santri',
            v_body,
            'absensi.ghaib',
            'tahfidz_absensi',
            jsonb_build_object(
                'santri_nis', NEW.santri_nis,
                'santri_nama', v_santri_nama,
                'kegiatan', v_kegiatan_label,
                'tanggal', v_tanggal,
                'sesi_id', NEW.sesi_id,
                'absensi_id', NEW.id
            ),
            'high',
            NEW.id::TEXT
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tahfidz_notify_wali_on_ghaib ON public.tahfidz_absensi;
CREATE TRIGGER tr_tahfidz_notify_wali_on_ghaib
    AFTER INSERT OR UPDATE OF status ON public.tahfidz_absensi
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_wali_on_tahfidz_ghaib();
