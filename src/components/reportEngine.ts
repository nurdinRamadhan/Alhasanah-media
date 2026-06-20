import dayjs, { Dayjs } from "dayjs";
import { supabaseClient } from "../utility/supabaseClient";
import type { TGenderScope, TJurusanScope } from "../types";

export type ReportFormat = "excel" | "pdf";
export type ReportMode = "global" | "personal";

export interface ReportCaller {
  id: string;
  full_name: string;
  role: string;
  akses_gender: TGenderScope;
  akses_jurusan: TJurusanScope;
}

export interface ReportColumn {
  key: string;
  label: string;
  format?: "date" | "datetime" | "currency" | "status";
}

export interface ReportDefinition {
  key: string;
  label: string;
  category: string;
  table: string;
  description: string;
  dateField?: string;
  santriField?: string;
  statusField?: string;
  formats: ReportFormat[];
  columns: ReportColumn[];
  statusOptions?: string[];
  financeOnly?: boolean;
  defaultRange: "today" | "week" | "month" | "all";
}

export interface ReportFilters {
  mode: ReportMode;
  format: ReportFormat;
  dateRange?: [Dayjs, Dayjs] | null;
  kelas?: string;
  jurusan?: string;
  gender?: string;
  status?: string;
  santriNis?: string;
}

export interface GeneratedReport {
  definition: ReportDefinition;
  rows: Record<string, unknown>[];
  title: string;
  filterSummary: string;
}

const moneyColumns = new Set([
  "nominal",
  "nominal_tagihan",
  "sisa_tagihan",
  "jumlah_bayar",
  "harga_perolehan",
  "saldo",
]);

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    key: "santri",
    label: "Database Santri",
    category: "Kesantrian",
    table: "santri",
    description: "Data induk santri aktif/nonaktif berdasarkan kelas, takhasus, gender, dan status.",
    dateField: "created_at",
    statusField: "status_santri",
    formats: ["excel", "pdf"],
    defaultRange: "all",
    statusOptions: ["AKTIF", "LULUS", "KELUAR", "ALUMNI"],
    columns: [
      { key: "nis", label: "NIS" },
      { key: "nama", label: "Alias" },
      { key: "jenis_kelamin", label: "Gender" },
      { key: "kelas", label: "Kelas" },
      { key: "jurusan", label: "Takhasus" },
      { key: "status_santri", label: "Status", format: "status" },
      { key: "pembimbing", label: "Pembimbing" },
      { key: "no_kontak_wali", label: "Kontak Wali" },
    ],
  },
  {
    key: "tagihan",
    label: "Tagihan Santri",
    category: "Keuangan",
    table: "tagihan_santri",
    description: "Rekap tagihan, status pelunasan, dan sisa tagihan santri.",
    dateField: "created_at",
    santriField: "santri_nis",
    statusField: "status",
    formats: ["excel", "pdf"],
    defaultRange: "month",
    financeOnly: true,
    statusOptions: ["LUNAS", "BELUM", "CICILAN"],
    columns: [
      { key: "santri_nis", label: "NIS" },
      { key: "nama_santri", label: "Alias" },
      { key: "kelas", label: "Kelas" },
      { key: "jurusan", label: "Takhasus" },
      { key: "deskripsi_tagihan", label: "Tagihan" },
      { key: "nominal_tagihan", label: "Nominal", format: "currency" },
      { key: "sisa_tagihan", label: "Sisa", format: "currency" },
      { key: "status", label: "Status", format: "status" },
      { key: "tanggal_jatuh_tempo", label: "Jatuh Tempo", format: "date" },
    ],
  },
  {
    key: "transaksi",
    label: "Buku Besar Transaksi",
    category: "Keuangan",
    table: "transaksi_keuangan",
    description: "Riwayat transaksi keuangan masuk dan keluar.",
    dateField: "created_at",
    statusField: "status",
    formats: ["excel", "pdf"],
    defaultRange: "month",
    financeOnly: true,
    columns: [
      { key: "created_at", label: "Tanggal", format: "datetime" },
      { key: "jenis", label: "Jenis" },
      { key: "kategori", label: "Kategori" },
      { key: "deskripsi", label: "Deskripsi" },
      { key: "nominal", label: "Nominal", format: "currency" },
      { key: "status", label: "Status", format: "status" },
    ],
  },
  {
    key: "pengeluaran",
    label: "Pengeluaran",
    category: "Keuangan",
    table: "pengeluaran",
    description: "Rekap pengeluaran berdasarkan periode dan kategori.",
    dateField: "tanggal_pengeluaran",
    formats: ["excel", "pdf"],
    defaultRange: "month",
    financeOnly: true,
    statusOptions: ["OPERASIONAL", "PEMBANGUNAN", "DAPUR", "KEGIATAN", "LAINNYA"],
    statusField: "kategori",
    columns: [
      { key: "tanggal_pengeluaran", label: "Tanggal", format: "date" },
      { key: "judul", label: "Judul" },
      { key: "kategori", label: "Kategori" },
      { key: "nominal", label: "Nominal", format: "currency" },
      { key: "keterangan", label: "Keterangan" },
      { key: "dicatat_oleh_nama", label: "Dicatat Oleh" },
    ],
  },
  {
    key: "pelanggaran",
    label: "Pelanggaran Santri",
    category: "Kesantrian",
    table: "pelanggaran_santri",
    description: "Rekap pelanggaran, poin, hukuman, dan catatan pembinaan.",
    dateField: "tanggal",
    santriField: "santri_nis",
    formats: ["excel", "pdf"],
    defaultRange: "week",
    columns: [
      { key: "tanggal", label: "Tanggal", format: "date" },
      { key: "santri_nis", label: "NIS" },
      { key: "nama_santri", label: "Alias" },
      { key: "kelas", label: "Kelas" },
      { key: "jurusan", label: "Takhasus" },
      { key: "jenis_pelanggaran", label: "Pelanggaran" },
      { key: "poin", label: "Poin" },
      { key: "hukuman", label: "Hukuman" },
    ],
  },
  {
    key: "kesehatan",
    label: "Kesehatan/UKS",
    category: "Kesantrian",
    table: "kesehatan_santri",
    description: "Rekam medis, keluhan, tindakan, dan catatan UKS.",
    dateField: "tanggal",
    santriField: "santri_nis",
    formats: ["excel", "pdf"],
    defaultRange: "week",
    columns: [
      { key: "tanggal", label: "Tanggal", format: "date" },
      { key: "santri_nis", label: "NIS" },
      { key: "nama_santri", label: "Alias" },
      { key: "kelas", label: "Kelas" },
      { key: "jurusan", label: "Takhasus" },
      { key: "keluhan", label: "Keluhan" },
      { key: "tindakan", label: "Tindakan" },
      { key: "catatan", label: "Catatan" },
    ],
  },
  {
    key: "perizinan",
    label: "Perizinan Santri",
    category: "Kesantrian",
    table: "perizinan_santri",
    description: "Status izin, jadwal keluar, jadwal kembali, dan keterlambatan.",
    dateField: "tanggal",
    santriField: "santri_nis",
    statusField: "status",
    formats: ["excel", "pdf"],
    defaultRange: "week",
    statusOptions: ["PENDING", "APPROVED", "REJECTED"],
    columns: [
      { key: "tanggal", label: "Tanggal", format: "date" },
      { key: "santri_nis", label: "NIS" },
      { key: "nama_santri", label: "Alias" },
      { key: "jenis_izin", label: "Jenis Izin" },
      { key: "tanggal_kembali", label: "Kembali", format: "date" },
      { key: "status", label: "Status", format: "status" },
      { key: "keterangan", label: "Keterangan" },
    ],
  },
  {
    key: "hafalan",
    label: "Ziyadah Tahfidz",
    category: "Tahfidz",
    table: "hafalan_tahfidz",
    description: "Setoran hafalan Quran, predikat, status, dan total hafalan.",
    dateField: "tanggal",
    santriField: "santri_nis",
    statusField: "predikat",
    formats: ["excel", "pdf"],
    defaultRange: "week",
    statusOptions: ["MUMTAZ", "JAYYID", "KURANG"],
    columns: [
      { key: "tanggal", label: "Tanggal", format: "date" },
      { key: "santri_nis", label: "NIS" },
      { key: "nama_santri", label: "Alias" },
      { key: "surat", label: "Surat" },
      { key: "ayat_awal", label: "Ayat Awal" },
      { key: "ayat_akhir", label: "Ayat Akhir" },
      { key: "juz", label: "Juz" },
      { key: "predikat", label: "Predikat" },
      { key: "status_setoran", label: "Status Setoran" },
      { key: "alasan_tolak", label: "Alasan" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "murojaah",
    label: "Murojaah Tahfidz",
    category: "Tahfidz",
    table: "murojaah_tahfidz",
    description: "Rekap pengulangan hafalan santri tahfidz.",
    dateField: "tanggal",
    santriField: "santri_nis",
    statusField: "predikat",
    formats: ["excel", "pdf"],
    defaultRange: "week",
    statusOptions: ["MUMTAZ", "JAYYID", "KURANG"],
    columns: [
      { key: "tanggal", label: "Tanggal", format: "date" },
      { key: "santri_nis", label: "NIS" },
      { key: "nama_santri", label: "Alias" },
      { key: "jenis_murojaah", label: "Jenis" },
      { key: "juz", label: "Juz" },
      { key: "surat", label: "Surat" },
      { key: "predikat", label: "Predikat" },
      { key: "status_setoran", label: "Status Setoran" },
      { key: "alasan_tolak", label: "Alasan" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "hafalan_kitab",
    label: "Hafalan Kitab",
    category: "Takhasus Kitab",
    table: "hafalan_kitab",
    description: "Setoran hafalan kitab, bab/materi, predikat, dan status.",
    dateField: "tanggal",
    santriField: "santri_nis",
    statusField: "predikat",
    formats: ["excel", "pdf"],
    defaultRange: "week",
    statusOptions: ["MUMTAZ", "JAYYID", "KURANG"],
    columns: [
      { key: "tanggal", label: "Tanggal", format: "date" },
      { key: "santri_nis", label: "NIS" },
      { key: "nama_santri", label: "Alias" },
      { key: "nama_kitab", label: "Kitab" },
      { key: "bab_materi", label: "Materi" },
      { key: "predikat", label: "Predikat" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "prestasi",
    label: "Prestasi Santri",
    category: "Kesantrian",
    table: "prestasi_santri",
    description: "Rekap prestasi santri berdasarkan kategori dan poin.",
    dateField: "tanggal_prestasi",
    santriField: "santri_nis",
    statusField: "kategori",
    formats: ["excel", "pdf"],
    defaultRange: "month",
    statusOptions: ["TAHFIDZ", "KITAB", "UMUM", "KHATAM"],
    columns: [
      { key: "tanggal_prestasi", label: "Tanggal", format: "date" },
      { key: "santri_nis", label: "NIS" },
      { key: "nama_santri", label: "Alias" },
      { key: "kategori", label: "Kategori" },
      { key: "judul_prestasi", label: "Prestasi" },
      { key: "poin_prestasi", label: "Poin" },
      { key: "keterangan", label: "Keterangan" },
    ],
  },
  {
    key: "inventaris",
    label: "Inventaris Aset",
    category: "Operasional",
    table: "inventaris",
    description: "Katalog aset, kondisi barang, lokasi, jumlah, dan nilai perolehan.",
    dateField: "tanggal_perolehan",
    statusField: "kondisi",
    formats: ["excel", "pdf"],
    defaultRange: "all",
    statusOptions: ["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT", "HILANG"],
    columns: [
      { key: "kode_barang", label: "Kode" },
      { key: "nama_barang", label: "Barang" },
      { key: "jumlah", label: "Jumlah" },
      { key: "kondisi", label: "Kondisi" },
      { key: "sumber_dana", label: "Sumber Dana" },
      { key: "tanggal_perolehan", label: "Tgl Perolehan", format: "date" },
      { key: "harga_perolehan", label: "Harga", format: "currency" },
    ],
  },
  {
    key: "alumni",
    label: "Data Alumni",
    category: "Alumni",
    table: "alumni_data",
    description: "Database alumni, tahun lulus, profesi, dan domisili.",
    formats: ["excel", "pdf"],
    defaultRange: "all",
    columns: [
      { key: "full_name", label: "Nama" },
      { key: "tahun_lulus", label: "Tahun Lulus" },
      { key: "no_wa", label: "No WA" },
      { key: "profesi_sekarang", label: "Profesi" },
      { key: "instansi_kerja", label: "Instansi" },
      { key: "alamat_domisili", label: "Domisili" },
    ],
  },
  {
    key: "absensi",
    label: "Rekap Absensi",
    category: "Kesantrian",
    table: "view_attendance_reports",
    description: "Laporan kehadiran santri per sesi kegiatan, kategori, dan tanggal.",
    dateField: "attendance_date",
    santriField: "nis",
    statusField: "status",
    formats: ["excel", "pdf"],
    defaultRange: "week",
    statusOptions: ["HADIR", "SAKIT", "IZIN", "ALFA", "TERLAMBAT"],
    columns: [
      { key: "attendance_date", label: "Tanggal", format: "date" },
      { key: "nis", label: "NIS" },
      { key: "santri_nama", label: "Nama Santri" },
      { key: "kelas", label: "Kelas" },
      { key: "activity_name", label: "Kegiatan" },
      { key: "category_label", label: "Kategori" },
      { key: "status", label: "Status", format: "status" },
      { key: "marked_at", label: "Waktu Absen", format: "datetime" },
    ],
  },
  {
    key: "audit",
    label: "Audit Aktivitas",
    category: "Sistem",
    table: "audit_logs",
    description: "Riwayat aktivitas admin dan perubahan data penting.",
    dateField: "created_at",
    statusField: "action",
    formats: ["excel"],
    defaultRange: "week",
    columns: [
      { key: "created_at", label: "Waktu", format: "datetime" },
      { key: "user_name", label: "Admin" },
      { key: "user_role", label: "Role" },
      { key: "action", label: "Aksi" },
      { key: "resource", label: "Resource" },
      { key: "record_id", label: "Record" },
      { key: "meta_info", label: "Info" },
    ],
  },
];

export const getDefaultRange = (def: ReportDefinition): [Dayjs, Dayjs] | null => {
  if (def.defaultRange === "all") return null;
  if (def.defaultRange === "today") return [dayjs().startOf("day"), dayjs().endOf("day")];
  if (def.defaultRange === "week") return [dayjs().subtract(7, "day").startOf("day"), dayjs().endOf("day")];
  return [dayjs().startOf("month"), dayjs().endOf("month")];
};

export const canAccessReport = (def: ReportDefinition, role?: string) => {
  if (!def.financeOnly) return true;
  return ["super_admin", "rois", "bendahara"].includes(role || "");
};

export const parseReportIntent = (input: string) => {
  const text = input.toLowerCase();
  const report =
    REPORT_DEFINITIONS.find((def) =>
      text.includes(def.key) ||
      text.includes(def.label.toLowerCase()) ||
      def.label.toLowerCase().split(" ").some((part) => part.length > 5 && text.includes(part))
    ) || null;

  const format: ReportFormat | undefined = text.includes("pdf")
    ? "pdf"
    : text.includes("excel") || text.includes("xlsx")
      ? "excel"
      : undefined;

  const kelas = text.match(/kelas\s*([123])/i)?.[1];
  const jurusan = text.includes("tahfidz")
    ? "TAHFIDZ"
    : text.includes("kitab") || text.includes("takhasus")
      ? "KITAB"
      : undefined;
  const gender = text.includes("putra") || text.includes("laki")
    ? "L"
    : text.includes("putri") || text.includes("perempuan")
      ? "P"
      : undefined;

  const range = text.includes("hari ini")
    ? [dayjs().startOf("day"), dayjs().endOf("day")] as [Dayjs, Dayjs]
    : text.includes("minggu")
      ? [dayjs().subtract(7, "day").startOf("day"), dayjs().endOf("day")] as [Dayjs, Dayjs]
      : text.includes("bulan")
        ? [dayjs().startOf("month"), dayjs().endOf("month")] as [Dayjs, Dayjs]
        : undefined;

  return { report, format, kelas, jurusan, gender, range };
};

const getValue = (row: Record<string, unknown>, key: string) => row[key];

export const formatReportValue = (value: unknown, column?: ReportColumn) => {
  if (value === null || value === undefined || value === "") return "-";
  if (column?.format === "currency" || moneyColumns.has(column?.key || "")) {
    return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
  }
  if (column?.format === "date") return dayjs(String(value)).isValid() ? dayjs(String(value)).format("DD/MM/YYYY") : String(value);
  if (column?.format === "datetime") return dayjs(String(value)).isValid() ? dayjs(String(value)).format("DD/MM/YYYY HH:mm") : String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const buildFilterSummary = (filters: ReportFilters) => {
  const parts = [
    filters.mode === "personal" ? `Personal: ${filters.santriNis || "-"}` : "Global",
    filters.dateRange ? `${filters.dateRange[0].format("DD/MM/YYYY")} - ${filters.dateRange[1].format("DD/MM/YYYY")}` : "Semua tanggal",
    filters.kelas && filters.kelas !== "ALL" ? `Kelas ${filters.kelas}` : null,
    filters.jurusan && filters.jurusan !== "ALL" ? `Takhasus ${filters.jurusan}` : null,
    filters.gender && filters.gender !== "ALL" ? `Gender ${filters.gender}` : null,
    filters.status && filters.status !== "ALL" ? `Status ${filters.status}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
};

const getScopedNisList = async (filters: ReportFilters, caller: ReportCaller) => {
  let q = supabaseClient.from("santri").select("nis");
  if (filters.kelas && filters.kelas !== "ALL") q = q.eq("kelas", filters.kelas);
  if (filters.jurusan && filters.jurusan !== "ALL") q = q.eq("jurusan", filters.jurusan);
  if (filters.gender && filters.gender !== "ALL") q = q.eq("jenis_kelamin", filters.gender);
  if (caller.akses_jurusan !== "ALL") q = q.eq("jurusan", caller.akses_jurusan);
  if (caller.akses_gender !== "ALL") q = q.eq("jenis_kelamin", caller.akses_gender);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((s: { nis: string }) => s.nis);
};

const santriAlias = (nis?: string | null) => {
  const safe = String(nis || "").replace(/[^0-9A-Za-z]/g, "");
  return `Santri-${safe.slice(-4) || "XXXX"}`;
};

export const generateReportData = async (
  definition: ReportDefinition,
  filters: ReportFilters,
  caller: ReportCaller,
): Promise<GeneratedReport> => {
  const selectColumns: string = definition.table === "santri"
    ? "nama,nis,kelas,jurusan,jenis_kelamin,status_santri,pembimbing,total_hafalan,hafalan_kitab,created_at"
    : "*";
  let query = supabaseClient.from(definition.table).select(selectColumns).limit(5000);

  if (definition.dateField && filters.dateRange) {
    query = query
      .gte(definition.dateField, filters.dateRange[0].startOf("day").toISOString())
      .lte(definition.dateField, filters.dateRange[1].endOf("day").toISOString());
  }
  if (definition.statusField && filters.status && filters.status !== "ALL") {
    query = query.eq(definition.statusField, filters.status);
  }

  if (definition.table === "santri") {
    if (filters.kelas && filters.kelas !== "ALL") query = query.eq("kelas", filters.kelas);
    if (filters.jurusan && filters.jurusan !== "ALL") query = query.eq("jurusan", filters.jurusan);
    if (filters.gender && filters.gender !== "ALL") query = query.eq("jenis_kelamin", filters.gender);
    if (filters.mode === "personal" && filters.santriNis) query = query.eq("nis", filters.santriNis);
    if (caller.akses_jurusan !== "ALL") query = query.eq("jurusan", caller.akses_jurusan);
    if (caller.akses_gender !== "ALL") query = query.eq("jenis_kelamin", caller.akses_gender);
  } else if (definition.santriField) {
    if (filters.mode === "personal" && filters.santriNis) {
      query = query.eq(definition.santriField, filters.santriNis);
    } else {
      const scopedNis = await getScopedNisList(filters, caller);
      if (scopedNis.length === 0) {
        return {
          definition,
          rows: [],
          title: definition.label,
          filterSummary: buildFilterSummary(filters),
        };
      }
      query = query.in(definition.santriField, scopedNis);
    }
  }

  if (definition.dateField) query = query.order(definition.dateField, { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as unknown as Record<string, unknown>[];
  const nisKeys = definition.santriField
    ? [...new Set(rows.map((r) => r[definition.santriField!]).filter(Boolean).map(String))]
    : [];

  let santriMap: Record<string, Record<string, unknown>> = {};
  if (nisKeys.length > 0) {
    const { data: santriRows } = await supabaseClient
      .from("santri")
      .select("nama,nis,kelas,jurusan,jenis_kelamin")
      .in("nis", nisKeys);
    santriMap = Object.fromEntries((santriRows || []).map((s: Record<string, unknown>) => [String(s.nis), s]));
  }

  const enhancedRows = rows.map((row) => {
    const nis = definition.santriField ? String(row[definition.santriField] || "") : "";
    const santri = nis ? santriMap[nis] : null;
    if (definition.table === "santri") {
      return {
        ...row,
        nama: row.nama || santriAlias(String(row.nis || "")),
      };
    }
    return {
      ...row,
      nama_santri: santri?.nama || santriAlias(nis || String(row.santri_nis || "")),
      kelas: santri?.kelas || row.kelas,
      jurusan: santri?.jurusan || row.jurusan,
      jenis_kelamin: santri?.jenis_kelamin || row.jenis_kelamin,
    };
  });

  return {
    definition,
    rows: enhancedRows,
    title: definition.label,
    filterSummary: buildFilterSummary(filters),
  };
};

export const exportReportToExcel = async (report: GeneratedReport) => {
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import("exceljs"),
    import("file-saver"),
  ]);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(report.definition.label.slice(0, 31));
  const colCount = report.definition.columns.length;

  ws.mergeCells(1, 1, 1, colCount);
  ws.getCell(1, 1).value = "PONDOK PESANTREN AL-HASANAH";
  ws.getCell(1, 1).font = { bold: true, size: 16, color: { argb: "FF5C430A" } };
  ws.getCell(1, 1).alignment = { horizontal: "center" };
  ws.mergeCells(2, 1, 2, colCount);
  ws.getCell(2, 1).value = report.title.toUpperCase();
  ws.getCell(2, 1).font = { bold: true, size: 13 };
  ws.getCell(2, 1).alignment = { horizontal: "center" };
  ws.mergeCells(3, 1, 3, colCount);
  ws.getCell(3, 1).value = report.filterSummary;
  ws.getCell(3, 1).alignment = { horizontal: "center" };

  ws.addRow([]);
  const header = ws.addRow(report.definition.columns.map((c) => c.label));
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  report.rows.forEach((row) => {
    ws.addRow(report.definition.columns.map((col) => formatReportValue(getValue(row, col.key), col)));
  });

  ws.columns.forEach((col) => {
    const values = (col.values || []) as unknown[];
    const maxLen = values.reduce((max: number, v: unknown) => Math.max(max, String(v || "").length), 0);
    col.width = Math.min(Math.max(14, maxLen + 2), 38);
  });
  ws.views = [{ state: "frozen", ySplit: 5 }];

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${report.definition.label.replace(/\s+/g, "_")}_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
};

export const exportReportToPdf = async (report: GeneratedReport) => {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
  const columns = report.definition.columns.slice(0, 9);

  doc.setFillColor(253, 246, 220);
  doc.rect(0, 0, 297, 32, "F");
  doc.setTextColor(92, 67, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PONDOK PESANTREN AL-HASANAH", 148.5, 13, { align: "center" });
  doc.setFontSize(11);
  doc.text(report.title.toUpperCase(), 148.5, 21, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(report.filterSummary, 148.5, 27, { align: "center" });

  autoTable(doc, {
    startY: 38,
    head: [columns.map((c) => c.label)],
    body: report.rows.map((row) => columns.map((col) => formatReportValue(getValue(row, col.key), col))),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [201, 168, 76], textColor: 255, halign: "center" },
  });

  doc.save(`${report.definition.label.replace(/\s+/g, "_")}_${dayjs().format("YYYYMMDD_HHmm")}.pdf`);
};
