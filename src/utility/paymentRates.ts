import { supabaseClient } from "./supabaseClient";

export interface SpecialPaymentRate {
  id?: string;
  santri_nis: string;
  jenis_pembayaran_id: number;
  nominal_khusus: number;
  periode_mulai?: string | null;
  periode_selesai?: string | null;
  is_aktif?: boolean;
  created_at?: string;
}

export const buildSpecialRateMap = (
  rates: SpecialPaymentRate[],
) => {
  const sortedRates = [...rates].sort((a, b) =>
    new Date(b.created_at || 0).valueOf() - new Date(a.created_at || 0).valueOf()
  );
  const rateMap = new Map<string, SpecialPaymentRate>();

  sortedRates.forEach((rate) => {
    const key = `${rate.santri_nis}:${rate.jenis_pembayaran_id}`;
    if (!rateMap.has(key)) {
      rateMap.set(key, rate);
    }
  });

  return rateMap;
};

export const loadSpecialRates = async (
  santriNisList: string[],
  paymentRefIds: number[],
) => {
  if (!santriNisList.length || !paymentRefIds.length) return [];

  const { data, error } = await supabaseClient
    .from("tarif_khusus_santri")
    .select("id, santri_nis, jenis_pembayaran_id, nominal_khusus, periode_mulai, periode_selesai, is_aktif, created_at")
    .eq("is_aktif", true)
    .in("santri_nis", santriNisList)
    .in("jenis_pembayaran_id", paymentRefIds);

  if (error) throw error;
  return (data || []) as SpecialPaymentRate[];
};

export const resolveNominalWithSpecialRate = (
  rateMap: Map<string, SpecialPaymentRate>,
  santriNis: string,
  paymentRefId: number,
  nominalDefault: number,
) => {
  const rate = rateMap.get(`${santriNis}:${paymentRefId}`);
  return rate ? Number(rate.nominal_khusus || 0) : Number(nominalDefault || 0);
};
