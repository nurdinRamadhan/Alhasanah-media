-- Post JWT-rotation hardening:
-- Provide the RPC used by deployed Edge Functions for public endpoints such as
-- register-alumni. The data remains hidden from clients by RLS; this function
-- is the only controlled entrypoint.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_request_count integer;
  v_remaining integer;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RAISE EXCEPTION 'rate limit key wajib diisi';
  END IF;

  IF p_max_attempts IS NULL OR p_max_attempts < 1 OR p_max_attempts > 10000 THEN
    RAISE EXCEPTION 'rate limit maksimum tidak valid';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'rate limit window tidak valid';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rag_rate_limits (bucket_key, window_start, request_count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET
    request_count = public.rag_rate_limits.request_count + 1,
    updated_at = now()
  RETURNING request_count INTO v_request_count;

  v_remaining := greatest(p_max_attempts - v_request_count, 0);

  RETURN jsonb_build_object(
    'allowed', v_request_count <= p_max_attempts,
    'remaining', v_remaining,
    'attempts', v_request_count,
    'reset_at', v_window_start + make_interval(secs => p_window_seconds)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO anon, authenticated, service_role;
