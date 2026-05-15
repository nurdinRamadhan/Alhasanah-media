export const PARENT_STATUS_OPTIONS = [
  { label: "Masih Hidup", value: "HIDUP" },
  { label: "Sudah Meninggal", value: "MENINGGAL" },
  { label: "Tanpa Keterangan / Tidak Diketahui", value: "TANPA KETERANGAN" },
];

export const WALI_RELATIONSHIP_OPTIONS = [
  "Ayah Kandung",
  "Ibu Kandung",
  "Kakek",
  "Nenek",
  "Paman",
  "Bibi",
  "Kakak Kandung",
  "Kakak Tiri",
  "Kakak Ipar",
  "Mertua",
  "Orang Tua Angkat",
  "Lembaga",
  "Lainnya",
].map((value) => ({ label: value, value }));

export const EDUCATION_OPTIONS = [
  { value: "01", label: "Tidak Sekolah" },
  { value: "02", label: "Putus SD" },
  { value: "03", label: "SD / Sederajat" },
  { value: "04", label: "SMP / Sederajat" },
  { value: "05", label: "SMA / Sederajat" },
  { value: "06", label: "D1" },
  { value: "07", label: "D2" },
  { value: "08", label: "D3" },
  { value: "09", label: "D4 / S1" },
  { value: "10", label: "S2" },
  { value: "11", label: "S3" },
];

export const JOB_OPTIONS = [
  { value: "01", label: "Tidak Bekerja" },
  { value: "02", label: "Nelayan" },
  { value: "03", label: "Petani" },
  { value: "04", label: "Peternak" },
  { value: "05", label: "PNS / TNI / POLRI" },
  { value: "06", label: "Karyawan Swasta" },
  { value: "07", label: "Pedagang Kecil" },
  { value: "08", label: "Pedagang Besar" },
  { value: "09", label: "Wiraswasta" },
  { value: "10", label: "Wirausaha" },
  { value: "11", label: "Buruh" },
  { value: "12", label: "Pensiunan" },
  { value: "99", label: "Lain-lain" },
];

export const INCOME_OPTIONS = [
  { value: "1", label: "Kurang dari Rp 500.000" },
  { value: "2", label: "Rp 500.000 - Rp 999.999" },
  { value: "3", label: "Rp 1.000.000 - Rp 1.999.999" },
  { value: "4", label: "Rp 2.000.000 - Rp 4.999.999" },
  { value: "5", label: "Rp 5.000.000 - Rp 20.000.000" },
  { value: "6", label: "Lebih dari Rp 20.000.000" },
];

export const RELIGION_OPTIONS = [
  { value: "01", label: "Islam" },
  { value: "02", label: "Kristen / Protestan" },
  { value: "03", label: "Katholik" },
  { value: "04", label: "Hindu" },
  { value: "05", label: "Budha" },
  { value: "06", label: "Khong Hu Chu" },
  { value: "99", label: "Lainnya" },
];

export const CITIZENSHIP_OPTIONS = [
  { value: "WNI", label: "Warga Negara Indonesia" },
  { value: "WNA", label: "Warga Negara Asing" },
];

export const SPECIAL_NEEDS_OPTIONS = [
  { value: "01", label: "Tidak Berkebutuhan Khusus" },
  { value: "02", label: "Netra" },
  { value: "03", label: "Rungu" },
  { value: "04", label: "Grahita Ringan" },
  { value: "05", label: "Grahita Sedang" },
  { value: "06", label: "Daksa Ringan" },
  { value: "07", label: "Daksa Sedang" },
  { value: "08", label: "Laras" },
  { value: "09", label: "Wicara" },
  { value: "10", label: "Tuna Ganda" },
  { value: "11", label: "Hiperaktif" },
  { value: "12", label: "Cerdas Istimewa" },
  { value: "13", label: "Bakat Istimewa" },
  { value: "14", label: "Kesulitan Belajar" },
  { value: "15", label: "Narkoba" },
  { value: "16", label: "Indigo" },
  { value: "17", label: "Down Syndrome" },
  { value: "18", label: "Autis" },
];

export const TRANSPORTATION_OPTIONS = [
  { value: "01", label: "Jalan Kaki" },
  { value: "02", label: "Kendaraan Pribadi (Motor/Mobil)" },
  { value: "03", label: "Kendaraan Umum / Angkot" },
  { value: "04", label: "Jemputan Sekolah / Pesantren" },
  { value: "05", label: "Kereta Api" },
  { value: "06", label: "Ojek" },
  { value: "07", label: "Andong / Bendi / Sado / Dokar / Delman / Becak" },
  { value: "08", label: "Perahu Penyeberangan / Rakit / Getek" },
  { value: "99", label: "Lainnya" },
];

export const RESIDENCE_OPTIONS = [
  { value: "1", label: "Bersama Orang Tua" },
  { value: "2", label: "Bersama Wali" },
  { value: "3", label: "Kos / Kontrak" },
  { value: "4", label: "Asrama Pesantren" },
  { value: "5", label: "Panti Asuhan" },
  { value: "9", label: "Lainnya" },
];

export const JENJANG_PESANTREN_OPTIONS = [
  { value: "01", label: "Ula" },
  { value: "02", label: "Wustha" },
  { value: "03", label: "Ulya" },
  { value: "04", label: "Ma'had Aly" },
  { value: "05", label: "Paket A" },
  { value: "06", label: "Paket B" },
  { value: "07", label: "Paket C" },
  { value: "08", label: "Non-jenjang (Halaqah/Takhassus)" },
];

export const HOME_OWNERSHIP_OPTIONS = [
  { value: "1", label: "Milik Sendiri" },
  { value: "2", label: "Rumah Orang Tua / Keluarga" },
  { value: "3", label: "Rumah Kerabat / Saudara" },
  { value: "4", label: "Rumah Dinas" },
  { value: "5", label: "Sewa atau Kontrak" },
  { value: "9", label: "Lainnya" },
];

export const REGISTRATION_TYPE_OPTIONS = [
  { value: "01", label: "Santri Baru" },
  { value: "02", label: "Santri Pindahan / Mutasi Masuk" },
  { value: "03", label: "Santri Aktif Kembali" },
];

export const BLOOD_TYPE_OPTIONS = [
  "A",
  "B",
  "AB",
  "O",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "TT",
].map((value) => ({ label: value === "TT" ? "Tidak Tahu / Belum Diperiksa" : value, value }));

export const EXIT_REASON_OPTIONS = [
  { value: "1", label: "Lulus" },
  { value: "2", label: "Mutasi Keluar" },
  { value: "3", label: "Dikeluarkan" },
  { value: "4", label: "Mengundurkan Diri" },
  { value: "5", label: "Putus Sekolah / Berhenti" },
  { value: "6", label: "Wafat / Meninggal Dunia" },
  { value: "7", label: "Hilang" },
  { value: "8", label: "Lainnya" },
];

const titlePattern = /\b(H|Hj|Haji|Hajah|Dr|Dra|Drs|Prof|Kyai|KH|Ust|Ustadz|S\.?Pd|M\.?Pd|S\.?Ag|M\.?Ag|S\.?H|M\.?H)\b\.?/i;
const forbiddenNameChars = /['()]/;

export const personNameRules = [
  { min: 3, message: "Nama minimal 3 karakter." },
  {
    validator: (_: unknown, value?: string) => {
      if (!value) return Promise.resolve();
      if (titlePattern.test(value)) {
        return Promise.reject(new Error("Nama tidak boleh mencantumkan gelar."));
      }
      if (forbiddenNameChars.test(value)) {
        return Promise.reject(new Error("Nama tidak boleh memakai petik atau tanda kurung."));
      }
      return Promise.resolve();
    },
  },
];

export const nikRules = [
  {
    validator: (_: unknown, value?: string) => {
      if (!value) return Promise.resolve();
      if (!/^\d{16}$/.test(value)) {
        return Promise.reject(new Error("NIK wajib 16 digit angka murni."));
      }
      const provinceCode = Number(value.slice(0, 2));
      if (provinceCode < 11 || provinceCode > 94) {
        return Promise.reject(new Error("Kode provinsi NIK tidak valid."));
      }
      return Promise.resolve();
    },
  },
];

export const nisnRules = [
  { pattern: /^\d{10}$/, message: "NISN wajib 10 digit angka murni." },
];

export const npsnRules = [
  { pattern: /^\d{8}$/, message: "NPSN wajib 8 digit angka." },
];

export const nspRules = [
  { pattern: /^\d{12}$/, message: "NSP wajib 12 digit angka." },
];

export const kkRules = [
  { pattern: /^\d{16}$/, message: "No. KK wajib 16 digit angka." },
];

export const phoneRules = [
  { pattern: /^(08\d{8,12}|\+62\d{8,12})$/, message: "Nomor HP harus diawali 08 atau +62, tanpa spasi/tanda hubung." },
];
