-- Remove the last plaintext-compatible message payload column.
-- Message bodies live only in public.chat_message_device_ciphertexts.

begin;

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
  and not app_private.has_recent_chat_message(auth.uid())
  and not exists (
    select 1
    from public.chat_participants cp
    where cp.conversation_id = chat_messages.conversation_id
      and cp.user_id <> auth.uid()
      and app_private.is_chat_blocked(auth.uid(), cp.user_id)
  )
);

alter table public.chat_messages
  drop constraint if exists chat_messages_no_plaintext_payload,
  drop constraint if exists chat_messages_content_check;

alter table public.chat_messages
  drop column if exists content;

commit;
