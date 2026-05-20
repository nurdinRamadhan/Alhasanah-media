-- Reduce callable SECURITY DEFINER surface after JWT key rotation.
-- These functions are helper/legacy RPCs and are not called directly by the
-- current admin panel or Android code. Internal SECURITY DEFINER functions can
-- still call them as the function owner.

REVOKE ALL ON FUNCTION public.broadcast_notification_v2(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_notification_v2(text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.check_access_scope(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_access_scope(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO service_role;

REVOKE ALL ON FUNCTION public.get_choropleth_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_choropleth_data() TO service_role;
