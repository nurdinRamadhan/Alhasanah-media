drop policy if exists "chat_ciphertexts_insert_for_conversation_participants"
on public.chat_message_device_ciphertexts;

create policy "chat_ciphertexts_insert_for_conversation_participants"
on public.chat_message_device_ciphertexts
for insert
to authenticated
with check (
  app_private.is_chat_participant(conversation_id, auth.uid())
  and app_private.is_chat_participant(conversation_id, recipient_user_id)
);

revoke execute on function public.is_chat_participant(uuid, uuid) from anon;
revoke execute on function public.is_chat_participant(uuid, uuid) from authenticated;
