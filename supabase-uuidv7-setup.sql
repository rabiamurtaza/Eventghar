-- =========================================================================
-- EventGhar: UUID Version 7 (RFC 9562) & Supabase Realtime Setup
-- Run this in the Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Create native RFC 9562 UUIDv7 generator function in PostgreSQL
-- UUIDv7 combines a 48-bit Unix timestamp (millisecond precision) with 74 random bits.
-- This ensures time-ordered sorting, prevents B-tree index fragmentation,
-- and provides globally unique, chronological primary keys.
CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
PARALLEL SAFE
AS $$
DECLARE
  unix_time_ms bytea;
  uuid_bytes bytea;
BEGIN
  -- Extract current epoch time in milliseconds (48 bits / 6 bytes)
  unix_time_ms := substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3 for 6);

  -- Append 10 cryptographically random bytes (total 16 bytes = 128 bits)
  uuid_bytes := unix_time_ms || gen_random_bytes(10);

  -- Set Version 7: set high 4 bits of byte 7 (index 6, 0-indexed) to 0111 (0x70)
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);

  -- Set Variant: set high 2 bits of byte 9 (index 8, 0-indexed) to 10 (0x80)
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

-- Grant execution to all roles
GRANT EXECUTE ON FUNCTION public.uuid_generate_v7() TO postgres, anon, authenticated, service_role;

-- 2. Update default primary key generators across all operational tables to UUIDv7

-- Events Table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    ALTER TABLE public.events ALTER COLUMN id SET DEFAULT public.uuid_generate_v7();
  END IF;
END $$;

-- Bookings Table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    ALTER TABLE public.bookings ALTER COLUMN id SET DEFAULT public.uuid_generate_v7();
  END IF;
END $$;

-- Issued Tickets Table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'issued_tickets') THEN
    ALTER TABLE public.issued_tickets ALTER COLUMN id SET DEFAULT public.uuid_generate_v7();
  END IF;
END $$;

-- Book Event Requests Table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_event_requests') THEN
    ALTER TABLE public.book_event_requests ALTER COLUMN id SET DEFAULT public.uuid_generate_v7();
  END IF;
END $$;

-- Contact Messages Table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_messages') THEN
    ALTER TABLE public.contact_messages ALTER COLUMN id SET DEFAULT public.uuid_generate_v7();
  END IF;
END $$;

-- Hero Images Table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hero_images') THEN
    ALTER TABLE public.hero_images ALTER COLUMN id SET DEFAULT public.uuid_generate_v7();
  END IF;
END $$;

-- Ticket Types Table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_types') THEN
    ALTER TABLE public.ticket_types ALTER COLUMN id SET DEFAULT public.uuid_generate_v7();
  END IF;
END $$;

-- 3. Configure Supabase Realtime Publication
-- Ensure operational tables are broadcasted by the Supabase Realtime engine
DO $$
BEGIN
  -- Add events
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Add bookings
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Add issued_tickets
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.issued_tickets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Add book_event_requests
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.book_event_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Add contact_messages
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Add hero_images
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hero_images;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Add users
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Add organizers
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.organizers;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Set REPLICA IDENTITY FULL for tables where DELETE or UPDATE events need complete payloads
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.issued_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.book_event_requests REPLICA IDENTITY FULL;
ALTER TABLE public.contact_messages REPLICA IDENTITY FULL;
