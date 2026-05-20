-- Tighten direct table privileges after JWT/service-role rotation.
-- RLS remains the primary row filter, but broad table grants are reduced so
-- exposed REST surfaces only allow operations intentionally used by clients.

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

revoke all on table public.alumni_data from anon, authenticated;
grant select, insert, update on table public.alumni_data to authenticated;

revoke all on table public.user_devices from anon, authenticated;
grant select, insert, update on table public.user_devices to authenticated;

revoke all on table public.notification_queue from anon, authenticated;
grant select, insert, update, delete on table public.notification_queue to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_queue'
      and policyname = 'Users can mark their own notifications read'
  ) then
    create policy "Users can mark their own notifications read"
      on public.notification_queue
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

revoke all on table public.wallet_merchant_settlement_requests from anon, authenticated;
grant select on table public.wallet_merchant_settlement_requests to authenticated;
