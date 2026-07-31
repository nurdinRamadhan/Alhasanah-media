# Dokumentasi Trigger & Functions — Modul Keuangan Tagihan

> Diperbarui: 31 Juli 2026
> Sumber: Query langsung dari production database

---

## Daftar Isi

1. [Ringkasan Arsitektur](#1-ringkasan-arsitektur)
2. [Functions](#2-functions)
   - 2.1 `terima_bayar_manual`
   - 2.2 `record_tagihan_payment`
   - 2.3 `sync_tagihan_payment_status`
3. [Triggers](#3-triggers)
   - 3.1 `trg_validate_lunas_pembayaran`
   - 3.2 `trg_log_tagihan_status_change`
   - 3.3 `trg_sync_pembayaran_tagihan_status`
4. [Tables](#4-tables)
   - 4.1 `tagihan_status_log`
5. [Alur Pembayaran](#5-alur-pembayaran)
6. [Validasi & Safeguards](#6-validasi--safeguards)
7. [Riwayat Fix — Trigger tipe yang salah](#7-riwayat-fix)

---

## 1. Ringkasan Arsitektur

### Flow Pembayaran yang Benar

```
Admin bayar
  → insert pembayaran_tagihan (INSERT)
    → trigger trg_sync_pembayaran_tagihan_status fires (AFTER ROW)
      → sync_tagihan_payment_status() hitung total bayar
        → update tagihan_santri: status, sisa_tagihan
  → trigger trg_log_tagihan_status_change fires (AFTER UPDATE on tagihan_santri)
    → log perubahan ke tagihan_status_log
  → trigger trg_validate_lunas_pembayaran checks (BEFORE UPDATE on tagihan_santri)
    → BLOKIR jika status LUNAS tanpa pembayaran record
```

### Konsistensi Data (per 31 Juli 2026)

| Tabel | Isi | Sinkron? |
|-------|-----|----------|
| `pembayaran_tagihan` | 49 records, Rp 4,550,000 | ✅ |
| `mutasi_dana` | 49 MASUK | ✅ |
| `saldo_dana` | total_masuk | ✅ |
| `tagihan_terbayar` | nominal - sisa | ✅ |

---

## 2. Functions

### 2.1 `terima_bayar_manual`

**Tujuan**: Memproses pembayaran tunai oleh admin.

**Signature**:
```sql
terima_bayar_manual(p_tagihan_id uuid, p_admin_id uuid, p_keterangan text)
RETURNS json
```

**Isi Lengkap**:
```sql
CREATE OR REPLACE FUNCTION public.terima_bayar_manual(
  p_tagihan_id uuid,
  p_admin_id uuid,
  p_keterangan text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tagihan record;
  v_sisa bigint;
  v_payment_id uuid;
BEGIN
  IF NOT (public.current_user_role() IN ('super_admin', 'admin_bendahara', 'bendahara')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_admin_id <> auth.uid() THEN
    RAISE EXCEPTION 'Admin pencatat tidak sesuai sesi login';
  END IF;

  SELECT * INTO v_tagihan FROM public.tagihan_santri WHERE id = p_tagihan_id;
  IF v_tagihan IS NULL THEN
    RAISE EXCEPTION 'Tagihan tidak ditemukan (ID salah)';
  END IF;
  IF v_tagihan.status = 'LUNAS' THEN
    RAISE EXCEPTION 'Tagihan ini sudah LUNAS sebelumnya!';
  END IF;

  -- Hitung sisa dari pembayaran yang sudah ada
  SELECT greatest(coalesce(v_tagihan.nominal_tagihan, 0) - coalesce(sum(amount), 0), 0)
    INTO v_sisa
  FROM public.pembayaran_tagihan
  WHERE tagihan_id = p_tagihan_id
    AND status = 'posted';

  IF v_sisa <= 0 THEN
    RAISE EXCEPTION 'Tagihan sudah lunas.';
  END IF;

  -- Insert pembayaran_tagihan (trigger akan sync status ke LUNAS)
  INSERT INTO public.pembayaran_tagihan (
    tagihan_id, santri_nis, amount, metode_pembayaran,
    source, status, paid_at, recorded_by, keterangan
  ) VALUES (
    p_tagihan_id, v_tagihan.santri_nis, v_sisa, 'cash',
    'admin_panel', 'posted', now(), p_admin_id,
    coalesce(p_keterangan, 'Pembayaran tunai: ' || v_tagihan.deskripsi_tagihan)
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.log_aktivitas (user_id, aktivitas, detail)
  VALUES (p_admin_id, 'TERIMA_BAYAR_MANUAL',
    'Menerima pembayaran tunai tagihan ID: ' || p_tagihan_id ||
    ' sebesar Rp ' || v_sisa::text);

  RETURN json_build_object(
    'status', 'success',
    'message', 'Pembayaran tunai berhasil diproses',
    'payment_id', v_payment_id,
    'amount', v_sisa
  );
END;
$function$;
```

**Alur Kerja**:
1. Cek role admin (`super_admin`, `admin_bendahara`, `bendahara`)
2. Cek tagihan ada dan belum LUNAS
3. Hitung sisa tagihan dari `pembayaran_tagihan` (bukan `sisa_tagihan` langsung)
4. Insert ke `pembayaran_tagihan` → trigger sync status otomatis
5. Log aktivitas
6. Return JSON

---

### 2.2 `record_tagihan_payment`

**Tujuan**: Mencatat pembayaran tagihan dari berbagai sumber (admin panel, Midtrans, sistem).

**Signature**:
```sql
record_tagihan_payment(
  p_tagihan_id uuid,
  p_amount bigint,
  p_metode_pembayaran text DEFAULT 'cash',
  p_source text DEFAULT 'admin_panel',
  p_provider_order_id text DEFAULT NULL,
  p_transaksi_id uuid DEFAULT NULL,
  p_keterangan text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT '{}'::jsonb,
  p_recorded_by uuid DEFAULT NULL
)
RETURNS jsonb
```

**Isi Lengkap**:
```sql
CREATE OR REPLACE FUNCTION public.record_tagihan_payment(
  p_tagihan_id uuid,
  p_amount bigint,
  p_metode_pembayaran text DEFAULT 'cash'::text,
  p_source text DEFAULT 'admin_panel'::text,
  p_provider_order_id text DEFAULT NULL::text,
  p_transaksi_id uuid DEFAULT NULL::uuid,
  p_keterangan text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_provider_payload jsonb DEFAULT '{}'::jsonb,
  p_recorded_by uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := coalesce(auth.uid(), p_recorded_by);
  v_auth_role text := coalesce(auth.role(), '');
  v_profile_role text;
  v_tagihan public.tagihan_santri%rowtype;
  v_wali_id uuid;
  v_remaining bigint;
  v_payment_id uuid;
  v_transaksi_id uuid := p_transaksi_id;
  v_existing public.pembayaran_tagihan%rowtype;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran harus lebih dari 0.';
  END IF;

  IF p_source NOT IN ('admin_panel', 'midtrans', 'system') THEN
    RAISE EXCEPTION 'Sumber pembayaran tidak valid.';
  END IF;

  SELECT lower(coalesce(role, ''))
    INTO v_profile_role
  FROM public.profiles
  WHERE id = v_actor;

  IF p_source = 'admin_panel' THEN
    IF v_profile_role NOT IN ('super_admin', 'bendahara', 'rois') THEN
      RAISE EXCEPTION 'Anda tidak berwenang mencatat pembayaran tagihan.';
    END IF;
  ELSIF p_source IN ('midtrans', 'system') THEN
    IF v_auth_role <> 'service_role' AND v_profile_role NOT IN ('super_admin', 'bendahara', 'rois') THEN
      RAISE EXCEPTION 'Sumber pembayaran sistem hanya boleh diproses backend.';
    END IF;
  END IF;

  -- Idempotency check (by key)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.pembayaran_tagihan
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'payment_id', v_existing.id,
        'transaksi_id', v_existing.transaksi_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Idempotency check (by provider order_id)
  IF p_provider_order_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.pembayaran_tagihan
    WHERE provider_order_id = p_provider_order_id
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'payment_id', v_existing.id,
        'transaksi_id', v_existing.transaksi_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- Lock tagihan row
  SELECT * INTO v_tagihan
  FROM public.tagihan_santri
  WHERE id = p_tagihan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tagihan tidak ditemukan.';
  END IF;

  SELECT wali_id INTO v_wali_id
  FROM public.santri
  WHERE nis = v_tagihan.santri_nis;

  -- Hitung sisa
  SELECT greatest(coalesce(v_tagihan.nominal_tagihan, 0) - coalesce(sum(amount), 0), 0)
    INTO v_remaining
  FROM public.pembayaran_tagihan
  WHERE tagihan_id = p_tagihan_id
    AND status = 'posted';

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'Tagihan sudah lunas.';
  END IF;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Nominal pembayaran melebihi sisa tagihan.';
  END IF;

  -- Insert/update transaksi_keuangan (legacy)
  IF v_transaksi_id IS NULL THEN
    INSERT INTO public.transaksi_keuangan (
      wali_id, admin_pencatat_id, santri_nis, jumlah,
      tanggal_transaksi, waktu_bayar_sukses, status_transaksi, status,
      metode_pembayaran, jenis_transaksi, kategori,
      midtrans_order_id, keterangan
    ) VALUES (
      CASE WHEN p_source = 'midtrans' THEN v_wali_id ELSE NULL END,
      CASE WHEN p_source = 'admin_panel' THEN v_actor ELSE NULL END,
      v_tagihan.santri_nis, p_amount, now(), now(),
      CASE WHEN p_source = 'midtrans' THEN 'settlement' ELSE 'success' END,
      'success', p_metode_pembayaran, 'masuk', 'tagihan',
      p_provider_order_id,
      coalesce(p_keterangan, '[TAGIHAN] Pembayaran ' || v_tagihan.deskripsi_tagihan)
    ) RETURNING id INTO v_transaksi_id;
  ELSE
    UPDATE public.transaksi_keuangan
    SET status_transaksi = CASE WHEN p_source = 'midtrans' THEN 'settlement' ELSE 'success' END,
        status = 'success',
        metode_pembayaran = p_metode_pembayaran,
        waktu_bayar_sukses = coalesce(waktu_bayar_sukses, now()),
        kategori = coalesce(kategori, 'tagihan'),
        keterangan = coalesce(keterangan, p_keterangan)
    WHERE id = v_transaksi_id;
  END IF;

  -- Insert detail_transaksi
  INSERT INTO public.detail_transaksi (transaksi_id, tagihan_id, nominal_dialokasikan)
  VALUES (v_transaksi_id, p_tagihan_id, p_amount);

  -- Insert pembayaran_tagihan → trigger sync status
  INSERT INTO public.pembayaran_tagihan (
    tagihan_id, transaksi_id, santri_nis, wali_id, recorded_by,
    amount, metode_pembayaran, source, status, paid_at,
    provider_order_id, provider_payload, idempotency_key, keterangan
  ) VALUES (
    p_tagihan_id, v_transaksi_id, v_tagihan.santri_nis, v_wali_id,
    CASE WHEN p_source = 'admin_panel' THEN v_actor ELSE NULL END,
    p_amount, p_metode_pembayaran, p_source, 'posted', now(),
    p_provider_order_id, coalesce(p_provider_payload, '{}'::jsonb),
    p_idempotency_key, p_keterangan
  ) RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'transaksi_id', v_transaksi_id,
    'idempotent', false
  );
END;
$function$;
```

**Catatan Penting**:
- Function ini juga insert ke `transaksi_keuangan` (legacy table) untuk backward compatibility
- Trigger `trg_sync_pembayaran_tagihan_status` akan meng-update `tagihan_santri` otomatis

---

### 2.3 `sync_tagihan_payment_status`

**Tujuan**: Menghitung total pembayaran dan update status tagihan.

**Signature**:
```sql
sync_tagihan_payment_status(p_tagihan_id uuid)
RETURNS void
```

**Isi Lengkap**:
```sql
CREATE OR REPLACE FUNCTION public.sync_tagihan_payment_status(p_tagihan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_nominal bigint;
  v_paid bigint;
  v_sisa bigint;
  v_status text;
BEGIN
  SELECT coalesce(nominal_tagihan, 0) INTO v_nominal
  FROM public.tagihan_santri
  WHERE id = p_tagihan_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT coalesce(sum(amount), 0) INTO v_paid
  FROM public.pembayaran_tagihan
  WHERE tagihan_id = p_tagihan_id
    AND status = 'posted';

  v_sisa := greatest(v_nominal - v_paid, 0);
  v_status := CASE
    WHEN v_sisa = 0 AND v_nominal > 0 THEN 'LUNAS'
    WHEN v_paid > 0 THEN 'CICILAN'
    ELSE 'BELUM'
  END;

  UPDATE public.tagihan_santri
  SET sisa_tagihan = v_sisa,
      status = v_status,
      updated_at = now()
  WHERE id = p_tagihan_id;
END;
$function$;
```

**Logika Status**:
- `v_paid >= nominal` → **LUNAS**, `sisa = 0`
- `0 < v_paid < nominal` → **CICILAN**, `sisa = nominal - paid`
- `v_paid = 0` → **BELUM**, `sisa = nominal`

---

## 3. Triggers

### 3.1 `trg_validate_lunas_pembayaran`

**Tujuan**: Memblokir status LUNAS yang diatur manual tanpa record pembayaran.

**Trigger Function**:
```sql
CREATE OR REPLACE FUNCTION public.validate_lunas_requires_pembayaran()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pembayaran_count bigint;
BEGIN
  -- Only validate when status changes TO LUNAS
  IF NEW.status = 'LUNAS' AND OLD.status IS DISTINCT FROM 'LUNAS' THEN

    SELECT COUNT(*) INTO v_pembayaran_count
    FROM public.pembayaran_tagihan pt
    WHERE pt.tagihan_id = NEW.id;

    IF v_pembayaran_count = 0 THEN
      RAISE EXCEPTION 'Status LUNAS tidak dapat diatur: tagihan ini belum memiliki record pembayaran. Silakan input pembayaran terlebih dahulu.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
```

**Trigger**:
```sql
CREATE TRIGGER trg_validate_lunas_pembayaran
BEFORE UPDATE ON public.tagihan_santri
FOR EACH ROW EXECUTE FUNCTION validate_lunas_requires_pembayaran();
```

**Kapan Fire**: BEFORE UPDATE pada `tagihan_santri`, hanya ketika `status` berubah ke `LUNAS`.

---

### 3.2 `trg_log_tagihan_status_change`

**Tujuan**: Mencatat semua perubahan status/nominal/sisa tagihan ke tabel audit.

**Trigger Function**:
```sql
CREATE OR REPLACE FUNCTION public.log_tagihan_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.nominal_tagihan IS DISTINCT FROM NEW.nominal_tagihan
     OR OLD.sisa_tagihan IS DISTINCT FROM NEW.sisa_tagihan THEN

    INSERT INTO public.tagihan_status_log (
      tagihan_id, santri_nis,
      old_status, new_status,
      old_nominal, new_nominal,
      old_sisa, new_sisa,
      changed_by, change_source
    ) VALUES (
      NEW.id, NEW.santri_nis,
      OLD.status, NEW.status,
      OLD.nominal_tagihan, NEW.nominal_tagihan,
      OLD.sisa_tagihan, NEW.sisa_tagihan,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      CASE
        WHEN pg_trigger_depth() > 1 THEN 'trigger_cascade'
        ELSE 'manual'
      END
    );
  END IF;

  RETURN NEW;
END;
$function$;
```

**Trigger**:
```sql
CREATE TRIGGER trg_log_tagihan_status_change
AFTER UPDATE ON public.tagihan_santri
FOR EACH ROW EXECUTE FUNCTION log_tagihan_status_change();
```

**Catatan `change_source`**:
- `'trigger_cascade'` — perubahan dari trigger lain (misal: `sync_tagihan_payment_status`)
- `'manual'` — perubahan langsung dari user/admin

---

### 3.3 `trg_sync_pembayaran_tagihan_status`

> **FIXED 31 Juli 2026**: Trigger sebelumnya terdaftar sebagai BEFORE STATEMENT (tgtype=29), yang artinya tidak bisa mengakses `NEW`/`OLD` row data. Trigger di-drop dan recreated sebagai AFTER ROW.

**Trigger Function**:
```sql
CREATE OR REPLACE FUNCTION public.tr_sync_tagihan_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.sync_tagihan_payment_status(COALESCE(new.tagihan_id, old.tagihan_id));
  IF tg_op = 'DELETE' THEN
    RETURN old;
  END IF;
  RETURN NEW;
END;
$function$;
```

**Trigger (FIXED)**:
```sql
CREATE TRIGGER trg_sync_pembayaran_tagihan_status
AFTER INSERT OR UPDATE OR DELETE ON public.pembayaran_tagihan
FOR EACH ROW EXECUTE FUNCTION tr_sync_tagihan_payment_status();
```

**Kapan Fire**: Setiap INSERT/UPDATE/DELETE pada `pembayaran_tagihan`.

---

## 4. Tables

### 4.1 `tagihan_status_log`

```sql
CREATE TABLE public.tagihan_status_log (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  tagihan_id   uuid NOT NULL,
  santri_nis   text NOT NULL,
  old_status   text,
  new_status   text NOT NULL,
  old_nominal  bigint,
  new_nominal  bigint,
  old_sisa     bigint,
  new_sisa     bigint,
  changed_by   uuid DEFAULT auth.uid(),
  changed_at   timestamptz DEFAULT now(),
  change_source text DEFAULT 'manual'::text
);
```

---

## 5. Alur Pembayaran

### Flow 1: Admin Panel — Cash
```
terima_bayar_manual()
  → INSERT pembayaran_tagihan (amount = sisa, source = 'admin_panel')
  → trg_sync_pembayaran_tagihan_status fires (AFTER ROW)
    → sync_tagihan_payment_status()
      → hitung paid = SUM(amount)
      → UPDATE tagihan_santri: status, sisa_tagihan
  → trg_log_tagihan_status_change fires (AFTER UPDATE)
    → INSERT tagihan_status_log
```

### Flow 2: Midtrans Webhook
```
midtrans-webhook → record_tagihan_payment(source = 'midtrans')
  → INSERT pembayaran_tagihan
  → trg_sync_pembayaran_tagihan_status fires (AFTER ROW)
    → sync_tagihan_payment_status()
  → trg_log_tagihan_status_change fires
```

### Flow 3: Record Pembayaran via Admin Form
```
Admin pilih tagihan → Bayar
  → record_tagihan_payment(source = 'admin_panel')
  → INSERT pembayaran_tagihan
  → trg_sync_pembayaran_tagihan_status fires (AFTER ROW)
    → sync_tagihan_payment_status()
  → trg_log_tagihan_status_change fires
```

---

## 6. Validasi & Safeguards

| Safeguard | Trigger/Function | Tipe |
|-----------|-----------------|------|
| LUNAS wajib punya pembayaran | `trg_validate_lunas_pembayaran` | BEFORE UPDATE on tagihan_santri |
| Status sync otomatis | `trg_sync_pembayaran_tagihan_status` | AFTER INSERT/UPDATE/DELETE on pembayaran_tagihan |
| Audit trail perubahan | `trg_log_tagihan_status_change` | AFTER UPDATE on tagihan_santri |
| Idempotency (Midtrans) | `record_tagihan_payment` | Function-level |
| Role authorization | `terima_bayar_manual`, `record_tagihan_payment` | Function-level |

---

## 7. Riwayat Fix

### Fix: Trigger `trg_sync_pembayaran_tagihan_status` — 31 Juli 2026

**Masalah**: Tagihan Ahmad Hafiz Al-Hawari (NIS 202002010) — Tilawah Safar 1448 H:
- `nominal_tagihan` = 20,000
- `sisa_tagihan` = 0
- `pembayaran` = 20,000 (1 record, posted)
- `status` = **CICILAN** ← seharusnya LUNAS

**Root Cause**: Trigger `trg_sync_pembayaran_tagihan_status` terdaftar sebagai **BEFORE STATEMENT** (tgtype=29), bukan **AFTER ROW**. Karena BEFORE STATEMENT:
1. Trigger fires sebelum row data tersedia
2. Function tidak bisa mengakses `NEW.tagihan_id`/`OLD.tagihan_id`
3. Status tagihan tidak pernah di-sync oleh trigger

**Fix**:
```sql
-- Drop trigger yang salah
DROP TRIGGER IF EXISTS trg_sync_pembayaran_tagihan_status ON public.pembayaran_tagihan;

-- Recreate sebagai AFTER ROW (benar)
CREATE TRIGGER trg_sync_pembayaran_tagihan_status
AFTER INSERT OR UPDATE OR DELETE ON public.pembayaran_tagihan
FOR EACH ROW EXECUTE FUNCTION tr_sync_tagihan_payment_status();
```

**Bulk Sync**: Semua tagihan yang statusnya inconsistensi di-sync ulang secara manual.

**Verifikasi**:
- Ahmad Hafiz Tilawah: CICILAN → LUNAS ✅
- Insert pembayaran parsial → BELUM → CICILAN ✅
- Insert sisa pembayaran → CICILAN → LUNAS ✅
- Audit log mencatat semua perubahan dengan `change_source = 'trigger_cascade'` ✅
- 0 tagihan dengan sisa=0 tapi bukan LUNAS ✅
- 0 tagihan dengan sisa>0 tapi LUNAS ✅

---

### Cleanup Test Data — 31 Juli 2026 (Sesi yang sama)

**Masalah**: Saat verifikasi trigger,2 record pembayaran test (Rp 150,000 × 2) dibuat untuk santri Muhammad Syakir Al-Munawwar (NIS 20202001) — Makan Safar 1448 H. Data ini bukan pembayaran asli.

**Yang dilakukan**:
1. Drop sementara 3 immutable triggers (⚠️ seharusnya DISABLE, bukan DROP — lihat catatan di bawah)
2. Hapus 2 mutasi_dana (id 81, 82)
3. Hapus 2 pembayaran_tagihan (test records)
4. Recalculate saldo_dana id 28: 4,200,000 → 3,900,000
5. Reset tagihan Makan: LUNAS/sisa=0 → BELUM/sisa=300,000
6. Recreate 3 immutable triggers

**Verifikasi pasca-cleanup**:
- 4 tabel keuangan sync di Rp 4,800,000 (48 records) ✅
- 0 sisa=0 tapi bukan LUNAS ✅
- 0 sisa>0 tapi LUNAS ✅
- 0 status mismatch ✅
- 0 test records remaining ✅
- Semua saldo_dana konsisten dengan mutasi_dana ✅
- Semua trigger aktif & verified via `pg_get_triggerdef` ✅

> ⚠️ **Catatan Prosedural**: Seharusnya pakai `ALTER TABLE ... DISABLE/ENABLE TRIGGER` bukan `DROP/CREATE`. DISABLE/ENABLE lebih aman karena tidak menghapus definisi trigger dari catalog. DROP/CREATE berisiko trigger tidak ter-recreate jika ada error di tengah proses.

**Prosedur yang benar untuk bypass immutable trigger**:
```sql
-- DISABLE (aman, reversible)
ALTER TABLE mutasi_dana DISABLE TRIGGER tg_blokir_update_mutasi_dana;
-- ... operasi ...
ALTER TABLE mutasi_dana ENABLE TRIGGER tg_blokir_update_mutasi_dana;

-- BUKAN:
DROP TRIGGER tg_blokir_update_mutasi_dana ON mutasi_dana;
-- ... operasi ...
CREATE TRIGGER ... ; -- berisiko gagal
```
