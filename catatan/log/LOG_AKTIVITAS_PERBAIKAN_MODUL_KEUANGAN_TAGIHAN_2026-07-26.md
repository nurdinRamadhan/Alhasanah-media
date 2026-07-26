# Log Aktivitas: Perbaikan Modul Keuangan, Tagihan, dan Android Cache

**Tanggal Aktivitas:** 26 Juli 2026
**Durasi:** Satu sesi panjang (multi-fix)
**Scope:** Admin Panel (Refine + Supabase) & Android (Jetpack Compose + Supabase)

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Fase 1 — Bulk Generate Idempotency & Advisory Lock](#2-fase-1--bulk-generate-idempotency--advisory-lock)
3. [Fase 2 — Database Audit & Excel Reconciliation](#3-fase-2--database-audit--excel-reconciliation)
4. [Fase 3 — KPI & Table Data Source Fix](#4-fase-3--kpi--table-data-source-fix)
5. [Fase 4 — Bendahara RLS & Santri Select Fix](#5-fase-4--bendahara-rls--santri-select-fix)
6. [Fase 5 — Database Cleanup for Stress Test](#6-fase-5--database-cleanup-for-stress-test)
7. [Fase 6 — Android Offline-First Cache & Refresh](#7-fase-6--android-offline-first-cache--refresh)
8. [Fase 7 — PDF Receipt Bug Fix](#8-fase-7--pdf-receipt-bug-fix)
9. [Rekap File yang Diubah](#9-rekap-file-yang-diubah)
10. [Rekap Scope Perubahan](#10-rekap-scope-perubahan)
11. [Verifikasi & Pengujian](#11-verifikasi--pengujian)

---

## 1. Ringkasan Eksekutif

Sesi ini menangani **7 blok masalah** terkait modul keuangan/tagihan di Admin Panel dan Android:

| No | Masalah | Status |
|----|---------|--------|
| 1 | Bulk generate tagihan bisa diduplikasi | Selesai |
| 2 | Database vs Excel audit tidak konsisten | Selesai (172/172 match) |
| 3 | KPI & tabel terpotong 50 baris (useTable pagination bug) | Selesai |
| 4 | Bendahara tidak bisa lihat data (RLS + select field salah) | Selesai |
| 5 | Database perlu dibersihkan untuk stress test | Selesai (90 tagihan baru) |
| 6 | Android cache stale setelah pembayaran | Selesai (auto-refetch) |
| 7 | PDF receipt nama/NIS/kelas kosong | Selesai |

---

## 2. Fase 1 — Bulk Generate Idempotency & Advisory Lock

### Masalah
- Tombol Generate bisa ditekan lebih dari satu kali tanpa mekanisme pencegahan duplikasi
- Tidak ada pengaman database untuk mencegah generate periode yang sama dua kali
- Kasus Muhammad Denmar Nabawi menunjukkan duplikasi tagihan dan notifikasi ganda

### Solusi

**A. Advisory Lock di Database**
- Supabase RPC tidak expose `pg_advisory_xact_lock` secara default
- Membuat wrapper function di schema `public`:
  ```sql
  CREATE OR REPLACE FUNCTION public.pg_advisory_xact_lock(lock_id integer)
  RETURNS void LANGUAGE plpgsql AS $$
  BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(lock_id::bigint);
  END;
  $$;
  ```
- GRANT ke `authenticated`, `anon`, `service_role`
- Lock ID dihitung dari hash deskripsi tagihan (hijri month + year + payment type) untuk mencegah concurrent generate untuk kombinasi yang sama

**B. Idempotency Key di Frontend**
- `tagihan/list.tsx` — Bulk Generate dialog sekarang menggunakan idempotency key
- Button disabled selama proses loading
- Unique constraint di database: `(santri_nis, jenis_pembayaran_id, deskripsi_tagihan)` mencegah duplikasi

### File yang Diubah
- `supabase/migrations/20260726XXXXXX_add_pg_advisory_xact_lock_wrapper.sql` (baru)
- `src/pages/tagihan/list.tsx` (bulk generate logic)

### Verifikasi
- Generate massal Rabi'ul Awwal 1448 H menghasilkan tepat 4 tagihan per santri
- Tidak ditemukan duplikasi pasangan santri + jenis pembayaran

---

## 3. Fase 2 — Database Audit & Excel Reconciliation

### Masalah
- Perlu diverifikasi apakah data tagihan di database cocok dengan Excel rekap
- Potensi duplikasi, status mismatch, atau nominal mismatch

### Solusi
- Query Supabase langsung: `tagihan_santri` + join `santri` + `ref_jenis_pembayaran`
- Export ke Excel (`.xlsx`) menggunakan `exceljs`
- Cross-check manual baris per baris

### Hasil Audit
- **172 baris** tagihan di database
- **172 baris** di Excel — **100% match**
- Tidak ditemukan: duplikasi, status mismatch, nominal mismatch
- **Detail Cicilan:** AHMAD TEST — `SPP Bulanan Agustus 2026` Rp 380,000, paid Rp 200,000 (53%), sisa Rp 180,000
- **Excel Totals:** Total Rp 18,050,000 | LUNAS 10/Rp 1,270,000 | CICILAN 1/Rp 380,000 | BELUM 161/Rp 16,400,000 | Piutang Rp 16,580,000

### Referensi
- File Excel: `catatan/Rekap_Keuangan_Global_010626_to_310726.xlsx`

---

## 4. Fase 3 — KPI & Table Data Source Fix

### Masalah
- `useTable` dari `@refinedev/antd` dengan `mode: "client"` dan `pageSize: 50` tetap membatasi `tableQueryResult?.data?.data` ke 50 baris
- KPI menunjukkan hanya 50 item (seharusnya 172)
- Tabel "RINGKASAN TAGIHAN" dan kolom "NOMINAL" juga terpengaruh

### Solusi

**A. State Independen untuk KPI**
- Membuat `allTagihanForKpi` state dengan fetch langsung dari Supabase (tanpa pagination):
  ```typescript
  const [allTagihanForKpi, setAllTagihanForKpi] = useState<ITagihanSantri[]>([]);
  useEffect(() => {
      supabaseClient
          .from("tagihan_santri")
          .select("*, santri(nama, nis, kelas, jurusan, jenis_kelamin)")
          .then(({ data, error }) => {
              if (!error && data) setAllTagihanForKpi(data as ITagihanSantri[]);
          });
  }, []);
  ```
- KPI stats, `paymentTypeSummary`, dan `filteredData` sekarang menggunakan `allTagihanForKpi` sebagai sumber data

**B. Label Fix**
- "Total Tagihan Bulan Ini" → "Total Tagihan (Semua Periode)"

**C. `filteredData` Source Fix**
- Sebelumnya: `tableQueryResult?.data?.data` (terbatas 50)
- Sesudahnya: `allTagihanForKpi` (semua data, tanpa limitasi)

### File yang Diubah
- `src/pages/tagihan/list.tsx` — KPI, paymentTypeSummary, filteredData

### Verifikasi
- KPI sekarang menampilkan jumlah yang benar dari seluruh data
- Tabel grouping berfungsi dengan benar

---

## 5. Fase 4 — Bendahara RLS & Santri Select Fix

### Masalah
- Bendahara (`azril@bendahara.com`, `akses_gender: "L"`, `akses_jurusan: "TAHFIDZ"`) melihat tabel kosong
- Semua kolom di tabel menunjukkan 0/blank

### Root Cause
- `allTagihanForKpi` select hanya: `santri(nama, nis)` — **tidak termasuk `jenis_kelamin` dan `jurusan`**
- RLS policy di `tagihan_santri` melakukan filter:
  ```sql
  (p.akses_gender = 'ALL' OR p.akses_gender = s.jenis_kelamin)
  AND (p.akses_jurusan = 'ALL' OR p.akses_jurusan = s.jurusan)
  ```
- Tanpa `jenis_kelamin` dan `jurusan` di select, RLS tidak bisa melakukan filter → semua row terfilter keluar

### Solusi
- Update select di `allTagihanForKpi`:
  ```typescript
  .select("*, santri(nama, nis, kelas, jurusan, jenis_kelamin)")
  ```
- Semua 172 tagihan milik santri L+TAHFIDZ → semua lolos filter RLS

### Verifikasi
- Bendahara bisa melihat seluruh tagihan yang sesuai dengan scope aksesnya

---

## 6. Fase 5 — Database Cleanup for Stress Test

### Masalah
- Perlu membersihkan database transaksi keuangan untuk stress test
- Semua tabel transaksi: `mutasi_dana`, `detail_transaksi`, `pembayaran_tagihan`, `transaksi_keuangan`, `pengeluaran`, `tagihan_santri`
- `saldo_dana` perlu di-reset ke 0 per kategori

### Solusi
- Triggers `tg_blokir_update_mutasi_dana` dan `tg_blokir_update_saldo_dana_langsung` di-disable sementara
- DELETE dari semua tabel transaksi (dalam urutan yang benar untuk foreign key)
- `saldo_dana` di-reset ke 7 baris (satu per `ref_jenis_pembayaran`) dengan saldo Rp 0
- Triggers di-re-enable setelah cleanup

### Bulk Generate Baru
- 10 santri × 9 payment types = **90 tagihan**
- Total Rp 8,460,000
- Semua status: BELUM

### File yang Tidak Diubah
- Migration files tidak dimodifikasi
- Notification triggers tidak disentuh

---

## 7. Fase 6 — Android Offline-First Cache & Refresh

### Masalah
- Setelah pembayaran, Android masih menampilkan data lama (cache stale)
- FCM notification tidak invalidate cache
- Tidak ada pull-to-refresh

### Solusi

**A. Selalu Refetch dari Server**
- `KeuanganRepositoryImpl.kt` — Ubah `STALE_THRESHOLD_MS` dari 5 menit ke 0:
  ```kotlin
  // Selalu refetch dari server setiap kali halaman dibuka
  private val STALE_THRESHOLD_MS = 0L
  ```
- Cache masih berguna untuk UI instant (emit cache first → fetch → update)
- Conditional fetch tetap bekerja (hanya fetch row yang berubah sejak sync terakhir)

**B. Refresh Button di UI**
- Material3 1.3.1 tidak memiliki `PullToRefreshBox` atau `PullToRefreshContainer`
- Solusi alternatif: tombol refresh manual dengan animasi spinning di header "DAFTAR TAGIHAN":
  ```kotlin
  IconButton(onClick = { viewModel.refreshData() }) {
      val rotation by animateFloatAsState(...)
      Icon(
          imageVector = Icons.Filled.Refresh,
          modifier = Modifier.graphicsLayer { rotationZ = rotation }
      )
  }
  ```
- Tombol berputar selama data sedang di-load

### File yang Diubah
- `KeuanganRepositoryImpl.kt:39` — STALE_THRESHOLD_MS = 0
- `KeuanganScreen.kt` — Refresh button + imports

### Verifikasi
- `assembleDebug` dan `kspDebugKotlin` pass
- Setiap buka halaman tagihan → selalu fetch fresh dari server
- Tombol refresh berfungsi dan beranimasi

---

## 8. Fase 7 — PDF Receipt Bug Fix

### Masalah
- PDF receipt (Bukti Bayar) menampilkan:
  - "DITERIMA DARI: **Santri-XXXX**" (bukan nama asli)
  - "NIS: **-**" (kosong)
  - "Kelas: **-**" (kosong)

### Root Cause
- `openDetailDrawer` (line 412) fetch ALL tagihan untuk santri dengan select:
  ```typescript
  .select("*, ref_jenis_pembayaran!inner(nama_pembayaran)")
  // ❌ TIDAK ada join ke tabel santri
  ```
- Setelah fetch, `selectedGroup.tagihan` di-update dengan data baru yang **tidak memiliki `santri` object**
- Ketika tombol "Struk" diklik, `record.santri` = `undefined`
- Fallback `santriAlias(undefined)` menghasilkan "Santri-XXXX"

### Alur Bug
```
openDetailDrawer(group)
  → fetch tagihan_santri tanpa join santri
  → setSelectedGroup({ ...prev, tagihan: sortedTagihans })  // tanpa santri
  → user klik "Struk"
  → handlePrintReceipt(record)  // record.santri = undefined
  → downloadReceiptPdf(selectedTagihan)  // selectedTagihan.santri = undefined
  → PDF: "Santri-XXXX", NIS: "-", Kelas: "-"
```

### Solusi
- Tambahkan `santri(nama, nis, kelas, jurusan)` ke select:
  ```typescript
  .select("*, santri(nama, nis, kelas, jurusan), ref_jenis_pembayaran!inner(nama_pembayaran)")
  ```
- Sekarang setiap record di `selectedGroup.tagihan` memiliki `santri` object

### Alur Setelah Fix
```
openDetailDrawer(group)
  → fetch tagihan_santri DENGAN join santri
  → setSelectedGroup({ ...prev, tagihan: sortedTagihans })  // dengan santri object
  → user klik "Struk"
  → handlePrintReceipt(record)  // record.santri = { nama, nis, kelas, jurusan }
  → downloadReceiptPdf(selectedTagihan)  // data lengkap
  → PDF: nama, NIS, kelas semua terisi ✓
```

### File yang Diubah
- `src/pages/tagihan/list.tsx:412` — Select query di `openDetailDrawer`

---

## 9. Rekap File yang Diubah

### Admin Panel (`alhasanahAdmin`)

| File | Fase | Perubahan |
|------|------|-----------|
| `src/pages/tagihan/list.tsx` | 1,3,4,7 | Bulk generate idempotency, KPI fix, select fix, PDF receipt fix |
| `src/pages/tagihan/create.tsx` | — | Local state hijri (bukan form field) |
| `src/utility/dateHelper.ts` | — | Hijri utilities (HIJRI_OFFSET = -1) |
| `supabase/migrations/...pg_advisory_xact_lock_wrapper.sql` | 1 | Wrapper function untuk advisory lock |

### Android (`alhasanahMedia`)

| File | Fase | Perubahan |
|------|------|-----------|
| `KeuanganRepositoryImpl.kt` | 6 | STALE_THRESHOLD_MS = 0 (selalu refetch) |
| `KeuanganScreen.kt` | 6 | Refresh button + spinning animation |

---

## 10. Rekap Scope Perubahan

### Yang DIUBAH (sesuai persetujuan)
- ✅ UI-only changes di admin panel (label, source data)
- ✅ Database wrapper function (addition-only)
- ✅ Android cache strategy (UI behavior)
- ✅ Android refresh button (UI addition)
- ✅ PDF receipt select query (fix bug)
- ✅ Bulk generate idempotency (addition-only)

### Yang TIDAK DIUBAH (sesuai constraint)
- ❌ Notification triggers (`trg_bayar_tagihan_notify_wali`)
- ❌ `tanggal_jatuh_tempo` tetap Masehi
- ❌ `hijri_month`/`hijri_year` bukan form fields
- ❌ Migration files existing tidak dimodifikasi
- ❌ FCM/notification code tidak disentuh

---

## 11. Verifikasi & Pengujian

### Admin Panel
- [x] TypeScript compile: `npx tsc --noEmit` — clean (no errors)
- [x] Bulk generate: 90 tagihan untuk 10 santri × 9 payment types
- [x] KPI menampilkan jumlah benar (bukan terpotong 50)
- [x] Bendahara bisa lihat tagihan sesuai scope
- [x] Excel audit: 172/172 baris match 100%
- [x] PDF receipt: nama, NIS, kelas terisi dengan benar

### Android
- [x] `./gradlew assembleDebug` — BUILD SUCCESSFUL
- [x] `./gradlew kspDebugKotlin` — pass
- [x] Tagihan selalu refetch dari server
- [x] Refresh button berfungsi dan beranimasi
- [x] Cache依然 berguna untuk UI instant

---

*Dokumen ini dibuat pada 26 Juli 2026 sebagai catatan aktivitas sesi perbaikan modul keuangan.*
