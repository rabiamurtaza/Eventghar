-- =========================================================================
-- EventGhar: Role Management & Organizer Linking Setup
-- Run this in the Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Ensure organizers table has all required columns
ALTER TABLE public.organizers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.organizers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.organizers ADD COLUMN IF NOT EXISTS organizer_number serial;

-- 2. Ensure users table has all required columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_number serial;

-- 3. Ensure events table has organizer_id
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer_id uuid;

-- 4. Enable Row Level Security
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Organizers table
DROP POLICY IF EXISTS "Admins can manage organizers" ON public.organizers;
CREATE POLICY "Admins can manage organizers" ON public.organizers
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admins WHERE public.admins.id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admins WHERE public.admins.id = auth.uid())
);

DROP POLICY IF EXISTS "Organizers can read self" ON public.organizers;
CREATE POLICY "Organizers can read self" ON public.organizers
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view organizers list for event details" ON public.organizers;
CREATE POLICY "Anyone can view organizers list for event details" ON public.organizers
FOR SELECT
TO authenticated
USING (true);

-- 6. RLS Policies for Users table
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
CREATE POLICY "Admins can manage users" ON public.users
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admins WHERE public.admins.id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admins WHERE public.admins.id = auth.uid())
);

DROP POLICY IF EXISTS "Users can read self" ON public.users;
CREATE POLICY "Users can read self" ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update self" ON public.users;
CREATE POLICY "Users can update self" ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert self" ON public.users;
CREATE POLICY "Users can insert self" ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 7. Stored Procedure: promote_user_to_organizer
CREATE OR REPLACE FUNCTION public.promote_user_to_organizer(
  target_user_id uuid,
  target_name text DEFAULT NULL,
  target_email text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  -- Retrieve user info if not passed directly
  SELECT full_name, email INTO v_name, v_email
  FROM public.users
  WHERE id = target_user_id;

  v_name := COALESCE(target_name, v_name, 'Organizer');
  v_email := COALESCE(target_email, v_email, '');

  -- Insert or update organizers
  INSERT INTO public.organizers (id, name, email)
  VALUES (target_user_id, v_name, v_email)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;

  -- Delete from users
  DELETE FROM public.users WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'Promoted to organizer successfully');
END;
$$;

-- 8. Stored Procedure: demote_organizer_to_user
CREATE OR REPLACE FUNCTION public.demote_organizer_to_user(
  target_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  -- Retrieve organizer info
  SELECT name, email INTO v_name, v_email
  FROM public.organizers
  WHERE id = target_user_id;

  -- Insert into users
  INSERT INTO public.users (id, full_name, email)
  VALUES (target_user_id, COALESCE(v_name, 'User'), COALESCE(v_email, ''))
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  -- Delete from organizers
  DELETE FROM public.organizers WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'Demoted to user successfully');
END;
$$;

-- 9. Grant Execute Permissions
GRANT EXECUTE ON FUNCTION public.promote_user_to_organizer(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demote_organizer_to_user(uuid) TO authenticated;
