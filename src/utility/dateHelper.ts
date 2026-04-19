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
    "Jumadil Akhira",
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
 * Export dayjs instance for custom usage
 */
export { dayjs };
