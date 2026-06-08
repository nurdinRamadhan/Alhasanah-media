import ExcelJS from "exceljs";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv"];

function extensionOf(file: File) {
  const name = file.name.toLowerCase();
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index) : "";
}

function cleanExtractedText(text: string) {
  return text
    .split("\u0000").join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function extractTextFile(file: File) {
  return cleanExtractedText(await file.text());
}

async function extractDocx(file: File) {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return cleanExtractedText(result.value);
}

function rowToText(values: unknown[]) {
  return values
    .slice(1)
    .map((value) => {
      if (value == null) return "";
      if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
        return String((value as Record<string, unknown>).text || "");
      }
      if (typeof value === "object" && "result" in (value as Record<string, unknown>)) {
        return String((value as Record<string, unknown>).result || "");
      }
      return String(value);
    })
    .map((value) => value.replace(/\s+/g, " ").trim())
    .join(" | ")
    .trim();
}

async function extractXlsx(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sections: string[] = [];
  workbook.eachSheet((worksheet) => {
    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const text = rowToText(row.values as unknown[]);
      if (text) rows.push(text);
    });

    if (rows.length) {
      sections.push([`Sheet: ${worksheet.name}`, ...rows].join("\n"));
    }
  });

  return cleanExtractedText(sections.join("\n\n"));
}

async function extractPdf(file: File) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => "str" in item ? item.str : "")
      .join(" ");
    if (text.trim()) pages.push(`Halaman ${pageNumber}\n${text}`);
  }

  return cleanExtractedText(pages.join("\n\n"));
}

export async function extractTextFromFile(file: File) {
  const ext = extensionOf(file);

  if (TEXT_EXTENSIONS.includes(ext)) return extractTextFile(file);
  if (ext === ".docx") return extractDocx(file);
  if (ext === ".xlsx") return extractXlsx(file);
  if (ext === ".pdf") return extractPdf(file);

  throw new Error("Format file belum didukung. Gunakan .txt, .md, .csv, .docx, .xlsx, atau .pdf.");
}
