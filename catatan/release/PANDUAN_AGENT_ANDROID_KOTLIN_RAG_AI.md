# Panduan Implementasi Android Kotlin RAG AI Al-Hasanah untuk Agent AI

Dokumen ini ditujukan untuk agent AI yang akan bekerja di project Android/Kotlin Al-Hasanah. Gunakan dokumen ini sebagai instruksi utama untuk memahami fitur RAG AI yang sudah dibangun di Supabase dan Admin Panel, lalu implementasikan integrasi chatbot di aplikasi Android secara bertahap.

Agent wajib membaca dokumen ini sampai selesai sebelum membuat perubahan kode.

---

## 1. Tujuan Implementasi Android

Project Android/Kotlin akan memiliki chatbot AI berbasis RAG dengan dua jalur utama:

1. Chatbot publik tanpa login.
2. Chatbot wali santri dengan login.

Chatbot publik digunakan oleh user biasa untuk:

- bertanya tentang profil pesantren
- bertanya tentang jadwal/kegiatan/informasi umum
- bertanya soal agama atau kitab berdasarkan dokumen referensi yang diupload admin

Chatbot wali digunakan oleh wali santri yang login untuk:

- bertanya ringkasan tagihan anak
- bertanya progres hafalan anak
- bertanya ringkasan perizinan, kedisiplinan, prestasi, dan kesehatan secara aman
- bertanya informasi umum pesantren dengan tambahan konteks knowledge publik

Admin panel sudah selesai menjadi tempat upload dan pengelolaan knowledge. Android tidak perlu membuat fitur upload dokumen.

---

## 2. Instruksi Wajib untuk Agent

Sebelum menulis kode di project Android:

1. Gunakan skill MCP yang tersedia, terutama skill Supabase, sama seperti agent sebelumnya.
2. Cek struktur project Android secara menyeluruh.
3. Temukan stack yang dipakai:
   - Kotlin
   - Jetpack Compose atau XML
   - arsitektur MVVM/Clean Architecture atau pola lain
   - dependency injection, jika ada
   - networking client yang sudah dipakai
   - Supabase client yang sudah dipakai
   - auth/session management yang sudah dipakai
4. Jangan membuat pola baru jika project sudah punya pola sendiri.
5. Jangan menyimpan `service_role` key di Android.
6. Jangan hardcode secret.
7. Gunakan publishable/anon key atau Supabase client yang sudah ada di project.
8. Pastikan endpoint `rag-query-wali` selalu memakai session JWT user wali.
9. Pastikan endpoint `rag-query-public` boleh dipakai tanpa login, tetapi tetap lewat Supabase Function invoke atau HTTP client dengan anon/publishable key.
10. Implementasikan bertahap dan uji tiap tahap.

Jika perlu mengecek Supabase:

- gunakan MCP Supabase untuk membaca daftar Edge Function
- gunakan MCP Supabase untuk membaca struktur tabel jika dibutuhkan
- gunakan MCP Supabase untuk membaca logs saat debugging
- gunakan MCP Supabase docs search jika ada perilaku Supabase yang meragukan

---

## 3. Sistem yang Sudah Ada

Backend Supabase sudah memiliki:

### 3.1 Tabel RAG

Tabel utama:

- `public.rag_documents`
- `public.rag_document_chunks`
- `public.rag_query_logs`
- `public.rag_rate_limits`

Admin panel mengelola dokumen melalui tabel ini.

### 3.2 Edge Functions

Endpoint utama:

#### `rag-query-public`

URL:

```text
https://sldobkbolvrahlnowrga.supabase.co/functions/v1/rag-query-public
```

Verifikasi JWT:

```text
verify_jwt = false
```

Dipakai untuk:

- user biasa tanpa login
- pertanyaan umum pesantren
- pertanyaan kitab/agama dari dokumen kitab

Request body:

```json
{
  "source": "pesantren",
  "query": "Apa profil Pesantren Al-Hasanah?",
  "session_id": "android-public-device-or-session-id"
}
```

Pilihan `source`:

- `pesantren`: mencari di dokumen publik
- `kitab`: mencari di dokumen kitab/referensi agama

Response:

```json
{
  "answer": "Jawaban AI",
  "sources": [
    {
      "title": "Judul dokumen",
      "metadata": {},
      "similarity": 0.78
    }
  ],
  "has_relevant_context": true,
  "remaining_requests": 19
}
```

#### `rag-query-wali`

URL:

```text
https://sldobkbolvrahlnowrga.supabase.co/functions/v1/rag-query-wali
```

Verifikasi JWT:

```text
verify_jwt = true
```

Dipakai untuk:

- wali santri yang login di Android

Request body:

```json
{
  "query": "Ringkas tagihan anak saya bulan ini",
  "child_ref": "child_1",
  "include_public_knowledge": true
}
```

Catatan:

- `child_ref` opsional.
- Jika kosong, backend memakai anak pertama yang tertaut ke akun wali.
- Jangan kirim NIS dari Android untuk memilih anak.
- Backend mengembalikan daftar `children` dengan `child_ref` agar UI dapat menampilkan pilihan anak.

Response:

```json
{
  "answer": "Jawaban AI untuk wali",
  "children": [
    {
      "child_ref": "child_1",
      "nama": "Nama Santri",
      "kelas": "2",
      "jurusan": "TAHFIDZ",
      "status_santri": "AKTIF"
    }
  ],
  "selected_child_ref": "child_1",
  "sources": [
    {
      "title": "Judul dokumen publik",
      "metadata": {},
      "similarity": 0.75
    }
  ],
  "remaining_requests": 39
}
```

Error umum:

```json
{
  "error": "Token autentikasi tidak valid."
}
```

```json
{
  "error": "Akun wali belum terhubung dengan data santri."
}
```

```json
{
  "error": "Referensi santri tidak valid untuk akun wali ini."
}
```

#### `rag-query-admin`

Endpoint ini untuk Admin Panel, bukan untuk Android.

Android tidak perlu mengimplementasikan endpoint ini kecuali nanti ada aplikasi khusus pengurus.

#### `rag-ingest`

Endpoint ini untuk Admin Panel upload dan embedding dokumen.

Android tidak boleh memakai endpoint ini untuk user biasa/wali.

---

## 4. Role dan Akses

Role yang relevan:

- `wali`: user login wali santri
- user tanpa login: publik

Role admin:

- `super_admin`
- `rois`
- `dewan`

Android tahap ini hanya fokus:

- publik tanpa login
- wali login

Jangan membuat fitur admin RAG di Android kecuali diminta nanti.

---

## 5. Alur Fitur Android

### 5.1 Chatbot Publik Tanpa Login

User membuka aplikasi tanpa login atau dari halaman publik.

UI menyediakan pilihan:

- Informasi Pesantren
- Tanya Agama/Kitab

Mapping:

- Informasi Pesantren -> `source = "pesantren"`
- Tanya Agama/Kitab -> `source = "kitab"`

Alur:

1. User mengetik pertanyaan.
2. App membuat atau mengambil `session_id`.
3. App memanggil `rag-query-public`.
4. Tampilkan loading.
5. Tampilkan `answer`.
6. Jika ada `sources`, tampilkan sumber secara ringkas.
7. Jika `has_relevant_context = false`, tampilkan pesan bahwa informasi belum tersedia.

### 5.2 Chatbot Wali Login

User login sebagai wali.

Alur:

1. App memastikan session Supabase aktif.
2. User membuka menu Chat Wali.
3. User mengetik pertanyaan.
4. App memanggil `rag-query-wali` dengan JWT user.
5. Response pertama mengembalikan daftar `children`.
6. Jika wali memiliki lebih dari satu anak, UI tampilkan pilihan anak.
7. Untuk query berikutnya, kirim `child_ref` yang dipilih.
8. Tampilkan jawaban dan sumber.

Penting:

- Jangan tampilkan NIS.
- Jangan minta NIK.
- Jangan tampilkan alamat lengkap atau nomor HP.
- Jika backend menolak akses, tampilkan pesan sederhana.

---

## 6. Rekomendasi UI/UX Android

### 6.1 Entry Point

Tambahkan menu:

- `Tanya Pesantren`
- `Tanya Agama`
- `Chat Wali`

Atau gunakan satu layar chatbot dengan segmented control:

- Pesantren
- Agama
- Wali

Untuk user belum login:

- tampilkan tab Pesantren dan Agama
- tab Wali meminta login

Untuk user login wali:

- tampilkan semua tab

### 6.2 Chat Screen

Komponen minimal:

- daftar pesan chat
- input teks
- tombol kirim
- loading indicator
- tombol pilih sumber atau mode
- daftar sumber jawaban
- pesan error yang jelas

Pesan dari user:

- align kanan
- bubble berbeda

Pesan AI:

- align kiri
- bubble berbeda
- mendukung markdown sederhana jika project sudah punya renderer

### 6.3 Source Card

Setelah jawaban, tampilkan:

- judul sumber
- similarity jika ingin debug
- metadata ringkas

Untuk user umum, jangan terlalu teknis. Misalnya:

```text
Sumber: Profil Pesantren 2026
```

Untuk mode developer/debug, similarity boleh ditampilkan.

### 6.4 Empty State

Jika belum ada konteks:

```text
Maaf, informasi tersebut belum tersedia di knowledge base Al-Hasanah.
```

Untuk pertanyaan agama:

```text
Maaf, referensi kitab untuk pertanyaan tersebut belum tersedia.
```

### 6.5 Rate Limit

Jika backend mengembalikan 429:

```text
Terlalu banyak pertanyaan. Coba lagi sebentar lagi.
```

Jangan auto-retry berkali-kali.

---

## 7. Arsitektur yang Disarankan

Sesuaikan dengan project. Jika project memakai MVVM, gunakan susunan seperti ini:

```text
data/
  remote/
    RagApi.kt
  model/
    RagModels.kt
  repository/
    RagRepository.kt

domain/
  model/
    ChatMessage.kt
    RagChatMode.kt
  usecase/
    SendPublicRagMessageUseCase.kt
    SendWaliRagMessageUseCase.kt

ui/
  rag/
    RagChatScreen.kt
    RagChatViewModel.kt
    components/
      ChatBubble.kt
      SourceCard.kt
      ChildSelector.kt
```

Jika project sudah memiliki struktur lain, ikuti struktur project tersebut.

---

## 8. Model Data Kotlin

Contoh model. Sesuaikan dengan serializer yang dipakai.

Jika memakai Kotlin Serialization:

```kotlin
@Serializable
data class PublicRagRequest(
    val source: String,
    val query: String,
    @SerialName("session_id")
    val sessionId: String? = null
)

@Serializable
data class PublicRagResponse(
    val answer: String,
    val sources: List<RagSource> = emptyList(),
    @SerialName("has_relevant_context")
    val hasRelevantContext: Boolean = false,
    @SerialName("remaining_requests")
    val remainingRequests: Int? = null
)

@Serializable
data class WaliRagRequest(
    val query: String,
    @SerialName("child_ref")
    val childRef: String? = null,
    @SerialName("include_public_knowledge")
    val includePublicKnowledge: Boolean = true
)

@Serializable
data class WaliRagResponse(
    val answer: String,
    val children: List<WaliChild> = emptyList(),
    @SerialName("selected_child_ref")
    val selectedChildRef: String? = null,
    val sources: List<RagSource> = emptyList(),
    @SerialName("remaining_requests")
    val remainingRequests: Int? = null
)

@Serializable
data class WaliChild(
    @SerialName("child_ref")
    val childRef: String,
    val nama: String? = null,
    val kelas: String? = null,
    val jurusan: String? = null,
    @SerialName("status_santri")
    val statusSantri: String? = null
)

@Serializable
data class RagSource(
    val title: String,
    val metadata: JsonObject? = null,
    val similarity: Double? = null
)

@Serializable
data class RagErrorResponse(
    val error: String? = null
)
```

Jika project memakai Gson/Moshi, ubah anotasi sesuai library.

---

## 9. Networking

### 9.1 Jika Project Memakai Supabase Kotlin Client

Gunakan client Supabase yang sudah ada.

Pseudocode:

```kotlin
val response = supabase.functions.invoke(
    function = "rag-query-public",
    body = PublicRagRequest(
        source = "pesantren",
        query = query,
        sessionId = sessionId
    )
)
```

Untuk wali:

```kotlin
val response = supabase.functions.invoke(
    function = "rag-query-wali",
    body = WaliRagRequest(
        query = query,
        childRef = selectedChildRef,
        includePublicKnowledge = true
    )
)
```

Pastikan session user sudah login sehingga Authorization header dikirim otomatis.

### 9.2 Jika Project Memakai Retrofit/OkHttp

Gunakan endpoint HTTP.

Public:

```http
POST https://sldobkbolvrahlnowrga.supabase.co/functions/v1/rag-query-public
Authorization: Bearer <ANON_OR_PUBLISHABLE_KEY>
apikey: <ANON_OR_PUBLISHABLE_KEY>
Content-Type: application/json
```

Wali:

```http
POST https://sldobkbolvrahlnowrga.supabase.co/functions/v1/rag-query-wali
Authorization: Bearer <USER_ACCESS_TOKEN>
apikey: <ANON_OR_PUBLISHABLE_KEY>
Content-Type: application/json
```

Jangan kirim service role.

---

## 10. Repository Contract

Contoh interface:

```kotlin
interface RagRepository {
    suspend fun askPublicPesantren(query: String): Result<PublicRagResponse>
    suspend fun askPublicKitab(query: String): Result<PublicRagResponse>
    suspend fun askWali(query: String, childRef: String? = null): Result<WaliRagResponse>
}
```

Implementasi:

- `askPublicPesantren` memanggil `rag-query-public` dengan `source = "pesantren"`.
- `askPublicKitab` memanggil `rag-query-public` dengan `source = "kitab"`.
- `askWali` memanggil `rag-query-wali` dan membutuhkan session login.

---

## 11. ViewModel State

Contoh state:

```kotlin
data class RagChatUiState(
    val mode: RagChatMode = RagChatMode.PESANTREN,
    val messages: List<ChatMessage> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val children: List<WaliChild> = emptyList(),
    val selectedChildRef: String? = null,
    val sources: List<RagSource> = emptyList()
)

enum class RagChatMode {
    PESANTREN,
    KITAB,
    WALI
}

data class ChatMessage(
    val id: String,
    val role: ChatRole,
    val text: String,
    val createdAt: Long = System.currentTimeMillis(),
    val sources: List<RagSource> = emptyList()
)

enum class ChatRole {
    USER,
    ASSISTANT,
    SYSTEM
}
```

---

## 12. Error Handling

Tangani error berikut:

### 401/403

Untuk wali:

```text
Sesi login tidak valid. Silakan login ulang.
```

Untuk public:

```text
Layanan belum dapat digunakan. Coba lagi nanti.
```

### 429

```text
Terlalu banyak pertanyaan. Coba lagi sebentar lagi.
```

### 500

```text
AI belum dapat menjawab saat ini. Coba lagi nanti.
```

### Empty Knowledge

Jika `has_relevant_context = false`:

```text
Informasi tersebut belum tersedia di knowledge base.
```

---

## 13. Keamanan dan Privasi

Wajib:

- Jangan simpan `service_role`.
- Jangan tampilkan NIS.
- Jangan tampilkan NIK.
- Jangan tampilkan alamat lengkap.
- Jangan tampilkan nomor HP.
- Jangan mengizinkan user memilih santri dengan NIS.
- Gunakan `child_ref` dari response backend.
- Untuk wali, selalu gunakan token session user login.
- Jangan membuat endpoint custom yang membaca data wali langsung dari Android.

Backend `rag-query-wali` sudah melakukan ownership check:

```text
santri.wali_id = profile.id
```

Android tidak perlu melakukan validasi ownership sendiri, tetapi UI harus mengikuti response backend.

---

## 14. Logging dan Debugging

Jika terjadi error:

1. Cek response body.
2. Cek status code.
3. Cek apakah session user tersedia.
4. Cek apakah role user adalah `wali`.
5. Cek apakah wali sudah tertaut ke santri.
6. Gunakan MCP Supabase untuk cek Edge Function logs.

Gunakan MCP Supabase:

- `list_edge_functions`
- `get_logs` service `edge-function`
- `execute_sql` hanya untuk query read-only saat audit
- `search_docs` untuk dokumentasi Supabase terbaru

Jangan melakukan perubahan database dari Android agent kecuali diminta eksplisit.

---

## 15. Tahapan Eksekusi untuk Agent

### Tahap 1: Audit Project Android

Lakukan:

- scan struktur folder
- cari Supabase client
- cari auth provider/session manager
- cari pola repository/viewmodel/screen
- cari dependency HTTP/serialization
- cari navigation graph
- cari theme/design system

Output internal yang harus dipahami:

- lokasi file networking
- lokasi file auth
- lokasi file screen utama
- lokasi navigation
- pola state management

### Tahap 2: Tambahkan Model RAG

Buat model request/response sesuai serializer project.

Pastikan:

- field snake_case dimapping benar
- `metadata` bisa menerima object fleksibel
- error response bisa dibaca

### Tahap 3: Tambahkan Remote Data Source

Implementasikan pemanggilan:

- `rag-query-public`
- `rag-query-wali`

Gunakan Supabase client jika tersedia. Jika tidak, pakai HTTP client existing.

### Tahap 4: Tambahkan Repository

Tambahkan fungsi:

- ask pesantren
- ask kitab
- ask wali

Repository harus mengembalikan state/error yang rapi, bukan melempar error mentah ke UI.

### Tahap 5: Tambahkan ViewModel

ViewModel mengatur:

- mode chat
- input user
- daftar pesan
- loading
- error
- children wali
- selected child
- sources

### Tahap 6: Tambahkan UI Chat

Bangun UI sesuai design project:

- segmented mode
- chat list
- input
- loading
- source card
- child selector untuk wali
- empty state

Jangan membuat landing page. Buat pengalaman chatbot langsung bisa dipakai.

### Tahap 7: Integrasi Navigation

Tambahkan route/menu sesuai pola project.

Rekomendasi nama:

- `RagChatScreen`
- label menu: `Tanya AI`

### Tahap 8: Testing Manual

Uji:

- tanya pesantren tanpa login
- tanya kitab tanpa login
- login wali dan tanya tagihan
- login wali tanpa santri tertaut
- rate limit error
- network error
- empty context
- sumber dokumen tampil

### Tahap 9: Hardening

Pastikan:

- tombol kirim disabled saat loading
- input kosong tidak dikirim
- error tidak membuat app crash
- retry manual tersedia
- session expired diarahkan login
- tidak ada data sensitif tampil

---

## 16. Contoh Prompt Uji

### Public Pesantren

```text
Apa profil Pesantren Al-Hasanah?
```

```text
Apa saja program pendidikan yang tersedia?
```

```text
Bagaimana jadwal kegiatan umum pesantren?
```

### Public Kitab/Agama

```text
Jelaskan adab menuntut ilmu.
```

```text
Apa ringkasan bab thaharah?
```

```text
Bagaimana hukum menjaga kebersihan menurut referensi yang tersedia?
```

### Wali

```text
Ringkas tagihan anak saya.
```

```text
Bagaimana progres hafalan anak saya?
```

```text
Apakah ada catatan kedisiplinan terbaru?
```

```text
Apa ringkasan prestasi dan perizinan anak saya?
```

---

## 17. Checklist Selesai

Fitur Android dianggap selesai jika:

- chatbot publik dapat bertanya ke dokumen pesantren
- chatbot publik dapat bertanya ke dokumen kitab
- chatbot wali dapat dipakai setelah login
- wali hanya melihat anak yang tertaut
- UI menampilkan jawaban dan sumber
- error ditangani dengan baik
- tidak ada service role di app
- tidak ada NIS/NIK/alamat/no HP ditampilkan
- build Android berhasil
- minimal test manual utama berhasil

---

## 18. Catatan Penting untuk Agent

Jangan mengubah pondasi Supabase yang sudah dibuat kecuali ada error nyata.

Jangan membuat tabel RAG baru di Android project. Tabel sudah ada:

- `rag_documents`
- `rag_document_chunks`
- `rag_query_logs`
- `rag_rate_limits`

Jangan membuat fungsi upload dokumen di Android. Upload dokumen hanya dari Admin Panel.

Jangan memakai `rag-query-admin` untuk aplikasi wali atau publik.

Gunakan endpoint sesuai mode:

- publik pesantren: `rag-query-public`, `source = pesantren`
- publik agama/kitab: `rag-query-public`, `source = kitab`
- wali login: `rag-query-wali`

Jika menemukan perbedaan struktur project Android, ikuti project Android, tetapi jangan mengubah kontrak backend tanpa alasan kuat.

