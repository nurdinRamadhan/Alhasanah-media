export const RAG_LIMITS = {
  maxQueryLength: 500,
  maxTitleLength: 180,
  maxContentLength: 250_000,
  maxChunkSize: 800,
  minChunkSize: 120,
  maxChunkOverlap: 100,
  maxRetrievedChunks: 5,
  maxContextLength: 4000,
};

export type RagSourceType = "public" | "kitab" | "internal";
export type RagDocumentType = "general" | "kitab" | "report" | "policy" | "sop" | "faq";

export function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

export function assertSourceType(value: unknown): RagSourceType {
  if (value === "public" || value === "kitab" || value === "internal") return value;
  throw new Error("source_type tidak valid.");
}

export function assertDocumentType(value: unknown): RagDocumentType {
  if (
    value === "general" ||
    value === "kitab" ||
    value === "report" ||
    value === "policy" ||
    value === "sop" ||
    value === "faq"
  ) return value;
  return "general";
}
