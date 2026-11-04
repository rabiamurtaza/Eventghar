-- =========================================================================
-- EventGhar: Role Management & Organizer Linking Setup
-- Run this in the Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Ensure organizers table has all required columns
ALTER TABLE public.organizers ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.organizers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.organizers ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.organizers ADD COLUMN IF NOT EXISTS organizer_number serial;

-- 2. Ensure users table has all required columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_number serial;

-- 3. Ensure events table has organizer_id
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer_id uuid;

-- 4. Enable Row Level Security & Admin Verification Helper
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Helper function to verify admin role with SECURITY DEFINER to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Admin can read their own admin record
DROP POLICY IF EXISTS "Admins can view admins" ON public.admins;
CREATE POLICY "Admins can view admins" ON public.admins
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 5. RLS Policies for Organizers table
DROP POLICY IF EXISTS "Admins can manage organizers" ON public.organizers;
CREATE POLICY "Admins can manage organizers" ON public.organizers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

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
USING (public.is_admin())
WITH CHECK (public.is_admin());

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
  target_email text DEFAULT NULL,
  target_phone text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
BEGIN
  -- Verify the caller is an administrator
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can promote users to organizers';
  END IF;

  -- Retrieve user info if not passed directly
  SELECT full_name, email, phone_number INTO v_name, v_email, v_phone
  FROM public.users
  WHERE id = target_user_id;

  v_name := COALESCE(target_name, v_name, 'Organizer');
  v_email := COALESCE(target_email, v_email, '');
  v_phone := COALESCE(target_phone, v_phone, '');

  -- Insert or update organizers
  INSERT INTO public.organizers (id, full_name, email, phone_number)
  VALUES (target_user_id, v_name, v_email, v_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number;

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
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
BEGIN
  -- Verify the caller is an administrator
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can demote organizers to users';
  END IF;

  -- Retrieve organizer info
  SELECT full_name, email, phone_number INTO v_name, v_email, v_phone
  FROM public.organizers
  WHERE id = target_user_id;

  -- Disassociate any events linked to this organizer so foreign keys do not block deletion
  UPDATE public.events 
  SET organizer_id = NULL 
  WHERE organizer_id = target_user_id;

  -- Insert into users
  INSERT INTO public.users (id, full_name, email, phone_number)
  VALUES (target_user_id, COALESCE(v_name, 'User'), COALESCE(v_email, ''), v_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number;

  -- Delete from organizers
  DELETE FROM public.organizers WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'Demoted to user successfully');
END;
$$;

-- 9. Grant Execute Permissions
GRANT EXECUTE ON FUNCTION public.promote_user_to_organizer(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demote_organizer_to_user(uuid) TO authenticated;

-- 10. Storage Buckets Creation (payment-screenshots, student-ids, event-images)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('payment-screenshots', 'payment-screenshots', true),
  ('student-ids', 'student-ids', true),
  ('event-images', 'event-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for Public Reading and Uploading
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access'
  ) THEN
    CREATE POLICY "Public Access"
    ON storage.objects FOR SELECT
    USING (bucket_id IN ('payment-screenshots', 'student-ids', 'event-images'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Upload Access'
  ) THEN
    CREATE POLICY "Public Upload Access"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id IN ('payment-screenshots', 'student-ids', 'event-images'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin and Organizer Update Storage'
  ) THEN
    CREATE POLICY "Admin and Organizer Update Storage"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id IN ('payment-screenshots', 'student-ids', 'event-images') AND (
        auth.uid() IN (SELECT id FROM public.admins) OR
        auth.uid() IN (SELECT id FROM public.organizers)
      )
    );
  END IF;
END $$;

-- 11. Contact Messages Table for Support
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_messages' AND policyname = 'Allow public insert on contact_messages'
  ) THEN
    CREATE POLICY "Allow public insert on contact_messages"
    ON public.contact_messages FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_messages' AND policyname = 'Allow admins select on contact_messages'
  ) THEN
    CREATE POLICY "Allow admins select on contact_messages"
    ON public.contact_messages FOR SELECT
    USING (auth.uid() IN (SELECT id FROM public.admins));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_messages' AND policyname = 'Allow admins update on contact_messages'
  ) THEN
    CREATE POLICY "Allow admins update on contact_messages"
    ON public.contact_messages FOR UPDATE
    TO authenticated
    USING (auth.uid() IN (SELECT id FROM public.admins))
    WITH CHECK (auth.uid() IN (SELECT id FROM public.admins));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_messages' AND policyname = 'Allow admins delete on contact_messages'
  ) THEN
    CREATE POLICY "Allow admins delete on contact_messages"
    ON public.contact_messages FOR DELETE
    TO authenticated
    USING (auth.uid() IN (SELECT id FROM public.admins));
  END IF;
END $$;

-- 12. Hero Slider Images Bucket, Table & Admin RLS Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-images', 'hero-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Read hero-images'
  ) THEN
    CREATE POLICY "Public Read hero-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'hero-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin Upload hero-images'
  ) THEN
    CREATE POLICY "Admin Upload hero-images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'hero-images' AND 
      auth.uid() IN (SELECT id FROM public.admins)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin Delete hero-images'
  ) THEN
    CREATE POLICY "Admin Delete hero-images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'hero-images' AND 
      auth.uid() IN (SELECT id FROM public.admins)
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.hero_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hero_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hero_images' AND policyname = 'Public read hero_images table'
  ) THEN
    CREATE POLICY "Public read hero_images table"
    ON public.hero_images FOR SELECT
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hero_images' AND policyname = 'Admin insert hero_images table'
  ) THEN
    CREATE POLICY "Admin insert hero_images table"
    ON public.hero_images FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IN (SELECT id FROM public.admins));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hero_images' AND policyname = 'Admin delete hero_images table'
  ) THEN
    CREATE POLICY "Admin delete hero_images table"
    ON public.hero_images FOR DELETE
    TO authenticated
    USING (auth.uid() IN (SELECT id FROM public.admins));
  END IF;
END $$;


