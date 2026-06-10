create table if not exists public.ai_agent_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Chat Agent',
  caller_role text not null,
  akses_gender text not null default 'ALL',
  akses_jurusan text not null default 'ALL',
  gemini_history jsonb not null default '[]'::jsonb,
  action_draft_args jsonb not null default '{}'::jsonb,
  last_message_preview text,
  message_count integer not null default 0,
  action_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_agent_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_agent_chat_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_message_id text not null,
  role text not null check (role in ('user', 'assistant', 'system', 'action')),
  content text not null default '',
  action_data jsonb,
  action_status text,
  result_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, client_message_id)
);

create index if not exists idx_ai_agent_chat_sessions_user_updated
  on public.ai_agent_chat_sessions (user_id, updated_at desc);

create index if not exists idx_ai_agent_chat_messages_session_created
  on public.ai_agent_chat_messages (session_id, created_at);

create or replace function public.set_ai_agent_chat_session_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_agent_chat_sessions_updated_at on public.ai_agent_chat_sessions;
create trigger trg_ai_agent_chat_sessions_updated_at
before update on public.ai_agent_chat_sessions
for each row execute function public.set_ai_agent_chat_session_updated_at();

create or replace function public.refresh_ai_agent_chat_session_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  v_session_id := coalesce(new.session_id, old.session_id);

  update public.ai_agent_chat_sessions s
  set
    message_count = (
      select count(*)::integer
      from public.ai_agent_chat_messages m
      where m.session_id = v_session_id
    ),
    action_count = (
      select count(*)::integer
      from public.ai_agent_chat_messages m
      where m.session_id = v_session_id
        and m.role = 'action'
    ),
    last_message_preview = (
      select left(nullif(m.content, ''), 180)
      from public.ai_agent_chat_messages m
      where m.session_id = v_session_id
      order by m.created_at desc
      limit 1
    ),
    updated_at = now()
  where s.id = v_session_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ai_agent_chat_messages_refresh_session on public.ai_agent_chat_messages;
create trigger trg_ai_agent_chat_messages_refresh_session
after insert or update or delete on public.ai_agent_chat_messages
for each row execute function public.refresh_ai_agent_chat_session_summary();

alter table public.ai_agent_chat_sessions enable row level security;
alter table public.ai_agent_chat_messages enable row level security;

drop policy if exists "ai_agent_sessions_owner_select" on public.ai_agent_chat_sessions;
create policy "ai_agent_sessions_owner_select"
on public.ai_agent_chat_sessions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "ai_agent_sessions_owner_insert" on public.ai_agent_chat_sessions;
create policy "ai_agent_sessions_owner_insert"
on public.ai_agent_chat_sessions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "ai_agent_sessions_owner_update" on public.ai_agent_chat_sessions;
create policy "ai_agent_sessions_owner_update"
on public.ai_agent_chat_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "ai_agent_sessions_owner_delete" on public.ai_agent_chat_sessions;
create policy "ai_agent_sessions_owner_delete"
on public.ai_agent_chat_sessions
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "ai_agent_messages_owner_select" on public.ai_agent_chat_messages;
create policy "ai_agent_messages_owner_select"
on public.ai_agent_chat_messages
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.ai_agent_chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "ai_agent_messages_owner_insert" on public.ai_agent_chat_messages;
create policy "ai_agent_messages_owner_insert"
on public.ai_agent_chat_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.ai_agent_chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "ai_agent_messages_owner_update" on public.ai_agent_chat_messages;
create policy "ai_agent_messages_owner_update"
on public.ai_agent_chat_messages
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.ai_agent_chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.ai_agent_chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "ai_agent_messages_owner_delete" on public.ai_agent_chat_messages;
create policy "ai_agent_messages_owner_delete"
on public.ai_agent_chat_messages
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.ai_agent_chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
);

grant select, insert, update, delete on table public.ai_agent_chat_sessions to authenticated;
grant select, insert, update, delete on table public.ai_agent_chat_messages to authenticated;

revoke all on function public.set_ai_agent_chat_session_updated_at() from public, anon, authenticated;
revoke all on function public.refresh_ai_agent_chat_session_summary() from public, anon, authenticated;
