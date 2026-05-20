-- Keep alumni chat access behind authenticated RLS policies only.
-- The tables already have RLS policies; this removes unnecessary anon table
-- privileges and narrows authenticated privileges to the operations used by
-- the Android chat client/admin moderation policies.

revoke all on table
  public.chat_conversations,
  public.chat_participants,
  public.chat_messages,
  public.chat_message_reports,
  public.chat_blocks,
  public.chat_user_presence,
  public.chat_device_keys,
  public.chat_message_device_ciphertexts,
  public.chat_key_backups
from anon;

revoke all on table
  public.chat_conversations,
  public.chat_participants,
  public.chat_messages,
  public.chat_message_reports,
  public.chat_blocks,
  public.chat_user_presence,
  public.chat_device_keys,
  public.chat_message_device_ciphertexts,
  public.chat_key_backups
from authenticated;

grant select, insert, update on table public.chat_conversations to authenticated;
grant select, insert, update on table public.chat_participants to authenticated;
grant select, insert, update on table public.chat_messages to authenticated;
grant select, insert, update, delete on table public.chat_message_reports to authenticated;
grant select, insert, update, delete on table public.chat_blocks to authenticated;
grant select, insert, update on table public.chat_user_presence to authenticated;
grant select, insert, update on table public.chat_device_keys to authenticated;
grant select, insert on table public.chat_message_device_ciphertexts to authenticated;
grant select, insert, update on table public.chat_key_backups to authenticated;

grant select, insert, update, delete on table
  public.chat_conversations,
  public.chat_participants,
  public.chat_messages,
  public.chat_message_reports,
  public.chat_blocks,
  public.chat_user_presence,
  public.chat_device_keys,
  public.chat_message_device_ciphertexts,
  public.chat_key_backups
to service_role;
