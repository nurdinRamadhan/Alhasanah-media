# Panduan Admin Panel Diklat dan Supabase

Dokumen ini dibuat untuk agent CLI yang akan menerapkan fitur diklat di sisi admin panel. Gunakan MCP Supabase untuk membaca schema, memverifikasi data, dan menerapkan perubahan lanjutan. Jangan mengandalkan asumsi lokal tanpa mengecek database.

## Wajib Pakai MCP Supabase

Sebelum mengubah admin panel, jalankan pengecekan melalui MCP Supabase:

1. Baca schema tabel:
   - `config_diklat`
   - `master_kitab`
   - `peserta_diklat`
2. Cek data aktif:
   - `config_diklat where is_active = true`
   - `master_kitab where jenis_diklat = 'DZULHIJJAH'`
3. Setelah perubahan admin panel selesai, verifikasi dengan query langsung dan jalankan advisor Supabase jika ada perubahan schema/policy.

## Perubahan Supabase yang Sudah Diterapkan

### `config_diklat`

Kolom lama tetap dipakai untuk peserta laki-laki:

- `uang_miftah`
- `biaya_listrik`
- `kos_makan`
- `tafaruqon`

Kolom baru dipakai untuk peserta perempuan:

- `uang_miftah_putri`
- `biaya_listrik_putri`
- `kos_makan_putri`
- `tafaruqon_putri`

Logika fallback:

- Jika peserta `L`, ambil biaya dari kolom lama.
- Jika peserta `P`, ambil biaya dari kolom `*_putri`.
- Jika kolom `*_putri` kosong/null, fallback ke kolom lama agar kompatibel dengan data lama.

Admin panel harus menyediakan input biaya laki-laki dan perempuan secara terpisah dalam halaman config diklat.

### `master_kitab`

Kolom baru:

- `jenis_kelamin`: `L`, `P`, atau `ALL`
- `kategori`: `KITAB`, `PERLENGKAPAN`, atau `BUKU`
- `is_wajib`: boolean

Data tambahan yang sudah dimasukkan:

| nama_kitab | harga | jenis_diklat | jenis_kelamin | kategori | is_wajib |
| --- | ---: | --- | --- | --- | --- |
| Paket Wajib Dzulhijjah: Maqulat Syuja'i, Maqulat Syatibi, Tuhfatul Mustaq, Wad'ul Kalimah, Mabadi Ilmu Tauhid, dan Fotocopy Pembahasan Arudh/Mabadi/Lain-lain | 100000 | DZULHIJJAH | ALL | BUKU | true |
| Tijan Addarory | 9000 | DZULHIJJAH | ALL | KITAB | false |
| Mukhtashor Syafi | 15000 | DZULHIJJAH | ALL | KITAB | false |
| Pago | 15000 | DZULHIJJAH | P | PERLENGKAPAN | true |
| Ratib | 15000 | DZULHIJJAH | P | BUKU | true |

Admin panel master kitab harus menampilkan dan mengedit kolom-kolom baru tersebut.

### `peserta_diklat`

Kolom baru:

- `jenis_kelamin`: `L` atau `P`

Admin panel peserta diklat harus menampilkan jenis kelamin dan nilai biaya final yang tersimpan.

## Logika Frontend yang Sudah Diterapkan

Di form pendaftaran publik:

- Peserta memilih `Jenis Kelamin`.
- Jika `L`, biaya administrasi memakai kolom lama dari `config_diklat`.
- Jika `P`, biaya administrasi memakai kolom `*_putri`.
- Untuk `DZULHIJJAH`, item wajib default yang dipilih untuk semua peserta:
  - `Paket Wajib Dzulhijjah: Maqulat Syuja'i, Maqulat Syatibi, Tuhfatul Mustaq, Wad'ul Kalimah, Mabadi Ilmu Tauhid, dan Fotocopy Pembahasan Arudh/Mabadi/Lain-lain`
- Untuk `DZULHIJJAH`, item opsional untuk semua peserta:
  - `Tijan Addarory`
  - `Mukhtashor Syafi`
- Untuk perempuan, `Pago` dan `Ratib` muncul otomatis dan wajib terpilih.
- Item wajib tidak bisa dilepas oleh peserta.
- PDF bukti pendaftaran mencantumkan jenis kelamin.
- Server action menghitung ulang biaya berdasarkan Supabase sebelum insert, sehingga nilai dari browser tidak dipercaya mentah-mentah.

## Yang Harus Diterapkan di Admin Panel

### Halaman Config Diklat

Tambahkan field biaya putra dan putri:

- Putra:
  - `uang_miftah`
  - `biaya_listrik`
  - `kos_makan`
  - `tafaruqon`
- Putri:
  - `uang_miftah_putri`
  - `biaya_listrik_putri`
  - `kos_makan_putri`
  - `tafaruqon_putri`

Tampilkan total otomatis:

- Total putra = `uang_miftah + biaya_listrik + kos_makan + tafaruqon`
- Total putri = `uang_miftah_putri + biaya_listrik_putri + kos_makan_putri + tafaruqon_putri`

Jika admin mengosongkan biaya putri, UI harus menjelaskan bahwa sistem akan fallback ke biaya putra.

### Halaman Master Kitab

Tambahkan field:

- `jenis_kelamin`
  - `ALL`: tampil untuk semua peserta
  - `L`: hanya laki-laki
  - `P`: hanya perempuan
- `kategori`
  - `KITAB`
  - `PERLENGKAPAN`
  - `BUKU`
- `is_wajib`
  - Jika true, item otomatis dipilih dan tidak bisa dilepas di form pendaftaran.

Pastikan `Pago` dan `Ratib` tetap:

- `jenis_diklat = DZULHIJJAH`
- `jenis_kelamin = P`
- `is_wajib = true`
- `harga = 15000`

### Halaman Peserta Diklat

Tambahkan tampilan:

- `jenis_kelamin`
- `uang_miftah`
- `biaya_listrik`
- `kos_makan`
- `tafaruqon`
- `biaya_pendaftaran`
- `belanja_kitab_nominal`
- `rincian_belanja`

Gunakan nilai yang tersimpan di `peserta_diklat` sebagai nilai final historis. Jangan hitung ulang dari config saat menampilkan peserta lama, karena config bisa berubah.

## Query Verifikasi

Gunakan query berikut via MCP Supabase:

```sql
select
  id,
  tahun_hijriah,
  periode,
  is_active,
  uang_miftah,
  biaya_listrik,
  kos_makan,
  tafaruqon,
  uang_miftah_putri,
  biaya_listrik_putri,
  kos_makan_putri,
  tafaruqon_putri
from public.config_diklat
order by is_active desc, tahun_hijriah desc, periode desc;
```

```sql
select
  id,
  nama_kitab,
  harga,
  jenis_diklat,
  jenis_kelamin,
  kategori,
  is_wajib,
  is_active
from public.master_kitab
where jenis_diklat = 'DZULHIJJAH'
order by id;
```

```sql
select
  id,
  nama_lengkap,
  jenis_kelamin,
  jenis_diklat,
  tahun_diklat,
  uang_miftah,
  biaya_listrik,
  kos_makan,
  tafaruqon,
  biaya_pendaftaran,
  belanja_kitab_nominal,
  rincian_belanja
from public.peserta_diklat
order by created_at desc
limit 20;
```

## Catatan Keamanan

Jangan expose service role key di frontend admin. Gunakan client Supabase yang sudah sesuai pola proyek, RLS, dan role admin yang ada. Jika perlu mengubah policy, cek Supabase docs via MCP terlebih dahulu dan jalankan advisors setelah perubahan.
