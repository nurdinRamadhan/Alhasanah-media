# Panduan Implementasi Fitur Prestasi di Admin Panel

Dokumen ini menjelaskan kontrak fitur `Prestasi Santri` yang sudah dipakai aplikasi Android publik, dan cara menyesuaikannya di admin panel `alhasanahAdmin`.

## Stack Admin Panel

Admin panel berada di:

`/home/arch-din1/Admin Panel/alhasanahAdmin`

Stack yang terdeteksi:

- React 19
- Vite 6
- TypeScript
- Refine `@refinedev/core`, `@refinedev/antd`, `@refinedev/supabase`
- Ant Design 5
- Ant Design Pro Components `ProTable`
- Supabase client di `src/utility/supabaseClient.ts`

Halaman prestasi saat ini sudah ada di:

`src/pages/prestasi/list.tsx`

Resource sidebar belum terlihat di `src/utility/resources.tsx`, sehingga perlu ditambahkan jika menu prestasi ingin muncul eksplisit di admin panel.

## Kontrak Database

Tabel utama:

`public.prestasi_santri`

Kolom yang dipakai admin:

- `id`
- `santri_nis`
- `kategori`
- `judul_prestasi`
- `keterangan`
- `tanggal_prestasi`
- `sertifikat_url`
- `poin_prestasi`
- `dicatat_oleh_id`
- `created_at`

Kategori sudah dikunci oleh constraint database:

```ts
export const PRESTASI_KATEGORI_OPTIONS = [
  { label: "Tahfidz", value: "TAHFIDZ" },
  { label: "Kitab", value: "KITAB" },
  { label: "Khatam", value: "KHATAM" },
  { label: "Akademik", value: "AKADEMIK" },
  { label: "Lomba", value: "LOMBA" },
  { label: "Akhlak", value: "AKHLAK" },
  { label: "Olahraga", value: "OLAHRAGA" },
  { label: "Seni", value: "SENI" },
  { label: "Umum", value: "UMUM" },
  { label: "Lainnya", value: "LAINNYA" },
];
```

Admin panel wajib memakai daftar ini di form create/edit. Jangan pakai input teks bebas untuk `kategori`, karena insert/update akan ditolak database jika nilainya di luar daftar.

## Kontrak Publik Android

Aplikasi Android publik tidak membaca tabel mentah `prestasi_santri`.

Android membaca RPC:

```sql
public.get_public_prestasi_santri(
  p_kategori text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
```

Android juga membaca count kategori dari RPC:

```sql
public.get_public_prestasi_category_counts(
  p_search text default null
)
```

Output publik hanya:

- `prestasi_id`
- `santri_nama`
- `santri_kelas`
- `santri_jurusan`
- `kategori`
- `judul_prestasi`
- `keterangan`
- `tanggal_prestasi`
- `poin_prestasi`

Output count kategori hanya:

- `kategori`
- `total`

Field berikut tidak boleh muncul di publik:

- `santri_nis`
- `wali_id`
- `foto_url`
- `sertifikat_url`
- data keluarga
- kontak
- alamat
- NIK/KK/identifier sensitif lain

Catatan penting: `sertifikat_url` boleh tetap dikelola admin, tetapi tidak diekspos ke Android publik.

## RLS dan Akses

Saat dokumen ini dibuat, model akses yang diharapkan:

- `anon` tidak boleh `select` langsung ke `public.prestasi_santri`.
- `anon` boleh execute RPC `get_public_prestasi_santri(...)`.
- `authenticated` admin boleh read/write `prestasi_santri` lewat policy existing.
- Tabel `santri` tidak dibuka untuk publik.

Admin panel harus tetap memakai session admin Supabase biasa melalui Refine Supabase data provider. Jangan memakai service role key di frontend.

## Perubahan yang Disarankan di Admin Panel

### 1. Tambahkan Resource Prestasi

Di `src/utility/resources.tsx`, tambahkan resource:

```tsx
{
  name: "prestasi_santri",
  list: "/prestasi",
  meta: {
    label: "Prestasi Santri",
    parent: "kesantrian_menu",
    icon: <TrophyOutlined />,
  },
}
```

Pastikan import `TrophyOutlined` dari `@ant-design/icons`.

### 2. Daftarkan Route Jika Belum Ada

Cek `src/App.tsx` dan `src/lazyPages.tsx`.

Pastikan `PrestasiList` di-export dari lazy pages dan route `/prestasi` mengarah ke komponen:

```tsx
<Route path="/prestasi" element={<PrestasiList />} />
```

Gunakan pola route existing di file tersebut.

### 3. Update Form Kategori

Di `src/pages/prestasi/list.tsx`, ganti opsi kategori lama:

```tsx
{ label: "Hafalan (Tahfidz)", value: "TAHFIDZ" },
{ label: "Hafalan Kitab", value: "KITAB" },
{ label: "Khataman (Official)", value: "KHATAM" },
{ label: "Lomba / Umum", value: "UMUM" },
```

menjadi daftar lengkap `PRESTASI_KATEGORI_OPTIONS`.

### 4. Validasi Konten Publik

Karena `judul_prestasi` dan `keterangan` tampil di halaman publik, admin form perlu memberi aturan:

- Jangan tulis NIS.
- Jangan tulis nomor HP.
- Jangan tulis alamat.
- Jangan tulis nama wali/orang tua.
- Jangan tulis NIK, KK, rekening, atau data keluarga.
- Jangan masukkan link sertifikat di `keterangan`.

Rekomendasi implementasi ringan di Ant Design:

```tsx
const sensitivePattern =
  /(nik|kk|nis|wali|ayah|ibu|alamat|no hp|nomor hp|rekening|\\b\\d{10,}\\b)/i;

const publicTextRules = [
  { required: true, message: "Wajib diisi" },
  {
    validator: (_: unknown, value?: string) => {
      if (value && sensitivePattern.test(value)) {
        return Promise.reject(
          new Error("Teks publik tidak boleh memuat data sensitif.")
        );
      }
      return Promise.resolve();
    },
  },
];
```

Gunakan rule ini minimal pada `judul_prestasi`. Untuk `keterangan`, gunakan validator yang sama tanpa `required`.

### 5. Sertifikat

Untuk admin panel:

- Boleh ada field `sertifikat_url` untuk arsip internal.
- Jangan tampilkan `sertifikat_url` di preview publik.
- Jika memakai Supabase Storage, bucket sertifikat sebaiknya private.
- Jika perlu akses sertifikat untuk admin, gunakan signed URL server/client admin dengan session authenticated, bukan URL publik permanen.

Untuk Android publik:

- Tidak ada tombol/label sertifikat.
- RPC publik tidak mengembalikan `sertifikat_url`.

### 6. Tabel Manajemen

Kolom admin yang disarankan:

- Santri: nama, kelas, jurusan, NIS kecil sebagai referensi internal admin
- Kategori
- Judul prestasi
- Tanggal
- Poin
- Keterangan
- Status sertifikat internal: tampilkan badge "Ada" / "Tidak Ada", bukan URL penuh

Filter yang disarankan di `ProTable`:

- Kategori
- Kelas
- Jurusan
- Rentang tanggal
- Search nama santri atau judul prestasi

### 7. Create/Edit

Saat create:

```ts
{
  santri_nis: values.santri_nis,
  kategori: values.kategori,
  judul_prestasi: values.judul_prestasi,
  keterangan: values.keterangan || null,
  tanggal_prestasi: values.tanggal_prestasi.format("YYYY-MM-DD"),
  poin_prestasi: values.poin_prestasi ?? 0,
  sertifikat_url: values.sertifikat_url || null,
  dicatat_oleh_id: user?.id,
}
```

Tambahkan `InputNumber` untuk `poin_prestasi` agar admin tidak mengisi teks bebas.

### 8. Konsistensi dengan Android

Android publik sekarang menampilkan:

1. Filter kategori.
2. Search nama/kelas/jurusan/judul prestasi.
3. Daftar santri berprestasi.
4. Detail prestasi setelah santri dipilih.
5. Tombol `Tampilkan Lebih Banyak` berdasarkan pagination RPC.
6. Pull-to-refresh.
7. Back button Android kembali dari detail ke daftar sebelum keluar halaman.

Admin panel sebaiknya menjaga data agar nyaman dibaca di Android:

- Judul pendek dan jelas.
- Keterangan maksimal 1-3 kalimat.
- Kategori selalu tepat.
- Tanggal prestasi wajib.
- Poin opsional tetapi sebaiknya konsisten.

## Checklist QA Admin

- Create prestasi dengan semua kategori berhasil.
- Insert kategori di luar daftar ditolak.
- Admin non-role yang tidak punya policy tidak bisa write.
- Public Android tidak melihat `sertifikat_url`.
- Public Android tidak melihat `santri_nis`.
- Search publik tidak mencari data sensitif.
- Pagination publik tetap berjalan setelah memilih kategori.
