-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SISTEM OPTIMASI KEUANGAN & AUDIT TERPADU (VERSI 2.1)                   ║
-- ║  Fix: Mapping Enum 'success' & Wali ID Auto-Lookup                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 1. PERBAIKAN FUNGSI AUDIT LOG
CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id, 
        action, 
        resource, 
        record_id, 
        details
    ) VALUES (
        auth.uid(), 
        TG_OP, 
        TG_TABLE_NAME, 
        COALESCE(NEW.id::text, OLD.id::text), 
        jsonb_build_object(
            'old_data', to_jsonb(OLD),
            'new_data', to_jsonb(NEW)
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. OTOMATISASI TRANSAKSI TAGIHAN SANTRI (PINTAR)
CREATE OR REPLACE FUNCTION public.fn_sync_tagihan_to_transaksi()
RETURNS TRIGGER AS $$
DECLARE
    v_wali_id UUID;
BEGIN
    IF (OLD.status != 'LUNAS' AND NEW.status = 'LUNAS') THEN
        SELECT wali_id INTO v_wali_id FROM public.santri WHERE nis = NEW.santri_nis;

        -- Hanya jalankan jika dilakukan oleh Admin (Auth UID ada)
        -- Transaksi Midtrans ditangani oleh Edge Function secara mandiri
        IF (auth.uid() IS NOT NULL) THEN
            INSERT INTO public.transaksi_keuangan (
                jumlah,
                tanggal_transaksi,
                status_transaksi, -- text
                status,           -- enum: success
                metode_pembayaran,
                jenis_transaksi,
                santri_nis,
                wali_id,
                admin_pencatat_id,
                keterangan
            ) VALUES (
                NEW.nominal_tagihan,
                now(),
                'settlement',
                'success', -- Enum value yang benar
                'cash',
                'masuk',
                NEW.santri_nis,
                v_wali_id,
                auth.uid(),
                '[SISTEM] Pembayaran SPP/Tagihan (Tunai): ' || NEW.deskripsi_tagihan
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_tagihan ON public.tagihan_santri;
CREATE TRIGGER trg_sync_tagihan
    AFTER UPDATE ON public.tagihan_santri
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_tagihan_to_transaksi();


-- 3. OTOMATISASI TRANSAKSI DIKLAT / PASARAN
CREATE OR REPLACE FUNCTION public.fn_sync_diklat_to_transaksi()
RETURNS TRIGGER AS $$
DECLARE
    total_bayar BIGINT;
BEGIN
    IF (OLD.status_pembayaran != 'LUNAS' AND NEW.status_pembayaran = 'LUNAS') THEN
        total_bayar := NEW.biaya_pendaftaran + NEW.belanja_kitab_nominal;
        
        INSERT INTO public.transaksi_keuangan (
            jumlah,
            tanggal_transaksi,
            status_transaksi,
            status, -- enum: success
            metode_pembayaran,
            jenis_transaksi,
            admin_pencatat_id,
            keterangan
        ) VALUES (
            total_bayar,
            now(),
            'settlement',
            'success', -- Enum value yang benar
            'cash',
            'masuk',
            auth.uid(),
            '[SISTEM] Biaya Pasaran/Diklat: ' || NEW.nama_lengkap || ' (' || NEW.jenis_diklat || ')'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_diklat ON public.peserta_diklat;
CREATE TRIGGER trg_sync_diklat
    AFTER UPDATE ON public.peserta_diklat
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_diklat_to_transaksi();


-- 4. OTOMATISASI TRANSAKSI PENGELUARAN
CREATE OR REPLACE FUNCTION public.fn_sync_pengeluaran_to_transaksi()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.transaksi_keuangan (
        jumlah,
        tanggal_transaksi,
        status_transaksi,
        status, -- enum: success
        metode_pembayaran,
        jenis_transaksi,
        admin_pencatat_id,
        keterangan
    ) VALUES (
        NEW.nominal,
        NEW.tanggal_pengeluaran::timestamp,
        'settlement',
        'success', -- Enum value yang benar
        'cash',
        'keluar',
        auth.uid(),
        '[SISTEM] Pengeluaran: ' || NEW.judul
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_pengeluaran ON public.pengeluaran;
CREATE TRIGGER trg_sync_pengeluaran
    AFTER INSERT ON public.pengeluaran
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_pengeluaran_to_transaksi();
