import { cleanEmisExtra } from "../components/santri/EmisExtraFields";

const statusMukimToResidence: Record<string, string> = {
  MUKIM: "4",
  TIDAK_MUKIM: "1",
  KALONG: "3",
};

const jurusanToProgram: Record<string, string> = {
  TAHFIDZ: "05",
  KITAB: "06",
};

export const toEmisResidenceCode = (statusMukim?: string | null) =>
  statusMukim ? statusMukimToResidence[statusMukim] : undefined;

export const toEmisProgramCode = (jurusan?: string | null) =>
  jurusan ? jurusanToProgram[jurusan] || "99" : undefined;

export const toEmisDistanceCategory = (jarakRumahKm?: number | string | null) => {
  if (jarakRumahKm === undefined || jarakRumahKm === null || jarakRumahKm === "") return undefined;
  const distance = Number(jarakRumahKm);
  if (Number.isNaN(distance)) return undefined;
  return distance < 1 ? "1" : "2";
};

export const normalizeSantriEmisExtra = (
  rawExtra: Record<string, any> | undefined | null,
  context: {
    status_mukim?: string | null;
    jurusan?: string | null;
    jarak_rumah_km?: number | string | null;
  },
) => {
  const cleaned = cleanEmisExtra(rawExtra);
  const residenceCode = toEmisResidenceCode(context.status_mukim);
  const programCode = toEmisProgramCode(context.jurusan);
  const distanceCategory = toEmisDistanceCategory(context.jarak_rumah_km);

  return cleanEmisExtra({
    ...cleaned,
    tinggal_bersama: residenceCode || cleaned.tinggal_bersama,
    program_pesantren_kode: programCode || cleaned.program_pesantren_kode,
    jarak_rumah_kategori: distanceCategory || cleaned.jarak_rumah_kategori,
  });
};

export const validateEmisPreflight = (payload: Record<string, any>) => {
  const errors: string[] = [];
  const extra = payload.emis_extra || {};

  if (!payload.nik || !/^\d{16}$/.test(payload.nik)) errors.push("NIK santri wajib 16 digit.");
  if (payload.nisn && !/^\d{10}$/.test(payload.nisn)) errors.push("NISN wajib 10 digit jika diisi.");
  if (payload.nsp && !/^\d{12}$/.test(payload.nsp)) errors.push("NSP wajib 12 digit jika diisi.");
  if (extra.npsn_asal_sekolah && !/^\d{8}$/.test(extra.npsn_asal_sekolah)) errors.push("NPSN asal sekolah wajib 8 digit.");
  if (!extra.jenjang_pesantren) errors.push("Jenjang pesantren wajib diisi.");
  if (!extra.jenis_pendaftaran) errors.push("Jenis pendaftaran wajib diisi.");
  if (!extra.tinggal_bersama) errors.push("Tinggal bersama/status tempat tinggal EMIS wajib ada.");
  if (!extra.program_pesantren_kode) errors.push("Kode program pesantren EMIS wajib ada.");

  return errors;
};
