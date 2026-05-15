import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapSantriToEmisPayload, validateSantriEmisPayload } from "../_shared/emis-mapping.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Sesi admin tidak ditemukan. Silakan login ulang.");
    }

    const { emailWali, passwordWali, namaWali, noHpWali, dataSantri } = await req.json();

    if (!emailWali || !passwordWali || !namaWali) {
      throw new Error("Data tidak lengkap: Email, Password, dan Nama Wali wajib diisi.");
    }
    if (!dataSantri?.nis || !dataSantri?.nama) {
      throw new Error("Data santri tidak lengkap: NIS dan nama wajib diisi.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      },
    );

    let waliId: string;
    let isNewUser = false;

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("email", emailWali)
      .maybeSingle();

    if (existingProfile) {
      waliId = existingProfile.id;
    } else {
      const { data: newAuthData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailWali,
        password: passwordWali,
        email_confirm: true,
        user_metadata: { full_name: namaWali, role: "wali" },
      });

      if (createError) {
        if (createError.message.includes("already been registered")) {
          throw new Error("Email sudah terdaftar sebagai User Auth tapi data profil hilang. Hubungi Admin IT.");
        }
        throw createError;
      }
      if (!newAuthData.user) throw new Error("Gagal membuat user Auth.");
      waliId = newAuthData.user.id;
      isNewUser = true;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: waliId,
        email: emailWali,
        full_name: namaWali,
        no_hp: noHpWali,
        role: "wali",
        is_active: true,
      });

    if (profileError) throw new Error("Gagal update profil wali: " + profileError.message);

    const securePayload = {
      ...dataSantri,
      emis_extra: mapSantriToEmisPayload(dataSantri),
      nama_wali: dataSantri.nama_wali || namaWali,
      no_kontak_wali: dataSantri.no_kontak_wali || noHpWali,
      wali_id: waliId,
      jurusan: dataSantri.jurusan ? String(dataSantri.jurusan).toUpperCase() : null,
    };

    const emisErrors = validateSantriEmisPayload(securePayload);
    if (emisErrors.length > 0) {
      throw new Error(`Validasi EMIS belum lengkap: ${emisErrors.join(" ")}`);
    }

    const { data: santri, error: santriError } = await supabaseUser.rpc("create_santri_secure", {
      p_payload: securePayload,
      p_reason: "create_user_wali_edge_function",
    });

    if (santriError) throw new Error("Gagal menyimpan data santri: " + santriError.message);

    return new Response(
      JSON.stringify({
        success: true,
        message: isNewUser
          ? "Santri & Akun Wali Baru berhasil dibuat."
          : "Santri berhasil ditambahkan ke Wali yang sudah ada (Kakak-Adik).",
        waliId,
        santri,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Terjadi kesalahan internal" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
