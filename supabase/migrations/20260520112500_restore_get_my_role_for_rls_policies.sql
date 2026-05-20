-- get_my_role() is used inside existing RLS policies. Revoking it from
-- authenticated users causes unrelated valid policies to fail with 403.
-- The function only returns the current user's own role from auth.uid().

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
