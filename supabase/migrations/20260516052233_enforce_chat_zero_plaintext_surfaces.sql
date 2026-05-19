update public.notification_queue
set body = case
    when data->>'type' = 'alumni_chat_message_deleted' then 'Pesan dihapus'
    else 'Pesan terenkripsi baru'
  end,
  data = coalesce(data, '{}'::jsonb)
    - 'body'
    - 'content'
    - 'text'
    - 'message'
    - 'message_content'
where source_table = 'chat_messages'
   or data->>'type' in ('alumni_chat_message', 'alumni_chat_message_deleted');

update public.chat_message_reports
set note = null
where note is not null;

create or replace function app_private.sanitize_chat_notification_queue()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if new.source_table = 'chat_messages'
    or coalesce(new.data->>'type', '') in ('alumni_chat_message', 'alumni_chat_message_deleted')
  then
    new.body := case
      when new.data->>'type' = 'alumni_chat_message_deleted' then 'Pesan dihapus'
      else 'Pesan terenkripsi baru'
    end;
    new.data := coalesce(new.data, '{}'::jsonb)
      - 'body'
      - 'content'
      - 'text'
      - 'message'
      - 'message_content';
  end if;

  return new;
end;
$$;

drop trigger if exists sanitize_chat_notification_queue on public.notification_queue;
create trigger sanitize_chat_notification_queue
before insert or update on public.notification_queue
for each row
execute function app_private.sanitize_chat_notification_queue();

create or replace function app_private.sanitize_chat_message_report()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  new.note := null;
  return new;
end;
$$;

drop trigger if exists sanitize_chat_message_report on public.chat_message_reports;
create trigger sanitize_chat_message_report
before insert or update on public.chat_message_reports
for each row
execute function app_private.sanitize_chat_message_report();

alter table public.chat_message_reports
  drop constraint if exists chat_message_reports_no_plaintext_note;

alter table public.chat_message_reports
  add constraint chat_message_reports_no_plaintext_note
  check (note is null);
