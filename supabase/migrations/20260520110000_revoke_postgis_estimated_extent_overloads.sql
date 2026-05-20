-- Supabase advisor flags PostGIS st_estimatedextent because it is SECURITY
-- DEFINER in the exposed public schema. Revoke client execution on every
-- overload while leaving service-side maintenance roles untouched.

REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
