# SECURITY PROTOCOL — AL-HASANAH SISTEM PESANTREN
## Dokumen Wajib Dibaca Agent CLI Sebelum Mengerjakan Apapun

> **PRIORITAS TERTINGGI**: Dokumen ini adalah protokol keamanan yang TIDAK BOLEH diabaikan.
> Setiap agent CLI (Codex CLI, Claude Code, atau sejenisnya) WAJIB membaca dokumen ini
> secara penuh sebelum menulis satu baris kode pun, melakukan perubahan apapun,
> atau menjalankan query database apapun.
>
> **Versi Dokumen**: 1.0
> **Berlaku untuk**: Admin Panel (React 19 + Refine + Ant Design) + Android App (Kotlin Jetpack Compose)
> **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + RLS)

---

## ⚠️ PERINGATAN UNTUK AGENT

```
BACA INI SEBELUM APAPUN:

1. JANGAN pernah menghapus enkripsi yang sudah ada
2. JANGAN pernah menambah kolom sensitif tanpa enkripsi
3. JANGAN pernah expose private key ke server atau log
4. JANGAN pernah skip RLS pada tabel manapun
5. JANGAN pernah log data sensitif (NIK, nama, keuangan)
6. JANGAN pernah kirim data sensitif ke AI API tanpa sanitasi
7. JANGAN pernah hardcode encryption key di source code
8. JANGAN pernah disable HTTPS atau certificate validation
9. JANGAN pernah store plaintext NIK, NIK Wali, data keuangan
10. JANGAN commit .env atau file konfigurasi ke repository
```

---

# BAB 1 — KLASIFIKASI DATA & ATURAN ENKRIPSI

## 1.1 Tabel Klasifikasi Data

Setiap field dalam sistem diklasifikasikan ke dalam 3 level:

| Level | Nama | Contoh Field | Perlakuan |
|-------|------|-------------|-----------|
| 🔴 **MERAH** | Data Sangat Sensitif | NIK, NIK Wali/Ortu, No. KK, No. Rekening | **WAJIB enkripsi field-level** dengan pgcrypto |
| 🟡 **KUNING** | Data Pribadi | Nama lengkap, Tanggal lahir, Alamat, No. HP, Email | **WAJIB enkripsi field-level** + RLS ketat |
| 🟢 **HIJAU** | Data Operasional | ID, Kelas, Status tagihan (nominal), Tanggal, Metadata | Cukup RLS + enkripsi at-rest Supabase |

## 1.2 Field yang WAJIB Dienkripsi (Level Merah & Kuning)

### Tabel Santri:
```
🔴 nik                    → pgp_sym_encrypt WAJIB
🔴 nik_wali               → pgp_sym_encrypt WAJIB
🔴 nik_ayah               → pgp_sym_encrypt WAJIB
🔴 nik_ibu                → pgp_sym_encrypt WAJIB
🟡 nama_lengkap           → pgp_sym_encrypt WAJIB
🟡 tempat_lahir           → pgp_sym_encrypt WAJIB
🟡 tanggal_lahir          → pgp_sym_encrypt WAJIB
🟡 alamat_lengkap         → pgp_sym_encrypt WAJIB
🟡 no_hp                  → pgp_sym_encrypt WAJIB
🟡 nama_ayah              → pgp_sym_encrypt WAJIB
🟡 nama_ibu               → pgp_sym_encrypt WAJIB
🟡 nama_wali              → pgp_sym_encrypt WAJIB
🟢 nis                    → HASH saja (sha256), simpan hash untuk lookup
🟢 kelas, angkatan        → Plain, cukup RLS
🟢 status_aktif           → Plain, cukup RLS
```

### Tabel Pegawai/Ustadz:
```
🔴 nik                    → pgp_sym_encrypt WAJIB
🔴 nuptk                  → pgp_sym_encrypt WAJIB
🔴 nip                    → pgp_sym_encrypt WAJIB
🟡 nama_lengkap           → pgp_sym_encrypt WAJIB
🟡 tanggal_lahir          → pgp_sym_encrypt WAJIB
🟡 alamat                 → pgp_sym_encrypt WAJIB
🟡 no_hp                  → pgp_sym_encrypt WAJIB
🟡 no_rekening            → pgp_sym_encrypt WAJIB
🟡 gaji_pokok             → pgp_sym_encrypt WAJIB
🟢 jabatan, status        → Plain, cukup RLS
```

### Tabel Keuangan:
```
🟡 nominal_tagihan        → pgp_sym_encrypt WAJIB
🟡 nominal_terbayar       → pgp_sym_encrypt WAJIB
🟡 catatan_keuangan       → pgp_sym_encrypt WAJIB
🟢 status_lunas           → Plain
🟢 tanggal_jatuh_tempo    → Plain
🟢 jenis_tagihan          → Plain
```

### Tabel Wali Santri (User App Android):
```
🔴 nik                    → pgp_sym_encrypt WAJIB
🟡 nama_lengkap           → pgp_sym_encrypt WAJIB
🟡 no_hp                  → pgp_sym_encrypt WAJIB
🟡 alamat                 → pgp_sym_encrypt WAJIB
🟢 email (auth)           → Dikelola Supabase Auth
```

### Tabel Chat/Pesan (E2EE — BERBEDA MEKANISMENYA):
```
❌ isi_pesan TIDAK BOLEH disimpan plaintext
❌ isi_pesan TIDAK BOLEH dienkripsi server-side (itu bukan E2EE)
✅ ciphertext_for_recipient → Hanya E2EE ciphertext yang boleh disimpan
✅ ciphertext_for_sender    → Hanya E2EE ciphertext yang boleh disimpan
✅ Metadata (waktu, siapa) → Boleh plain, cukup RLS
```

---

# BAB 2 — IMPLEMENTASI ENKRIPSI DATABASE (SUPABASE/POSTGRESQL)

## 2.1 Setup Enkripsi — Jalankan Sekali di SQL Editor Supabase

```sql
-- ============================================================
-- SETUP AWAL — Jalankan di Supabase SQL Editor
-- Hanya perlu dijalankan SEKALI
-- ============================================================

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Buat fungsi enkripsi standar sistem
-- PENTING: Ganti 'ENCRYPTION_KEY_PLACEHOLDER' dengan value dari
-- environment variable SUPABASE_ENCRYPTION_KEY
-- JANGAN hardcode key di sini — gunakan vault atau env var

-- Fungsi enkripsi field
CREATE OR REPLACE FUNCTION encrypt_field(data TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(
    data,
    current_setting('app.encryption_key')
  );
END;
$$;

-- Fungsi dekripsi field
CREATE OR REPLACE FUNCTION decrypt_field(data BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF data IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(
    data,
    current_setting('app.encryption_key')
  );
END;
$$;

-- Fungsi hash untuk lookup (one-way, tidak bisa didekripsi)
-- Digunakan untuk NIS agar bisa di-query tanpa dekripsi
CREATE OR REPLACE FUNCTION hash_identifier(data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN encode(sha256(data::bytea), 'hex');
END;
$$;
```

## 2.2 Struktur Tabel dengan Enkripsi

```sql
-- ============================================================
-- TABEL SANTRI — Dengan enkripsi field-level
-- ============================================================
CREATE TABLE IF NOT EXISTS santri (
  -- Identitas sistem (tidak sensitif)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesantren_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Identifier untuk query (HASH, bukan plaintext)
  nis_hash TEXT,                    -- hash dari NIS untuk lookup cepat
  kelas VARCHAR(20),                -- tidak sensitif
  angkatan VARCHAR(10),             -- tidak sensitif
  status_aktif VARCHAR(20),         -- tidak sensitif
  program VARCHAR(100),             -- tidak sensitif (Tahfidz/Kitab/Formal)
  status_mukim VARCHAR(20),         -- tidak sensitif

  -- Data sensitif — SEMUA BYTEA (terenkripsi)
  nama_lengkap_enc BYTEA,           -- 🟡 terenkripsi
  nis_enc BYTEA,                    -- 🟢 terenkripsi (NIS internal)
  nik_enc BYTEA,                    -- 🔴 terenkripsi
  tempat_lahir_enc BYTEA,           -- 🟡 terenkripsi
  tanggal_lahir_enc BYTEA,          -- 🟡 terenkripsi
  jenis_kelamin VARCHAR(1),         -- tidak sensitif (L/P)
  agama VARCHAR(20),                -- tidak sensitif
  alamat_enc BYTEA,                 -- 🟡 terenkripsi
  rt VARCHAR(5),                    -- boleh plain
  rw VARCHAR(5),                    -- boleh plain
  kelurahan VARCHAR(100),           -- boleh plain
  kecamatan VARCHAR(100),           -- boleh plain
  kab_kota VARCHAR(100),            -- boleh plain
  provinsi VARCHAR(100),            -- boleh plain
  kode_pos VARCHAR(10),             -- boleh plain
  no_hp_enc BYTEA,                  -- 🟡 terenkripsi

  -- Data orang tua — SEMUA terenkripsi
  nama_ayah_enc BYTEA,              -- 🟡 terenkripsi
  nik_ayah_enc BYTEA,               -- 🔴 terenkripsi
  pekerjaan_ayah VARCHAR(50),       -- boleh plain
  penghasilan_ayah VARCHAR(50),     -- boleh plain (kategori saja)
  nama_ibu_enc BYTEA,               -- 🟡 terenkripsi
  nik_ibu_enc BYTEA,                -- 🔴 terenkripsi
  pekerjaan_ibu VARCHAR(50),        -- boleh plain
  nama_wali_enc BYTEA,              -- 🟡 terenkripsi
  nik_wali_enc BYTEA,               -- 🔴 terenkripsi
  status_ortu VARCHAR(30),          -- boleh plain

  -- EMIS/Dapodik fields (belum diimplementasikan — lihat catatan)
  -- ⚠️ CATATAN AGENT: Field berikut belum ada di database
  -- Tambahkan sesuai dokumen REFERENSI_FORMAT_EMIS_DAPODIK.md
  -- WAJIB enkripsi field yang masuk kategori Merah/Kuning
  nsp VARCHAR(12),                              -- tidak sensitif
  nisn_hash TEXT,                               -- hash NISN untuk lookup
  nisn_enc BYTEA,                               -- 🟡 NISN terenkripsi
  status_pip BOOLEAN DEFAULT FALSE,             -- tidak sensitif
  no_kip_enc BYTEA,                             -- 🟡 terenkripsi
  anak_ke INTEGER,                              -- tidak sensitif
  jml_saudara INTEGER,                          -- tidak sensitif
  jenis_kebutuhan_khusus VARCHAR(50),           -- tidak sensitif
  pekerjaan_ayah_kode VARCHAR(5),               -- kode Dapodik, tidak sensitif
  penghasilan_ayah_kode VARCHAR(5),             -- kode Dapodik, tidak sensitif
  pendidikan_ayah_kode VARCHAR(5),              -- kode Dapodik, tidak sensitif
  pekerjaan_ibu_kode VARCHAR(5),                -- kode Dapodik, tidak sensitif
  penghasilan_ibu_kode VARCHAR(5),              -- kode Dapodik, tidak sensitif
  pendidikan_ibu_kode VARCHAR(5),               -- kode Dapodik, tidak sensitif
  tahun_masuk YEAR,                             -- tidak sensitif
  status_santri VARCHAR(30)                     -- tidak sensitif
);

-- ============================================================
-- TABEL KEUANGAN — Dengan enkripsi
-- ============================================================
CREATE TABLE IF NOT EXISTS tagihan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id UUID REFERENCES santri(id),
  pesantren_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id),

  -- Metadata tidak sensitif
  jenis_tagihan VARCHAR(100),       -- tidak sensitif
  tanggal_tagihan DATE,             -- tidak sensitif
  tanggal_jatuh_tempo DATE,         -- tidak sensitif
  status_lunas BOOLEAN DEFAULT FALSE, -- tidak sensitif
  bulan VARCHAR(20),                -- tidak sensitif
  tahun INTEGER,                    -- tidak sensitif

  -- Data sensitif — terenkripsi
  nominal_enc BYTEA,                -- 🟡 nominal tagihan terenkripsi
  nominal_terbayar_enc BYTEA,       -- 🟡 terenkripsi
  catatan_enc BYTEA,                -- 🟡 catatan terenkripsi
  metode_bayar VARCHAR(50),         -- boleh plain

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL PEGAWAI — Dengan enkripsi
-- ============================================================
CREATE TABLE IF NOT EXISTS pegawai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesantren_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),

  -- Tidak sensitif
  jabatan VARCHAR(100),
  status_kepegawaian VARCHAR(50),
  jenis_kelamin VARCHAR(1),
  agama VARCHAR(20),
  status_aktif BOOLEAN DEFAULT TRUE,

  -- EMIS/Dapodik fields belum diimplementasikan:
  -- ⚠️ CATATAN AGENT: Tambahkan sesuai dokumen REFERENSI_FORMAT_EMIS_DAPODIK.md
  status_sertifikasi VARCHAR(20),   -- tidak sensitif
  jam_mengajar INTEGER,             -- tidak sensitif
  mapel_diampu VARCHAR(255),        -- tidak sensitif

  -- Terenkripsi
  nama_lengkap_enc BYTEA,           -- 🟡
  nik_enc BYTEA,                    -- 🔴
  nuptk_enc BYTEA,                  -- 🔴
  nip_enc BYTEA,                    -- 🔴
  no_sertifikasi_enc BYTEA,         -- 🟡
  tanggal_lahir_enc BYTEA,          -- 🟡
  alamat_enc BYTEA,                 -- 🟡
  no_hp_enc BYTEA,                  -- 🟡
  no_rekening_enc BYTEA,            -- 🔴
  gaji_pokok_enc BYTEA,             -- 🟡
  jurusan_pendidikan_enc BYTEA,     -- 🟡
  universitas_enc BYTEA,            -- 🟡

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL PUBLIC KEYS (untuk E2EE Chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_public_keys (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  public_key TEXT NOT NULL,         -- boleh plain (ini memang publik)
  key_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL PESAN E2EE (Chat Alumni)
-- ============================================================
CREATE TABLE IF NOT EXISTS encrypted_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID REFERENCES auth.users(id),

  -- HANYA ciphertext — tidak ada plaintext
  ciphertext_for_recipient TEXT NOT NULL,
  ciphertext_for_sender TEXT NOT NULL,

  -- Metadata boleh plain
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  message_type VARCHAR(20) DEFAULT 'text',
  is_deleted BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- TABEL PERCAKAPAN
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one UUID REFERENCES auth.users(id),
  participant_two UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_one, participant_two)
);
```

## 2.3 Views untuk Dekripsi (Hanya di Server)

```sql
-- View ini HANYA diakses via edge function dengan service role
-- TIDAK boleh diekspos ke client langsung
CREATE OR REPLACE VIEW santri_decrypted AS
SELECT
  id,
  pesantren_id,
  kelas,
  angkatan,
  status_aktif,
  program,
  jenis_kelamin,
  kab_kota,
  provinsi,
  -- Dekripsi field sensitif
  decrypt_field(nama_lengkap_enc) as nama_lengkap,
  decrypt_field(tempat_lahir_enc) as tempat_lahir,
  decrypt_field(tanggal_lahir_enc) as tanggal_lahir,
  decrypt_field(nik_enc) as nik,
  decrypt_field(alamat_enc) as alamat,
  decrypt_field(no_hp_enc) as no_hp,
  decrypt_field(nama_ayah_enc) as nama_ayah,
  decrypt_field(nama_ibu_enc) as nama_ibu
FROM santri;

-- Revoke akses publik ke view ini
REVOKE ALL ON santri_decrypted FROM anon, authenticated;
GRANT SELECT ON santri_decrypted TO service_role;
```

## 2.4 RLS Policies — WAJIB di Semua Tabel

```sql
-- ============================================================
-- AKTIFKAN RLS — WAJIB untuk semua tabel sensitif
-- ============================================================
ALTER TABLE santri ENABLE ROW LEVEL SECURITY;
ALTER TABLE tagihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE pegawai ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_public_keys ENABLE ROW LEVEL SECURITY;

-- Santri: admin pesantren bisa akses santri di pesantrennya
CREATE POLICY "santri_admin_access" ON santri
  FOR ALL TO authenticated
  USING (
    pesantren_id IN (
      SELECT pesantren_id FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'operator')
    )
  );

-- Wali hanya bisa akses data anaknya sendiri
CREATE POLICY "santri_wali_access" ON santri
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT santri_id FROM relasi_wali_santri
      WHERE wali_user_id = auth.uid()
    )
  );

-- Pesan: hanya peserta percakapan yang bisa akses
CREATE POLICY "messages_participant_only" ON encrypted_messages
  FOR ALL TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_one = auth.uid()
      OR participant_two = auth.uid()
    )
  );

-- Public keys: semua authenticated bisa baca, hanya owner yang bisa tulis
CREATE POLICY "public_keys_read" ON user_public_keys
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "public_keys_write_own" ON user_public_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "public_keys_update_own" ON user_public_keys
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
```

## 2.5 Audit Log — WAJIB untuk Semua Aksi Sensitif

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,         -- INSERT, UPDATE, DELETE, SELECT_SENSITIVE
  actor_id UUID,                   -- siapa yang melakukan
  actor_role TEXT,                 -- role aktor
  record_id UUID,                  -- ID record yang diakses
  pesantren_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',     -- info tambahan (tidak boleh isi field sensitif)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log tidak boleh diubah atau dihapus oleh siapapun
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_insert_only" ON audit_logs
  FOR INSERT TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "audit_logs_admin_read" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Tidak ada UPDATE atau DELETE policy — audit log immutable
```

---

# BAB 3 — PROTOKOL EDGE FUNCTIONS

## 3.1 Aturan Wajib untuk Semua Edge Functions

```typescript
/**
 * TEMPLATE STANDAR EDGE FUNCTION
 * Semua edge function WAJIB mengikuti struktur ini
 */

// ✅ WAJIB: Import dari environment variable, bukan hardcode
const ENCRYPTION_KEY = Deno.env.get('FIELD_ENCRYPTION_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ✅ WAJIB: Validasi semua input sebelum proses
function validateAndSanitize(input: any): { valid: boolean; error?: string } {
  // Cek tipe data
  // Cek panjang maksimal
  // Sanitasi karakter berbahaya
  // Return false jika tidak valid
}

// ✅ WAJIB: Sanitasi data sebelum kirim ke AI API
const AI_FORBIDDEN_FIELDS = [
  'nik', 'nik_enc', 'nik_ayah', 'nik_ibu', 'nik_wali',
  'no_kk', 'no_rekening', 'no_hp', 'alamat_lengkap',
  'tanggal_lahir', 'nama_lengkap', 'password', 'token',
  'gaji_pokok', 'nominal'
];

function sanitizeForAI(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data };
  for (const field of AI_FORBIDDEN_FIELDS) {
    delete sanitized[field];
    delete sanitized[`${field}_enc`];
  }
  return sanitized;
}

// ✅ WAJIB: Jangan expose error internal ke client
function safeError(message: string, statusCode: number = 400) {
  // Log detail error di server
  console.error(`[INTERNAL] ${message}`);
  // Return pesan generik ke client
  return new Response(
    JSON.stringify({ error: 'Terjadi kesalahan. Silakan coba lagi.' }),
    { status: statusCode, headers: { 'Content-Type': 'application/json' } }
  );
}

// ✅ WAJIB: Catat ke audit log
async function logAudit(supabase: any, params: {
  table_name: string;
  operation: string;
  actor_id?: string;
  record_id?: string;
  metadata?: object;
}) {
  await supabase.from('audit_logs').insert({
    ...params,
    created_at: new Date().toISOString()
  });
}
```

## 3.2 Cara Enkripsi/Dekripsi di Edge Functions

```typescript
// ✅ CARA BENAR: Enkripsi via PostgreSQL function (bukan di TypeScript)
// Lebih aman karena key tidak pernah meninggalkan database environment

async function insertSantriWithEncryption(supabase: any, data: SantriInput) {
  // Gunakan fungsi encrypt_field() yang sudah dibuat di PostgreSQL
  const { data: result, error } = await supabase.rpc('insert_santri_encrypted', {
    p_pesantren_id: data.pesantren_id,
    p_nama: data.nama_lengkap,           // akan dienkripsi oleh fungsi SQL
    p_nik: data.nik,                      // akan dienkripsi oleh fungsi SQL
    p_kelas: data.kelas,                  // tidak dienkripsi
    p_status: data.status_aktif           // tidak dienkripsi
  });

  if (error) throw error;
  return result;
}

// Fungsi SQL yang dipanggil (buat di Supabase):
/*
CREATE OR REPLACE FUNCTION insert_santri_encrypted(
  p_pesantren_id UUID,
  p_nama TEXT,
  p_nik TEXT,
  p_kelas TEXT,
  p_status TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO santri (
    pesantren_id, kelas, status_aktif,
    nama_lengkap_enc, nik_enc
  ) VALUES (
    p_pesantren_id, p_kelas, p_status,
    encrypt_field(p_nama), encrypt_field(p_nik)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
*/
```

## 3.3 Rate Limiting — Wajib untuk Semua Endpoint Publik

```typescript
// Rate limiting menggunakan tabel counter di Supabase
async function checkRateLimit(
  supabase: any,
  identifier: string,         // IP atau user_id
  endpoint: string,
  maxRequests: number,        // maksimal request
  windowSeconds: number       // dalam berapa detik
): Promise<boolean> {

  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact' })
    .eq('identifier', identifier)
    .eq('endpoint', endpoint)
    .gte('created_at', windowStart);

  if (count >= maxRequests) {
    return false; // Rate limit exceeded
  }

  // Log request ini
  await supabase.from('rate_limit_log').insert({
    identifier,
    endpoint,
    created_at: new Date().toISOString()
  });

  return true;
}

// Konfigurasi rate limit per endpoint:
const RATE_LIMITS = {
  'rag-query-public':  { max: 20,  window: 60 },   // 20/menit untuk publik
  'rag-query-wali':    { max: 60,  window: 60 },   // 60/menit untuk wali
  'rag-query-admin':   { max: 100, window: 60 },   // 100/menit untuk admin
  'ai-agent':          { max: 30,  window: 60 },   // 30/menit untuk AI agent
  'telegram-webhook':  { max: 50,  window: 60 },   // 50/menit untuk bot
};
```

---

# BAB 4 — PROTOKOL E2EE (ANDROID KOTLIN)

## 4.1 Aturan Absolut E2EE

```
ATURAN YANG TIDAK BOLEH DILANGGAR:

1. Private key TIDAK PERNAH dikirim ke server (bahkan dalam bentuk terenkripsi)
2. Private key HARUS disimpan di Android Keystore (hardware-backed)
3. Dekripsi pesan HANYA terjadi di device, TIDAK di server
4. Server TIDAK PERNAH melihat plaintext pesan
5. Tidak ada "master key" yang bisa mendekripsi semua pesan
6. Tidak ada "admin decrypt" — ini by design, bukan bug
7. Log tidak boleh berisi plaintext pesan, bahkan sebagian
```

## 4.2 Implementasi Android Keystore

```kotlin
// FILE: security/E2EKeyManager.kt
// JANGAN MODIFIKASI logika key generation tanpa review security

package com.alhasanah.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey

object E2EKeyManager {

    private const val KEY_ALIAS = "al_hasanah_e2e_v1"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"

    /**
     * ✅ AMAN: Private key dibuat dan disimpan di Android Keystore
     * ❌ TIDAK BISA diekspor — ini yang memastikan keamanan E2EE
     */
    fun ensureKeyPairExists() {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            generateNewKeyPair()
        }
    }

    private fun generateNewKeyPair() {
        val keyPairGenerator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            KEYSTORE_PROVIDER
        )
        keyPairGenerator.initialize(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_AGREE_KEY
            )
            .setAlgorithmParameterSpec(
                java.security.spec.ECGenParameterSpec("secp256r1")
            )
            .setUserAuthenticationRequired(false)
            .setInvalidatedByBiometricEnrollment(false)
            .build()
        )
        keyPairGenerator.generateKeyPair()
    }

    /**
     * ✅ AMAN untuk upload ke server — public key memang harus publik
     */
    fun getPublicKeyBase64(): String {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        val publicKey = keyStore.getCertificate(KEY_ALIAS).publicKey
        return Base64.encodeToString(publicKey.encoded, Base64.NO_WRAP)
    }

    /**
     * Hanya digunakan internal untuk ECDH — tidak pernah diekspor
     */
    internal fun getPrivateKey(): PrivateKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        return keyStore.getKey(KEY_ALIAS, null) as PrivateKey
    }

    /**
     * Hapus keypair (misal saat logout permanen)
     * ⚠️ Semua pesan lama tidak akan bisa didekripsi setelah ini
     */
    fun deleteKeyPair() {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        keyStore.deleteEntry(KEY_ALIAS)
    }
}
```

## 4.3 Implementasi Enkripsi Pesan

```kotlin
// FILE: security/MessageCrypto.kt
// JANGAN MODIFIKASI algoritma enkripsi tanpa review security

package com.alhasanah.security

import android.util.Base64
import java.security.KeyFactory
import java.security.KeyAgreement
import java.security.MessageDigest
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import java.security.SecureRandom

object MessageCrypto {

    private const val ALGORITHM = "AES/GCM/NoPadding"
    private const val TAG_LENGTH_BIT = 128
    private const val IV_LENGTH_BYTE = 12

    /**
     * Enkripsi pesan untuk dikirim ke penerima
     * Algoritma: ECDH + SHA-256 key derivation + AES-256-GCM
     *
     * @param plaintext Pesan asli (TIDAK PERNAH simpan ini ke database)
     * @param recipientPublicKeyBase64 Public key penerima dari server
     * @return Ciphertext dalam format Base64 (aman disimpan ke server)
     */
    fun encryptForRecipient(plaintext: String, recipientPublicKeyBase64: String): String {
        val recipientPublicKey = decodePublicKey(recipientPublicKeyBase64)
        val sharedSecret = performECDH(recipientPublicKey)
        val encryptionKey = deriveKey(sharedSecret)
        return encryptAES(plaintext, encryptionKey)
    }

    /**
     * Enkripsi pesan untuk disimpan sebagai "sent message"
     * (agar pengirim bisa baca histori di device sendiri)
     *
     * @param plaintext Pesan asli
     * @param senderPublicKeyBase64 Public key pengirim sendiri (dari server)
     */
    fun encryptForSelf(plaintext: String, senderPublicKeyBase64: String): String {
        // Enkripsi dengan public key sendiri — bisa didekripsi oleh private key sendiri
        return encryptForRecipient(plaintext, senderPublicKeyBase64)
    }

    /**
     * Dekripsi pesan yang diterima
     *
     * @param ciphertextBase64 Ciphertext dari server
     * @param senderPublicKeyBase64 Public key pengirim (untuk ECDH)
     * @return Plaintext pesan (TIDAK PERNAH simpan ke database atau log)
     */
    fun decrypt(ciphertextBase64: String, senderPublicKeyBase64: String): String {
        val senderPublicKey = decodePublicKey(senderPublicKeyBase64)
        val sharedSecret = performECDH(senderPublicKey)
        val encryptionKey = deriveKey(sharedSecret)
        return decryptAES(ciphertextBase64, encryptionKey)
    }

    private fun performECDH(otherPartyPublicKey: java.security.PublicKey): ByteArray {
        val myPrivateKey = E2EKeyManager.getPrivateKey()
        val keyAgreement = KeyAgreement.getInstance("ECDH")
        keyAgreement.init(myPrivateKey)
        keyAgreement.doPhase(otherPartyPublicKey, true)
        return keyAgreement.generateSecret()
    }

    private fun deriveKey(sharedSecret: ByteArray): SecretKeySpec {
        // SHA-256 key derivation
        // Untuk produksi level tinggi: gunakan HKDF
        val digest = MessageDigest.getInstance("SHA-256")
        val keyBytes = digest.digest(sharedSecret)
        return SecretKeySpec(keyBytes, "AES")
    }

    private fun encryptAES(plaintext: String, key: SecretKeySpec): String {
        val iv = ByteArray(IV_LENGTH_BYTE).also { SecureRandom().nextBytes(it) }
        val cipher = Cipher.getInstance(ALGORITHM)
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_LENGTH_BIT, iv))
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        // Format: IV (12 bytes) + Ciphertext
        val combined = iv + ciphertext
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    private fun decryptAES(ciphertextBase64: String, key: SecretKeySpec): String {
        val combined = Base64.decode(ciphertextBase64, Base64.NO_WRAP)
        val iv = combined.sliceArray(0 until IV_LENGTH_BYTE)
        val ciphertext = combined.sliceArray(IV_LENGTH_BYTE until combined.size)
        val cipher = Cipher.getInstance(ALGORITHM)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_LENGTH_BIT, iv))
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }

    private fun decodePublicKey(base64: String): java.security.PublicKey {
        val bytes = Base64.decode(base64, Base64.NO_WRAP)
        val keySpec = X509EncodedKeySpec(bytes)
        return KeyFactory.getInstance("EC").generatePublic(keySpec)
    }
}
```

## 4.4 Alur Lengkap Chat di Kotlin

```kotlin
// FILE: feature/chat/ChatRepository.kt

class ChatRepository(
    private val supabase: SupabaseClient
) {

    /**
     * Inisialisasi E2EE saat pertama login
     * Dipanggil sekali saat user login pertama kali
     */
    suspend fun initializeE2EE(userId: String) {
        // 1. Pastikan keypair sudah ada di Android Keystore
        E2EKeyManager.ensureKeyPairExists()

        // 2. Upload public key ke Supabase
        val publicKey = E2EKeyManager.getPublicKeyBase64()
        supabase.from("user_public_keys").upsert(
            mapOf("user_id" to userId, "public_key" to publicKey)
        )
    }

    /**
     * Kirim pesan terenkripsi
     * ⚠️ plaintext TIDAK PERNAH disimpan ke database
     */
    suspend fun sendMessage(
        conversationId: String,
        senderId: String,
        recipientId: String,
        plaintext: String  // ⚠️ Variabel ini hanya hidup di memory
    ) {
        // 1. Ambil public keys
        val recipientPublicKey = getPublicKey(recipientId)
        val senderPublicKey = getPublicKey(senderId)

        // 2. Enkripsi — plaintext tidak pernah ke server
        val cipherForRecipient = MessageCrypto.encryptForRecipient(plaintext, recipientPublicKey)
        val cipherForSender = MessageCrypto.encryptForSelf(plaintext, senderPublicKey)

        // 3. Simpan hanya ciphertext
        supabase.from("encrypted_messages").insert(mapOf(
            "conversation_id" to conversationId,
            "sender_id" to senderId,
            "ciphertext_for_recipient" to cipherForRecipient,
            "ciphertext_for_sender" to cipherForSender,
            "message_type" to "text"
        ))

        // ⚠️ plaintext di-GC setelah fungsi ini selesai — tidak ada di database
    }

    /**
     * Ambil dan dekripsi pesan
     * Dekripsi terjadi di device — server tidak terlibat
     */
    suspend fun getMessages(
        conversationId: String,
        currentUserId: String
    ): List<DecryptedMessage> {

        val rawMessages = supabase.from("encrypted_messages")
            .select()
            .eq("conversation_id", conversationId)
            .order("sent_at")
            .decodeList<EncryptedMessage>()

        return rawMessages.map { msg ->
            val senderPublicKey = getPublicKey(msg.senderId)

            // Pilih ciphertext yang sesuai
            val ciphertext = if (msg.senderId == currentUserId) {
                msg.ciphertextForSender    // baca sent message
            } else {
                msg.ciphertextForRecipient // baca received message
            }

            // Dekripsi di device
            val decryptedText = try {
                MessageCrypto.decrypt(ciphertext, senderPublicKey)
            } catch (e: Exception) {
                "[Pesan tidak dapat didekripsi]"
            }

            DecryptedMessage(
                id = msg.id,
                senderId = msg.senderId,
                text = decryptedText,  // hanya ada di memory
                sentAt = msg.sentAt,
                isRead = msg.isRead
            )
        }
    }

    private suspend fun getPublicKey(userId: String): String {
        return supabase.from("user_public_keys")
            .select()
            .eq("user_id", userId)
            .decodeSingle<UserPublicKey>()
            .publicKey
    }
}
```

---

# BAB 5 — PROTOKOL ADMIN PANEL (REACT)

## 5.1 Aturan Menampilkan Data Sensitif

```typescript
// FILE: utils/sensitiveData.ts
// WAJIB digunakan setiap kali menampilkan data yang termasuk Level Merah/Kuning

/**
 * Masking data sensitif untuk tampilan
 * Gunakan ini saat menampilkan NIK, tanggal lahir, no HP di tabel
 */
export function maskSensitive(value: string, type: 'nik' | 'phone' | 'name' | 'account'): string {
  if (!value) return '-';

  switch (type) {
    case 'nik':
      // Tampilkan 4 digit pertama dan 4 terakhir saja
      return value.replace(/^(\d{4})\d{8}(\d{4})$/, '$1********$2');
    case 'phone':
      return value.replace(/^(\d{4})\d+(\d{3})$/, '$1****$2');
    case 'name':
      // Tampilkan huruf pertama setiap kata
      return value.split(' ').map(w => w[0] + '*'.repeat(w.length - 1)).join(' ');
    case 'account':
      return '*'.repeat(value.length - 4) + value.slice(-4);
    default:
      return '****';
  }
}

/**
 * Akses data lengkap hanya boleh dengan konfirmasi + log audit
 * Panggil ini sebelum menampilkan data sensitif penuh
 */
export async function requestSensitiveAccess(
  reason: string,
  recordId: string
): Promise<boolean> {
  // Log ke audit trail bahwa admin meminta akses data sensitif
  await logAuditAction({
    action: 'SENSITIVE_DATA_ACCESS_REQUESTED',
    reason,
    record_id: recordId,
    timestamp: new Date().toISOString()
  });

  // Tampilkan konfirmasi ke admin
  return window.confirm(
    `Anda akan mengakses data sensitif.\nAlasan: ${reason}\nAksi ini tercatat di audit log.`
  );
}
```

## 5.2 Aturan Form Input Data Sensitif

```typescript
// Semua form yang mengandung field Level Merah WAJIB:
// 1. Tidak menyimpan nilai ke localStorage atau sessionStorage
// 2. Tidak log nilai ke console
// 3. Submit via HTTPS ke edge function (bukan langsung ke Supabase client)
// 4. Validasi format sebelum submit

// Contoh validasi NIK:
function validateNIK(nik: string): boolean {
  const NIK_REGEX = /^\d{16}$/;
  if (!NIK_REGEX.test(nik)) return false;

  // Validasi struktur NIK Indonesia:
  // 6 digit pertama = kode wilayah
  // 6 digit berikutnya = tanggal lahir (perempuan +40)
  // 4 digit terakhir = nomor urut
  const provinsiCode = parseInt(nik.substring(0, 2));
  if (provinsiCode < 11 || provinsiCode > 94) return false;

  return true;
}

// DILARANG: console.log(formData) — bisa expose NIK ke developer tools
// DILARANG: localStorage.setItem('draft', JSON.stringify(formData))
// DILARANG: kirim NIK ke AI API
```

## 5.3 Variabel Environment yang Diperlukan

```env
# File ini TIDAK BOLEH di-commit ke repository
# WAJIB ada di .gitignore

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # RAHASIA - jangan expose ke frontend

# Enkripsi Field (harus 32 karakter minimum, random, rahasia)
FIELD_ENCRYPTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# AI API
AI_API_KEY=sk-xxx...
AI_MODEL=claude-sonnet-4-20250514

# RAG Config
RAG_MATCH_THRESHOLD=0.70
RAG_MAX_CHUNKS=5

# Telegram Bot
TELEGRAM_BOT_TOKEN=xxxxx:xxxxxxx
TELEGRAM_WEBHOOK_SECRET=xxxxx

# WhatsApp (jika sudah aktif)
WHATSAPP_TOKEN=xxxxx
WHATSAPP_PHONE_ID=xxxxx
```

---

# BAB 6 — CHECKLIST WAJIB AGENT SEBELUM SUBMIT

Sebelum agent CLI menyelesaikan tugasnya, WAJIB menjawab semua pertanyaan ini:

```
CHECKLIST KEAMANAN — HARUS SEMUA ✅

DATABASE:
[ ] Apakah semua tabel baru sudah mengaktifkan RLS?
[ ] Apakah field Level Merah sudah menggunakan kolom _enc (BYTEA)?
[ ] Apakah field Level Kuning sudah menggunakan kolom _enc (BYTEA)?
[ ] Apakah ada NIK atau data sensitif yang disimpan plaintext? (harus TIDAK)
[ ] Apakah tabel audit_logs sudah mencatat aksi yang relevan?

EDGE FUNCTIONS:
[ ] Apakah ada hardcoded key atau secret di kode? (harus TIDAK)
[ ] Apakah semua input sudah divalidasi?
[ ] Apakah data sensitif sudah disanitasi sebelum ke AI API?
[ ] Apakah error messages tidak mengekspos info internal?
[ ] Apakah rate limiting sudah diterapkan untuk endpoint publik?

ANDROID (KOTLIN):
[ ] Apakah private key tersimpan di Android Keystore? (bukan SharedPreferences)
[ ] Apakah plaintext pesan pernah dikirim ke server? (harus TIDAK)
[ ] Apakah ada log yang berisi plaintext pesan? (harus TIDAK)
[ ] Apakah dekripsi terjadi di device, bukan di server? (harus YA)

ADMIN PANEL (REACT):
[ ] Apakah data sensitif ditampilkan dengan masking by default?
[ ] Apakah ada console.log yang berisi data sensitif? (harus TIDAK)
[ ] Apakah SERVICE_ROLE_KEY digunakan di frontend? (harus TIDAK)
[ ] Apakah form sensitif menyimpan ke localStorage? (harus TIDAK)

EMIS/DAPODIK (belum diimplementasikan):
[ ] Apakah field baru yang ditambahkan sudah mengikuti klasifikasi Level Merah/Kuning/Hijau?
[ ] Apakah field Level Merah/Kuning sudah dienkripsi?
[ ] Apakah sudah sesuai dokumen REFERENSI_FORMAT_EMIS_DAPODIK.md?
```

---

# BAB 7 — REFERENSI DOKUMEN TERKAIT

Agent CLI wajib membaca dokumen berikut yang relevan dengan tugasnya:

| Dokumen | Relevan untuk |
|---------|--------------|
| `REFERENSI_FORMAT_EMIS_DAPODIK.md` | Saat menambah field untuk kompatibilitas EMIS/Dapodik |
| `RAG_IMPLEMENTATION_ALHASANAH.md` | Saat mengerjakan fitur RAG/AI chatbot |
| `SECURITY_PROTOCOL.md` (dokumen ini) | SELALU — wajib dibaca pertama |

---

# BAB 8 — KONTAK & ESKALASI

Jika agent CLI menemukan kondisi berikut, HENTIKAN pekerjaan dan laporkan:

```
🛑 HENTIKAN DAN LAPORKAN jika:

1. Ditemukan NIK atau data sensitif tersimpan plaintext di kolom non-_enc
2. Ditemukan SERVICE_ROLE_KEY atau ENCRYPTION_KEY di source code
3. Ditemukan tabel tanpa RLS
4. Ditemukan private key dikirim ke server
5. Ditemukan plaintext pesan di log atau database
6. Ditemukan kolom sensitif baru yang tidak mengikuti protokol ini
7. Ditemukan endpoint tanpa autentikasi yang seharusnya ter-proteksi
```

> ⚠️ Dokumen ini harus diperbarui setiap kali ada perubahan arsitektur sistem.
> Versi dokumen wajib dinaikkan dan perubahan dicatat.
