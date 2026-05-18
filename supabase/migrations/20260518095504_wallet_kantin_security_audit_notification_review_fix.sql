do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.wallet_run_security_audit(uuid,text)'::regprocedure)
  into v_def;

  v_def := replace(
    v_def,
    'coalesce(metadata->>''review_status'', '''')',
    'coalesce(wallet_review_status, '''')'
  );

  execute v_def;
end;
$$;

revoke all on function public.wallet_run_security_audit(uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_run_security_audit(uuid, text) to service_role;
