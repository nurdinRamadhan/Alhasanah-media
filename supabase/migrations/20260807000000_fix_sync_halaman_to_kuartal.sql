-- ============================================================
-- FIX: sync_peta_hafalan_from_hafalan stores halaman × 4 (kuartal)
-- Previously stored raw halaman count, which broke modal display
-- ============================================================

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
    v_pages          INTEGER;
    v_total_in_juz   INTEGER;
    v_ayat_total     INTEGER;
    v_is_completed   BOOLEAN;
    v_existing_hal   INTEGER;
    v_existing_done  BOOLEAN;
    v_action         TEXT;
    v_kuartal        INTEGER;
BEGIN
    FOR v_juz IN
        SELECT DISTINCT ht.juz
        FROM public.hafalan_tahfidz ht
        WHERE ht.santri_nis = p_santri_nis
          AND ht.ayat_awal IS NOT NULL
          AND ht.ayat_akhir IS NOT NULL
          AND (p_juz IS NULL OR ht.juz = p_juz)
        ORDER BY ht.juz
    LOOP
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

        -- FIX: konversi halaman ke kuartal (1 halaman = 4 kuartal)
        v_kuartal := v_pages * 4;

        SELECT COUNT(*) INTO v_total_in_juz
        FROM public.quran_page_index
        WHERE juz = v_juz;

        v_is_completed := (v_pages >= v_total_in_juz AND v_total_in_juz > 0);

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
