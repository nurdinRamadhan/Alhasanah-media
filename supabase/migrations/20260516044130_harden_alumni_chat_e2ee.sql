-- Harden Alumni Chat E2EE.
-- This migration preserves the current `chat_messages.content` column as a
-- non-sensitive compatibility placeholder. The column must not contain user
-- message plaintext anymore.

begin;

update public.chat_messages
set content = 'Pesan lama telah dihapus dari server',
    edited_at = coalesce(edited_at, now())
where encryption_scheme = 'legacy_plaintext'
  and content <> 'Pesan lama telah dihapus dari server';

update public.chat_conversations
set last_message_preview = 'Pesan terenkripsi'
where last_message_preview is not null
  and btrim(last_message_preview) <> ''
  and last_message_preview not in ('Pesan terenkripsi', 'Pesan dihapus');

drop policy if exists "Chat participants can send messages" on public.chat_messages;
drop policy if exists "Chat participants can send encrypted messages" on public.chat_messages;

create policy "Chat participants can send encrypted messages"
on public.chat_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and app_private.is_active_alumni(auth.uid())
  and app_private.is_chat_participant(conversation_id)
  and status = 'sent'
  and deleted_at is null
  and encryption_scheme = 'e2ee_v1'
  and e2ee_version = 1
  and content = 'Pesan terenkripsi'
  and not app_private.has_recent_chat_message(auth.uid())
  and not exists (
    select 1
    from public.chat_participants cp
    where cp.conversation_id = chat_messages.conversation_id
      and cp.user_id <> auth.uid()
      and app_private.is_chat_blocked(auth.uid(), cp.user_id)
  )
);

drop policy if exists "Alumni chat participants can receive typing" on realtime.messages;
drop policy if exists "Alumni chat participants can send typing" on realtime.messages;

create policy "Alumni chat participants can receive typing"
on realtime.messages
for select
to authenticated
using (
  private is true
  and extension = 'broadcast'
  and topic ~ '^alumni-chat-typing:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and app_private.is_chat_participant(split_part(topic, ':', 2)::uuid, auth.uid())
);

create policy "Alumni chat participants can send typing"
on realtime.messages
for insert
to authenticated
with check (
  private is true
  and extension = 'broadcast'
  and event = 'typing'
  and topic ~ '^alumni-chat-typing:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and app_private.is_chat_participant(split_part(topic, ':', 2)::uuid, auth.uid())
);

create or replace function app_private.touch_chat_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.chat_conversations
     set updated_at = now(),
         last_message_at = coalesce(new.created_at, now()),
         last_message_preview = case
           when new.status = 'deleted' then 'Pesan dihapus'
           when new.encryption_scheme = 'e2ee_v1' then 'Pesan terenkripsi'
           else 'Pesan lama'
         end,
         last_message_sender_id = new.sender_id
   where id = new.conversation_id;
  return new;
end;
$function$;

create or replace function app_private.enqueue_chat_message_notification()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  sender_name text;
  recipient record;
  notification_body text;
begin
  select coalesce(a.full_name, p.full_name, 'Alumni')
    into sender_name
  from public.profiles p
  left join public.alumni_data a on a.id = p.id
  where p.id = new.sender_id;

  notification_body := case
    when new.status = 'deleted' then 'Pesan dihapus'
    when new.encryption_scheme = 'e2ee_v1' then 'Pesan terenkripsi baru'
    else 'Pesan baru'
  end;

  for recipient in
    select cp.user_id
    from public.chat_participants cp
    where cp.conversation_id = new.conversation_id
      and cp.user_id <> new.sender_id
      and cp.archived_at is null
      and (cp.muted_until is null or cp.muted_until < now())
      and not app_private.is_chat_blocked(new.sender_id, cp.user_id)
  loop
    insert into public.notification_queue(user_id, title, body, data, source_table)
    values (
      recipient.user_id,
      sender_name,
      notification_body,
      jsonb_build_object(
        'type', 'alumni_chat_message',
        'conversation_id', new.conversation_id,
        'message_id', new.id,
        'sender_id', new.sender_id,
        'encrypted', new.encryption_scheme = 'e2ee_v1'
      ),
      'chat_messages'
    );
  end loop;

  return new;
end;
$function$;

create or replace function public.get_chat_admin_monitor(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'app_private'
as $function$
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
$function$;

alter table public.chat_messages
  alter column content set default 'Pesan terenkripsi',
  alter column encryption_scheme set default 'e2ee_v1',
  alter column e2ee_version set default 1;

alter table public.chat_messages
  drop constraint if exists chat_messages_no_plaintext_payload;

alter table public.chat_messages
  add constraint chat_messages_no_plaintext_payload
  check (
    (
      encryption_scheme = 'e2ee_v1'
      and e2ee_version = 1
      and content = 'Pesan terenkripsi'
    )
    or (
      encryption_scheme = 'legacy_plaintext'
      and content = 'Pesan lama telah dihapus dari server'
    )
  );

commit;
