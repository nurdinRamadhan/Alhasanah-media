


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."jenis_diklat_enum" AS ENUM (
    'MULUD',
    'SYABAN',
    'RAMADHAN',
    'DZULHIJJAH'
);


ALTER TYPE "public"."jenis_diklat_enum" OWNER TO "postgres";


CREATE TYPE "public"."kategori_mapel_enum" AS ENUM (
    'KITAB',
    'TAHFIDZ'
);


ALTER TYPE "public"."kategori_mapel_enum" OWNER TO "postgres";


CREATE TYPE "public"."nama_kitab_enum" AS ENUM (
    'Jurumiah',
    'Imrity',
    'Nadzmul Maqshud',
    'Alfiyah',
    'Uqudul Juman',
    'Sulam Munawraq'
);


ALTER TYPE "public"."nama_kitab_enum" OWNER TO "postgres";


CREATE TYPE "public"."status_santri" AS ENUM (
    'AKTIF',
    'LULUS',
    'KELUAR',
    'ALUMNI'
);


ALTER TYPE "public"."status_santri" OWNER TO "postgres";


CREATE TYPE "public"."tipe_gender" AS ENUM (
    'L',
    'P'
);


ALTER TYPE "public"."tipe_gender" OWNER TO "postgres";


CREATE TYPE "public"."tipe_jurusan" AS ENUM (
    'KITAB',
    'TAHFIDZ'
);


ALTER TYPE "public"."tipe_jurusan" OWNER TO "postgres";


CREATE TYPE "public"."tipe_kategori_transaksi" AS ENUM (
    'topup',
    'penarikan_tunai',
    'pembayaran_kantin',
    'correction',
    'refund',
    'account_migration_in',
    'account_migration_out',
    'settlement_to_pesantren_ledger'
);


ALTER TYPE "public"."tipe_kategori_transaksi" OWNER TO "postgres";


CREATE TYPE "public"."tipe_kelas" AS ENUM (
    '1',
    '2',
    '3'
);


ALTER TYPE "public"."tipe_kelas" OWNER TO "postgres";


CREATE TYPE "public"."tipe_status_transaksi" AS ENUM (
    'pending',
    'success',
    'failed',
    'expire',
    'cancel'
);


ALTER TYPE "public"."tipe_status_transaksi" OWNER TO "postgres";


CREATE TYPE "public"."wallet_account_status" AS ENUM (
    'active',
    'locked',
    'closed'
);


ALTER TYPE "public"."wallet_account_status" OWNER TO "postgres";


CREATE TYPE "public"."wallet_device_status" AS ENUM (
    'active',
    'revoked',
    'lost',
    'replaced'
);


ALTER TYPE "public"."wallet_device_status" OWNER TO "postgres";


CREATE TYPE "public"."wallet_direction" AS ENUM (
    'credit',
    'debit'
);


ALTER TYPE "public"."wallet_direction" OWNER TO "postgres";


CREATE TYPE "public"."wallet_intent_status" AS ENUM (
    'pending',
    'requires_authorization',
    'authorized',
    'processing',
    'posted',
    'failed',
    'expired',
    'cancelled',
    'reversed'
);


ALTER TYPE "public"."wallet_intent_status" OWNER TO "postgres";


CREATE TYPE "public"."wallet_qr_status" AS ENUM (
    'active',
    'revoked',
    'expired'
);


ALTER TYPE "public"."wallet_qr_status" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "role" "text",
    "full_name" "text",
    "is_active" boolean DEFAULT true,
    "foto_url" "text",
    "no_hp" "text",
    "akses_gender" "text" DEFAULT 'ALL'::"text",
    "akses_jurusan" "text" DEFAULT 'ALL'::"text",
    "telegram_id" bigint,
    "telegram_username" character varying(100),
    "last_bot_query" timestamp with time zone,
    CONSTRAINT "profiles_akses_gender_check" CHECK (("akses_gender" = ANY (ARRAY['L'::"text", 'P'::"text", 'ALL'::"text"]))),
    CONSTRAINT "profiles_akses_jurusan_check" CHECK (("akses_jurusan" = ANY (ARRAY['TAHFIDZ'::"text", 'KITAB'::"text", 'ALL'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_geocode_to_santri"("p_nis" "text", "p_lat" double precision, "p_lon" double precision, "p_provider" "text", "p_confidence" double precision) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  if p_lat is null or p_lon is null then
    raise exception 'lat/lon required';
  end if;

  if p_confidence is not null and p_confidence < 0.4 then
    update public.santri
       set geocode_status = 'FAILED',
           geocode_provider = p_provider,
           geocode_confidence = p_confidence,
           geocoded_at = now(),
           updated_at = now()
     where nis = p_nis;
    return;
  end if;

  update public.santri
     set latitude = p_lat,
         longitude = p_lon,
         geom = ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326),
         geocode_status = 'GEOCODED',
         geocode_provider = p_provider,
         geocode_confidence = p_confidence,
         geocoded_at = now(),
         updated_at = now()
   where nis = p_nis;
end;
$$;


ALTER FUNCTION "public"."apply_geocode_to_santri"("p_nis" "text", "p_lat" double precision, "p_lon" double precision, "p_provider" "text", "p_confidence" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_notification_v2"("p_title" "text", "p_body" "text", "p_target_kelas" "text" DEFAULT 'ALL'::"text", "p_source" "text" DEFAULT 'broadcast_admin'::"text") RETURNS TABLE("inserted_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
  select * from public.broadcast_notification_v3(p_title, p_body, p_target_kelas, p_source)
$$;


ALTER FUNCTION "public"."broadcast_notification_v2"("p_title" "text", "p_body" "text", "p_target_kelas" "text", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_notification_v3"("p_title" "text", "p_body" "text", "p_target_kelas" "text" DEFAULT 'ALL'::"text", "p_source" "text" DEFAULT 'broadcast_admin'::"text") RETURNS TABLE("inserted_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private', 'extensions'
    AS $$
declare
  v_count bigint;
begin
  if not (app_private.current_user_role() = any(array['super_admin','admin_kesantrian','kesantrian','rois'])) then
    raise exception 'Not authorized';
  end if;

  insert into public.notification_queue (user_id, title, body, source_table, data)
  select distinct on (wali_id)
    wali_id, p_title, p_body, p_source,
    jsonb_build_object('type', 'broadcast', 'target', p_target_kelas)
  from public.santri
  where wali_id is not null
    and (p_target_kelas = 'ALL' or kelas::text = p_target_kelas);

  get diagnostics v_count = row_count;
  return query select v_count;
end;
$$;


ALTER FUNCTION "public"."broadcast_notification_v3"("p_title" "text", "p_body" "text", "p_target_kelas" "text", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_access_scope"("target_gender" "text", "target_jurusan" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  my_role text;
  my_gender_scope text;
  my_jurusan_scope text;
BEGIN
  -- 1. Ambil data si pengakses (User yang login)
  SELECT role, akses_gender, akses_jurusan 
  INTO my_role, my_gender_scope, my_jurusan_scope
  FROM public.profiles
  WHERE id = auth.uid();

  -- 2. Super Admin & Kyai & Rois bebas akses segalanya (God Mode)
  IF my_role IN ('super_admin', 'dewan_kiyai', 'rois') THEN
    RETURN true;
  END IF;

  -- 3. Cek Scope Gender
  -- Jika scope saya 'ALL', lolos. Jika tidak, harus sama dengan gender target.
  IF my_gender_scope != 'ALL' AND my_gender_scope != target_gender THEN
    RETURN false;
  END IF;

  -- 4. Cek Scope Jurusan (Khusus untuk admin akademik/kesantrian)
  -- Jika target jurusan NULL (misal data umum), anggap lolos atau sesuaikan logika.
  IF target_jurusan IS NOT NULL AND my_jurusan_scope != 'ALL' AND my_jurusan_scope != target_jurusan THEN
    RETURN false;
  END IF;

  -- 5. Jika lolos semua pengecekan
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."check_access_scope"("target_gender" "text", "target_jurusan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_for_wali"("p_santri_nis" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_source" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    v_wali_id UUID;
BEGIN
    -- Ambil wali_id (UUID) dari tabel santri berdasarkan NIS
    SELECT wali_id INTO v_wali_id FROM public.santri WHERE nis = p_santri_nis;
    
    -- Jika wali ditemukan, masukkan ke antrean
    IF v_wali_id IS NOT NULL THEN
        INSERT INTO public.notification_queue (user_id, title, body, data, source_table)
        VALUES (v_wali_id, p_title, p_body, p_data, p_source);
    END IF;
END;
$$;


ALTER FUNCTION "public"."create_notification_for_wali"("p_santri_nis" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_santri_secure"("p_payload" "jsonb", "p_reason" "text" DEFAULT 'admin_create'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_nis text := nullif(p_payload->>'nis', '');
  v_tanggal_lahir date := nullif(p_payload->>'tanggal_lahir', '')::date;
  v_tanggal_masuk date := nullif(p_payload->>'tanggal_masuk', '')::date;
  v_tanggal_lulus_keluar date := nullif(p_payload->>'tanggal_lulus_keluar', '')::date;
begin
  if not app_private.is_santri_admin() then
    raise exception 'Not authorized';
  end if;

  if v_nis is null then
    raise exception 'NIS wajib diisi';
  end if;

  insert into public.santri (
    nis, nama, kelas, jurusan, pembimbing, foto_url, status_spp, anak_ke, wali_id,
    jenis_kelamin, hafalan_kitab, total_hafalan, status_santri,
    latitude, longitude, kecamatan_id, geocode_status, geocode_provider, geocode_confidence, geocoded_at,
    nsp, nis_hash, nis_enc, nisn_hash, nisn_enc, nik_hash, nik_enc, no_kk_hash, no_kk_enc,
    nama_enc, tempat_lahir_enc, tanggal_lahir_enc, alamat_lengkap_enc, no_kontak_wali_enc,
    ayah_enc, ibu_enc, nama_wali_enc, nik_ayah_hash, nik_ayah_enc, nik_ibu_hash, nik_ibu_enc,
    nik_wali_hash, nik_wali_enc, no_kip_hash, no_kip_enc,
    agama, kewarganegaraan, status_mukim, rt, rw, desa_kelurahan, kabupaten_kota, provinsi, kode_pos,
    jarak_rumah_km, tahun_masuk, tanggal_masuk, tahun_lulus_keluar, tanggal_lulus_keluar, alasan_keluar,
    penerima_pip, penerima_beasiswa, jenis_beasiswa, kebutuhan_khusus,
    pendidikan_ayah, pekerjaan_ayah, penghasilan_ayah, status_ayah,
    pendidikan_ibu, pekerjaan_ibu, penghasilan_ibu, status_ibu,
    pendidikan_wali, pekerjaan_wali, penghasilan_wali, hubungan_wali,
    emis_extra
  ) values (
    v_nis,
    nullif(p_payload->>'nama', ''),
    nullif(p_payload->>'kelas', '')::public.tipe_kelas,
    nullif(upper(p_payload->>'jurusan'), '')::public.tipe_jurusan,
    nullif(p_payload->>'pembimbing', ''),
    nullif(p_payload->>'foto_url', ''),
    nullif(p_payload->>'status_spp', ''),
    nullif(p_payload->>'anak_ke', ''),
    nullif(p_payload->>'wali_id', '')::uuid,
    nullif(p_payload->>'jenis_kelamin', '')::public.tipe_gender,
    nullif(p_payload->>'hafalan_kitab', ''),
    nullif(p_payload->>'total_hafalan', ''),
    coalesce(nullif(p_payload->>'status_santri', '')::public.status_santri, 'AKTIF'::public.status_santri),
    nullif(p_payload->>'latitude', '')::double precision,
    nullif(p_payload->>'longitude', '')::double precision,
    nullif(p_payload->>'kecamatan_id', ''),
    nullif(p_payload->>'geocode_status', ''),
    nullif(p_payload->>'geocode_provider', ''),
    nullif(p_payload->>'geocode_confidence', '')::double precision,
    case when nullif(p_payload->>'geocoded_at', '') is null then null else (p_payload->>'geocoded_at')::timestamptz end,
    nullif(p_payload->>'nsp', ''),
    app_private.hash_identifier(v_nis),
    app_private.encrypt_text(v_nis),
    app_private.hash_identifier(p_payload->>'nisn'),
    app_private.encrypt_text(p_payload->>'nisn'),
    app_private.hash_identifier(p_payload->>'nik'),
    app_private.encrypt_text(p_payload->>'nik'),
    app_private.hash_identifier(p_payload->>'no_kk'),
    app_private.encrypt_text(p_payload->>'no_kk'),
    app_private.encrypt_text(p_payload->>'nama'),
    app_private.encrypt_text(p_payload->>'tempat_lahir'),
    app_private.encrypt_text(case when v_tanggal_lahir is null then null else v_tanggal_lahir::text end),
    app_private.encrypt_text(p_payload->>'alamat_lengkap'),
    app_private.encrypt_text(p_payload->>'no_kontak_wali'),
    app_private.encrypt_text(p_payload->>'ayah'),
    app_private.encrypt_text(p_payload->>'ibu'),
    app_private.encrypt_text(p_payload->>'nama_wali'),
    app_private.hash_identifier(p_payload->>'nik_ayah'),
    app_private.encrypt_text(p_payload->>'nik_ayah'),
    app_private.hash_identifier(p_payload->>'nik_ibu'),
    app_private.encrypt_text(p_payload->>'nik_ibu'),
    app_private.hash_identifier(p_payload->>'nik_wali'),
    app_private.encrypt_text(p_payload->>'nik_wali'),
    app_private.hash_identifier(p_payload->>'no_kip'),
    app_private.encrypt_text(p_payload->>'no_kip'),
    coalesce(nullif(p_payload->>'agama', ''), 'ISLAM'),
    coalesce(nullif(p_payload->>'kewarganegaraan', ''), 'WNI'),
    nullif(p_payload->>'status_mukim', ''),
    nullif(p_payload->>'rt', ''),
    nullif(p_payload->>'rw', ''),
    nullif(p_payload->>'desa_kelurahan', ''),
    nullif(p_payload->>'kabupaten_kota', ''),
    nullif(p_payload->>'provinsi', ''),
    nullif(p_payload->>'kode_pos', ''),
    nullif(p_payload->>'jarak_rumah_km', '')::numeric,
    coalesce(nullif(p_payload->>'tahun_masuk', '')::integer, extract(year from now())::integer),
    v_tanggal_masuk,
    nullif(p_payload->>'tahun_lulus_keluar', '')::integer,
    v_tanggal_lulus_keluar,
    nullif(p_payload->>'alasan_keluar', ''),
    coalesce(nullif(p_payload->>'penerima_pip', '')::boolean, false),
    coalesce(nullif(p_payload->>'penerima_beasiswa', '')::boolean, false),
    nullif(p_payload->>'jenis_beasiswa', ''),
    nullif(p_payload->>'kebutuhan_khusus', ''),
    nullif(p_payload->>'pendidikan_ayah', ''),
    nullif(p_payload->>'pekerjaan_ayah', ''),
    nullif(p_payload->>'penghasilan_ayah', ''),
    nullif(p_payload->>'status_ayah', ''),
    nullif(p_payload->>'pendidikan_ibu', ''),
    nullif(p_payload->>'pekerjaan_ibu', ''),
    nullif(p_payload->>'penghasilan_ibu', ''),
    nullif(p_payload->>'status_ibu', ''),
    nullif(p_payload->>'pendidikan_wali', ''),
    nullif(p_payload->>'pekerjaan_wali', ''),
    nullif(p_payload->>'penghasilan_wali', ''),
    nullif(p_payload->>'hubungan_wali', ''),
    coalesce(p_payload->'emis_extra', '{}'::jsonb)
  );

  perform app_private.audit_sensitive_access('CREATE_SENSITIVE', 'santri', v_nis, jsonb_build_object('reason', coalesce(p_reason, 'admin_create')));
  return public.get_santri_detail_secure(v_nis, 'post_create');
end;
$$;


ALTER FUNCTION "public"."create_santri_secure"("p_payload" "jsonb", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_emis_pesantren_santri"("p_status" "text" DEFAULT NULL::"text", "p_tahun_masuk" integer DEFAULT NULL::integer) RETURNS TABLE("nsp" "text", "no_induk_santri" "text", "nisn" "text", "nama_lengkap" "text", "nik" "text", "jenis_kelamin" "text", "tempat_lahir" "text", "tanggal_lahir" "text", "agama" "text", "kewarganegaraan" "text", "status_mukim" "text", "alamat_lengkap" "text", "rt" "text", "rw" "text", "desa_kelurahan" "text", "kecamatan_id" "text", "kabupaten_kota" "text", "provinsi" "text", "kode_pos" "text", "nama_ayah" "text", "nik_ayah" "text", "pendidikan_ayah" "text", "pekerjaan_ayah" "text", "penghasilan_ayah" "text", "nama_ibu" "text", "nik_ibu" "text", "pendidikan_ibu" "text", "pekerjaan_ibu" "text", "penghasilan_ibu" "text", "nama_wali" "text", "nik_wali" "text", "hubungan_wali" "text", "no_hp_wali" "text", "tahun_masuk" integer, "kelas" "text", "program_pesantren" "text", "status_santri" "text", "penerima_pip" boolean, "no_kip" "text", "penerima_beasiswa" boolean, "jenis_beasiswa" "text", "kebutuhan_khusus" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
  select * from public.export_santri_emis(p_status, p_tahun_masuk)
$$;


ALTER FUNCTION "public"."export_emis_pesantren_santri"("p_status" "text", "p_tahun_masuk" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."export_emis_pesantren_santri"("p_status" "text", "p_tahun_masuk" integer) IS 'Secure EMIS Pesantren export. Decrypts sensitive santri fields only for authorized admin roles and writes audit log.';



CREATE OR REPLACE FUNCTION "public"."export_santri_emis"("p_status" "text" DEFAULT NULL::"text", "p_tahun_masuk" integer DEFAULT NULL::integer) RETURNS TABLE("nsp" "text", "no_induk_santri" "text", "nisn" "text", "nama_lengkap" "text", "nik" "text", "jenis_kelamin" "text", "tempat_lahir" "text", "tanggal_lahir" "text", "agama" "text", "kewarganegaraan" "text", "status_mukim" "text", "alamat_lengkap" "text", "rt" "text", "rw" "text", "desa_kelurahan" "text", "kecamatan_id" "text", "kabupaten_kota" "text", "provinsi" "text", "kode_pos" "text", "nama_ayah" "text", "nik_ayah" "text", "pendidikan_ayah" "text", "pekerjaan_ayah" "text", "penghasilan_ayah" "text", "nama_ibu" "text", "nik_ibu" "text", "pendidikan_ibu" "text", "pekerjaan_ibu" "text", "penghasilan_ibu" "text", "nama_wali" "text", "nik_wali" "text", "hubungan_wali" "text", "no_hp_wali" "text", "tahun_masuk" integer, "kelas" "text", "program_pesantren" "text", "status_santri" "text", "penerima_pip" boolean, "no_kip" "text", "penerima_beasiswa" boolean, "jenis_beasiswa" "text", "kebutuhan_khusus" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
begin
  if not (app_private.current_user_role() = any(array['super_admin','admin_kesantrian','kesantrian','rois'])) then
    raise exception 'Not authorized for EMIS export';
  end if;

  perform app_private.audit_sensitive_access('EXPORT_EMIS', 'santri', 'bulk', jsonb_build_object('status', p_status, 'tahun_masuk', p_tahun_masuk, 'mapping', 'final'));

  return query
  select
    s.nsp,
    s.nis,
    app_private.decrypt_text(s.nisn_enc),
    coalesce(s.nama, app_private.decrypt_text(s.nama_enc)),
    app_private.decrypt_text(s.nik_enc),
    s.jenis_kelamin::text,
    app_private.decrypt_text(s.tempat_lahir_enc),
    app_private.decrypt_text(s.tanggal_lahir_enc),
    app_private.emis_agama_code(s.agama),
    coalesce(s.kewarganegaraan, 'WNI'),
    coalesce(s.emis_extra->>'tinggal_bersama', app_private.emis_status_mukim_code(s.status_mukim)),
    app_private.decrypt_text(s.alamat_lengkap_enc),
    s.rt,
    s.rw,
    s.desa_kelurahan,
    s.kecamatan_id,
    s.kabupaten_kota,
    s.provinsi,
    s.kode_pos,
    app_private.decrypt_text(s.ayah_enc),
    app_private.decrypt_text(s.nik_ayah_enc),
    app_private.emis_education_code(s.pendidikan_ayah),
    app_private.emis_job_code(s.pekerjaan_ayah),
    app_private.emis_income_code(s.penghasilan_ayah),
    app_private.decrypt_text(s.ibu_enc),
    app_private.decrypt_text(s.nik_ibu_enc),
    app_private.emis_education_code(s.pendidikan_ibu),
    app_private.emis_job_code(s.pekerjaan_ibu),
    app_private.emis_income_code(s.penghasilan_ibu),
    app_private.decrypt_text(s.nama_wali_enc),
    app_private.decrypt_text(s.nik_wali_enc),
    coalesce(nullif(s.hubungan_wali, ''), 'Ayah Kandung'),
    app_private.decrypt_text(s.no_kontak_wali_enc),
    s.tahun_masuk,
    s.kelas::text,
    coalesce(s.emis_extra->>'program_pesantren_kode', app_private.emis_program_pesantren_code(s.jurusan::text)),
    s.status_santri::text,
    coalesce(s.penerima_pip, false),
    app_private.decrypt_text(s.no_kip_enc),
    coalesce(s.penerima_beasiswa, false),
    s.jenis_beasiswa,
    coalesce(s.kebutuhan_khusus, '01')
  from public.santri s
  where public.check_access_scope(s.jenis_kelamin::text, s.jurusan::text)
    and (p_status is null or s.status_santri::text = p_status)
    and (p_tahun_masuk is null or s.tahun_masuk = p_tahun_masuk)
  order by s.kelas::text, coalesce(s.nama, app_private.decrypt_text(s.nama_enc)), s.nis;
end;
$$;


ALTER FUNCTION "public"."export_santri_emis"("p_status" "text", "p_tahun_masuk" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sync_diklat_to_transaksi"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    total_bayar BIGINT;
BEGIN
    IF (OLD.status_pembayaran != 'LUNAS' AND NEW.status_pembayaran = 'LUNAS') THEN
        total_bayar := NEW.biaya_pendaftaran + NEW.belanja_kitab_nominal;
        
        INSERT INTO public.transaksi_keuangan (
            jumlah,
            tanggal_transaksi,
            status_transaksi,
            status, -- enum: success
            metode_pembayaran,
            jenis_transaksi,
            admin_pencatat_id,
            keterangan
        ) VALUES (
            total_bayar,
            now(),
            'settlement',
            'success', -- Enum value yang benar
            'cash',
            'masuk',
            auth.uid(),
            '[SISTEM] Biaya Pasaran/Diklat: ' || NEW.nama_lengkap || ' (' || NEW.jenis_diklat || ')'
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_sync_diklat_to_transaksi"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sync_pengeluaran_to_transaksi"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    INSERT INTO public.transaksi_keuangan (
        jumlah,
        tanggal_transaksi,
        status_transaksi,
        status, -- enum: success
        metode_pembayaran,
        jenis_transaksi,
        admin_pencatat_id,
        keterangan
    ) VALUES (
        NEW.nominal,
        NEW.tanggal_pengeluaran::timestamp,
        'settlement',
        'success', -- Enum value yang benar
        'cash',
        'keluar',
        auth.uid(),
        '[SISTEM] Pengeluaran: ' || NEW.judul
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_sync_pengeluaran_to_transaksi"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sync_tagihan_to_transaksi"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    v_wali_id UUID;
BEGIN
    IF (OLD.status != 'LUNAS' AND NEW.status = 'LUNAS') THEN
        SELECT wali_id INTO v_wali_id FROM public.santri WHERE nis = NEW.santri_nis;

        -- Hanya jalankan jika dilakukan oleh Admin (Auth UID ada)
        -- Transaksi Midtrans ditangani oleh Edge Function secara mandiri
        IF (auth.uid() IS NOT NULL) THEN
            INSERT INTO public.transaksi_keuangan (
                jumlah,
                tanggal_transaksi,
                status_transaksi, -- text
                status,           -- enum: success
                metode_pembayaran,
                jenis_transaksi,
                santri_nis,
                wali_id,
                admin_pencatat_id,
                keterangan
            ) VALUES (
                NEW.nominal_tagihan,
                now(),
                'settlement',
                'success', -- Enum value yang benar
                'cash',
                'masuk',
                NEW.santri_nis,
                v_wali_id,
                auth.uid(),
                '[SISTEM] Pembayaran SPP/Tagihan (Tunai): ' || NEW.deskripsi_tagihan
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_sync_tagihan_to_transaksi"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_rupiah"("nominal" numeric) RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    RETURN to_char(nominal, 'FM999G999G999G999');
END;
$$;


ALTER FUNCTION "public"."format_rupiah"("nominal" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_admin_monitor"("p_limit" integer DEFAULT 50) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_result jsonb;
begin
  if not app_private.is_current_user_forum_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.audit_logs(user_id, user_name, user_role, action, resource, record_id, details, meta_info)
  select auth.uid(), p.full_name, p.role, 'CHAT_ADMIN_MONITOR', 'chat', 'bulk', jsonb_build_object('limit', v_limit), 'chat-admin-monitor'
  from public.profiles p
  where p.id = auth.uid();

  select jsonb_build_object(
    'stats', jsonb_build_object(
      'conversations', (select count(*) from public.chat_conversations),
      'messages', (select count(*) from public.chat_messages where deleted_at is null),
      'encrypted_messages', (select count(*) from public.chat_messages where deleted_at is null and encryption_scheme = 'e2ee_v1'),
      'legacy_redacted_messages', (select count(*) from public.chat_messages where deleted_at is null and encryption_scheme = 'legacy_plaintext'),
      'open_reports', (select count(*) from public.chat_message_reports where status = 'open'),
      'online_users', (select count(*) from public.chat_user_presence where is_online = true),
      'blocked_pairs', (select count(*) from public.chat_blocks)
    ),
    'conversations', coalesce((
      select jsonb_agg(row_data order by (row_data->>'last_message_at') desc nulls last)
      from (
        select jsonb_build_object(
          'id', c.id,
          'type', c.type,
          'title', c.title,
          'created_at', c.created_at,
          'updated_at', c.updated_at,
          'last_message_at', c.last_message_at,
          'last_message_preview', case
            when c.last_message_preview = 'Pesan dihapus' then 'Pesan dihapus'
            else 'Pesan terenkripsi'
          end,
          'created_by', jsonb_build_object('id', creator.id, 'full_name', creator.full_name, 'email', creator.email),
          'last_sender', jsonb_build_object('id', sender.id, 'full_name', sender.full_name, 'email', sender.email),
          'participant_count', coalesce(pc.participant_count, 0),
          'message_count', coalesce(mc.message_count, 0),
          'open_report_count', coalesce(rc.open_report_count, 0),
          'participants', coalesce(pp.participants, '[]'::jsonb)
        ) as row_data
        from public.chat_conversations c
        left join public.profiles creator on creator.id = c.created_by
        left join public.profiles sender on sender.id = c.last_message_sender_id
        left join lateral (
          select count(*) as participant_count from public.chat_participants cp where cp.conversation_id = c.id
        ) pc on true
        left join lateral (
          select count(*) as message_count from public.chat_messages cm where cm.conversation_id = c.id and cm.deleted_at is null
        ) mc on true
        left join lateral (
          select count(*) as open_report_count from public.chat_message_reports cr where cr.conversation_id = c.id and cr.status = 'open'
        ) rc on true
        left join lateral (
          select jsonb_agg(jsonb_build_object(
            'user_id', cp.user_id,
            'role', cp.role,
            'joined_at', cp.joined_at,
            'archived_at', cp.archived_at,
            'muted_until', cp.muted_until,
            'profile', jsonb_build_object('full_name', p.full_name, 'email', p.email, 'role', p.role)
          ) order by cp.joined_at) as participants
          from public.chat_participants cp
          left join public.profiles p on p.id = cp.user_id
          where cp.conversation_id = c.id
        ) pp on true
        order by c.last_message_at desc nulls last, c.updated_at desc
        limit v_limit
      ) q
    ), '[]'::jsonb),
    'recent_messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cm.id,
        'conversation_id', cm.conversation_id,
        'sender', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email),
        'message_type', cm.message_type,
        'status', cm.status,
        'encryption_scheme', cm.encryption_scheme,
        'e2ee_version', cm.e2ee_version,
        'content_preview', case
          when cm.deleted_at is not null then '[deleted]'
          when cm.encryption_scheme = 'e2ee_v1' then '[encrypted]'
          else '[legacy-redacted]'
        end,
        'created_at', cm.created_at,
        'edited_at', cm.edited_at,
        'deleted_at', cm.deleted_at
      ) order by cm.created_at desc)
      from (
        select * from public.chat_messages order by created_at desc limit v_limit
      ) cm
      left join public.profiles p on p.id = cm.sender_id
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'reason', r.reason,
        'note', r.note,
        'created_at', r.created_at,
        'reviewed_at', r.reviewed_at,
        'conversation_id', r.conversation_id,
        'reporter', jsonb_build_object('id', reporter.id, 'full_name', reporter.full_name, 'email', reporter.email),
        'reviewed_by', jsonb_build_object('id', reviewer.id, 'full_name', reviewer.full_name, 'email', reviewer.email),
        'message', jsonb_build_object(
          'id', m.id,
          'sender', jsonb_build_object('id', sender.id, 'full_name', sender.full_name, 'email', sender.email),
          'message_type', m.message_type,
          'status', m.status,
          'encryption_scheme', m.encryption_scheme,
          'e2ee_version', m.e2ee_version,
          'content_preview', case
            when m.deleted_at is not null then '[deleted]'
            when m.encryption_scheme = 'e2ee_v1' then '[encrypted]'
            else '[legacy-redacted]'
          end,
          'created_at', m.created_at
        )
      ) order by r.created_at desc)
      from (
        select * from public.chat_message_reports order by created_at desc limit v_limit
      ) r
      left join public.profiles reporter on reporter.id = r.reporter_id
      left join public.profiles reviewer on reviewer.id = r.reviewed_by
      left join public.chat_messages m on m.id = r.message_id
      left join public.profiles sender on sender.id = m.sender_id
    ), '[]'::jsonb),
    'presence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', cup.user_id,
        'is_online', cup.is_online,
        'last_seen_at', cup.last_seen_at,
        'updated_at', cup.updated_at,
        'profile', jsonb_build_object('full_name', p.full_name, 'email', p.email, 'role', p.role)
      ) order by cup.is_online desc, cup.last_seen_at desc)
      from (
        select * from public.chat_user_presence order by is_online desc, last_seen_at desc limit v_limit
      ) cup
      left join public.profiles p on p.id = cup.user_id
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'blocker', jsonb_build_object('id', blocker.id, 'full_name', blocker.full_name, 'email', blocker.email),
        'blocked', jsonb_build_object('id', blocked.id, 'full_name', blocked.full_name, 'email', blocked.email),
        'created_at', cb.created_at
      ) order by cb.created_at desc)
      from (
        select * from public.chat_blocks order by created_at desc limit v_limit
      ) cb
      left join public.profiles blocker on blocker.id = cb.blocker_id
      left join public.profiles blocked on blocked.id = cb.blocked_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_chat_admin_monitor"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_choropleth_data"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private', 'extensions'
    AS $$
declare
  v_result jsonb;
begin
  if not app_private.is_santri_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', st_asgeojson(geom)::jsonb,
        'properties', jsonb_build_object('id', id, 'nama', nama, 'santri_count', santri_count)
      )
    ), '[]'::jsonb)
  ) into v_result
  from (
    select kp.id, kp.nama, kp.geom, count(s.nis) as santri_count
    from public.kecamatan_polygons kp
    left join public.santri s on s.kecamatan_id = kp.id
    group by kp.id, kp.nama, kp.geom
  ) subquery;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_choropleth_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return (
    select role
    from public.profiles
    where id = (select auth.uid())
  );
end;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rag_admin_context"("p_context_type" "text" DEFAULT 'operational'::"text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_result jsonb := '{}'::jsonb;
  v_month text := nullif(p_filters ->> 'bulan', '');
  v_year text := nullif(p_filters ->> 'tahun', '');
  v_kelas text := nullif(p_filters ->> 'kelas', '');
  v_start date;
  v_end date;
begin
  if v_year is not null and v_month is not null then
    v_start := to_date(v_year || '-' || lpad(v_month, 2, '0') || '-01', 'YYYY-MM-DD');
    v_end := (v_start + interval '1 month')::date;
  elsif v_year is not null then
    v_start := to_date(v_year || '-01-01', 'YYYY-MM-DD');
    v_end := (v_start + interval '1 year')::date;
  else
    v_start := date_trunc('month', now())::date;
    v_end := (v_start + interval '1 month')::date;
  end if;

  v_result := v_result || jsonb_build_object(
    'periode', jsonb_build_object('start', v_start, 'end_exclusive', v_end, 'kelas_filter', v_kelas),
    'santri_summary', jsonb_build_object(
      'total', coalesce((select count(*) from santri s where (v_kelas is null or s.kelas::text = v_kelas)), 0),
      'aktif', coalesce((select count(*) from santri s where s.status_santri::text = 'AKTIF' and (v_kelas is null or s.kelas::text = v_kelas)), 0),
      'per_kelas', coalesce((select jsonb_object_agg(kelas, total) from (select s.kelas::text as kelas, count(*) as total from santri s where (v_kelas is null or s.kelas::text = v_kelas) group by s.kelas::text) x), '{}'::jsonb),
      'per_jurusan', coalesce((select jsonb_object_agg(jurusan, total) from (select s.jurusan::text as jurusan, count(*) total from santri s where (v_kelas is null or s.kelas::text = v_kelas) group by s.jurusan::text) j), '{}'::jsonb)
    )
  );

  if p_context_type in ('financial','operational','santri') then
    v_result := v_result || jsonb_build_object(
      'financial_summary', jsonb_build_object(
        'tagihan_total', coalesce((select sum(ts.nominal_tagihan) from tagihan_santri ts join santri s on s.nis = ts.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and ts.created_at >= v_start and ts.created_at < v_end), 0),
        'sisa_tagihan_total', coalesce((select sum(ts.sisa_tagihan) from tagihan_santri ts join santri s on s.nis = ts.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and ts.created_at >= v_start and ts.created_at < v_end), 0),
        'tagihan_per_status', coalesce((select jsonb_object_agg(status, total) from (select ts.status, count(*) total from tagihan_santri ts join santri s on s.nis = ts.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and ts.created_at >= v_start and ts.created_at < v_end group by ts.status) x), '{}'::jsonb),
        'pemasukan_sukses', coalesce((select sum(tk.jumlah) from transaksi_keuangan tk where (tk.status_transaksi in ('success','settlement') or tk.status::text in ('success','settlement')) and tk.tanggal_transaksi >= v_start and tk.tanggal_transaksi < v_end), 0),
        'pengeluaran_total', coalesce((select sum(p.nominal) from pengeluaran p where p.tanggal_pengeluaran >= v_start and p.tanggal_pengeluaran < v_end), 0),
        'pengeluaran_per_kategori', coalesce((select jsonb_object_agg(kategori, total) from (select p.kategori, sum(p.nominal) total from pengeluaran p where p.tanggal_pengeluaran >= v_start and p.tanggal_pengeluaran < v_end group by p.kategori) x), '{}'::jsonb)
      )
    );
  end if;

  if p_context_type in ('academic','santri','operational') then
    v_result := v_result || jsonb_build_object(
      'academic_summary', jsonb_build_object(
        'hafalan_tahfidz_setoran', coalesce((select count(*) from hafalan_tahfidz h join santri s on s.nis = h.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and h.tanggal >= v_start and h.tanggal < v_end), 0),
        'hafalan_tahfidz_avg_total', coalesce((select round(avg(nullif(h.total_hafalan,0))::numeric, 2) from hafalan_tahfidz h join santri s on s.nis = h.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and h.tanggal >= v_start and h.tanggal < v_end), 0),
        'hafalan_kitab_setoran', coalesce((select count(*) from hafalan_kitab h join santri s on s.nis = h.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and h.tanggal >= v_start and h.tanggal < v_end), 0),
        'hafalan_kitab_per_kitab', coalesce((select jsonb_object_agg(nama_kitab, total) from (select h.nama_kitab, count(*) total from hafalan_kitab h join santri s on s.nis = h.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and h.tanggal >= v_start and h.tanggal < v_end group by h.nama_kitab) x), '{}'::jsonb)
      )
    );
  end if;

  if p_context_type in ('santri','operational') then
    v_result := v_result || jsonb_build_object(
      'student_affairs_summary', jsonb_build_object(
        'pelanggaran_count', coalesce((select count(*) from pelanggaran_santri p join santri s on s.nis = p.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and p.tanggal >= v_start and p.tanggal < v_end), 0),
        'pelanggaran_poin_total', coalesce((select sum(p.poin) from pelanggaran_santri p join santri s on s.nis = p.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and p.tanggal >= v_start and p.tanggal < v_end), 0),
        'kesehatan_count', coalesce((select count(*) from kesehatan_santri k join santri s on s.nis = k.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and k.tanggal >= v_start and k.tanggal < v_end), 0),
        'perizinan_per_status', coalesce((select jsonb_object_agg(status, total) from (select p.status, count(*) total from perizinan_santri p join santri s on s.nis = p.santri_nis where (v_kelas is null or s.kelas::text = v_kelas) and p.tanggal >= v_start and p.tanggal < v_end group by p.status) x), '{}'::jsonb)
      )
    );
  end if;

  if p_context_type in ('operational') then
    v_result := v_result || jsonb_build_object(
      'operational_summary', jsonb_build_object(
        'inventaris_total_item', coalesce((select sum(i.jumlah) from inventaris i), 0),
        'inventaris_total_nilai', coalesce((select sum(i.harga_perolehan * i.jumlah) from inventaris i), 0),
        'inventaris_per_kondisi', coalesce((select jsonb_object_agg(kondisi, total) from (select i.kondisi, count(*) total from inventaris i group by i.kondisi) x), '{}'::jsonb)
      )
    );
  end if;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_rag_admin_context"("p_context_type" "text", "p_filters" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_santri_admin"("p_search" "text" DEFAULT NULL::"text", "p_kelas" "text" DEFAULT NULL::"text", "p_jurusan" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("nis" "text", "nama" "text", "nama_masked" "text", "kelas" "text", "jurusan" "text", "jenis_kelamin" "text", "status_santri" "text", "status_spp" "text", "foto_url" "text", "pembimbing" "text", "total_hafalan" "text", "hafalan_kitab" "text", "tahun_masuk" integer, "status_mukim" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
begin
  if not app_private.is_santri_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  with scoped as (
    select s.*
    from public.santri s
    where public.check_access_scope(s.jenis_kelamin::text, s.jurusan::text)
      and (p_search is null or p_search = '' or s.nis = p_search or s.nis_hash = app_private.hash_identifier(p_search) or s.nama ilike '%' || p_search || '%')
      and (p_kelas is null or s.kelas::text = p_kelas)
      and (p_jurusan is null or s.jurusan::text = p_jurusan)
      and (p_status is null or s.status_santri::text = p_status)
  )
  select s.nis, coalesce(app_private.decrypt_text(s.nama_enc), s.nama), app_private.mask_text(coalesce(app_private.decrypt_text(s.nama_enc), s.nama), 2), s.kelas::text, s.jurusan::text, s.jenis_kelamin::text, s.status_santri::text, s.status_spp, s.foto_url, s.pembimbing, s.total_hafalan, s.hafalan_kitab, s.tahun_masuk, s.status_mukim, s.created_at, s.updated_at, count(*) over()
  from scoped s
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 500))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;


ALTER FUNCTION "public"."get_santri_admin"("p_search" "text", "p_kelas" "text", "p_jurusan" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_santri_detail_secure"("p_nis" "text", "p_reason" "text" DEFAULT 'admin_detail'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  s public.santri%rowtype;
  result jsonb;
  wali_profile jsonb := '{}'::jsonb;
begin
  if not app_private.is_santri_admin() then
    raise exception 'Not authorized';
  end if;

  select * into s
    from public.santri
   where nis = p_nis
     and public.check_access_scope(jenis_kelamin::text, jurusan::text)
   limit 1;

  if not found then
    raise exception 'Santri not found or out of scope';
  end if;

  perform app_private.audit_sensitive_access(
    'READ_SENSITIVE',
    'santri',
    p_nis,
    jsonb_build_object('reason', coalesce(p_reason, 'admin_detail'))
  );

  if s.wali_id is not null then
    select jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'no_hp', p.no_hp,
      'role', p.role
    )
      into wali_profile
      from public.profiles p
     where p.id = s.wali_id;
  end if;

  result := to_jsonb(s) || jsonb_build_object(
      'nama', coalesce(s.nama, app_private.decrypt_text(s.nama_enc)),
      'nik', app_private.decrypt_text(s.nik_enc),
      'tempat_lahir', app_private.decrypt_text(s.tempat_lahir_enc),
      'tanggal_lahir', app_private.decrypt_text(s.tanggal_lahir_enc),
      'alamat_lengkap', app_private.decrypt_text(s.alamat_lengkap_enc),
      'no_kontak_wali', app_private.decrypt_text(s.no_kontak_wali_enc),
      'ayah', app_private.decrypt_text(s.ayah_enc),
      'ibu', app_private.decrypt_text(s.ibu_enc),
      'nisn', app_private.decrypt_text(s.nisn_enc),
      'no_kk', app_private.decrypt_text(s.no_kk_enc),
      'nama_wali', app_private.decrypt_text(s.nama_wali_enc),
      'nik_ayah', app_private.decrypt_text(s.nik_ayah_enc),
      'nik_ibu', app_private.decrypt_text(s.nik_ibu_enc),
      'nik_wali', app_private.decrypt_text(s.nik_wali_enc),
      'no_kip', app_private.decrypt_text(s.no_kip_enc),
      'profiles', coalesce(wali_profile, '{}'::jsonb)
    );

  result := result - array[
    'nis_enc','nik_enc','nisn_enc','no_kk_enc','nama_enc','tempat_lahir_enc','tanggal_lahir_enc',
    'alamat_lengkap_enc','no_kontak_wali_enc','ayah_enc','ibu_enc','nama_wali_enc','nik_ayah_enc',
    'nik_ibu_enc','nik_wali_enc','no_kip_enc','nis_hash','nik_hash','nisn_hash','no_kk_hash',
    'nik_ayah_hash','nik_ibu_hash','nik_wali_hash','no_kip_hash'
  ];

  return result;
end;
$$;


ALTER FUNCTION "public"."get_santri_detail_secure"("p_nis" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_wali_santri_detail_secure"("p_nis" "text", "p_reason" "text" DEFAULT 'wali_android_detail'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  s public.santri%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into s
  from public.santri
  where nis = p_nis
    and wali_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'Santri not found or not linked to current wali';
  end if;

  perform app_private.audit_sensitive_access(
    'READ_SENSITIVE_WALI',
    'santri',
    p_nis,
    jsonb_build_object('reason', coalesce(p_reason, 'wali_android_detail'))
  );

  return
    jsonb_build_object(
      'nis', s.nis,
      'nama', coalesce(s.nama, app_private.decrypt_text(s.nama_enc)),
      'foto_url', s.foto_url,
      'kelas', s.kelas::text,
      'jurusan', s.jurusan::text,
      'pembimbing', s.pembimbing,
      'status_spp', s.status_spp,
      'anak_ke', s.anak_ke,
      'jenis_kelamin', s.jenis_kelamin::text,
      'hafalan_kitab', s.hafalan_kitab,
      'total_hafalan', s.total_hafalan,
      'status_santri', s.status_santri::text,
      'status_mukim', s.status_mukim,
      'tahun_masuk', s.tahun_masuk,
      'tanggal_masuk', s.tanggal_masuk,
      'tahun_lulus_keluar', s.tahun_lulus_keluar,
      'tanggal_lulus_keluar', s.tanggal_lulus_keluar,
      'alasan_keluar', s.alasan_keluar,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      'nsp', s.nsp,
      'nisn', app_private.decrypt_text(s.nisn_enc),
      'nik', app_private.decrypt_text(s.nik_enc),
      'no_kk', app_private.decrypt_text(s.no_kk_enc),
      'tempat_lahir', app_private.decrypt_text(s.tempat_lahir_enc)
    )
    || jsonb_build_object(
      'tanggal_lahir', app_private.decrypt_text(s.tanggal_lahir_enc),
      'agama', s.agama,
      'kewarganegaraan', s.kewarganegaraan,
      'alamat_lengkap', app_private.decrypt_text(s.alamat_lengkap_enc),
      'rt', s.rt,
      'rw', s.rw,
      'desa_kelurahan', s.desa_kelurahan,
      'kecamatan_id', s.kecamatan_id,
      'kabupaten_kota', s.kabupaten_kota,
      'provinsi', s.provinsi,
      'kode_pos', s.kode_pos,
      'jarak_rumah_km', s.jarak_rumah_km,
      'latitude', s.latitude,
      'longitude', s.longitude,
      'geocode_status', s.geocode_status,
      'geocode_provider', s.geocode_provider,
      'geocode_confidence', s.geocode_confidence,
      'geocoded_at', s.geocoded_at,
      'ayah', app_private.decrypt_text(s.ayah_enc),
      'nik_ayah', app_private.decrypt_text(s.nik_ayah_enc),
      'status_ayah', s.status_ayah,
      'pendidikan_ayah', s.pendidikan_ayah,
      'pekerjaan_ayah', s.pekerjaan_ayah,
      'penghasilan_ayah', s.penghasilan_ayah,
      'ibu', app_private.decrypt_text(s.ibu_enc)
    )
    || jsonb_build_object(
      'nik_ibu', app_private.decrypt_text(s.nik_ibu_enc),
      'status_ibu', s.status_ibu,
      'pendidikan_ibu', s.pendidikan_ibu,
      'pekerjaan_ibu', s.pekerjaan_ibu,
      'penghasilan_ibu', s.penghasilan_ibu,
      'nama_wali', app_private.decrypt_text(s.nama_wali_enc),
      'nik_wali', app_private.decrypt_text(s.nik_wali_enc),
      'hubungan_wali', s.hubungan_wali,
      'pendidikan_wali', s.pendidikan_wali,
      'pekerjaan_wali', s.pekerjaan_wali,
      'penghasilan_wali', s.penghasilan_wali,
      'no_kontak_wali', app_private.decrypt_text(s.no_kontak_wali_enc),
      'no_kip', app_private.decrypt_text(s.no_kip_enc),
      'penerima_pip', s.penerima_pip,
      'penerima_beasiswa', s.penerima_beasiswa,
      'jenis_beasiswa', s.jenis_beasiswa,
      'kebutuhan_khusus', s.kebutuhan_khusus,
      'emis_extra', s.emis_extra
    );
end;
$$;


ALTER FUNCTION "public"."get_wali_santri_detail_secure"("p_nis" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  requested_role text := lower(coalesce(new.raw_user_meta_data->>'role', 'wali'));
  safe_role text;
  safe_is_active boolean;
begin
  if requested_role = 'alumni' then
    safe_role := 'alumni';
    safe_is_active := false;
  else
    safe_role := 'wali';
    safe_is_active := true;
  end if;

  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    new.email,
    safe_role,
    safe_is_active
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_in_roles"("allowed_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and lower(role) = any(allowed_roles)
  );
end;
$$;


ALTER FUNCTION "public"."is_admin_in_roles"("allowed_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_chat_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
  select (
    app_private.is_current_user_forum_admin()
    or app_private.is_chat_participant(p_conversation_id, auth.uid())
  )
  and exists (
    select 1
    from public.chat_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_chat_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_wali_santri_secure"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'nis', s.nis,
        'nama', coalesce(s.nama, app_private.decrypt_text(s.nama_enc)),
        'foto_url', s.foto_url,
        'kelas', s.kelas::text,
        'jurusan', s.jurusan::text,
        'jenis_kelamin', s.jenis_kelamin::text,
        'status_santri', s.status_santri::text,
        'status_mukim', s.status_mukim,
        'tahun_masuk', s.tahun_masuk,
        'pembimbing', s.pembimbing,
        'status_spp', s.status_spp,
        'anak_ke', s.anak_ke,
        'hafalan_kitab', s.hafalan_kitab,
        'total_hafalan', s.total_hafalan
      )
      order by coalesce(s.nama, app_private.decrypt_text(s.nama_enc), s.nis)
    ),
    '[]'::jsonb
  )
  into result
  from public.santri s
  where s.wali_id = auth.uid();

  perform app_private.audit_sensitive_access(
    'LIST_WALI_SANTRI',
    'santri',
    'self',
    '{}'::jsonb
  );

  return result;
end;
$$;


ALTER FUNCTION "public"."list_wali_santri_secure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id, 
        action, 
        resource, 
        record_id, 
        details
    ) VALUES (
        auth.uid(), 
        TG_OP, 
        TG_TABLE_NAME, 
        COALESCE(NEW.id::text, OLD.id::text), 
        jsonb_build_object(
            'old_data', to_jsonb(OLD),
            'new_data', to_jsonb(NEW)
        )
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_questions_as_used"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF NEW.status = 'final' AND OLD.status = 'draft' THEN
    UPDATE public.question_bank
    SET
      is_ever_used = true,
      used_in_test_count = used_in_test_count + 1,
      last_used_test_id = NEW.id,
      last_used_date = NEW.tanggal_pelaksanaan,
      updated_at = now()
    WHERE id IN (
      SELECT question_id FROM public.test_questions WHERE test_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_questions_as_used"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_internal_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select chunk_id, title, content, metadata, similarity
  from public.match_rag_chunks(query_embedding, 'internal', match_threshold, match_count);
$$;


ALTER FUNCTION "public"."match_internal_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_kitab_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.65, "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select chunk_id, title, content, metadata, similarity
  from public.match_rag_chunks(query_embedding, 'kitab', match_threshold, match_count);
$$;


ALTER FUNCTION "public"."match_kitab_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_public_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select chunk_id, title, content, metadata, similarity
  from public.match_rag_chunks(query_embedding, 'public', match_threshold, match_count);
$$;


ALTER FUNCTION "public"."match_public_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_rag_chunks"("query_embedding" "extensions"."vector", "match_source_type" "text" DEFAULT 'public'::"text", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 5) RETURNS TABLE("chunk_id" "uuid", "document_id" "uuid", "title" "text", "content" "text", "source_type" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select
    c.id as chunk_id,
    d.id as document_id,
    coalesce(c.title, d.title) as title,
    c.content,
    d.source_type,
    coalesce(c.metadata, '{}'::jsonb) || coalesce(d.metadata, '{}'::jsonb) as metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.rag_document_chunks c
  join public.rag_documents d on d.id = c.document_id
  where c.embedding is not null
    and d.status = 'active'
    and (
      match_source_type = 'mixed'
      or d.source_type = match_source_type
    )
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;


ALTER FUNCTION "public"."match_rag_chunks"("query_embedding" "extensions"."vector", "match_source_type" "text", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_my_fcm_device"("p_fcm_token" "text", "p_device_id" "text" DEFAULT NULL::"text", "p_platform" "text" DEFAULT 'android'::"text", "p_app_instance_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Login wajib aktif untuk mendaftarkan FCM token';
  end if;

  return public.register_user_fcm_device(
    v_user_id,
    p_fcm_token,
    p_device_id,
    p_platform,
    p_app_instance_id
  );
end;
$$;


ALTER FUNCTION "public"."register_my_fcm_device"("p_fcm_token" "text", "p_device_id" "text", "p_platform" "text", "p_app_instance_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_user_fcm_device"("p_user_id" "uuid", "p_fcm_token" "text", "p_device_id" "text" DEFAULT NULL::"text", "p_platform" "text" DEFAULT 'android'::"text", "p_app_instance_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.user_devices%rowtype;
begin
  if p_user_id is null then
    raise exception 'user_id wajib diisi';
  end if;

  if p_fcm_token is null or length(trim(p_fcm_token)) < 20 then
    raise exception 'fcm_token tidak valid';
  end if;

  update public.user_devices
  set is_active = false
  where fcm_token = p_fcm_token
    and user_id <> p_user_id;

  insert into public.user_devices (user_id, fcm_token, device_type, device_id, platform, app_instance_id, is_active, last_seen, last_seen_at)
  values (p_user_id, p_fcm_token, coalesce(p_platform, 'android'), p_device_id, coalesce(p_platform, 'android'), p_app_instance_id, true, now(), now())
  on conflict (user_id, fcm_token) do update
  set is_active = true,
      device_id = coalesce(excluded.device_id, public.user_devices.device_id),
      platform = coalesce(excluded.platform, public.user_devices.platform),
      device_type = coalesce(excluded.device_type, public.user_devices.device_type),
      app_instance_id = coalesce(excluded.app_instance_id, public.user_devices.app_instance_id),
      last_seen = now(),
      last_seen_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'status', 'registered',
    'id', v_row.id,
    'user_id', v_row.user_id,
    'is_active', v_row.is_active
  );
end;
$$;


ALTER FUNCTION "public"."register_user_fcm_device"("p_user_id" "uuid", "p_fcm_token" "text", "p_device_id" "text", "p_platform" "text", "p_app_instance_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_pelanggaran"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
begin
  if not (app_private.current_user_role() = any(array['super_admin','admin_kesantrian','kesantrian','rois'])) then
    raise exception 'Not authorized';
  end if;

  delete from public.pelanggaran_santri;
end;
$$;


ALTER FUNCTION "public"."reset_pelanggaran"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_wallet_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_wallet_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."terima_bayar_manual"("p_tagihan_id" "uuid", "p_admin_id" "uuid", "p_keterangan" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_tagihan record;
  v_kode_transaksi text;
begin
  if not (app_private.current_user_role() = any(array['super_admin','admin_bendahara','bendahara'])) then
    raise exception 'Not authorized';
  end if;
  if p_admin_id <> auth.uid() then
    raise exception 'Admin pencatat tidak sesuai sesi login';
  end if;

  select * into v_tagihan from public.tagihan_santri where id = p_tagihan_id;
  if v_tagihan is null then raise exception 'Tagihan tidak ditemukan (ID salah)'; end if;
  if v_tagihan.status = 'LUNAS' then raise exception 'Tagihan ini sudah LUNAS sebelumnya!'; end if;

  v_kode_transaksi := 'CASH-' || to_char(now(), 'YYYYMMDD-HH24MI') || '-' || substring(p_tagihan_id::text, 1, 4);

  update public.tagihan_santri
  set status = 'LUNAS',
      midtrans_order_id = v_kode_transaksi,
      sisa_tagihan = 0,
      updated_at = now()
  where id = p_tagihan_id;

  insert into public.transaksi_keuangan (
    jumlah, jenis_transaksi, kategori, keterangan, admin_pencatat_id, created_at, status
  ) values (
    v_tagihan.nominal_tagihan, 'PEMASUKAN', 'SPP', p_keterangan || ' (Ref: ' || v_kode_transaksi || ')', p_admin_id, now(), 'SUCCESS'
  );

  insert into public.log_aktivitas (user_id, aktivitas, detail)
  values (p_admin_id, 'TERIMA_BAYAR_MANUAL', 'Menerima pembayaran tunai tagihan ID: ' || p_tagihan_id);

  return json_build_object('status', 'success', 'message', 'Pembayaran tunai berhasil diproses');
end;
$$;


ALTER FUNCTION "public"."terima_bayar_manual"("p_tagihan_id" "uuid", "p_admin_id" "uuid", "p_keterangan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_notify_kesehatan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    PERFORM public.create_notification_for_wali(
        NEW.santri_nis,
        'Laporan Kesehatan Santri',
        'Laporan kesehatan ananda hari ini: ' || NEW.keluhan || '. Tindakan yang telah diambil: ' || NEW.tindakan || '. Mohon doa untuk kesembuhan ananda.',
        jsonb_build_object('type', 'kesehatan', 'nis', NEW.santri_nis, 'id', NEW.id),
        'kesehatan_santri'
    );
    RETURN NEW;
END; $$;


ALTER FUNCTION "public"."tr_notify_kesehatan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_notify_pelanggaran"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    PERFORM public.create_notification_for_wali(
        NEW.santri_nis,
        'Catatan Kedisiplinan',
        'Informasi kedisiplinan: Ananda tercatat melakukan pelanggaran' || NEW.jenis_pelanggaran || '. Mari bimbing ananda untuk menjadi lebih baik.',
        jsonb_build_object('type', 'pelanggaran', 'nis', NEW.santri_nis, 'id', NEW.id),
        'pelanggaran_santri'
    );
    RETURN NEW;
END; $$;


ALTER FUNCTION "public"."tr_notify_pelanggaran"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_notify_perizinan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_status_indo TEXT;
BEGIN
    -- Mapping Status
    v_status_indo := CASE 
        WHEN NEW.status = 'approved' OR NEW.status = 'DISETUJUI' THEN 'telah DISETUJUI'
        WHEN NEW.status = 'rejected' OR NEW.status = 'DITOLAK' THEN 'mohon maaf, BELUM DISETUJUI'
        WHEN NEW.status = 'pending'  OR NEW.status = 'DIPROSES' THEN 'sedang DIPROSES'
        ELSE 'berstatus ' || NEW.status
    END;

    IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
        PERFORM public.create_notification_for_wali(
            NEW.santri_nis,
            'Update Perizinan Santri',
            'Assalamu''alaikum, permohonan izin ' || NEW.jenis_izin || ' ananda ' || v_status_indo || '.',
            jsonb_build_object('type', 'perizinan', 'nis', NEW.santri_nis, 'id', NEW.id),
            'perizinan_santri'
        );
    END IF;
    RETURN NEW;
END; $$;


ALTER FUNCTION "public"."tr_notify_perizinan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_notify_tagihan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Kondisi A: Tagihan Baru Dibuat
    IF (TG_OP = 'INSERT') THEN
        PERFORM public.create_notification_for_wali(
            NEW.santri_nis,
            'Tagihan Baru',
            'Terdapat tagihan baru: ' || NEW.deskripsi_tagihan || ' sebesar Rp ' || public.format_rupiah(NEW.nominal_tagihan) || '. Mohon segera melakukan pembayaran.',
            jsonb_build_object('type', 'tagihan', 'nis', NEW.santri_nis, 'id', NEW.id),
            'tagihan_santri'
        );
    
    -- Kondisi B: Status Berubah Jadi LUNAS (Pembayaran Berhasil)
    ELSIF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'LUNAS') THEN
        PERFORM public.create_notification_for_wali(
            NEW.santri_nis,
            'Pembayaran Berhasil',
            'Alhamdulillah, pembayaran ' || NEW.deskripsi_tagihan || ' sebesar Rp ' || public.format_rupiah(NEW.nominal_tagihan) || ' telah kami terima. Syukran wa jazakumullah khairan.',
            jsonb_build_object('type', 'tagihan', 'nis', NEW.santri_nis, 'id', NEW.id),
            'tagihan_santri'
        );
    END IF;
    
    RETURN NEW;
END; $$;


ALTER FUNCTION "public"."tr_notify_tagihan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_user_devices_single_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.is_active := coalesce(new.is_active, true);
  new.last_seen_at := coalesce(new.last_seen_at, new.last_seen, now());
  new.last_seen := coalesce(new.last_seen, new.last_seen_at, now());

  if new.is_active then
    update public.user_devices
    set is_active = false
    where fcm_token = new.fcm_token
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."tr_user_devices_single_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_dispute"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ledger public.transaksi_dompet%rowtype;
begin
  if tg_op = 'INSERT' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Dispute transaksi dompet',
      'Wali membuka dispute untuk NIS ' || new.santri_nis || '. SLA respons 48 jam.',
      'wallet.dispute.opened',
      'wallet_disputes',
      jsonb_build_object('dispute_id', new.id, 'ledger_id', new.ledger_id, 'santri_nis', new.santri_nis, 'response_due_at', new.response_due_at),
      'high',
      new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.resolved_at is not null then
    select * into v_ledger from public.transaksi_dompet where id = new.ledger_id;

    if new.status = 'resolved_reversed' then
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Transaksi telah dibalik',
        'Transaksi ' || new.ledger_id || ' telah dibalik. Saldo Rp ' || to_char(coalesce(v_ledger.amount, 0), 'FM999G999G999') || ' telah dikembalikan.',
        'wallet.dispute.resolved_reversed',
        'wallet_disputes',
        jsonb_build_object('dispute_id', new.id, 'status', new.status, 'ledger_id', new.ledger_id, 'reversal_ledger_id', new.reversal_ledger_id),
        'normal',
        new.id::text
      );
    else
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Dispute transaksi selesai',
        'Transaksi ' || new.ledger_id || ' telah diverifikasi valid. Jika masih bermasalah hubungi pesantren.',
        'wallet.dispute.resolved_valid',
        'wallet_disputes',
        jsonb_build_object('dispute_id', new.id, 'status', new.status, 'ledger_id', new.ledger_id),
        'normal',
        new.id::text
      );
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_dispute"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_freeze"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.is_frozen is distinct from new.is_frozen then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      case when new.is_frozen then 'Transaksi dompet dibekukan' else 'Transaksi dompet dibuka kembali' end,
      coalesce(new.freeze_reason, 'Perubahan freeze switch dompet santri.'),
      case when new.is_frozen then 'wallet.system.frozen' else 'wallet.system.unfrozen' end,
      'wallet_system_controls',
      jsonb_build_object('key', new.key, 'is_frozen', new.is_frozen, 'reason', new.freeze_reason),
      case when new.is_frozen then 'critical' else 'normal' end,
      new.key
    );

    if new.is_frozen then
      perform public.wallet_notify_roles(
        array['kantin'],
        'Sistem dompet sedang dibekukan',
        'Transaksi dompet santri sementara ditolak. Kantin harap menunggu instruksi bendahara.',
        'wallet.system.frozen.kantin_broadcast',
        'wallet_system_controls',
        jsonb_build_object('key', new.key, 'reason', new.freeze_reason),
        'critical',
        new.key
      );
    else
      perform public.wallet_notify_roles(
        array['kantin'],
        'Sistem dompet aktif kembali',
        'Transaksi dompet santri sudah dapat diproses kembali.',
        'wallet.system.unfrozen.kantin_broadcast',
        'wallet_system_controls',
        jsonb_build_object('key', new.key),
        'normal',
        new.key
      );
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_freeze"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.finished_at is not null
     and (old.finished_at is null or old.status is distinct from new.status)
     and new.status = 'failed' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Hash-chain ledger dompet rusak',
      'Integrity check gagal pada ledger ' || coalesce(new.broken_at::text, '-') || '. Transaksi dompet harus diinvestigasi.',
      'wallet.integrity.failed',
      'wallet_ledger_integrity_runs',
      jsonb_build_object('run_id', new.id, 'broken_at', new.broken_at, 'santri_nis', new.santri_nis),
      'critical',
      new.id::text
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_kantin_device"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Device kantin menunggu approval',
      'Device baru untuk akun kantin perlu direview.',
      'wallet.kantin_device.pending',
      'kantin_devices',
      jsonb_build_object('device_record_id', new.id, 'kantin_user_id', new.kantin_user_id, 'device_id', new.device_id),
      'high',
      new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform public.wallet_enqueue_notification(
      new.kantin_user_id,
      'Status device kantin berubah',
      'Device kantin ' || new.device_id || ' sekarang ' || new.status || '.',
      'wallet.kantin_device.' || new.status,
      'kantin_devices',
      jsonb_build_object('device_record_id', new.id, 'device_id', new.device_id, 'status', new.status),
      case when new.status in ('revoked','suspended') then 'high' else 'normal' end,
      new.id::text
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_kantin_device"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_payment_intent_failure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.status is distinct from new.status
     and new.status = 'failed'
     and new.type in ('topup','topup_midtrans','midtrans_topup') then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Top up dompet gagal',
      'Top up sebesar Rp ' || to_char(new.amount, 'FM999G999G999') || ' belum berhasil diproses. Jika saldo rekening sudah terpotong, hubungi pesantren.',
      'wallet.topup.failed',
      'wallet_payment_intents',
      jsonb_build_object('payment_intent_id', new.id, 'amount', new.amount, 'midtrans_order_id', new.midtrans_order_id),
      'high',
      new.id::text
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_payment_intent_failure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_reconciliation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.finished_at is not null
     and (old.finished_at is null or old.status is distinct from new.status)
     and new.status in ('failed','settlement_mismatch') then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      case when new.status = 'failed' then 'Rekonsiliasi dompet gagal' else 'Settlement dompet tidak cocok' end,
      'Ledger net ' || new.ledger_net || ', cached balance ' || new.cached_balance_total || ', selisih internal ' || new.difference_internal || '.',
      'wallet.reconciliation.' || new.status,
      'wallet_reconciliation_runs',
      jsonb_build_object('run_id', new.id, 'status', new.status, 'difference_internal', new.difference_internal, 'difference_bank', new.difference_bank),
      case when new.status = 'failed' then 'critical' else 'high' end,
      new.id::text
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_reconciliation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_risk_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.severity = 'low' then
    return new;
  end if;

  if new.severity = 'medium' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Risk event dompet: ' || new.rule_code,
      'Severity MEDIUM pada dompet santri ' || coalesce(new.santri_nis, '-') || '.',
      'wallet.risk.medium',
      'wallet_risk_events',
      jsonb_build_object('risk_event_id', new.id, 'santri_nis', new.santri_nis, 'device_id', new.device_id, 'score', new.score, 'action', new.action),
      'normal',
      new.id::text
    );
  elsif new.severity = 'high' then
    update public.dompet_santri
    set status = 'locked',
        locked_reason = 'Risk event high: ' || new.rule_code
    where santri_nis = new.santri_nis
      and status = 'active';

    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Risk event HIGH dompet',
      'Transaksi dompet dibekukan sementara karena ' || new.rule_code || '.',
      'wallet.risk.high',
      'wallet_risk_events',
      jsonb_build_object('risk_event_id', new.id, 'santri_nis', new.santri_nis, 'device_id', new.device_id, 'score', new.score, 'action', new.action),
      'high',
      new.id::text
    );

    if new.santri_nis is not null then
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Dompet santri dikunci sementara',
        'Sistem mendeteksi aktivitas tidak biasa. Dompet dikunci sementara untuk keamanan.',
        'wallet.risk.parent_alert.high',
        'wallet_risk_events',
        jsonb_build_object('risk_event_id', new.id, 'rule_code', new.rule_code, 'severity', new.severity),
        'high',
        new.id::text
      );
    end if;
  elsif new.severity = 'critical' then
    update public.dompet_santri
    set status = 'locked',
        locked_reason = 'Risk event critical: ' || new.rule_code
    where santri_nis = new.santri_nis
      and status = 'active';

    update public.wallet_risk_events
    set response_due_at = coalesce(response_due_at, created_at + interval '15 minutes'),
        auto_action_at = coalesce(auto_action_at, created_at + interval '15 minutes')
    where id = new.id;

    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois','dewan'],
      'Risk event CRITICAL dompet',
      'Wajib respons maksimal 15 menit. Rule: ' || new.rule_code || ', NIS: ' || coalesce(new.santri_nis, '-') || '.',
      'wallet.risk.critical',
      'wallet_risk_events',
      jsonb_build_object('risk_event_id', new.id, 'santri_nis', new.santri_nis, 'device_id', new.device_id, 'score', new.score, 'response_due_minutes', 15),
      'critical',
      new.id::text
    );

    if new.santri_nis is not null then
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Peringatan keamanan dompet',
        'Aktivitas kritikal terdeteksi. Dompet dikunci dan sedang diperiksa pesantren.',
        'wallet.risk.parent_alert.critical',
        'wallet_risk_events',
        jsonb_build_object('risk_event_id', new.id, 'rule_code', new.rule_code, 'severity', new.severity),
        'critical',
        new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_risk_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_santri_name text;
  v_warning_threshold bigint;
  v_critical_threshold bigint;
  v_large_threshold bigint;
  v_kantin_name text;
  v_large_count_1h int;
  v_dispute_deeplink text;
begin
  select s.nama, d.low_balance_warning_threshold, d.low_balance_critical_threshold, d.large_transaction_threshold
  into v_santri_name, v_warning_threshold, v_critical_threshold, v_large_threshold
  from public.dompet_santri d
  left join public.santri s on s.nis = d.santri_nis
  where d.santri_nis = new.santri_nis;

  v_dispute_deeplink := 'alhasanah://wallet/dispute?ledger_id=' || new.id::text;

  if new.category = 'pembayaran_kantin' then
    select full_name into v_kantin_name from public.profiles where id = new.actor_id;

    perform public.wallet_notify_wali(
      new.santri_nis,
      'Transaksi kantin berhasil',
      coalesce(v_santri_name, new.santri_nis) || ' beli di Kantin ' || coalesce(v_kantin_name, '-') || ', Rp ' ||
      to_char(new.amount, 'FM999G999G999') || ', sisa saldo Rp ' || to_char(new.balance_after, 'FM999G999G999') ||
      '. Bukan kamu? Laporkan segera.',
      'wallet.kantin.payment_posted',
      'transaksi_dompet',
      jsonb_build_object(
        'ledger_id', new.id,
        'amount', new.amount,
        'balance_after', new.balance_after,
        'kantin_user_id', new.actor_id,
        'kantin_name', v_kantin_name,
        'dispute_deeplink', v_dispute_deeplink
      ),
      case when v_large_threshold is not null and new.amount >= v_large_threshold then 'high' else 'normal' end,
      new.id::text
    );

    perform public.wallet_enqueue_notification(
      new.actor_id,
      'Pembayaran diterima',
      'Pembayaran diterima Rp ' || to_char(new.amount, 'FM999G999G999') || ' - ' ||
      coalesce(v_santri_name, new.santri_nis) || ' - ' || to_char(new.created_at at time zone 'Asia/Jakarta', 'HH24:MI'),
      'wallet.kantin.payment_posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'created_at', new.created_at),
      'normal',
      new.id::text
    );
  elsif new.category = 'topup' then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Top up dompet berhasil',
      'Saldo ' || coalesce(v_santri_name, new.santri_nis) || ' bertambah Rp ' ||
      to_char(new.amount, 'FM999G999G999') || '. Saldo sekarang Rp ' || to_char(new.balance_after, 'FM999G999G999') || '.',
      'wallet.topup.posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'amount', new.amount, 'balance_after', new.balance_after),
      'normal',
      new.id::text
    );
  elsif new.category in ('correction','refund','account_migration_in','account_migration_out','settlement_to_pesantren_ledger') then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Koreksi dompet santri',
      'Ada koreksi dompet ' || coalesce(v_santri_name, new.santri_nis) || ' sebesar Rp ' ||
      to_char(new.amount, 'FM999G999G999') || '. Saldo sekarang Rp ' || to_char(new.balance_after, 'FM999G999G999') || '.',
      'wallet.adjustment.posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'category', new.category, 'direction', new.direction, 'amount', new.amount, 'balance_after', new.balance_after),
      'high',
      new.id::text
    );

    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Koreksi ledger dompet',
      'Koreksi ' || new.category::text || ' untuk NIS ' || new.santri_nis || ' sebesar Rp ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.adjustment.posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'category', new.category, 'direction', new.direction),
      'high',
      new.id::text
    );
  end if;

  if new.balance_after <= coalesce(v_critical_threshold, 10000) then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Saldo dompet kritis',
      'Saldo ' || coalesce(v_santri_name, new.santri_nis) || ' tersisa Rp ' || to_char(new.balance_after, 'FM999G999G999') || '.',
      'wallet.balance.critical',
      'dompet_santri',
      jsonb_build_object('ledger_id', new.id, 'balance_after', new.balance_after, 'threshold', coalesce(v_critical_threshold, 10000), 'sms_fallback_required', true),
      'critical',
      new.id::text
    );
  elsif new.balance_after <= coalesce(v_warning_threshold, 30000) then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Saldo dompet rendah',
      'Saldo ' || coalesce(v_santri_name, new.santri_nis) || ' tersisa Rp ' || to_char(new.balance_after, 'FM999G999G999') || '.',
      'wallet.balance.warning',
      'dompet_santri',
      jsonb_build_object('ledger_id', new.id, 'balance_after', new.balance_after, 'threshold', coalesce(v_warning_threshold, 30000)),
      'high',
      new.id::text
    );
  end if;

  if new.amount >= 100000 then
    perform public.wallet_notify_role(
      'bendahara',
      'Transaksi dompet > Rp100.000',
      'Transaksi ' || new.category::text || ' NIS ' || new.santri_nis || ' sebesar Rp ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.transaction.large.bendahara',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'threshold', 100000),
      'high',
      new.id::text
    );
  end if;

  if new.amount >= 500000 then
    perform public.wallet_notify_role(
      'rois',
      'Transaksi dompet > Rp500.000',
      'Anomali signifikan: transaksi NIS ' || new.santri_nis || ' sebesar Rp ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.transaction.large.rois',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'threshold', 500000),
      'critical',
      new.id::text
    );
  end if;

  select count(*) into v_large_count_1h
  from public.transaksi_dompet td
  where td.santri_nis = new.santri_nis
    and td.status = 'posted'
    and td.amount >= 100000
    and td.created_at >= new.created_at - interval '1 hour';

  if new.amount >= 1000000 or v_large_count_1h >= 3 then
    perform public.wallet_notify_role(
      'super_admin',
      'Transaksi dompet kritikal',
      'Transaksi kritikal NIS ' || new.santri_nis || ': Rp ' || to_char(new.amount, 'FM999G999G999') ||
      '. Transaksi besar 1 jam terakhir: ' || v_large_count_1h || '.',
      'wallet.transaction.large.super_admin',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'threshold', 1000000, 'large_count_1h', v_large_count_1h),
      'critical',
      new.id::text
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tr_wallet_notify_user_device"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing_count int;
  v_role text;
  v_device_name text;
begin
  select count(*) into v_existing_count
  from public.user_devices
  where user_id = new.user_id
    and id <> new.id;

  select role into v_role from public.profiles where id = new.user_id;
  v_device_name := coalesce(new.device_type, 'Android');

  if v_existing_count > 0 and v_role in ('wali','kantin') then
    perform public.wallet_enqueue_notification(
      new.user_id,
      'Login dari perangkat baru',
      'Login baru terdeteksi di akun kamu dari perangkat ' || v_device_name || '. Bukan kamu? Kunci akun sekarang.',
      'wallet.security.new_device_login',
      'user_devices',
      jsonb_build_object('device_id', new.id, 'device_type', new.device_type, 'lock_deeplink', 'alhasanah://security/lock-account'),
      'critical',
      new.id::text
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."tr_wallet_notify_user_device"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_alumni_admin_profile"("p_alumni_id" "uuid", "p_full_name" "text" DEFAULT NULL::"text", "p_is_active" boolean DEFAULT NULL::boolean) RETURNS "public"."profiles"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select app_private.update_alumni_admin_profile(p_alumni_id, p_full_name, p_is_active);
$$;


ALTER FUNCTION "public"."update_alumni_admin_profile"("p_alumni_id" "uuid", "p_full_name" "text", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_santri_secure"("p_nis" "text", "p_payload" "jsonb", "p_reason" "text" DEFAULT 'admin_update'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_exists boolean;
  v_tanggal_lahir date := nullif(p_payload->>'tanggal_lahir', '')::date;
  v_tanggal_masuk date := nullif(p_payload->>'tanggal_masuk', '')::date;
  v_tanggal_lulus_keluar date := nullif(p_payload->>'tanggal_lulus_keluar', '')::date;
begin
  if not app_private.is_santri_admin() then
    raise exception 'Not authorized';
  end if;

  select exists(select 1 from public.santri s where s.nis = p_nis and public.check_access_scope(s.jenis_kelamin::text, s.jurusan::text)) into v_exists;
  if not v_exists then
    raise exception 'Santri not found or out of scope';
  end if;

  update public.santri
  set
    nama = coalesce(nullif(p_payload->>'nama', ''), nama),
    kelas = coalesce(nullif(p_payload->>'kelas', '')::public.tipe_kelas, kelas),
    jurusan = coalesce(nullif(upper(p_payload->>'jurusan'), '')::public.tipe_jurusan, jurusan),
    jenis_kelamin = coalesce(nullif(p_payload->>'jenis_kelamin', '')::public.tipe_gender, jenis_kelamin),
    status_santri = coalesce(nullif(p_payload->>'status_santri', '')::public.status_santri, status_santri),
    status_spp = coalesce(nullif(p_payload->>'status_spp', ''), status_spp),
    pembimbing = coalesce(nullif(p_payload->>'pembimbing', ''), pembimbing),
    hafalan_kitab = coalesce(nullif(p_payload->>'hafalan_kitab', ''), hafalan_kitab),
    total_hafalan = coalesce(nullif(p_payload->>'total_hafalan', ''), total_hafalan),
    anak_ke = coalesce(nullif(p_payload->>'anak_ke', ''), anak_ke),
    nama_enc = coalesce(app_private.encrypt_text(p_payload->>'nama'), nama_enc),
    nik_hash = coalesce(app_private.hash_identifier(p_payload->>'nik'), nik_hash),
    nik_enc = coalesce(app_private.encrypt_text(p_payload->>'nik'), nik_enc),
    tempat_lahir_enc = coalesce(app_private.encrypt_text(p_payload->>'tempat_lahir'), tempat_lahir_enc),
    tanggal_lahir_enc = coalesce(app_private.encrypt_text(case when v_tanggal_lahir is null then null else v_tanggal_lahir::text end), tanggal_lahir_enc),
    alamat_lengkap_enc = coalesce(app_private.encrypt_text(p_payload->>'alamat_lengkap'), alamat_lengkap_enc),
    no_kontak_wali_enc = coalesce(app_private.encrypt_text(p_payload->>'no_kontak_wali'), no_kontak_wali_enc),
    ayah_enc = coalesce(app_private.encrypt_text(p_payload->>'ayah'), ayah_enc),
    ibu_enc = coalesce(app_private.encrypt_text(p_payload->>'ibu'), ibu_enc),
    nisn_hash = coalesce(app_private.hash_identifier(p_payload->>'nisn'), nisn_hash),
    nisn_enc = coalesce(app_private.encrypt_text(p_payload->>'nisn'), nisn_enc),
    no_kk_hash = coalesce(app_private.hash_identifier(p_payload->>'no_kk'), no_kk_hash),
    no_kk_enc = coalesce(app_private.encrypt_text(p_payload->>'no_kk'), no_kk_enc),
    nama_wali_enc = coalesce(app_private.encrypt_text(p_payload->>'nama_wali'), nama_wali_enc),
    nik_ayah_hash = coalesce(app_private.hash_identifier(p_payload->>'nik_ayah'), nik_ayah_hash),
    nik_ayah_enc = coalesce(app_private.encrypt_text(p_payload->>'nik_ayah'), nik_ayah_enc),
    nik_ibu_hash = coalesce(app_private.hash_identifier(p_payload->>'nik_ibu'), nik_ibu_hash),
    nik_ibu_enc = coalesce(app_private.encrypt_text(p_payload->>'nik_ibu'), nik_ibu_enc),
    nik_wali_hash = coalesce(app_private.hash_identifier(p_payload->>'nik_wali'), nik_wali_hash),
    nik_wali_enc = coalesce(app_private.encrypt_text(p_payload->>'nik_wali'), nik_wali_enc),
    no_kip_hash = coalesce(app_private.hash_identifier(p_payload->>'no_kip'), no_kip_hash),
    no_kip_enc = coalesce(app_private.encrypt_text(p_payload->>'no_kip'), no_kip_enc),
    nsp = coalesce(nullif(p_payload->>'nsp', ''), nsp),
    agama = coalesce(nullif(p_payload->>'agama', ''), agama),
    kewarganegaraan = coalesce(nullif(p_payload->>'kewarganegaraan', ''), kewarganegaraan),
    status_mukim = coalesce(nullif(p_payload->>'status_mukim', ''), status_mukim),
    rt = coalesce(nullif(p_payload->>'rt', ''), rt),
    rw = coalesce(nullif(p_payload->>'rw', ''), rw),
    desa_kelurahan = coalesce(nullif(p_payload->>'desa_kelurahan', ''), desa_kelurahan),
    kabupaten_kota = coalesce(nullif(p_payload->>'kabupaten_kota', ''), kabupaten_kota),
    provinsi = coalesce(nullif(p_payload->>'provinsi', ''), provinsi),
    kode_pos = coalesce(nullif(p_payload->>'kode_pos', ''), kode_pos),
    kecamatan_id = coalesce(nullif(p_payload->>'kecamatan_id', ''), kecamatan_id),
    latitude = coalesce(nullif(p_payload->>'latitude', '')::double precision, latitude),
    longitude = coalesce(nullif(p_payload->>'longitude', '')::double precision, longitude),
    geocode_status = coalesce(nullif(p_payload->>'geocode_status', ''), geocode_status),
    geocode_provider = coalesce(nullif(p_payload->>'geocode_provider', ''), geocode_provider),
    geocode_confidence = coalesce(nullif(p_payload->>'geocode_confidence', '')::double precision, geocode_confidence),
    geocoded_at = coalesce(case when nullif(p_payload->>'geocoded_at', '') is null then null else (p_payload->>'geocoded_at')::timestamptz end, geocoded_at),
    jarak_rumah_km = coalesce(nullif(p_payload->>'jarak_rumah_km', '')::numeric, jarak_rumah_km),
    tahun_masuk = coalesce(nullif(p_payload->>'tahun_masuk', '')::integer, tahun_masuk),
    tanggal_masuk = coalesce(v_tanggal_masuk, tanggal_masuk),
    tahun_lulus_keluar = coalesce(nullif(p_payload->>'tahun_lulus_keluar', '')::integer, tahun_lulus_keluar),
    tanggal_lulus_keluar = coalesce(v_tanggal_lulus_keluar, tanggal_lulus_keluar),
    alasan_keluar = coalesce(nullif(p_payload->>'alasan_keluar', ''), alasan_keluar),
    penerima_pip = coalesce(nullif(p_payload->>'penerima_pip', '')::boolean, penerima_pip),
    penerima_beasiswa = coalesce(nullif(p_payload->>'penerima_beasiswa', '')::boolean, penerima_beasiswa),
    jenis_beasiswa = coalesce(nullif(p_payload->>'jenis_beasiswa', ''), jenis_beasiswa),
    kebutuhan_khusus = coalesce(nullif(p_payload->>'kebutuhan_khusus', ''), kebutuhan_khusus),
    pendidikan_ayah = coalesce(nullif(p_payload->>'pendidikan_ayah', ''), pendidikan_ayah),
    pekerjaan_ayah = coalesce(nullif(p_payload->>'pekerjaan_ayah', ''), pekerjaan_ayah),
    penghasilan_ayah = coalesce(nullif(p_payload->>'penghasilan_ayah', ''), penghasilan_ayah),
    status_ayah = coalesce(nullif(p_payload->>'status_ayah', ''), status_ayah),
    pendidikan_ibu = coalesce(nullif(p_payload->>'pendidikan_ibu', ''), pendidikan_ibu),
    pekerjaan_ibu = coalesce(nullif(p_payload->>'pekerjaan_ibu', ''), pekerjaan_ibu),
    penghasilan_ibu = coalesce(nullif(p_payload->>'penghasilan_ibu', ''), penghasilan_ibu),
    status_ibu = coalesce(nullif(p_payload->>'status_ibu', ''), status_ibu),
    pendidikan_wali = coalesce(nullif(p_payload->>'pendidikan_wali', ''), pendidikan_wali),
    pekerjaan_wali = coalesce(nullif(p_payload->>'pekerjaan_wali', ''), pekerjaan_wali),
    penghasilan_wali = coalesce(nullif(p_payload->>'penghasilan_wali', ''), penghasilan_wali),
    hubungan_wali = coalesce(nullif(p_payload->>'hubungan_wali', ''), hubungan_wali),
    emis_extra = coalesce(p_payload->'emis_extra', emis_extra),
    updated_at = now()
  where nis = p_nis;

  perform app_private.audit_sensitive_access('UPDATE_SENSITIVE', 'santri', p_nis, jsonb_build_object('reason', coalesce(p_reason, 'admin_update'), 'fields', (select jsonb_agg(key) from jsonb_object_keys(p_payload) as key)));
  return public.get_santri_detail_secure(p_nis, 'post_update');
end;
$$;


ALTER FUNCTION "public"."update_santri_secure"("p_nis" "text", "p_payload" "jsonb", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_santri_secure"("p_nis" "text", "p_payload" "jsonb", "p_reason" "text") IS 'Secure santri update path. Keeps legacy columns compatible while synchronizing encrypted/hash sensitive fields.';



CREATE OR REPLACE FUNCTION "public"."validate_coords_and_set_geom"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  -- validate lat/lon ranges if not null
  if new.latitude is not null then
    if new.latitude < -90 or new.latitude > 90 then
      raise exception 'invalid latitude % for nis %', new.latitude, new.nis;
    end if;
  end if;

  if new.longitude is not null then
    if new.longitude < -180 or new.longitude > 180 then
      raise exception 'invalid longitude % for nis %', new.longitude, new.nis;
    end if;
  end if;

  -- set geom if both lat & lon present
  if new.latitude is not null and new.longitude is not null then
    new.geom := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326);
  else
    new.geom := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_coords_and_set_geom"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_santri_emis"("p_nis_list" "text"[] DEFAULT NULL::"text"[], "p_status" "text" DEFAULT NULL::"text") RETURNS TABLE("nis" "text", "nama" "text", "ready_emis" boolean, "sensitive_complete" boolean, "geocode_ok" boolean, "geocode_status" "text", "errors" "text"[], "warnings" "text"[], "mapped" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $_$
declare
  s public.santri%rowtype;
  v_errors text[];
  v_warnings text[];
  v_sensitive_errors text[];
  v_nik text;
  v_nisn text;
  v_no_kk text;
  v_nik_ayah text;
  v_nik_ibu text;
  v_nik_wali text;
  v_ayah text;
  v_ibu text;
  v_wali text;
  v_hp text;
  v_alamat text;
  v_extra jsonb;
  v_status_mukim_code text;
  v_program_code text;
  v_agama_code text;
  v_distance_code text;
begin
  if not app_private.is_santri_admin() then
    raise exception 'Not authorized';
  end if;

  perform app_private.audit_sensitive_access('VALIDATE_EMIS', 'santri', coalesce(array_to_string(p_nis_list, ','), 'bulk'), jsonb_build_object('status', p_status));

  for s in
    select * from public.santri sx
    where public.check_access_scope(sx.jenis_kelamin::text, sx.jurusan::text)
      and (p_nis_list is null or sx.nis = any(p_nis_list))
      and (p_status is null or sx.status_santri::text = p_status)
    order by sx.nama, sx.nis
  loop
    v_errors := array[]::text[];
    v_warnings := array[]::text[];
    v_sensitive_errors := array[]::text[];
    v_extra := coalesce(s.emis_extra, '{}'::jsonb);

    v_nik := app_private.decrypt_text(s.nik_enc);
    v_nisn := app_private.decrypt_text(s.nisn_enc);
    v_no_kk := app_private.decrypt_text(s.no_kk_enc);
    v_nik_ayah := app_private.decrypt_text(s.nik_ayah_enc);
    v_nik_ibu := app_private.decrypt_text(s.nik_ibu_enc);
    v_nik_wali := app_private.decrypt_text(s.nik_wali_enc);
    v_ayah := app_private.decrypt_text(s.ayah_enc);
    v_ibu := app_private.decrypt_text(s.ibu_enc);
    v_wali := app_private.decrypt_text(s.nama_wali_enc);
    v_hp := app_private.decrypt_text(s.no_kontak_wali_enc);
    v_alamat := app_private.decrypt_text(s.alamat_lengkap_enc);

    v_status_mukim_code := coalesce(v_extra->>'tinggal_bersama', app_private.emis_status_mukim_code(s.status_mukim));
    v_program_code := coalesce(v_extra->>'program_pesantren_kode', app_private.emis_program_pesantren_code(s.jurusan::text));
    v_agama_code := app_private.emis_agama_code(s.agama);
    v_distance_code := coalesce(v_extra->>'jarak_rumah_kategori', app_private.emis_distance_category(s.jarak_rumah_km));

    if not coalesce(v_nik ~ '^\d{16}$', false) then v_sensitive_errors := array_append(v_sensitive_errors, 'NIK santri wajib 16 digit.'); end if;
    if not coalesce(v_nisn ~ '^\d{10}$', false) then v_sensitive_errors := array_append(v_sensitive_errors, 'NISN santri wajib 10 digit.'); end if;
    if not coalesce(v_no_kk ~ '^\d{16}$', false) then v_sensitive_errors := array_append(v_sensitive_errors, 'Nomor KK wajib 16 digit.'); end if;
    if not coalesce(v_nik_ayah ~ '^\d{16}$', false) then v_sensitive_errors := array_append(v_sensitive_errors, 'NIK ayah wajib 16 digit.'); end if;
    if not coalesce(v_nik_ibu ~ '^\d{16}$', false) then v_sensitive_errors := array_append(v_sensitive_errors, 'NIK ibu wajib 16 digit.'); end if;
    if s.hubungan_wali is not null and not coalesce(v_nik_wali ~ '^\d{16}$', false) then v_sensitive_errors := array_append(v_sensitive_errors, 'NIK wali wajib 16 digit jika wali diisi.'); end if;
    if length(coalesce(v_ayah, '')) < 3 then v_sensitive_errors := array_append(v_sensitive_errors, 'Nama ayah minimal 3 karakter.'); end if;
    if length(coalesce(v_ibu, '')) < 3 then v_sensitive_errors := array_append(v_sensitive_errors, 'Nama ibu minimal 3 karakter.'); end if;
    if s.hubungan_wali is not null and length(coalesce(v_wali, '')) < 3 then v_sensitive_errors := array_append(v_sensitive_errors, 'Nama wali minimal 3 karakter jika wali diisi.'); end if;
    if not coalesce(v_hp ~ '^\d{10,15}$', false) then v_sensitive_errors := array_append(v_sensitive_errors, 'Nomor HP wali wajib angka 10-15 digit.'); end if;
    if length(coalesce(v_alamat, '')) < 8 then v_sensitive_errors := array_append(v_sensitive_errors, 'Alamat lengkap wajib diisi.'); end if;

    v_errors := v_errors || v_sensitive_errors;

    if s.nama is null or length(trim(s.nama)) < 3 then v_errors := array_append(v_errors, 'Nama santri minimal 3 karakter.'); end if;
    if v_agama_code <> '01' then v_errors := array_append(v_errors, 'Agama harus Islam/kode 01.'); end if;
    if s.kewarganegaraan is null then v_errors := array_append(v_errors, 'Kewarganegaraan wajib diisi.'); end if;
    if v_status_mukim_code is null then v_errors := array_append(v_errors, 'Status mukim/tinggal bersama belum terpetakan ke kode EMIS.'); end if;
    if v_program_code is null then v_errors := array_append(v_errors, 'Jurusan/program pesantren belum terpetakan ke kode EMIS.'); end if;
    if v_extra->>'jenjang_pesantren' is null then v_errors := array_append(v_errors, 'Jenjang pesantren wajib diisi.'); end if;
    if v_extra->>'jenis_pendaftaran' is null then v_errors := array_append(v_errors, 'Jenis pendaftaran wajib diisi.'); end if;
    if v_extra->>'status_kepemilikan_rumah' is null then v_warnings := array_append(v_warnings, 'Status kepemilikan rumah belum diisi.'); end if;
    if v_extra->>'golongan_darah' is null then v_warnings := array_append(v_warnings, 'Golongan darah belum diisi.'); end if;
    if v_extra->>'npsn_asal_sekolah' is not null and not coalesce((v_extra->>'npsn_asal_sekolah') ~ '^\d{8}$', false) then v_errors := array_append(v_errors, 'NPSN asal sekolah wajib 8 digit.'); end if;
    if s.nsp is not null and not coalesce(s.nsp ~ '^\d{12}$', false) then v_errors := array_append(v_errors, 'NSP wajib 12 digit jika diisi.'); end if;
    if s.kecamatan_id is null or not coalesce(s.kecamatan_id ~ '^\d{6,10}$', false) then v_warnings := array_append(v_warnings, 'Kode kecamatan BPS belum valid/terisi.'); end if;
    if v_distance_code is null then v_warnings := array_append(v_warnings, 'Kategori jarak rumah EMIS belum dapat dihitung.'); end if;
    if not (s.latitude is not null and s.longitude is not null and upper(coalesce(s.geocode_status, '')) = 'GEOCODED') then v_warnings := array_append(v_warnings, 'Geocode belum OK.'); end if;

    nis := s.nis;
    nama := coalesce(s.nama, app_private.decrypt_text(s.nama_enc));
    sensitive_complete := cardinality(v_sensitive_errors) = 0;
    geocode_ok := s.latitude is not null and s.longitude is not null and upper(coalesce(s.geocode_status, '')) = 'GEOCODED';
    geocode_status := coalesce(s.geocode_status, 'PENDING');
    ready_emis := cardinality(v_errors) = 0;
    errors := v_errors;
    warnings := v_warnings;
    mapped := jsonb_build_object(
      'agama', v_agama_code,
      'status_mukim', v_status_mukim_code,
      'program_pesantren', v_program_code,
      'jarak_rumah_kategori', v_distance_code,
      'pendidikan_ayah', app_private.emis_education_code(s.pendidikan_ayah),
      'pekerjaan_ayah', app_private.emis_job_code(s.pekerjaan_ayah),
      'penghasilan_ayah', app_private.emis_income_code(s.penghasilan_ayah),
      'pendidikan_ibu', app_private.emis_education_code(s.pendidikan_ibu),
      'pekerjaan_ibu', app_private.emis_job_code(s.pekerjaan_ibu),
      'penghasilan_ibu', app_private.emis_income_code(s.penghasilan_ibu),
      'pendidikan_wali', app_private.emis_education_code(s.pendidikan_wali),
      'pekerjaan_wali', app_private.emis_job_code(s.pekerjaan_wali),
      'penghasilan_wali', app_private.emis_income_code(s.penghasilan_wali)
    );
    return next;
  end loop;
end;
$_$;


ALTER FUNCTION "public"."validate_santri_emis"("p_nis_list" "text"[], "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_wallet_ledger_integrity"("p_santri_nis" "text", "p_from_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("is_valid" boolean, "broken_at" bigint, "details" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_prev_hash text := null;
  v_expected_hash text;
  v_entry record;
begin
  for v_entry in
    select *
    from public.transaksi_dompet
    where santri_nis = p_santri_nis
      and (p_from_date is null or created_at >= p_from_date)
    order by id asc
  loop
    if v_prev_hash is not null and v_entry.prev_hash is distinct from v_prev_hash then
      return query select false, v_entry.id, 'prev_hash does not match previous entry_hash';
      return;
    end if;

    v_expected_hash := app_private.wallet_ledger_hash(
      v_entry.santri_nis,
      v_entry.direction::text,
      v_entry.category::text,
      v_entry.amount,
      v_entry.balance_before,
      v_entry.balance_after,
      v_entry.idempotency_key,
      v_entry.prev_hash,
      v_entry.nonce,
      v_entry.signature,
      v_entry.created_at
    );

    if v_entry.entry_hash is distinct from v_expected_hash then
      return query select false, v_entry.id, 'entry_hash recompute mismatch';
      return;
    end if;

    v_prev_hash := v_entry.entry_hash;
  end loop;

  return query select true, null::bigint, 'Chain valid';
end;
$$;


ALTER FUNCTION "public"."verify_wallet_ledger_integrity"("p_santri_nis" "text", "p_from_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_acknowledge_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event public.wallet_risk_events%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menangani peringatan keamanan dompet';
  end if;

  select * into v_event
  from public.wallet_risk_events
  where id = p_risk_event_id
  for update;

  if not found then
    raise exception 'Peringatan keamanan tidak ditemukan';
  end if;

  if v_event.status in ('resolved','false_positive') then
    raise exception 'Peringatan keamanan sudah selesai';
  end if;

  update public.wallet_risk_events
  set status = 'acknowledged',
      acknowledged_by = p_actor_id,
      acknowledged_at = now(),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'acknowledge_note', nullif(trim(coalesce(p_note, '')), ''),
        'acknowledge_role', p_actor_role
      )
  where id = p_risk_event_id
  returning * into v_event;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_acknowledge_risk_event',
    'wallet_risk_events',
    v_event.santri_nis,
    v_event.id::text,
    jsonb_build_object('severity', v_event.severity, 'rule_code', v_event.rule_code, 'note', p_note)
  );

  return to_jsonb(v_event);
end;
$$;


ALTER FUNCTION "public"."wallet_acknowledge_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_assign_kantin_merchant"("p_kantin_user_id" "uuid", "p_merchant_id" "uuid", "p_outlet_id" "uuid" DEFAULT NULL::"uuid", "p_merchant_role" "text" DEFAULT 'cashier'::"text", "p_actor_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_assignment public.wallet_merchant_users%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_kantin_user_id and role = 'kantin' and coalesce(is_active, true)
  ) then
    raise exception 'Target user is not an active kantin profile';
  end if;

  if not exists (
    select 1 from public.wallet_merchants
    where id = p_merchant_id and status = 'active'
  ) then
    raise exception 'Merchant is not active';
  end if;

  if p_outlet_id is not null and not exists (
    select 1 from public.wallet_merchant_outlets
    where id = p_outlet_id and merchant_id = p_merchant_id and status = 'active'
  ) then
    raise exception 'Outlet is not active for this merchant';
  end if;

  if p_merchant_role not in ('owner','manager','cashier','auditor') then
    raise exception 'Invalid merchant role';
  end if;

  insert into public.wallet_merchant_users (
    merchant_id,
    profile_id,
    outlet_id,
    merchant_role,
    status
  ) values (
    p_merchant_id,
    p_kantin_user_id,
    p_outlet_id,
    p_merchant_role,
    'active'
  )
  on conflict do nothing;

  select * into v_assignment
  from public.wallet_merchant_users
  where merchant_id = p_merchant_id
    and profile_id = p_kantin_user_id
    and (outlet_id is not distinct from p_outlet_id)
  order by created_at desc
  limit 1;

  update public.wallet_merchant_users
  set status = 'active',
      merchant_role = p_merchant_role
  where id = v_assignment.id
  returning * into v_assignment;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    'admin',
    'wallet_assign_kantin_merchant',
    'wallet_merchant_users',
    v_assignment.id::text,
    jsonb_build_object(
      'kantin_user_id', p_kantin_user_id,
      'merchant_id', p_merchant_id,
      'outlet_id', p_outlet_id,
      'merchant_role', p_merchant_role
    )
  );

  return to_jsonb(v_assignment);
end;
$$;


ALTER FUNCTION "public"."wallet_assign_kantin_merchant"("p_kantin_user_id" "uuid", "p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_merchant_role" "text", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_attach_merchant_settlement_proof"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_storage_path" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text;
  v_request public.wallet_merchant_settlement_requests%rowtype;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor_id and coalesce(is_active, true);

  if v_actor_role not in ('super_admin','bendahara') then
    raise exception 'Hanya bendahara/super admin yang bisa mengarsipkan bukti pencairan';
  end if;

  if p_storage_path is null or length(trim(p_storage_path)) < 8 then
    raise exception 'Path bukti transfer tidak valid';
  end if;

  update public.wallet_merchant_settlement_requests
  set proof_storage_path = trim(p_storage_path),
      proof_uploaded_by = p_actor_id,
      proof_uploaded_at = now(),
      proof_metadata = coalesce(proof_metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where id = p_settlement_request_id
  returning * into v_request;

  if not found then
    raise exception 'Pengajuan pencairan tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    v_actor_role,
    'wallet_attach_merchant_settlement_proof',
    'wallet_merchant_settlement_requests',
    v_request.id::text,
    jsonb_build_object(
      'merchant_id', v_request.merchant_id,
      'outlet_id', v_request.outlet_id,
      'amount', v_request.amount,
      'proof_storage_path', trim(p_storage_path)
    )
  );

  return to_jsonb(v_request);
end;
$$;


ALTER FUNCTION "public"."wallet_attach_merchant_settlement_proof"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_storage_path" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_broadcast_maintenance"("p_title" "text", "p_body" "text", "p_start_at" timestamp with time zone, "p_duration_minutes" integer, "p_actor_id" "uuid" DEFAULT NULL::"uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count bigint;
begin
  insert into public.notification_queue (user_id, title, body, source_table, event_type, priority, data, reference_id)
  select
    p.id,
    p_title,
    p_body,
    'wallet_maintenance',
    'wallet.maintenance.scheduled',
    'high',
    jsonb_build_object('start_at', p_start_at, 'duration_minutes', p_duration_minutes, 'actor_id', p_actor_id),
    coalesce(p_start_at::text, now()::text)
  from public.profiles p
  where coalesce(p.is_active, true)
    and p.role in ('wali','kantin','super_admin','bendahara','rois','dewan');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."wallet_broadcast_maintenance"("p_title" "text", "p_body" "text", "p_start_at" timestamp with time zone, "p_duration_minutes" integer, "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_confirm_kantin_payment"("p_authorization_session_id" "uuid", "p_approved_by" "uuid", "p_approved_device_id" "text", "p_signature" "text", "p_signature_public_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_session public.wallet_authorization_sessions%rowtype;
  v_wallet public.dompet_santri%rowtype;
  v_device public.wallet_devices%rowtype;
  v_day_spend bigint := 0;
  v_month_spend bigint := 0;
  v_post_result jsonb;
  v_existing_ledger_id bigint;
  v_authorization_mode text;
  v_parent_threshold bigint := 75000;
begin
  if p_authorization_session_id is null then
    raise exception 'authorization_session_id is required';
  end if;

  if p_approved_by is null then
    raise exception 'approved_by is required';
  end if;

  if p_approved_device_id is null or length(trim(p_approved_device_id)) = 0 then
    raise exception 'approved_device_id is required';
  end if;

  if p_signature is null or length(trim(p_signature)) = 0 then
    raise exception 'signature is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'A strong idempotency key is required';
  end if;

  select coalesce((metadata->>'parent_approval_required_above')::bigint, 75000)
  into v_parent_threshold
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  select * into v_session
  from public.wallet_authorization_sessions
  where id = p_authorization_session_id
  for update;

  if not found then
    raise exception 'Authorization session not found';
  end if;

  select metadata->>'authorization_mode'
  into v_authorization_mode
  from public.wallet_payment_intents
  where id = v_session.payment_intent_id;

  if coalesce(v_authorization_mode, 'student_pin') <> 'parent_approval' or v_session.amount <= v_parent_threshold then
    raise exception 'Parent approval is only valid for a single transaction above %', v_parent_threshold;
  end if;

  if v_session.status = 'posted' then
    select posted_ledger_id into v_existing_ledger_id
    from public.wallet_payment_intents
    where id = v_session.payment_intent_id;

    return jsonb_build_object(
      'status', 'idempotent_replay',
      'authorization_session_id', v_session.id,
      'payment_intent_id', v_session.payment_intent_id,
      'ledger_id', v_existing_ledger_id
    );
  end if;

  if v_session.status not in ('requires_authorization','authorized') then
    raise exception 'Authorization session is not confirmable by wali';
  end if;

  if v_session.expires_at <= now() then
    update public.wallet_authorization_sessions set status = 'expired' where id = v_session.id;
    update public.wallet_payment_intents set status = 'expired', updated_at = now() where id = v_session.payment_intent_id;
    raise exception 'Authorization session expired';
  end if;

  select * into v_wallet
  from public.dompet_santri
  where santri_nis = v_session.santri_nis
  for update;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  select * into v_device
  from public.wallet_devices
  where profile_id = p_approved_by
    and santri_nis = v_session.santri_nis
    and device_id = p_approved_device_id
    and status = 'active'
  limit 1;

  if not found then
    raise exception 'Approving device is not active for this wallet';
  end if;

  if v_device.public_key <> p_signature_public_key then
    raise exception 'Signature public key does not match active device';
  end if;

  if v_wallet.daily_spend_limit is not null then
    select coalesce(sum(amount), 0) into v_day_spend
    from public.transaksi_dompet
    where santri_nis = v_session.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and created_at < (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '1 day') at time zone 'Asia/Jakarta';

    if v_day_spend + v_session.amount > v_wallet.daily_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'daily', v_wallet.daily_spend_limit, v_day_spend, v_session.amount, true, v_session.id::text);
      raise exception 'Transaction exceeds daily spend limit';
    elsif v_day_spend + v_session.amount >= v_wallet.daily_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'daily', v_wallet.daily_spend_limit, v_day_spend + v_session.amount, v_session.amount, false, v_session.id::text);
    end if;
  end if;

  if v_wallet.monthly_spend_limit is not null then
    select coalesce(sum(amount), 0) into v_month_spend
    from public.transaksi_dompet
    where santri_nis = v_session.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and created_at < (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta';

    if v_month_spend + v_session.amount > v_wallet.monthly_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'monthly', v_wallet.monthly_spend_limit, v_month_spend, v_session.amount, true, v_session.id::text);
      raise exception 'Transaction exceeds monthly spend limit';
    elsif v_month_spend + v_session.amount >= v_wallet.monthly_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'monthly', v_wallet.monthly_spend_limit, v_month_spend + v_session.amount, v_session.amount, false, v_session.id::text);
    end if;
  end if;

  update public.wallet_authorization_sessions
  set status = 'authorized', approved_by = p_approved_by, approved_device_id = p_approved_device_id, approved_at = now()
  where id = v_session.id;

  update public.wallet_payment_intents
  set status = 'authorized',
      approved_at = now(),
      updated_at = now(),
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'approved_device_id', p_approved_device_id,
        'signature_public_key', p_signature_public_key,
        'authorization_session_id', v_session.id,
        'authorization_mode', 'parent_approval'
      )
  where id = v_session.payment_intent_id;

  v_post_result := public.wallet_post_transaction(
    v_session.santri_nis,
    'debit'::public.wallet_direction,
    'pembayaran_kantin'::public.tipe_kategori_transaksi,
    v_session.amount,
    v_session.kantin_user_id,
    'kantin',
    p_idempotency_key,
    'Pembayaran kantin',
    v_session.kantin_user_id,
    'kantin',
    null,
    v_session.payment_intent_id,
    v_session.nonce,
    p_signature,
    p_signature_public_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'authorization_session_id', v_session.id,
      'authorization_mode', 'parent_approval',
      'approved_by', p_approved_by,
      'approved_device_id', p_approved_device_id,
      'merchant_id', v_session.merchant_id,
      'outlet_id', v_session.outlet_id
    )
  );

  update public.wallet_authorization_sessions set status = 'posted' where id = v_session.id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_approved_by,
    'wali',
    'wallet_confirm_kantin_payment',
    'wallet_authorization_sessions',
    v_session.santri_nis,
    v_session.id::text,
    jsonb_build_object('payment_intent_id', v_session.payment_intent_id, 'amount', v_session.amount, 'device_id', p_approved_device_id, 'ledger_id', v_post_result->>'ledger_id', 'authorization_mode', 'parent_approval')
  );

  return jsonb_build_object('status', 'posted', 'authorization_session_id', v_session.id, 'payment_intent_id', v_session.payment_intent_id, 'ledger', v_post_result);
end;
$$;


ALTER FUNCTION "public"."wallet_confirm_kantin_payment"("p_authorization_session_id" "uuid", "p_approved_by" "uuid", "p_approved_device_id" "text", "p_signature" "text", "p_signature_public_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_confirm_kantin_student_payment"("p_authorization_session_id" "uuid", "p_student_proof_reference" "text", "p_idempotency_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_session public.wallet_authorization_sessions%rowtype;
  v_wallet public.dompet_santri%rowtype;
  v_day_spend bigint := 0;
  v_month_spend bigint := 0;
  v_post_result jsonb;
  v_existing_ledger_id bigint;
  v_authorization_mode text;
  v_parent_threshold bigint := 75000;
begin
  if p_authorization_session_id is null then
    raise exception 'authorization_session_id is required';
  end if;

  if p_student_proof_reference is null or length(trim(p_student_proof_reference)) < 12 then
    raise exception 'student proof reference is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'A strong idempotency key is required';
  end if;

  select coalesce((metadata->>'parent_approval_required_above')::bigint, 75000)
  into v_parent_threshold
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  select * into v_session
  from public.wallet_authorization_sessions
  where id = p_authorization_session_id
  for update;

  if not found then
    raise exception 'Authorization session not found';
  end if;

  select metadata->>'authorization_mode'
  into v_authorization_mode
  from public.wallet_payment_intents
  where id = v_session.payment_intent_id;

  if coalesce(v_authorization_mode, 'student_pin') <> 'student_pin' or v_session.amount > v_parent_threshold then
    raise exception 'Student PIN flow is only valid for a single transaction up to %', v_parent_threshold;
  end if;

  if v_session.status = 'posted' then
    select posted_ledger_id into v_existing_ledger_id from public.wallet_payment_intents where id = v_session.payment_intent_id;
    return jsonb_build_object('status', 'idempotent_replay', 'authorization_session_id', v_session.id, 'payment_intent_id', v_session.payment_intent_id, 'ledger_id', v_existing_ledger_id);
  end if;

  if v_session.status not in ('pending','authorized') then
    raise exception 'Authorization session is not confirmable by student PIN';
  end if;

  if v_session.expires_at <= now() then
    update public.wallet_authorization_sessions set status = 'expired' where id = v_session.id;
    update public.wallet_payment_intents set status = 'expired', updated_at = now() where id = v_session.payment_intent_id;
    raise exception 'Authorization session expired';
  end if;

  select * into v_wallet
  from public.dompet_santri
  where santri_nis = v_session.santri_nis
  for update;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  if v_wallet.daily_spend_limit is not null then
    select coalesce(sum(amount), 0) into v_day_spend
    from public.transaksi_dompet
    where santri_nis = v_session.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and created_at < (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '1 day') at time zone 'Asia/Jakarta';

    if v_day_spend + v_session.amount > v_wallet.daily_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'daily', v_wallet.daily_spend_limit, v_day_spend, v_session.amount, true, v_session.id::text);
      raise exception 'Transaction exceeds daily spend limit';
    elsif v_day_spend + v_session.amount >= v_wallet.daily_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'daily', v_wallet.daily_spend_limit, v_day_spend + v_session.amount, v_session.amount, false, v_session.id::text);
    end if;
  end if;

  if v_wallet.monthly_spend_limit is not null then
    select coalesce(sum(amount), 0) into v_month_spend
    from public.transaksi_dompet
    where santri_nis = v_session.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and created_at < (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta';

    if v_month_spend + v_session.amount > v_wallet.monthly_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'monthly', v_wallet.monthly_spend_limit, v_month_spend, v_session.amount, true, v_session.id::text);
      raise exception 'Transaction exceeds monthly spend limit';
    elsif v_month_spend + v_session.amount >= v_wallet.monthly_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'monthly', v_wallet.monthly_spend_limit, v_month_spend + v_session.amount, v_session.amount, false, v_session.id::text);
    end if;
  end if;

  update public.wallet_authorization_sessions
  set status = 'authorized',
      approved_device_id = nullif(p_metadata->>'kantin_device_id', ''),
      approved_at = now()
  where id = v_session.id;

  update public.wallet_payment_intents
  set status = 'authorized',
      approved_at = now(),
      updated_at = now(),
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'authorization_session_id', v_session.id,
        'authorization_mode', 'student_pin',
        'student_proof_reference', p_student_proof_reference
      )
  where id = v_session.payment_intent_id;

  v_post_result := public.wallet_post_transaction(
    v_session.santri_nis,
    'debit'::public.wallet_direction,
    'pembayaran_kantin'::public.tipe_kategori_transaksi,
    v_session.amount,
    v_session.kantin_user_id,
    'kantin',
    p_idempotency_key,
    'Pembayaran kantin',
    v_session.kantin_user_id,
    'kantin',
    null,
    v_session.payment_intent_id,
    v_session.nonce,
    p_student_proof_reference,
    null,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'authorization_session_id', v_session.id,
      'authorization_mode', 'student_pin',
      'student_proof_reference', p_student_proof_reference,
      'merchant_id', v_session.merchant_id,
      'outlet_id', v_session.outlet_id
    )
  );

  update public.wallet_authorization_sessions set status = 'posted' where id = v_session.id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    v_session.kantin_user_id,
    'kantin',
    'wallet_confirm_kantin_student_payment',
    'wallet_authorization_sessions',
    v_session.santri_nis,
    v_session.id::text,
    jsonb_build_object('payment_intent_id', v_session.payment_intent_id, 'amount', v_session.amount, 'ledger_id', v_post_result->>'ledger_id', 'authorization_mode', 'student_pin')
  );

  return jsonb_build_object('status', 'posted', 'authorization_session_id', v_session.id, 'payment_intent_id', v_session.payment_intent_id, 'ledger', v_post_result);
end;
$$;


ALTER FUNCTION "public"."wallet_confirm_kantin_student_payment"("p_authorization_session_id" "uuid", "p_student_proof_reference" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_create_account"("p_santri_nis" "text", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_actor_role" "text" DEFAULT 'system'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_account public.dompet_santri%rowtype;
  v_role text := lower(coalesce(p_actor_role, 'system'));
begin
  if v_role not in ('super_admin','bendahara','wali','system') then
    raise exception 'Invalid actor role for wallet account creation';
  end if;

  insert into public.dompet_santri (santri_nis)
  values (p_santri_nis)
  on conflict (santri_nis) do update set updated_at = excluded.updated_at
  returning * into v_account;

  insert into public.wallet_card_qr_versions (wallet_public_id, santri_nis, issued_by, metadata)
  values (v_account.wallet_public_id, v_account.santri_nis, p_actor_id, jsonb_build_object('reason', 'initial_issue'))
  on conflict (wallet_public_id) do nothing;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (p_actor_id, v_role, 'wallet_create_account', 'dompet_santri', v_account.santri_nis, v_account.santri_nis, jsonb_build_object('wallet_public_id', v_account.wallet_public_id));

  return jsonb_build_object('status', 'ok', 'santri_nis', v_account.santri_nis, 'wallet_public_id', v_account.wallet_public_id, 'saldo', v_account.saldo);
end;
$$;


ALTER FUNCTION "public"."wallet_create_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_create_kantin_authorization_session"("p_wallet_public_id" "uuid", "p_amount" bigint, "p_kantin_user_id" "uuid", "p_merchant_id" "uuid" DEFAULT NULL::"uuid", "p_outlet_id" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_wallet public.dompet_santri%rowtype;
  v_existing public.wallet_authorization_sessions%rowtype;
  v_existing_mode text;
  v_payment_intent_id uuid;
  v_session_id uuid;
  v_challenge text := encode(gen_random_bytes(32), 'hex');
  v_nonce text := encode(gen_random_bytes(24), 'hex');
  v_expires_at timestamptz := now() + interval '5 minutes';
  v_device_id text := nullif(trim(coalesce(p_metadata->>'kantin_device_id', '')), '');
  v_device_public_key text := nullif(trim(coalesce(p_metadata->>'kantin_device_public_key', '')), '');
  v_device public.kantin_devices%rowtype;
  v_risk jsonb;
  v_is_frozen boolean;
  v_parent_threshold bigint := 75000;
  v_authorization_mode text;
  v_intent_status public.wallet_intent_status;
begin
  select is_frozen, coalesce((metadata->>'parent_approval_required_above')::bigint, 75000)
  into v_is_frozen, v_parent_threshold
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  if coalesce(v_is_frozen, false) then
    raise exception 'Wallet transactions are frozen by system control';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_kantin_user_id is null then
    raise exception 'kantin_user_id is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'A strong idempotency key is required';
  end if;

  if v_device_id is null then
    raise exception 'kantin_device_id is required';
  end if;

  select * into v_existing
  from public.wallet_authorization_sessions
  where idempotency_key = p_idempotency_key;

  if found then
    select metadata->>'authorization_mode'
    into v_existing_mode
    from public.wallet_payment_intents
    where id = v_existing.payment_intent_id;

    return jsonb_build_object(
      'status', case when v_existing_mode = 'parent_approval' then 'requires_parent_approval' else 'requires_student_pin' end,
      'authorization_mode', coalesce(v_existing_mode, 'student_pin'),
      'authorization_session_id', v_existing.id,
      'payment_intent_id', v_existing.payment_intent_id,
      'challenge', v_existing.challenge,
      'nonce', v_existing.nonce,
      'expires_at', v_existing.expires_at
    );
  end if;

  select * into v_device
  from public.kantin_devices
  where kantin_user_id = p_kantin_user_id
    and device_id = v_device_id
    and status = 'active'
  limit 1;

  if not found then
    insert into public.wallet_risk_events (
      severity, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'critical', p_kantin_user_id, v_device_id, p_merchant_id, p_outlet_id,
      'UNREGISTERED_KANTIN_DEVICE', 100, 'block',
      jsonb_build_object('wallet_public_id', p_wallet_public_id)
    );
    raise exception 'Kantin device is not active';
  end if;

  if v_device_public_key is not null and v_device.public_key <> v_device_public_key then
    insert into public.wallet_risk_events (
      severity, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'critical', p_kantin_user_id, v_device_id, p_merchant_id, p_outlet_id,
      'KANTIN_DEVICE_KEY_MISMATCH', 100, 'block',
      jsonb_build_object('wallet_public_id', p_wallet_public_id)
    );
    raise exception 'Kantin device key mismatch';
  end if;

  select * into v_wallet
  from public.dompet_santri
  where wallet_public_id = p_wallet_public_id
  for update;

  if not found then
    raise exception 'Wallet QR/NFC token not found';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  if v_wallet.single_transaction_limit is not null and p_amount > v_wallet.single_transaction_limit then
    raise exception 'Transaction exceeds single transaction limit';
  end if;

  if p_merchant_id is not null then
    if not exists (
      select 1
      from public.wallet_merchant_users wmu
      join public.wallet_merchants wm on wm.id = wmu.merchant_id
      where wmu.profile_id = p_kantin_user_id
        and wmu.merchant_id = p_merchant_id
        and (p_outlet_id is null or wmu.outlet_id is null or wmu.outlet_id = p_outlet_id)
        and wmu.status = 'active'
        and wm.status = 'active'
    ) then
      raise exception 'Kantin user is not assigned to this merchant/outlet';
    end if;
  end if;

  v_authorization_mode := case when p_amount > v_parent_threshold then 'parent_approval' else 'student_pin' end;
  v_intent_status := case when v_authorization_mode = 'parent_approval' then 'requires_authorization'::public.wallet_intent_status else 'pending'::public.wallet_intent_status end;

  v_risk := public.wallet_detect_transaction_risk(
    v_wallet.santri_nis,
    p_amount,
    p_kantin_user_id,
    v_device_id,
    p_merchant_id,
    p_outlet_id
  );

  insert into public.wallet_payment_intents (
    santri_nis,
    type,
    status,
    amount,
    created_by,
    created_by_role,
    expires_at,
    idempotency_key,
    merchant_id,
    outlet_id,
    metadata
  ) values (
    v_wallet.santri_nis,
    'kantin_payment',
    v_intent_status,
    p_amount,
    p_kantin_user_id,
    'kantin',
    v_expires_at,
    p_idempotency_key,
    p_merchant_id,
    p_outlet_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('risk', v_risk, 'authorization_mode', v_authorization_mode, 'parent_threshold', v_parent_threshold)
  ) returning id into v_payment_intent_id;

  insert into public.wallet_authorization_sessions (
    wallet_public_id,
    santri_nis,
    payment_intent_id,
    kantin_user_id,
    amount,
    status,
    challenge,
    nonce,
    expires_at,
    merchant_id,
    outlet_id,
    idempotency_key
  ) values (
    p_wallet_public_id,
    v_wallet.santri_nis,
    v_payment_intent_id,
    p_kantin_user_id,
    p_amount,
    v_intent_status,
    v_challenge,
    v_nonce,
    v_expires_at,
    p_merchant_id,
    p_outlet_id,
    p_idempotency_key
  ) returning id into v_session_id;

  update public.kantin_devices
  set last_seen_at = now()
  where id = v_device.id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_kantin_user_id,
    'kantin',
    'wallet_create_kantin_authorization_session',
    'wallet_authorization_sessions',
    v_wallet.santri_nis,
    v_session_id::text,
    jsonb_build_object('amount', p_amount, 'merchant_id', p_merchant_id, 'outlet_id', p_outlet_id, 'kantin_device_id', v_device_id, 'authorization_mode', v_authorization_mode)
  );

  return jsonb_build_object(
    'status', case when v_authorization_mode = 'parent_approval' then 'requires_parent_approval' else 'requires_student_pin' end,
    'authorization_mode', v_authorization_mode,
    'authorization_session_id', v_session_id,
    'payment_intent_id', v_payment_intent_id,
    'santri_nis', v_wallet.santri_nis,
    'challenge', v_challenge,
    'nonce', v_nonce,
    'expires_at', v_expires_at,
    'amount', p_amount,
    'parent_threshold', v_parent_threshold,
    'risk', v_risk
  );
end;
$$;


ALTER FUNCTION "public"."wallet_create_kantin_authorization_session"("p_wallet_public_id" "uuid", "p_amount" bigint, "p_kantin_user_id" "uuid", "p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_credit_merchant_from_posted_intent"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ledger public.transaksi_dompet%rowtype;
begin
  if new.status::text <> 'posted' or new.posted_ledger_id is null or new.merchant_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status::text = 'posted' and old.posted_ledger_id is not distinct from new.posted_ledger_id then
    return new;
  end if;

  select * into v_ledger
  from public.transaksi_dompet
  where id = new.posted_ledger_id;

  perform public.wallet_post_merchant_ledger(
    new.merchant_id,
    new.outlet_id,
    'credit',
    'kantin_sale',
    new.amount,
    'merchant-sale:' || new.id::text,
    new.created_by,
    'kantin',
    new.posted_ledger_id,
    new.id,
    null,
    'Penjualan kantin dari Dompet Santri',
    jsonb_build_object(
      'santri_nis', new.santri_nis,
      'santri_ledger_id', new.posted_ledger_id,
      'wallet_entry_hash', v_ledger.entry_hash
    )
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."wallet_credit_merchant_from_posted_intent"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_detect_transaction_risk"("p_santri_nis" "text", "p_amount" bigint, "p_kantin_user_id" "uuid", "p_device_id" "text", "p_merchant_id" "uuid" DEFAULT NULL::"uuid", "p_outlet_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_control jsonb;
  v_parent_threshold bigint := 75000;
  v_hour int;
  v_santri_velocity int;
  v_kantin_velocity int;
  v_avg_daily numeric;
  v_multiplier numeric;
  v_actions jsonb := '[]'::jsonb;
begin
  select metadata into v_control
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  v_parent_threshold := coalesce((v_control->>'parent_approval_required_above')::bigint, 75000);
  v_multiplier := coalesce((v_control->>'large_amount_average_multiplier')::numeric, 3);
  v_hour := extract(hour from now() at time zone coalesce(v_control->>'operating_timezone', 'Asia/Jakarta'));

  if v_hour < coalesce((v_control->>'operating_start_hour')::int, 6)
     or v_hour >= coalesce((v_control->>'operating_end_hour')::int, 21) then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'high', p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'OUTSIDE_OPERATING_HOURS', 80, 'block',
      jsonb_build_object('hour', v_hour, 'amount', p_amount)
    );
    v_actions := v_actions || jsonb_build_array('block_outside_operating_hours');
  end if;

  select count(*) into v_santri_velocity
  from public.transaksi_dompet
  where santri_nis = p_santri_nis
    and status = 'posted'
    and created_at >= now() - interval '5 minutes';

  if v_santri_velocity >= coalesce((v_control->>'santri_velocity_limit_5m')::int, 3) then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'high', p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'SANTRI_VELOCITY_5M', 90, 'freeze_wallet',
      jsonb_build_object('count_5m', v_santri_velocity, 'amount', p_amount)
    );
    v_actions := v_actions || jsonb_build_array('freeze_wallet_velocity');
  end if;

  select count(*) into v_kantin_velocity
  from public.transaksi_dompet
  where actor_id = p_kantin_user_id
    and actor_role = 'kantin'
    and status = 'posted'
    and created_at >= now() - interval '10 minutes';

  if v_kantin_velocity >= coalesce((v_control->>'kantin_velocity_limit_10m')::int, 30) then
    insert into public.wallet_risk_events (
      severity, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'medium', p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'KANTIN_VELOCITY_10M', 70, 'flag',
      jsonb_build_object('count_10m', v_kantin_velocity, 'amount', p_amount)
    );
    v_actions := v_actions || jsonb_build_array('flag_kantin_velocity');
  end if;

  select avg(day_amount) into v_avg_daily
  from (
    select date_trunc('day', created_at at time zone 'Asia/Jakarta') as day, sum(amount)::numeric as day_amount
    from public.transaksi_dompet
    where santri_nis = p_santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= now() - interval '30 days'
    group by 1
  ) x;

  if v_avg_daily is not null and v_avg_daily > 0 and p_amount > (v_avg_daily * v_multiplier) then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      case when p_amount > v_parent_threshold then 'high' else 'medium' end,
      p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'AMOUNT_ABOVE_BASELINE', 85,
      case when p_amount > v_parent_threshold then 'require_parent_approval' else 'flag' end,
      jsonb_build_object('amount', p_amount, 'avg_daily', v_avg_daily, 'multiplier', v_multiplier, 'parent_threshold', v_parent_threshold)
    );
    v_actions := v_actions || jsonb_build_array(case when p_amount > v_parent_threshold then 'require_parent_approval' else 'flag_amount_above_baseline' end);
  end if;

  return jsonb_build_object('status', 'ok', 'actions', v_actions, 'parent_threshold', v_parent_threshold);
end;
$$;


ALTER FUNCTION "public"."wallet_detect_transaction_risk"("p_santri_nis" "text", "p_amount" bigint, "p_kantin_user_id" "uuid", "p_device_id" "text", "p_merchant_id" "uuid", "p_outlet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_enqueue_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text" DEFAULT 'wallet'::"text", "p_data" "jsonb" DEFAULT '{}'::"jsonb", "p_priority" "text" DEFAULT 'normal'::"text", "p_reference_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  if coalesce(length(trim(p_title)), 0) = 0 or coalesce(length(trim(p_body)), 0) = 0 then
    raise exception 'Notification title/body is required';
  end if;

  insert into public.notification_queue (
    user_id,
    title,
    body,
    data,
    source_table,
    event_type,
    priority,
    reference_id
  ) values (
    p_user_id,
    left(trim(p_title), 120),
    left(trim(p_body), 500),
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object('event_type', p_event_type),
    p_source,
    p_event_type,
    coalesce(p_priority, 'normal'),
    p_reference_id
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."wallet_enqueue_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_escalate_overdue_disputes"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count bigint := 0;
  v_dispute record;
begin
  for v_dispute in
    select *
    from public.wallet_disputes
    where status in ('open','investigating')
      and response_due_at <= now()
      and escalated_at is null
  loop
    update public.wallet_disputes
    set escalated_at = now()
    where id = v_dispute.id;

    perform public.wallet_notify_role(
      'super_admin',
      'SLA dispute dompet terlewati',
      'Dispute ' || v_dispute.id || ' untuk NIS ' || v_dispute.santri_nis || ' belum direspons lebih dari 48 jam.',
      'wallet.dispute.sla_overdue',
      'wallet_disputes',
      jsonb_build_object('dispute_id', v_dispute.id, 'ledger_id', v_dispute.ledger_id, 'santri_nis', v_dispute.santri_nis),
      'critical',
      v_dispute.id::text
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('escalated_count', v_count);
end;
$$;


ALTER FUNCTION "public"."wallet_escalate_overdue_disputes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_escalate_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event public.wallet_risk_events%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh mengeskalasi peringatan keamanan dompet';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan eskalasi minimal 12 karakter';
  end if;

  select * into v_event
  from public.wallet_risk_events
  where id = p_risk_event_id
  for update;

  if not found then
    raise exception 'Peringatan keamanan tidak ditemukan';
  end if;

  if v_event.status in ('resolved','false_positive') then
    raise exception 'Peringatan keamanan sudah selesai';
  end if;

  update public.wallet_risk_events
  set status = 'escalated',
      escalated_at = now(),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'escalation_note', p_note,
        'escalated_by_role', p_actor_role
      )
  where id = p_risk_event_id
  returning * into v_event;

  perform public.wallet_notify_role(
    'super_admin',
    'Peringatan dompet dieskalasi',
    'Peringatan ' || v_event.rule_code || ' untuk NIS ' || coalesce(v_event.santri_nis, '-') || ' dieskalasi. Catatan: ' || p_note,
    'wallet.risk.escalated',
    'wallet_risk_events',
    jsonb_build_object('risk_event_id', v_event.id, 'santri_nis', v_event.santri_nis, 'severity', v_event.severity, 'note', p_note),
    'critical',
    v_event.id::text
  );

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_escalate_risk_event',
    'wallet_risk_events',
    v_event.santri_nis,
    v_event.id::text,
    jsonb_build_object('severity', v_event.severity, 'rule_code', v_event.rule_code, 'note', p_note)
  );

  return to_jsonb(v_event);
end;
$$;


ALTER FUNCTION "public"."wallet_escalate_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_investigate_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event public.wallet_risk_events%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menginvestigasi peringatan keamanan dompet';
  end if;

  select * into v_event
  from public.wallet_risk_events
  where id = p_risk_event_id
  for update;

  if not found then
    raise exception 'Peringatan keamanan tidak ditemukan';
  end if;

  if v_event.status in ('resolved','false_positive') then
    raise exception 'Peringatan keamanan sudah selesai';
  end if;

  update public.wallet_risk_events
  set status = 'investigating',
      acknowledged_by = coalesce(acknowledged_by, p_actor_id),
      acknowledged_at = coalesce(acknowledged_at, now()),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'investigation_note', nullif(trim(coalesce(p_note, '')), ''),
        'investigation_started_at', now(),
        'investigation_role', p_actor_role
      )
  where id = p_risk_event_id
  returning * into v_event;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_investigate_risk_event',
    'wallet_risk_events',
    v_event.santri_nis,
    v_event.id::text,
    jsonb_build_object('severity', v_event.severity, 'rule_code', v_event.rule_code, 'note', p_note)
  );

  return to_jsonb(v_event);
end;
$$;


ALTER FUNCTION "public"."wallet_investigate_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_lock_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
begin
  if v_role not in ('super_admin','bendahara') then
    raise exception 'Only super_admin or bendahara can lock wallet account';
  end if;

  update public.dompet_santri
  set status = 'locked', locked_reason = p_reason
  where santri_nis = p_santri_nis;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (p_actor_id, v_role, 'wallet_lock_account', 'dompet_santri', p_santri_nis, p_santri_nis, jsonb_build_object('reason', p_reason));

  return jsonb_build_object('status', 'locked', 'santri_nis', p_santri_nis);
end;
$$;


ALTER FUNCTION "public"."wallet_lock_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_mark_merchant_settlement_paid"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text;
  v_request public.wallet_merchant_settlement_requests%rowtype;
  v_ledger jsonb;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id and coalesce(is_active, true);
  if v_actor_role not in ('super_admin','bendahara') then
    raise exception 'Hanya bendahara/super admin yang bisa menandai pencairan dibayar';
  end if;

  select * into v_request
  from public.wallet_merchant_settlement_requests
  where id = p_settlement_request_id
  for update;

  if not found then raise exception 'Pengajuan pencairan tidak ditemukan'; end if;
  if v_request.status not in ('requested','approved') then raise exception 'Status pencairan tidak valid'; end if;

  v_ledger := public.wallet_post_merchant_ledger(
    v_request.merchant_id,
    v_request.outlet_id,
    'debit',
    'settlement_paid',
    v_request.amount,
    'merchant-settlement-paid:' || v_request.id::text,
    p_actor_id,
    v_actor_role,
    null,
    null,
    v_request.id,
    'Pencairan saldo kantin dibayar dari rekening pesantren',
    jsonb_build_object('note_present', p_note is not null)
  );

  update public.wallet_merchant_settlement_requests
  set status = 'paid',
      paid_ledger_id = (v_ledger->>'ledger_id')::bigint,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = p_note,
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return to_jsonb(v_request) || jsonb_build_object('ledger', v_ledger);
end;
$$;


ALTER FUNCTION "public"."wallet_mark_merchant_settlement_paid"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_notify_limit_event"("p_santri_nis" "text", "p_limit_type" "text", "p_limit_amount" bigint, "p_current_amount" bigint, "p_attempt_amount" bigint, "p_blocked" boolean, "p_reference_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_santri_name text;
begin
  select nama into v_santri_name
  from public.santri
  where nis = p_santri_nis;

  return public.wallet_notify_wali(
    p_santri_nis,
    case when p_blocked then 'Limit dompet terlampaui' else 'Limit dompet tercapai' end,
    coalesce(v_santri_name, p_santri_nis) || ' ' ||
    case when p_limit_type = 'daily' then 'mencapai limit harian' else 'mencapai limit bulanan' end ||
    ' Rp ' || to_char(p_limit_amount, 'FM999G999G999') ||
    '. Pemakaian sekarang Rp ' || to_char(p_current_amount, 'FM999G999G999') ||
    case when p_blocked then '. Transaksi Rp ' || to_char(p_attempt_amount, 'FM999G999G999') || ' ditolak.' else '.' end,
    case when p_limit_type = 'daily' then 'wallet.limit.daily' else 'wallet.limit.monthly' end,
    'dompet_santri',
    jsonb_build_object(
      'limit_type', p_limit_type,
      'limit_amount', p_limit_amount,
      'current_amount', p_current_amount,
      'attempt_amount', p_attempt_amount,
      'blocked', p_blocked
    ),
    case when p_blocked then 'high' else 'normal' end,
    p_reference_id
  );
end;
$$;


ALTER FUNCTION "public"."wallet_notify_limit_event"("p_santri_nis" "text", "p_limit_type" "text", "p_limit_amount" bigint, "p_current_amount" bigint, "p_attempt_amount" bigint, "p_blocked" boolean, "p_reference_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_notify_role"("p_role" "text", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text" DEFAULT 'wallet'::"text", "p_data" "jsonb" DEFAULT '{}'::"jsonb", "p_priority" "text" DEFAULT 'normal'::"text", "p_reference_id" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.wallet_notify_roles(array[p_role], p_title, p_body, p_event_type, p_source, p_data, p_priority, p_reference_id)
$$;


ALTER FUNCTION "public"."wallet_notify_role"("p_role" "text", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_notify_roles"("p_roles" "text"[], "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text" DEFAULT 'wallet'::"text", "p_data" "jsonb" DEFAULT '{}'::"jsonb", "p_priority" "text" DEFAULT 'normal'::"text", "p_reference_id" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count bigint := 0;
begin
  insert into public.notification_queue (
    user_id,
    title,
    body,
    data,
    source_table,
    event_type,
    priority,
    reference_id
  )
  select
    p.id,
    left(trim(p_title), 120),
    left(trim(p_body), 500),
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object('event_type', p_event_type, 'target_role', p.role),
    p_source,
    p_event_type,
    coalesce(p_priority, 'normal'),
    p_reference_id
  from public.profiles p
  where p.role = any(p_roles)
    and coalesce(p.is_active, true);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."wallet_notify_roles"("p_roles" "text"[], "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_notify_wali"("p_santri_nis" "text", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text" DEFAULT 'wallet'::"text", "p_data" "jsonb" DEFAULT '{}'::"jsonb", "p_priority" "text" DEFAULT 'normal'::"text", "p_reference_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_wali_id uuid;
begin
  select wali_id into v_wali_id
  from public.santri
  where nis = p_santri_nis;

  return public.wallet_enqueue_notification(
    v_wali_id,
    p_title,
    p_body,
    p_event_type,
    p_source,
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object('santri_nis', p_santri_nis),
    p_priority,
    p_reference_id
  );
end;
$$;


ALTER FUNCTION "public"."wallet_notify_wali"("p_santri_nis" "text", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_open_dispute"("p_ledger_id" bigint, "p_reported_by" "uuid", "p_reason" "text", "p_evidence" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ledger public.transaksi_dompet%rowtype;
  v_dispute public.wallet_disputes%rowtype;
begin
  select * into v_ledger
  from public.transaksi_dompet
  where id = p_ledger_id;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if not exists (
    select 1
    from public.santri s
    where s.nis = v_ledger.santri_nis
      and s.wali_id = p_reported_by
  ) then
    raise exception 'Reporter is not wali for this santri';
  end if;

  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'Dispute reason is too short';
  end if;

  insert into public.wallet_disputes (
    ledger_id,
    santri_nis,
    reported_by,
    reason,
    evidence
  ) values (
    p_ledger_id,
    v_ledger.santri_nis,
    p_reported_by,
    trim(p_reason),
    coalesce(p_evidence, '{}'::jsonb)
  )
  returning * into v_dispute;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_reported_by,
    'wali',
    'wallet_open_dispute',
    'wallet_disputes',
    v_ledger.santri_nis,
    v_dispute.id::text,
    jsonb_build_object('ledger_id', p_ledger_id)
  );

  return to_jsonb(v_dispute);
end;
$$;


ALTER FUNCTION "public"."wallet_open_dispute"("p_ledger_id" bigint, "p_reported_by" "uuid", "p_reason" "text", "p_evidence" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_post_merchant_ledger"("p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_direction" "text", "p_category" "text", "p_amount" bigint, "p_idempotency_key" "text", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_actor_role" "text" DEFAULT 'system'::"text", "p_santri_ledger_id" bigint DEFAULT NULL::bigint, "p_payment_intent_id" "uuid" DEFAULT NULL::"uuid", "p_settlement_request_id" "uuid" DEFAULT NULL::"uuid", "p_keterangan" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_balance public.wallet_merchant_balances%rowtype;
  v_existing public.wallet_merchant_ledger%rowtype;
  v_available_before bigint;
  v_available_after bigint;
  v_pending_before bigint;
  v_pending_after bigint;
  v_ledger_id bigint;
begin
  if p_merchant_id is null then raise exception 'merchant_id wajib diisi'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount wajib lebih dari nol'; end if;
  if p_direction not in ('credit','debit') then raise exception 'direction tidak valid'; end if;
  if p_category not in ('kantin_sale','settlement_request','settlement_paid','settlement_rejected','adjustment','refund') then raise exception 'category tidak valid'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then raise exception 'idempotency_key wajib kuat'; end if;

  select * into v_existing
  from public.wallet_merchant_ledger
  where idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'status', 'idempotent_replay',
      'ledger_id', v_existing.id,
      'saldo_available', v_existing.balance_available_after,
      'saldo_pending_settlement', v_existing.pending_settlement_after
    );
  end if;

  insert into public.wallet_merchant_balances (merchant_id, outlet_id)
  values (p_merchant_id, p_outlet_id)
  on conflict (merchant_id, outlet_id) do nothing;

  select * into v_balance
  from public.wallet_merchant_balances
  where merchant_id = p_merchant_id
    and outlet_id is not distinct from p_outlet_id
  for update;

  v_available_before := v_balance.saldo_available;
  v_pending_before := v_balance.saldo_pending_settlement;
  v_available_after := v_available_before;
  v_pending_after := v_pending_before;

  if p_category = 'kantin_sale' then
    v_available_after := v_available_before + p_amount;
  elsif p_category = 'settlement_request' then
    if v_available_before < p_amount then raise exception 'Saldo kantin tidak cukup untuk pencairan'; end if;
    v_available_after := v_available_before - p_amount;
    v_pending_after := v_pending_before + p_amount;
  elsif p_category = 'settlement_paid' then
    if v_pending_before < p_amount then raise exception 'Saldo pending pencairan tidak cukup'; end if;
    v_pending_after := v_pending_before - p_amount;
  elsif p_category = 'settlement_rejected' then
    if v_pending_before < p_amount then raise exception 'Saldo pending pencairan tidak cukup'; end if;
    v_available_after := v_available_before + p_amount;
    v_pending_after := v_pending_before - p_amount;
  elsif p_direction = 'credit' then
    v_available_after := v_available_before + p_amount;
  else
    if v_available_before < p_amount then raise exception 'Saldo kantin tidak cukup'; end if;
    v_available_after := v_available_before - p_amount;
  end if;

  update public.wallet_merchant_balances
  set saldo_available = v_available_after,
      saldo_pending_settlement = v_pending_after,
      total_sales = total_sales + case when p_category = 'kantin_sale' then p_amount else 0 end,
      total_settled = total_settled + case when p_category = 'settlement_paid' then p_amount else 0 end,
      updated_at = now()
  where id = v_balance.id;

  insert into public.wallet_merchant_ledger (
    merchant_id, outlet_id, direction, category, amount,
    balance_available_before, balance_available_after,
    pending_settlement_before, pending_settlement_after,
    santri_ledger_id, payment_intent_id, settlement_request_id,
    idempotency_key, actor_id, actor_role, keterangan, metadata
  ) values (
    p_merchant_id, p_outlet_id, p_direction, p_category, p_amount,
    v_available_before, v_available_after,
    v_pending_before, v_pending_after,
    p_santri_ledger_id, p_payment_intent_id, p_settlement_request_id,
    trim(p_idempotency_key), p_actor_id, coalesce(nullif(trim(p_actor_role), ''), 'system'), p_keterangan, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_ledger_id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    coalesce(nullif(trim(p_actor_role), ''), 'system'),
    'wallet_post_merchant_ledger',
    'wallet_merchant_ledger',
    v_ledger_id::text,
    jsonb_build_object('merchant_id', p_merchant_id, 'outlet_id', p_outlet_id, 'category', p_category, 'amount', p_amount)
  );

  return jsonb_build_object(
    'status', 'posted',
    'ledger_id', v_ledger_id,
    'saldo_available', v_available_after,
    'saldo_pending_settlement', v_pending_after
  );
end;
$$;


ALTER FUNCTION "public"."wallet_post_merchant_ledger"("p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_direction" "text", "p_category" "text", "p_amount" bigint, "p_idempotency_key" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_santri_ledger_id" bigint, "p_payment_intent_id" "uuid", "p_settlement_request_id" "uuid", "p_keterangan" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_post_transaction"("p_santri_nis" "text", "p_direction" "public"."wallet_direction", "p_category" "public"."tipe_kategori_transaksi", "p_amount" bigint, "p_actor_id" "uuid", "p_actor_role" "text", "p_idempotency_key" "text", "p_keterangan" "text" DEFAULT NULL::"text", "p_counterparty_id" "uuid" DEFAULT NULL::"uuid", "p_counterparty_role" "text" DEFAULT NULL::"text", "p_transaksi_keuangan_id" "uuid" DEFAULT NULL::"uuid", "p_payment_intent_id" "uuid" DEFAULT NULL::"uuid", "p_nonce" "text" DEFAULT NULL::"text", "p_signature" "text" DEFAULT NULL::"text", "p_signature_public_key" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private', 'extensions'
    AS $$
declare
  v_account public.dompet_santri%rowtype;
  v_existing public.transaksi_dompet%rowtype;
  v_current_saldo bigint;
  v_before bigint;
  v_after bigint;
  v_prev_hash text;
  v_hash text;
  v_created_at timestamptz := now();
  v_jenis text;
  v_ledger_id bigint;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_is_frozen boolean := false;
  v_recovery_categories text[] := array['correction','refund','account_migration_in','account_migration_out','settlement_to_pesantren_ledger'];
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_santri_nis is null or length(trim(p_santri_nis)) = 0 then
    raise exception 'santri_nis is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'A strong idempotency key is required';
  end if;

  if v_role not in ('super_admin','bendahara','rois','dewan','wali','kantin','system','midtrans') then
    raise exception 'Invalid wallet actor role: %', p_actor_role;
  end if;

  select * into v_existing
  from public.transaksi_dompet
  where idempotency_key = p_idempotency_key;

  if found then
    select saldo into v_current_saldo
    from public.dompet_santri
    where santri_nis = v_existing.santri_nis;

    return jsonb_build_object(
      'status', 'idempotent_replay',
      'ledger_id', v_existing.id,
      'saldo', v_current_saldo,
      'original_balance_after', v_existing.balance_after,
      'entry_hash', v_existing.entry_hash
    );
  end if;

  select is_frozen into v_is_frozen
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  if coalesce(v_is_frozen, false) and not (p_category::text = any (v_recovery_categories)) then
    raise exception 'Wallet transactions are frozen by system control';
  end if;

  if p_nonce is not null then
    insert into public.wallet_nonce_uses (nonce, santri_nis, purpose, used_by, expires_at, metadata)
    values (p_nonce, p_santri_nis, p_category::text, p_actor_id, now() + interval '15 minutes', jsonb_build_object('idempotency_key', p_idempotency_key));
  end if;

  insert into public.dompet_santri (santri_nis)
  values (p_santri_nis)
  on conflict (santri_nis) do nothing;

  select * into v_account
  from public.dompet_santri
  where santri_nis = p_santri_nis
  for update;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  if v_account.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  -- Limit wali adalah guardrail pengeluaran anak. Top up/credit Midtrans tidak boleh tertahan oleh batas belanja.
  if p_direction = 'debit' and v_account.single_transaction_limit is not null and p_amount > v_account.single_transaction_limit then
    raise exception 'Transaction exceeds single transaction limit';
  end if;

  v_before := v_account.saldo;

  if p_direction = 'credit' then
    v_after := v_before + p_amount;
    v_jenis := 'masuk';
  elsif p_direction = 'debit' then
    if v_before < p_amount then
      raise exception 'Saldo santri tidak mencukupi untuk transaksi ini.';
    end if;
    v_after := v_before - p_amount;
    v_jenis := 'keluar';
  else
    raise exception 'Invalid direction';
  end if;

  select entry_hash into v_prev_hash
  from public.transaksi_dompet
  where santri_nis = p_santri_nis
  order by id desc
  limit 1;

  v_hash := app_private.wallet_ledger_hash(
    p_santri_nis,
    p_direction::text,
    p_category::text,
    p_amount,
    v_before,
    v_after,
    p_idempotency_key,
    v_prev_hash,
    p_nonce,
    p_signature,
    v_created_at
  );

  perform set_config('app.wallet_mutation', 'on', true);

  update public.dompet_santri
  set saldo = v_after
  where santri_nis = p_santri_nis;

  insert into public.transaksi_dompet (
    created_at,
    posted_at,
    santri_nis,
    direction,
    jenis,
    category,
    kategori_transaksi,
    jenis_transaksi,
    amount,
    nominal,
    balance_before,
    balance_after,
    status,
    actor_id,
    actor_role,
    dicatat_oleh_id,
    counterparty_id,
    counterparty_role,
    transaksi_keuangan_id,
    payment_intent_id,
    idempotency_key,
    nonce,
    signature,
    signature_public_key,
    prev_hash,
    entry_hash,
    keterangan,
    metadata
  ) values (
    v_created_at,
    v_created_at,
    p_santri_nis,
    p_direction,
    v_jenis,
    p_category,
    p_category,
    p_category,
    p_amount,
    p_amount,
    v_before,
    v_after,
    'posted',
    p_actor_id,
    v_role,
    p_actor_id,
    p_counterparty_id,
    p_counterparty_role,
    p_transaksi_keuangan_id,
    p_payment_intent_id,
    p_idempotency_key,
    p_nonce,
    p_signature,
    p_signature_public_key,
    v_prev_hash,
    v_hash,
    p_keterangan,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_ledger_id;

  if p_payment_intent_id is not null then
    update public.wallet_payment_intents
    set status = 'posted', posted_ledger_id = v_ledger_id, updated_at = now()
    where id = p_payment_intent_id;
  end if;

  update public.kantin_devices
  set last_transaction_at = now(), last_seen_at = now()
  where device_id = nullif(p_metadata->>'kantin_device_id', '');

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    v_role,
    'wallet_post_transaction',
    'transaksi_dompet',
    p_santri_nis,
    v_ledger_id::text,
    jsonb_build_object('direction', p_direction, 'category', p_category, 'amount', p_amount, 'balance_before', v_before, 'balance_after', v_after)
  );

  return jsonb_build_object(
    'status', 'posted',
    'ledger_id', v_ledger_id,
    'saldo', v_after,
    'balance_before', v_before,
    'balance_after', v_after,
    'entry_hash', v_hash
  );
end;
$$;


ALTER FUNCTION "public"."wallet_post_transaction"("p_santri_nis" "text", "p_direction" "public"."wallet_direction", "p_category" "public"."tipe_kategori_transaksi", "p_amount" bigint, "p_actor_id" "uuid", "p_actor_role" "text", "p_idempotency_key" "text", "p_keterangan" "text", "p_counterparty_id" "uuid", "p_counterparty_role" "text", "p_transaksi_keuangan_id" "uuid", "p_payment_intent_id" "uuid", "p_nonce" "text", "p_signature" "text", "p_signature_public_key" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_record_pin_failure"("p_santri_nis" "text", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_actor_role" "text" DEFAULT NULL::"text", "p_device_id" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count_15m int;
  v_count_1h int;
  v_santri_name text;
begin
  insert into public.wallet_pin_attempts (santri_nis, actor_id, actor_role, device_id, attempt_status, metadata)
  values (p_santri_nis, p_actor_id, p_actor_role, p_device_id, 'failed', coalesce(p_metadata, '{}'::jsonb));

  select nama into v_santri_name from public.santri where nis = p_santri_nis;

  select count(*) into v_count_15m
  from public.wallet_pin_attempts
  where santri_nis = p_santri_nis
    and attempt_status = 'failed'
    and created_at >= now() - interval '15 minutes';

  select count(*) into v_count_1h
  from public.wallet_pin_attempts
  where santri_nis = p_santri_nis
    and attempt_status = 'failed'
    and created_at >= now() - interval '1 hour';

  if v_count_15m = 3 then
    update public.dompet_santri
    set status = 'locked',
        locked_reason = '3 failed PIN attempts'
    where santri_nis = p_santri_nis
      and status = 'active';

    perform public.wallet_notify_wali(
      p_santri_nis,
      'Percobaan PIN salah berulang',
      'Ada 3 percobaan PIN salah di akun ' || coalesce(v_santri_name, p_santri_nis) || '. Akun dikunci sementara 15 menit.',
      'wallet.pin.failed_3',
      'wallet_pin_attempts',
      jsonb_build_object('santri_nis', p_santri_nis, 'device_id', p_device_id, 'failed_count_15m', v_count_15m),
      'high',
      p_santri_nis
    );
  end if;

  if v_count_1h > 10 then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Percobaan PIN mencurigakan',
      'Lebih dari 10 percobaan PIN salah dalam 1 jam untuk NIS ' || p_santri_nis || '.',
      'wallet.pin.failed_excessive',
      'wallet_pin_attempts',
      jsonb_build_object('santri_nis', p_santri_nis, 'device_id', p_device_id, 'failed_count_1h', v_count_1h),
      'critical',
      p_santri_nis
    );
  end if;

  return jsonb_build_object('failed_count_15m', v_count_15m, 'failed_count_1h', v_count_1h);
end;
$$;


ALTER FUNCTION "public"."wallet_record_pin_failure"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_device_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_register_kantin_device"("p_kantin_user_id" "uuid", "p_device_id" "text", "p_device_fingerprint" "text", "p_public_key" "text", "p_registered_by" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_device public.kantin_devices%rowtype;
begin
  if p_kantin_user_id is null then
    raise exception 'kantin_user_id is required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_kantin_user_id and role = 'kantin' and coalesce(is_active, true)
  ) then
    raise exception 'Target user is not an active kantin profile';
  end if;

  if coalesce(length(trim(p_device_id)), 0) < 8 then
    raise exception 'device_id is too short';
  end if;

  if coalesce(length(trim(p_public_key)), 0) < 32 then
    raise exception 'public_key is invalid';
  end if;

  insert into public.kantin_devices (
    kantin_user_id,
    device_id,
    device_fingerprint,
    public_key,
    registered_by,
    metadata
  ) values (
    p_kantin_user_id,
    trim(p_device_id),
    trim(p_device_fingerprint),
    trim(p_public_key),
    p_registered_by,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (device_id) do update
  set device_fingerprint = excluded.device_fingerprint,
      public_key = excluded.public_key,
      status = case
        when public.kantin_devices.status in ('active', 'suspended', 'revoked') then public.kantin_devices.status
        else 'pending'
      end,
      registered_by = excluded.registered_by,
      registered_at = case
        when public.kantin_devices.status = 'active' then public.kantin_devices.registered_at
        else now()
      end,
      metadata = public.kantin_devices.metadata || excluded.metadata
  returning * into v_device;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_registered_by,
    'kantin',
    'wallet_register_kantin_device',
    'kantin_devices',
    v_device.id::text,
    jsonb_build_object('kantin_user_id', p_kantin_user_id, 'device_id', p_device_id, 'status', v_device.status)
  );

  return to_jsonb(v_device);
end;
$$;


ALTER FUNCTION "public"."wallet_register_kantin_device"("p_kantin_user_id" "uuid", "p_device_id" "text", "p_device_fingerprint" "text", "p_public_key" "text", "p_registered_by" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_reissue_card_qr"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_old uuid;
  v_new uuid := gen_random_uuid();
  v_role text := lower(coalesce(p_actor_role, ''));
begin
  if v_role not in ('super_admin','bendahara') then
    raise exception 'Only super_admin or bendahara can reissue wallet card QR';
  end if;

  select wallet_public_id into v_old
  from public.dompet_santri
  where santri_nis = p_santri_nis
  for update;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  update public.wallet_card_qr_versions
  set status = 'revoked', revoked_at = now(), revoked_by = p_actor_id, revoke_reason = p_reason
  where wallet_public_id = v_old and status = 'active';

  update public.dompet_santri
  set wallet_public_id = v_new
  where santri_nis = p_santri_nis;

  insert into public.wallet_card_qr_versions (wallet_public_id, santri_nis, status, issued_by, metadata)
  values (v_new, p_santri_nis, 'active', p_actor_id, jsonb_build_object('reason', p_reason, 'previous_wallet_public_id', v_old));

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (p_actor_id, v_role, 'wallet_reissue_card_qr', 'wallet_card_qr_versions', p_santri_nis, v_new::text, jsonb_build_object('old_wallet_public_id', v_old, 'reason', p_reason));

  return jsonb_build_object('status', 'ok', 'old_wallet_public_id', v_old, 'wallet_public_id', v_new);
end;
$$;


ALTER FUNCTION "public"."wallet_reissue_card_qr"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_reject_merchant_settlement"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text;
  v_request public.wallet_merchant_settlement_requests%rowtype;
  v_ledger jsonb;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id and coalesce(is_active, true);
  if v_actor_role not in ('super_admin', 'bendahara') then
    raise exception 'Hanya bendahara/super admin yang bisa menolak pencairan';
  end if;

  select * into v_request
  from public.wallet_merchant_settlement_requests
  where id = p_settlement_request_id
  for update;

  if not found then raise exception 'Pengajuan pencairan tidak ditemukan'; end if;
  if v_request.status not in ('requested', 'approved') then raise exception 'Status pencairan tidak valid'; end if;

  v_ledger := public.wallet_post_merchant_ledger(
    v_request.merchant_id,
    v_request.outlet_id,
    'credit',
    'settlement_rejected',
    v_request.amount,
    'merchant-settlement-rejected:' || v_request.id::text,
    p_actor_id,
    v_actor_role,
    null,
    null,
    v_request.id,
    'Pengajuan pencairan saldo kantin ditolak',
    jsonb_build_object('note_present', p_note is not null)
  );

  update public.wallet_merchant_settlement_requests
  set status = 'rejected',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = p_note,
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return to_jsonb(v_request) || jsonb_build_object('ledger', v_ledger);
end;
$$;


ALTER FUNCTION "public"."wallet_reject_merchant_settlement"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_request_merchant_settlement"("p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_amount" bigint, "p_destination_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_request public.wallet_merchant_settlement_requests%rowtype;
  v_ledger jsonb;
begin
  if v_actor is null then raise exception 'Sesi login tidak valid'; end if;

  if not exists (
    select 1
    from public.profiles p
    join public.wallet_merchant_users wmu on wmu.profile_id = p.id
    where p.id = v_actor
      and p.role = 'kantin'
      and coalesce(p.is_active, true)
      and wmu.merchant_id = p_merchant_id
      and (wmu.outlet_id is null or wmu.outlet_id is not distinct from p_outlet_id)
      and wmu.status = 'active'
      and wmu.merchant_role in ('owner','manager')
  ) then
    raise exception 'Akun kantin tidak berwenang mengajukan pencairan';
  end if;

  insert into public.wallet_merchant_settlement_requests (
    merchant_id, outlet_id, requested_by, amount, destination_note
  ) values (
    p_merchant_id, p_outlet_id, v_actor, p_amount, nullif(trim(coalesce(p_destination_note, '')), '')
  ) returning * into v_request;

  v_ledger := public.wallet_post_merchant_ledger(
    p_merchant_id,
    p_outlet_id,
    'debit',
    'settlement_request',
    p_amount,
    'merchant-settlement-request:' || v_request.id::text,
    v_actor,
    'kantin',
    null,
    null,
    v_request.id,
    'Pengajuan pencairan saldo kantin',
    jsonb_build_object('destination_note_present', p_destination_note is not null)
  );

  update public.wallet_merchant_settlement_requests
  set requested_ledger_id = (v_ledger->>'ledger_id')::bigint,
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return to_jsonb(v_request) || jsonb_build_object('ledger', v_ledger);
end;
$$;


ALTER FUNCTION "public"."wallet_request_merchant_settlement"("p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_amount" bigint, "p_destination_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_resolve_dispute"("p_dispute_id" "uuid", "p_resolved_by" "uuid", "p_status" "text", "p_resolution_note" "text", "p_reversal_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_dispute public.wallet_disputes%rowtype;
  v_ledger public.transaksi_dompet%rowtype;
  v_reversal jsonb;
  v_reversal_ledger_id bigint;
begin
  if p_status not in ('resolved_valid','resolved_reversed','rejected','cancelled') then
    raise exception 'Invalid dispute resolution status';
  end if;

  select * into v_dispute
  from public.wallet_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.status in ('resolved_valid','resolved_reversed','rejected','cancelled') then
    raise exception 'Dispute is already closed';
  end if;

  select * into v_ledger
  from public.transaksi_dompet
  where id = v_dispute.ledger_id;

  if p_status = 'resolved_reversed' then
    if p_reversal_idempotency_key is null or length(trim(p_reversal_idempotency_key)) < 12 then
      raise exception 'A strong reversal idempotency key is required';
    end if;

    if v_ledger.direction <> 'debit' then
      raise exception 'Only debit ledger can be reversed by dispute refund';
    end if;

    v_reversal := public.wallet_post_transaction(
      v_ledger.santri_nis,
      'credit'::public.wallet_direction,
      'refund'::public.tipe_kategori_transaksi,
      v_ledger.amount,
      p_resolved_by,
      'bendahara',
      p_reversal_idempotency_key,
      coalesce(p_resolution_note, 'Dispute reversal'),
      v_ledger.actor_id,
      v_ledger.actor_role,
      null,
      null,
      null,
      null,
      null,
      jsonb_build_object('dispute_id', p_dispute_id, 'reversed_ledger_id', v_ledger.id)
    );

    v_reversal_ledger_id := (v_reversal->>'ledger_id')::bigint;
  end if;

  update public.wallet_disputes
  set status = p_status,
      resolved_by = p_resolved_by,
      resolution_note = p_resolution_note,
      reversal_ledger_id = v_reversal_ledger_id,
      resolved_at = now()
  where id = p_dispute_id
  returning * into v_dispute;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_resolved_by,
    'bendahara',
    'wallet_resolve_dispute',
    'wallet_disputes',
    v_dispute.santri_nis,
    v_dispute.id::text,
    jsonb_build_object('status', p_status, 'reversal_ledger_id', v_reversal_ledger_id)
  );

  return to_jsonb(v_dispute);
end;
$$;


ALTER FUNCTION "public"."wallet_resolve_dispute"("p_dispute_id" "uuid", "p_resolved_by" "uuid", "p_status" "text", "p_resolution_note" "text", "p_reversal_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_resolve_integrity_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_resolution_status" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_run public.wallet_ledger_integrity_runs%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menyelesaikan hasil pemeriksaan ledger';
  end if;

  if p_resolution_status not in ('resolved','accepted_risk','false_alarm','monitoring') then
    raise exception 'Status penyelesaian pemeriksaan ledger tidak valid';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan penyelesaian minimal 12 karakter';
  end if;

  update public.wallet_ledger_integrity_runs
  set resolution_status = p_resolution_status,
      resolved_by = p_actor_id,
      resolved_at = case when p_resolution_status = 'monitoring' then null else now() end,
      resolution_note = p_note,
      reviewed_by = coalesce(reviewed_by, p_actor_id),
      reviewed_at = coalesce(reviewed_at, now()),
      review_note = coalesce(review_note, p_note),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'resolution_status', p_resolution_status,
        'resolution_note', p_note,
        'resolution_role', p_actor_role
      )
  where id = p_run_id
  returning * into v_run;

  if not found then
    raise exception 'Hasil pemeriksaan ledger tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_resolve_integrity_run',
    'wallet_ledger_integrity_runs',
    v_run.santri_nis,
    v_run.id::text,
    jsonb_build_object('status', v_run.status, 'resolution_status', p_resolution_status, 'broken_at', v_run.broken_at, 'note', p_note)
  );

  return to_jsonb(v_run);
end;
$$;


ALTER FUNCTION "public"."wallet_resolve_integrity_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_resolution_status" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_resolve_reconciliation_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_resolution_status" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_run public.wallet_reconciliation_runs%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menyelesaikan hasil rekonsiliasi';
  end if;

  if p_resolution_status not in ('resolved','accepted_risk','false_alarm','monitoring') then
    raise exception 'Status penyelesaian rekonsiliasi tidak valid';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan penyelesaian minimal 12 karakter';
  end if;

  update public.wallet_reconciliation_runs
  set resolution_status = p_resolution_status,
      resolved_by = p_actor_id,
      resolved_at = case when p_resolution_status = 'monitoring' then null else now() end,
      resolution_note = p_note,
      reviewed_by = coalesce(reviewed_by, p_actor_id),
      reviewed_at = coalesce(reviewed_at, now()),
      review_note = coalesce(review_note, p_note),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'resolution_status', p_resolution_status,
        'resolution_note', p_note,
        'resolution_role', p_actor_role
      )
  where id = p_run_id
  returning * into v_run;

  if not found then
    raise exception 'Hasil rekonsiliasi tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_resolve_reconciliation_run',
    'wallet_reconciliation_runs',
    v_run.id::text,
    jsonb_build_object('status', v_run.status, 'resolution_status', p_resolution_status, 'difference_internal', v_run.difference_internal, 'difference_bank', v_run.difference_bank, 'note', p_note)
  );

  return to_jsonb(v_run);
end;
$$;


ALTER FUNCTION "public"."wallet_resolve_reconciliation_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_resolution_status" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_resolve_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_status" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event public.wallet_risk_events%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menyelesaikan peringatan keamanan dompet';
  end if;

  if p_status not in ('resolved','false_positive') then
    raise exception 'Status penyelesaian peringatan tidak valid';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan penyelesaian minimal 12 karakter';
  end if;

  select * into v_event
  from public.wallet_risk_events
  where id = p_risk_event_id
  for update;

  if not found then
    raise exception 'Peringatan keamanan tidak ditemukan';
  end if;

  if v_event.status in ('resolved','false_positive') then
    raise exception 'Peringatan keamanan sudah selesai';
  end if;

  update public.wallet_risk_events
  set status = p_status,
      resolved_by = p_actor_id,
      resolved_at = now(),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'resolution_note', p_note,
        'resolution_role', p_actor_role
      )
  where id = p_risk_event_id
  returning * into v_event;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_resolve_risk_event',
    'wallet_risk_events',
    v_event.santri_nis,
    v_event.id::text,
    jsonb_build_object('severity', v_event.severity, 'rule_code', v_event.rule_code, 'status', p_status, 'note', p_note)
  );

  return to_jsonb(v_event);
end;
$$;


ALTER FUNCTION "public"."wallet_resolve_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_status" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_review_integrity_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_run public.wallet_ledger_integrity_runs%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menandai pemeriksaan ledger';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan pemeriksaan minimal 12 karakter';
  end if;

  update public.wallet_ledger_integrity_runs
  set reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = p_note,
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object('review_note', p_note, 'review_role', p_actor_role)
  where id = p_run_id
  returning * into v_run;

  if not found then
    raise exception 'Hasil pemeriksaan ledger tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_review_integrity_run',
    'wallet_ledger_integrity_runs',
    v_run.santri_nis,
    v_run.id::text,
    jsonb_build_object('status', v_run.status, 'broken_at', v_run.broken_at, 'note', p_note)
  );

  return to_jsonb(v_run);
end;
$$;


ALTER FUNCTION "public"."wallet_review_integrity_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_review_notification"("p_notification_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_review_status" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_status text := lower(coalesce(p_review_status, ''));
  v_row public.notification_queue%rowtype;
begin
  if v_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh meninjau notifikasi dompet';
  end if;

  if v_status not in ('reviewed','resolved','ignored_dummy') then
    raise exception 'Status review notifikasi tidak valid';
  end if;

  if nullif(trim(coalesce(p_note, '')), '') is null or length(trim(p_note)) < 12 then
    raise exception 'Catatan review wajib diisi minimal 12 karakter';
  end if;

  update public.notification_queue
  set wallet_review_status = v_status,
      wallet_reviewed_by = p_actor_id,
      wallet_reviewed_at = now(),
      wallet_review_note = trim(p_note)
  where id = p_notification_id
    and (
      coalesce(source_table, '') like 'wallet%'
      or coalesce(event_type, '') like 'wallet.%'
      or coalesce(event_type, '') like 'dompet.%'
    )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Notifikasi dompet tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    v_role,
    'wallet_review_notification',
    'notification_queue',
    p_notification_id::text,
    jsonb_build_object(
      'review_status', v_status,
      'notification_status', v_row.status,
      'priority', v_row.priority,
      'event_type', v_row.event_type,
      'note', trim(p_note)
    )
  );

  return to_jsonb(v_row);
end;
$$;


ALTER FUNCTION "public"."wallet_review_notification"("p_notification_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_review_status" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_review_reconciliation_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_run public.wallet_reconciliation_runs%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menandai rekonsiliasi';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan rekonsiliasi minimal 12 karakter';
  end if;

  update public.wallet_reconciliation_runs
  set reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = p_note,
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object('review_note', p_note, 'review_role', p_actor_role)
  where id = p_run_id
  returning * into v_run;

  if not found then
    raise exception 'Hasil rekonsiliasi tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_review_reconciliation_run',
    'wallet_reconciliation_runs',
    v_run.id::text,
    jsonb_build_object('status', v_run.status, 'difference_internal', v_run.difference_internal, 'difference_bank', v_run.difference_bank, 'note', p_note)
  );

  return to_jsonb(v_run);
end;
$$;


ALTER FUNCTION "public"."wallet_review_reconciliation_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_run_ledger_integrity_check"("p_santri_nis" "text" DEFAULT NULL::"text", "p_from_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_run_id uuid;
  v_wallet record;
  v_result record;
  v_checked bigint := 0;
  v_failed boolean := false;
  v_broken_at bigint;
begin
  insert into public.wallet_ledger_integrity_runs (santri_nis, checked_from)
  values (p_santri_nis, p_from_date)
  returning id into v_run_id;

  for v_wallet in
    select santri_nis
    from public.dompet_santri
    where (p_santri_nis is null or santri_nis = p_santri_nis)
  loop
    v_checked := v_checked + (
      select count(*)
      from public.transaksi_dompet td
      where td.santri_nis = v_wallet.santri_nis
        and (p_from_date is null or td.created_at >= p_from_date)
    );

    select * into v_result
    from public.verify_wallet_ledger_integrity(v_wallet.santri_nis, p_from_date)
    limit 1;

    if not coalesce(v_result.is_valid, true) then
      v_failed := true;
      v_broken_at := v_result.broken_at;

      insert into public.wallet_risk_events (
        severity, santri_nis, rule_code, score, action, details
      ) values (
        'critical',
        v_wallet.santri_nis,
        'LEDGER_HASH_CHAIN_BROKEN',
        100,
        'freeze_system',
        jsonb_build_object('run_id', v_run_id, 'broken_at', v_result.broken_at, 'details', v_result.details)
      );

      perform public.wallet_set_system_freeze(
        true,
        'wallet_ledger_integrity_failed',
        null,
        jsonb_build_object('run_id', v_run_id, 'santri_nis', v_wallet.santri_nis, 'broken_at', v_result.broken_at)
      );

      exit;
    end if;
  end loop;

  update public.wallet_ledger_integrity_runs
  set finished_at = now(),
      status = case when v_failed then 'failed' else 'success' end,
      checked_entries = v_checked,
      broken_at = v_broken_at,
      details = jsonb_build_object('scope', coalesce(p_santri_nis, 'all'))
  where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', case when v_failed then 'failed' else 'success' end,
    'checked_entries', v_checked,
    'broken_at', v_broken_at
  );
end;
$$;


ALTER FUNCTION "public"."wallet_run_ledger_integrity_check"("p_santri_nis" "text", "p_from_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_run_reconciliation"("p_reserved_bank_balance" bigint DEFAULT NULL::bigint, "p_triggered_by" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_run_id uuid;
  v_credit bigint;
  v_debit bigint;
  v_ledger_net bigint;
  v_cached bigint;
  v_internal_diff bigint;
  v_bank_diff bigint;
  v_status text;
  v_freeze boolean := false;
  v_merchant_available bigint;
  v_merchant_pending bigint;
  v_merchant_liability bigint;
  v_merchant_sales bigint;
  v_merchant_settled bigint;
  v_merchant_pending_request bigint;
  v_wallet_midtrans_topup bigint;
  v_spp_paid bigint;
  v_spp_outstanding bigint;
  v_expected_liability bigint;
  v_liability_bank_diff bigint;
begin
  insert into public.wallet_reconciliation_runs (triggered_by)
  values (p_triggered_by)
  returning id into v_run_id;

  select
    coalesce(sum(amount) filter (where direction = 'credit' and status = 'posted'), 0),
    coalesce(sum(amount) filter (where direction = 'debit' and status = 'posted'), 0)
  into v_credit, v_debit
  from public.transaksi_dompet;

  v_ledger_net := v_credit - v_debit;

  select coalesce(sum(saldo), 0)
  into v_cached
  from public.dompet_santri
  where status in ('active', 'locked');

  select
    coalesce(sum(saldo_available), 0),
    coalesce(sum(saldo_pending_settlement), 0),
    coalesce(sum(total_sales), 0),
    coalesce(sum(total_settled), 0)
  into v_merchant_available, v_merchant_pending, v_merchant_sales, v_merchant_settled
  from public.wallet_merchant_balances;

  v_merchant_liability := v_merchant_available + v_merchant_pending;

  select coalesce(sum(amount), 0)
  into v_merchant_pending_request
  from public.wallet_merchant_settlement_requests
  where status in ('requested', 'approved');

  select coalesce(sum(amount), 0)
  into v_wallet_midtrans_topup
  from public.wallet_payment_intents
  where type = 'midtrans_topup' and status = 'posted';

  select coalesce(sum(jumlah), 0)
  into v_spp_paid
  from public.transaksi_keuangan
  where coalesce(status_transaksi, '') in ('settlement', 'capture', 'success')
    and coalesce(status::text, '') in ('success', 'settlement', 'capture', 'pending');

  select coalesce(sum(sisa_tagihan), 0)
  into v_spp_outstanding
  from public.tagihan_santri;

  v_expected_liability := v_cached + v_merchant_liability;
  v_internal_diff := v_ledger_net - v_cached;
  v_bank_diff := case when p_reserved_bank_balance is null then null else v_ledger_net - p_reserved_bank_balance end;
  v_liability_bank_diff := case when p_reserved_bank_balance is null then null else v_expected_liability - p_reserved_bank_balance end;

  if v_internal_diff <> 0 then
    v_status := 'failed';
    v_freeze := true;
    perform public.wallet_set_system_freeze(
      true,
      'wallet_reconciliation_internal_mismatch',
      p_triggered_by,
      jsonb_build_object('run_id', v_run_id, 'difference_internal', v_internal_diff)
    );
  elsif v_liability_bank_diff is not null and v_liability_bank_diff <> 0 then
    v_status := 'settlement_mismatch';
  elsif v_bank_diff is not null and v_bank_diff <> 0 then
    v_status := 'settlement_mismatch';
  else
    v_status := 'success';
  end if;

  update public.wallet_reconciliation_runs
  set finished_at = now(),
      status = v_status,
      ledger_net = v_ledger_net,
      cached_balance_total = v_cached,
      reserved_bank_balance = p_reserved_bank_balance,
      difference_internal = v_internal_diff,
      difference_bank = v_bank_diff,
      freeze_triggered = v_freeze,
      santri_balance_total = v_cached,
      merchant_available_total = v_merchant_available,
      merchant_pending_settlement_total = v_merchant_pending,
      merchant_liability_total = v_merchant_liability,
      merchant_sales_total = v_merchant_sales,
      merchant_settled_total = v_merchant_settled,
      merchant_pending_request_total = v_merchant_pending_request,
      wallet_topup_midtrans_total = v_wallet_midtrans_topup,
      spp_paid_total = v_spp_paid,
      spp_outstanding_total = v_spp_outstanding,
      expected_internal_liability = v_expected_liability,
      difference_liability_vs_bank = v_liability_bank_diff,
      details = jsonb_build_object(
        'wallet_ledger_credit', v_credit,
        'wallet_ledger_debit', v_debit,
        'cached_balance_statuses', jsonb_build_array('active', 'locked'),
        'merchant_available_total', v_merchant_available,
        'merchant_pending_settlement_total', v_merchant_pending,
        'merchant_liability_total', v_merchant_liability,
        'merchant_sales_total', v_merchant_sales,
        'merchant_settled_total', v_merchant_settled,
        'merchant_pending_request_total', v_merchant_pending_request,
        'wallet_topup_midtrans_total', v_wallet_midtrans_topup,
        'spp_paid_total', v_spp_paid,
        'spp_outstanding_total', v_spp_outstanding,
        'expected_internal_liability', v_expected_liability,
        'difference_liability_vs_bank', v_liability_bank_diff
      )
  where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', v_status,
    'ledger_net', v_ledger_net,
    'santri_balance_total', v_cached,
    'merchant_available_total', v_merchant_available,
    'merchant_pending_settlement_total', v_merchant_pending,
    'merchant_liability_total', v_merchant_liability,
    'merchant_pending_request_total', v_merchant_pending_request,
    'wallet_topup_midtrans_total', v_wallet_midtrans_topup,
    'spp_paid_total', v_spp_paid,
    'spp_outstanding_total', v_spp_outstanding,
    'expected_internal_liability', v_expected_liability,
    'reserved_bank_balance', p_reserved_bank_balance,
    'difference_internal', v_internal_diff,
    'difference_bank', v_bank_diff,
    'difference_liability_vs_bank', v_liability_bank_diff,
    'freeze_triggered', v_freeze
  );
end;
$$;


ALTER FUNCTION "public"."wallet_run_reconciliation"("p_reserved_bank_balance" bigint, "p_triggered_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_run_security_audit"("p_triggered_by" "uuid", "p_triggered_by_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_role text := lower(coalesce(p_triggered_by_role, ''));
  v_run_id uuid;
  v_checks jsonb := '[]'::jsonb;
  v_findings jsonb := '[]'::jsonb;
  v_recommendations jsonb := '[]'::jsonb;
  v_layers jsonb := '{}'::jsonb;
  v_score integer := 100;
  v_status text := 'success';
  v_severity text := 'aman';
  v_count integer := 0;
  v_control public.wallet_system_controls%rowtype;
  v_latest_reconciliation public.wallet_reconciliation_runs%rowtype;
  v_latest_integrity public.wallet_ledger_integrity_runs%rowtype;
  v_parent_threshold integer := 0;
  v_rls_disabled_count integer := 0;
  v_anon_grant_count integer := 0;
  v_missing_cron_count integer := 0;
  v_kantin_without_device_count integer := 0;
  v_active_device_inactive_account_count integer := 0;
  v_active_merchant_without_user_count integer := 0;
  v_negative_merchant_balance_count integer := 0;
  v_merchant_balance_mismatch_count integer := 0;
  v_stale_settlement_count integer := 0;
  v_pending_settlement_mismatch_count integer := 0;
  v_summary text;
begin
  if v_role not in ('super_admin','bendahara','rois','dewan') then
    raise exception 'Role tidak boleh menjalankan audit keamanan dompet';
  end if;

  insert into public.wallet_security_audit_runs (triggered_by, triggered_by_role)
  values (p_triggered_by, v_role)
  returning id into v_run_id;

  select * into v_control
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  v_parent_threshold := coalesce((v_control.metadata->>'parent_approval_required_above')::int, 0);

  if coalesce(v_control.is_frozen, false) then
    v_score := v_score - 25;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Freeze switch global','status','critical','label','Sistem dompet sedang dibekukan','details',jsonb_build_object('reason', v_control.freeze_reason, 'frozen_at', v_control.frozen_at)));
    v_findings := v_findings || jsonb_build_array('Sistem transaksi dompet sedang freeze. Transaksi baru harus ditahan sampai alasan freeze selesai.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Freeze switch global','status','ok','label','Sistem dompet tidak sedang dibekukan'));
  end if;

  if v_parent_threshold = 75000 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Batas persetujuan wali','status','ok','label','Persetujuan wali wajib untuk transaksi di atas Rp75.000','details',jsonb_build_object('threshold', v_parent_threshold)));
  else
    v_score := v_score - 15;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Batas persetujuan wali','status','warning','label','Batas persetujuan wali belum sesuai Rp75.000','details',jsonb_build_object('current_threshold', v_parent_threshold)));
    v_recommendations := v_recommendations || jsonb_build_array('Set parent_approval_required_above menjadi 75000 dan pastikan Android meminta persetujuan wali hanya untuk nominal di atas batas ini.');
  end if;

  select * into v_latest_reconciliation from public.wallet_reconciliation_runs order by started_at desc limit 1;
  if v_latest_reconciliation.id is null then
    v_score := v_score - 20;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Rekonsiliasi otomatis','status','critical','label','Belum ada hasil rekonsiliasi'));
    v_findings := v_findings || jsonb_build_array('Rekonsiliasi belum pernah berjalan. Sistem belum punya safety net saldo vs ledger.');
  elsif v_latest_reconciliation.status <> 'success' or coalesce(v_latest_reconciliation.difference_internal, 0) <> 0 then
    v_score := v_score - 25;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Rekonsiliasi otomatis','status','critical','label','Rekonsiliasi terakhir bermasalah','details',jsonb_build_object('run_id', v_latest_reconciliation.id, 'status', v_latest_reconciliation.status, 'difference_internal', v_latest_reconciliation.difference_internal, 'started_at', v_latest_reconciliation.started_at)));
    v_findings := v_findings || jsonb_build_array('Saldo cepat dan ledger tidak cocok pada rekonsiliasi terakhir.');
  elsif v_latest_reconciliation.started_at < now() - interval '2 hours' then
    v_score := v_score - 10;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Rekonsiliasi otomatis','status','warning','label','Rekonsiliasi terakhir sudah lebih dari 2 jam','details',jsonb_build_object('started_at', v_latest_reconciliation.started_at)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Rekonsiliasi otomatis','status','ok','label','Rekonsiliasi terakhir cocok dan masih baru','details',jsonb_build_object('started_at', v_latest_reconciliation.started_at)));
  end if;

  select * into v_latest_integrity from public.wallet_ledger_integrity_runs order by started_at desc limit 1;
  if v_latest_integrity.id is null then
    v_score := v_score - 20;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Hash-chain ledger','status','critical','label','Belum ada pemeriksaan hash-chain'));
    v_findings := v_findings || jsonb_build_array('Hash-chain ledger belum pernah diverifikasi.');
  elsif v_latest_integrity.status <> 'success' then
    v_score := v_score - 30;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Hash-chain ledger','status','critical','label','Hash-chain ledger terakhir gagal','details',jsonb_build_object('run_id', v_latest_integrity.id, 'broken_at', v_latest_integrity.broken_at)));
    v_findings := v_findings || jsonb_build_array('Ledger dompet menunjukkan indikasi rusak/tidak konsisten.');
  elsif v_latest_integrity.started_at < now() - interval '26 hours' then
    v_score := v_score - 8;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Hash-chain ledger','status','warning','label','Pemeriksaan hash-chain sudah lebih dari 26 jam','details',jsonb_build_object('started_at', v_latest_integrity.started_at)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Hash-chain ledger','status','ok','label','Hash-chain ledger terakhir valid','details',jsonb_build_object('checked_entries', v_latest_integrity.checked_entries)));
  end if;

  select count(*) into v_count from public.wallet_risk_events where status in ('open','acknowledged','investigating','escalated') and severity in ('high','critical');
  if v_count > 0 then
    v_score := v_score - least(30, v_count * 10);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Peringatan keamanan aktif','status',case when v_count >= 3 then 'critical' else 'warning' end,'label','Ada peringatan keamanan tinggi/kritis yang belum selesai','details',jsonb_build_object('count', v_count)));
    v_findings := v_findings || jsonb_build_array('Masih ada risk event tinggi/kritis yang belum selesai.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Peringatan keamanan aktif','status','ok','label','Tidak ada peringatan tinggi/kritis terbuka'));
  end if;

  select count(*) into v_count from public.wallet_disputes where status in ('open','investigating') and response_due_at is not null and response_due_at < now();
  if v_count > 0 then
    v_score := v_score - least(20, v_count * 8);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','SLA laporan wali','status','warning','label','Ada laporan wali melewati SLA','details',jsonb_build_object('count', v_count)));
    v_recommendations := v_recommendations || jsonb_build_array('Selesaikan dispute yang melewati SLA dan eskalasi ke super admin bila belum ada tindak lanjut.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','SLA laporan wali','status','ok','label','Tidak ada laporan wali lewat SLA'));
  end if;

  select count(*) into v_count from public.notification_queue where priority = 'critical' and coalesce(status, 'pending') <> 'sent' and coalesce(wallet_review_status, '') not in ('reviewed','resolved','ignored_dummy') and created_at >= now() - interval '7 days';
  if v_count > 0 then
    v_score := v_score - least(20, v_count * 5);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Notifikasi kritis','status','critical','label','Ada notifikasi kritis yang belum terkirim/selesai','details',jsonb_build_object('count', v_count)));
    v_findings := v_findings || jsonb_build_array('Notifikasi kritis belum berhasil dikirim atau belum selesai diproses.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Notifikasi kritis','status','ok','label','Tidak ada notifikasi kritis tertahan'));
  end if;

  select count(*) into v_count from public.kantin_devices where status in ('pending','suspended','revoked');
  if v_count > 0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Device kantin','status','warning','label','Ada device kantin tidak aktif yang perlu diawasi','details',jsonb_build_object('count', v_count)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Device kantin','status','ok','label','Semua device kantin terdaftar dalam status aktif'));
  end if;

  select count(*) into v_kantin_without_device_count
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'kantin'
    and coalesce(p.is_active, false)
    and not exists (
      select 1 from public.kantin_devices kd
      where kd.kantin_user_id = p.id and kd.status = 'active'
    );

  select count(*) into v_active_device_inactive_account_count
  from public.kantin_devices kd
  left join public.profiles p on p.id = kd.kantin_user_id
  where kd.status = 'active'
    and (p.id is null or not coalesce(p.is_active, false) or lower(coalesce(p.role, '')) <> 'kantin');

  select count(*) into v_active_merchant_without_user_count
  from public.wallet_merchants wm
  where wm.status = 'active'
    and not exists (
      select 1
      from public.wallet_merchant_users wmu
      join public.profiles p on p.id = wmu.profile_id
      where wmu.merchant_id = wm.id
        and wmu.status = 'active'
        and coalesce(p.is_active, false)
        and lower(coalesce(p.role, '')) = 'kantin'
    );

  if v_kantin_without_device_count > 0 or v_active_device_inactive_account_count > 0 or v_active_merchant_without_user_count > 0 then
    v_score := v_score - least(25, (v_kantin_without_device_count + v_active_device_inactive_account_count + v_active_merchant_without_user_count) * 8);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'layer','API',
      'name','Kesiapan akses kantin',
      'status', case when v_active_device_inactive_account_count > 0 then 'critical' else 'warning' end,
      'label','Ada konfigurasi akun/device/merchant kantin yang belum aman',
      'details',jsonb_build_object(
        'akun_kantin_aktif_tanpa_device_aktif', v_kantin_without_device_count,
        'device_aktif_milik_akun_tidak_valid', v_active_device_inactive_account_count,
        'merchant_aktif_tanpa_user_kantin_aktif', v_active_merchant_without_user_count
      )
    ));
    if v_active_device_inactive_account_count > 0 then
      v_findings := v_findings || jsonb_build_array('Ada device kantin aktif yang terhubung ke akun tidak aktif/tidak valid. Revoke device tersebut sebelum operasional kantin dilanjutkan.');
    end if;
    v_recommendations := v_recommendations || jsonb_build_array('Buka Manajemen Kantin, pastikan setiap merchant aktif punya akun kantin aktif dan setiap transaksi hanya dari device aktif yang dipercaya.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','API','name','Kesiapan akses kantin','status','ok','label','Akun, device, dan merchant kantin aktif sudah konsisten'));
  end if;

  select count(*) into v_negative_merchant_balance_count
  from public.wallet_merchant_balances
  where saldo_available < 0 or saldo_pending_settlement < 0 or total_sales < 0 or total_settled < 0;

  with latest_ledger as (
    select distinct on (merchant_id, outlet_id)
      merchant_id, outlet_id, balance_available_after, pending_settlement_after
    from public.wallet_merchant_ledger
    order by merchant_id, outlet_id, id desc
  )
  select count(*) into v_merchant_balance_mismatch_count
  from public.wallet_merchant_balances b
  join latest_ledger l
    on l.merchant_id = b.merchant_id
   and l.outlet_id is not distinct from b.outlet_id
  where coalesce(l.balance_available_after, 0) <> coalesce(b.saldo_available, 0)
     or coalesce(l.pending_settlement_after, 0) <> coalesce(b.saldo_pending_settlement, 0);

  select count(*) into v_stale_settlement_count
  from public.wallet_merchant_settlement_requests
  where status in ('requested','approved')
    and created_at < now() - interval '2 days';

  with pending_requests as (
    select merchant_id, outlet_id, sum(amount)::bigint as pending_amount
    from public.wallet_merchant_settlement_requests
    where status in ('requested','approved')
    group by merchant_id, outlet_id
  )
  select count(*) into v_pending_settlement_mismatch_count
  from pending_requests pr
  left join public.wallet_merchant_balances b
    on b.merchant_id = pr.merchant_id
   and b.outlet_id is not distinct from pr.outlet_id
  where coalesce(pr.pending_amount, 0) > coalesce(b.saldo_pending_settlement, 0);

  if v_negative_merchant_balance_count > 0 or v_merchant_balance_mismatch_count > 0 or v_pending_settlement_mismatch_count > 0 then
    v_score := v_score - least(35, (v_negative_merchant_balance_count + v_merchant_balance_mismatch_count + v_pending_settlement_mismatch_count) * 12);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'layer','Database',
      'name','Saldo dan ledger merchant kantin',
      'status','critical',
      'label','Ada ketidaksesuaian saldo merchant kantin',
      'details',jsonb_build_object(
        'saldo_negatif', v_negative_merchant_balance_count,
        'cached_balance_tidak_cocok_dengan_ledger_terakhir', v_merchant_balance_mismatch_count,
        'pending_request_melebihi_saldo_pending', v_pending_settlement_mismatch_count
      )
    ));
    v_findings := v_findings || jsonb_build_array('Saldo/ledger merchant kantin tidak konsisten. Freeze operasional kantin besar dan lakukan rekonsiliasi sebelum pencairan baru.');
    v_recommendations := v_recommendations || jsonb_build_array('Tahan pencairan merchant, jalankan rekonsiliasi, cocokkan ledger merchant terakhir dengan saldo cached, lalu koreksi hanya lewat ledger resmi.');
  elsif v_stale_settlement_count > 0 then
    v_score := v_score - least(15, v_stale_settlement_count * 5);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'layer','Database',
      'name','Saldo dan ledger merchant kantin',
      'status','warning',
      'label','Ada pengajuan pencairan kantin yang tertahan lebih dari 2 hari',
      'details',jsonb_build_object('pencairan_tertahan', v_stale_settlement_count)
    ));
    v_recommendations := v_recommendations || jsonb_build_array('Review pengajuan pencairan kantin yang tertahan agar tidak menjadi sengketa operasional.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','Saldo dan ledger merchant kantin','status','ok','label','Saldo merchant, pending settlement, dan ledger terakhir konsisten'));
  end if;

  select count(*) into v_count from public.wallet_pin_attempts where attempt_status = 'failed' and created_at >= now() - interval '1 hour';
  if v_count >= 10 then
    v_score := v_score - 20;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Percobaan PIN gagal','status','critical','label','Percobaan PIN gagal sangat tinggi dalam 1 jam terakhir','details',jsonb_build_object('failed_attempts_1h', v_count)));
    v_findings := v_findings || jsonb_build_array('Ada indikasi brute-force PIN.');
  elsif v_count >= 3 then
    v_score := v_score - 8;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Percobaan PIN gagal','status','warning','label','Ada percobaan PIN gagal berulang','details',jsonb_build_object('failed_attempts_1h', v_count)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Percobaan PIN gagal','status','ok','label','Percobaan PIN gagal dalam batas wajar'));
  end if;

  select count(*) into v_rls_disabled_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in ('dompet_santri','crypto_keystores','wallet_devices','wallet_payment_intents','wallet_authorization_sessions','transaksi_dompet','wallet_nonces','wallet_nonce_uses','wallet_card_qr_versions','wallet_key_rotation_logs','wallet_audit_logs','wallet_merchants','wallet_merchant_outlets','wallet_merchant_users','wallet_merchant_balances','wallet_merchant_ledger','wallet_merchant_settlement_requests','wallet_card_tokens','wallet_system_controls','wallet_reconciliation_runs','wallet_risk_events','kantin_devices','wallet_disputes','wallet_ledger_integrity_runs','wallet_pin_attempts','wallet_weekly_digest_runs','wallet_security_audit_runs')
    and not c.relrowsecurity;

  select count(*) into v_anon_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon'
    and table_name in ('dompet_santri','crypto_keystores','wallet_devices','wallet_payment_intents','wallet_authorization_sessions','transaksi_dompet','wallet_nonces','wallet_nonce_uses','wallet_card_qr_versions','wallet_key_rotation_logs','wallet_audit_logs','wallet_merchants','wallet_merchant_outlets','wallet_merchant_users','wallet_merchant_balances','wallet_merchant_ledger','wallet_merchant_settlement_requests','wallet_card_tokens','wallet_system_controls','wallet_reconciliation_runs','wallet_risk_events','kantin_devices','wallet_disputes','wallet_ledger_integrity_runs','wallet_pin_attempts','wallet_weekly_digest_runs','wallet_security_audit_runs');

  if v_rls_disabled_count > 0 or v_anon_grant_count > 0 then
    v_score := v_score - 35;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','RLS dan akses publik','status','critical','label','Ada tabel dompet tanpa RLS atau grant anon','details',jsonb_build_object('rls_disabled', v_rls_disabled_count, 'anon_grants', v_anon_grant_count)));
    v_findings := v_findings || jsonb_build_array('RLS/grant publik pada tabel dompet perlu diperiksa segera.');
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Database','name','RLS dan akses publik','status','ok','label','Tabel dompet/kantin memakai RLS dan tidak ada grant anon terdeteksi'));
  end if;

  if coalesce(v_control.metadata->>'qr_payload_policy', '') = 'opaque_public_id_only' then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Payload QR kartu','status','ok','label','QR hanya boleh berisi public id acak, bukan NIS/nama/saldo/PIN'));
  else
    v_score := v_score - 15;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Payload QR kartu','status','warning','label','Kebijakan payload QR belum dikunci sebagai opaque public id'));
  end if;

  if coalesce((v_control.metadata->>'argon2id_required_for_pin_verifier')::boolean, false) then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Argon2id untuk PIN','status','ok','label','PIN/verifier wajib memakai Argon2id dengan parameter adaptif Android','details',jsonb_build_object('target_ms', v_control.metadata->>'argon2id_target_ms_android', 'memory_low_mb', v_control.metadata->>'argon2id_memory_mb_android_low', 'memory_normal_mb', v_control.metadata->>'argon2id_memory_mb_android_normal')));
  else
    v_score := v_score - 15;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','Data','name','Argon2id untuk PIN','status','warning','label','Argon2id belum diwajibkan untuk verifier PIN'));
  end if;

  select count(*) into v_missing_cron_count
  from (values ('wallet-reconciliation-hourly'),('wallet-ledger-integrity-daily'),('wallet-push-notifications-every-minute'),('wallet-dispute-sla-hourly'),('wallet-weekly-digest-sunday')) expected(jobname)
  where not exists (select 1 from cron.job j where j.jobname = expected.jobname);

  if v_missing_cron_count > 0 then
    v_score := v_score - least(20, v_missing_cron_count * 5);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Jadwal otomatis','status','warning','label','Ada jadwal otomatis dompet yang belum aktif','details',jsonb_build_object('missing_count', v_missing_cron_count)));
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('layer','App','name','Jadwal otomatis','status','ok','label','Jadwal otomatis utama terdaftar'));
  end if;

  v_score := greatest(0, least(100, v_score));
  if v_score < 55 then
    v_status := 'critical'; v_severity := 'kritis';
  elsif v_score < 75 then
    v_status := 'warning'; v_severity := 'berisiko';
  elsif v_score < 90 then
    v_status := 'warning'; v_severity := 'perlu_perhatian';
  else
    v_status := 'success'; v_severity := 'aman';
  end if;

  v_layers := jsonb_build_object(
    'Network', jsonb_build_object('status', 'manual_review', 'label', 'Cloud Armor, DDoS, dan WAF diverifikasi di provider hosting'),
    'App', jsonb_build_object('status', case when v_score >= 75 then 'ok' else 'review' end, 'label', 'Rate limit, idempotency, notifikasi, jadwal otomatis, dan limit wali'),
    'API', jsonb_build_object('status', case when v_score >= 75 then 'ok' else 'review' end, 'label', 'Role, device kantin, assignment merchant, signature request, dan risk event'),
    'Database', jsonb_build_object('status', case when v_rls_disabled_count = 0 and v_anon_grant_count = 0 then 'ok' else 'critical' end, 'label', 'RLS, rekonsiliasi, saldo merchant, settlement, freeze switch, dan audit log'),
    'Data', jsonb_build_object('status', case when v_latest_integrity.status = 'success' then 'ok' else 'review' end, 'label', 'AES-256/pgcrypto, hash-chain, Argon2id, QR opaque, dan ledger merchant')
  );

  if jsonb_array_length(v_findings) = 0 then
    v_findings := jsonb_build_array('Tidak ada temuan kritis dari pemeriksaan otomatis. Tetap lakukan review manual untuk lapisan network/WAF/provider.');
  end if;

  if jsonb_array_length(v_recommendations) = 0 then
    v_recommendations := jsonb_build_array('Pertahankan jadwal rekonsiliasi, verifikasi hash-chain, review device/merchant kantin, pencairan, dan audit notifikasi kritis secara rutin.');
  end if;

  v_summary := 'Skor audit keamanan dompet ' || v_score || '/100. Status: ' || v_severity || '. Pemeriksaan mencakup rekonsiliasi, hash-chain, risk event, dispute, notifikasi kritis, device kantin, assignment merchant, saldo dan ledger merchant, settlement, PIN, RLS, QR opaque, Argon2id, dan jadwal otomatis. Lapisan network/WAF tetap harus diverifikasi manual di provider hosting.';

  update public.wallet_security_audit_runs
  set finished_at = now(), status = v_status, score = v_score, severity = v_severity,
      layer_summary = v_layers, checks = v_checks, findings = v_findings,
      recommendations = v_recommendations, ai_summary = v_summary,
      metadata = jsonb_build_object(
        'audit_engine', 'deterministic_ai_ready_v2_kantin_merchant',
        'parent_approval_required_above', 75000,
        'contains_sensitive_payload', false,
        'kantin_checks', jsonb_build_object(
          'akun_kantin_aktif_tanpa_device_aktif', v_kantin_without_device_count,
          'device_aktif_milik_akun_tidak_valid', v_active_device_inactive_account_count,
          'merchant_aktif_tanpa_user_kantin_aktif', v_active_merchant_without_user_count,
          'saldo_merchant_negatif', v_negative_merchant_balance_count,
          'saldo_merchant_mismatch_ledger', v_merchant_balance_mismatch_count,
          'pencairan_tertahan', v_stale_settlement_count,
          'pending_settlement_mismatch', v_pending_settlement_mismatch_count
        )
      )
  where id = v_run_id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (p_triggered_by, v_role, 'wallet_run_security_audit', 'wallet_security_audit_runs', v_run_id::text, jsonb_build_object('score', v_score, 'severity', v_severity, 'engine', 'deterministic_ai_ready_v2_kantin_merchant'));

  return (select to_jsonb(r) from public.wallet_security_audit_runs r where r.id = v_run_id);
exception
  when others then
    if v_run_id is not null then
      update public.wallet_security_audit_runs
      set finished_at = now(), status = 'failed', severity = 'kritis', score = 0,
          findings = jsonb_build_array(sqlerrm),
          recommendations = jsonb_build_array('Periksa error audit keamanan dan jalankan ulang setelah penyebabnya diperbaiki.'),
          ai_summary = 'Audit keamanan gagal dijalankan: ' || sqlerrm
      where id = v_run_id;
    end if;
    raise;
end;
$$;


ALTER FUNCTION "public"."wallet_run_security_audit"("p_triggered_by" "uuid", "p_triggered_by_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_run_weekly_digest"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_week_start date := (date_trunc('week', now() at time zone 'Asia/Jakarta') - interval '7 days')::date;
  v_week_end date := (date_trunc('week', now() at time zone 'Asia/Jakarta') - interval '1 day')::date;
  v_run_id uuid;
  v_count bigint := 0;
  v_wallet record;
  v_tx_count bigint;
  v_total_spend bigint;
  v_top text;
begin
  insert into public.wallet_weekly_digest_runs (week_start, week_end)
  values (v_week_start, v_week_end)
  returning id into v_run_id;

  for v_wallet in
    select d.santri_nis, d.saldo, s.nama, s.wali_id
    from public.dompet_santri d
    join public.santri s on s.nis = d.santri_nis
    where s.wali_id is not null and d.status in ('active','locked')
  loop
    select count(*), coalesce(sum(amount), 0)
    into v_tx_count, v_total_spend
    from public.transaksi_dompet
    where santri_nis = v_wallet.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= v_week_start::timestamptz
      and created_at < (v_week_end + 1)::timestamptz;

    select coalesce(p.full_name, td.counterparty_role, 'Kantin')
    into v_top
    from public.transaksi_dompet td
    left join public.profiles p on p.id = td.actor_id
    where td.santri_nis = v_wallet.santri_nis
      and td.direction = 'debit'
      and td.status = 'posted'
      and td.created_at >= v_week_start::timestamptz
      and td.created_at < (v_week_end + 1)::timestamptz
    group by coalesce(p.full_name, td.counterparty_role, 'Kantin')
    order by sum(td.amount) desc
    limit 1;

    perform public.wallet_enqueue_notification(
      v_wallet.wali_id,
      'Rangkuman mingguan dompet',
      'Rangkuman mingguan ' || coalesce(v_wallet.nama, v_wallet.santri_nis) || ': transaksi minggu ini ' ||
      v_tx_count || 'x, total Rp ' || to_char(v_total_spend, 'FM999G999G999') ||
      ', saldo sekarang Rp ' || to_char(v_wallet.saldo, 'FM999G999G999') ||
      ', top pengeluaran: ' || coalesce(v_top, '-') || '.',
      'wallet.weekly_digest',
      'wallet_weekly_digest_runs',
      jsonb_build_object('run_id', v_run_id, 'santri_nis', v_wallet.santri_nis, 'tx_count', v_tx_count, 'total_spend', v_total_spend, 'balance', v_wallet.saldo, 'top_spend', v_top),
      'low',
      v_run_id::text
    );

    v_count := v_count + 1;
  end loop;

  update public.wallet_weekly_digest_runs
  set status = 'success',
      generated_count = v_count,
      finished_at = now()
  where id = v_run_id;

  return jsonb_build_object('run_id', v_run_id, 'generated_count', v_count);
end;
$$;


ALTER FUNCTION "public"."wallet_run_weekly_digest"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_set_kantin_account_status"("p_kantin_user_id" "uuid", "p_is_active" boolean, "p_actor_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_kantin_user_id is null then
    raise exception 'kantin_user_id is required';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_kantin_user_id
  for update;

  if not found then
    raise exception 'Kantin account not found';
  end if;

  if v_profile.role <> 'kantin' then
    raise exception 'Target account is not role kantin';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_kantin_user_id
  returning * into v_profile;

  if not p_is_active then
    update public.kantin_devices
    set status = 'revoked',
        revoked_by = p_actor_id,
        revoked_at = now(),
        revoke_reason = coalesce(p_reason, 'Kantin account disabled')
    where kantin_user_id = p_kantin_user_id
      and status <> 'revoked';

    update public.wallet_merchant_users
    set status = 'revoked'
    where profile_id = p_kantin_user_id
      and status <> 'revoked';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    'admin',
    case when p_is_active then 'wallet_enable_kantin_account' else 'wallet_disable_kantin_account' end,
    'profiles',
    p_kantin_user_id::text,
    jsonb_build_object('reason', p_reason, 'is_active', p_is_active)
  );

  return jsonb_build_object(
    'id', v_profile.id,
    'role', v_profile.role,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'is_active', v_profile.is_active
  );
end;
$$;


ALTER FUNCTION "public"."wallet_set_kantin_account_status"("p_kantin_user_id" "uuid", "p_is_active" boolean, "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_set_kantin_device_status"("p_device_id" "text", "p_status" "text", "p_actor_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_device public.kantin_devices%rowtype;
begin
  if p_status not in ('active','suspended','revoked') then
    raise exception 'Invalid kantin device status';
  end if;

  update public.kantin_devices
  set status = p_status,
      approved_by = case when p_status = 'active' then p_actor_id else approved_by end,
      approved_at = case when p_status = 'active' then now() else approved_at end,
      revoked_by = case when p_status = 'revoked' then p_actor_id else revoked_by end,
      revoked_at = case when p_status = 'revoked' then now() else revoked_at end,
      revoke_reason = case when p_status = 'revoked' then p_reason else revoke_reason end
  where device_id = p_device_id
  returning * into v_device;

  if not found then
    raise exception 'Kantin device not found';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    'admin',
    'wallet_set_kantin_device_status',
    'kantin_devices',
    v_device.id::text,
    jsonb_build_object('device_id', p_device_id, 'status', p_status, 'reason', p_reason)
  );

  return to_jsonb(v_device);
end;
$$;


ALTER FUNCTION "public"."wallet_set_kantin_device_status"("p_device_id" "text", "p_status" "text", "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_set_merchant_status"("p_merchant_id" "uuid", "p_status" "text", "p_actor_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_role text;
  v_merchant public.wallet_merchants%rowtype;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id and coalesce(is_active, true);
  if v_actor_role not in ('super_admin', 'bendahara', 'rois') then
    raise exception 'Role tidak boleh mengubah status merchant';
  end if;

  if p_status not in ('active', 'suspended', 'quarantined', 'closed') then
    raise exception 'Status merchant tidak valid';
  end if;

  update public.wallet_merchants
  set status = p_status,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_status_reason', nullif(trim(coalesce(p_reason, '')), ''),
        'last_status_changed_by', p_actor_id,
        'last_status_changed_at', now()
      ),
      updated_at = now()
  where id = p_merchant_id
  returning * into v_merchant;

  if not found then raise exception 'Merchant tidak ditemukan'; end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    v_actor_role,
    'wallet_set_merchant_status',
    'wallet_merchants',
    v_merchant.id::text,
    jsonb_build_object('status', p_status, 'reason_present', p_reason is not null)
  );

  return to_jsonb(v_merchant);
end;
$$;


ALTER FUNCTION "public"."wallet_set_merchant_status"("p_merchant_id" "uuid", "p_status" "text", "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_set_student_pin_verifier"("p_santri_nis" "text", "p_actor_id" "uuid", "p_student_pin_salt" "text", "p_student_pin_verifier" "text", "p_student_pin_kdf" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_wallet public.dompet_santri%rowtype;
begin
  if p_santri_nis is null or length(trim(p_santri_nis)) = 0 then
    raise exception 'santri_nis wajib diisi';
  end if;

  if p_actor_id is null then
    raise exception 'actor wajib diisi';
  end if;

  if p_student_pin_salt is null or length(trim(p_student_pin_salt)) < 16 then
    raise exception 'salt PIN tidak valid';
  end if;

  if p_student_pin_verifier is null or length(trim(p_student_pin_verifier)) < 32 then
    raise exception 'verifier PIN tidak valid';
  end if;

  if p_student_pin_verifier ~ '^[0-9]{4,12}$' then
    raise exception 'PIN plaintext tidak boleh disimpan';
  end if;

  select * into v_wallet
  from public.dompet_santri
  where santri_nis = p_santri_nis
  for update;

  if not found then
    raise exception 'Dompet tidak ditemukan';
  end if;

  if not exists (
    select 1
    from public.santri s
    where s.nis = p_santri_nis
      and s.wali_id = p_actor_id
  ) then
    raise exception 'Santri tidak terhubung dengan wali ini';
  end if;

  update public.dompet_santri
  set student_pin_salt = trim(p_student_pin_salt),
      student_pin_verifier = trim(p_student_pin_verifier),
      student_pin_kdf = coalesce(p_student_pin_kdf, '{}'::jsonb),
      student_pin_set_at = now(),
      student_pin_version = coalesce(student_pin_version, 0) + 1,
      updated_at = now()
  where santri_nis = p_santri_nis
  returning * into v_wallet;

  insert into public.wallet_audit_logs (
    actor_id,
    actor_role,
    action,
    resource,
    santri_nis,
    record_id,
    metadata
  ) values (
    p_actor_id,
    'wali',
    'wallet_set_student_pin_verifier',
    'dompet_santri',
    p_santri_nis,
    p_santri_nis,
    jsonb_build_object(
      'pin_version', v_wallet.student_pin_version,
      'kdf_algorithm', coalesce(p_student_pin_kdf->>'algorithm', 'Argon2id')
    )
  );

  return jsonb_build_object(
    'santri_nis', v_wallet.santri_nis,
    'wallet_public_id', v_wallet.wallet_public_id,
    'student_pin_version', v_wallet.student_pin_version,
    'student_pin_set_at', v_wallet.student_pin_set_at
  );
end;
$_$;


ALTER FUNCTION "public"."wallet_set_student_pin_verifier"("p_santri_nis" "text", "p_actor_id" "uuid", "p_student_pin_salt" "text", "p_student_pin_verifier" "text", "p_student_pin_kdf" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_set_system_freeze"("p_is_frozen" boolean, "p_reason" "text", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_control public.wallet_system_controls%rowtype;
begin
  update public.wallet_system_controls
  set is_frozen = p_is_frozen,
      freeze_reason = case when p_is_frozen then p_reason else null end,
      frozen_at = case when p_is_frozen then now() else null end,
      frozen_by = case when p_is_frozen then p_actor_id else null end,
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where key = 'wallet_transactions'
  returning * into v_control;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    'system',
    case when p_is_frozen then 'wallet_system_freeze' else 'wallet_system_unfreeze' end,
    'wallet_system_controls',
    'wallet_transactions',
    jsonb_build_object('reason', p_reason, 'is_frozen', p_is_frozen) || coalesce(p_metadata, '{}'::jsonb)
  );

  return to_jsonb(v_control);
end;
$$;


ALTER FUNCTION "public"."wallet_set_system_freeze"("p_is_frozen" boolean, "p_reason" "text", "p_actor_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_start_dispute_investigation"("p_dispute_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_dispute public.wallet_disputes%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menangani dispute dompet';
  end if;

  select * into v_dispute
  from public.wallet_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute tidak ditemukan';
  end if;

  if v_dispute.status not in ('open','investigating') then
    raise exception 'Dispute sudah selesai atau tidak bisa diproses';
  end if;

  update public.wallet_disputes
  set status = 'investigating',
      assigned_to = p_actor_id,
      evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
        'investigation_note', nullif(trim(coalesce(p_note, '')), ''),
        'investigation_started_at', now(),
        'investigation_role', p_actor_role
      )
  where id = p_dispute_id
  returning * into v_dispute;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_start_dispute_investigation',
    'wallet_disputes',
    v_dispute.santri_nis,
    v_dispute.id::text,
    jsonb_build_object('ledger_id', v_dispute.ledger_id, 'note', p_note)
  );

  return to_jsonb(v_dispute);
end;
$$;


ALTER FUNCTION "public"."wallet_start_dispute_investigation"("p_dispute_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_unlock_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app_private'
    AS $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
begin
  if v_role not in ('super_admin','bendahara') then
    raise exception 'Only super_admin or bendahara can unlock wallet account';
  end if;

  update public.dompet_santri
  set status = 'active', locked_reason = null
  where santri_nis = p_santri_nis and status = 'locked';

  if not found then
    raise exception 'Locked wallet account not found';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (p_actor_id, v_role, 'wallet_unlock_account', 'dompet_santri', p_santri_nis, p_santri_nis, jsonb_build_object('reason', p_reason));

  return jsonb_build_object('status', 'active', 'santri_nis', p_santri_nis);
end;
$$;


ALTER FUNCTION "public"."wallet_unlock_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_update_limits"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_low_balance_threshold" bigint DEFAULT NULL::bigint, "p_daily_spend_limit" bigint DEFAULT NULL::bigint, "p_single_transaction_limit" bigint DEFAULT NULL::bigint, "p_monthly_spend_limit" bigint DEFAULT NULL::bigint, "p_large_transaction_threshold" bigint DEFAULT NULL::bigint, "p_allowed_merchant_categories" "jsonb" DEFAULT '[]'::"jsonb", "p_spending_schedule" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_wallet public.dompet_santri%rowtype;
begin
  if v_role not in ('wali','system') then
    raise exception 'Only wali provisioning flow can update wallet limits';
  end if;

  if p_santri_nis is null or length(trim(p_santri_nis)) = 0 then
    raise exception 'santri_nis is required';
  end if;

  if coalesce(p_low_balance_threshold, 0) < 0
    or coalesce(p_daily_spend_limit, 0) < 0
    or coalesce(p_single_transaction_limit, 0) < 0
    or coalesce(p_monthly_spend_limit, 0) < 0 then
    raise exception 'Wallet limits cannot be negative';
  end if;

  if p_large_transaction_threshold is not null and p_large_transaction_threshold <= 0 then
    raise exception 'large_transaction_threshold must be greater than zero';
  end if;

  if p_allowed_merchant_categories is not null and jsonb_typeof(p_allowed_merchant_categories) <> 'array' then
    raise exception 'allowed_merchant_categories must be a JSON array';
  end if;

  if p_spending_schedule is not null and jsonb_typeof(p_spending_schedule) <> 'object' then
    raise exception 'spending_schedule must be a JSON object';
  end if;

  update public.dompet_santri
  set low_balance_threshold = coalesce(p_low_balance_threshold, low_balance_threshold),
      daily_spend_limit = coalesce(p_daily_spend_limit, daily_spend_limit),
      single_transaction_limit = coalesce(p_single_transaction_limit, single_transaction_limit),
      monthly_spend_limit = coalesce(p_monthly_spend_limit, monthly_spend_limit),
      large_transaction_threshold = coalesce(p_large_transaction_threshold, large_transaction_threshold),
      allowed_merchant_categories = coalesce(p_allowed_merchant_categories, allowed_merchant_categories),
      spending_schedule = coalesce(p_spending_schedule, spending_schedule),
      limits_version = limits_version + 1,
      limits_updated_by = p_actor_id,
      limits_updated_at = now()
  where santri_nis = p_santri_nis
  returning * into v_wallet;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    v_role,
    'wallet_update_limits',
    'dompet_santri',
    p_santri_nis,
    p_santri_nis,
    jsonb_build_object(
      'low_balance_threshold', v_wallet.low_balance_threshold,
      'daily_spend_limit', v_wallet.daily_spend_limit,
      'single_transaction_limit', v_wallet.single_transaction_limit,
      'monthly_spend_limit', v_wallet.monthly_spend_limit,
      'large_transaction_threshold', v_wallet.large_transaction_threshold,
      'limits_version', v_wallet.limits_version
    )
  );

  return jsonb_build_object(
    'status', 'updated',
    'santri_nis', v_wallet.santri_nis,
    'low_balance_threshold', v_wallet.low_balance_threshold,
    'daily_spend_limit', v_wallet.daily_spend_limit,
    'single_transaction_limit', v_wallet.single_transaction_limit,
    'monthly_spend_limit', v_wallet.monthly_spend_limit,
    'large_transaction_threshold', v_wallet.large_transaction_threshold,
    'allowed_merchant_categories', v_wallet.allowed_merchant_categories,
    'spending_schedule', v_wallet.spending_schedule,
    'limits_version', v_wallet.limits_version
  );
end;
$$;


ALTER FUNCTION "public"."wallet_update_limits"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_low_balance_threshold" bigint, "p_daily_spend_limit" bigint, "p_single_transaction_limit" bigint, "p_monthly_spend_limit" bigint, "p_large_transaction_threshold" bigint, "p_allowed_merchant_categories" "jsonb", "p_spending_schedule" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alumni_data" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "tahun_lulus" integer NOT NULL,
    "no_wa" "text",
    "profesi_sekarang" "text",
    "instansi_kerja" "text",
    "alamat_domisili" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bio" "text",
    "avatar_storage_path" "text",
    "show_whatsapp" boolean DEFAULT false NOT NULL,
    "show_profession" boolean DEFAULT true NOT NULL,
    "show_location" boolean DEFAULT true NOT NULL,
    "forum_notify_replies" boolean DEFAULT true NOT NULL,
    "forum_notify_reactions" boolean DEFAULT true NOT NULL,
    "province_code" "text",
    "province_name" "text",
    "regency_code" "text",
    "regency_name" "text",
    "district_code" "text",
    "district_name" "text",
    "village_code" "text",
    "village_name" "text",
    "postal_code" "text",
    "address_detail" "text",
    CONSTRAINT "alumni_data_bio_length_check" CHECK ((("bio" IS NULL) OR ("char_length"("bio") <= 300)))
);


ALTER TABLE "public"."alumni_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alumni_follows" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alumni_follows_no_self_follow" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."alumni_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "user_name" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "resource" "text" NOT NULL,
    "record_id" "text",
    "details" "jsonb",
    "meta_info" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


ALTER TABLE "public"."audit_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."berita" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "judul" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "ringkasan" "text",
    "konten" "text",
    "kategori" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "thumbnail_url" "text",
    "penulis_id" "uuid",
    "is_featured" boolean DEFAULT false,
    "tanggal_publish" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."berita" OWNER TO "postgres";


ALTER TABLE "public"."berita" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."berita_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."chat_blocks" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_blocks_check" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."chat_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" DEFAULT 'direct'::"text" NOT NULL,
    "title" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    "last_message_preview" "text",
    "last_message_sender_id" "uuid",
    CONSTRAINT "chat_conversations_type_check" CHECK (("type" = ANY (ARRAY['direct'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."chat_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_device_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" "text" NOT NULL,
    "device_name" "text",
    "public_key" "text" NOT NULL,
    "key_algorithm" "text" DEFAULT 'P-256-ECDH-AES-GCM'::"text" NOT NULL,
    "key_version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."chat_device_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_key_backups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" "text" NOT NULL,
    "encrypted_private_key" "text" NOT NULL,
    "salt" "text" NOT NULL,
    "nonce" "text" NOT NULL,
    "kdf" "text" DEFAULT 'PBKDF2WithHmacSHA256'::"text" NOT NULL,
    "kdf_iterations" integer DEFAULT 210000 NOT NULL,
    "key_algorithm" "text" DEFAULT 'P-256-ECDH-AES-GCM'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_key_backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_message_device_ciphertexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "recipient_device_id" "text" NOT NULL,
    "sender_device_id" "text" NOT NULL,
    "ciphertext" "text" NOT NULL,
    "nonce" "text" NOT NULL,
    "encrypted_message_key" "text",
    "key_algorithm" "text" DEFAULT 'P-256-ECDH-AES-GCM'::"text" NOT NULL,
    "key_version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_message_device_ciphertexts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_message_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_message_reports_no_plaintext_note" CHECK (("note" IS NULL)),
    CONSTRAINT "chat_message_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'harassment'::"text", 'inappropriate'::"text", 'privacy'::"text", 'scam'::"text", 'other'::"text"]))),
    CONSTRAINT "chat_message_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'resolved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."chat_message_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "reply_to_message_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "encryption_scheme" "text" DEFAULT 'e2ee_v1'::"text" NOT NULL,
    "e2ee_version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "chat_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'system'::"text"]))),
    CONSTRAINT "chat_messages_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'edited'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone,
    "muted_until" timestamp with time zone,
    "archived_at" timestamp with time zone,
    CONSTRAINT "chat_participants_role_check" CHECK (("role" = ANY (ARRAY['member'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_user_presence" (
    "user_id" "uuid" NOT NULL,
    "is_online" boolean DEFAULT false NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_user_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_diklat" (
    "id" integer NOT NULL,
    "tahun_hijriah" integer NOT NULL,
    "uang_miftah" numeric DEFAULT 110000,
    "biaya_listrik" numeric DEFAULT 50000,
    "kos_makan" numeric DEFAULT 460000,
    "tafaruqon" numeric DEFAULT 30000,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "periode" numeric,
    "uang_miftah_putri" numeric,
    "biaya_listrik_putri" numeric,
    "kos_makan_putri" numeric,
    "tafaruqon_putri" numeric
);


ALTER TABLE "public"."config_diklat" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."config_diklat_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."config_diklat_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."config_diklat_id_seq" OWNED BY "public"."config_diklat"."id";



CREATE TABLE IF NOT EXISTS "public"."crypto_keystores" (
    "santri_nis" "text" NOT NULL,
    "public_key" "text" NOT NULL,
    "encrypted_wallet_data" "text" NOT NULL,
    "encryption_salt" "text" NOT NULL,
    "encryption_iv" "text" NOT NULL,
    "key_algorithm" "text" DEFAULT 'Ed25519-signature+A256GCM-backup'::"text" NOT NULL,
    "kdf" "text" DEFAULT 'PBKDF2WithHmacSHA256'::"text" NOT NULL,
    "kdf_iterations" integer DEFAULT 310000 NOT NULL,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "status" "public"."wallet_device_status" DEFAULT 'active'::"public"."wallet_device_status" NOT NULL,
    "revoked_at" timestamp with time zone,
    "rotation_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crypto_keystores_failed_attempts_check" CHECK (("failed_attempts" >= 0)),
    CONSTRAINT "crypto_keystores_kdf_iterations_check" CHECK (("kdf_iterations" >= 210000)),
    CONSTRAINT "crypto_keystores_rotation_count_check" CHECK (("rotation_count" >= 0))
);


ALTER TABLE "public"."crypto_keystores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."detail_transaksi" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "transaksi_id" "uuid" DEFAULT "gen_random_uuid"(),
    "tagihan_id" "uuid" DEFAULT "gen_random_uuid"(),
    "nominal_dialokasikan" bigint
);


ALTER TABLE "public"."detail_transaksi" OWNER TO "postgres";


ALTER TABLE "public"."detail_transaksi" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."detail_transaksi_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."dompet_santri" (
    "santri_nis" "text" NOT NULL,
    "wallet_public_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "saldo" bigint DEFAULT 0 NOT NULL,
    "status" "public"."wallet_account_status" DEFAULT 'active'::"public"."wallet_account_status" NOT NULL,
    "low_balance_threshold" bigint DEFAULT 10000 NOT NULL,
    "daily_spend_limit" bigint,
    "single_transaction_limit" bigint,
    "locked_reason" "text",
    "closed_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "monthly_spend_limit" bigint,
    "large_transaction_threshold" bigint,
    "allowed_merchant_categories" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "spending_schedule" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "limits_version" integer DEFAULT 1 NOT NULL,
    "limits_updated_by" "uuid",
    "limits_updated_at" timestamp with time zone,
    "low_balance_warning_threshold" bigint DEFAULT 30000 NOT NULL,
    "low_balance_critical_threshold" bigint DEFAULT 10000 NOT NULL,
    "student_pin_salt" "text",
    "student_pin_verifier" "text",
    "student_pin_kdf" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "student_pin_set_at" timestamp with time zone,
    "student_pin_version" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "dompet_santri_daily_spend_limit_check" CHECK ((("daily_spend_limit" IS NULL) OR ("daily_spend_limit" > 0))),
    CONSTRAINT "dompet_santri_large_transaction_threshold_check" CHECK ((("large_transaction_threshold" IS NULL) OR ("large_transaction_threshold" > 0))),
    CONSTRAINT "dompet_santri_limits_version_check" CHECK (("limits_version" > 0)),
    CONSTRAINT "dompet_santri_low_balance_critical_threshold_check" CHECK (("low_balance_critical_threshold" >= 0)),
    CONSTRAINT "dompet_santri_low_balance_threshold_check" CHECK (("low_balance_threshold" >= 0)),
    CONSTRAINT "dompet_santri_low_balance_warning_threshold_check" CHECK (("low_balance_warning_threshold" >= 0)),
    CONSTRAINT "dompet_santri_monthly_spend_limit_check" CHECK ((("monthly_spend_limit" IS NULL) OR ("monthly_spend_limit" >= 0))),
    CONSTRAINT "dompet_santri_saldo_check" CHECK (("saldo" >= 0)),
    CONSTRAINT "dompet_santri_single_transaction_limit_check" CHECK ((("single_transaction_limit" IS NULL) OR ("single_transaction_limit" > 0))),
    CONSTRAINT "dompet_santri_student_pin_verifier_not_plain" CHECK ((("student_pin_verifier" IS NULL) OR (("length"("student_pin_verifier") >= 32) AND ("student_pin_verifier" !~ '^[0-9]{4,8}$'::"text"))))
);


ALTER TABLE "public"."dompet_santri" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid",
    "comment_id" "uuid",
    "uploader_id" "uuid" NOT NULL,
    "storage_bucket" "text" DEFAULT 'forum-media'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint,
    "width" integer,
    "height" integer,
    "alt_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_attachments_bucket_check" CHECK (("storage_bucket" = 'forum-media'::"text")),
    CONSTRAINT "forum_attachments_dimensions_check" CHECK (((("width" IS NULL) OR ("width" > 0)) AND (("height" IS NULL) OR ("height" > 0)))),
    CONSTRAINT "forum_attachments_file_size_check" CHECK ((("file_size" IS NULL) OR (("file_size" > 0) AND ("file_size" <= 5242880)))),
    CONSTRAINT "forum_attachments_mime_check" CHECK (("mime_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text"]))),
    CONSTRAINT "forum_attachments_target_check" CHECK (((("thread_id" IS NOT NULL) AND ("comment_id" IS NULL)) OR (("thread_id" IS NULL) AND ("comment_id" IS NOT NULL))))
);


ALTER TABLE "public"."forum_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "parent_comment_id" "uuid",
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "reaction_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "forum_comments_content_length" CHECK ((("char_length"("btrim"("content")) >= 1) AND ("char_length"("btrim"("content")) <= 2000))),
    CONSTRAINT "forum_comments_parent_not_self" CHECK ((("parent_comment_id" IS NULL) OR ("parent_comment_id" <> "id"))),
    CONSTRAINT "forum_comments_reaction_count_check" CHECK (("reaction_count" >= 0)),
    CONSTRAINT "forum_comments_status_check" CHECK (("status" = ANY (ARRAY['published'::"text", 'pending_review'::"text", 'hidden'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."forum_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "moderator_id" "uuid" NOT NULL,
    "thread_id" "uuid",
    "comment_id" "uuid",
    "report_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_moderation_actions_action_check" CHECK (("action" = ANY (ARRAY['hide'::"text", 'restore'::"text", 'lock'::"text", 'unlock'::"text", 'pin'::"text", 'unpin'::"text", 'resolve_report'::"text", 'reject_report'::"text"]))),
    CONSTRAINT "forum_moderation_actions_target_check" CHECK ((("thread_id" IS NOT NULL) OR ("comment_id" IS NOT NULL) OR ("report_id" IS NOT NULL)))
);


ALTER TABLE "public"."forum_moderation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "thread_id" "uuid",
    "comment_id" "uuid",
    "reaction_type" "text" DEFAULT 'love'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_reactions_target_check" CHECK (((("thread_id" IS NOT NULL) AND ("comment_id" IS NULL)) OR (("thread_id" IS NULL) AND ("comment_id" IS NOT NULL)))),
    CONSTRAINT "forum_reactions_type_check" CHECK (("reaction_type" = ANY (ARRAY['love'::"text", 'prayer'::"text", 'support'::"text"])))
);


ALTER TABLE "public"."forum_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "thread_id" "uuid",
    "comment_id" "uuid",
    "reason" "text" NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forum_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'tidak_pantas'::"text", 'fitnah'::"text", 'privasi'::"text", 'lainnya'::"text"]))),
    CONSTRAINT "forum_reports_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'resolved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "forum_reports_target_check" CHECK (((("thread_id" IS NOT NULL) AND ("comment_id" IS NULL)) OR (("thread_id" IS NULL) AND ("comment_id" IS NOT NULL))))
);


ALTER TABLE "public"."forum_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "visibility" "text" DEFAULT 'alumni'::"text" NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "reaction_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "repost_of_thread_id" "uuid",
    CONSTRAINT "forum_threads_content_length" CHECK ((("char_length"("btrim"("content")) >= 1) AND ("char_length"("btrim"("content")) <= 5000))),
    CONSTRAINT "forum_threads_counts_check" CHECK ((("comment_count" >= 0) AND ("reaction_count" >= 0))),
    CONSTRAINT "forum_threads_status_check" CHECK (("status" = ANY (ARRAY['published'::"text", 'pending_review'::"text", 'hidden'::"text", 'deleted'::"text"]))),
    CONSTRAINT "forum_threads_visibility_check" CHECK (("visibility" = 'alumni'::"text"))
);


ALTER TABLE "public"."forum_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."geocode_cache" (
    "id" integer NOT NULL,
    "normalized_address" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "lat" double precision NOT NULL,
    "lon" double precision NOT NULL,
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."geocode_cache" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."geocode_cache_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."geocode_cache_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."geocode_cache_id_seq" OWNED BY "public"."geocode_cache"."id";



CREATE TABLE IF NOT EXISTS "public"."geocode_jobs" (
    "id" integer NOT NULL,
    "nis" "text",
    "address" "text" NOT NULL,
    "normalized_address" "text",
    "provider_preference" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "attempts" integer DEFAULT 0,
    "last_error" "text",
    "result_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."geocode_jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."geocode_jobs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."geocode_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."geocode_jobs_id_seq" OWNED BY "public"."geocode_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."hafalan_kitab" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text" NOT NULL,
    "tanggal" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nama_kitab" "text" NOT NULL,
    "bab_materi" "text",
    "bait_awal" integer,
    "bait_akhir" integer,
    "halaman_awal" integer,
    "halaman_akhir" integer,
    "predikat" "text",
    "status" "text",
    "catatan" "text",
    "dicatat_oleh_id" "uuid"
);


ALTER TABLE "public"."hafalan_kitab" OWNER TO "postgres";


ALTER TABLE "public"."hafalan_kitab" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."hafalan_kitab_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."hafalan_tahfidz" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text",
    "tanggal" timestamp with time zone,
    "surat" "text",
    "ayat_awal" integer,
    "ayat_akhir" integer,
    "status" "text",
    "catatan" "text",
    "dicatat_oleh_id" "uuid",
    "total_hafalan" integer,
    "hafalan_kitab" "text",
    "juz" integer,
    "predikat" "text"
);


ALTER TABLE "public"."hafalan_tahfidz" OWNER TO "postgres";


ALTER TABLE "public"."hafalan_tahfidz" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."hafalan_tahfidz_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."info_rekening_santri" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text",
    "nama_bank" "text",
    "nomor_rekening" "text",
    "atas_nama" "text"
);


ALTER TABLE "public"."info_rekening_santri" OWNER TO "postgres";


COMMENT ON TABLE "public"."info_rekening_santri" IS 'pengelola kantin';



ALTER TABLE "public"."info_rekening_santri" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."info_rekening_santri_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."instansi_info" (
    "id" bigint NOT NULL,
    "nama_instansi" "text" DEFAULT 'Pesantren Al-Hasanah'::"text",
    "alamat" "text",
    "logo_url" "text",
    "kepala_pesantren" "text",
    "tahun_ajaran_aktif" "text" DEFAULT '2024/2025'::"text",
    "mode_maintenance" boolean DEFAULT false,
    "fitur_notif_wa" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    "no_telp" numeric
);


ALTER TABLE "public"."instansi_info" OWNER TO "postgres";


ALTER TABLE "public"."instansi_info" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."instansi_info_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventaris" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "kode_barang" "text" NOT NULL,
    "nama_barang" "text" NOT NULL,
    "merk" "text",
    "spesifikasi" "text",
    "kategori_id" bigint,
    "lokasi_id" bigint,
    "sumber_dana" "text" NOT NULL,
    "tanggal_perolehan" "date" NOT NULL,
    "harga_perolehan" numeric DEFAULT 0 NOT NULL,
    "nilai_residu" numeric DEFAULT 0,
    "jumlah" integer DEFAULT 1 NOT NULL,
    "satuan" "text" DEFAULT 'Unit'::"text",
    "kondisi" "text" NOT NULL,
    "foto_url" "text",
    "keterangan" "text",
    "dicatat_oleh_id" "uuid"
);


ALTER TABLE "public"."inventaris" OWNER TO "postgres";


ALTER TABLE "public"."inventaris" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventaris_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."kantin_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kantin_user_id" "uuid" NOT NULL,
    "device_id" "text" NOT NULL,
    "device_fingerprint" "text" NOT NULL,
    "public_key" "text" NOT NULL,
    "key_algorithm" "text" DEFAULT 'Ed25519'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "registered_by" "uuid",
    "registered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revoked_at" timestamp with time zone,
    "revoke_reason" "text",
    "last_seen_at" timestamp with time zone,
    "last_transaction_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "kantin_devices_key_algorithm_check" CHECK (("key_algorithm" = 'Ed25519'::"text")),
    CONSTRAINT "kantin_devices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."kantin_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kategori_barang" (
    "id" bigint NOT NULL,
    "nama_kategori" "text" NOT NULL,
    "kode_prefix" "text" NOT NULL
);


ALTER TABLE "public"."kategori_barang" OWNER TO "postgres";


ALTER TABLE "public"."kategori_barang" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."kategori_barang_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."kecamatan_polygons" (
    "id" "text" NOT NULL,
    "nama" "text" NOT NULL,
    "kabupaten" "text",
    "properties" "jsonb",
    "geom" "public"."geometry"(MultiPolygon,4326) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kecamatan_polygons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kesehatan_santri" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text",
    "tanggal" "date",
    "keluhan" "text",
    "tindakan" "text",
    "catatan" "text",
    "dicatat_oleh_id" "text"
);


ALTER TABLE "public"."kesehatan_santri" OWNER TO "postgres";


ALTER TABLE "public"."kesehatan_santri" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."kesehatan_santri_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."log_aktivitas" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "aktivitas" "text",
    "detail" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."log_aktivitas" OWNER TO "postgres";


ALTER TABLE "public"."log_aktivitas" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."log_aktivitas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."lokasi_aset" (
    "id" bigint NOT NULL,
    "nama_lokasi" "text" NOT NULL,
    "penanggung_jawab" "text"
);


ALTER TABLE "public"."lokasi_aset" OWNER TO "postgres";


ALTER TABLE "public"."lokasi_aset" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."lokasi_aset_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."master_kitab" (
    "id" integer NOT NULL,
    "nama_kitab" "text" NOT NULL,
    "harga" numeric NOT NULL,
    "jenis_diklat" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "jenis_kelamin" "text" DEFAULT 'ALL'::"text",
    "kategori" "text" DEFAULT 'KITAB'::"text",
    "is_wajib" boolean DEFAULT false,
    CONSTRAINT "master_kitab_jenis_kelamin_check" CHECK (("jenis_kelamin" = ANY (ARRAY['L'::"text", 'P'::"text", 'ALL'::"text"]))),
    CONSTRAINT "master_kitab_kategori_check" CHECK (("kategori" = ANY (ARRAY['KITAB'::"text", 'PERLENGKAPAN'::"text", 'BUKU'::"text"])))
);


ALTER TABLE "public"."master_kitab" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."master_kitab_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."master_kitab_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."master_kitab_id_seq" OWNED BY "public"."master_kitab"."id";



CREATE TABLE IF NOT EXISTS "public"."mata_pelajaran" (
    "id" bigint NOT NULL,
    "nama_mapel" "text" NOT NULL,
    "kategori" "public"."kategori_mapel_enum" NOT NULL,
    "kkm" integer DEFAULT 70,
    "aktif" boolean DEFAULT true
);


ALTER TABLE "public"."mata_pelajaran" OWNER TO "postgres";


ALTER TABLE "public"."mata_pelajaran" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."mata_pelajaran_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."midtrans_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" character varying(50) NOT NULL,
    "payment_type" character varying(50),
    "transaction_status" character varying(50),
    "raw_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."midtrans_webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."murojaah_tahfidz" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text",
    "tanggal" timestamp with time zone,
    "jenis_murojaah" "text",
    "juz" integer,
    "surat" "text",
    "ayat_awal" integer,
    "ayat_akhir" integer,
    "halaman_awal" integer,
    "halaman_akhir" integer,
    "status" "text",
    "predikat" "text",
    "catatan" "text",
    "dicatat_oleh_id" "uuid"
);


ALTER TABLE "public"."murojaah_tahfidz" OWNER TO "postgres";


ALTER TABLE "public"."murojaah_tahfidz" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."murojaah_tahfidz_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."nilai_santri" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "santri_nis" "text",
    "mapel_id" bigint,
    "semester" "text" NOT NULL,
    "tahun_ajaran" "text" NOT NULL,
    "nilai_angka" integer NOT NULL,
    "catatan_ustadz" "text",
    "dicatat_oleh" "text"
);


ALTER TABLE "public"."nilai_santri" OWNER TO "postgres";


ALTER TABLE "public"."nilai_santri" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."nilai_santri_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notification_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "source_table" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    "event_type" "text",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "channel" "text" DEFAULT 'push'::"text" NOT NULL,
    "reference_id" "text",
    "read_at" timestamp with time zone,
    "scheduled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wallet_review_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "wallet_reviewed_by" "uuid",
    "wallet_reviewed_at" timestamp with time zone,
    "wallet_review_note" "text",
    CONSTRAINT "notification_queue_channel_check" CHECK (("channel" = ANY (ARRAY['in_app'::"text", 'push'::"text", 'email'::"text", 'sms'::"text", 'telegram'::"text"]))),
    CONSTRAINT "notification_queue_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "notification_queue_wallet_review_status_check" CHECK (("wallet_review_status" = ANY (ARRAY['open'::"text", 'reviewed'::"text", 'resolved'::"text", 'ignored_dummy'::"text"])))
);


ALTER TABLE "public"."notification_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pelanggaran_santri" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text",
    "tanggal" "date",
    "jenis_pelanggaran" "text",
    "poin" integer,
    "hukuman" "text",
    "catatan" "text",
    "dicatat_oleh_id" "text"
);


ALTER TABLE "public"."pelanggaran_santri" OWNER TO "postgres";


ALTER TABLE "public"."pelanggaran_santri" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pelanggaran_santri_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pengeluaran" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "judul" "text" NOT NULL,
    "kategori" "text" NOT NULL,
    "nominal" numeric NOT NULL,
    "tanggal_pengeluaran" "date" NOT NULL,
    "keterangan" "text",
    "bukti_url" "text",
    "dicatat_oleh_id" "uuid",
    "dicatat_oleh_nama" "text"
);


ALTER TABLE "public"."pengeluaran" OWNER TO "postgres";


ALTER TABLE "public"."pengeluaran" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pengeluaran_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."perizinan_santri" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text",
    "tanggal_kembali" "date",
    "jenis_izin" "text",
    "keterangan" "text",
    "dicatat_oleh_id" "text",
    "status" "text",
    "tanggal" "date"
);


ALTER TABLE "public"."perizinan_santri" OWNER TO "postgres";


ALTER TABLE "public"."perizinan_santri" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."perizinan_santri_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."peserta_diklat" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nama_lengkap" "text" NOT NULL,
    "tempat_lahir" "text",
    "tanggal_lahir" "date",
    "alamat_lengkap" "text",
    "no_telepon" "text",
    "pesantren_asal" "text",
    "jenis_diklat" "public"."jenis_diklat_enum" NOT NULL,
    "tahun_diklat" integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    "biaya_pendaftaran" numeric DEFAULT 0,
    "belanja_kitab_nominal" numeric DEFAULT 0,
    "rincian_belanja" "text",
    "status_pembayaran" "text" DEFAULT 'LUNAS'::"text",
    "qr_code_id" "uuid" DEFAULT "gen_random_uuid"(),
    "dicatat_oleh" "text",
    "alamat_pesantren" "text",
    "nama_wali" "text",
    "pekerjaan_wali" "text",
    "biaya_listrik" numeric,
    "kos_makan" numeric,
    "tafaruqon" numeric,
    "uang_miftah" numeric,
    "jenis_kelamin" "text",
    CONSTRAINT "peserta_diklat_jenis_kelamin_check" CHECK (("jenis_kelamin" = ANY (ARRAY['L'::"text", 'P'::"text"])))
);


ALTER TABLE "public"."peserta_diklat" OWNER TO "postgres";


ALTER TABLE "public"."peserta_diklat" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."peserta_diklat_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."prestasi_santri" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "santri_nis" "text" NOT NULL,
    "kategori" "text" NOT NULL,
    "judul_prestasi" "text" NOT NULL,
    "keterangan" "text",
    "tanggal_prestasi" "date" DEFAULT CURRENT_DATE,
    "sertifikat_url" "text",
    "poin_prestasi" integer DEFAULT 0,
    "dicatat_oleh_id" "uuid"
);


ALTER TABLE "public"."prestasi_santri" OWNER TO "postgres";


ALTER TABLE "public"."prestasi_santri" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."prestasi_santri_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."question_bank" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kitab" "text" NOT NULL,
    "bab" "text" NOT NULL,
    "sub_bab" "text",
    "konten_soal" "text" NOT NULL,
    "tingkat_kesulitan" "text",
    "is_ever_used" boolean DEFAULT false,
    "used_in_test_count" integer DEFAULT 0,
    "last_used_test_id" "uuid",
    "last_used_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "question_bank_kitab_check" CHECK (("kitab" = ANY (ARRAY['alfiyah'::"text", 'nadzmul_maqshud'::"text", 'kailani'::"text"]))),
    CONSTRAINT "question_bank_tingkat_kesulitan_check" CHECK (("tingkat_kesulitan" = ANY (ARRAY['mudah'::"text", 'sedang'::"text", 'sulit'::"text"])))
);


ALTER TABLE "public"."question_bank" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rag_document_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "chunk_index" integer NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "embedding" "extensions"."vector"(768),
    "embedding_model" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "token_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rag_document_chunks_chunk_index_check" CHECK (("chunk_index" >= 0)),
    CONSTRAINT "rag_document_chunks_token_count_check" CHECK ((("token_count" IS NULL) OR ("token_count" >= 0)))
);


ALTER TABLE "public"."rag_document_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rag_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "document_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "content_preview" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "chunk_count" integer DEFAULT 0 NOT NULL,
    "embedding_model" "text",
    "embedding_dimension" integer DEFAULT 768 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rag_documents_chunk_count_check" CHECK (("chunk_count" >= 0)),
    CONSTRAINT "rag_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['general'::"text", 'kitab'::"text", 'report'::"text", 'policy'::"text", 'sop'::"text", 'faq'::"text"]))),
    CONSTRAINT "rag_documents_embedding_dimension_check" CHECK (("embedding_dimension" > 0)),
    CONSTRAINT "rag_documents_source_type_check" CHECK (("source_type" = ANY (ARRAY['public'::"text", 'kitab'::"text", 'internal'::"text"]))),
    CONSTRAINT "rag_documents_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."rag_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rag_query_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text",
    "user_id" "uuid",
    "query_text" "text" NOT NULL,
    "source_type" "text",
    "context_type" "text",
    "retrieved_chunk_ids" "uuid"[],
    "response_preview" "text",
    "latency_ms" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rag_query_logs_context_type_check" CHECK (("context_type" = ANY (ARRAY['public_chatbot'::"text", 'wali_chatbot'::"text", 'admin_decision'::"text", 'kitab_chatbot'::"text", 'ingest_test'::"text"]))),
    CONSTRAINT "rag_query_logs_latency_ms_check" CHECK ((("latency_ms" IS NULL) OR ("latency_ms" >= 0))),
    CONSTRAINT "rag_query_logs_source_type_check" CHECK (("source_type" = ANY (ARRAY['public'::"text", 'kitab'::"text", 'internal'::"text", 'mixed'::"text"])))
);


ALTER TABLE "public"."rag_query_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rag_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_key" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rag_rate_limits_request_count_check" CHECK (("request_count" >= 0))
);


ALTER TABLE "public"."rag_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ref_jenis_pembayaran" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nama_pembayaran" "text",
    "tipe" "text",
    "nominal_default" bigint,
    "is_aktif" boolean
);


ALTER TABLE "public"."ref_jenis_pembayaran" OWNER TO "postgres";


ALTER TABLE "public"."ref_jenis_pembayaran" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ref_jenis_pembayaran_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."santri" (
    "nis" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nama" "text",
    "kelas" "public"."tipe_kelas",
    "jurusan" "public"."tipe_jurusan",
    "pembimbing" "text",
    "foto_url" "text",
    "status_spp" "text",
    "anak_ke" "text",
    "wali_id" "uuid" DEFAULT "gen_random_uuid"(),
    "jenis_kelamin" "public"."tipe_gender",
    "hafalan_kitab" "text",
    "total_hafalan" "text",
    "status_santri" "public"."status_santri",
    "latitude" double precision,
    "longitude" double precision,
    "geom" "public"."geometry"(Point,4326),
    "kecamatan_id" "text",
    "geocode_status" "text" DEFAULT 'PENDING'::"text",
    "geocode_provider" "text",
    "geocode_confidence" double precision,
    "geocoded_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "nsp" "text",
    "nis_hash" "text",
    "nis_enc" "bytea",
    "nisn_hash" "text",
    "nisn_enc" "bytea",
    "nik_hash" "text",
    "nik_enc" "bytea",
    "no_kk_hash" "text",
    "no_kk_enc" "bytea",
    "nama_enc" "bytea",
    "tempat_lahir_enc" "bytea",
    "tanggal_lahir_enc" "bytea",
    "alamat_lengkap_enc" "bytea",
    "no_kontak_wali_enc" "bytea",
    "ayah_enc" "bytea",
    "ibu_enc" "bytea",
    "nama_wali_enc" "bytea",
    "nik_ayah_hash" "text",
    "nik_ayah_enc" "bytea",
    "nik_ibu_hash" "text",
    "nik_ibu_enc" "bytea",
    "nik_wali_hash" "text",
    "nik_wali_enc" "bytea",
    "no_kip_hash" "text",
    "no_kip_enc" "bytea",
    "agama" "text" DEFAULT 'ISLAM'::"text",
    "kewarganegaraan" "text" DEFAULT 'WNI'::"text",
    "status_mukim" "text",
    "rt" "text",
    "rw" "text",
    "desa_kelurahan" "text",
    "kabupaten_kota" "text",
    "provinsi" "text",
    "kode_pos" "text",
    "jarak_rumah_km" numeric(8,2),
    "tahun_masuk" integer,
    "tanggal_masuk" "date",
    "tahun_lulus_keluar" integer,
    "tanggal_lulus_keluar" "date",
    "alasan_keluar" "text",
    "penerima_pip" boolean DEFAULT false,
    "penerima_beasiswa" boolean DEFAULT false,
    "jenis_beasiswa" "text",
    "kebutuhan_khusus" "text",
    "pendidikan_ayah" "text",
    "pekerjaan_ayah" "text",
    "penghasilan_ayah" "text",
    "status_ayah" "text",
    "pendidikan_ibu" "text",
    "pekerjaan_ibu" "text",
    "penghasilan_ibu" "text",
    "status_ibu" "text",
    "pendidikan_wali" "text",
    "pekerjaan_wali" "text",
    "penghasilan_wali" "text",
    "hubungan_wali" "text",
    "emis_extra" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."santri" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."struktur_organisasi" (
    "id" bigint NOT NULL,
    "parent_id" bigint,
    "jabatan" "text" NOT NULL,
    "nama_pejabat" "text" NOT NULL,
    "nip_niy" "text",
    "foto_url" "text",
    "warna_kartu" "text" DEFAULT '#059669'::"text",
    "urutan" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."struktur_organisasi" OWNER TO "postgres";


ALTER TABLE "public"."struktur_organisasi" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."struktur_organisasi_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tagihan_santri" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text",
    "jenis_pembayaran_id" bigint,
    "deskripsi_tagihan" "text",
    "nominal_tagihan" bigint,
    "sisa_tagihan" bigint,
    "tanggal_jatuh_tempo" "date",
    "status" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tagihan_santri_status_check" CHECK (("status" = ANY (ARRAY['LUNAS'::"text", 'BELUM'::"text", 'CICILAN'::"text"])))
);


ALTER TABLE "public"."tagihan_santri" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "nomor_urut" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."test_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "santri_nis" "text",
    "nama_kelompok" "text",
    "santri_nis_list" "text"[],
    "nilai" numeric(5,2),
    "catatan_pengurus" "text",
    "status_kehadiran" "text" DEFAULT 'hadir'::"text",
    "dinilai_oleh" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "test_submissions_mode_check" CHECK (("mode" = ANY (ARRAY['individu'::"text", 'kelompok'::"text"]))),
    CONSTRAINT "test_submissions_nilai_check" CHECK ((("nilai" >= (0)::numeric) AND ("nilai" <= (100)::numeric))),
    CONSTRAINT "test_submissions_status_kehadiran_check" CHECK (("status_kehadiran" = ANY (ARRAY['hadir'::"text", 'izin'::"text", 'alfa'::"text"])))
);


ALTER TABLE "public"."test_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaksi_dompet" (
    "id" bigint NOT NULL,
    "public_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "santri_nis" "text" NOT NULL,
    "direction" "public"."wallet_direction" NOT NULL,
    "jenis" "text" NOT NULL,
    "category" "public"."tipe_kategori_transaksi" NOT NULL,
    "kategori_transaksi" "public"."tipe_kategori_transaksi" NOT NULL,
    "jenis_transaksi" "public"."tipe_kategori_transaksi" NOT NULL,
    "amount" bigint NOT NULL,
    "nominal" bigint NOT NULL,
    "balance_before" bigint NOT NULL,
    "balance_after" bigint NOT NULL,
    "status" "public"."wallet_intent_status" DEFAULT 'posted'::"public"."wallet_intent_status" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text" NOT NULL,
    "dicatat_oleh_id" "uuid",
    "counterparty_id" "uuid",
    "counterparty_role" "text",
    "transaksi_keuangan_id" "uuid",
    "payment_intent_id" "uuid",
    "idempotency_key" "text" NOT NULL,
    "nonce" "text",
    "signature" "text",
    "signature_public_key" "text",
    "prev_hash" "text",
    "entry_hash" "text" NOT NULL,
    "keterangan" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "transaksi_dompet_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "transaksi_dompet_balance_after_check" CHECK (("balance_after" >= 0)),
    CONSTRAINT "transaksi_dompet_balance_before_check" CHECK (("balance_before" >= 0)),
    CONSTRAINT "transaksi_dompet_check" CHECK (((("direction" = 'credit'::"public"."wallet_direction") AND ("jenis" = 'masuk'::"text")) OR (("direction" = 'debit'::"public"."wallet_direction") AND ("jenis" = 'keluar'::"text")))),
    CONSTRAINT "transaksi_dompet_jenis_check" CHECK (("jenis" = ANY (ARRAY['masuk'::"text", 'keluar'::"text"]))),
    CONSTRAINT "transaksi_dompet_nominal_check" CHECK (("nominal" > 0))
);


ALTER TABLE "public"."transaksi_dompet" OWNER TO "postgres";


ALTER TABLE "public"."transaksi_dompet" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."transaksi_dompet_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."transaksi_keuangan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wali_id" "uuid",
    "jumlah" bigint,
    "tanggal_transaksi" timestamp without time zone,
    "status_transaksi" "text",
    "metode_pembayaran" "text",
    "midtrans_snap_token" "text",
    "waktu_bayar_sukses" timestamp without time zone,
    "status" "public"."tipe_status_transaksi" DEFAULT 'pending'::"public"."tipe_status_transaksi",
    "jenis_pembayaran" "text",
    "jenis_transaksi" character varying(50),
    "kategori" "text",
    "keterangan" "text",
    "admin_pencatat_id" "uuid" DEFAULT "gen_random_uuid"(),
    "midtrans_order_id" "text",
    "santri_nis" "text",
    "pesan_donatur" "text"
);


ALTER TABLE "public"."transaksi_keuangan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "fcm_token" "text" NOT NULL,
    "device_type" "text" DEFAULT 'android'::"text",
    "last_seen" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL,
    "device_id" "text",
    "platform" "text",
    "app_instance_id" "text",
    "last_seen_at" timestamp with time zone
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_admin_wallet_status" WITH ("security_invoker"='true') AS
 SELECT "d"."santri_nis",
    "d"."wallet_public_id",
    "s"."nama",
    "s"."kelas",
    "s"."jurusan",
    "d"."saldo",
    "d"."status",
    "d"."low_balance_threshold",
    "d"."locked_reason",
    "d"."created_at" AS "wallet_created_at",
    "d"."updated_at" AS "wallet_updated_at"
   FROM ("public"."dompet_santri" "d"
     JOIN "public"."santri" "s" ON (("s"."nis" = "d"."santri_nis")));


ALTER VIEW "public"."view_admin_wallet_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_kantin_transaction_history" WITH ("security_invoker"='true') AS
 SELECT "td"."id",
    "td"."public_id",
    "td"."created_at",
    "td"."posted_at",
    "td"."santri_nis",
    "s"."nama" AS "santri_nama",
    "s"."kelas" AS "santri_kelas",
    "s"."jurusan" AS "santri_jurusan",
    "td"."direction",
    "td"."category",
    "td"."amount",
    "td"."balance_before",
    "td"."balance_after",
    "td"."status",
    "td"."actor_id" AS "kantin_user_id",
    "p"."full_name" AS "kantin_name",
    "td"."counterparty_id",
    "td"."counterparty_role",
    "td"."payment_intent_id",
    "td"."idempotency_key",
    "td"."entry_hash",
    "td"."keterangan",
    "td"."metadata",
    (NULLIF(("td"."metadata" ->> 'merchant_id'::"text"), ''::"text"))::"uuid" AS "merchant_id",
    (NULLIF(("td"."metadata" ->> 'outlet_id'::"text"), ''::"text"))::"uuid" AS "outlet_id",
    ("td"."metadata" ->> 'kantin_device_id'::"text") AS "kantin_device_id"
   FROM (("public"."transaksi_dompet" "td"
     LEFT JOIN "public"."santri" "s" ON (("s"."nis" = "td"."santri_nis")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "td"."actor_id")))
  WHERE ("td"."category" = 'pembayaran_kantin'::"public"."tipe_kategori_transaksi");


ALTER VIEW "public"."view_kantin_transaction_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "resource" "text" NOT NULL,
    "santri_nis" "text",
    "record_id" "text",
    "request_id" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."wallet_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_authorization_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_public_id" "uuid" NOT NULL,
    "santri_nis" "text" NOT NULL,
    "payment_intent_id" "uuid",
    "kantin_user_id" "uuid",
    "amount" bigint NOT NULL,
    "status" "public"."wallet_intent_status" DEFAULT 'pending'::"public"."wallet_intent_status" NOT NULL,
    "challenge" "text" NOT NULL,
    "nonce" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "approved_by" "uuid",
    "approved_device_id" "text",
    "approved_at" timestamp with time zone,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "merchant_id" "uuid",
    "outlet_id" "uuid",
    "idempotency_key" "text",
    CONSTRAINT "wallet_authorization_sessions_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "wallet_authorization_sessions_failed_attempts_check" CHECK (("failed_attempts" >= 0))
);


ALTER TABLE "public"."wallet_authorization_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_card_qr_versions" (
    "wallet_public_id" "uuid" NOT NULL,
    "santri_nis" "text" NOT NULL,
    "status" "public"."wallet_qr_status" DEFAULT 'active'::"public"."wallet_qr_status" NOT NULL,
    "issued_by" "uuid",
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revoke_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."wallet_card_qr_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_card_tokens" (
    "token_public_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "santri_nis" "text" NOT NULL,
    "wallet_public_id" "uuid" NOT NULL,
    "media" "text" DEFAULT 'qr'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "issued_by" "uuid",
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revoke_reason" "text",
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "wallet_card_tokens_media_check" CHECK (("media" = ANY (ARRAY['qr'::"text", 'nfc'::"text", 'both'::"text"]))),
    CONSTRAINT "wallet_card_tokens_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."wallet_card_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "santri_nis" "text",
    "device_id" "text" NOT NULL,
    "device_name" "text",
    "public_key" "text" NOT NULL,
    "key_algorithm" "text" DEFAULT 'Ed25519'::"text" NOT NULL,
    "status" "public"."wallet_device_status" DEFAULT 'active'::"public"."wallet_device_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone,
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."wallet_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_disputes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ledger_id" bigint NOT NULL,
    "santri_nis" "text" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reason" "text" NOT NULL,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "assigned_to" "uuid",
    "resolved_by" "uuid",
    "resolution_note" "text",
    "reversal_ledger_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "response_due_at" timestamp with time zone DEFAULT ("now"() + '48:00:00'::interval) NOT NULL,
    "escalated_at" timestamp with time zone,
    CONSTRAINT "wallet_disputes_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'investigating'::"text", 'resolved_valid'::"text", 'resolved_reversed'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."wallet_disputes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_key_rotation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "santri_nis" "text" NOT NULL,
    "old_device_id" "uuid",
    "new_device_id" "uuid",
    "reason" "text" NOT NULL,
    "requested_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."wallet_key_rotation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_ledger_integrity_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "santri_nis" "text",
    "checked_from" timestamp with time zone,
    "checked_until" timestamp with time zone,
    "checked_entries" bigint DEFAULT 0 NOT NULL,
    "broken_at" bigint,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "resolution_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    CONSTRAINT "wallet_ledger_integrity_runs_resolution_status_check" CHECK (("resolution_status" = ANY (ARRAY['open'::"text", 'monitoring'::"text", 'resolved'::"text", 'accepted_risk'::"text", 'false_alarm'::"text"]))),
    CONSTRAINT "wallet_ledger_integrity_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."wallet_ledger_integrity_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_merchant_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "outlet_id" "uuid",
    "saldo_available" bigint DEFAULT 0 NOT NULL,
    "saldo_pending_settlement" bigint DEFAULT 0 NOT NULL,
    "total_sales" bigint DEFAULT 0 NOT NULL,
    "total_settled" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_merchant_balances_saldo_available_check" CHECK (("saldo_available" >= 0)),
    CONSTRAINT "wallet_merchant_balances_saldo_pending_settlement_check" CHECK (("saldo_pending_settlement" >= 0)),
    CONSTRAINT "wallet_merchant_balances_total_sales_check" CHECK (("total_sales" >= 0)),
    CONSTRAINT "wallet_merchant_balances_total_settled_check" CHECK (("total_settled" >= 0))
);


ALTER TABLE "public"."wallet_merchant_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_merchant_ledger" (
    "id" bigint NOT NULL,
    "public_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "outlet_id" "uuid",
    "direction" "text" NOT NULL,
    "category" "text" NOT NULL,
    "amount" bigint NOT NULL,
    "balance_available_before" bigint NOT NULL,
    "balance_available_after" bigint NOT NULL,
    "pending_settlement_before" bigint NOT NULL,
    "pending_settlement_after" bigint NOT NULL,
    "santri_ledger_id" bigint,
    "payment_intent_id" "uuid",
    "settlement_request_id" "uuid",
    "idempotency_key" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text" NOT NULL,
    "keterangan" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "wallet_merchant_ledger_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "wallet_merchant_ledger_category_check" CHECK (("category" = ANY (ARRAY['kantin_sale'::"text", 'settlement_request'::"text", 'settlement_paid'::"text", 'settlement_rejected'::"text", 'adjustment'::"text", 'refund'::"text"]))),
    CONSTRAINT "wallet_merchant_ledger_direction_check" CHECK (("direction" = ANY (ARRAY['credit'::"text", 'debit'::"text"])))
);


ALTER TABLE "public"."wallet_merchant_ledger" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."wallet_merchant_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wallet_merchant_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wallet_merchant_ledger_id_seq" OWNED BY "public"."wallet_merchant_ledger"."id";



CREATE TABLE IF NOT EXISTS "public"."wallet_merchant_outlets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_merchant_outlets_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."wallet_merchant_outlets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_merchant_settlement_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "outlet_id" "uuid",
    "requested_by" "uuid" NOT NULL,
    "amount" bigint NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "payout_method" "text" DEFAULT 'pesantren_manual'::"text" NOT NULL,
    "destination_note" "text",
    "requested_ledger_id" bigint,
    "paid_ledger_id" bigint,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "proof_storage_path" "text",
    "proof_uploaded_by" "uuid",
    "proof_uploaded_at" timestamp with time zone,
    "proof_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "wallet_merchant_settlement_requests_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "wallet_merchant_settlement_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'paid'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."wallet_merchant_settlement_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_merchant_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchant_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "outlet_id" "uuid",
    "merchant_role" "text" DEFAULT 'cashier'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_merchant_users_merchant_role_check" CHECK (("merchant_role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'cashier'::"text", 'auditor'::"text"]))),
    CONSTRAINT "wallet_merchant_users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."wallet_merchant_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_merchants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "ownership_model" "text" DEFAULT 'pesantren'::"text" NOT NULL,
    "owner_profile_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "settlement_mode" "text" DEFAULT 'pesantren_account'::"text" NOT NULL,
    "settlement_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_merchants_ownership_model_check" CHECK (("ownership_model" = ANY (ARRAY['pesantren'::"text", 'pengurus'::"text", 'dewan'::"text", 'external'::"text", 'other'::"text"]))),
    CONSTRAINT "wallet_merchants_settlement_mode_check" CHECK (("settlement_mode" = ANY (ARRAY['pesantren_account'::"text", 'merchant_subledger'::"text", 'manual_settlement'::"text"]))),
    CONSTRAINT "wallet_merchants_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'quarantined'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."wallet_merchants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_nonce_uses" (
    "nonce" "text" NOT NULL,
    "santri_nis" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "used_by" "uuid",
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "wallet_nonce_uses_check" CHECK (("expires_at" > "used_at"))
);


ALTER TABLE "public"."wallet_nonce_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_nonces" (
    "santri_nis" "text" NOT NULL,
    "last_nonce" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_nonces_last_nonce_check" CHECK (("last_nonce" >= 0))
);


ALTER TABLE "public"."wallet_nonces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_payment_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "santri_nis" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "public"."wallet_intent_status" DEFAULT 'pending'::"public"."wallet_intent_status" NOT NULL,
    "amount" bigint NOT NULL,
    "created_by" "uuid",
    "created_by_role" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "approved_at" timestamp with time zone,
    "posted_ledger_id" bigint,
    "midtrans_order_id" "text",
    "midtrans_snap_token" "text",
    "provider_payload" "jsonb",
    "idempotency_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "merchant_id" "uuid",
    "outlet_id" "uuid",
    CONSTRAINT "wallet_payment_intents_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "wallet_payment_intents_type_check" CHECK (("type" = ANY (ARRAY['midtrans_topup'::"text", 'kantin_payment'::"text", 'admin_correction'::"text", 'refund'::"text", 'account_migration'::"text", 'settlement'::"text"])))
);


ALTER TABLE "public"."wallet_payment_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_pin_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "santri_nis" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "device_id" "text",
    "attempt_status" "text" DEFAULT 'failed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "wallet_pin_attempts_status_check" CHECK (("attempt_status" = ANY (ARRAY['failed'::"text", 'success'::"text", 'locked'::"text"])))
);


ALTER TABLE "public"."wallet_pin_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_reconciliation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "ledger_net" bigint DEFAULT 0 NOT NULL,
    "cached_balance_total" bigint DEFAULT 0 NOT NULL,
    "reserved_bank_balance" bigint,
    "difference_internal" bigint DEFAULT 0 NOT NULL,
    "difference_bank" bigint,
    "freeze_triggered" boolean DEFAULT false NOT NULL,
    "triggered_by" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "resolution_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    "santri_balance_total" bigint,
    "merchant_available_total" bigint,
    "merchant_pending_settlement_total" bigint,
    "merchant_liability_total" bigint,
    "merchant_sales_total" bigint,
    "merchant_settled_total" bigint,
    "merchant_pending_request_total" bigint,
    "wallet_topup_midtrans_total" bigint,
    "spp_paid_total" bigint,
    "spp_outstanding_total" bigint,
    "expected_internal_liability" bigint,
    "difference_liability_vs_bank" bigint,
    CONSTRAINT "wallet_reconciliation_runs_resolution_status_check" CHECK (("resolution_status" = ANY (ARRAY['open'::"text", 'monitoring'::"text", 'resolved'::"text", 'accepted_risk'::"text", 'false_alarm'::"text"]))),
    CONSTRAINT "wallet_reconciliation_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'settlement_mismatch'::"text"])))
);


ALTER TABLE "public"."wallet_reconciliation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_risk_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "severity" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "santri_nis" "text",
    "actor_id" "uuid",
    "device_id" "text",
    "merchant_id" "uuid",
    "outlet_id" "uuid",
    "rule_code" "text" NOT NULL,
    "score" numeric DEFAULT 0 NOT NULL,
    "action" "text" DEFAULT 'flag'::"text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "response_due_at" timestamp with time zone,
    "auto_action_at" timestamp with time zone,
    "escalated_at" timestamp with time zone,
    CONSTRAINT "wallet_risk_events_action_check" CHECK (("action" = ANY (ARRAY['flag'::"text", 'require_parent_approval'::"text", 'block'::"text", 'freeze_wallet'::"text", 'freeze_system'::"text"]))),
    CONSTRAINT "wallet_risk_events_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "wallet_risk_events_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'acknowledged'::"text", 'investigating'::"text", 'escalated'::"text", 'resolved'::"text", 'false_positive'::"text"])))
);


ALTER TABLE "public"."wallet_risk_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_security_ai_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audit_run_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "provider" "text" DEFAULT 'gemini'::"text" NOT NULL,
    "model" "text",
    "triggered_by" "uuid",
    "triggered_by_role" "text",
    "executive_summary" "text",
    "critical_findings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "early_warning_signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "recommended_actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "production_blockers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "android_specific_risks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "database_specific_risks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "consistency_notes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "confidence" "text" DEFAULT 'medium'::"text" NOT NULL,
    "do_not_proceed_reason" "text",
    "sanitized_input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_response" "text",
    "error_message" "text",
    "latency_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_security_ai_analyses_confidence_check" CHECK (("confidence" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "wallet_security_ai_analyses_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."wallet_security_ai_analyses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_security_audit_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "severity" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "triggered_by" "uuid",
    "triggered_by_role" "text",
    "layer_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "checks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "findings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "recommendations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ai_summary" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "wallet_security_audit_runs_severity_check" CHECK (("severity" = ANY (ARRAY['unknown'::"text", 'aman'::"text", 'perlu_perhatian'::"text", 'berisiko'::"text", 'kritis'::"text"]))),
    CONSTRAINT "wallet_security_audit_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'warning'::"text", 'critical'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."wallet_security_audit_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_system_controls" (
    "key" "text" NOT NULL,
    "is_frozen" boolean DEFAULT false NOT NULL,
    "freeze_reason" "text",
    "frozen_at" timestamp with time zone,
    "frozen_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "wallet_system_controls_key_check" CHECK (("key" = 'wallet_transactions'::"text"))
);


ALTER TABLE "public"."wallet_system_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_weekly_digest_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "generated_count" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "wallet_weekly_digest_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."wallet_weekly_digest_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "judul" "text" NOT NULL,
    "minggu_ke" integer NOT NULL,
    "tahun_ajaran" "text" NOT NULL,
    "tanggal_pelaksanaan" "date",
    "durasi_menit" integer DEFAULT 60,
    "mode_pengerjaan" "text",
    "jumlah_kelompok" integer,
    "catatan_pengurus" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "pdf_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "exported_at" timestamp with time zone,
    CONSTRAINT "weekly_tests_mode_pengerjaan_check" CHECK (("mode_pengerjaan" = ANY (ARRAY['individu'::"text", 'kelompok'::"text", 'campuran'::"text"]))),
    CONSTRAINT "weekly_tests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'final'::"text", 'selesai'::"text"])))
);


ALTER TABLE "public"."weekly_tests" OWNER TO "postgres";


ALTER TABLE ONLY "public"."config_diklat" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."config_diklat_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."geocode_cache" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."geocode_cache_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."geocode_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."geocode_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."master_kitab" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."master_kitab_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wallet_merchant_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wallet_merchant_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alumni_data"
    ADD CONSTRAINT "alumni_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alumni_follows"
    ADD CONSTRAINT "alumni_follows_pkey" PRIMARY KEY ("follower_id", "following_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."berita"
    ADD CONSTRAINT "berita_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."berita"
    ADD CONSTRAINT "berita_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."chat_blocks"
    ADD CONSTRAINT "chat_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_device_keys"
    ADD CONSTRAINT "chat_device_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_device_keys"
    ADD CONSTRAINT "chat_device_keys_user_id_device_id_key" UNIQUE ("user_id", "device_id");



ALTER TABLE ONLY "public"."chat_key_backups"
    ADD CONSTRAINT "chat_key_backups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_key_backups"
    ADD CONSTRAINT "chat_key_backups_user_id_device_id_key" UNIQUE ("user_id", "device_id");



ALTER TABLE ONLY "public"."chat_message_device_ciphertexts"
    ADD CONSTRAINT "chat_message_device_ciphertex_message_id_recipient_user_id__key" UNIQUE ("message_id", "recipient_user_id", "recipient_device_id");



ALTER TABLE ONLY "public"."chat_message_device_ciphertexts"
    ADD CONSTRAINT "chat_message_device_ciphertexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_message_reports"
    ADD CONSTRAINT "chat_message_reports_message_id_reporter_id_key" UNIQUE ("message_id", "reporter_id");



ALTER TABLE ONLY "public"."chat_message_reports"
    ADD CONSTRAINT "chat_message_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."chat_user_presence"
    ADD CONSTRAINT "chat_user_presence_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."config_diklat"
    ADD CONSTRAINT "config_diklat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crypto_keystores"
    ADD CONSTRAINT "crypto_keystores_pkey" PRIMARY KEY ("santri_nis");



ALTER TABLE ONLY "public"."detail_transaksi"
    ADD CONSTRAINT "detail_transaksi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dompet_santri"
    ADD CONSTRAINT "dompet_santri_pkey" PRIMARY KEY ("santri_nis");



ALTER TABLE ONLY "public"."dompet_santri"
    ADD CONSTRAINT "dompet_santri_wallet_public_id_key" UNIQUE ("wallet_public_id");



ALTER TABLE ONLY "public"."forum_attachments"
    ADD CONSTRAINT "forum_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_attachments"
    ADD CONSTRAINT "forum_attachments_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_moderation_actions"
    ADD CONSTRAINT "forum_moderation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_reactions"
    ADD CONSTRAINT "forum_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_reports"
    ADD CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_threads"
    ADD CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."geocode_cache"
    ADD CONSTRAINT "geocode_cache_normalized_address_key" UNIQUE ("normalized_address");



ALTER TABLE ONLY "public"."geocode_cache"
    ADD CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."geocode_jobs"
    ADD CONSTRAINT "geocode_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hafalan_kitab"
    ADD CONSTRAINT "hafalan_kitab_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hafalan_tahfidz"
    ADD CONSTRAINT "hafalan_tahfidz_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."info_rekening_santri"
    ADD CONSTRAINT "info_rekening_santri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instansi_info"
    ADD CONSTRAINT "instansi_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventaris"
    ADD CONSTRAINT "inventaris_kode_barang_key" UNIQUE ("kode_barang");



ALTER TABLE ONLY "public"."inventaris"
    ADD CONSTRAINT "inventaris_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kantin_devices"
    ADD CONSTRAINT "kantin_devices_device_id_key" UNIQUE ("device_id");



ALTER TABLE ONLY "public"."kantin_devices"
    ADD CONSTRAINT "kantin_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kantin_devices"
    ADD CONSTRAINT "kantin_devices_user_device_unique" UNIQUE ("kantin_user_id", "device_id");



ALTER TABLE ONLY "public"."kategori_barang"
    ADD CONSTRAINT "kategori_barang_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kecamatan_polygons"
    ADD CONSTRAINT "kecamatan_polygons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kesehatan_santri"
    ADD CONSTRAINT "kesehatan_santri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_aktivitas"
    ADD CONSTRAINT "log_aktivitas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lokasi_aset"
    ADD CONSTRAINT "lokasi_aset_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_kitab"
    ADD CONSTRAINT "master_kitab_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mata_pelajaran"
    ADD CONSTRAINT "mata_pelajaran_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."midtrans_webhook_logs"
    ADD CONSTRAINT "midtrans_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."murojaah_tahfidz"
    ADD CONSTRAINT "murojaah_tahfidz_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nilai_santri"
    ADD CONSTRAINT "nilai_santri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_queue"
    ADD CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pelanggaran_santri"
    ADD CONSTRAINT "pelanggaran_santri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pengeluaran"
    ADD CONSTRAINT "pengeluaran_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perizinan_santri"
    ADD CONSTRAINT "perizinan_santri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."peserta_diklat"
    ADD CONSTRAINT "peserta_diklat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prestasi_santri"
    ADD CONSTRAINT "prestasi_santri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_telegram_id_key" UNIQUE ("telegram_id");



ALTER TABLE ONLY "public"."question_bank"
    ADD CONSTRAINT "question_bank_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rag_document_chunks"
    ADD CONSTRAINT "rag_document_chunks_document_id_chunk_index_key" UNIQUE ("document_id", "chunk_index");



ALTER TABLE ONLY "public"."rag_document_chunks"
    ADD CONSTRAINT "rag_document_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rag_documents"
    ADD CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rag_query_logs"
    ADD CONSTRAINT "rag_query_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rag_rate_limits"
    ADD CONSTRAINT "rag_rate_limits_bucket_key_window_start_key" UNIQUE ("bucket_key", "window_start");



ALTER TABLE ONLY "public"."rag_rate_limits"
    ADD CONSTRAINT "rag_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_jenis_pembayaran"
    ADD CONSTRAINT "ref_jenis_pembayaran_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."santri"
    ADD CONSTRAINT "santri_pkey" PRIMARY KEY ("nis");



ALTER TABLE ONLY "public"."struktur_organisasi"
    ADD CONSTRAINT "struktur_organisasi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tagihan_santri"
    ADD CONSTRAINT "tagihan_santri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_test_id_question_id_key" UNIQUE ("test_id", "question_id");



ALTER TABLE ONLY "public"."test_submissions"
    ADD CONSTRAINT "test_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_entry_hash_key" UNIQUE ("entry_hash");



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."transaksi_keuangan"
    ADD CONSTRAINT "transaksi_keuangan_midtrans_order_id_key" UNIQUE ("midtrans_order_id");



ALTER TABLE ONLY "public"."transaksi_keuangan"
    ADD CONSTRAINT "transaksi_keuangan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaksi_keuangan"
    ADD CONSTRAINT "unique_midtrans_order_id" UNIQUE ("midtrans_order_id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fcm_token_key" UNIQUE ("user_id", "fcm_token");



ALTER TABLE ONLY "public"."wallet_audit_logs"
    ADD CONSTRAINT "wallet_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_challenge_key" UNIQUE ("challenge");



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_card_qr_versions"
    ADD CONSTRAINT "wallet_card_qr_versions_pkey" PRIMARY KEY ("wallet_public_id");



ALTER TABLE ONLY "public"."wallet_card_tokens"
    ADD CONSTRAINT "wallet_card_tokens_pkey" PRIMARY KEY ("token_public_id");



ALTER TABLE ONLY "public"."wallet_devices"
    ADD CONSTRAINT "wallet_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_devices"
    ADD CONSTRAINT "wallet_devices_profile_id_device_id_key" UNIQUE ("profile_id", "device_id");



ALTER TABLE ONLY "public"."wallet_disputes"
    ADD CONSTRAINT "wallet_disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_key_rotation_logs"
    ADD CONSTRAINT "wallet_key_rotation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_ledger_integrity_runs"
    ADD CONSTRAINT "wallet_ledger_integrity_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_merchant_balances"
    ADD CONSTRAINT "wallet_merchant_balances_merchant_id_outlet_id_key" UNIQUE ("merchant_id", "outlet_id");



ALTER TABLE ONLY "public"."wallet_merchant_balances"
    ADD CONSTRAINT "wallet_merchant_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_merchant_ledger"
    ADD CONSTRAINT "wallet_merchant_ledger_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."wallet_merchant_ledger"
    ADD CONSTRAINT "wallet_merchant_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_merchant_outlets"
    ADD CONSTRAINT "wallet_merchant_outlets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_merchant_settlement_requests"
    ADD CONSTRAINT "wallet_merchant_settlement_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_merchant_users"
    ADD CONSTRAINT "wallet_merchant_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_merchants"
    ADD CONSTRAINT "wallet_merchants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_nonce_uses"
    ADD CONSTRAINT "wallet_nonce_uses_pkey" PRIMARY KEY ("nonce");



ALTER TABLE ONLY "public"."wallet_nonces"
    ADD CONSTRAINT "wallet_nonces_pkey" PRIMARY KEY ("santri_nis");



ALTER TABLE ONLY "public"."wallet_payment_intents"
    ADD CONSTRAINT "wallet_payment_intents_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."wallet_payment_intents"
    ADD CONSTRAINT "wallet_payment_intents_midtrans_order_id_key" UNIQUE ("midtrans_order_id");



ALTER TABLE ONLY "public"."wallet_payment_intents"
    ADD CONSTRAINT "wallet_payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_pin_attempts"
    ADD CONSTRAINT "wallet_pin_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_reconciliation_runs"
    ADD CONSTRAINT "wallet_reconciliation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_risk_events"
    ADD CONSTRAINT "wallet_risk_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_security_ai_analyses"
    ADD CONSTRAINT "wallet_security_ai_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_security_audit_runs"
    ADD CONSTRAINT "wallet_security_audit_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_system_controls"
    ADD CONSTRAINT "wallet_system_controls_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."wallet_weekly_digest_runs"
    ADD CONSTRAINT "wallet_weekly_digest_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_tests"
    ADD CONSTRAINT "weekly_tests_pkey" PRIMARY KEY ("id");



CREATE INDEX "forum_attachments_comment_idx" ON "public"."forum_attachments" USING "btree" ("comment_id") WHERE ("comment_id" IS NOT NULL);



CREATE INDEX "forum_attachments_thread_idx" ON "public"."forum_attachments" USING "btree" ("thread_id") WHERE ("thread_id" IS NOT NULL);



CREATE INDEX "forum_attachments_uploader_idx" ON "public"."forum_attachments" USING "btree" ("uploader_id", "created_at" DESC);



CREATE INDEX "forum_comments_author_idx" ON "public"."forum_comments" USING "btree" ("author_id", "created_at" DESC);



CREATE INDEX "forum_comments_parent_idx" ON "public"."forum_comments" USING "btree" ("parent_comment_id") WHERE ("parent_comment_id" IS NOT NULL);



CREATE INDEX "forum_comments_thread_idx" ON "public"."forum_comments" USING "btree" ("thread_id", "created_at") WHERE (("status" = 'published'::"text") AND ("deleted_at" IS NULL));



CREATE INDEX "forum_moderation_actions_comment_idx" ON "public"."forum_moderation_actions" USING "btree" ("comment_id") WHERE ("comment_id" IS NOT NULL);



CREATE INDEX "forum_moderation_actions_moderator_idx" ON "public"."forum_moderation_actions" USING "btree" ("moderator_id", "created_at" DESC);



CREATE INDEX "forum_moderation_actions_report_idx" ON "public"."forum_moderation_actions" USING "btree" ("report_id") WHERE ("report_id" IS NOT NULL);



CREATE INDEX "forum_moderation_actions_thread_idx" ON "public"."forum_moderation_actions" USING "btree" ("thread_id") WHERE ("thread_id" IS NOT NULL);



CREATE INDEX "forum_reactions_comment_idx" ON "public"."forum_reactions" USING "btree" ("comment_id") WHERE ("comment_id" IS NOT NULL);



CREATE UNIQUE INDEX "forum_reactions_comment_unique" ON "public"."forum_reactions" USING "btree" ("user_id", "comment_id", "reaction_type") WHERE ("comment_id" IS NOT NULL);



CREATE INDEX "forum_reactions_thread_idx" ON "public"."forum_reactions" USING "btree" ("thread_id") WHERE ("thread_id" IS NOT NULL);



CREATE UNIQUE INDEX "forum_reactions_thread_unique" ON "public"."forum_reactions" USING "btree" ("user_id", "thread_id", "reaction_type") WHERE ("thread_id" IS NOT NULL);



CREATE INDEX "forum_reports_comment_idx" ON "public"."forum_reports" USING "btree" ("comment_id") WHERE ("comment_id" IS NOT NULL);



CREATE UNIQUE INDEX "forum_reports_comment_unique_open" ON "public"."forum_reports" USING "btree" ("reporter_id", "comment_id") WHERE (("comment_id" IS NOT NULL) AND ("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text"])));



CREATE INDEX "forum_reports_reviewed_by_idx" ON "public"."forum_reports" USING "btree" ("reviewed_by") WHERE ("reviewed_by" IS NOT NULL);



CREATE INDEX "forum_reports_status_idx" ON "public"."forum_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "forum_reports_thread_idx" ON "public"."forum_reports" USING "btree" ("thread_id") WHERE ("thread_id" IS NOT NULL);



CREATE UNIQUE INDEX "forum_reports_thread_unique_open" ON "public"."forum_reports" USING "btree" ("reporter_id", "thread_id") WHERE (("thread_id" IS NOT NULL) AND ("status" = ANY (ARRAY['open'::"text", 'reviewing'::"text"])));



CREATE INDEX "forum_threads_author_idx" ON "public"."forum_threads" USING "btree" ("author_id", "created_at" DESC);



CREATE INDEX "forum_threads_feed_idx" ON "public"."forum_threads" USING "btree" ("is_pinned" DESC, "created_at" DESC) WHERE (("status" = 'published'::"text") AND ("deleted_at" IS NULL));



CREATE INDEX "idx_alumni_data_district_code" ON "public"."alumni_data" USING "btree" ("district_code") WHERE ("district_code" IS NOT NULL);



CREATE INDEX "idx_alumni_data_profesi_lower" ON "public"."alumni_data" USING "btree" ("lower"("profesi_sekarang")) WHERE ("profesi_sekarang" IS NOT NULL);



CREATE INDEX "idx_alumni_data_province_code" ON "public"."alumni_data" USING "btree" ("province_code") WHERE ("province_code" IS NOT NULL);



CREATE INDEX "idx_alumni_data_regency_code" ON "public"."alumni_data" USING "btree" ("regency_code") WHERE ("regency_code" IS NOT NULL);



CREATE INDEX "idx_alumni_follows_follower_created_at" ON "public"."alumni_follows" USING "btree" ("follower_id", "created_at" DESC);



CREATE INDEX "idx_alumni_follows_following_created_at" ON "public"."alumni_follows" USING "btree" ("following_id", "created_at" DESC);



CREATE INDEX "idx_alumni_follows_following_id" ON "public"."alumni_follows" USING "btree" ("following_id");



CREATE INDEX "idx_alumni_nama" ON "public"."alumni_data" USING "btree" ("full_name");



CREATE INDEX "idx_alumni_tahun_lulus" ON "public"."alumni_data" USING "btree" ("tahun_lulus");



CREATE INDEX "idx_berita_kategori" ON "public"."berita" USING "btree" ("kategori");



CREATE INDEX "idx_berita_slug" ON "public"."berita" USING "btree" ("slug");



CREATE INDEX "idx_berita_status_tanggal" ON "public"."berita" USING "btree" ("status", "tanggal_publish" DESC);



CREATE INDEX "idx_chat_blocks_blocked_id" ON "public"."chat_blocks" USING "btree" ("blocked_id");



CREATE INDEX "idx_chat_ciphertexts_conversation" ON "public"."chat_message_device_ciphertexts" USING "btree" ("conversation_id");



CREATE INDEX "idx_chat_ciphertexts_message" ON "public"."chat_message_device_ciphertexts" USING "btree" ("message_id");



CREATE INDEX "idx_chat_ciphertexts_recipient" ON "public"."chat_message_device_ciphertexts" USING "btree" ("recipient_user_id", "recipient_device_id");



CREATE INDEX "idx_chat_conversations_created_by" ON "public"."chat_conversations" USING "btree" ("created_by");



CREATE INDEX "idx_chat_conversations_last_message_sender_id" ON "public"."chat_conversations" USING "btree" ("last_message_sender_id") WHERE ("last_message_sender_id" IS NOT NULL);



CREATE INDEX "idx_chat_conversations_updated_at" ON "public"."chat_conversations" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_chat_device_keys_user_active" ON "public"."chat_device_keys" USING "btree" ("user_id", "revoked_at");



CREATE INDEX "idx_chat_key_backups_user" ON "public"."chat_key_backups" USING "btree" ("user_id");



CREATE INDEX "idx_chat_key_backups_user_updated" ON "public"."chat_key_backups" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_chat_message_reports_conversation" ON "public"."chat_message_reports" USING "btree" ("conversation_id");



CREATE INDEX "idx_chat_message_reports_reporter_id" ON "public"."chat_message_reports" USING "btree" ("reporter_id");



CREATE INDEX "idx_chat_message_reports_reviewed_by" ON "public"."chat_message_reports" USING "btree" ("reviewed_by") WHERE ("reviewed_by" IS NOT NULL);



CREATE INDEX "idx_chat_message_reports_status_created" ON "public"."chat_message_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_chat_messages_conversation_created" ON "public"."chat_messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_chat_messages_reply_to_message_id" ON "public"."chat_messages" USING "btree" ("reply_to_message_id") WHERE ("reply_to_message_id" IS NOT NULL);



CREATE INDEX "idx_chat_messages_sender" ON "public"."chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_chat_participants_user_id" ON "public"."chat_participants" USING "btree" ("user_id", "archived_at");



CREATE INDEX "idx_detail_transaksi_ids" ON "public"."detail_transaksi" USING "btree" ("transaksi_id", "tagihan_id");



CREATE INDEX "idx_diklat_jenis" ON "public"."peserta_diklat" USING "btree" ("jenis_diklat");



CREATE INDEX "idx_diklat_tahun" ON "public"."peserta_diklat" USING "btree" ("tahun_diklat");



CREATE INDEX "idx_dompet_santri_limits_updated_by" ON "public"."dompet_santri" USING "btree" ("limits_updated_by") WHERE ("limits_updated_by" IS NOT NULL);



CREATE INDEX "idx_dompet_santri_student_pin_set" ON "public"."dompet_santri" USING "btree" ("santri_nis") WHERE ("student_pin_verifier" IS NOT NULL);



CREATE INDEX "idx_dompet_status" ON "public"."dompet_santri" USING "btree" ("status");



CREATE INDEX "idx_dompet_wallet_public_id" ON "public"."dompet_santri" USING "btree" ("wallet_public_id");



CREATE INDEX "idx_forum_threads_repost_of_thread_id" ON "public"."forum_threads" USING "btree" ("repost_of_thread_id");



CREATE INDEX "idx_geocode_cache_address" ON "public"."geocode_cache" USING "btree" ("normalized_address");



CREATE INDEX "idx_geocode_jobs_status" ON "public"."geocode_jobs" USING "btree" ("status");



CREATE INDEX "idx_hafalan_kitab_santri" ON "public"."hafalan_kitab" USING "btree" ("santri_nis");



CREATE INDEX "idx_hafalan_kitab_tanggal" ON "public"."hafalan_kitab" USING "btree" ("tanggal");



CREATE INDEX "idx_inventaris_kode" ON "public"."inventaris" USING "btree" ("kode_barang");



CREATE INDEX "idx_inventaris_nama" ON "public"."inventaris" USING "btree" ("nama_barang");



CREATE INDEX "idx_kantin_devices_approved_by" ON "public"."kantin_devices" USING "btree" ("approved_by") WHERE ("approved_by" IS NOT NULL);



CREATE INDEX "idx_kantin_devices_kantin_user" ON "public"."kantin_devices" USING "btree" ("kantin_user_id", "status");



CREATE INDEX "idx_kantin_devices_registered_by" ON "public"."kantin_devices" USING "btree" ("registered_by") WHERE ("registered_by" IS NOT NULL);



CREATE INDEX "idx_kantin_devices_revoked_by" ON "public"."kantin_devices" USING "btree" ("revoked_by") WHERE ("revoked_by" IS NOT NULL);



CREATE INDEX "idx_kantin_devices_status" ON "public"."kantin_devices" USING "btree" ("status", "registered_at" DESC);



CREATE INDEX "idx_kecamatan_polygons_geom" ON "public"."kecamatan_polygons" USING "gist" ("geom");



CREATE INDEX "idx_kecamatan_polygons_nama" ON "public"."kecamatan_polygons" USING "btree" ("nama");



CREATE INDEX "idx_murojaah_jenis" ON "public"."murojaah_tahfidz" USING "btree" ("jenis_murojaah");



CREATE INDEX "idx_murojaah_santri_tanggal" ON "public"."murojaah_tahfidz" USING "btree" ("santri_nis", "tanggal" DESC);



CREATE INDEX "idx_murojaah_tanggal" ON "public"."murojaah_tahfidz" USING "btree" ("tanggal" DESC);



CREATE INDEX "idx_nilai_periode" ON "public"."nilai_santri" USING "btree" ("tahun_ajaran", "semester");



CREATE INDEX "idx_nilai_santri_nis" ON "public"."nilai_santri" USING "btree" ("santri_nis");



CREATE INDEX "idx_notification_queue_event_type" ON "public"."notification_queue" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_notification_queue_status_scheduled" ON "public"."notification_queue" USING "btree" ("status", "scheduled_at", "created_at");



CREATE INDEX "idx_notification_queue_user_created" ON "public"."notification_queue" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notification_queue_wallet_review" ON "public"."notification_queue" USING "btree" ("wallet_review_status", "priority", "status", "created_at" DESC) WHERE ((COALESCE("source_table", ''::"text") ~~ 'wallet%'::"text") OR (COALESCE("event_type", ''::"text") ~~ 'wallet.%'::"text") OR (COALESCE("event_type", ''::"text") ~~ 'dompet.%'::"text"));



CREATE INDEX "idx_pengeluaran_kategori" ON "public"."pengeluaran" USING "btree" ("kategori");



CREATE INDEX "idx_pengeluaran_tanggal" ON "public"."pengeluaran" USING "btree" ("tanggal_pengeluaran");



CREATE INDEX "idx_prestasi_dicatat_oleh" ON "public"."prestasi_santri" USING "btree" ("dicatat_oleh_id");



CREATE INDEX "idx_prestasi_santri_nis" ON "public"."prestasi_santri" USING "btree" ("santri_nis");



CREATE INDEX "idx_profiles_telegram_id" ON "public"."profiles" USING "btree" ("telegram_id");



CREATE INDEX "idx_santri_emis_status" ON "public"."santri" USING "btree" ("status_santri", "tahun_masuk", "kelas", "jurusan");



CREATE INDEX "idx_santri_geom" ON "public"."santri" USING "gist" ("geom");



CREATE INDEX "idx_santri_kecamatan" ON "public"."santri" USING "btree" ("kecamatan_id");



CREATE INDEX "idx_santri_lat" ON "public"."santri" USING "btree" ("latitude");



CREATE INDEX "idx_santri_lon" ON "public"."santri" USING "btree" ("longitude");



CREATE INDEX "idx_santri_nik_hash" ON "public"."santri" USING "btree" ("nik_hash");



CREATE INDEX "idx_santri_nis_hash" ON "public"."santri" USING "btree" ("nis_hash");



CREATE INDEX "idx_santri_nisn_hash" ON "public"."santri" USING "btree" ("nisn_hash");



CREATE INDEX "idx_santri_region" ON "public"."santri" USING "btree" ("provinsi", "kabupaten_kota", "kecamatan_id");



CREATE INDEX "idx_santri_wali_id" ON "public"."santri" USING "btree" ("wali_id");



CREATE INDEX "idx_tagihan_santri_nis" ON "public"."tagihan_santri" USING "btree" ("santri_nis");



CREATE INDEX "idx_transaksi_dompet_actor_created" ON "public"."transaksi_dompet" USING "btree" ("actor_id", "created_at" DESC);



CREATE INDEX "idx_transaksi_dompet_counterparty_id" ON "public"."transaksi_dompet" USING "btree" ("counterparty_id") WHERE ("counterparty_id" IS NOT NULL);



CREATE INDEX "idx_transaksi_dompet_dicatat_oleh_id" ON "public"."transaksi_dompet" USING "btree" ("dicatat_oleh_id") WHERE ("dicatat_oleh_id" IS NOT NULL);



CREATE INDEX "idx_transaksi_dompet_payment_intent" ON "public"."transaksi_dompet" USING "btree" ("payment_intent_id");



CREATE INDEX "idx_transaksi_dompet_santri_created" ON "public"."transaksi_dompet" USING "btree" ("santri_nis", "created_at" DESC);



CREATE INDEX "idx_transaksi_dompet_transaksi_keuangan_id" ON "public"."transaksi_dompet" USING "btree" ("transaksi_keuangan_id") WHERE ("transaksi_keuangan_id" IS NOT NULL);



CREATE INDEX "idx_transaksi_order_id" ON "public"."transaksi_keuangan" USING "btree" ("midtrans_order_id");



CREATE UNIQUE INDEX "idx_user_devices_active_fcm_token_unique" ON "public"."user_devices" USING "btree" ("fcm_token") WHERE "is_active";



CREATE INDEX "idx_user_devices_active_user" ON "public"."user_devices" USING "btree" ("user_id", "is_active", COALESCE("last_seen_at", "last_seen") DESC);



CREATE INDEX "idx_wallet_audit_actor_created" ON "public"."wallet_audit_logs" USING "btree" ("actor_id", "created_at" DESC);



CREATE INDEX "idx_wallet_audit_santri_created" ON "public"."wallet_audit_logs" USING "btree" ("santri_nis", "created_at" DESC);



CREATE INDEX "idx_wallet_auth_kantin_status" ON "public"."wallet_authorization_sessions" USING "btree" ("kantin_user_id", "status", "expires_at");



CREATE INDEX "idx_wallet_auth_santri_status" ON "public"."wallet_authorization_sessions" USING "btree" ("santri_nis", "status", "expires_at");



CREATE INDEX "idx_wallet_authorization_sessions_merchant" ON "public"."wallet_authorization_sessions" USING "btree" ("merchant_id", "outlet_id");



CREATE INDEX "idx_wallet_card_tokens_santri_status" ON "public"."wallet_card_tokens" USING "btree" ("santri_nis", "status");



CREATE INDEX "idx_wallet_card_tokens_wallet_status" ON "public"."wallet_card_tokens" USING "btree" ("wallet_public_id", "status");



CREATE INDEX "idx_wallet_devices_profile_status" ON "public"."wallet_devices" USING "btree" ("profile_id", "status");



CREATE INDEX "idx_wallet_devices_santri_status" ON "public"."wallet_devices" USING "btree" ("santri_nis", "status");



CREATE UNIQUE INDEX "idx_wallet_disputes_open_ledger" ON "public"."wallet_disputes" USING "btree" ("ledger_id") WHERE ("status" = ANY (ARRAY['open'::"text", 'investigating'::"text"]));



CREATE INDEX "idx_wallet_disputes_santri" ON "public"."wallet_disputes" USING "btree" ("santri_nis", "created_at" DESC);



CREATE INDEX "idx_wallet_disputes_status" ON "public"."wallet_disputes" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_wallet_intents_creator" ON "public"."wallet_payment_intents" USING "btree" ("created_by", "created_at" DESC);



CREATE INDEX "idx_wallet_intents_santri_status" ON "public"."wallet_payment_intents" USING "btree" ("santri_nis", "status", "created_at" DESC);



CREATE INDEX "idx_wallet_ledger_integrity_runs_santri" ON "public"."wallet_ledger_integrity_runs" USING "btree" ("santri_nis", "started_at" DESC);



CREATE INDEX "idx_wallet_ledger_integrity_runs_started" ON "public"."wallet_ledger_integrity_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_wallet_merchant_ledger_merchant_created" ON "public"."wallet_merchant_ledger" USING "btree" ("merchant_id", "outlet_id", "created_at" DESC);



CREATE INDEX "idx_wallet_merchant_outlets_merchant" ON "public"."wallet_merchant_outlets" USING "btree" ("merchant_id");



CREATE INDEX "idx_wallet_merchant_settlement_status" ON "public"."wallet_merchant_settlement_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_wallet_merchant_users_profile" ON "public"."wallet_merchant_users" USING "btree" ("profile_id");



CREATE INDEX "idx_wallet_merchants_owner" ON "public"."wallet_merchants" USING "btree" ("owner_profile_id");



CREATE INDEX "idx_wallet_nonce_uses_santri_used" ON "public"."wallet_nonce_uses" USING "btree" ("santri_nis", "used_at" DESC);



CREATE INDEX "idx_wallet_payment_intents_merchant" ON "public"."wallet_payment_intents" USING "btree" ("merchant_id", "outlet_id");



CREATE INDEX "idx_wallet_pin_attempts_santri_time" ON "public"."wallet_pin_attempts" USING "btree" ("santri_nis", "created_at" DESC);



CREATE INDEX "idx_wallet_qr_santri_status" ON "public"."wallet_card_qr_versions" USING "btree" ("santri_nis", "status");



CREATE INDEX "idx_wallet_reconciliation_runs_started_at" ON "public"."wallet_reconciliation_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_wallet_risk_events_device" ON "public"."wallet_risk_events" USING "btree" ("device_id", "created_at" DESC);



CREATE INDEX "idx_wallet_risk_events_open" ON "public"."wallet_risk_events" USING "btree" ("status", "severity", "created_at" DESC);



CREATE INDEX "idx_wallet_risk_events_santri" ON "public"."wallet_risk_events" USING "btree" ("santri_nis", "created_at" DESC);



CREATE INDEX "idx_wallet_security_ai_analyses_audit_run_id" ON "public"."wallet_security_ai_analyses" USING "btree" ("audit_run_id", "created_at" DESC);



CREATE INDEX "idx_wallet_security_ai_analyses_created_at" ON "public"."wallet_security_ai_analyses" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_wallet_security_audit_runs_started_at" ON "public"."wallet_security_audit_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_wallet_security_audit_runs_status" ON "public"."wallet_security_audit_runs" USING "btree" ("status", "severity", "started_at" DESC);



CREATE INDEX "idx_wallet_security_audit_runs_triggered_by" ON "public"."wallet_security_audit_runs" USING "btree" ("triggered_by", "started_at" DESC) WHERE ("triggered_by" IS NOT NULL);



CREATE INDEX "rag_document_chunks_document_idx" ON "public"."rag_document_chunks" USING "btree" ("document_id", "chunk_index");



CREATE INDEX "rag_document_chunks_embedding_hnsw_idx" ON "public"."rag_document_chunks" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64') WHERE ("embedding" IS NOT NULL);



CREATE INDEX "rag_document_chunks_metadata_gin_idx" ON "public"."rag_document_chunks" USING "gin" ("metadata");



CREATE INDEX "rag_documents_metadata_gin_idx" ON "public"."rag_documents" USING "gin" ("metadata");



CREATE INDEX "rag_documents_source_status_idx" ON "public"."rag_documents" USING "btree" ("source_type", "status", "created_at" DESC);



CREATE INDEX "rag_query_logs_context_idx" ON "public"."rag_query_logs" USING "btree" ("context_type", "source_type", "created_at" DESC);



CREATE INDEX "rag_query_logs_created_idx" ON "public"."rag_query_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "rag_rate_limits_window_idx" ON "public"."rag_rate_limits" USING "btree" ("window_start" DESC);



CREATE UNIQUE INDEX "wallet_merchant_users_unique_assignment" ON "public"."wallet_merchant_users" USING "btree" ("merchant_id", "profile_id", COALESCE("outlet_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE OR REPLACE TRIGGER "audit_transaksi_keuangan" AFTER INSERT OR DELETE OR UPDATE ON "public"."transaksi_keuangan" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "enqueue_chat_message_notification" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "app_private"."enqueue_chat_message_notification"();



CREATE OR REPLACE TRIGGER "enqueue_forum_comment_notification" AFTER INSERT ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."enqueue_forum_comment_notification"();



CREATE OR REPLACE TRIGGER "enqueue_forum_reaction_notification" AFTER INSERT ON "public"."forum_reactions" FOR EACH ROW EXECUTE FUNCTION "app_private"."enqueue_forum_reaction_notification"();



CREATE OR REPLACE TRIGGER "enqueue_forum_report_notification" AFTER INSERT ON "public"."forum_reports" FOR EACH ROW EXECUTE FUNCTION "app_private"."enqueue_forum_report_notification"();



CREATE OR REPLACE TRIGGER "forum_comment_counter_delete" AFTER DELETE ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."forum_comment_counter"();



CREATE OR REPLACE TRIGGER "forum_comment_counter_insert" AFTER INSERT ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."forum_comment_counter"();



CREATE OR REPLACE TRIGGER "forum_reaction_counter_delete" AFTER DELETE ON "public"."forum_reactions" FOR EACH ROW EXECUTE FUNCTION "app_private"."forum_reaction_counter"();



CREATE OR REPLACE TRIGGER "forum_reaction_counter_insert" AFTER INSERT ON "public"."forum_reactions" FOR EACH ROW EXECUTE FUNCTION "app_private"."forum_reaction_counter"();



CREATE OR REPLACE TRIGGER "mark_forum_report_target_pending_review" AFTER INSERT ON "public"."forum_reports" FOR EACH ROW EXECUTE FUNCTION "app_private"."mark_forum_report_target_pending_review"();



CREATE OR REPLACE TRIGGER "on_new_kesehatan" AFTER INSERT ON "public"."kesehatan_santri" FOR EACH ROW EXECUTE FUNCTION "public"."tr_notify_kesehatan"();



CREATE OR REPLACE TRIGGER "on_new_pelanggaran" AFTER INSERT ON "public"."pelanggaran_santri" FOR EACH ROW EXECUTE FUNCTION "public"."tr_notify_pelanggaran"();



CREATE OR REPLACE TRIGGER "on_new_tagihan" AFTER INSERT ON "public"."tagihan_santri" FOR EACH ROW EXECUTE FUNCTION "public"."tr_notify_tagihan"();



CREATE OR REPLACE TRIGGER "on_perizinan_change" AFTER INSERT OR UPDATE ON "public"."perizinan_santri" FOR EACH ROW EXECUTE FUNCTION "public"."tr_notify_perizinan"();



CREATE OR REPLACE TRIGGER "on_test_finalized" AFTER UPDATE ON "public"."weekly_tests" FOR EACH ROW EXECUTE FUNCTION "public"."mark_questions_as_used"();



CREATE OR REPLACE TRIGGER "protect_dompet_saldo_update" BEFORE UPDATE OF "saldo" ON "public"."dompet_santri" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_wallet_account_mutation"();



CREATE OR REPLACE TRIGGER "protect_transaksi_dompet_insert" BEFORE INSERT ON "public"."transaksi_dompet" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_wallet_account_mutation"();



CREATE OR REPLACE TRIGGER "protect_transaksi_dompet_update_delete" BEFORE DELETE OR UPDATE ON "public"."transaksi_dompet" FOR EACH ROW EXECUTE FUNCTION "app_private"."enforce_wallet_ledger_append_only"();



CREATE OR REPLACE TRIGGER "sanitize_chat_message_report" BEFORE INSERT OR UPDATE ON "public"."chat_message_reports" FOR EACH ROW EXECUTE FUNCTION "app_private"."sanitize_chat_message_report"();



CREATE OR REPLACE TRIGGER "sanitize_chat_notification_queue" BEFORE INSERT OR UPDATE ON "public"."notification_queue" FOR EACH ROW EXECUTE FUNCTION "app_private"."sanitize_chat_notification_queue"();



CREATE OR REPLACE TRIGGER "send_push_notification" AFTER INSERT ON "public"."notification_queue" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://sldobkbolvrahlnowrga.supabase.co/functions/v1/push-notifications', 'POST', '{"Content-type":"application/json","Authorization":"Bearer ${SUPABASE_FUNCTION_INTERNAL_TOKEN_SET_AT_DEPLOY_TIME}"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "set_alumni_data_updated_at" BEFORE UPDATE ON "public"."alumni_data" FOR EACH ROW EXECUTE FUNCTION "app_private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_dompet_santri_updated_at" BEFORE UPDATE ON "public"."dompet_santri" FOR EACH ROW EXECUTE FUNCTION "app_private"."wallet_touch_updated_at"();



CREATE OR REPLACE TRIGGER "set_forum_comments_updated_at" BEFORE UPDATE ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "app_private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_forum_threads_updated_at" BEFORE UPDATE ON "public"."forum_threads" FOR EACH ROW EXECUTE FUNCTION "app_private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_wallet_authorization_sessions_updated_at" BEFORE UPDATE ON "public"."wallet_authorization_sessions" FOR EACH ROW EXECUTE FUNCTION "app_private"."wallet_touch_updated_at"();



CREATE OR REPLACE TRIGGER "set_wallet_disputes_updated_at" BEFORE UPDATE ON "public"."wallet_disputes" FOR EACH ROW EXECUTE FUNCTION "public"."set_wallet_updated_at"();



CREATE OR REPLACE TRIGGER "set_wallet_merchant_outlets_updated_at" BEFORE UPDATE ON "public"."wallet_merchant_outlets" FOR EACH ROW EXECUTE FUNCTION "public"."set_wallet_updated_at"();



CREATE OR REPLACE TRIGGER "set_wallet_merchants_updated_at" BEFORE UPDATE ON "public"."wallet_merchants" FOR EACH ROW EXECUTE FUNCTION "public"."set_wallet_updated_at"();



CREATE OR REPLACE TRIGGER "set_wallet_payment_intents_updated_at" BEFORE UPDATE ON "public"."wallet_payment_intents" FOR EACH ROW EXECUTE FUNCTION "app_private"."wallet_touch_updated_at"();



CREATE OR REPLACE TRIGGER "touch_chat_conversation_from_message" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "app_private"."touch_chat_conversation_from_message"();



CREATE OR REPLACE TRIGGER "touch_chat_conversation_updated_at" BEFORE UPDATE ON "public"."chat_conversations" FOR EACH ROW EXECUTE FUNCTION "app_private"."touch_chat_conversation_updated_at"();



CREATE OR REPLACE TRIGGER "touch_chat_presence_updated_at" BEFORE UPDATE ON "public"."chat_user_presence" FOR EACH ROW EXECUTE FUNCTION "app_private"."touch_chat_presence_updated_at"();



CREATE OR REPLACE TRIGGER "tr_user_devices_single_owner_insert" BEFORE INSERT ON "public"."user_devices" FOR EACH ROW EXECUTE FUNCTION "public"."tr_user_devices_single_owner"();



CREATE OR REPLACE TRIGGER "tr_user_devices_single_owner_update" BEFORE UPDATE OF "fcm_token", "user_id", "is_active" ON "public"."user_devices" FOR EACH ROW EXECUTE FUNCTION "public"."tr_user_devices_single_owner"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_dispute_insert" AFTER INSERT ON "public"."wallet_disputes" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_dispute"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_dispute_update" AFTER UPDATE ON "public"."wallet_disputes" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_dispute"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_freeze" AFTER UPDATE ON "public"."wallet_system_controls" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_freeze"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_integrity" AFTER UPDATE ON "public"."wallet_ledger_integrity_runs" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_integrity"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_kantin_device_insert" AFTER INSERT ON "public"."kantin_devices" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_kantin_device"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_kantin_device_update" AFTER UPDATE ON "public"."kantin_devices" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_kantin_device"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_payment_intent_failure" AFTER UPDATE ON "public"."wallet_payment_intents" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_payment_intent_failure"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_reconciliation" AFTER UPDATE ON "public"."wallet_reconciliation_runs" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_reconciliation"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_risk_event" AFTER INSERT ON "public"."wallet_risk_events" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_risk_event"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_transaction" AFTER INSERT ON "public"."transaksi_dompet" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_transaction"();



CREATE OR REPLACE TRIGGER "tr_wallet_notify_user_device" AFTER INSERT ON "public"."user_devices" FOR EACH ROW EXECUTE FUNCTION "public"."tr_wallet_notify_user_device"();



CREATE OR REPLACE TRIGGER "trg_rag_chunk_count_delete" AFTER DELETE ON "public"."rag_document_chunks" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_rag_document_chunk_count"();



CREATE OR REPLACE TRIGGER "trg_rag_chunk_count_insert" AFTER INSERT ON "public"."rag_document_chunks" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_rag_document_chunk_count"();



CREATE OR REPLACE TRIGGER "trg_rag_chunk_count_update" AFTER UPDATE OF "document_id" ON "public"."rag_document_chunks" FOR EACH ROW EXECUTE FUNCTION "app_private"."refresh_rag_document_chunk_count"();



CREATE OR REPLACE TRIGGER "trg_rag_documents_updated_at" BEFORE UPDATE ON "public"."rag_documents" FOR EACH ROW EXECUTE FUNCTION "app_private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rag_rate_limits_updated_at" BEFORE UPDATE ON "public"."rag_rate_limits" FOR EACH ROW EXECUTE FUNCTION "app_private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_diklat" AFTER UPDATE ON "public"."peserta_diklat" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sync_diklat_to_transaksi"();



CREATE OR REPLACE TRIGGER "trg_sync_pengeluaran" AFTER INSERT ON "public"."pengeluaran" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sync_pengeluaran_to_transaksi"();



CREATE OR REPLACE TRIGGER "trg_sync_tagihan" AFTER UPDATE ON "public"."tagihan_santri" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sync_tagihan_to_transaksi"();



CREATE OR REPLACE TRIGGER "trg_validate_coords" BEFORE INSERT OR UPDATE ON "public"."santri" FOR EACH ROW EXECUTE FUNCTION "public"."validate_coords_and_set_geom"();



CREATE OR REPLACE TRIGGER "trg_wallet_credit_merchant_from_posted_intent" AFTER INSERT OR UPDATE OF "status", "posted_ledger_id" ON "public"."wallet_payment_intents" FOR EACH ROW EXECUTE FUNCTION "public"."wallet_credit_merchant_from_posted_intent"();



ALTER TABLE ONLY "public"."alumni_data"
    ADD CONSTRAINT "alumni_data_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alumni_follows"
    ADD CONSTRAINT "alumni_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alumni_follows"
    ADD CONSTRAINT "alumni_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."berita"
    ADD CONSTRAINT "berita_penulis_id_fkey" FOREIGN KEY ("penulis_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."chat_blocks"
    ADD CONSTRAINT "chat_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_blocks"
    ADD CONSTRAINT "chat_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_last_message_sender_id_fkey" FOREIGN KEY ("last_message_sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_device_keys"
    ADD CONSTRAINT "chat_device_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_key_backups"
    ADD CONSTRAINT "chat_key_backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_device_ciphertexts"
    ADD CONSTRAINT "chat_message_device_ciphertexts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_device_ciphertexts"
    ADD CONSTRAINT "chat_message_device_ciphertexts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_device_ciphertexts"
    ADD CONSTRAINT "chat_message_device_ciphertexts_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reports"
    ADD CONSTRAINT "chat_message_reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reports"
    ADD CONSTRAINT "chat_message_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reports"
    ADD CONSTRAINT "chat_message_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reports"
    ADD CONSTRAINT "chat_message_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_user_presence"
    ADD CONSTRAINT "chat_user_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crypto_keystores"
    ADD CONSTRAINT "crypto_keystores_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."detail_transaksi"
    ADD CONSTRAINT "detail_transaksi_tagihan_id_fkey" FOREIGN KEY ("tagihan_id") REFERENCES "public"."tagihan_santri"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."detail_transaksi"
    ADD CONSTRAINT "detail_transaksi_transaksi_id_fkey" FOREIGN KEY ("transaksi_id") REFERENCES "public"."transaksi_keuangan"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dompet_santri"
    ADD CONSTRAINT "dompet_santri_limits_updated_by_fkey" FOREIGN KEY ("limits_updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dompet_santri"
    ADD CONSTRAINT "dompet_santri_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."question_bank"
    ADD CONSTRAINT "fk_last_used_test" FOREIGN KEY ("last_used_test_id") REFERENCES "public"."weekly_tests"("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "fk_user_device" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notification_queue"
    ADD CONSTRAINT "fk_user_notif" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."forum_attachments"
    ADD CONSTRAINT "forum_attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_attachments"
    ADD CONSTRAINT "forum_attachments_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_attachments"
    ADD CONSTRAINT "forum_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_moderation_actions"
    ADD CONSTRAINT "forum_moderation_actions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_moderation_actions"
    ADD CONSTRAINT "forum_moderation_actions_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."forum_moderation_actions"
    ADD CONSTRAINT "forum_moderation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."forum_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_moderation_actions"
    ADD CONSTRAINT "forum_moderation_actions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_reactions"
    ADD CONSTRAINT "forum_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_reactions"
    ADD CONSTRAINT "forum_reactions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_reactions"
    ADD CONSTRAINT "forum_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_reports"
    ADD CONSTRAINT "forum_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_reports"
    ADD CONSTRAINT "forum_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_reports"
    ADD CONSTRAINT "forum_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forum_reports"
    ADD CONSTRAINT "forum_reports_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_threads"
    ADD CONSTRAINT "forum_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_threads"
    ADD CONSTRAINT "forum_threads_repost_of_thread_id_fkey" FOREIGN KEY ("repost_of_thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."geocode_jobs"
    ADD CONSTRAINT "geocode_jobs_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."geocode_cache"("id");



ALTER TABLE ONLY "public"."hafalan_kitab"
    ADD CONSTRAINT "hafalan_kitab_dicatat_oleh_id_fkey" FOREIGN KEY ("dicatat_oleh_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hafalan_kitab"
    ADD CONSTRAINT "hafalan_kitab_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hafalan_tahfidz"
    ADD CONSTRAINT "hafalan_tahfidz_dicatat_oleh_id_fkey" FOREIGN KEY ("dicatat_oleh_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hafalan_tahfidz"
    ADD CONSTRAINT "hafalan_tahfidz_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."info_rekening_santri"
    ADD CONSTRAINT "info_rekening_santri_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis");



ALTER TABLE ONLY "public"."inventaris"
    ADD CONSTRAINT "inventaris_dicatat_oleh_id_fkey" FOREIGN KEY ("dicatat_oleh_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventaris"
    ADD CONSTRAINT "inventaris_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "public"."kategori_barang"("id");



ALTER TABLE ONLY "public"."inventaris"
    ADD CONSTRAINT "inventaris_lokasi_id_fkey" FOREIGN KEY ("lokasi_id") REFERENCES "public"."lokasi_aset"("id");



ALTER TABLE ONLY "public"."kantin_devices"
    ADD CONSTRAINT "kantin_devices_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kantin_devices"
    ADD CONSTRAINT "kantin_devices_kantin_user_id_fkey" FOREIGN KEY ("kantin_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kantin_devices"
    ADD CONSTRAINT "kantin_devices_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kantin_devices"
    ADD CONSTRAINT "kantin_devices_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kesehatan_santri"
    ADD CONSTRAINT "kesehatan_santri_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis");



ALTER TABLE ONLY "public"."log_aktivitas"
    ADD CONSTRAINT "log_aktivitas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."murojaah_tahfidz"
    ADD CONSTRAINT "murojaah_tahfidz_dicatat_oleh_id_fkey" FOREIGN KEY ("dicatat_oleh_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."murojaah_tahfidz"
    ADD CONSTRAINT "murojaah_tahfidz_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nilai_santri"
    ADD CONSTRAINT "nilai_santri_mapel_id_fkey" FOREIGN KEY ("mapel_id") REFERENCES "public"."mata_pelajaran"("id");



ALTER TABLE ONLY "public"."nilai_santri"
    ADD CONSTRAINT "nilai_santri_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_queue"
    ADD CONSTRAINT "notification_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_queue"
    ADD CONSTRAINT "notification_queue_wallet_reviewed_by_fkey" FOREIGN KEY ("wallet_reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pelanggaran_santri"
    ADD CONSTRAINT "pelanggaran_santri_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pengeluaran"
    ADD CONSTRAINT "pengeluaran_dicatat_oleh_id_fkey" FOREIGN KEY ("dicatat_oleh_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."perizinan_santri"
    ADD CONSTRAINT "perizinan_santri_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prestasi_santri"
    ADD CONSTRAINT "prestasi_santri_dicatat_oleh_id_fkey" FOREIGN KEY ("dicatat_oleh_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prestasi_santri"
    ADD CONSTRAINT "prestasi_santri_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_bank"
    ADD CONSTRAINT "question_bank_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rag_document_chunks"
    ADD CONSTRAINT "rag_document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rag_documents"
    ADD CONSTRAINT "rag_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rag_query_logs"
    ADD CONSTRAINT "rag_query_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."santri"
    ADD CONSTRAINT "santri_wali_id_fkey" FOREIGN KEY ("wali_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."struktur_organisasi"
    ADD CONSTRAINT "struktur_organisasi_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."struktur_organisasi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tagihan_santri"
    ADD CONSTRAINT "tagihan_santri_jenis_pembayaran_id_fkey" FOREIGN KEY ("jenis_pembayaran_id") REFERENCES "public"."ref_jenis_pembayaran"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tagihan_santri"
    ADD CONSTRAINT "tagihan_santri_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."question_bank"("id");



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."weekly_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_submissions"
    ADD CONSTRAINT "test_submissions_dinilai_oleh_fkey" FOREIGN KEY ("dinilai_oleh") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."test_submissions"
    ADD CONSTRAINT "test_submissions_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis");



ALTER TABLE ONLY "public"."test_submissions"
    ADD CONSTRAINT "test_submissions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."weekly_tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_dicatat_oleh_id_fkey" FOREIGN KEY ("dicatat_oleh_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."wallet_payment_intents"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transaksi_dompet"
    ADD CONSTRAINT "transaksi_dompet_transaksi_keuangan_id_fkey" FOREIGN KEY ("transaksi_keuangan_id") REFERENCES "public"."transaksi_keuangan"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaksi_keuangan"
    ADD CONSTRAINT "transaksi_keuangan_admin_pencatat_id_fkey" FOREIGN KEY ("admin_pencatat_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."transaksi_keuangan"
    ADD CONSTRAINT "transaksi_keuangan_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis");



ALTER TABLE ONLY "public"."transaksi_keuangan"
    ADD CONSTRAINT "transaksi_keuangan_wali_id_fkey" FOREIGN KEY ("wali_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_audit_logs"
    ADD CONSTRAINT "wallet_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_audit_logs"
    ADD CONSTRAINT "wallet_audit_logs_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_kantin_user_id_fkey" FOREIGN KEY ("kantin_user_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."wallet_merchants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."wallet_merchant_outlets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."wallet_payment_intents"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_authorization_sessions"
    ADD CONSTRAINT "wallet_authorization_sessions_wallet_public_id_fkey" FOREIGN KEY ("wallet_public_id") REFERENCES "public"."dompet_santri"("wallet_public_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_card_qr_versions"
    ADD CONSTRAINT "wallet_card_qr_versions_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_card_qr_versions"
    ADD CONSTRAINT "wallet_card_qr_versions_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_card_qr_versions"
    ADD CONSTRAINT "wallet_card_qr_versions_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_card_tokens"
    ADD CONSTRAINT "wallet_card_tokens_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_card_tokens"
    ADD CONSTRAINT "wallet_card_tokens_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_card_tokens"
    ADD CONSTRAINT "wallet_card_tokens_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_card_tokens"
    ADD CONSTRAINT "wallet_card_tokens_wallet_public_id_fkey" FOREIGN KEY ("wallet_public_id") REFERENCES "public"."dompet_santri"("wallet_public_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_devices"
    ADD CONSTRAINT "wallet_devices_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_devices"
    ADD CONSTRAINT "wallet_devices_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_disputes"
    ADD CONSTRAINT "wallet_disputes_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_disputes"
    ADD CONSTRAINT "wallet_disputes_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."transaksi_dompet"("id");



ALTER TABLE ONLY "public"."wallet_disputes"
    ADD CONSTRAINT "wallet_disputes_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_disputes"
    ADD CONSTRAINT "wallet_disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_disputes"
    ADD CONSTRAINT "wallet_disputes_reversal_ledger_id_fkey" FOREIGN KEY ("reversal_ledger_id") REFERENCES "public"."transaksi_dompet"("id");



ALTER TABLE ONLY "public"."wallet_disputes"
    ADD CONSTRAINT "wallet_disputes_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis");



ALTER TABLE ONLY "public"."wallet_key_rotation_logs"
    ADD CONSTRAINT "wallet_key_rotation_logs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_key_rotation_logs"
    ADD CONSTRAINT "wallet_key_rotation_logs_new_device_id_fkey" FOREIGN KEY ("new_device_id") REFERENCES "public"."wallet_devices"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_key_rotation_logs"
    ADD CONSTRAINT "wallet_key_rotation_logs_old_device_id_fkey" FOREIGN KEY ("old_device_id") REFERENCES "public"."wallet_devices"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_key_rotation_logs"
    ADD CONSTRAINT "wallet_key_rotation_logs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_key_rotation_logs"
    ADD CONSTRAINT "wallet_key_rotation_logs_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_ledger_integrity_runs"
    ADD CONSTRAINT "wallet_ledger_integrity_runs_broken_at_fkey" FOREIGN KEY ("broken_at") REFERENCES "public"."transaksi_dompet"("id");



ALTER TABLE ONLY "public"."wallet_ledger_integrity_runs"
    ADD CONSTRAINT "wallet_ledger_integrity_runs_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_ledger_integrity_runs"
    ADD CONSTRAINT "wallet_ledger_integrity_runs_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_ledger_integrity_runs"
    ADD CONSTRAINT "wallet_ledger_integrity_runs_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis");



ALTER TABLE ONLY "public"."wallet_merchant_balances"
    ADD CONSTRAINT "wallet_merchant_balances_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."wallet_merchants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_balances"
    ADD CONSTRAINT "wallet_merchant_balances_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."wallet_merchant_outlets"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_ledger"
    ADD CONSTRAINT "wallet_merchant_ledger_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_merchant_ledger"
    ADD CONSTRAINT "wallet_merchant_ledger_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."wallet_merchants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_ledger"
    ADD CONSTRAINT "wallet_merchant_ledger_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."wallet_merchant_outlets"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_ledger"
    ADD CONSTRAINT "wallet_merchant_ledger_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."wallet_payment_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_ledger"
    ADD CONSTRAINT "wallet_merchant_ledger_santri_ledger_id_fkey" FOREIGN KEY ("santri_ledger_id") REFERENCES "public"."transaksi_dompet"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_ledger"
    ADD CONSTRAINT "wallet_merchant_ledger_settlement_request_fk" FOREIGN KEY ("settlement_request_id") REFERENCES "public"."wallet_merchant_settlement_requests"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."wallet_merchant_outlets"
    ADD CONSTRAINT "wallet_merchant_outlets_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."wallet_merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_merchant_settlement_requests"
    ADD CONSTRAINT "wallet_merchant_settlement_requests_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."wallet_merchants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_settlement_requests"
    ADD CONSTRAINT "wallet_merchant_settlement_requests_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."wallet_merchant_outlets"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_settlement_requests"
    ADD CONSTRAINT "wallet_merchant_settlement_requests_paid_ledger_id_fkey" FOREIGN KEY ("paid_ledger_id") REFERENCES "public"."wallet_merchant_ledger"("id");



ALTER TABLE ONLY "public"."wallet_merchant_settlement_requests"
    ADD CONSTRAINT "wallet_merchant_settlement_requests_proof_uploaded_by_fkey" FOREIGN KEY ("proof_uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_merchant_settlement_requests"
    ADD CONSTRAINT "wallet_merchant_settlement_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_merchant_settlement_requests"
    ADD CONSTRAINT "wallet_merchant_settlement_requests_requested_ledger_id_fkey" FOREIGN KEY ("requested_ledger_id") REFERENCES "public"."wallet_merchant_ledger"("id");



ALTER TABLE ONLY "public"."wallet_merchant_settlement_requests"
    ADD CONSTRAINT "wallet_merchant_settlement_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_merchant_users"
    ADD CONSTRAINT "wallet_merchant_users_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."wallet_merchants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_merchant_users"
    ADD CONSTRAINT "wallet_merchant_users_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."wallet_merchant_outlets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_merchant_users"
    ADD CONSTRAINT "wallet_merchant_users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_merchants"
    ADD CONSTRAINT "wallet_merchants_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_nonce_uses"
    ADD CONSTRAINT "wallet_nonce_uses_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_nonce_uses"
    ADD CONSTRAINT "wallet_nonce_uses_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_nonces"
    ADD CONSTRAINT "wallet_nonces_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_payment_intents"
    ADD CONSTRAINT "wallet_payment_intents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_payment_intents"
    ADD CONSTRAINT "wallet_payment_intents_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."wallet_merchants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_payment_intents"
    ADD CONSTRAINT "wallet_payment_intents_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."wallet_merchant_outlets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_payment_intents"
    ADD CONSTRAINT "wallet_payment_intents_posted_ledger_id_fkey" FOREIGN KEY ("posted_ledger_id") REFERENCES "public"."transaksi_dompet"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wallet_payment_intents"
    ADD CONSTRAINT "wallet_payment_intents_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_pin_attempts"
    ADD CONSTRAINT "wallet_pin_attempts_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_pin_attempts"
    ADD CONSTRAINT "wallet_pin_attempts_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis");



ALTER TABLE ONLY "public"."wallet_reconciliation_runs"
    ADD CONSTRAINT "wallet_reconciliation_runs_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_reconciliation_runs"
    ADD CONSTRAINT "wallet_reconciliation_runs_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_reconciliation_runs"
    ADD CONSTRAINT "wallet_reconciliation_runs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_risk_events"
    ADD CONSTRAINT "wallet_risk_events_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_risk_events"
    ADD CONSTRAINT "wallet_risk_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_risk_events"
    ADD CONSTRAINT "wallet_risk_events_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."wallet_merchants"("id");



ALTER TABLE ONLY "public"."wallet_risk_events"
    ADD CONSTRAINT "wallet_risk_events_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."wallet_merchant_outlets"("id");



ALTER TABLE ONLY "public"."wallet_risk_events"
    ADD CONSTRAINT "wallet_risk_events_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_risk_events"
    ADD CONSTRAINT "wallet_risk_events_santri_nis_fkey" FOREIGN KEY ("santri_nis") REFERENCES "public"."santri"("nis");



ALTER TABLE ONLY "public"."wallet_security_ai_analyses"
    ADD CONSTRAINT "wallet_security_ai_analyses_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "public"."wallet_security_audit_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_security_ai_analyses"
    ADD CONSTRAINT "wallet_security_ai_analyses_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_security_audit_runs"
    ADD CONSTRAINT "wallet_security_audit_runs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wallet_system_controls"
    ADD CONSTRAINT "wallet_system_controls_frozen_by_fkey" FOREIGN KEY ("frozen_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."weekly_tests"
    ADD CONSTRAINT "weekly_tests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Active alumni can create attachments" ON "public"."forum_attachments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("uploader_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("storage_bucket" = 'forum-media'::"text")));



CREATE POLICY "Active alumni can create comments" ON "public"."forum_comments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['published'::"text", 'pending_review'::"text"])) AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."forum_threads" "t"
  WHERE (("t"."id" = "forum_comments"."thread_id") AND ("t"."status" = 'published'::"text") AND ("t"."deleted_at" IS NULL) AND ("t"."is_locked" = false))))));



CREATE POLICY "Active alumni can create conversations" ON "public"."chat_conversations" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND "app_private"."is_active_alumni"("auth"."uid"())));



CREATE POLICY "Active alumni can create own threads" ON "public"."forum_threads" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['published'::"text", 'pending_review'::"text"])) AND ("visibility" = 'alumni'::"text") AND ("is_pinned" = false) AND ("is_locked" = false) AND ("deleted_at" IS NULL)));



CREATE POLICY "Active alumni can follow alumni" ON "public"."alumni_follows" FOR INSERT TO "authenticated" WITH CHECK ((("follower_id" = "auth"."uid"()) AND ("follower_id" <> "following_id") AND "app_private"."is_active_alumni"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."alumni_data" "a"
  WHERE ("a"."id" = "alumni_follows"."following_id")))));



CREATE POLICY "Active alumni can react" ON "public"."forum_reactions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ((("thread_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."forum_threads" "t"
  WHERE (("t"."id" = "forum_reactions"."thread_id") AND ("t"."status" = 'published'::"text") AND ("t"."deleted_at" IS NULL))))) OR (("comment_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."forum_comments" "c"
  WHERE (("c"."id" = "forum_reactions"."comment_id") AND ("c"."status" = 'published'::"text") AND ("c"."deleted_at" IS NULL))))))));



CREATE POLICY "Active alumni can read alumni directory" ON "public"."alumni_data" FOR SELECT TO "authenticated" USING (( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni"));



CREATE POLICY "Active alumni can read alumni follows" ON "public"."alumni_follows" FOR SELECT TO "authenticated" USING ("app_private"."is_active_alumni"("auth"."uid"()));



CREATE POLICY "Active alumni can read chat presence" ON "public"."chat_user_presence" FOR SELECT TO "authenticated" USING ("app_private"."is_active_alumni"("auth"."uid"()));



CREATE POLICY "Active alumni can report content" ON "public"."forum_reports" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("reporter_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'open'::"text")));



CREATE POLICY "Admin All Access" ON "public"."pengeluaran" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin Edit Santri Scoped" ON "public"."santri" FOR UPDATE TO "authenticated" USING (("public"."check_access_scope"(("jenis_kelamin")::"text", ("jurusan")::"text") AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['super_admin'::"text", 'admin_kesantrian'::"text", 'admin_bendahara'::"text"]))));



CREATE POLICY "Admin Full Access" ON "public"."berita" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin Full Access Diklat" ON "public"."peserta_diklat" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin Manage Finance" ON "public"."transaksi_keuangan" TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['super_admin'::"text", 'admin_bendahara'::"text", 'admin_akademik_tahfidz'::"text", 'admin_akademik_kitab'::"text"])));



CREATE POLICY "Admin View Santri Scoped" ON "public"."santri" FOR SELECT TO "authenticated" USING (("public"."check_access_scope"(("jenis_kelamin")::"text", ("jurusan")::"text") OR ("wali_id" = "auth"."uid"())));



CREATE POLICY "Admin full access config" ON "public"."config_diklat" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin full access master_kitab" ON "public"."master_kitab" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin manage hafalan" ON "public"."hafalan_tahfidz" TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['super_admin'::"text", 'admin_akademik_tahfidz'::"text", 'admin_akademik_kitab'::"text"])));



CREATE POLICY "Admin manage kesehatan" ON "public"."kesehatan_santri" TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['super_admin'::"text", 'admin_akademik_tahfidz'::"text", 'admin_akademik_kitab'::"text"])));



CREATE POLICY "Admin manage pelanggaran" ON "public"."pelanggaran_santri" TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['super_admin'::"text", 'admin_akademik_tahfidz'::"text", 'admin_akademik_kitab'::"text"])));



CREATE POLICY "Admin manage perizinan" ON "public"."perizinan_santri" TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['super_admin'::"text", 'admin_akademik_tahfidz'::"text", 'admin_akademik_kitab'::"text"])));



CREATE POLICY "Admin update access" ON "public"."instansi_info" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['super_admin'::"text", 'admin_akademik'::"text"])));



CREATE POLICY "Admin view logs" ON "public"."log_aktivitas" FOR SELECT TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'super_admin'::"text"));



CREATE POLICY "Admins can insert to notification queue" ON "public"."notification_queue" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_in_roles"(ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text"]));



CREATE POLICY "Admins can view notification queue" ON "public"."notification_queue" FOR SELECT TO "authenticated" USING ("public"."is_admin_in_roles"(ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text", 'kesantrian'::"text", 'bendahara'::"text"]));



CREATE POLICY "Admins can view santri for notifications" ON "public"."santri" FOR SELECT TO "authenticated" USING ("public"."is_admin_in_roles"(ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text", 'kesantrian'::"text", 'bendahara'::"text"]));



CREATE POLICY "Admins can view user devices" ON "public"."user_devices" FOR SELECT TO "authenticated" USING ("public"."is_admin_in_roles"(ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text", 'kesantrian'::"text", 'bendahara'::"text"]));



CREATE POLICY "Admins full access hafalan tahfidz" ON "public"."hafalan_tahfidz" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['super_admin'::"text", 'admin_akademik_tahfidz'::"text"])));



CREATE POLICY "Admins full access info rekening" ON "public"."info_rekening_santri" TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['super_admin'::"text", 'admin_bendahara'::"text"])));



CREATE POLICY "Admins manage payment refs" ON "public"."ref_jenis_pembayaran" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['super_admin'::"text", 'admin_bendahara'::"text"])));



CREATE POLICY "Akses baca admin config" ON "public"."config_diklat" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Akses baca kitab publik" ON "public"."master_kitab" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Akses baca publik config" ON "public"."config_diklat" FOR SELECT TO "anon" USING (true);



CREATE POLICY "All Access Mapel" ON "public"."mata_pelajaran" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "All Access Nilai" ON "public"."nilai_santri" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all for authenticated" ON "public"."murojaah_tahfidz" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow read for all users" ON "public"."ref_jenis_pembayaran" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read for authenticated users" ON "public"."ref_jenis_pembayaran" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Alumni can insert own alumni data" ON "public"."alumni_data" FOR INSERT TO "authenticated" WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND (( SELECT "app_private"."current_user_role"() AS "current_user_role") = 'alumni'::"text")));



CREATE POLICY "Alumni can update own alumni data" ON "public"."alumni_data" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND (( SELECT "app_private"."current_user_role"() AS "current_user_role") = 'alumni'::"text"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND (( SELECT "app_private"."current_user_role"() AS "current_user_role") = 'alumni'::"text")));



CREATE POLICY "Authors can delete own comments" ON "public"."forum_comments" FOR DELETE TO "authenticated" USING ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Authors can delete own threads" ON "public"."forum_threads" FOR DELETE TO "authenticated" USING ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_locked" = false)));



CREATE POLICY "Authors can update own comments" ON "public"."forum_comments" FOR UPDATE TO "authenticated" USING ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("deleted_at" IS NULL))) WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['published'::"text", 'pending_review'::"text", 'deleted'::"text"]))));



CREATE POLICY "Authors can update own unlocked threads" ON "public"."forum_threads" FOR UPDATE TO "authenticated" USING ((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_locked" = false) AND ("deleted_at" IS NULL))) WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("visibility" = 'alumni'::"text") AND ("is_pinned" = false) AND ("status" = ANY (ARRAY['published'::"text", 'pending_review'::"text", 'deleted'::"text"]))));



CREATE POLICY "Bendahara View Transaksi Scoped" ON "public"."transaksi_keuangan" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "transaksi_keuangan"."santri_nis") AND "public"."check_access_scope"(("s"."jenis_kelamin")::"text", ("s"."jurusan")::"text")))));



CREATE POLICY "Block All Insert" ON "public"."midtrans_webhook_logs" FOR INSERT WITH CHECK (false);



CREATE POLICY "Chat creators can update conversation metadata" ON "public"."chat_conversations" FOR UPDATE TO "authenticated" USING ("app_private"."is_chat_participant"("id")) WITH CHECK ("app_private"."is_chat_participant"("id"));



CREATE POLICY "Chat participants and creators can read conversations" ON "public"."chat_conversations" FOR SELECT TO "authenticated" USING (("app_private"."is_chat_participant"("id") OR ("created_by" = "auth"."uid"())));



CREATE POLICY "Chat participants can read messages" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING ("app_private"."is_chat_participant"("conversation_id"));



CREATE POLICY "Chat participants can read participants" ON "public"."chat_participants" FOR SELECT TO "authenticated" USING (("app_private"."is_chat_participant"("conversation_id") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Chat participants can send encrypted messages" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND "app_private"."is_active_alumni"("auth"."uid"()) AND "app_private"."is_chat_participant"("conversation_id") AND ("status" = 'sent'::"text") AND ("deleted_at" IS NULL) AND ("encryption_scheme" = 'e2ee_v1'::"text") AND ("e2ee_version" = 1) AND (NOT "app_private"."has_recent_chat_message"("auth"."uid"())) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."chat_participants" "cp"
  WHERE (("cp"."conversation_id" = "chat_messages"."conversation_id") AND ("cp"."user_id" <> "auth"."uid"()) AND "app_private"."is_chat_blocked"("auth"."uid"(), "cp"."user_id")))))));



CREATE POLICY "Chat reporters can create reports" ON "public"."chat_message_reports" FOR INSERT TO "authenticated" WITH CHECK ((("reporter_id" = "auth"."uid"()) AND "app_private"."is_chat_participant"("conversation_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_messages" "cm"
  WHERE (("cm"."id" = "chat_message_reports"."message_id") AND ("cm"."conversation_id" = "chat_message_reports"."conversation_id") AND ("cm"."sender_id" <> "auth"."uid"()))))));



CREATE POLICY "Chat reporters can read own reports" ON "public"."chat_message_reports" FOR SELECT TO "authenticated" USING ((("reporter_id" = "auth"."uid"()) OR "app_private"."is_current_user_forum_admin"()));



CREATE POLICY "Conversation creators can add active alumni participants" ON "public"."chat_participants" FOR INSERT TO "authenticated" WITH CHECK (("app_private"."is_active_alumni"("auth"."uid"()) AND "app_private"."is_active_alumni"("user_id") AND (("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."chat_conversations" "c"
  WHERE (("c"."id" = "chat_participants"."conversation_id") AND ("c"."created_by" = "auth"."uid"())))))));



CREATE POLICY "Enable delete for users based on id" ON "public"."hafalan_kitab" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."hafalan_kitab" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."hafalan_kitab" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update for users based on id" ON "public"."hafalan_kitab" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Finance Admins full access bills" ON "public"."tagihan_santri" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['super_admin'::"text", 'admin_bendahara'::"text"])));



CREATE POLICY "Finance Admins full access transactions" ON "public"."transaksi_keuangan" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['super_admin'::"text", 'admin_bendahara'::"text"])));



CREATE POLICY "Forum admins create moderation actions" ON "public"."forum_moderation_actions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin") AND ("moderator_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Forum admins manage all comments" ON "public"."forum_comments" TO "authenticated" USING (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin")) WITH CHECK (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin"));



CREATE POLICY "Forum admins manage all threads" ON "public"."forum_threads" TO "authenticated" USING (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin")) WITH CHECK (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin"));



CREATE POLICY "Forum admins manage alumni data" ON "public"."alumni_data" TO "authenticated" USING (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin")) WITH CHECK (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin"));



CREATE POLICY "Forum admins manage chat reports" ON "public"."chat_message_reports" TO "authenticated" USING ("app_private"."is_current_user_forum_admin"()) WITH CHECK ("app_private"."is_current_user_forum_admin"());



CREATE POLICY "Forum admins manage reports" ON "public"."forum_reports" TO "authenticated" USING (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin")) WITH CHECK (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin"));



CREATE POLICY "Forum admins read moderation actions" ON "public"."forum_moderation_actions" FOR SELECT TO "authenticated" USING (( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin"));



CREATE POLICY "Forum members can read attachments" ON "public"."forum_attachments" FOR SELECT TO "authenticated" USING (( SELECT "app_private"."is_forum_member_or_admin"() AS "is_forum_member_or_admin"));



CREATE POLICY "Forum members can read published comments" ON "public"."forum_comments" FOR SELECT TO "authenticated" USING ((( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin") OR (( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("status" = 'published'::"text") AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."forum_threads" "t"
  WHERE (("t"."id" = "forum_comments"."thread_id") AND ("t"."status" = 'published'::"text") AND ("t"."deleted_at" IS NULL)))))));



CREATE POLICY "Forum members can read published threads" ON "public"."forum_threads" FOR SELECT TO "authenticated" USING ((( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin") OR (( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("status" = 'published'::"text") AND ("deleted_at" IS NULL))));



CREATE POLICY "Forum members can read reactions" ON "public"."forum_reactions" FOR SELECT TO "authenticated" USING (( SELECT "app_private"."is_forum_member_or_admin"() AS "is_forum_member_or_admin"));



CREATE POLICY "Forum reporters and admins can read reports" ON "public"."forum_reports" FOR SELECT TO "authenticated" USING ((("reporter_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin")));



CREATE POLICY "Full access for management roles" ON "public"."question_bank" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("lower"("profiles"."role") = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Full access for management roles" ON "public"."test_questions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("lower"("profiles"."role") = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Full access for management roles" ON "public"."test_submissions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("lower"("profiles"."role") = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Full access for management roles" ON "public"."weekly_tests" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("lower"("profiles"."role") = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Hafalan Insert" ON "public"."hafalan_tahfidz" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "hafalan_tahfidz"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Hafalan Select" ON "public"."hafalan_tahfidz" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "hafalan_tahfidz"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text", 'rois'::"text", 'dewan'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Hafalan Update Delete" ON "public"."hafalan_tahfidz" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Insert System" ON "public"."audit_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Izinkan akses baca publik" ON "public"."peserta_diklat" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Izinkan pendaftaran publik" ON "public"."peserta_diklat" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Kantin manage own rekening info" ON "public"."info_rekening_santri" TO "authenticated" USING (("public"."get_my_role"() = 'pengelola_kantin'::"text"));



CREATE POLICY "Kesehatan Insert" ON "public"."kesehatan_santri" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "kesehatan_santri"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Kesehatan Select" ON "public"."kesehatan_santri" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "kesehatan_santri"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text", 'rois'::"text", 'dewan'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Kesehatan Update Delete" ON "public"."kesehatan_santri" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Murojaah Insert" ON "public"."murojaah_tahfidz" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "murojaah_tahfidz"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Murojaah Select" ON "public"."murojaah_tahfidz" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "murojaah_tahfidz"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text", 'rois'::"text", 'dewan'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Murojaah Update Delete" ON "public"."murojaah_tahfidz" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Pelanggaran Insert" ON "public"."pelanggaran_santri" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "pelanggaran_santri"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Pelanggaran Select" ON "public"."pelanggaran_santri" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "pelanggaran_santri"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text", 'rois'::"text", 'dewan'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Pelanggaran Update Delete" ON "public"."pelanggaran_santri" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Perizinan Insert" ON "public"."perizinan_santri" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "perizinan_santri"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Perizinan Select" ON "public"."perizinan_santri" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "perizinan_santri"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text", 'rois'::"text", 'dewan'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Perizinan Update Delete" ON "public"."perizinan_santri" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Public Read Published" ON "public"."berita" FOR SELECT USING (("status" = 'PUBLISHED'::"text"));



CREATE POLICY "Public read access" ON "public"."instansi_info" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read-only master_kitab" ON "public"."master_kitab" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "Public view payment refs" ON "public"."ref_jenis_pembayaran" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Read Only Admin" ON "public"."audit_logs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Read access for authorized roles" ON "public"."question_bank" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("lower"("profiles"."role") = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Read access for authorized roles" ON "public"."test_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("lower"("profiles"."role") = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Read access for authorized roles" ON "public"."test_submissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("lower"("profiles"."role") = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Read access for authorized roles" ON "public"."weekly_tests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("lower"("profiles"."role") = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text", 'kesantrian'::"text"]))))));



CREATE POLICY "Santri Select Scope" ON "public"."santri" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("santri"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("santri"."jurusan")::"text"))))));



CREATE POLICY "Senders can update own messages" ON "public"."chat_messages" FOR UPDATE TO "authenticated" USING ((("sender_id" = "auth"."uid"()) AND "app_private"."is_chat_participant"("conversation_id"))) WITH CHECK ((("sender_id" = "auth"."uid"()) AND "app_private"."is_chat_participant"("conversation_id")));



CREATE POLICY "Service Role Insert Only" ON "public"."midtrans_webhook_logs" FOR INSERT WITH CHECK (false);



CREATE POLICY "Super & Bendahara full access santri" ON "public"."santri" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['super_admin'::"text", 'admin_bendahara'::"text"])));



CREATE POLICY "Super Admin View Logs" ON "public"."midtrans_webhook_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super Admin manage all profiles" ON "public"."profiles" TO "authenticated" USING (("public"."get_my_role"() = 'super_admin'::"text"));



CREATE POLICY "Tagihan Insert" ON "public"."tagihan_santri" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "tagihan_santri"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Tagihan Select" ON "public"."tagihan_santri" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."santri" "s" ON (("s"."nis" = "tagihan_santri"."santri_nis")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND (("p"."akses_gender" = 'ALL'::"text") OR ("p"."akses_gender" = ("s"."jenis_kelamin")::"text")) AND (("p"."akses_jurusan" = 'ALL'::"text") OR ("p"."akses_jurusan" = ("s"."jurusan")::"text"))))));



CREATE POLICY "Tagihan Update Delete" ON "public"."tagihan_santri" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text"]))))));



CREATE POLICY "Uploaders can delete own attachments" ON "public"."forum_attachments" FOR DELETE TO "authenticated" USING (((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("uploader_id" = ( SELECT "auth"."uid"() AS "uid"))) OR ( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin")));



CREATE POLICY "Users can delete their own notifications" ON "public"."notification_queue" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own chat presence" ON "public"."chat_user_presence" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "app_private"."is_active_alumni"("auth"."uid"())));



CREATE POLICY "Users can manage own chat blocks" ON "public"."chat_blocks" TO "authenticated" USING (("blocker_id" = "auth"."uid"())) WITH CHECK (("blocker_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own devices" ON "public"."user_devices" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own alumni data" ON "public"."alumni_data" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can remove own reactions" ON "public"."forum_reactions" FOR DELETE TO "authenticated" USING (((( SELECT "app_private"."is_current_user_active_alumni"() AS "is_current_user_active_alumni") AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))) OR ( SELECT "app_private"."is_current_user_forum_admin"() AS "is_current_user_forum_admin")));



CREATE POLICY "Users can unfollow own follows" ON "public"."alumni_follows" FOR DELETE TO "authenticated" USING (("follower_id" = "auth"."uid"()));



CREATE POLICY "Users can update own chat participant state" ON "public"."chat_participants" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own chat presence" ON "public"."chat_user_presence" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND "app_private"."is_active_alumni"("auth"."uid"())));



CREATE POLICY "Users can view their own notifications" ON "public"."notification_queue" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert logs" ON "public"."log_aktivitas" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Wali View Own Finance" ON "public"."transaksi_keuangan" FOR SELECT TO "authenticated" USING (("wali_id" = "auth"."uid"()));



CREATE POLICY "Wali View Own Transaksi" ON "public"."transaksi_keuangan" FOR SELECT TO "authenticated" USING (("wali_id" = "auth"."uid"()));



CREATE POLICY "Wali can see their own santri's bills" ON "public"."tagihan_santri" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri"
  WHERE (("santri"."nis" = "tagihan_santri"."santri_nis") AND ("santri"."wali_id" = "auth"."uid"())))));



CREATE POLICY "Wali manage own transactions" ON "public"."transaksi_keuangan" TO "authenticated" USING (((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'wali'::"text") AND ("wali_id" = "auth"."uid"())));



CREATE POLICY "Wali view hafalan" ON "public"."hafalan_tahfidz" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri"
  WHERE (("santri"."nis" = "hafalan_tahfidz"."santri_nis") AND ("santri"."wali_id" = "auth"."uid"())))));



CREATE POLICY "Wali view kesehatan" ON "public"."kesehatan_santri" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri"
  WHERE (("santri"."nis" = "kesehatan_santri"."santri_nis") AND ("santri"."wali_id" = "auth"."uid"())))));



CREATE POLICY "Wali view own bills" ON "public"."tagihan_santri" FOR SELECT TO "authenticated" USING (((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'wali'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."santri"
  WHERE (("santri"."nis" = "tagihan_santri"."santri_nis") AND ("santri"."wali_id" = "auth"."uid"()))))));



CREATE POLICY "Wali view own hafalan tahfidz" ON "public"."hafalan_tahfidz" FOR SELECT TO "authenticated" USING (((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'wali'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."santri"
  WHERE (("santri"."nis" = "hafalan_tahfidz"."santri_nis") AND ("santri"."wali_id" = "auth"."uid"()))))));



CREATE POLICY "Wali view own santri" ON "public"."santri" FOR SELECT TO "authenticated" USING (((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'wali'::"text") AND ("wali_id" = "auth"."uid"())));



CREATE POLICY "Wali view pelanggaran" ON "public"."pelanggaran_santri" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri"
  WHERE (("santri"."nis" = "pelanggaran_santri"."santri_nis") AND ("santri"."wali_id" = "auth"."uid"())))));



CREATE POLICY "Wali view perizinan" ON "public"."perizinan_santri" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri"
  WHERE (("santri"."nis" = "perizinan_santri"."santri_nis") AND ("santri"."wali_id" = "auth"."uid"())))));



ALTER TABLE "public"."alumni_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alumni_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."berita" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_ciphertexts_insert_for_conversation_participants" ON "public"."chat_message_device_ciphertexts" FOR INSERT TO "authenticated" WITH CHECK (("app_private"."is_chat_participant"("conversation_id", "auth"."uid"()) AND "app_private"."is_chat_participant"("conversation_id", "recipient_user_id")));



CREATE POLICY "chat_ciphertexts_select_own_recipient" ON "public"."chat_message_device_ciphertexts" FOR SELECT TO "authenticated" USING (("recipient_user_id" = "auth"."uid"()));



ALTER TABLE "public"."chat_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_device_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_device_keys_insert_own" ON "public"."chat_device_keys" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "chat_device_keys_select_conversation_participants" ON "public"."chat_device_keys" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."chat_participants" "me"
     JOIN "public"."chat_participants" "other_participant" ON (("other_participant"."conversation_id" = "me"."conversation_id")))
  WHERE (("me"."user_id" = "auth"."uid"()) AND ("other_participant"."user_id" = "chat_device_keys"."user_id"))))));



CREATE POLICY "chat_device_keys_update_own" ON "public"."chat_device_keys" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."chat_key_backups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_key_backups_insert_own" ON "public"."chat_key_backups" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "chat_key_backups_select_own" ON "public"."chat_key_backups" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "chat_key_backups_update_own" ON "public"."chat_key_backups" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."chat_message_device_ciphertexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_message_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_user_presence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."config_diklat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crypto_keystores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."detail_transaksi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dompet_santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_moderation_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."geocode_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."geocode_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hafalan_kitab" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hafalan_tahfidz" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."info_rekening_santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."instansi_info" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kantin_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kantin_devices_admin_select" ON "public"."kantin_devices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



CREATE POLICY "kantin_devices_owner_select" ON "public"."kantin_devices" FOR SELECT TO "authenticated" USING (("kantin_user_id" = "auth"."uid"()));



ALTER TABLE "public"."kesehatan_santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."log_aktivitas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_kitab" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mata_pelajaran" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."midtrans_webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."murojaah_tahfidz" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nilai_santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pelanggaran_santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pengeluaran" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perizinan_santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."peserta_diklat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prestasi_santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."question_bank" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rag_chunks_admin_insert" ON "public"."rag_document_chunks" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text"]));



CREATE POLICY "rag_chunks_admin_read_all" ON "public"."rag_document_chunks" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text"]));



CREATE POLICY "rag_chunks_admin_update" ON "public"."rag_document_chunks" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text"])) WITH CHECK ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text"]));



CREATE POLICY "rag_chunks_public_read_active" ON "public"."rag_document_chunks" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."rag_documents" "d"
  WHERE (("d"."id" = "rag_document_chunks"."document_id") AND ("d"."status" = 'active'::"text") AND ("d"."source_type" = ANY (ARRAY['public'::"text", 'kitab'::"text"]))))));



CREATE POLICY "rag_chunks_super_admin_delete" ON "public"."rag_document_chunks" FOR DELETE TO "authenticated" USING ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text"]));



ALTER TABLE "public"."rag_document_chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rag_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rag_documents_admin_insert" ON "public"."rag_documents" FOR INSERT TO "authenticated" WITH CHECK ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text"]));



CREATE POLICY "rag_documents_admin_read_all" ON "public"."rag_documents" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text"]));



CREATE POLICY "rag_documents_admin_update" ON "public"."rag_documents" FOR UPDATE TO "authenticated" USING ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text"])) WITH CHECK ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text"]));



CREATE POLICY "rag_documents_public_read_active" ON "public"."rag_documents" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'active'::"text") AND ("source_type" = ANY (ARRAY['public'::"text", 'kitab'::"text"]))));



CREATE POLICY "rag_documents_super_admin_delete" ON "public"."rag_documents" FOR DELETE TO "authenticated" USING ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text"]));



CREATE POLICY "rag_logs_admin_select" ON "public"."rag_query_logs" FOR SELECT TO "authenticated" USING ("app_private"."current_user_has_role"(ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text"]));



CREATE POLICY "rag_logs_user_insert_own" ON "public"."rag_query_logs" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."rag_query_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rag_rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rag_rate_limits_no_client_access" ON "public"."rag_rate_limits" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."ref_jenis_pembayaran" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tagihan_santri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaksi_dompet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaksi_keuangan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_accounts_auditor_read" ON "public"."dompet_santri" FOR SELECT TO "authenticated" USING ("app_private"."is_wallet_auditor"());



CREATE POLICY "wallet_accounts_wali_read_own" ON "public"."dompet_santri" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "dompet_santri"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "wallet_audit_auditor_read" ON "public"."wallet_audit_logs" FOR SELECT TO "authenticated" USING ("app_private"."is_wallet_auditor"());



ALTER TABLE "public"."wallet_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_audit_wali_read_own" ON "public"."wallet_audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "wallet_audit_logs"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "wallet_auth_kantin_read_own" ON "public"."wallet_authorization_sessions" FOR SELECT TO "authenticated" USING ((("app_private"."current_user_role"() = 'kantin'::"text") AND ("kantin_user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "wallet_auth_wali_read_own" ON "public"."wallet_authorization_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "wallet_authorization_sessions"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."wallet_authorization_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_card_qr_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_card_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_card_tokens_auditor_read" ON "public"."wallet_card_tokens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"]))))));



CREATE POLICY "wallet_card_tokens_service_manage" ON "public"."wallet_card_tokens" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "wallet_card_tokens_wali_read" ON "public"."wallet_card_tokens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "wallet_card_tokens"."santri_nis") AND ("s"."wali_id" = "auth"."uid"())))));



ALTER TABLE "public"."wallet_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_devices_owner_insert" ON "public"."wallet_devices" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "wallet_devices_owner_read" ON "public"."wallet_devices" FOR SELECT TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "wallet_devices_owner_update" ON "public"."wallet_devices" FOR UPDATE TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."wallet_disputes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_disputes_admin_select" ON "public"."wallet_disputes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



CREATE POLICY "wallet_disputes_wali_select" ON "public"."wallet_disputes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "wallet_disputes"."santri_nis") AND ("s"."wali_id" = "auth"."uid"())))));



CREATE POLICY "wallet_intents_auditor_read" ON "public"."wallet_payment_intents" FOR SELECT TO "authenticated" USING ("app_private"."is_wallet_auditor"());



CREATE POLICY "wallet_intents_kantin_read_own" ON "public"."wallet_payment_intents" FOR SELECT TO "authenticated" USING ((("app_private"."current_user_role"() = 'kantin'::"text") AND ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "wallet_intents_wali_read_own" ON "public"."wallet_payment_intents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "wallet_payment_intents"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "wallet_key_rotation_auditor_read" ON "public"."wallet_key_rotation_logs" FOR SELECT TO "authenticated" USING ("app_private"."is_wallet_auditor"());



ALTER TABLE "public"."wallet_key_rotation_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_key_rotation_service_manage" ON "public"."wallet_key_rotation_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "wallet_keystore_wali_insert_own" ON "public"."crypto_keystores" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "crypto_keystores"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "wallet_keystore_wali_read_own" ON "public"."crypto_keystores" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "crypto_keystores"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "wallet_keystore_wali_update_own" ON "public"."crypto_keystores" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "crypto_keystores"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "crypto_keystores"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "wallet_ledger_auditor_read" ON "public"."transaksi_dompet" FOR SELECT TO "authenticated" USING ("app_private"."is_wallet_auditor"());



CREATE POLICY "wallet_ledger_integrity_admin_select" ON "public"."wallet_ledger_integrity_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."wallet_ledger_integrity_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_ledger_kantin_read_own" ON "public"."transaksi_dompet" FOR SELECT TO "authenticated" USING ((("app_private"."current_user_role"() = 'kantin'::"text") AND ("actor_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "wallet_ledger_wali_read_own" ON "public"."transaksi_dompet" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "transaksi_dompet"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."wallet_merchant_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_merchant_balances_admin_read" ON "public"."wallet_merchant_balances" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



CREATE POLICY "wallet_merchant_balances_assigned_kantin_read" ON "public"."wallet_merchant_balances" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."wallet_merchant_users" "wmu"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("wmu"."profile_id" = "auth"."uid"()) AND ("wmu"."merchant_id" = "wallet_merchant_balances"."merchant_id") AND (("wmu"."outlet_id" IS NULL) OR (NOT ("wmu"."outlet_id" IS DISTINCT FROM "wallet_merchant_balances"."outlet_id"))) AND ("wmu"."status" = 'active'::"text") AND ("p"."role" = 'kantin'::"text") AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."wallet_merchant_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_merchant_ledger_admin_read" ON "public"."wallet_merchant_ledger" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



CREATE POLICY "wallet_merchant_ledger_assigned_kantin_read" ON "public"."wallet_merchant_ledger" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."wallet_merchant_users" "wmu"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("wmu"."profile_id" = "auth"."uid"()) AND ("wmu"."merchant_id" = "wallet_merchant_ledger"."merchant_id") AND (("wmu"."outlet_id" IS NULL) OR (NOT ("wmu"."outlet_id" IS DISTINCT FROM "wallet_merchant_ledger"."outlet_id"))) AND ("wmu"."status" = 'active'::"text") AND ("p"."role" = 'kantin'::"text") AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."wallet_merchant_outlets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_merchant_outlets_assigned_kantin_read" ON "public"."wallet_merchant_outlets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."wallet_merchant_users" "wmu"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("wmu"."merchant_id" = "wallet_merchant_outlets"."merchant_id") AND ("wmu"."profile_id" = "auth"."uid"()) AND (("wmu"."outlet_id" IS NULL) OR ("wmu"."outlet_id" = "wallet_merchant_outlets"."id")) AND ("wmu"."status" = 'active'::"text") AND ("p"."role" = 'kantin'::"text")))));



CREATE POLICY "wallet_merchant_outlets_auditor_read" ON "public"."wallet_merchant_outlets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"]))))));



CREATE POLICY "wallet_merchant_outlets_service_manage" ON "public"."wallet_merchant_outlets" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "wallet_merchant_settlement_admin_read" ON "public"."wallet_merchant_settlement_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



CREATE POLICY "wallet_merchant_settlement_assigned_kantin_read" ON "public"."wallet_merchant_settlement_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."wallet_merchant_users" "wmu"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("wmu"."profile_id" = "auth"."uid"()) AND ("wmu"."merchant_id" = "wallet_merchant_settlement_requests"."merchant_id") AND (("wmu"."outlet_id" IS NULL) OR (NOT ("wmu"."outlet_id" IS DISTINCT FROM "wallet_merchant_settlement_requests"."outlet_id"))) AND ("wmu"."status" = 'active'::"text") AND ("p"."role" = 'kantin'::"text") AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."wallet_merchant_settlement_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_merchant_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_merchant_users_auditor_read" ON "public"."wallet_merchant_users" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"]))))));



CREATE POLICY "wallet_merchant_users_self_read" ON "public"."wallet_merchant_users" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "wallet_merchant_users_service_manage" ON "public"."wallet_merchant_users" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."wallet_merchants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_merchants_assigned_kantin_read" ON "public"."wallet_merchants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."wallet_merchant_users" "wmu"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("wmu"."merchant_id" = "wallet_merchants"."id") AND ("wmu"."profile_id" = "auth"."uid"()) AND ("wmu"."status" = 'active'::"text") AND ("p"."role" = 'kantin'::"text")))));



CREATE POLICY "wallet_merchants_auditor_read" ON "public"."wallet_merchants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"]))))));



CREATE POLICY "wallet_merchants_service_manage" ON "public"."wallet_merchants" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."wallet_nonce_uses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_nonce_uses_service_manage" ON "public"."wallet_nonce_uses" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."wallet_nonces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_nonces_service_manage" ON "public"."wallet_nonces" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."wallet_payment_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_pin_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_pin_attempts_auditor_read" ON "public"."wallet_pin_attempts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



CREATE POLICY "wallet_qr_auditor_read" ON "public"."wallet_card_qr_versions" FOR SELECT TO "authenticated" USING ("app_private"."is_wallet_auditor"());



CREATE POLICY "wallet_qr_wali_read_own" ON "public"."wallet_card_qr_versions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."santri" "s"
  WHERE (("s"."nis" = "wallet_card_qr_versions"."santri_nis") AND ("s"."wali_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "wallet_reconciliation_admin_select" ON "public"."wallet_reconciliation_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."wallet_reconciliation_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_risk_admin_select" ON "public"."wallet_risk_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."wallet_risk_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_security_ai_analyses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_security_ai_analyses_select_roles" ON "public"."wallet_security_ai_analyses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" IS TRUE) AND ("lower"(COALESCE("p"."role", ''::"text")) = ANY (ARRAY['super_admin'::"text", 'rois'::"text", 'dewan'::"text", 'bendahara'::"text"]))))));



ALTER TABLE "public"."wallet_security_audit_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_security_audit_runs_admin_select" ON "public"."wallet_security_audit_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."wallet_system_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_system_controls_admin_select" ON "public"."wallet_system_controls" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."wallet_weekly_digest_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_weekly_digest_runs_auditor_read" ON "public"."wallet_weekly_digest_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['super_admin'::"text", 'bendahara'::"text", 'rois'::"text", 'dewan'::"text"])) AND COALESCE("p"."is_active", true)))));



ALTER TABLE "public"."weekly_tests" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_geocode_to_santri"("p_nis" "text", "p_lat" double precision, "p_lon" double precision, "p_provider" "text", "p_confidence" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_geocode_to_santri"("p_nis" "text", "p_lat" double precision, "p_lon" double precision, "p_provider" "text", "p_confidence" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_geocode_to_santri"("p_nis" "text", "p_lat" double precision, "p_lon" double precision, "p_provider" "text", "p_confidence" double precision) TO "service_role";



REVOKE ALL ON FUNCTION "public"."broadcast_notification_v2"("p_title" "text", "p_body" "text", "p_target_kelas" "text", "p_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."broadcast_notification_v2"("p_title" "text", "p_body" "text", "p_target_kelas" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_notification_v2"("p_title" "text", "p_body" "text", "p_target_kelas" "text", "p_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."broadcast_notification_v3"("p_title" "text", "p_body" "text", "p_target_kelas" "text", "p_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."broadcast_notification_v3"("p_title" "text", "p_body" "text", "p_target_kelas" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_notification_v3"("p_title" "text", "p_body" "text", "p_target_kelas" "text", "p_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_access_scope"("target_gender" "text", "target_jurusan" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_access_scope"("target_gender" "text", "target_jurusan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_access_scope"("target_gender" "text", "target_jurusan" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_notification_for_wali"("p_santri_nis" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_notification_for_wali"("p_santri_nis" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_santri_secure"("p_payload" "jsonb", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_santri_secure"("p_payload" "jsonb", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_santri_secure"("p_payload" "jsonb", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."export_emis_pesantren_santri"("p_status" "text", "p_tahun_masuk" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."export_emis_pesantren_santri"("p_status" "text", "p_tahun_masuk" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_emis_pesantren_santri"("p_status" "text", "p_tahun_masuk" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."export_santri_emis"("p_status" "text", "p_tahun_masuk" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."export_santri_emis"("p_status" "text", "p_tahun_masuk" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_santri_emis"("p_status" "text", "p_tahun_masuk" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_sync_diklat_to_transaksi"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_sync_diklat_to_transaksi"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_sync_pengeluaran_to_transaksi"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_sync_pengeluaran_to_transaksi"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_sync_tagihan_to_transaksi"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_sync_tagihan_to_transaksi"() TO "service_role";



GRANT ALL ON FUNCTION "public"."format_rupiah"("nominal" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."format_rupiah"("nominal" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_rupiah"("nominal" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_chat_admin_monitor"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_chat_admin_monitor"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_choropleth_data"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_choropleth_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_choropleth_data"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rag_admin_context"("p_context_type" "text", "p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_rag_admin_context"("p_context_type" "text", "p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rag_admin_context"("p_context_type" "text", "p_filters" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_santri_admin"("p_search" "text", "p_kelas" "text", "p_jurusan" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_santri_admin"("p_search" "text", "p_kelas" "text", "p_jurusan" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_santri_admin"("p_search" "text", "p_kelas" "text", "p_jurusan" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_santri_detail_secure"("p_nis" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_santri_detail_secure"("p_nis" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_santri_detail_secure"("p_nis" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_wali_santri_detail_secure"("p_nis" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_wali_santri_detail_secure"("p_nis" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_wali_santri_detail_secure"("p_nis" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin_in_roles"("allowed_roles" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin_in_roles"("allowed_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_in_roles"("allowed_roles" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_chat_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_chat_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_wali_santri_secure"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_wali_santri_secure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_wali_santri_secure"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_questions_as_used"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_questions_as_used"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_questions_as_used"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_internal_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_internal_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_internal_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_kitab_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_kitab_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_kitab_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_public_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_public_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_public_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_rag_chunks"("query_embedding" "extensions"."vector", "match_source_type" "text", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_rag_chunks"("query_embedding" "extensions"."vector", "match_source_type" "text", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_rag_chunks"("query_embedding" "extensions"."vector", "match_source_type" "text", "match_threshold" double precision, "match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_my_fcm_device"("p_fcm_token" "text", "p_device_id" "text", "p_platform" "text", "p_app_instance_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_my_fcm_device"("p_fcm_token" "text", "p_device_id" "text", "p_platform" "text", "p_app_instance_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_my_fcm_device"("p_fcm_token" "text", "p_device_id" "text", "p_platform" "text", "p_app_instance_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_user_fcm_device"("p_user_id" "uuid", "p_fcm_token" "text", "p_device_id" "text", "p_platform" "text", "p_app_instance_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_user_fcm_device"("p_user_id" "uuid", "p_fcm_token" "text", "p_device_id" "text", "p_platform" "text", "p_app_instance_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_pelanggaran"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_pelanggaran"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_pelanggaran"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_wallet_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_wallet_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_wallet_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."terima_bayar_manual"("p_tagihan_id" "uuid", "p_admin_id" "uuid", "p_keterangan" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."terima_bayar_manual"("p_tagihan_id" "uuid", "p_admin_id" "uuid", "p_keterangan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."terima_bayar_manual"("p_tagihan_id" "uuid", "p_admin_id" "uuid", "p_keterangan" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_notify_kesehatan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_notify_kesehatan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_notify_pelanggaran"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_notify_pelanggaran"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_notify_perizinan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_notify_perizinan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_notify_tagihan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_notify_tagihan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_user_devices_single_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_user_devices_single_owner"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_dispute"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_dispute"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_freeze"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_freeze"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_integrity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_kantin_device"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_kantin_device"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_payment_intent_failure"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_payment_intent_failure"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_reconciliation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_reconciliation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_risk_event"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_risk_event"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_transaction"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_transaction"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tr_wallet_notify_user_device"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tr_wallet_notify_user_device"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_alumni_admin_profile"("p_alumni_id" "uuid", "p_full_name" "text", "p_is_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_alumni_admin_profile"("p_alumni_id" "uuid", "p_full_name" "text", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_alumni_admin_profile"("p_alumni_id" "uuid", "p_full_name" "text", "p_is_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_santri_secure"("p_nis" "text", "p_payload" "jsonb", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_santri_secure"("p_nis" "text", "p_payload" "jsonb", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_santri_secure"("p_nis" "text", "p_payload" "jsonb", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_coords_and_set_geom"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_coords_and_set_geom"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_coords_and_set_geom"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_santri_emis"("p_nis_list" "text"[], "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_santri_emis"("p_nis_list" "text"[], "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_santri_emis"("p_nis_list" "text"[], "p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_wallet_ledger_integrity"("p_santri_nis" "text", "p_from_date" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_wallet_ledger_integrity"("p_santri_nis" "text", "p_from_date" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_acknowledge_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_acknowledge_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_assign_kantin_merchant"("p_kantin_user_id" "uuid", "p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_merchant_role" "text", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_assign_kantin_merchant"("p_kantin_user_id" "uuid", "p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_merchant_role" "text", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_attach_merchant_settlement_proof"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_storage_path" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_attach_merchant_settlement_proof"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_storage_path" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_broadcast_maintenance"("p_title" "text", "p_body" "text", "p_start_at" timestamp with time zone, "p_duration_minutes" integer, "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_broadcast_maintenance"("p_title" "text", "p_body" "text", "p_start_at" timestamp with time zone, "p_duration_minutes" integer, "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_confirm_kantin_payment"("p_authorization_session_id" "uuid", "p_approved_by" "uuid", "p_approved_device_id" "text", "p_signature" "text", "p_signature_public_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_confirm_kantin_payment"("p_authorization_session_id" "uuid", "p_approved_by" "uuid", "p_approved_device_id" "text", "p_signature" "text", "p_signature_public_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_confirm_kantin_student_payment"("p_authorization_session_id" "uuid", "p_student_proof_reference" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_confirm_kantin_student_payment"("p_authorization_session_id" "uuid", "p_student_proof_reference" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_create_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_create_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_create_kantin_authorization_session"("p_wallet_public_id" "uuid", "p_amount" bigint, "p_kantin_user_id" "uuid", "p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_create_kantin_authorization_session"("p_wallet_public_id" "uuid", "p_amount" bigint, "p_kantin_user_id" "uuid", "p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_credit_merchant_from_posted_intent"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_credit_merchant_from_posted_intent"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_detect_transaction_risk"("p_santri_nis" "text", "p_amount" bigint, "p_kantin_user_id" "uuid", "p_device_id" "text", "p_merchant_id" "uuid", "p_outlet_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_detect_transaction_risk"("p_santri_nis" "text", "p_amount" bigint, "p_kantin_user_id" "uuid", "p_device_id" "text", "p_merchant_id" "uuid", "p_outlet_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_enqueue_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_enqueue_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_escalate_overdue_disputes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_escalate_overdue_disputes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_escalate_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_escalate_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_investigate_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_investigate_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_lock_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_lock_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_mark_merchant_settlement_paid"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_mark_merchant_settlement_paid"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_notify_limit_event"("p_santri_nis" "text", "p_limit_type" "text", "p_limit_amount" bigint, "p_current_amount" bigint, "p_attempt_amount" bigint, "p_blocked" boolean, "p_reference_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_notify_limit_event"("p_santri_nis" "text", "p_limit_type" "text", "p_limit_amount" bigint, "p_current_amount" bigint, "p_attempt_amount" bigint, "p_blocked" boolean, "p_reference_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_notify_role"("p_role" "text", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_notify_role"("p_role" "text", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_notify_roles"("p_roles" "text"[], "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_notify_roles"("p_roles" "text"[], "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_notify_wali"("p_santri_nis" "text", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_notify_wali"("p_santri_nis" "text", "p_title" "text", "p_body" "text", "p_event_type" "text", "p_source" "text", "p_data" "jsonb", "p_priority" "text", "p_reference_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_open_dispute"("p_ledger_id" bigint, "p_reported_by" "uuid", "p_reason" "text", "p_evidence" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_open_dispute"("p_ledger_id" bigint, "p_reported_by" "uuid", "p_reason" "text", "p_evidence" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_post_merchant_ledger"("p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_direction" "text", "p_category" "text", "p_amount" bigint, "p_idempotency_key" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_santri_ledger_id" bigint, "p_payment_intent_id" "uuid", "p_settlement_request_id" "uuid", "p_keterangan" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_post_merchant_ledger"("p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_direction" "text", "p_category" "text", "p_amount" bigint, "p_idempotency_key" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_santri_ledger_id" bigint, "p_payment_intent_id" "uuid", "p_settlement_request_id" "uuid", "p_keterangan" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_post_transaction"("p_santri_nis" "text", "p_direction" "public"."wallet_direction", "p_category" "public"."tipe_kategori_transaksi", "p_amount" bigint, "p_actor_id" "uuid", "p_actor_role" "text", "p_idempotency_key" "text", "p_keterangan" "text", "p_counterparty_id" "uuid", "p_counterparty_role" "text", "p_transaksi_keuangan_id" "uuid", "p_payment_intent_id" "uuid", "p_nonce" "text", "p_signature" "text", "p_signature_public_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_post_transaction"("p_santri_nis" "text", "p_direction" "public"."wallet_direction", "p_category" "public"."tipe_kategori_transaksi", "p_amount" bigint, "p_actor_id" "uuid", "p_actor_role" "text", "p_idempotency_key" "text", "p_keterangan" "text", "p_counterparty_id" "uuid", "p_counterparty_role" "text", "p_transaksi_keuangan_id" "uuid", "p_payment_intent_id" "uuid", "p_nonce" "text", "p_signature" "text", "p_signature_public_key" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_record_pin_failure"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_device_id" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_record_pin_failure"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_device_id" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_register_kantin_device"("p_kantin_user_id" "uuid", "p_device_id" "text", "p_device_fingerprint" "text", "p_public_key" "text", "p_registered_by" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_register_kantin_device"("p_kantin_user_id" "uuid", "p_device_id" "text", "p_device_fingerprint" "text", "p_public_key" "text", "p_registered_by" "uuid", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_reissue_card_qr"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_reissue_card_qr"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_reject_merchant_settlement"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_reject_merchant_settlement"("p_settlement_request_id" "uuid", "p_actor_id" "uuid", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_request_merchant_settlement"("p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_amount" bigint, "p_destination_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_request_merchant_settlement"("p_merchant_id" "uuid", "p_outlet_id" "uuid", "p_amount" bigint, "p_destination_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_resolve_dispute"("p_dispute_id" "uuid", "p_resolved_by" "uuid", "p_status" "text", "p_resolution_note" "text", "p_reversal_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_resolve_dispute"("p_dispute_id" "uuid", "p_resolved_by" "uuid", "p_status" "text", "p_resolution_note" "text", "p_reversal_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_resolve_integrity_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_resolution_status" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_resolve_integrity_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_resolution_status" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_resolve_reconciliation_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_resolution_status" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_resolve_reconciliation_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_resolution_status" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_resolve_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_status" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_resolve_risk_event"("p_risk_event_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_status" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_review_integrity_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_review_integrity_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_review_notification"("p_notification_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_review_status" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_review_notification"("p_notification_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_review_status" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_review_reconciliation_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_review_reconciliation_run"("p_run_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_run_ledger_integrity_check"("p_santri_nis" "text", "p_from_date" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_run_ledger_integrity_check"("p_santri_nis" "text", "p_from_date" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_run_reconciliation"("p_reserved_bank_balance" bigint, "p_triggered_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_run_reconciliation"("p_reserved_bank_balance" bigint, "p_triggered_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_run_security_audit"("p_triggered_by" "uuid", "p_triggered_by_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_run_security_audit"("p_triggered_by" "uuid", "p_triggered_by_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_run_weekly_digest"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_run_weekly_digest"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_set_kantin_account_status"("p_kantin_user_id" "uuid", "p_is_active" boolean, "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_set_kantin_account_status"("p_kantin_user_id" "uuid", "p_is_active" boolean, "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_set_kantin_device_status"("p_device_id" "text", "p_status" "text", "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_set_kantin_device_status"("p_device_id" "text", "p_status" "text", "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_set_merchant_status"("p_merchant_id" "uuid", "p_status" "text", "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_set_merchant_status"("p_merchant_id" "uuid", "p_status" "text", "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_set_student_pin_verifier"("p_santri_nis" "text", "p_actor_id" "uuid", "p_student_pin_salt" "text", "p_student_pin_verifier" "text", "p_student_pin_kdf" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_set_student_pin_verifier"("p_santri_nis" "text", "p_actor_id" "uuid", "p_student_pin_salt" "text", "p_student_pin_verifier" "text", "p_student_pin_kdf" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_set_system_freeze"("p_is_frozen" boolean, "p_reason" "text", "p_actor_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_set_system_freeze"("p_is_frozen" boolean, "p_reason" "text", "p_actor_id" "uuid", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_start_dispute_investigation"("p_dispute_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_start_dispute_investigation"("p_dispute_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_unlock_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_unlock_account"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wallet_update_limits"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_low_balance_threshold" bigint, "p_daily_spend_limit" bigint, "p_single_transaction_limit" bigint, "p_monthly_spend_limit" bigint, "p_large_transaction_threshold" bigint, "p_allowed_merchant_categories" "jsonb", "p_spending_schedule" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wallet_update_limits"("p_santri_nis" "text", "p_actor_id" "uuid", "p_actor_role" "text", "p_low_balance_threshold" bigint, "p_daily_spend_limit" bigint, "p_single_transaction_limit" bigint, "p_monthly_spend_limit" bigint, "p_large_transaction_threshold" bigint, "p_allowed_merchant_categories" "jsonb", "p_spending_schedule" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."alumni_data" TO "anon";
GRANT ALL ON TABLE "public"."alumni_data" TO "authenticated";
GRANT ALL ON TABLE "public"."alumni_data" TO "service_role";



GRANT ALL ON TABLE "public"."alumni_follows" TO "anon";
GRANT ALL ON TABLE "public"."alumni_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."alumni_follows" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."berita" TO "anon";
GRANT ALL ON TABLE "public"."berita" TO "authenticated";
GRANT ALL ON TABLE "public"."berita" TO "service_role";



GRANT ALL ON SEQUENCE "public"."berita_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."berita_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."berita_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chat_blocks" TO "anon";
GRANT ALL ON TABLE "public"."chat_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."chat_conversations" TO "anon";
GRANT ALL ON TABLE "public"."chat_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."chat_device_keys" TO "anon";
GRANT ALL ON TABLE "public"."chat_device_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_device_keys" TO "service_role";



GRANT ALL ON TABLE "public"."chat_key_backups" TO "anon";
GRANT ALL ON TABLE "public"."chat_key_backups" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_key_backups" TO "service_role";



GRANT ALL ON TABLE "public"."chat_message_device_ciphertexts" TO "anon";
GRANT ALL ON TABLE "public"."chat_message_device_ciphertexts" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_message_device_ciphertexts" TO "service_role";



GRANT ALL ON TABLE "public"."chat_message_reports" TO "anon";
GRANT ALL ON TABLE "public"."chat_message_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_message_reports" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."chat_user_presence" TO "anon";
GRANT ALL ON TABLE "public"."chat_user_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_user_presence" TO "service_role";



GRANT ALL ON TABLE "public"."config_diklat" TO "anon";
GRANT ALL ON TABLE "public"."config_diklat" TO "authenticated";
GRANT ALL ON TABLE "public"."config_diklat" TO "service_role";



GRANT ALL ON SEQUENCE "public"."config_diklat_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."config_diklat_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."config_diklat_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."crypto_keystores" TO "service_role";
GRANT SELECT ON TABLE "public"."crypto_keystores" TO "authenticated";



GRANT ALL ON TABLE "public"."detail_transaksi" TO "anon";
GRANT ALL ON TABLE "public"."detail_transaksi" TO "authenticated";
GRANT ALL ON TABLE "public"."detail_transaksi" TO "service_role";



GRANT ALL ON SEQUENCE "public"."detail_transaksi_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."detail_transaksi_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."detail_transaksi_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dompet_santri" TO "service_role";
GRANT SELECT ON TABLE "public"."dompet_santri" TO "authenticated";



GRANT ALL ON TABLE "public"."forum_attachments" TO "anon";
GRANT ALL ON TABLE "public"."forum_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."forum_comments" TO "anon";
GRANT ALL ON TABLE "public"."forum_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_comments" TO "service_role";



GRANT ALL ON TABLE "public"."forum_moderation_actions" TO "anon";
GRANT ALL ON TABLE "public"."forum_moderation_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_moderation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."forum_reactions" TO "anon";
GRANT ALL ON TABLE "public"."forum_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."forum_reports" TO "anon";
GRANT ALL ON TABLE "public"."forum_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_reports" TO "service_role";



GRANT ALL ON TABLE "public"."forum_threads" TO "anon";
GRANT ALL ON TABLE "public"."forum_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_threads" TO "service_role";



GRANT ALL ON TABLE "public"."geocode_cache" TO "service_role";



GRANT ALL ON SEQUENCE "public"."geocode_cache_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."geocode_cache_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."geocode_cache_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."geocode_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."geocode_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."geocode_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."geocode_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."hafalan_kitab" TO "anon";
GRANT ALL ON TABLE "public"."hafalan_kitab" TO "authenticated";
GRANT ALL ON TABLE "public"."hafalan_kitab" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hafalan_kitab_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hafalan_kitab_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hafalan_kitab_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."hafalan_tahfidz" TO "anon";
GRANT ALL ON TABLE "public"."hafalan_tahfidz" TO "authenticated";
GRANT ALL ON TABLE "public"."hafalan_tahfidz" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hafalan_tahfidz_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hafalan_tahfidz_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hafalan_tahfidz_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."info_rekening_santri" TO "anon";
GRANT ALL ON TABLE "public"."info_rekening_santri" TO "authenticated";
GRANT ALL ON TABLE "public"."info_rekening_santri" TO "service_role";



GRANT ALL ON SEQUENCE "public"."info_rekening_santri_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."info_rekening_santri_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."info_rekening_santri_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."instansi_info" TO "anon";
GRANT ALL ON TABLE "public"."instansi_info" TO "authenticated";
GRANT ALL ON TABLE "public"."instansi_info" TO "service_role";



GRANT ALL ON SEQUENCE "public"."instansi_info_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."instansi_info_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."instansi_info_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventaris" TO "anon";
GRANT ALL ON TABLE "public"."inventaris" TO "authenticated";
GRANT ALL ON TABLE "public"."inventaris" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventaris_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventaris_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventaris_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."kantin_devices" TO "service_role";
GRANT SELECT ON TABLE "public"."kantin_devices" TO "authenticated";



GRANT ALL ON TABLE "public"."kategori_barang" TO "anon";
GRANT ALL ON TABLE "public"."kategori_barang" TO "authenticated";
GRANT ALL ON TABLE "public"."kategori_barang" TO "service_role";



GRANT ALL ON SEQUENCE "public"."kategori_barang_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."kategori_barang_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."kategori_barang_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."kecamatan_polygons" TO "anon";
GRANT ALL ON TABLE "public"."kecamatan_polygons" TO "authenticated";
GRANT ALL ON TABLE "public"."kecamatan_polygons" TO "service_role";



GRANT ALL ON TABLE "public"."kesehatan_santri" TO "anon";
GRANT ALL ON TABLE "public"."kesehatan_santri" TO "authenticated";
GRANT ALL ON TABLE "public"."kesehatan_santri" TO "service_role";



GRANT ALL ON SEQUENCE "public"."kesehatan_santri_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."kesehatan_santri_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."kesehatan_santri_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."log_aktivitas" TO "anon";
GRANT ALL ON TABLE "public"."log_aktivitas" TO "authenticated";
GRANT ALL ON TABLE "public"."log_aktivitas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."log_aktivitas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."log_aktivitas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."log_aktivitas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lokasi_aset" TO "anon";
GRANT ALL ON TABLE "public"."lokasi_aset" TO "authenticated";
GRANT ALL ON TABLE "public"."lokasi_aset" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lokasi_aset_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lokasi_aset_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lokasi_aset_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master_kitab" TO "anon";
GRANT ALL ON TABLE "public"."master_kitab" TO "authenticated";
GRANT ALL ON TABLE "public"."master_kitab" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_kitab_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_kitab_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_kitab_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mata_pelajaran" TO "anon";
GRANT ALL ON TABLE "public"."mata_pelajaran" TO "authenticated";
GRANT ALL ON TABLE "public"."mata_pelajaran" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mata_pelajaran_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mata_pelajaran_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mata_pelajaran_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."midtrans_webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."murojaah_tahfidz" TO "anon";
GRANT ALL ON TABLE "public"."murojaah_tahfidz" TO "authenticated";
GRANT ALL ON TABLE "public"."murojaah_tahfidz" TO "service_role";



GRANT ALL ON SEQUENCE "public"."murojaah_tahfidz_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."murojaah_tahfidz_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."murojaah_tahfidz_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."nilai_santri" TO "anon";
GRANT ALL ON TABLE "public"."nilai_santri" TO "authenticated";
GRANT ALL ON TABLE "public"."nilai_santri" TO "service_role";



GRANT ALL ON SEQUENCE "public"."nilai_santri_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."nilai_santri_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."nilai_santri_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notification_queue" TO "anon";
GRANT ALL ON TABLE "public"."notification_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_queue" TO "service_role";



GRANT ALL ON TABLE "public"."pelanggaran_santri" TO "anon";
GRANT ALL ON TABLE "public"."pelanggaran_santri" TO "authenticated";
GRANT ALL ON TABLE "public"."pelanggaran_santri" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pelanggaran_santri_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pelanggaran_santri_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pelanggaran_santri_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pengeluaran" TO "anon";
GRANT ALL ON TABLE "public"."pengeluaran" TO "authenticated";
GRANT ALL ON TABLE "public"."pengeluaran" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pengeluaran_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pengeluaran_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pengeluaran_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."perizinan_santri" TO "anon";
GRANT ALL ON TABLE "public"."perizinan_santri" TO "authenticated";
GRANT ALL ON TABLE "public"."perizinan_santri" TO "service_role";



GRANT ALL ON SEQUENCE "public"."perizinan_santri_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."perizinan_santri_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."perizinan_santri_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."peserta_diklat" TO "anon";
GRANT ALL ON TABLE "public"."peserta_diklat" TO "authenticated";
GRANT ALL ON TABLE "public"."peserta_diklat" TO "service_role";



GRANT ALL ON SEQUENCE "public"."peserta_diklat_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."peserta_diklat_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."peserta_diklat_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prestasi_santri" TO "anon";
GRANT ALL ON TABLE "public"."prestasi_santri" TO "authenticated";
GRANT ALL ON TABLE "public"."prestasi_santri" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prestasi_santri_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prestasi_santri_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prestasi_santri_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."question_bank" TO "anon";
GRANT ALL ON TABLE "public"."question_bank" TO "authenticated";
GRANT ALL ON TABLE "public"."question_bank" TO "service_role";



GRANT ALL ON TABLE "public"."rag_document_chunks" TO "anon";
GRANT ALL ON TABLE "public"."rag_document_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_document_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."rag_documents" TO "anon";
GRANT ALL ON TABLE "public"."rag_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_documents" TO "service_role";



GRANT ALL ON TABLE "public"."rag_query_logs" TO "anon";
GRANT ALL ON TABLE "public"."rag_query_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_query_logs" TO "service_role";



GRANT ALL ON TABLE "public"."rag_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rag_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."ref_jenis_pembayaran" TO "anon";
GRANT ALL ON TABLE "public"."ref_jenis_pembayaran" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_jenis_pembayaran" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ref_jenis_pembayaran_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ref_jenis_pembayaran_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ref_jenis_pembayaran_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."santri" TO "anon";
GRANT ALL ON TABLE "public"."santri" TO "authenticated";
GRANT ALL ON TABLE "public"."santri" TO "service_role";



GRANT ALL ON TABLE "public"."struktur_organisasi" TO "anon";
GRANT ALL ON TABLE "public"."struktur_organisasi" TO "authenticated";
GRANT ALL ON TABLE "public"."struktur_organisasi" TO "service_role";



GRANT ALL ON SEQUENCE "public"."struktur_organisasi_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."struktur_organisasi_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."struktur_organisasi_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tagihan_santri" TO "anon";
GRANT ALL ON TABLE "public"."tagihan_santri" TO "authenticated";
GRANT ALL ON TABLE "public"."tagihan_santri" TO "service_role";



GRANT ALL ON TABLE "public"."test_questions" TO "anon";
GRANT ALL ON TABLE "public"."test_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."test_questions" TO "service_role";



GRANT ALL ON TABLE "public"."test_submissions" TO "anon";
GRANT ALL ON TABLE "public"."test_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."test_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."transaksi_dompet" TO "service_role";
GRANT SELECT ON TABLE "public"."transaksi_dompet" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."transaksi_dompet_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transaksi_dompet_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transaksi_dompet_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transaksi_keuangan" TO "anon";
GRANT ALL ON TABLE "public"."transaksi_keuangan" TO "authenticated";
GRANT ALL ON TABLE "public"."transaksi_keuangan" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



GRANT ALL ON TABLE "public"."view_admin_wallet_status" TO "anon";
GRANT ALL ON TABLE "public"."view_admin_wallet_status" TO "authenticated";
GRANT ALL ON TABLE "public"."view_admin_wallet_status" TO "service_role";



GRANT ALL ON TABLE "public"."view_kantin_transaction_history" TO "anon";
GRANT ALL ON TABLE "public"."view_kantin_transaction_history" TO "authenticated";
GRANT ALL ON TABLE "public"."view_kantin_transaction_history" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_audit_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_audit_logs" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_authorization_sessions" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_authorization_sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_card_qr_versions" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_card_qr_versions" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_card_tokens" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_card_tokens" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_devices" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_devices" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_disputes" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_disputes" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_key_rotation_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_key_rotation_logs" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_ledger_integrity_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_ledger_integrity_runs" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_merchant_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_merchant_balances" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_merchant_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_merchant_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wallet_merchant_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wallet_merchant_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wallet_merchant_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_merchant_outlets" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_merchant_outlets" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_merchant_settlement_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_merchant_settlement_requests" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_merchant_users" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_merchant_users" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_merchants" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_merchants" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_nonce_uses" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_nonce_uses" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_nonces" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_nonces" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_payment_intents" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_payment_intents" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_pin_attempts" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_pin_attempts" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_reconciliation_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_reconciliation_runs" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_risk_events" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_risk_events" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_security_ai_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_security_ai_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_security_audit_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_security_audit_runs" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_system_controls" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_system_controls" TO "authenticated";



GRANT ALL ON TABLE "public"."wallet_weekly_digest_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."wallet_weekly_digest_runs" TO "authenticated";



GRANT ALL ON TABLE "public"."weekly_tests" TO "anon";
GRANT ALL ON TABLE "public"."weekly_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_tests" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







