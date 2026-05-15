export const santriAlias = (nis?: string | null) => {
  const safe = String(nis || "").replace(/[^0-9A-Za-z]/g, "");
  return `Santri-${safe.slice(-4) || "XXXX"}`;
};

export const sanitizeFilePart = (value?: string | null) =>
  String(value || "data")
    .replace(/[^0-9A-Za-z_-]+/g, "_")
    .slice(0, 40);
