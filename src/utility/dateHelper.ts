import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/id";
import hijriConverter from "hijri-converter";

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Lock default timezone to Indonesia
dayjs.tz.setDefault("Asia/Jakarta");
dayjs.locale("id");

/**
 * GLOBAL HIJRI OFFSET
 * Change this value to adjust the Hijri date globally (+1, 0, -1)
 * to match Official Kemenag (MABIMS) announcements.
 */
export const HIJRI_OFFSET = -1;

/**
 * Hijri Month Names in Indonesian/Arabic standard
 */
export const HIJRI_MONTHS = [
    "Muharram",
    "Safar",
    "Rabi'ul Awwal",
    "Rabi'ul Akhir",
    "Jumadil Ula",
    "Jumadil Akhir",
    "Rajab",
    "Sha'ban",
    "Ramadhan",
    "Syawal",
    "Dzulqa'dah",
    "Dzulhijjah",
];

/**
 * Format date to Gregorian (Masehi) string
 * Example: 19 April 2026
 */
export const formatMasehi = (date?: string | Date | dayjs.Dayjs): string => {
    if (!date) return "-";
    return dayjs(date).tz().format("DD MMMM YYYY");
};

/**
 * Format date to Hijri string using hijri-converter + OFFSET
 * Example: 2 Syawal 1447 H
 */
export const formatHijri = (date?: string | Date | dayjs.Dayjs): string => {
    if (!date) return "-";

    try {
        // Apply offset to the date object before conversion
        const d = dayjs(date).tz().add(HIJRI_OFFSET, 'day').toDate();
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();

        // Convert Gregorian to Hijri
        const hijri = hijriConverter.toHijri(year, month, day);

        const hMonth = HIJRI_MONTHS[hijri.hm - 1];

        return `${hijri.hd} ${hMonth} ${hijri.hy} H`;
    } catch (error) {
        console.error("Hijri Conversion Error:", error);
        return "-";
    }
};


/**
 * Get combined Masehi and Hijri date string
 * Example: 19 April 2026 / 2 Syawal 1447 H
 */
export const formatDualDate = (date?: string | Date | dayjs.Dayjs): string => {
    if (!date) return "-";
    const masehi = formatMasehi(date);
    const hijri = formatHijri(date);
    return `${masehi} / ${hijri}`;
};

/**
 * Format date to full Indonesian format with day name
 * Example: Senin, 19 April 2026
 */
export const formatFullDate = (date?: string | Date | dayjs.Dayjs): string => {
    if (!date) return "-";
    return dayjs(date).tz().format("dddd, DD MMMM YYYY");
};

// ─────────────────────────────────────────────────────────────────────────────
//  HIJRI PERIOD UTILITIES (for tagihan billing period selection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Hijri month number and year from a Gregorian date.
 * Returns { hm: 1-12, hy: hijri year }
 */
export const getHijriMonthYear = (date?: string | Date | dayjs.Dayjs): { hm: number; hy: number } => {
    const d = dayjs(date).tz().add(HIJRI_OFFSET, 'day').toDate();
    const hijri = hijriConverter.toHijri(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { hm: hijri.hm, hy: hijri.hy };
};

/**
 * Convert Hijri year + month (1-12) to a Gregorian Date (1st of that Hijri month).
 * Used to compute tanggal_jatuh_tempo default from a Hijri period selection.
 */
export const hijriToGregorian = (hy: number, hm: number): Date => {
    const greg = hijriConverter.toGregorian(hy, hm, 1);
    return new Date(greg.gy, greg.gm - 1, greg.gd);
};

/**
 * Format a Hijri period for tagihan billing.
 * Example: "Muharram 1448 H"
 */
export const formatHijriPeriod = (hy: number, hm: number): string => {
    const monthName = HIJRI_MONTHS[hm - 1] || HIJRI_MONTHS[0];
    return `${monthName} ${hy} H`;
};

/**
 * Dropdown options for Hijri months (1-12).
 */
export const HIJRI_MONTH_OPTIONS = HIJRI_MONTHS.map((name, i) => ({
    value: i + 1,
    label: name,
}));

/**
 * Dropdown options for Hijri years (current year -3 to +2).
 */
export const HIJRI_YEAR_OPTIONS = (() => {
    const current = getHijriMonthYear();
    const years: { value: number; label: string }[] = [];
    for (let y = current.hy - 3; y <= current.hy + 2; y++) {
        years.push({ value: y, label: `${y} H` });
    }
    return years;
})();

/**
 * Export dayjs instance for custom usage
 */
export { dayjs };
