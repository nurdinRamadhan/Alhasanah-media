create or replace function public.wallet_set_student_pin_verifier(
  p_santri_nis text,
  p_actor_id uuid,
  p_student_pin_salt text,
  p_student_pin_verifier text,
  p_student_pin_kdf jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.wallet_set_student_pin_verifier(text, uuid, text, text, jsonb) from anon;
revoke all on function public.wallet_set_student_pin_verifier(text, uuid, text, text, jsonb) from authenticated;
