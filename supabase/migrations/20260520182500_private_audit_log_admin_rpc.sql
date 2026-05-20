-- Private audit log APIs for Admin Panel.
-- Admin panel should call the public wrappers; actual access control lives in app_private.

create or replace function app_private.assert_current_user_super_admin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select role
  into v_role
  from public.profiles
  where id = v_user_id
    and coalesce(is_active, true) = true;

  if coalesce(v_role, '') <> 'super_admin' then
    raise exception 'Hanya super admin yang boleh mengakses audit log private';
  end if;

  return v_user_id;
end;
$$;

create or replace function app_private.get_private_audit_log_page(
  p_component text default null,
  p_severity text default null,
  p_status text default null,
  p_table_name text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total_alerts integer := 0;
  v_total_finance_events integer := 0;
  v_alerts jsonb := '[]'::jsonb;
  v_finance_events jsonb := '[]'::jsonb;
begin
  perform app_private.assert_current_user_super_admin();

  select count(*)
  into v_total_alerts
  from ops.backend_alerts a
  where (p_component is null or a.component = p_component)
    and (p_severity is null or a.severity = p_severity)
    and (p_status is null or a.status = p_status)
    and (
      p_search is null
      or a.title ilike '%' || p_search || '%'
      or a.body ilike '%' || p_search || '%'
      or a.dedupe_key ilike '%' || p_search || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_alerts
  from (
    select
      a.id,
      a.severity,
      a.component,
      a.title,
      a.body,
      a.dedupe_key,
      a.metadata,
      a.status,
      a.occurrence_count,
      a.first_seen_at,
      a.last_seen_at,
      a.resolved_at,
      a.resolved_by
    from ops.backend_alerts a
    where (p_component is null or a.component = p_component)
      and (p_severity is null or a.severity = p_severity)
      and (p_status is null or a.status = p_status)
      and (
        p_search is null
        or a.title ilike '%' || p_search || '%'
        or a.body ilike '%' || p_search || '%'
        or a.dedupe_key ilike '%' || p_search || '%'
      )
    order by a.last_seen_at desc
    limit v_limit offset v_offset
  ) x;

  select count(*)
  into v_total_finance_events
  from ops.finance_audit_events e
  where (p_table_name is null or e.table_name = p_table_name)
    and (
      p_search is null
      or e.record_id ilike '%' || p_search || '%'
      or e.table_name ilike '%' || p_search || '%'
      or exists (
        select 1
        from unnest(e.changed_fields) f
        where f ilike '%' || p_search || '%'
      )
    );

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_finance_events
  from (
    select
      e.id,
      e.occurred_at,
      e.table_name,
      e.record_id,
      e.operation,
      e.actor_id,
      p.full_name as actor_name,
      p.role as actor_role,
      e.changed_fields,
      e.old_values,
      e.new_values,
      e.metadata
    from ops.finance_audit_events e
    left join public.profiles p on p.id = e.actor_id
    where (p_table_name is null or e.table_name = p_table_name)
      and (
        p_search is null
        or e.record_id ilike '%' || p_search || '%'
        or e.table_name ilike '%' || p_search || '%'
        or exists (
          select 1
          from unnest(e.changed_fields) f
          where f ilike '%' || p_search || '%'
        )
      )
    order by e.occurred_at desc
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object(
    'alerts', v_alerts,
    'finance_audit_events', v_finance_events,
    'pagination', jsonb_build_object(
      'limit', v_limit,
      'offset', v_offset,
      'total_alerts', v_total_alerts,
      'total_finance_audit_events', v_total_finance_events
    )
  );
end;
$$;

create or replace function app_private.get_private_audit_ai_context(
  p_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours integer := least(greatest(coalesce(p_hours, 24), 1), 168);
  v_result jsonb;
begin
  perform app_private.assert_current_user_super_admin();

  select jsonb_build_object(
    'generated_at', now(),
    'window_hours', v_hours,
    'open_alerts_by_severity', (
      select coalesce(jsonb_object_agg(severity, total), '{}'::jsonb)
      from (
        select severity, count(*) as total
        from ops.backend_alerts
        where status = 'open'
        group by severity
      ) s
    ),
    'recent_alerts', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from (
        select severity, component, title, body, occurrence_count, metadata, last_seen_at
        from ops.backend_alerts
        where last_seen_at >= now() - make_interval(hours => v_hours)
        order by last_seen_at desc
        limit 25
      ) a
    ),
    'finance_changes_by_table', (
      select coalesce(jsonb_object_agg(table_name, total), '{}'::jsonb)
      from (
        select table_name, count(*) as total
        from ops.finance_audit_events
        where occurred_at >= now() - make_interval(hours => v_hours)
        group by table_name
      ) t
    ),
    'recent_finance_changes', (
      select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
      from (
        select table_name, record_id, operation, changed_fields, metadata, occurred_at
        from ops.finance_audit_events
        where occurred_at >= now() - make_interval(hours => v_hours)
        order by occurred_at desc
        limit 25
      ) e
    )
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_private_audit_log_page(
  p_component text default null,
  p_severity text default null,
  p_status text default null,
  p_table_name text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.get_private_audit_log_page(
    p_component,
    p_severity,
    p_status,
    p_table_name,
    p_search,
    p_limit,
    p_offset
  );
$$;

create or replace function public.get_private_audit_ai_context(
  p_hours integer default 24
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.get_private_audit_ai_context(p_hours);
$$;

revoke all on function app_private.assert_current_user_super_admin() from public, anon, authenticated;
revoke all on function app_private.get_private_audit_log_page(text, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function app_private.get_private_audit_ai_context(integer) from public, anon, authenticated;

revoke all on function public.get_private_audit_log_page(text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.get_private_audit_log_page(text, text, text, text, text, integer, integer) to authenticated, service_role;

revoke all on function public.get_private_audit_ai_context(integer) from public, anon;
grant execute on function public.get_private_audit_ai_context(integer) to authenticated, service_role;
