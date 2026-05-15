type SantriEmisInput = {
  status_mukim?: string | null;
  jurusan?: string | null;
  jarak_rumah_km?: number | string | null;
  emis_extra?: Record<string, unknown> | null;
};

const statusMukimToResidence: Record<string, string> = {
  MUKIM: "4",
  TIDAK_MUKIM: "1",
  KALONG: "3",
};

const jurusanToProgram: Record<string, string> = {
  TAHFIDZ: "05",
  KITAB: "06",
};

const compact = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""),
  );

export const mapSantriToEmisPayload = (input: SantriEmisInput) => {
  const extra = input.emis_extra || {};
  const distance = input.jarak_rumah_km === undefined || input.jarak_rumah_km === null || input.jarak_rumah_km === ""
    ? undefined
    : Number(input.jarak_rumah_km);

  return compact({
    ...extra,
    tinggal_bersama: input.status_mukim ? statusMukimToResidence[input.status_mukim] : extra.tinggal_bersama,
    program_pesantren_kode: input.jurusan ? jurusanToProgram[input.jurusan] || "99" : extra.program_pesantren_kode,
    jarak_rumah_kategori: Number.isFinite(distance) ? (Number(distance) < 1 ? "1" : "2") : extra.jarak_rumah_kategori,
  });
};

export const validateSantriEmisPayload = (payload: Record<string, unknown>) => {
  const errors: string[] = [];
  const extra = (payload.emis_extra || {}) as Record<string, unknown>;

  if (!payload.nik || !/^\d{16}$/.test(String(payload.nik))) errors.push("NIK santri wajib 16 digit.");
  if (payload.nisn && !/^\d{10}$/.test(String(payload.nisn))) errors.push("NISN wajib 10 digit jika diisi.");
  if (payload.nsp && !/^\d{12}$/.test(String(payload.nsp))) errors.push("NSP wajib 12 digit jika diisi.");
  if (extra.npsn_asal_sekolah && !/^\d{8}$/.test(String(extra.npsn_asal_sekolah))) errors.push("NPSN asal sekolah wajib 8 digit.");
  if (!extra.jenjang_pesantren) errors.push("Jenjang pesantren wajib diisi.");
  if (!extra.jenis_pendaftaran) errors.push("Jenis pendaftaran wajib diisi.");
  if (!extra.tinggal_bersama) errors.push("Tinggal bersama/status tempat tinggal EMIS wajib ada.");
  if (!extra.program_pesantren_kode) errors.push("Kode program pesantren EMIS wajib ada.");

  return errors;
};
