-- Align alumni/forum administration authorization with the admin panel
-- accessControlProvider. The UI exposes alumni management to dewan, so the
-- database guard must allow the same trusted governance role.

CREATE OR REPLACE FUNCTION app_private.is_current_user_forum_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND lower(coalesce(role, '')) IN ('super_admin', 'kesantrian', 'rois', 'dewan')
      AND coalesce(is_active, false) = true
  );
$$;
