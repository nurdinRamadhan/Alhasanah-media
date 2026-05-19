create index if not exists idx_chat_ciphertexts_conversation
on public.chat_message_device_ciphertexts (conversation_id);

create index if not exists idx_chat_key_backups_user_updated
on public.chat_key_backups (user_id, updated_at desc);
