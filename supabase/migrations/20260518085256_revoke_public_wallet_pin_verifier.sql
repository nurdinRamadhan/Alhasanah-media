revoke execute on function public.wallet_set_student_pin_verifier(text, uuid, text, text, jsonb) from public;
revoke execute on function public.wallet_set_student_pin_verifier(text, uuid, text, text, jsonb) from anon;
revoke execute on function public.wallet_set_student_pin_verifier(text, uuid, text, text, jsonb) from authenticated;
grant execute on function public.wallet_set_student_pin_verifier(text, uuid, text, text, jsonb) to service_role;
