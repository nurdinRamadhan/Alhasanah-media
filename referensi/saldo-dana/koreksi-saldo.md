# Fitur Koreksi Saldo

## Status: BELUM DIIMPLEMENTASI

Rencana: Tambahkan tombol **"Koreksi Saldo"** di halaman Pengeluaran, di samping tombol "Catat Pengeluaran".

---

## Apa Itu Koreksi?

Karena `mutasi_dana` bersifat **immutable** (tidak bisa dihapus/diubah), maka koreksi dilakukan dengan menambah **mutasi baru**:

| Tipe Koreksi | Fungsi | Efek ke Saldo |
|---|---|---|
| `KOREKSI_MASUK` | Menambah nominal yang terlewat atau salah input | `saldo_tersedia += nominal` |
| `KOREKSI_KELUAR` | Mengurangi nominal yang terlewat atau salah input | `saldo_tersedia -= nominal` |

**Kapan pakai:**
- SPP Bulanan Juni seharusnya 200.000, tapi tercatat 180.000 → **KOREKSI_MASUK 20.000**
- Ada pengeluaran yang salah input nominal → **KOREKSI_KELUAR** untuk mengembalikan selisih

**Yang perlu diketahui:**
- Koreksi bersifat **jarang** — hanya untuk koreksi kesalahan data
- Setiap koreksi tercatat di `mutasi_dana` sebagai jejak audit
- `saldo_dana.total_keluar` termasuk KOREKSI_KELUAR, tapi **tidak termasuk di chart dashboard** (hanya KELUAR asli)

---

## Backend: RPC `record_koreksi_saldo`

### Input Parameters

| Parameter | Tipe | Keterangan |
|---|---|---|
| `p_jenis_pembayaran_id` | bigint | ID sumber dana (dari `ref_jenis_pembayaran`) |
| `p_scope_gender` | text | Target gender (`'L'` / `'P'` / `'ALL'`) |
| `p_scope_jurusan` | text | Target takhasus (`'TAHFIDZ'` / `'KITAB'` / `'ALL'`) |
| `p_nominal` | bigint | Nominal koreksi (positif) |
| `p_tipe_koreksi` | text | `'KOREKSI_MASUK'` atau `'KOREKSI_KELUAR'` |
| `p_keterangan` | text | Alasan koreksi (wajib diisi) |
| `p_idempotency_key` | text | UUID unik untuk mencegah duplikasi |

### Return Value

```json
{
  "mutasi_dana_id": 123,
  "saldo_tersedia": 120000,
  "idempotent": false
}
```

### Logic

1. **RBAC check**: Hanya `super_admin`, `bendahara`, `rois` yang boleh koreksi (dewan tidak boleh)
2. **Validasi**: `p_nominal > 0`, `p_tipe_koreksi` harus `KOREKSI_MASUK` atau `KOREKSI_KELUAR`
3. **Delegate** ke `keuangan_internal.post_mutasi_dana(...)`:
   - `p_pembayaran_tagihan_id = NULL`
   - `p_transaksi_keuangan_id = NULL`
   - `p_pengeluaran_id = NULL`
   - `p_tipe_mutasi = p_tipe_koreksi`
4. **Post mutasi**: `post_mutasi_dana` handle idempotency, `FOR UPDATE` lock, kalkulasi saldo, insert `mutasi_dana`, update `saldo_dana`

---

## Frontend: UI di Halaman Pengeluaran

### Lokasi

Tombol di **page header action bar** (barisan Export Excel, PDF, Catat Pengeluaran):

```
[ Export Excel ] [ PDF ] [ Catat Pengeluaran ] [ Koreksi Saldo ] ← tombol baru
```

### Tombol

- **Label**: "Koreksi Saldo"
- **Icon**: `ToolOutlined`
- **Warna**: AMBER/oranye (berbeda dari gold "Catat Pengeluaran")
- **Visibility**: Sembunyi jika `isDewan` (sama seperti create/delete)
- **Position**: Setelah tombol "Catat Pengeluaran"

### Modal Koreksi Saldo

```
┌──────────────────────────────────────────┐
│ ⚙ Koreksi Saldo                        ✕ │
├──────────────────────────────────────────┤
│                                          │
│  Sumber Dana *                           │
│  ┌──────────────────────────────────┐    │
│  │ Pilih sumber dana...             ▼│    │
│  └──────────────────────────────────┘    │
│                                          │
│  Tipe Koreksi *                          │
│  ◉ Koreksi Masuk (+)  ○ Koreksi Keluar (-)│
│                                          │
│  Nominal (Rp) *                          │
│  ┌──────────────────────────────────┐    │
│  │ 0                                │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Keterangan *                            │
│  ┌──────────────────────────────────┐    │
│  │ Alasan koreksi...                │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Scope Unit                              │
│  ┌──────────────────────────────────┐    │
│  │ L-TAHFIDZ (otomatis) 🔒         │    │
│  └──────────────────────────────────┘    │
│                                          │
├──────────────────────────────────────────┤
│              [ Batal ] [ Simpan Koreksi ] │
└──────────────────────────────────────────┘
```

### Field Details

| Field | Tipe | Required | Disabled/Readonly | Default |
|---|---|---|---|---|
| Sumber Dana | Select (searchable) | Ya | Tidak | Kosong |
| Tipe Koreksi | Radio Group | Ya | Tidak | `KOREKSI_MASUK` |
| Nominal | InputNumber | Ya | Tidak | 0 |
| Keterangan | TextArea | Ya | Tidak | Kosong |
| Scope Gender | Select | Ya | Ya (locked) | Auto dari RBAC |
| Scope Jurusan | Select | Ya | Ya (locked) | Auto dari RBAC |

### RBAC Behavior

| Role | Sumber Dana | Nominal | Keterangan | Scope | Akses |
|---|---|---|---|---|---|
| `super_admin` | Semua | Bebas | Bebas | Bebas | ✅ |
| `rois` | Semua | Bebas | Bebas | Bebas | ✅ |
| `bendahara` (L-TAHFIDZ) | Semua | Bebas | Bebas | Auto L-TAHFIDZ | ✅ |
| `bendahara` (L-KITAB) | Semua | Bebas | Bebas | Auto L-KITAB | ✅ |
| `bendahara` (P-ALL) | Semua | Bebas | Bebas | Auto P-ALL | ✅ |
| `dewan` | - | - | - | - | ❌ |

---

## Angka Dashboard Setelah Koreksi

| Metrik | Nilai | Catatan |
|---|---|---|
| Pemasukan (chart) | `sum(MASUK + KOREKSI_MASUK)` | Termasuk koreksi masuk |
| Pengeluaran (chart) | `sum(KELUAR + KOREKSI_KELUAR)` | Termasuk koreksi keluar |
| Net Cash (chart) | Pemasukan - Pengeluaran | = saldo_tersedia |
| Total Pemasukan (KPI) | `sum(saldo_dana.total_masuk)` | Termasuk koreksi masuk |
| Total Pengeluaran (KPI) | `sum(mutasi_dana WHERE tipe='KELUAR')` | Hanya pengeluaran asli |
| Saldo Kas Bersih (KPI) | `sum(saldo_dana.saldo_tersedia)` | = Net Cash |

---

## Catatan Teknis

### Migration Required

```sql
-- File: 20260723120000_record_koreksi_saldo.sql

-- 1. keuangan_internal.record_koreksi_saldo(...)
-- 2. public.record_koreksi_saldo(...) (SECURITY INVOKER wrapper)
-- 3. GRANT EXECUTE TO authenticated, service_role
```

### Pattern yang Dipakai

- Mirip `record_pengeluaran_dana` tapi **tanpa insert ke tabel `pengeluaran`**
- Langsung delegate ke `post_mutasi_dana` dengan `tipe_mutasi = KOREKSI_*`
- `idempotency_key` di-prefix `'koreksi:' || key` untuk memisahkan dari pengeluaran
- `mutasi_dana_one_source_chk` sudah mengizinkan koreksi tanpa source FK

### Validasi di Backend

- `p_nominal > 0`
- `p_tipe_koreksi IN ('KOREKSI_MASUK', 'KOREKSI_KELUAR')`
- `p_idempotency_key` wajib (untuk idempotency)
- `petugas_keuangan_boleh_kelola(scope_gender, scope_jurusan)` untuk RBAC
- `current_profile()` harus non-null (user harus login)

### Idempotency

Jika `p_idempotency_key` sudah ada di `mutasi_dana`, RPC akan mengembalikan ID mutasi yang sudah ada tanpa mengubah saldo. Ini mencegah duplikasi koreksi.

---

## Checklist Implementasi

- [ ] Buat migration `record_koreksi_saldo` (RPC backend)
- [ ] GRANT EXECUTE ke `authenticated`
- [ ] Tambah tombol "Koreksi Saldo" di pengeluaran page header
- [ ] Buat modal koreksi (form fields, RBAC, handler)
- [ ] Tambah handler `handleKoreksi` → panggil RPC
- [ ] Refresh table + saldo setelah koreksi
- [ ] Test: super_admin bisa koreksi semua scope
- [ ] Test: bendahara hanya bisa koreksi scope sendiri
- [ ] Test: dewan tidak bisa koreksi
- [ ] Test: nominal 0 / negatif ditolak
- [ ] Test: idempotency key mencegah duplikasi
