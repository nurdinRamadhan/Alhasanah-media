# Audit Tahap 1 - Fund Accounting / Saldo Dana

Tanggal audit: 2026-07-22
Project Supabase lokal: `Al-hasanah Media`
Project ref: `sldobkbolvrahlnowrga`
Org: `nurdincrs123@gmail.com's Org` / `ykaqrcoawppyzfscrfxw`

## Status Audit

Audit ini adalah tahap awal sebelum desain dan SQL migration. Tidak ada schema, data, atau source code produksi yang diubah.

Sumber bukti:

- `catatan/saldo-keuangan.md`
- `.mcp.json`
- `supabase/.temp/linked-project.json`
- `supabase/bootstrap/000_baseline_full_schema.sql`
- `supabase/migrations/*.sql`
- `supabase/functions/*`
- `src/pages/*`, `src/components/*`, `src/types.tsx`
- MCP Supabase: organisasi, migrations, extensions

Keterbatasan penting:

- Tool MCP Supabase yang tersedia saat audit tidak mengekspos `execute_sql`, sehingga audit belum bisa membaca langsung `information_schema`, `pg_catalog`, `pg_trigger`, `pg_policy`, `cron.job`, atau data produksi aktual.
- Supabase CLI tidak tersedia di mesin ini (`supabase: command not found`), sehingga tidak bisa melakukan `supabase db dump`, `db pull`, atau `db diff`.
- Migration history remote dari MCP tidak identik dengan folder lokal. Contoh remote yang terlihat tetapi tidak ada di folder lokal saat audit: `20260617043327_harden_finance_scoping_and_aggr`, `20260617043408_add_cashflow_chart_rpc`, `20260617043420_add_expense_composition_rpc`, `20260617160207_20260617100000_fix_expense_sync_and_scope`, `20260617160245_20260617110000_create_dashboard_segment_rpcs`.
- Karena ada gap remote-vs-lokal, semua keputusan final migration harus menunggu audit SQL langsung terhadap database produksi atau dump schema terbaru.

## Tabel Finance Terkait

### `public.ref_jenis_pembayaran`

Lokasi baseline: `supabase/bootstrap/000_baseline_full_schema.sql`

Kolom utama:

- `id bigint primary key`
- `created_at timestamptz`
- `nama_pembayaran text`
- `tipe text`
- `nominal_default bigint`
- `is_aktif boolean`

Relasi:

- Direferensikan oleh `tagihan_santri.jenis_pembayaran_id`.

Catatan:

- Belum ada kolom eksplisit fund/accounting selain identitas jenis pembayaran.
- Untuk fund accounting, tabel ini dapat menjadi dimensi dana, tetapi tidak perlu diubah bila `saldo_dana` mereferensikan `jenis_pembayaran_id`.

### `public.santri`

Kolom scope yang relevan:

- `nis text primary key`
- `wali_id uuid`
- `jenis_kelamin public.tipe_gender`
- `jurusan public.tipe_jurusan`
- `kelas public.tipe_kelas`

Relasi:

- `santri.wali_id -> profiles.id`
- `tagihan_santri.santri_nis -> santri.nis`
- `transaksi_keuangan.santri_nis -> santri.nis`
- `pembayaran_tagihan.santri_nis -> santri.nis`

Catatan:

- Scope fund accounting harus diambil dari `santri.jenis_kelamin` dan `santri.jurusan` pada saat posting pembayaran.
- Jangan mengandalkan filter UI sebagai sumber kebenaran scope.

### `public.tagihan_santri`

Kolom utama:

- `id uuid primary key`
- `santri_nis text`
- `jenis_pembayaran_id bigint`
- `deskripsi_tagihan text`
- `nominal_tagihan bigint`
- `sisa_tagihan bigint`
- `tanggal_jatuh_tempo date`
- `status text check in ('LUNAS', 'BELUM', 'CICILAN')`

Relasi:

- `jenis_pembayaran_id -> ref_jenis_pembayaran.id`
- `santri_nis -> santri.nis`

Catatan:

- Ini adalah invoice/billing table, bukan ledger.
- Status dan `sisa_tagihan` sekarang disinkronkan dari `pembayaran_tagihan` melalui function `sync_tagihan_payment_status`.

### `public.pembayaran_tagihan`

Lokasi migration:

- `supabase/migrations/20260608050000_tagihan_installment_payments.sql`
- Diperkuat oleh `20260608051000_harden_tagihan_installment_payments.sql`
- Role `rois` ditambahkan oleh `20260608054845_allow_rois_tagihan_installments.sql`

Kolom utama:

- `id uuid primary key`
- `tagihan_id uuid not null`
- `transaksi_id uuid`
- `santri_nis text not null`
- `wali_id uuid`
- `recorded_by uuid`
- `amount bigint check amount > 0`
- `metode_pembayaran text`
- `source text check in ('admin_panel', 'midtrans', 'system')`
- `status text check in ('pending', 'posted', 'failed', 'cancelled')`
- `paid_at timestamptz`
- `provider_order_id text`
- `provider_payload jsonb`
- `idempotency_key text`
- `keterangan text`

Index/idempotency:

- Unique partial index on `provider_order_id` where not null.
- Unique partial index on `idempotency_key` where not null.
- Index on `(tagihan_id, status, paid_at desc)`.
- Index on `(santri_nis, paid_at desc)`.
- Index on `transaksi_id where transaksi_id is not null`.
- Later index on `wali_id where wali_id is not null`.
- Later index on `recorded_by where recorded_by is not null`.

Catatan:

- Ini adalah sumber terbaik untuk dana masuk tagihan.
- Fund accounting harus mem-post hanya saat `status = 'posted'`.
- Unique constraint yang ada sudah membantu mencegah double payment posting, tetapi `mutasi_dana` tetap perlu idempotency sendiri.

### `public.transaksi_keuangan`

Kolom utama:

- `id uuid primary key`
- `wali_id uuid`
- `jumlah bigint`
- `tanggal_transaksi timestamp`
- `status_transaksi text`
- `metode_pembayaran text`
- `midtrans_snap_token text`
- `waktu_bayar_sukses timestamp`
- `status public.tipe_status_transaksi`
- `jenis_pembayaran text`
- `jenis_transaksi varchar(50)`
- `kategori text`
- `keterangan text`
- `admin_pencatat_id uuid`
- `midtrans_order_id text unique`
- `santri_nis text`
- `pesan_donatur text`

Catatan:

- Table ini adalah log transaksi umum dan dipakai banyak flow: tagihan, donasi, wallet topup, diklat, pengeluaran.
- Tidak aman dijadikan satu-satunya sumber posting dana karena berisi pending/failure dan non-tagihan.
- Untuk fund accounting dana masuk tagihan, pakai `pembayaran_tagihan` sebagai event sumber.

### `public.detail_transaksi`

Kolom utama:

- `id bigint primary key`
- `transaksi_id uuid`
- `tagihan_id uuid`
- `nominal_dialokasikan bigint`

Catatan:

- Dipakai untuk alokasi transaksi ke tagihan.
- Migration cicilan menghapus default random UUID pada `transaksi_id` dan `tagihan_id`.
- Bisa menjadi konteks audit, tetapi sumber kebenaran paid installment tetap `pembayaran_tagihan`.

### `public.pengeluaran`

Kolom baseline:

- `id bigint primary key`
- `judul text`
- `kategori text`
- `nominal numeric`
- `tanggal_pengeluaran date`
- `keterangan text`
- `bukti_url text`
- `dicatat_oleh_id uuid`
- `dicatat_oleh_nama text`

Kolom yang dipakai aplikasi saat ini:

- `scope_gender`
- `scope_jurusan`

Catatan:

- Source code memakai `scope_gender` dan `scope_jurusan`, tetapi kolom ini tidak terlihat di baseline snippet. Kemungkinan ditambah oleh migration remote yang tidak ada lokal atau schema lokal tidak lengkap.
- UI sekarang membuat, mengubah, dan menghapus `pengeluaran` langsung melalui Refine data provider.
- Ada trigger lama `trg_sync_pengeluaran` yang insert ke `transaksi_keuangan` setelah insert `pengeluaran`.
- Untuk fund accounting, pengeluaran tidak boleh lagi hanya direct insert/update/delete tanpa ledger mutation.

## Function dan Trigger Finance

### `public.record_tagihan_payment(...)`

Lokasi terbaru lokal: `supabase/migrations/20260608054845_allow_rois_tagihan_installments.sql`

Perilaku:

- Security definer.
- Role yang boleh: `super_admin`, `bendahara`, `rois` untuk `admin_panel`; `service_role` atau role finance untuk `midtrans/system`.
- Cek idempotency via `p_idempotency_key`.
- Cek provider order via `p_provider_order_id`.
- Lock invoice row dengan `for update`.
- Hitung remaining dari sum `pembayaran_tagihan.status = 'posted'`.
- Insert/update `transaksi_keuangan`.
- Insert `detail_transaksi`.
- Insert `pembayaran_tagihan` dengan `status = 'posted'`.

Catatan:

- Ini titik paling aman untuk integrasi dana masuk karena sudah atomik, idempotent, dan memegang lock invoice.
- Karena execute function untuk authenticated dicabut dan hanya `service_role`, Admin Panel sudah memanggil melalui Edge Function `tagihan-payment-record`.

### `public.sync_tagihan_payment_status(...)`

Perilaku:

- Mengunci row `tagihan_santri`.
- Menjumlah `pembayaran_tagihan` posted.
- Mengubah `sisa_tagihan` dan `status` menjadi `LUNAS`, `CICILAN`, atau `BELUM`.

Catatan:

- Ini menjaga invoice state, bukan fund balance.

### `trg_sync_pembayaran_tagihan_status`

Perilaku:

- After insert/update/delete on `pembayaran_tagihan`.
- Memanggil `sync_tagihan_payment_status`.

### `public.fn_sync_pengeluaran_to_transaksi()`

Perilaku:

- Trigger after insert on `pengeluaran`.
- Insert baris `transaksi_keuangan` jenis `keluar`, status sukses/settlement.

Risiko:

- Hanya berjalan saat insert, bukan update/delete.
- Tidak mencatat hubungan eksplisit ke `pengeluaran.id`.
- Tidak menjaga saldo dana.
- Tidak immutable bila `pengeluaran` bisa diubah/dihapus setelahnya.

### `public.fn_sync_tagihan_to_transaksi()` dan `trg_sync_tagihan`

Status:

- Ada di baseline.
- Migration cicilan menjalankan `drop trigger if exists trg_sync_tagihan on public.tagihan_santri`.

Catatan:

- Jangan dipakai untuk fund accounting baru.
- Jalur tagihan modern adalah `record_tagihan_payment`.

### `public.terima_bayar_manual(...)`

Status:

- Legacy RPC.
- Migration `20260520112000_lock_legacy_finance_emis_rpcs.sql` mencabut akses public/anon/authenticated dan memberi hanya `service_role`.

Catatan:

- Jangan dipakai untuk fitur baru.

### `ops.finance_audit_events`

Lokasi:

- `supabase/migrations/20260520181000_finance_immutable_audit_trail.sql`
- `supabase/migrations/20260520183500_harden_finance_audit_source_default.sql`

Perilaku:

- Audit perubahan `transaksi_keuangan` dan `tagihan_santri`.
- Trigger after update.

Catatan:

- Ini audit trail perubahan, bukan ledger saldo.
- Jangan dijadikan sumber kebenaran `saldo_dana`.

## RLS dan Permission Terkait

### `pengeluaran`

Policy baseline:

- `"Admin All Access"` menggunakan `auth.role() = 'authenticated'`.

Risiko:

- Terlalu luas untuk fund accounting bila masih berlaku di produksi.
- Direct update/delete pengeluaran dapat membuat saldo dana tidak cocok dengan ledger.

### `pembayaran_tagihan`

Policy:

- Finance admins read/manage installment payments.
- Wali can view own installment payments.
- Setelah hardening, function posting hanya bisa dieksekusi oleh `service_role`.

Catatan:

- Untuk dana masuk, trigger internal pada `pembayaran_tagihan` dapat berjalan tanpa membuka API baru ke client.

### `transaksi_keuangan`

Policy baseline:

- Beberapa policy finance admin, scoped bendahara, dan wali.

Catatan:

- Akses cukup kompleks dan perlu diverifikasi langsung di production `pg_policies` sebelum menambahkan view/report dana.

## Jalur Aplikasi Saat Ini

### Admin Panel - Tagihan Manual

File: `src/pages/tagihan/list.tsx`

Flow:

- UI validasi nominal.
- Ambil access token.
- Invoke Edge Function `tagihan-payment-record`.
- Edge Function validasi user/role.
- Edge Function memanggil RPC `record_tagihan_payment` dengan service role.

Catatan:

- Cocok sebagai tempat masuk fund accounting.
- Partial payment langsung masuk sebagai row `pembayaran_tagihan.status = 'posted'`.

### Admin Panel - Tagihan Midtrans

Files:

- `src/pages/tagihan/list.tsx`
- `supabase/functions/midtrans-snap/index.ts`
- `supabase/functions/midtrans-payment/index.ts`

Flow:

- `midtrans-snap` membuat transaksi pending.
- Webhook `midtrans-payment` memverifikasi signature.
- Untuk tagihan, webhook upsert `transaksi_keuangan`, lalu memanggil `record_tagihan_payment`.

Catatan:

- Fund accounting jangan posting saat `midtrans-snap` membuat pending.
- Posting hanya setelah webhook sukses memanggil `record_tagihan_payment`.

### Admin Panel - Pengeluaran

File: `src/pages/pengeluaran/list.tsx`

Flow:

- Direct `createMutate({ resource: "pengeluaran" })`
- Direct `updateMutate({ resource: "pengeluaran" })`
- Direct `deleteMutate({ resource: "pengeluaran" })`

Catatan:

- Ini tidak memenuhi prinsip immutable ledger.
- Untuk fund accounting, perlu RPC baru seperti `record_pengeluaran_dana(...)` dan jalur koreksi/reversal.
- UI perlu memilih exactly one fund.

### AI / Telegram Functions

Files:

- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/telegram-webhook/index.ts`

Temuan:

- Ada akses baca finance.
- `ai-agent` dapat insert/update `tagihan_santri` dan insert `pengeluaran`.
- Telegram webhook membaca `pengeluaran`, `transaksi_keuangan`, `tagihan_santri`.

Risiko:

- Jalur AI yang insert `pengeluaran` harus ikut dipindah ke RPC dana, atau dibatasi agar tidak bypass ledger.

### Wallet / Dompet

Files:

- `supabase/functions/wallet-topup-create/index.ts`
- `supabase/functions/wallet-admin-topup-create/index.ts`
- `supabase/functions/midtrans-payment/index.ts`

Catatan:

- Wallet punya ledger sendiri (`transaksi_dompet`, `wallet_post_transaction`).
- Jangan dicampur dengan fund accounting pembayaran pesantren kecuali hanya untuk rekonsiliasi laporan.

## Extensions dan Infrastruktur

Installed extensions yang terlihat via MCP:

- `plpgsql`
- `pgcrypto`
- `uuid-ossp`
- `pg_cron`
- `pg_net`
- `pg_stat_statements`
- `vector`
- `postgis`
- `postgis_topology`
- `supabase_vault`

Catatan:

- `pgcrypto` dapat dipakai untuk UUID/hash bila dibutuhkan.
- `pg_cron` ada, tetapi cron jobs belum bisa diaudit langsung tanpa SQL access.

## Risiko Utama Untuk Fund Accounting

1. Gap schema remote-vs-lokal.

   Migration finance penting tampak ada di remote tetapi tidak ada lokal. Jangan membuat migration final sebelum schema produksi diverifikasi langsung.

2. Pengeluaran belum immutable.

   Direct update/delete `pengeluaran` berisiko membuat `saldo_dana` tidak cocok dengan `mutasi_dana`.

3. Sumber dana masuk harus tepat.

   `transaksi_keuangan` terlalu umum. Gunakan `pembayaran_tagihan.posted` untuk tagihan.

4. Double posting.

   Walaupun payment sudah punya idempotency, `mutasi_dana` tetap harus punya unique source reference seperti unique `(source_table, source_id, direction)` atau unique partial `pembayaran_tagihan_id`.

5. Scope harus berasal dari data database.

   `scope_gender` dan `scope_jurusan` untuk pembayaran harus diambil dari `santri` pada saat posting, bukan request client.

6. Backfill historis.

   Data lama perlu diposting ke `mutasi_dana` tanpa menggandakan pembayaran existing. Wajib ada verification script sebelum dan sesudah.

7. Legacy trigger.

   `trg_sync_pengeluaran` otomatis membuat `transaksi_keuangan` dari `pengeluaran`; desain baru harus memutuskan apakah tetap dipertahankan, diganti, atau dibuat kompatibel.

## Kesimpulan Audit Tahap 1

Desain fund accounting yang aman adalah additive ledger:

- `saldo_dana`: cached balance per `jenis_pembayaran_id`, `scope_gender`, `scope_jurusan`.
- `mutasi_dana`: immutable ledger untuk semua masuk/keluar dana.
- Dana masuk diposting dari `pembayaran_tagihan.status = 'posted'`.
- Dana keluar diposting dari RPC pengeluaran dana yang memilih satu fund, mengecek saldo, dan membuat mutation.
- Koreksi dilakukan dengan reversal mutation, bukan update/delete ledger.

## Pekerjaan Wajib Sebelum Migration

1. Dapatkan akses SQL read-only ke production metadata atau schema dump terbaru.
2. Verifikasi langsung:
   - kolom aktual `pengeluaran`
   - policy aktual `pengeluaran`, `transaksi_keuangan`, `tagihan_santri`, `pembayaran_tagihan`
   - trigger aktual
   - function signature aktual
   - cron jobs
   - views/materialized views finance
   - realtime publication
3. Sinkronkan folder migrations lokal dengan migration history remote.
4. Jalankan query audit data historis:
   - total `pembayaran_tagihan.posted`
   - pembayaran tanpa `jenis_pembayaran_id`
   - tagihan tanpa santri/scope
   - pengeluaran tanpa scope
   - pengeluaran update/delete risk dari audit log bila tersedia

Setelah poin di atas selesai, baru masuk ke Step 2: Architecture Review.
