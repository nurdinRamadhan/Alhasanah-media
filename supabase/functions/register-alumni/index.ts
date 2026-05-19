import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getClientIp, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type RegisterAlumniRequest = {
  email?: string;
  password?: string;
  full_name?: string;
  tahun_lulus?: number;
  no_wa?: string;
  profesi_sekarang?: string;
  instansi_kerja?: string;
  alamat_domisili?: string;
};

function clean(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeEmail(value: unknown) {
  return clean(value, 254).toLowerCase();
}

function normalizeYear(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) return Number(value);
  return null;
}

function validate(body: RegisterAlumniRequest) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = clean(body.full_name, 160);
  const tahunLulus = normalizeYear(body.tahun_lulus);
  const noWa = clean(body.no_wa, 30);
  const profesiSekarang = clean(body.profesi_sekarang, 120);
  const instansiKerja = clean(body.instansi_kerja, 160);
  const alamatDomisili = clean(body.alamat_domisili, 300);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email tidak valid.");
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error("Password minimal 8 karakter dan maksimal 72 karakter.");
  }
  if (fullName.length < 3) {
    throw new Error("Nama lengkap wajib diisi.");
  }
  const currentYear = new Date().getUTCFullYear();
  if (!tahunLulus || tahunLulus < 1950 || tahunLulus > currentYear + 1) {
    throw new Error("Tahun lulus tidak valid.");
  }

  return {
    email,
    password,
    fullName,
    tahunLulus,
    noWa: noWa || null,
    profesiSekarang: profesiSekarang || null,
    instansiKerja: instansiKerja || null,
    alamatDomisili: alamatDomisili || null,
  };
}

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method tidak didukung." }, 405);
  }

  const supabase = createServiceClient();

  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit(supabase, `register-alumni:${ip}`, 5, 60 * 60);
    if (!rate.allowed) {
      return jsonResponse({ error: "Terlalu banyak pendaftaran. Coba lagi nanti." }, 429);
    }

    const body = validate(await req.json());

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        role: "alumni",
        full_name: body.fullName,
      },
    });

    if (createError || !created.user) {
      const message = createError?.message?.toLowerCase().includes("already")
        ? "Email sudah terdaftar. Silakan gunakan email lain atau masuk dengan akun tersebut."
        : "Gagal membuat akun alumni.";
      return jsonResponse({ error: message }, 400);
    }

    const userId = created.user.id;

    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        email: body.email,
        full_name: body.fullName,
        role: "alumni",
        is_active: false,
      });
      if (profileError) throw profileError;

      const { error: alumniError } = await supabase.from("alumni_data").upsert({
        id: userId,
        full_name: body.fullName,
        tahun_lulus: body.tahunLulus,
        no_wa: body.noWa,
        profesi_sekarang: body.profesiSekarang,
        instansi_kerja: body.instansiKerja,
        alamat_domisili: body.alamatDomisili,
      });
      if (alumniError) throw alumniError;
    } catch (error) {
      console.error("register alumni database error:", error);
      await supabase.auth.admin.deleteUser(userId).catch((deleteError) => {
        console.error("register alumni cleanup error:", deleteError);
      });
      return jsonResponse({ error: "Gagal menyimpan data alumni." }, 500);
    }

    return jsonResponse({
      success: true,
      message: "Pendaftaran alumni berhasil dikirim. Akun Anda menunggu verifikasi admin.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pendaftaran tidak dapat diproses.";
    return jsonResponse({ error: message }, 400);
  }
});
