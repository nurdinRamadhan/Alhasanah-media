import { cleanText, RagDocumentType } from "./validation.ts";

function splitWithOverlap(text: string, chunkSize: number, overlap: number) {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = cleanText(text.slice(start, end));
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

function splitLongUnit(unit: string, chunkSize: number, overlap: number) {
  if (unit.length <= chunkSize) return [unit];

  const sentences = unit.split(/(?<=[.!?。؟])\s+/).map(cleanText).filter(Boolean);
  if (sentences.length > 1) {
    const chunks: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      if ((current + " " + sentence).trim().length > chunkSize && current) {
        chunks.push(current);
        current = sentence;
      } else {
        current = `${current} ${sentence}`.trim();
      }
    }
    if (current) chunks.push(current);

    return chunks.flatMap((chunk) => chunk.length > chunkSize
      ? splitWithOverlap(chunk, chunkSize, overlap)
      : [chunk]);
  }

  return splitWithOverlap(unit, chunkSize, overlap);
}

export function smartChunk(
  rawText: string,
  chunkSize = 500,
  overlap = 50,
  documentType: RagDocumentType = "general",
  title?: string,
) {
  const text = cleanText(rawText);
  if (!text) return [];

  const naturalUnits = documentType === "kitab"
    ? text
      .split(/(?=^\s*(?:bab|fasal|pasal)\b.*$)/gim)
      .map(cleanText)
      .filter(Boolean)
    : text.split(/\n{2,}/).map(cleanText).filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  let currentHeading = "";

  for (const unit of naturalUnits) {
    const headingMatch = unit.match(/^\s*(bab|fasal|pasal)\b[^\n]*/i);
    if (headingMatch) currentHeading = cleanText(headingMatch[0]);

    const preparedUnit = documentType === "kitab" && currentHeading && !unit.startsWith(currentHeading)
      ? `[${currentHeading}] ${unit}`
      : unit;

    if (preparedUnit.length > chunkSize) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongUnit(preparedUnit, chunkSize, overlap));
      continue;
    }

    const candidate = `${current}\n\n${preparedUnit}`.trim();
    if (candidate.length > chunkSize && current) {
      chunks.push(current);
      current = preparedUnit;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);

  const prefix = title ? `[${title}] ` : "";
  return chunks
    .map((chunk) => cleanText(prefix + chunk))
    .filter((chunk, index, all) => chunk.length > 0 && all.indexOf(chunk) === index);
}
