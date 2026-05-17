import { truncate } from "./sanitize.ts";

const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const DEFAULT_COMPLETION_MODEL = "gemini-2.5-flash";

function getGeminiKey() {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY belum tersedia.");
  return apiKey;
}

export function embeddingModel() {
  const configured = Deno.env.get("AI_EMBEDDING_MODEL") || DEFAULT_EMBEDDING_MODEL;
  if (configured === "text-embedding-004") return DEFAULT_EMBEDDING_MODEL;
  return configured;
}

export function completionModel() {
  return Deno.env.get("AI_COMPLETION_MODEL") || DEFAULT_COMPLETION_MODEL;
}

export async function embedText(text: string) {
  const apiKey = getGeminiKey();
  const model = embeddingModel();
  const preparedText = model.startsWith("gemini-embedding")
    ? `title: none | text: ${text}`
    : text;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model.startsWith("gemini-embedding") ? {
        content: { parts: [{ text: preparedText }] },
        output_dimensionality: 768,
      } : {
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
        output_dimensionality: 768,
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    console.error("Gemini embedding error:", JSON.stringify(data));
    throw new Error("Gagal membuat embedding.");
  }

  const values = data.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Response embedding tidak valid.");
  return values as number[];
}

export async function embedQuery(text: string) {
  const apiKey = getGeminiKey();
  const model = embeddingModel();
  const preparedText = model.startsWith("gemini-embedding")
    ? `task: question answering | query: ${text}`
    : text;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model.startsWith("gemini-embedding") ? {
        content: { parts: [{ text: preparedText }] },
        output_dimensionality: 768,
      } : {
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
        output_dimensionality: 768,
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    console.error("Gemini query embedding error:", JSON.stringify(data));
    throw new Error("Gagal membuat embedding query.");
  }

  const values = data.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Response embedding query tidak valid.");
  return values as number[];
}

export async function generateAnswer(systemPrompt: string, userPrompt: string) {
  const apiKey = getGeminiKey();
  const model = completionModel();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    console.error("Gemini completion error:", JSON.stringify(data));
    throw new Error("Gagal membuat jawaban AI.");
  }

  return truncate(data.candidates?.[0]?.content?.parts?.[0]?.text || "", 6000);
}

export async function generateJsonAnswer(systemPrompt: string, userPrompt: string) {
  const apiKey = getGeminiKey();
  const model = completionModel();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 10,
          topP: 0.8,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    console.error("Gemini JSON completion error:", JSON.stringify(data));
    throw new Error("Gagal membuat analisis AI JSON.");
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
