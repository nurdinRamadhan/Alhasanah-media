create or replace function public.is_chat_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select (
    app_private.is_current_user_forum_admin()
    or app_private.is_chat_participant(p_conversation_id, auth.uid())
  )
  and exists (
    select 1
    from public.chat_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
  );
$$;
