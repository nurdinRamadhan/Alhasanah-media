const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const jsonResponse = (body: Record<string, unknown>, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

const normalizeAddress = (address: string) =>
  address
    .replace(/\bRT\.?\s*\d+\b/gi, "")
    .replace(/\bRW\.?\s*\d+\b/gi, "")
    .replace(/\bKec\.?\b/gi, "Kecamatan")
    .replace(/\bKab\.?\b/gi, "Kabupaten")
    .replace(/\bKel\.?\b/gi, "Kelurahan")
    .replace(/\bDs\.?\b/gi, "Desa")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,+/g, ",")
    .replace(/^,\s*|\s*,\s*$/g, "")
    .trim();

const unique = (items: string[]) => Array.from(new Set(items.map(normalizeAddress).filter(Boolean)));

const buildQueryAttempts = (address: string) => {
  const normalized = normalizeAddress(address);
  const parts = normalized.split(",").map((item) => item.trim()).filter(Boolean);
  const withoutIndonesia = parts.filter((item) => item.toLowerCase() !== "indonesia");
  const withIndonesia = (query: string) => query.toLowerCase().includes("indonesia") ? query : `${query}, Indonesia`;

  return unique([
    withIndonesia(normalized),
    withIndonesia(withoutIndonesia.join(", ")),
    withIndonesia(withoutIndonesia.slice(1).join(", ")),
    withIndonesia(withoutIndonesia.slice(-5).join(", ")),
    withIndonesia(withoutIndonesia.slice(-4).join(", ")),
    withIndonesia(withoutIndonesia.slice(-3).join(", ")),
  ]).map((query, index) => ({
    query,
    confidence: index === 0 ? 0.95 : index <= 2 ? 0.8 : index <= 4 ? 0.65 : 0.5,
  }));
};

const searchNominatim = async (query: string, userAgent: string) => {
  const q = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "3",
    countrycodes: "id",
    "accept-language": "id",
  });

  const resp = await fetch(`${NOMINATIM_URL}?${q.toString()}`, {
    headers: { "User-Agent": userAgent },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Response(JSON.stringify({ error: "provider error", detail: text }), {
      status: resp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await resp.json();
  return Array.isArray(data) ? data : [];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  }

  try {
    const { address } = await req.json();
    if (!address || typeof address !== "string") {
      return jsonResponse({ error: "address required" }, { status: 400 });
    }

    const ua = Deno.env.get("NOMINATIM_USER_AGENT") || "alhasanah-admin/1.0";
    const attempts = buildQueryAttempts(address);

    for (const attempt of attempts) {
      const data = await searchNominatim(attempt.query, ua);
      if (data.length > 0) {
        const best = data[0];
        return jsonResponse({
          found: true,
          lat: Number(best.lat),
          lon: Number(best.lon),
          display_name: best.display_name,
          confidence: attempt.confidence,
          matched_query: attempt.query,
          raw: best,
        });
      }
    }

    return jsonResponse({
      found: false,
      error: "no result",
      message: "Alamat tidak ditemukan oleh layanan geocode.",
      attempted_queries: attempts.map((item) => item.query),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(message);
    return jsonResponse({ error: "internal error", message }, { status: 500 });
  }
});
