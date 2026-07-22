# Prompt Implementasi Frontend Saldo Dana

Anda adalah AI coding agent yang bekerja di project React + Refine + Supabase:

`/home/arch-din1/Admin Panel/alhasanahAdmin`

## Tujuan

Implementasikan integrasi frontend modul Pengeluaran dengan sistem Saldo Dana / Fund Accounting yang sudah diterapkan di database Supabase. Backend SQL sudah diterapkan. Frontend harus siap produksi, mengikuti struktur UI yang sudah ada, dan tidak membuat halaman baru jika tidak perlu.

## Struktur Frontend Yang Sudah Ada

1. Menu Pengeluaran sudah ada di:
   - `src/utility/resources.tsx`
   - resource: `pengeluaran`
   - route: `/pengeluaran`
   - parent: `keuangan_menu`

2. Halaman existing:
   - `src/pages/pengeluaran/list.tsx`
   - Sudah punya dashboard, chart, table, filter scope, modal create/edit, upload bukti, dan export Excel.
   - Saat ini create masih memakai `useCreate()` langsung ke tabel `pengeluaran`.
   - Untuk produksi, create harus diganti agar memakai RPC `public.record_pengeluaran_dana`.

3. Lazy loading sudah ada:
   - `src/lazyPages.tsx`
   - export: `PengeluaranList`

4. Supabase client:
   - `src/utility/supabaseClient.ts`
   - Gunakan `supabaseClient.rpc(...)` untuk memanggil RPC.

5. RBAC frontend:
   - `src/accessControlProvider.ts`
   - `dewan`: read-only untuk modul selain pengecualian.
   - `bendahara`: boleh akses `pengeluaran`.
   - `super_admin` dan `rois`: akses scope bebas.

## Backend RPC Yang Harus Dipakai

Nama RPC:

`record_pengeluaran_dana`

Parameter:

```ts
{
  p_judul: string;
  p_kategori: string;
  p_nominal: number;
  p_tanggal_pengeluaran: string; // YYYY-MM-DD
  p_jenis_pembayaran_id: number;
  p_scope_gender: "L" | "P" | "ALL";
  p_scope_jurusan: "KITAB" | "TAHFIDZ" | "ALL";
  p_keterangan: string | null;
  p_bukti_url: string | null;
  p_idempotency_key: string | null;
}
```

Return JSON:

```ts
{
  pengeluaran_id: number;
  mutasi_dana_id: number;
  idempotent: boolean;
}
```

## Data Sumber Dana

Tabel sumber dana:

`ref_jenis_pembayaran`

Field penting:

- `id`
- `nama_pembayaran`
- `tipe`
- `nominal_default`
- `is_aktif`

Ambil hanya data aktif:

```ts
is_aktif === true
```

Tipe frontend existing:

`IRefJenisPembayaran` di `src/types.tsx`

## Nilai Canonical

Gunakan nilai ini secara konsisten.

Role:

```ts
"super_admin" | "rois" | "bendahara" | "kesantrian" | "dewan" | "kantin" | "wali" | "alumni"
```

Gender scope:

```ts
"L" | "P" | "ALL"
```

Jurusan scope:

```ts
"KITAB" | "TAHFIDZ" | "ALL"
```

Jangan menambahkan role lama seperti:

- `admin_bendahara`
- `admin_kesantrian`
- `admin_akademik_tahfidz`
- `admin_akademik_kitab`
- `dewan_kiyai`
- `pengelola_kantin`

## Tugas Implementasi

### 1. Update TypeScript Types

Edit `src/types.tsx`.

Tambahkan field pada `IPengeluaran`:

```ts
jenis_pembayaran_id?: number | null;
ref_jenis_pembayaran?: IRefJenisPembayaran | null;
```

Tambahkan tipe response RPC bila berguna:

```ts
export interface IRecordPengeluaranDanaResult {
  pengeluaran_id: number;
  mutasi_dana_id: number;
  idempotent: boolean;
}
```

### 2. Fetch Sumber Dana Aktif

Edit `src/pages/pengeluaran/list.tsx`.

Tambahkan fetch/list untuk `ref_jenis_pembayaran` aktif.

Pilih pola yang paling cocok dengan file:

- `useList<IRefJenisPembayaran>`, atau
- query langsung via `supabaseClient.from("ref_jenis_pembayaran")`

Hasilnya dipakai untuk:

- dropdown form create/edit
- mapping `jenis_pembayaran_id -> nama_pembayaran` di tabel
- filter sumber dana
- export Excel

### 3. Tambahkan Field Sumber Dana Di Modal

Di modal create/edit `PengeluaranList`, tambahkan field:

```ts
name="jenis_pembayaran_id"
```

Label UI:

`Sumber Dana`

Aturan:

- Required untuk create.
- Opsi berasal dari `ref_jenis_pembayaran` aktif.
- Label utama: `nama_pembayaran`.
- Value: `id`.
- Jika memungkinkan, tampilkan `tipe` atau `nominal_default` secara ringkas tanpa merusak layout.

### 4. Ganti CREATE Flow Menjadi RPC

Saat `modalMode === "CREATE"`, jangan gunakan:

```ts
createMutate({ resource: "pengeluaran", values: payload })
```

Gunakan:

```ts
const { data, error } = await supabaseClient.rpc("record_pengeluaran_dana", {
  p_judul: payload.judul,
  p_kategori: payload.kategori,
  p_nominal: Number(payload.nominal),
  p_tanggal_pengeluaran: payload.tanggal_pengeluaran,
  p_jenis_pembayaran_id: Number(payload.jenis_pembayaran_id),
  p_scope_gender: payload.scope_gender,
  p_scope_jurusan: payload.scope_jurusan,
  p_keterangan: payload.keterangan || null,
  p_bukti_url: buktiUrl || null,
  p_idempotency_key: idempotencyKey,
});
```

`idempotencyKey` harus dibuat per submit, misalnya:

```ts
const idempotencyKey = `pengeluaran-${user?.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
```

Setelah RPC sukses:

- tampilkan `message.success`
- tutup modal
- reset form
- `tableQueryResult.refetch()`
- log activity dengan:
  - `pengeluaran_id`
  - `mutasi_dana_id`
  - `jenis_pembayaran_id`
  - `nominal`
  - `scope`

### 5. Pertahankan EDIT Dengan Aman

Karena backend ledger membuat pengeluaran yang sudah diposting tidak boleh diubah untuk field penting, jangan izinkan edit field ledger utama.

Untuk modal edit:

Disable field:

- `nominal`
- `kategori`
- `scope_gender`
- `scope_jurusan`
- `jenis_pembayaran_id`

Field yang boleh dicoba edit:

- `judul`
- `keterangan`
- `bukti_url`
- `tanggal_pengeluaran`, hanya jika backend mengizinkan

Jika update ditolak backend, tampilkan error database secara jelas.

Jangan pernah mengubah `mutasi_dana` dari frontend.

### 6. Perbaiki DELETE Error Handling

Backend akan menolak delete pengeluaran yang sudah diposting ke ledger.

Update `handleDelete` agar error tertangani:

- Jika error mengandung indikasi sudah diposting atau tidak boleh dihapus, tampilkan:
  `Pengeluaran sudah masuk ledger dan tidak bisa dihapus. Gunakan koreksi.`
- Jangan tampilkan success sebelum operasi delete benar-benar berhasil.

### 7. Tambahkan Kolom Sumber Dana Di Table

Di tabel `PengeluaranList`, tambahkan kolom:

`Sumber Dana`

Render:

- Ambil dari map `jenis_pembayaran_id -> nama_pembayaran`.
- Jika tidak ada, tampilkan `-`.

Jangan ubah layout besar halaman.

### 8. Tambahkan Filter Sumber Dana

Di panel filter existing, tambahkan filter:

`Sumber Dana`

Nilai dari list `ref_jenis_pembayaran` aktif.

Filter boleh client-side terlebih dahulu berdasarkan:

```ts
item.jenis_pembayaran_id === selectedJenisPembayaranId
```

### 9. Update Export Excel

Export Excel harus menambahkan kolom:

`Sumber Dana`

Gunakan nama dari map `jenis_pembayaran_id -> nama_pembayaran`.

### 10. Error Handling Produksi

Buat helper kecil:

```ts
const getErrorMessage = (err: any) =>
  err?.message || err?.details || err?.hint || "Terjadi kesalahan";
```

Gunakan untuk error RPC, upload, update, dan delete bila relevan.

Pastikan loading submit tidak stuck.

### 11. Verifikasi

Jalankan:

```bash
npm run build
```

Jika ada TypeScript error, perbaiki.

Jangan melakukan refactor besar.
Jangan menghapus chart/export/upload.
Jangan membuat halaman baru.
Jangan mengubah desain visual besar.

## Acceptance Criteria

- Modal create pengeluaran memiliki dropdown `Sumber Dana`.
- Dropdown mengambil data aktif dari `ref_jenis_pembayaran`.
- Create pengeluaran memanggil RPC `record_pengeluaran_dana`, bukan direct insert.
- Payload RPC mengirim `p_jenis_pembayaran_id`.
- Setelah create sukses, tabel refresh.
- Ledger backend otomatis terbentuk melalui RPC.
- Role/scope tetap mengikuti `IUserIdentity`.
- `dewan` tetap read-only.
- `super_admin` dan `rois` tetap scope-free.
- `bendahara` mengikuti scope user.
- Table menampilkan sumber dana.
- Filter sumber dana tersedia.
- Export Excel menyertakan sumber dana.
- TypeScript build berhasil.
- Tidak ada role lama ditambahkan ke frontend.

## Catatan Teknis Penting

SQL backend saldo dana sudah diterapkan ke Supabase dan smoke test ledger berhasil:

- tabel `saldo_dana` tersedia
- tabel `mutasi_dana` tersedia
- kolom `pengeluaran.jenis_pembayaran_id` tersedia
- trigger ledger tersedia
- RPC `record_pengeluaran_dana` tersedia
- update langsung `saldo_dana` diblokir

Implementasi frontend yang benar adalah menghubungkan halaman `PengeluaranList` yang sudah ada ke RPC dan sumber dana, bukan membuat modul baru.
