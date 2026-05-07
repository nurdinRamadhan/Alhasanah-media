# PANDUAN IMPLEMENTASI FITUR DONASI (INFAQ/WAKAF) - ANDROID KOTLIN

Dokumen ini berisi instruksi komprehensif untuk mengimplementasikan fitur Infaq, Wakaf, dan Shadaqah di aplikasi Android, menyambung ke ekosistem Admin Panel yang sudah diperbarui.

---

## 1. KONTEKS ARSITEKTUR
Sistem sekarang menggunakan **Buku Besar Terpadu** pada tabel `transaksi_keuangan`. Fitur Donasi dibedakan dari Tagihan Santri melalui:
- **Order ID Prefix:** Transaksi donasi digital akan memiliki Order ID berawalan `DONASI-`.
- **Flexible Identifiers:** Donasi bisa dilakukan oleh Santri (punya NIS) atau Umum (NIS NULL).
- **Edge Function Unified:** Menggunakan `midtrans-snap` yang sama namun dengan payload yang berbeda.

---

## 2. PERUBAHAN PAYLOAD EDGE FUNCTION (`midtrans-snap`)
Fungsi `midtrans-snap` sekarang menerima parameter baru: `is_donation` (Boolean).

**Struktur Request Baru (JSON):**
```json
{
  "gross_amount": 50000,
  "is_donation": true,
  "item_details": [
    {
      "id": "DONASI_INFAQ",
      "price": 50000,
      "quantity": 1,
      "name": "Infaq Pembangunan Masjid"
    }
  ],
  "customer_details": {
    "first_name": "Nama Donatur",
    "email": "email@donatur.com",
    "phone": "08123456789"
  },
  "santri_nis": "12345", // Opsional: Isi jika donatur adalah Wali Santri
  "wali_id": "uuid-wali" // Opsional
}
```

---

## 3. LANGKAH IMPLEMENTASI KOTLIN

### A. Update Data Class `SnapRequest`
Pastikan model data untuk request Snap di Kotlin memiliki field `is_donation`.

```kotlin
@Serializable
data class SnapRequest(
    val order_id: String? = null, // Bisa null untuk donasi karena akan dibuat otomatis oleh server
    val gross_amount: Long,
    val is_donation: Boolean = false,
    val item_details: List<ItemDetail>,
    val customer_details: CustomerDetails,
    val santri_nis: String? = null,
    val wali_id: String? = null
)
```

### B. Update `KeuanganViewModel`
Tambahkan fungsi untuk memproses donasi. Berbeda dengan bayar tagihan, donasi tidak butuh `tagihan_id`.

```kotlin
fun bayarDonasi(nominal: Long, jenis: String, namaDonatur: String) {
    viewModelScope.launch {
        try {
            val request = SnapRequest(
                gross_amount = nominal,
                is_donation = true,
                item_details = listOf(ItemDetail(name = jenis, price = nominal)),
                customer_details = CustomerDetails(first_name = namaDonatur),
                santri_nis = currentSantriNis // Jika donasi via akun Wali
            )
            // Panggil API midtrans-snap
            val response = repository.getSnapToken(request)
            _launchMidtrans.emit(response.token)
        } catch (e: Exception) {
            _tagihanState.value = TagihanUiState.Error(e.message ?: "Gagal proses donasi")
        }
    }
}
```

### C. Update UI `KeuanganScreen`
1. Tambahkan tombol/FAB "Infaq / Wakaf".
2. Tampilkan `ModalBottomSheet` atau `Dialog` untuk input:
   - Pilih Jenis: Infaq, Wakaf, Shadaqah.
   - Input Nominal: (Gunakan `TextField` dengan filter angka).
   - Nama Donatur: (Default: Nama profil user).
3. Panggil `viewModel.bayarDonasi(...)` saat klik "Bayar Sekarang".

---

## 4. AUDIT FLOW (VERIFIKASI)
Setelah pembayaran sukses di Android:
1. Webhook `midtrans-payment` akan mendeteksi prefix `DONASI-`.
2. Sistem **TIDAK AKAN** mencari tabel `tagihan_santri`.
3. Sistem akan mengupdate/insert ke `transaksi_keuangan` dengan:
   - `jenis_transaksi`: `masuk`
   - `keterangan`: `[DONASI] Infaq Pembangunan dari Nama Donatur`
   - `status`: `success`

---

## 5. INSTRUKSI UNTUK AI CLI (CONTEXT BRIDGE)
*"Jika Anda diminta untuk mengimplementasikan fitur donasi di Android, pastikan untuk menggunakan endpoint `midtrans-snap` yang sudah mendukung flag `is_donation`. Jangan memaksakan pencarian ke tabel `tagihan_santri` karena donasi bersifat independen. Semua record donasi harus berakhir di tabel `transaksi_keuangan` dengan `midtrans_order_id` yang diawali dengan 'DONASI-'."*

---
**Status Dokumentasi:** Final - Siap Diimplementasikan.
**Dipersiapkan oleh:** Gemini CLI Senior Developer.
