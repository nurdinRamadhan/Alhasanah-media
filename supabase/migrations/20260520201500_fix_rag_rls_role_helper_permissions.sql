-- RAG table policies must be evaluable by authenticated users.
-- current_user_has_role() is intentionally locked down, so use the RLS role
-- helper that is already granted to authenticated users.

drop policy if exists "rag_chunks_admin_insert" on public.rag_document_chunks;
drop policy if exists "rag_chunks_admin_read_all" on public.rag_document_chunks;
drop policy if exists "rag_chunks_admin_update" on public.rag_document_chunks;
drop policy if exists "rag_chunks_super_admin_delete" on public.rag_document_chunks;

create policy "rag_chunks_admin_insert"
  on public.rag_document_chunks
  for insert
  to authenticated
  with check ((select app_private.current_user_role()) = any (array['super_admin', 'rois']));

create policy "rag_chunks_admin_read_all"
  on public.rag_document_chunks
  for select
  to authenticated
  using ((select app_private.current_user_role()) = any (array['super_admin', 'rois', 'dewan']));

create policy "rag_chunks_admin_update"
  on public.rag_document_chunks
  for update
  to authenticated
  using ((select app_private.current_user_role()) = any (array['super_admin', 'rois']))
  with check ((select app_private.current_user_role()) = any (array['super_admin', 'rois']));

create policy "rag_chunks_super_admin_delete"
  on public.rag_document_chunks
  for delete
  to authenticated
  using ((select app_private.current_user_role()) = 'super_admin');

drop policy if exists "rag_documents_admin_insert" on public.rag_documents;
drop policy if exists "rag_documents_admin_read_all" on public.rag_documents;
drop policy if exists "rag_documents_admin_update" on public.rag_documents;
drop policy if exists "rag_documents_super_admin_delete" on public.rag_documents;

create policy "rag_documents_admin_insert"
  on public.rag_documents
  for insert
  to authenticated
  with check ((select app_private.current_user_role()) = any (array['super_admin', 'rois']));

create policy "rag_documents_admin_read_all"
  on public.rag_documents
  for select
  to authenticated
  using ((select app_private.current_user_role()) = any (array['super_admin', 'rois', 'dewan']));

create policy "rag_documents_admin_update"
  on public.rag_documents
  for update
  to authenticated
  using ((select app_private.current_user_role()) = any (array['super_admin', 'rois']))
  with check ((select app_private.current_user_role()) = any (array['super_admin', 'rois']));

create policy "rag_documents_super_admin_delete"
  on public.rag_documents
  for delete
  to authenticated
  using ((select app_private.current_user_role()) = 'super_admin');

drop policy if exists "rag_logs_admin_select" on public.rag_query_logs;

create policy "rag_logs_admin_select"
  on public.rag_query_logs
  for select
  to authenticated
  using ((select app_private.current_user_role()) = any (array['super_admin', 'rois', 'dewan']));
