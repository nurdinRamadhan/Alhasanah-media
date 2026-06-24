import { useState, useEffect, useCallback } from "react";
import hijriConverter from "hijri-converter";
import { supabaseClient } from "../utility/supabaseClient";
import { HIJRI_MONTHS } from "../utility/dateHelper";

interface HijriDate {
    hy: number;
    hm: number;
    hd: number;
}

interface BulanKoreksi {
    tahun_hijriah: number;
    bulan_hijriah_number: number;
    tanggal_awal_masehi: string;
    panjang_bulan: number;
    verified: boolean;
}

const bulanKoreksi: BulanKoreksi[] = [];

export function resolveHijri(tanggal: string): HijriDate & { monthName: string; isCorrected: boolean } {
    const d = new Date(tanggal + "T12:00:00");
    for (const k of bulanKoreksi) {
        const start = new Date(k.tanggal_awal_masehi + "T12:00:00");
        const diff = Math.round((d.getTime() - start.getTime()) / 86400000);
        if (diff >= 0 && diff < k.panjang_bulan) {
            return {
                hy: k.tahun_hijriah,
                hm: k.bulan_hijriah_number,
                hd: diff + 1,
                monthName: HIJRI_MONTHS[k.bulan_hijriah_number - 1],
                isCorrected: true,
            };
        }
    }
    const h = hijriConverter.toHijri(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { hy: h.hy, hm: h.hm, hd: h.hd, monthName: HIJRI_MONTHS[h.hm - 1], isCorrected: false };
}

export function useHijriCorrection(_dates?: string[]): {
    loading: boolean;
    refresh: () => Promise<void>;
} {
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await supabaseClient
                .from("koreksi_bulan_hijriah")
                .select("tahun_hijriah, bulan_hijriah_number, tanggal_awal_masehi, panjang_bulan, verified")
                .order("tahun_hijriah", { ascending: false })
                .order("bulan_hijriah_number", { ascending: false });
            if (data) {
                bulanKoreksi.length = 0;
                bulanKoreksi.push(...(data as BulanKoreksi[]));
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (bulanKoreksi.length === 0) fetch();
    }, []);

    return { loading, refresh: fetch };
}
