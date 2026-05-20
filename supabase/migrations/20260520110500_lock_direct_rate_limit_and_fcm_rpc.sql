-- Lock direct client access to privileged helper RPCs.
-- Edge Functions call check_rate_limit with the service role client.
-- Android clients must use register_my_fcm_device(), never register_user_fcm_device().

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.register_user_fcm_device(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user_fcm_device(uuid, text, text, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.register_my_fcm_device(text, text, text, text) TO authenticated;
