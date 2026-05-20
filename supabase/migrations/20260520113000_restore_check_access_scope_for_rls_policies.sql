-- check_access_scope() is used by RLS policies on santri. Many wali policies
-- read related tables through santri subqueries, so authenticated users need
-- execute permission for RLS evaluation.

GRANT EXECUTE ON FUNCTION public.check_access_scope(text, text) TO authenticated;
