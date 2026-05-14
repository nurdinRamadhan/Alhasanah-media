const FORBIDDEN_FIELDS = new Set([
  "nik",
  "nis",
  "no_ktp",
  "no_kk",
  "alamat_lengkap",
  "no_telp",
  "no_hp",
  "password",
  "token",
  "refresh_token",
  "bank_account",
  "no_rekening",
]);

export function sanitizeForAI<T>(data: T): T {
  if (Array.isArray(data)) return data.map((item) => sanitizeForAI(item)) as T;
  if (!data || typeof data !== "object") return data;

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (FORBIDDEN_FIELDS.has(key.toLowerCase())) continue;
    output[key] = sanitizeForAI(value);
  }
  return output as T;
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
