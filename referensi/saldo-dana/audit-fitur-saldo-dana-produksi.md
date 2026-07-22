# Audit Fitur Saldo Dana / Fund Accounting

Tanggal audit: 2026-07-22

## Ringkasan

Status keseluruhan: **belum siap produksi end-to-end**.

Backend database saldo dana sudah diterapkan dan struktur intinya valid. Frontend modul `Pengeluaran` belum sesuai rencana produksi karena masih membuat pengeluaran melalui direct insert ke tabel `pengeluaran`, belum memakai RPC `record_pengeluaran_dana`, dan belum memiliki pilihan `Sumber Dana`.

## Status Backend Database

Verifikasi database Supabase menunjukkan:

- `public.saldo_dana`: tersedia
- `public.mutasi_dana`: tersedia
- kolom `public.pengeluaran.jenis_pembayaran_id`: tersedia
- kolom `public.pengeluaran.scope_gender`: tersedia
- kolom `public.pengeluaran.scope_jurusan`: tersedia
- RLS aktif pada `saldo_dana` dan `mutasi_dana`
- policy RLS `saldo_dana` dan `mutasi_dana`: tersedia
- 6 trigger ledger utama: tersedia
- RPC publik `public.record_pengeluaran_dana`: tersedia
- mismatch saldo: `0`

Smoke test sebelumnya juga berhasil:

- fungsi internal ledger bisa membuat mutasi
- direct update ke `saldo_dana` diblokir
- transaksi test di-rollback

## Status Frontend

File utama:

- `src/pages/pengeluaran/list.tsx`
- `src/types.tsx`
- `src/utility/resources.tsx`
- `src/lazyPages.tsx`
- `src/accessControlProvider.ts`

Menu dan route sudah tersedia:

- resource: `pengeluaran`
- route: `/pengeluaran`
- parent menu: `keuangan_menu`

TypeScript check:

```bash
npx tsc --noEmit
```

Status: **berhasil tanpa error**.

Full build:

```bash
npm run build
```

Status: **tidak tervalidasi penuh**. Proses masuk ke tahap `refine build`, mengeluarkan pesan `Something went wrong when trying to get installed Refine packages`, lalu menggantung tanpa selesai. Proses dihentikan manual. Tidak ada TypeScript error yang terdeteksi dari `tsc --noEmit`.

## Temuan Blocker

### 1. CREATE pengeluaran masih direct insert

Lokasi:

`src/pages/pengeluaran/list.tsx`

Temuan:

```ts
await createMutate({ resource: "pengeluaran", values: payload });
```

Dampak:

- frontend belum memakai RPC `record_pengeluaran_dana`
- `jenis_pembayaran_id` belum wajib pada UI
- alur create belum memakai validasi atomik backend
- idempotency belum digunakan di frontend
- logging belum mencatat `mutasi_dana_id`

Status produksi: **blocker**.

### 2. Form pengeluaran belum punya field Sumber Dana

Lokasi:

`src/pages/pengeluaran/list.tsx`

Dampak:

- user tidak bisa memilih fund untuk pengeluaran
- payload tidak mengirim `p_jenis_pembayaran_id`
- tidak sesuai desain fund accounting

Status produksi: **blocker**.

### 3. Tipe `IPengeluaran` belum memuat fund

Lokasi:

`src/types.tsx`

Temuan:

`IPengeluaran` belum memiliki:

```ts
jenis_pembayaran_id?: number | null;
ref_jenis_pembayaran?: IRefJenisPembayaran | null;
```

Dampak:

- tabel/filter/export tidak bisa typed dengan benar untuk sumber dana
- implementasi frontend rawan memakai `any`

Status produksi: **blocker**.

### 4. Delete menampilkan success sebelum operasi berhasil

Lokasi:

`src/pages/pengeluaran/list.tsx`

Temuan:

```ts
deleteMutate({ resource: "pengeluaran", id });
setDeleteConfirm(null);
message.success("Data dihapus");
```

Dampak:

- backend dapat menolak delete karena record sudah masuk ledger
- UI tetap menampilkan success meskipun operasi gagal
- operator bisa mendapat status palsu

Status produksi: **blocker**.

## Temuan Non-Blocker Tetapi Perlu Diperbaiki

### 1. Edit masih mencoba update field ledger-sensitive

Field seperti `nominal`, `kategori`, `scope_gender`, `scope_jurusan`, dan `jenis_pembayaran_id` seharusnya tidak diedit langsung setelah ledger terbentuk.

Rekomendasi:

- disable field tersebut pada mode edit
- gunakan mekanisme koreksi untuk perubahan nilai keuangan

### 2. Tabel belum menampilkan sumber dana

Rekomendasi:

- fetch `ref_jenis_pembayaran`
- buat map `id -> nama_pembayaran`
- tampilkan kolom `Sumber Dana`

### 3. Filter dan export belum memuat sumber dana

Rekomendasi:

- tambah filter `Sumber Dana`
- tambah kolom `Sumber Dana` pada export Excel

## Kesesuaian Dengan Rencana

| Area | Status |
| --- | --- |
| Backend `saldo_dana` | sesuai |
| Backend `mutasi_dana` | sesuai |
| Trigger ledger | sesuai |
| RLS ledger | sesuai |
| RPC `record_pengeluaran_dana` | sesuai |
| Frontend route/menu | sesuai |
| Frontend create via RPC | belum sesuai |
| Dropdown sumber dana | belum sesuai |
| TypeScript fund field | belum sesuai |
| Error handling delete ledger | belum sesuai |
| Export/filter sumber dana | belum sesuai |

## Kesimpulan

Fitur ini **belum siap produksi end-to-end**.

Backend sudah berada pada kondisi layak untuk integrasi produksi awal. Frontend belum memenuhi acceptance criteria karena pengeluaran masih dibuat langsung ke tabel dan belum memilih sumber dana.

## Rekomendasi Langkah Selanjutnya

1. Implementasikan prompt:
   `referensi/prompt-implementasi-frontend-saldo-dana.md`
2. Setelah implementasi, jalankan:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
3. Lakukan smoke test UI:
   - login sebagai `bendahara`
   - buka `/pengeluaran`
   - pilih `Sumber Dana`
   - catat pengeluaran
   - pastikan `mutasi_dana` bertambah
   - pastikan `saldo_dana` berkurang
   - pastikan retry tidak membuat mutasi ganda
4. Uji role:
   - `dewan` tidak bisa create/edit/delete
   - `bendahara` hanya scope miliknya
   - `super_admin`/`rois` bisa memilih scope
5. Setelah semua lolos, baru tandai fitur siap produksi.
