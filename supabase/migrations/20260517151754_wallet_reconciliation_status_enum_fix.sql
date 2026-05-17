-- wallet_account_status currently supports active, locked, and closed.
-- Re-apply reconciliation with enum-safe liability statuses only.

create or replace function public.wallet_run_reconciliation(
  p_reserved_bank_balance bigint default null,
  p_triggered_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  v_internal_diff := v_ledger_net - v_cached;
  v_bank_diff := case when p_reserved_bank_balance is null then null else v_ledger_net - p_reserved_bank_balance end;

  if v_internal_diff <> 0 then
    v_status := 'failed';
    v_freeze := true;
    perform public.wallet_set_system_freeze(
      true,
      'wallet_reconciliation_internal_mismatch',
      p_triggered_by,
      jsonb_build_object('run_id', v_run_id, 'difference_internal', v_internal_diff)
    );
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
      details = jsonb_build_object(
        'credit', v_credit,
        'debit', v_debit,
        'cached_balance_statuses', jsonb_build_array('active', 'locked')
      )
  where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', v_status,
    'ledger_net', v_ledger_net,
    'cached_balance_total', v_cached,
    'reserved_bank_balance', p_reserved_bank_balance,
    'difference_internal', v_internal_diff,
    'difference_bank', v_bank_diff,
    'freeze_triggered', v_freeze
  );
end;
$$;

revoke all on function public.wallet_run_reconciliation(bigint, uuid) from public, anon, authenticated;
grant execute on function public.wallet_run_reconciliation(bigint, uuid) to service_role;
