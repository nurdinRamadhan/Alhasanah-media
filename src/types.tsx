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
export type TipeJurusan = 'KITAB' | 'TAHFIDZ' | 'BAHASA';
export type StatusSantri = 'AKTIF' | 'LULUS' | 'KELUAR' | 'ALUMNI';
export type StatusTagihan = 'LUNAS' | 'BELUM' | 'CICILAN';
export type StatusTransaksi = 'pending' | 'settlement' | 'expire' | 'deny' | 'cancel';
export type JenisTransaksi = 'masuk' | 'keluar';

// --- INTERFACES ---

export interface IProfile {
  id: string; // UUID from auth.users
  full_name: string | null;
  email: string | null;
  role: string; // 'admin', 'wali', 'keuangan'
  no_hp: string | null;
  foto_url: string | null;
  is_active: boolean;
  created_at: string;
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
  tipe: 'BULANAN' | 'SEKALI' | 'BEBAS';
  nominal_default: number;
  is_aktif: boolean;
}

export interface ITagihanSantri {
  santri: any;
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

export interface ITransaksiKeuangan {
  id: string; // UUID
  wali_id: string | null;
  admin_pencatat_id: string | null;
  midtrans_order_id: string | null; // Unique Key
  midtrans_snap_token: string | null;
  jumlah: number;
  tanggal_transaksi: string;
  status_transaksi: StatusTransaksi;
  metode_pembayaran: string; // 'cash', 'bca', 'gopay'
  jenis_transaksi: JenisTransaksi;
  created_at: string;
}

export interface IDetailTransaksi {
  id: string;
  transaksi_id: string;
  tagihan_id: string;
  nominal_dialokasikan: number;
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