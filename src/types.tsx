export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --- ENUMS (Sesuai Database) ---
export type TipeGender = 'L' | 'P';
export type TipeKelas = '1' | '2' | '3';
export type TipeJurusan = 'KITAB' | 'TAHFIDZ';
export type StatusSantri = 'AKTIF' | 'LULUS' | 'KELUAR' | 'ALUMNI';
export type StatusTagihan = 'LUNAS' | 'BELUM' | 'CICILAN';
export type StatusTransaksi = 'pending' | 'success' | 'failed' | 'expire' | 'cancel' | 'settlement' | 'deny';
export type JenisTransaksi = 'masuk' | 'keluar';

// --- SCOPES ---
export type TGenderScope = 'L' | 'P' | 'ALL';
export type TJurusanScope = 'KITAB' | 'TAHFIDZ' | 'ALL';

// Role sesuai request (huruf kecil)
export type TRole = 'super_admin' | 'rois' | 'bendahara' | 'kesantrian' | 'dewan' | 'alumni' | 'wali' | 'kantin';

// --- INTERFACES ---

export interface IProfile {
    id: string;
    email: string;
    role: TRole; // super_admin, bendahara, dll
    full_name: string;
    is_active: boolean;
    foto_url?: string;
    no_hp?: string;
    akses_gender: TGenderScope;
    akses_jurusan: TJurusanScope;
}

export interface IAlumniData {
    id: string; // UUID from profiles
    full_name: string;
    tahun_lulus: number;
    no_wa: string;
    profesi_sekarang: string;
    instansi_kerja: string;
    alamat_domisili: string;
    bio?: string | null;
    avatar_storage_path?: string | null;
    show_whatsapp?: boolean;
    show_profession?: boolean;
    show_location?: boolean;
    forum_notify_replies?: boolean;
    forum_notify_reactions?: boolean;
    province_name?: string | null;
    regency_name?: string | null;
    district_name?: string | null;
    village_name?: string | null;
    address_detail?: string | null;
    created_at: string;
    profiles?: IProfile; // Join to check is_active status
}

export interface IUserIdentity {
    id: string;
    name: string;
    avatar?: string;
    role: TRole;
    scopeGender: TGenderScope;
    scopeJurusan: TJurusanScope;
}

export type RagSourceType = 'public' | 'kitab' | 'internal';
export type RagDocumentStatus = 'draft' | 'active' | 'archived';
export type RagDocumentType = 'general' | 'kitab' | 'report' | 'policy' | 'sop' | 'faq';

export interface IRagDocument {
    id: string;
    title: string;
    source_type: RagSourceType;
    document_type: RagDocumentType;
    status: RagDocumentStatus;
    content_preview?: string | null;
    metadata: Json;
    created_by?: string | null;
    chunk_count: number;
    embedding_model?: string | null;
    embedding_dimension: number;
    created_at: string;
    updated_at: string;
}

export interface IRagQueryLog {
    id: string;
    session_id?: string | null;
    query_text: string;
    source_type?: 'public' | 'kitab' | 'internal' | 'mixed' | null;
    context_type?: 'public_chatbot' | 'wali_chatbot' | 'admin_decision' | 'kitab_chatbot' | 'ingest_test' | null;
    retrieved_chunk_ids?: string[] | null;
    response_preview?: string | null;
    latency_ms?: number | null;
    metadata: Json;
    created_at: string;
}

// --- INSTANSI & STRUKTUR KEPENGURUSAN ---
export interface IInstansiInfo {
    id: number;
    nama_instansi: string;
    alamat: string;
    logo_url: string;
    no_telp: number;
    email: string;
    kepala_pesantren: string;
    tahun_ajaran_aktif: string;
}

export interface IStrukturOrganisasi {
    id: number;
    parent_id: number | null;
    jabatan: string;
    nama_pejabat: string;
    nip_niy: string;
    foto_url: string;
    warna_kartu: string;
    urutan: number;
    children?: IStrukturOrganisasi[]; // Untuk keperluan rendering tree
}

export interface ISantri {
  nis: string; // PK
  wali_id: string | null; // FK to profiles
  nama: string;
  nik: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string; // Date string YYYY-MM-DD
  jenis_kelamin: TipeGender;
  kelas: TipeKelas;
  jurusan: TipeJurusan;
  status_santri: StatusSantri;
  foto_url: string | null;
  ayah: string | null;
  ibu: string | null;
  no_kontak_wali: string | null;
  alamat_lengkap: string | null;
  anak_ke: number | null;
  hafalan_kitab : string | null;
  total_hafalan : number | null; // in Juz
  pembimbing: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  kecamatan_id?: string | null;
}
// --- CONTENT MANAGEMENT SYSTEM (CMS) ---
export interface IBerita {
    id: number;
    created_at: string;
    judul: string;
    slug: string;
    ringkasan: string;
    konten: string;
    kategori: 'PENGUMUMAN' | 'KEGIATAN' | 'PRESTASI' | 'KAJIAN';
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    thumbnail_url: string;
    is_featured: boolean;
    tanggal_publish: string;
}

// --- AKADEMIK & KESISWAAN ---

// ... interface lainnya

export interface IHafalanTahfidz {
  id: number;
  created_at: string;
  santri_nis: string;
  santri?: ISantri; // Join
  tanggal: string;
  surat: string;
  ayat_awal: number;
  ayat_akhir: number;
  juz?: number;
  status: string; // 'LANCAR', 'ULANG', 'LANJUT'
  predikat?: 'MUMTAZ' | 'JAYYID' | 'KURANG';
  catatan: string;
  dicatat_oleh_id: string;
  total_hafalan?: number; // Snapshot total hafalan saat itu
}

export const NAMA_KITAB_LIST = [
    "Jurumiah", 
    "Imrity", 
    "Nadzmul Maqshud", 
    "Alfiyah", 
    "Uqudul Juman", 
    "Sulam Munawraq"
] as const;

export interface IHafalanKitab {
    id: number;
    created_at: string;
    santri_nis: string;
    santri?: ISantri;
    tanggal: string;
    nama_kitab: typeof NAMA_KITAB_LIST[number];
    bab_materi: string;
    bait_awal?: number;
    bait_akhir?: number;
    halaman_awal?: number;
    halaman_akhir?: number;
    predikat: 'MUMTAZ' | 'JAYYID' | 'KURANG';
    status: 'LULUS' | 'MENGULANG';
    catatan: string;
    dicatat_oleh_id: string;
}

export interface IMurojaahTahfidz {
  id: number;
  created_at: string;
  santri_nis: string;
  santri?: ISantri;
  tanggal: string;
  jenis_murojaah: 'SABAQ' | 'MANZIL';
  juz: number;
  surat?: string;
  ayat_awal?: number;
  ayat_akhir?: number;
  halaman_awal?: number;
  halaman_akhir?: number;
  status: string;
  predikat: 'MUMTAZ' | 'JAYYID' | 'KURANG';
  catatan: string;
  dicatat_oleh_id: string;
}

export interface IPelanggaranSantri {
  id: number; // BigInt di DB = number di JS
  created_at: string;
  santri_nis: string;
  santri?: ISantri; // Untuk Join/Relation
  tanggal: string; // Date
  jenis_pelanggaran: string; // Text di DB (bisa kita batasi di UI)
  poin: number;
  hukuman: string;
  catatan: string;
  dicatat_oleh_id: string; // ID User Login
}

export interface IKesehatanSantri {
  id: number;
  created_at: string;
  santri_nis: string;
  santri?: ISantri;
  tanggal: string;
  keluhan: string;
  tindakan: string;
  catatan: string;
  dicatat_oleh_id: string;
}

export interface IPerizinanSantri {
  id: number;
  created_at: string;
  santri_nis: string;
  santri?: ISantri;
  tanggal: string;
  tanggal_kembali: string;
  jenis_izin: string;
  keterangan: string;
  status: string; // PENDING, APPROVED, etc
  dicatat_oleh_id: string;
}
// --- INVENTARIS ASSET ---
export interface ILokasiAset {
    id: number;
    nama_lokasi: string;
    penanggung_jawab: string;
}

export interface IKategoriBarang {
    id: number;
    nama_kategori: string;
    kode_prefix: string;
}

export interface IInventaris {
    id: number;
    created_at: string;
    kode_barang: string;
    nama_barang: string;
    merk: string;
    spesifikasi: string;
    
    kategori_id: number;
    kategori?: IKategoriBarang;
    lokasi_id: number;
    lokasi?: ILokasiAset;
    
    sumber_dana: 'YAYASAN' | 'BOS' | 'WAKAF' | 'HIBAH';
    tanggal_perolehan: string;
    harga_perolehan: number;
    
    jumlah: number;
    satuan: string;
    kondisi: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT' | 'HILANG';
    
    foto_url: string;
    keterangan: string;
    dicatat_oleh_id: string;
}

// --- KEUANGAN (FINANCE) ---

export interface IRefJenisPembayaran {
  id: number;
  nama_pembayaran: string; // SPP, Gedung, Seragam
  tipe: 'bulanan' | 'sekali_bayar' | 'tabungan' | 'bebas';
  nominal_default: number;
  is_aktif: boolean;
  created_at?: string;
}

export interface ITarifKhususSantri {
  id: string;
  santri_nis: string;
  jenis_pembayaran_id: number;
  nominal_khusus: number;
  periode_mulai?: string | null;
  periode_selesai?: string | null;
  is_aktif: boolean;
  keterangan?: string | null;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
  santri?: ISantri;
  ref_jenis_pembayaran?: IRefJenisPembayaran;
}

export interface ITagihanSantri {
  santri?: ISantri;
  id: string; // UUID
  santri_nis: string;
  jenis_pembayaran_id: number;
  deskripsi_tagihan: string;
  nominal_tagihan: number;
  sisa_tagihan: number;
  tanggal_jatuh_tempo: string;
  status: StatusTagihan; // 'LUNAS' | 'BELUM' | 'CICILAN'
  created_at: string;
  // midtrans_order_id SUDAH DIHAPUS sesuai request
}

// --- DIKLAT PASARAN ---
export interface IConfigDiklat {
    id: number;
    tahun_hijriah: number;
    uang_miftah: number;
    biaya_listrik: number;
    kos_makan: number;
    tafaruqon: number;
    uang_miftah_putri?: number | null;
    biaya_listrik_putri?: number | null;
    kos_makan_putri?: number | null;
    tafaruqon_putri?: number | null;
    is_active: boolean;
    created_at: string;
    periode: number;
}

export interface IMasterKitab {
    id: number;
    nama_kitab: string;
    harga: number;
    jenis_diklat: 'MAULID' | 'SYABAN' | 'RAMADHAN' | 'DZULHIJJAH';
    jenis_kelamin?: 'L' | 'P' | 'ALL';
    kategori?: 'KITAB' | 'PERLENGKAPAN' | 'BUKU';
    is_wajib?: boolean;
    is_active: boolean;
    ruang?: number | null;
}

export interface IPesertaDiklat {
    id: number;
    created_at: string;
    nama_lengkap: string;
    jenis_kelamin?: 'L' | 'P' | null;
    nama_wali: string;
    pekerjaan_wali: string;
    alamat_pesantren: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    alamat_lengkap: string;
    no_telepon: string;
    pesantren_asal: string;
    jenis_diklat: 'MAULID' | 'SYABAN' | 'RAMADHAN' | 'DZULHIJJAH';
    tahun_diklat: number;
    ruang?: number | null;
    biaya_pendaftaran: number;
    uang_miftah: number;
    biaya_listrik: number;
    kos_makan: number;
    tafaruqon: number;
    belanja_kitab_nominal: number;
    rincian_belanja: string;
    status_pembayaran: string;
    qr_code_id: string;
    dicatat_oleh: string;
}

// --- PENGELUARAN DANA ---
export interface IPengeluaran {
    id: number;
    created_at: string;
    judul: string;
    kategori: 'OPERASIONAL' | 'PEMBANGUNAN' | 'DAPUR' | 'KEGIATAN' | 'LAINNYA';
    nominal: number;
    tanggal_pengeluaran: string;
    keterangan: string;
    bukti_url: string;
    dicatat_oleh_id: string;
    dicatat_oleh_nama: string;
    scope_gender: TGenderScope;
    scope_jurusan: TJurusanScope;
}

export interface IAuditLog {
    id: number;
    created_at: string;
    user_id: string;
    user_name: string;
    user_role: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT';
    resource: string;
    record_id: string;
    details: Record<string, unknown>;
}

export interface IPrestasiSantri {
    id: number;
    created_at: string;
    santri_nis: string;
    santri?: ISantri;
    kategori: 'TAHFIDZ' | 'KITAB' | 'KHATAM' | 'AKADEMIK' | 'LOMBA' | 'AKHLAK' | 'OLAHRAGA' | 'SENI' | 'UMUM' | 'LAINNYA';
    judul_prestasi: string;
    keterangan: string | null;
    tanggal_prestasi: string;
    sertifikat_url?: string | null;
    poin_prestasi: number | null;
    dicatat_oleh_id: string | null;
}

export interface IMataPelajaran {
    id: number;
    nama_mapel: string;
    kategori: 'KITAB' | 'TAHFIDZ';
    kkm: number;
    aktif: boolean;
}

export interface INilaiSantri {
    id: number;
    santri_nis: string;
    mapel_id: number;
    semester: string;
    tahun_ajaran: string;
    nilai_angka: number;
    catatan_ustadz: string;
    dicatat_oleh: string;
    // Join
    santri?: ISantri;
    mata_pelajaran?: IMataPelajaran;
}

export interface ITransaksiKeuangan {
  id: string; // UUID
  wali_id: string | null;
  admin_pencatat_id: string | null;
  santri_nis: string | null;
  midtrans_order_id: string | null; // Unique Key
  midtrans_snap_token: string | null;
  jumlah: number;
  tanggal_transaksi: string;
  status_transaksi: string;
  status: StatusTransaksi;
  metode_pembayaran: string; // 'cash', 'bca', 'gopay'
  jenis_transaksi: JenisTransaksi;
  kategori?: string | null;
  scope_gender?: string | null;
  scope_jurusan?: string | null;
  keterangan: string | null;
  created_at: string;

  // Relations
  wali?: IProfile;
  admin?: IProfile;
  santri?: ISantri;
}

export interface IDetailTransaksi {
  id: string;
  transaksi_id: string;
  tagihan_id: string;
  nominal_dialokasikan: number;
}

export interface IPembayaranTagihan {
  id: string;
  created_at: string;
  updated_at?: string;
  tagihan_id: string;
  transaksi_id?: string | null;
  santri_nis: string;
  wali_id?: string | null;
  recorded_by?: string | null;
  amount: number;
  metode_pembayaran: string;
  source: 'admin_panel' | 'midtrans' | 'system';
  status: 'pending' | 'posted' | 'failed' | 'cancelled';
  paid_at?: string | null;
  provider_order_id?: string | null;
  provider_payload?: Record<string, unknown>;
  idempotency_key?: string | null;
  keterangan?: string | null;

  transaksi?: ITransaksiKeuangan;
}

// --- SECURITY & WALLET ---

export interface IDompetSantri {
  santri_nis: string; // PK & FK
  saldo: number;
  created_at: string;
}

export interface ICryptoKeystore {
  santri_nis: string;
  public_key: string; // Base64 / Hex
  encrypted_wallet_data: string; // Encrypted Private Key
  encryption_iv: string;
  encryption_salt: string;
  failed_attempts: number;
  locked_until: string | null;
}
