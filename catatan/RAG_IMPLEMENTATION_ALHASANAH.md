# RAG AI IMPLEMENTATION GUIDE — AL-HASANAH SISTEM PESANTREN
> Dokumen ini dibaca oleh CLI Agent (Claude Code atau sejenisnya) untuk mengimplementasikan fitur RAG (Retrieval-Augmented Generation) pada sistem Al-Hasanah. Agent HARUS menganalisis struktur project yang ada sebelum menulis kode apapun, dan menyesuaikan implementasi dengan konvensi, struktur folder, dan pola yang sudah digunakan.

---

## 🎯 KONTEKS SISTEM

Sistem Al-Hasanah adalah platform manajemen pesantren multi-modul yang terdiri dari:
- **Admin Panel**: React 19 + Refine + Ant Design (TypeScript)
- **Mobile App**: Kotlin Jetpack Compose (Android) — untuk wali santri
- **Website**: Next.js — untuk publik
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + RLS)
- **AI Saat Ini**: External AI API (bukan lokal) — gunakan provider yang sudah dikonfigurasi di project
- **Bot**: Telegram Webhook (sudah berjalan, terhubung ke edge functions)

---

## 📋 INSTRUKSI UNTUK AGENT

### LANGKAH 0 — WAJIB DILAKUKAN PERTAMA
Sebelum menulis satu baris kode pun, agent HARUS:

1. **Scan struktur folder project** secara menyeluruh
2. **Identifikasi** konvensi penamaan yang digunakan (camelCase, snake_case, kebab-case)
3. **Temukan** pola edge functions yang sudah ada dan ikuti strukturnya
4. **Temukan** file konfigurasi AI/API yang sudah ada (env, config, utils)
5. **Identifikasi** pola Supabase client yang digunakan (singleton, hook, dll)
6. **Temukan** struktur tabel database yang ada (schema, types)
7. **Identifikasi** sistem autentikasi dan RLS yang sudah diterapkan
8. **Sesuaikan** semua implementasi di bawah ini dengan temuan di atas

> ⚠️ JANGAN membuat pola baru jika pola yang sama sudah ada di project. Ikuti yang sudah ada.

---

## 🗄️ BAGIAN 1 — DATABASE SETUP (Supabase)

### 1.1 Enable pgvector Extension
Jalankan di Supabase SQL Editor:

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.2 Struktur Tabel Dokumen

Buat tabel-tabel berikut. Agent harus memeriksa apakah sudah ada tabel serupa sebelum membuat yang baru.

```sql
-- ============================================
-- TABEL 1: Dokumen Publik Pesantren
-- Untuk chatbot publik (website + Android tanpa login)
-- Isi: sejarah, profil, kegiatan, jadwal, informasi umum
-- ============================================
CREATE TABLE IF NOT EXISTS public_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,                    -- isi chunk dokumen
  embedding VECTOR(1536),                   -- dimensi sesuai model embedding yang digunakan
  metadata JSONB DEFAULT '{}'::JSONB,       -- { "kategori": "sejarah", "sumber": "file.pdf", "halaman": 1 }
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk similarity search (HNSW — akurasi terbaik untuk < 1 juta rows)
CREATE INDEX IF NOT EXISTS public_documents_embedding_idx
  ON public_documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- TABEL 2: Dokumen Kitab & Referensi Ilmu
-- Untuk chatbot fiqh/muamalah — akses publik (bisa dibatasi)
-- Isi: kitab kuning (terjemahan), referensi fikih, muamalah, dll
-- ============================================
CREATE TABLE IF NOT EXISTS kitab_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}'::JSONB,
  -- metadata contoh: { "kitab": "Fathul Qarib", "bab": "Kitab Thaharah", "pasal": "Fasal Wudhu", "halaman": 12, "bahasa": "indonesia" }
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kitab_documents_embedding_idx
  ON kitab_documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- TABEL 3: Dokumen Internal Admin
-- Untuk admin decision support (kitab + data DB)
-- Akses: authenticated admin only (RLS ketat)
-- Isi: SOP internal, kebijakan yayasan, dokumen operasional
-- ============================================
CREATE TABLE IF NOT EXISTS internal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS internal_documents_embedding_idx
  ON internal_documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- TABEL 4: Log Interaksi RAG
-- Untuk audit trail semua query ke RAG
-- ============================================
CREATE TABLE IF NOT EXISTS rag_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id),   -- NULL untuk publik
  query_text TEXT NOT NULL,
  retrieved_doc_ids UUID[],
  response_preview TEXT,                     -- 200 char pertama dari response
  source_table TEXT,                         -- 'public_documents' | 'kitab_documents' | 'internal_documents'
  context TEXT,                              -- 'public_chatbot' | 'wali_chatbot' | 'admin_decision' | 'kitab_chatbot'
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.3 RLS (Row Level Security) Policies

```sql
-- ---- public_documents: semua bisa baca, hanya admin yang bisa tulis ----
ALTER TABLE public_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_documents_select_all"
  ON public_documents FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "public_documents_insert_admin"
  ON public_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles  -- sesuaikan dengan nama tabel roles yang ada
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')  -- sesuaikan dengan nilai role di project
    )
  );

CREATE POLICY "public_documents_update_admin"
  ON public_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ---- kitab_documents: bisa dibaca semua (publik), ditulis admin ----
ALTER TABLE kitab_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kitab_documents_select_all"
  ON kitab_documents FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "kitab_documents_write_admin"
  ON kitab_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ---- internal_documents: hanya authenticated admin ----
ALTER TABLE internal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_documents_admin_only"
  ON internal_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ---- rag_query_logs: insert dari service role, admin bisa baca ----
ALTER TABLE rag_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rag_logs_service_insert"
  ON rag_query_logs FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "rag_logs_admin_select"
  ON rag_query_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
```

### 1.4 Database Functions untuk Similarity Search

```sql
-- ============================================
-- FUNCTION: match_public_documents
-- Digunakan oleh: chatbot publik (website & Android tanpa auth)
-- ============================================
CREATE OR REPLACE FUNCTION match_public_documents (
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.title,
    pd.content,
    pd.metadata,
    1 - (pd.embedding <=> query_embedding) AS similarity
  FROM public_documents pd
  WHERE
    pd.is_active = TRUE
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- FUNCTION: match_kitab_documents
-- Digunakan oleh: chatbot kitab publik & admin decision support
-- ============================================
CREATE OR REPLACE FUNCTION match_kitab_documents (
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.65,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.id,
    kd.title,
    kd.content,
    kd.metadata,
    1 - (kd.embedding <=> query_embedding) AS similarity
  FROM kitab_documents kd
  WHERE
    kd.is_active = TRUE
    AND 1 - (kd.embedding <=> query_embedding) > match_threshold
  ORDER BY kd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- FUNCTION: match_internal_documents
-- Digunakan oleh: admin decision support (keamanan via edge function)
-- ============================================
CREATE OR REPLACE FUNCTION match_internal_documents (
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- dijalankan dengan hak creator, bukan caller
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ind.id,
    ind.title,
    ind.content,
    ind.metadata,
    1 - (ind.embedding <=> query_embedding) AS similarity
  FROM internal_documents ind
  WHERE
    ind.is_active = TRUE
    AND 1 - (ind.embedding <=> query_embedding) > match_threshold
  ORDER BY ind.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## ⚡ BAGIAN 2 — EDGE FUNCTIONS

> Agent HARUS melihat edge function yang sudah ada di project untuk memahami:
> - Pola import/export yang digunakan
> - Cara inisialisasi Supabase client di edge functions
> - Cara baca environment variables
> - Cara handle CORS
> - Cara handle error
> Kemudian ikuti pola yang sama persis di semua edge functions baru berikut.

### 2.1 Edge Function: `rag-ingest` (Upload & Embed Dokumen)

**Path**: `supabase/functions/rag-ingest/index.ts`

**Tujuan**: Menerima teks dokumen, memecahnya menjadi chunks, menggenerate embedding, menyimpan ke tabel yang sesuai.

**Hanya bisa dipanggil oleh admin yang authenticated.**

```typescript
/**
 * rag-ingest — Document ingestion edge function
 *
 * POST body:
 * {
 *   table: 'public_documents' | 'kitab_documents' | 'internal_documents',
 *   title: string,
 *   content: string,          // full text dokumen
 *   metadata: object,         // { kategori, sumber, kitab, bab, dll }
 *   chunk_size?: number,      // default: 500 karakter
 *   chunk_overlap?: number    // default: 50 karakter
 * }
 *
 * SECURITY:
 * - Verifikasi JWT token dari request header
 * - Cek role admin dari tabel user_roles (sesuaikan nama tabel dengan project)
 * - Tolak jika bukan admin
 *
 * PROSES:
 * 1. Validasi input
 * 2. Verifikasi auth + role
 * 3. Chunking: pecah content menjadi potongan-potongan kecil dengan overlap
 *    - Chunk per paragraf jika memungkinkan (pisah per '\n\n')
 *    - Fallback ke chunking per karakter dengan overlap jika terlalu panjang
 * 4. Loop setiap chunk:
 *    a. Generate embedding via AI API (sesuaikan dengan provider yang digunakan)
 *    b. Insert ke tabel yang ditentukan
 * 5. Return: { success: true, chunks_created: number, document_ids: string[] }
 *
 * ERROR HANDLING:
 * - Jika embedding gagal untuk 1 chunk, log error tapi lanjutkan chunk berikutnya
 * - Jika semua chunk gagal, return error 500
 * - Jangan ekspos internal error ke client
 */

// Agent: implementasikan fungsi ini mengikuti pola edge function yang sudah ada di project
// Gunakan AI API provider yang sudah dikonfigurasi (bukan hardcode provider baru)
// Gunakan Supabase client dengan SERVICE_ROLE_KEY untuk operasi insert (bypass RLS ingestion)
```

### 2.2 Edge Function: `rag-query-public` (Chatbot Publik — Tanpa Auth)

**Path**: `supabase/functions/rag-query-public/index.ts`

**Tujuan**: Menjawab pertanyaan publik tentang pesantren berdasarkan dokumen yang sudah di-embed. Tidak memerlukan autentikasi. Boleh dipanggil dari website Next.js dan Android app (tanpa login).

```typescript
/**
 * rag-query-public — Public chatbot query
 *
 * POST body:
 * {
 *   query: string,                    // pertanyaan dari user
 *   source: 'pesantren' | 'kitab',    // pilih tabel sumber
 *   session_id?: string               // untuk log (opsional, dari client)
 * }
 *
 * SECURITY:
 * - Tidak perlu auth token (public endpoint)
 * - Rate limiting: maksimal 20 request per IP per menit (implementasi via counter di Redis/KV atau simple check)
 * - Input sanitization: max query length 500 karakter
 * - JANGAN kirim data santri, NIK, NIS, atau data sensitif apapun ke AI
 * - JANGAN expose error stack ke client
 *
 * PROSES:
 * 1. Validasi & sanitasi input
 * 2. Generate embedding untuk query (via AI embedding API)
 * 3. Jalankan similarity search:
 *    - Jika source='pesantren': panggil match_public_documents()
 *    - Jika source='kitab': panggil match_kitab_documents()
 * 4. Bangun context dari hasil search (max 3-5 chunks paling relevan)
 * 5. Bangun system prompt:
 *    """
 *    Kamu adalah asisten informasi Pesantren Al-Hasanah.
 *    Jawab pertanyaan HANYA berdasarkan informasi berikut.
 *    Jika informasi tidak tersedia, katakan dengan jujur bahwa kamu tidak memiliki informasi tersebut.
 *    Jangan mengarang informasi.
 *    Gunakan Bahasa Indonesia yang sopan dan santun.
 *    [Untuk source kitab: Sebutkan nama kitab dan bab/pasal sumber jawabanmu]
 *    """
 * 6. Kirim ke AI API dengan context
 * 7. Log ke rag_query_logs (gunakan service role, user_id = NULL untuk publik)
 * 8. Return response
 *
 * RESPONSE:
 * {
 *   answer: string,
 *   sources: [{ title: string, metadata: object }],  // sumber yang digunakan
 *   has_relevant_context: boolean                     // apakah ada konteks relevan ditemukan
 * }
 */
```

### 2.3 Edge Function: `rag-query-wali` (Chatbot Wali Santri — Android Authenticated)

**Path**: `supabase/functions/rag-query-wali/index.ts`

**Tujuan**: Menjawab pertanyaan wali santri tentang kondisi anaknya. Authenticated — hanya bisa diakses wali yang sudah login di Android app.

```typescript
/**
 * rag-query-wali — Authenticated wali santri chatbot
 *
 * POST body:
 * {
 *   query: string,           // pertanyaan wali
 *   santri_id?: string       // opsional, jika wali punya lebih dari 1 anak
 * }
 *
 * SECURITY (KRITIS):
 * - WAJIB verifikasi JWT token dari Authorization header
 * - Cek tabel relasi wali_santri untuk memastikan wali ini memang
 *   orang tua/wali sah dari santri_id yang ditanyakan
 * - TOLAK jika wali mencoba akses data santri yang bukan anaknya
 * - DATA YANG BOLEH DIKIRIM KE AI:
 *   ✅ Nama santri (first name saja, bukan nama lengkap)
 *   ✅ Kelas/tingkat
 *   ✅ Status pembayaran (lunas/belum, nominal agregat)
 *   ✅ Jumlah hafalan (agregat juz, bukan detail per setoran)
 *   ✅ Status kehadiran (persentase, bukan detail tanggal per tanggal)
 *   ✅ Status kesehatan umum (baik/perlu perhatian)
 * - DATA YANG DILARANG DIKIRIM KE AI:
 *   ❌ NIK santri atau wali
 *   ❌ NIS lengkap
 *   ❌ Alamat lengkap
 *   ❌ Nomor telepon
 *   ❌ Detail finansial internal pesantren
 *   ❌ Data santri lain
 *
 * PROSES:
 * 1. Verifikasi JWT → dapatkan user_id wali
 * 2. Query DB: ambil daftar santri yang terhubung dengan wali ini
 * 3. Validasi santri_id yang diminta ada di daftar tersebut
 * 4. Query DB: ambil data santri yang DIIZINKAN (lihat list di atas)
 * 5. Jika pertanyaan tentang pesantren umum (bukan data anak):
 *    → Lakukan similarity search ke public_documents
 * 6. Jika pertanyaan tentang kondisi anak:
 *    → Gunakan data santri yang sudah di-query (BUKAN dari RAG, tapi dari DB langsung)
 *    → Gabungkan dengan dokumen publik jika relevan
 * 7. Bangun context + system prompt yang menekankan batasan data
 * 8. Kirim ke AI API
 * 9. Log ke rag_query_logs dengan user_id wali
 * 10. Return response
 *
 * RESPONSE:
 * {
 *   answer: string,
 *   context_type: 'personal_data' | 'public_info' | 'mixed',
 *   sources?: [{ title: string }]
 * }
 */
```

### 2.4 Edge Function: `rag-query-admin` (Admin Decision Support)

**Path**: `supabase/functions/rag-query-admin/index.ts`

**Tujuan**: Membantu admin dalam pengambilan keputusan dengan menggabungkan data real dari database dengan referensi kitab/dokumen internal. Ini adalah fitur paling powerful — hanya admin.

```typescript
/**
 * rag-query-admin — Admin decision support (hybrid RAG + structured data)
 *
 * POST body:
 * {
 *   query: string,
 *   context_type: 'financial' | 'academic' | 'santri' | 'kitab' | 'operational',
 *   include_kitab: boolean,       // sertakan referensi kitab?
 *   include_db_context: boolean,  // sertakan data real dari DB?
 *   filters?: {                   // filter data yang diambil dari DB
 *     kelas?: string,
 *     bulan?: string,
 *     tahun?: string
 *   }
 * }
 *
 * SECURITY:
 * - WAJIB verifikasi JWT
 * - WAJIB cek role admin/super_admin
 * - Tolak semua request non-admin
 * - Semua aksi dicatat di rag_query_logs
 * - Data NIK/NIS TIDAK dikirim ke AI (gunakan agregat atau ID internal saja)
 *
 * PROSES HYBRID RAG:
 * 1. Verifikasi auth + role
 * 2. Berdasarkan context_type, tentukan data apa yang diambil dari DB:
 *    - 'financial': ringkasan keuangan (total tagihan, tunggakan, surplus)
 *    - 'academic': statistik akademik (rata-rata kehadiran, rata-rata hafalan)
 *    - 'santri': data santri agregat (jangan kirim NIK/NIS ke AI)
 *    - 'kitab': tidak ambil data DB, hanya search kitab
 *    - 'operational': data operasional umum
 * 3. Jika include_kitab=true: jalankan similarity search di kitab_documents
 * 4. Jika include_db_context=true: query data relevan dari DB (AGREGAT, bukan row by row)
 * 5. Jika include_db_context=true: jalankan similarity search di internal_documents
 * 6. Gabungkan semua konteks:
 *    - Bagian A: Data real dari database (agregat, anonymized)
 *    - Bagian B: Referensi kitab (jika ada)
 *    - Bagian C: Dokumen internal (jika ada)
 * 7. Bangun system prompt admin:
 *    """
 *    Kamu adalah asisten pengambilan keputusan untuk manajemen Pesantren Al-Hasanah.
 *    Berikan rekomendasi berdasarkan data dan referensi yang diberikan.
 *    Jika menggunakan referensi kitab, sebutkan sumber dengan jelas.
 *    Bedakan antara rekomendasi berbasis data dan berbasis referensi ilmu.
 *    """
 * 8. Kirim ke AI API
 * 9. Log detail ke rag_query_logs
 * 10. Return response dengan attributasi sumber yang jelas
 *
 * RESPONSE:
 * {
 *   answer: string,
 *   data_sources: {
 *     db_context: boolean,
 *     kitab_references: [{ kitab: string, bab: string, similarity: number }],
 *     internal_docs: [{ title: string }]
 *   },
 *   confidence_note: string   // catatan tentang tingkat kepercayaan jawaban
 * }
 */
```

---

## 🖥️ BAGIAN 3 — IMPLEMENTASI ADMIN PANEL (React 19 + Refine + Ant Design)

> Agent HARUS menganalisis struktur komponen yang sudah ada di admin panel sebelum membuat komponen baru. Ikuti pola folder, naming convention, dan cara penggunaan Refine yang sudah ada.

### 3.1 Halaman Manajemen Dokumen RAG

Buat halaman baru di admin panel untuk mengelola dokumen yang masuk ke pgvector.

**Fungsionalitas yang dibutuhkan:**

```
📁 RAG Knowledge Base Management
├── Tab "Dokumen Publik" (public_documents)
│   ├── List dokumen dengan kolom: title, kategori, jumlah chunk, tanggal
│   ├── Tombol "Upload Dokumen" → modal upload
│   ├── Tombol "Tambah Manual" → form teks
│   └── Toggle aktif/nonaktif per dokumen
│
├── Tab "Kitab & Referensi" (kitab_documents)  
│   ├── List dengan kolom: title, nama kitab, bab, bahasa, jumlah chunk
│   ├── Filter berdasarkan kategori (fikih, muamalah, tasawuf, dll)
│   ├── Tombol upload + tambah manual
│   └── Toggle aktif/nonaktif
│
├── Tab "Dokumen Internal" (internal_documents)
│   ├── Hanya visible untuk super_admin (sembunyikan untuk admin biasa)
│   ├── List + upload + toggle
│   └── Tidak ada preview konten (sensitif)
│
└── Tab "Log Query RAG"
    ├── Tabel log semua query yang masuk
    ├── Filter: tanggal, context_type, source_table
    ├── Kolom: waktu, query, context, latency
    └── TIDAK tampilkan: user_id, response detail (privasi)
```

**Komponen Upload Dokumen:**
- Terima format: .txt, .pdf (ekstrak teks), .md, .docx (ekstrak teks)
- Preview teks sebelum diproses
- Field metadata: kategori, sumber, keterangan tambahan
- Progress indicator saat chunking + embedding berlangsung
- Konfirmasi jumlah chunk yang akan dibuat sebelum proses

**Komponen Chat Demo (untuk test):**
- Tambahkan widget chat kecil di halaman ini
- Pilihan: test public_documents atau kitab_documents
- Tampilkan: query → chunks yang ditemukan → response AI
- Hanya untuk testing, jangan di-expose ke user non-admin

### 3.2 Widget AI Chat Admin Decision Support

Buat widget chat yang terintegrasi di dashboard admin.

```
Posisi: Floating button di sudut kanan bawah ATAU panel samping
(Sesuaikan dengan desain admin panel yang sudah ada — lihat apakah sudah ada pola floating widget)

Fitur:
- Input pertanyaan natural language
- Checkbox: "Sertakan referensi kitab" | "Sertakan data pesantren"
- Dropdown context_type
- Response dengan attributasi sumber yang jelas
- Tombol "Salin jawaban" 
- Riwayat chat dalam sesi (hilang saat refresh, tidak perlu persistent)
- Indicator loading saat AI memproses
```

---

## 📱 BAGIAN 4 — ANDROID (Kotlin Jetpack Compose)

> Agent melihat struktur Android project yang sudah ada. Ikuti pola ViewModel, Repository, dan UI yang sudah diterapkan. Jangan membuat arsitektur baru jika sudah ada yang berjalan.

### 4.1 Chatbot Publik (Tanpa Login)

**Fungsionalitas:**
- Bisa diakses sebelum login (public screen)
- Pilihan mode: "Tentang Pesantren" atau "Tanya Kitab"
- UI: bubble chat sederhana, consistent dengan design system yang ada
- Panggil edge function `rag-query-public`
- Tampilkan sumber dokumen di bawah jawaban (collapsible)
- Indikator typing/loading
- Tidak menyimpan history chat (privacy)

### 4.2 Chatbot Wali Santri (Setelah Login)

**Fungsionalitas:**
- Muncul sebagai tab atau floating button setelah wali login
- Prefix otomatis dengan konteks anak (nama anak, kelas)
- Panggil edge function `rag-query-wali` dengan JWT token
- Tampilkan badge jika response berdasarkan data real anak
- Saran pertanyaan (suggested queries):
  - "Bagaimana perkembangan hafalan [nama anak]?"
  - "Ada tagihan yang belum lunas?"
  - "Jadwal kunjungan bulan ini kapan?"

---

## 🔐 BAGIAN 5 — KEAMANAN DATA (WAJIB DIIMPLEMENTASIKAN)

Ini adalah requirement non-negotiable. Agent HARUS mengimplementasikan semua poin ini.

### 5.1 Data yang TIDAK BOLEH masuk ke AI API

```typescript
// Buat helper/utility function ini dan gunakan di semua edge functions
function sanitizeForAI(data: any): any {
  // Hapus semua field berikut sebelum mengirim ke AI
  const FORBIDDEN_FIELDS = [
    'nik',
    'nis',
    'no_ktp',
    'no_kk',
    'alamat_lengkap',
    'no_telp',
    'no_hp',
    'password',
    'token',
    'refresh_token',
    'bank_account',
    'no_rekening',
  ];
  
  // Implementasikan recursive sanitization
  // Return data yang sudah bersih
}
```

### 5.2 Rate Limiting di Edge Functions

```typescript
// Implementasikan rate limiting sederhana untuk endpoint publik
// Gunakan Supabase KV atau tabel sementara untuk tracking
// Limit: 20 request per IP per menit untuk public endpoints
// Limit: 60 request per user per menit untuk authenticated endpoints
```

### 5.3 Input Validation

```typescript
// Validasi semua input sebelum diproses
const RAG_QUERY_LIMITS = {
  maxQueryLength: 500,          // karakter
  maxChunkSize: 800,            // karakter per chunk saat ingest
  maxChunkOverlap: 100,         // karakter overlap
  maxRetrievedChunks: 5,        // maksimal chunk yang dikirim ke AI
  maxContextLength: 4000,       // total karakter context yang dikirim ke AI
};
```

---

## 📦 BAGIAN 6 — UTILITAS CHUNKING

Agent perlu mengimplementasikan fungsi chunking yang cerdas. Implementasikan sebagai shared utility yang bisa digunakan di edge functions.

```typescript
/**
 * Smart Chunker untuk berbagai jenis dokumen
 *
 * Prioritas chunking (dari yang paling diutamakan):
 * 1. Per bab/pasal (untuk kitab) — deteksi dari struktur teks
 * 2. Per paragraf (pisah di '\n\n')
 * 3. Per kalimat (pisah di '. ' atau '.\n')
 * 4. Per karakter dengan overlap (fallback)
 *
 * Parameter:
 * - text: string (teks lengkap)
 * - chunkSize: number (default 500 karakter)
 * - overlap: number (default 50 karakter)
 * - documentType: 'general' | 'kitab' | 'report'
 *
 * Return: string[] (array of chunks)
 *
 * Catatan penting untuk kitab kuning:
 * - Deteksi struktur "Fasal..." atau "Bab..." sebagai batas chunk alami
 * - Pertahankan konteks dengan menyertakan judul bab/pasal di awal setiap chunk
 * - Format: "[Kitab X, Bab Y, Pasal Z] <isi konten>"
 */
```

---

## 🔧 BAGIAN 7 — ENVIRONMENT VARIABLES

Agent harus memeriksa `.env` atau konfigurasi yang sudah ada. Tambahkan variabel berikut HANYA jika belum ada:

```env
# Tambahkan ke file .env yang sudah ada (jangan buat file baru jika sudah ada)
# Gunakan provider AI yang sudah dikonfigurasi di project

# Untuk embedding (sesuaikan dengan provider yang digunakan)
AI_EMBEDDING_MODEL=text-embedding-3-small   # atau model yang sudah digunakan

# Untuk completion
AI_COMPLETION_MODEL=                         # sesuaikan dengan yang sudah ada

# RAG Config
RAG_MATCH_THRESHOLD_PUBLIC=0.70
RAG_MATCH_THRESHOLD_KITAB=0.65
RAG_MATCH_THRESHOLD_INTERNAL=0.70
RAG_MAX_CHUNKS=5
RAG_MAX_CONTEXT_CHARS=4000
```

---

## ✅ BAGIAN 8 — CHECKLIST IMPLEMENTASI

Agent gunakan checklist ini untuk memastikan semua sudah diimplementasikan:

### Database
- [ ] pgvector extension enabled
- [ ] Tabel `public_documents` dibuat dengan index HNSW
- [ ] Tabel `kitab_documents` dibuat dengan index HNSW
- [ ] Tabel `internal_documents` dibuat dengan index HNSW
- [ ] Tabel `rag_query_logs` dibuat
- [ ] RLS policies untuk semua tabel
- [ ] Database functions `match_*` dibuat

### Edge Functions
- [ ] `rag-ingest` — upload & embed dokumen
- [ ] `rag-query-public` — chatbot tanpa auth
- [ ] `rag-query-wali` — chatbot wali santri authenticated
- [ ] `rag-query-admin` — admin decision support hybrid

### Admin Panel
- [ ] Halaman manajemen dokumen RAG (3 tab)
- [ ] Komponen upload dokumen dengan chunking preview
- [ ] Tab log query RAG
- [ ] Widget chat admin decision support
- [ ] Test chatbot di admin panel

### Android
- [ ] Chatbot publik (screen sebelum login)
- [ ] Chatbot wali santri (setelah login, dengan data anak)

### Keamanan
- [ ] `sanitizeForAI()` diimplementasikan dan digunakan di SEMUA edge functions
- [ ] Rate limiting di endpoint publik
- [ ] Input validation di semua endpoint
- [ ] Tidak ada NIK/NIS yang dikirim ke AI API
- [ ] Semua query tercatat di `rag_query_logs`

---

## 📝 CATATAN TAMBAHAN UNTUK AGENT

1. **Jangan hardcode** nama provider AI, model, atau API key. Selalu baca dari environment variables yang sudah ada.

2. **Jangan duplikasi** logika yang sudah ada di project (auth check, supabase client init, CORS handler, dll). Gunakan yang sudah ada.

3. **Konsistensi nama**: Gunakan konvensi penamaan yang sama dengan file-file yang sudah ada di project.

4. **Error messages**: Jangan ekspos internal error ke client. Return pesan generik ke user, log detail ke console/logging system.

5. **Bahasa response AI**: Semua system prompt harus menginstruksikan AI untuk menjawab dalam Bahasa Indonesia yang sopan, kecuali ada konteks khusus.

6. **Graceful degradation**: Jika AI API tidak tersedia atau error, kembalikan response yang informatif ke user, jangan crash.

7. **Testing**: Setelah implementasi, buat 1 dokumen test sederhana di setiap tabel dan verifikasi similarity search berjalan dengan benar sebelum dianggap selesai.

8. **Schema flexibility**: Nama tabel `user_roles`, nama kolom role, dan nilai role (admin/super_admin/dll) HARUS disesuaikan dengan yang sudah ada di database project ini. Agent wajib mengecek ini di langkah 0.
