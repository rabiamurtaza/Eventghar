-- =========================================================================
-- EventGhar: Solution 1 - Automatic Ticket Generation Trigger
-- Run this in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Create the Function
CREATE OR REPLACE FUNCTION public.handle_booking_verified_generate_tickets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_event_number text;
  v_event_prefix text;
  v_booking_prefix text;
  v_target_count int;
  v_existing_count int;
  v_ticket_code text;
  v_random_str text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  j int;
  v_pass_exists boolean;
BEGIN
  -- Only execute when status becomes 'verified' or 'confirmed'
  IF (NEW.status IN ('verified', 'confirmed')) AND (OLD IS NULL OR OLD.status NOT IN ('verified', 'confirmed')) THEN

    -- Exact number of passes required according to this booking
    v_target_count := GREATEST(1, COALESCE(NEW.number_of_tickets, 1));

    -- 1. Re-activate any previously cancelled passes for this booking
    UPDATE public.issued_tickets
    SET status = 'valid'
    WHERE booking_id = NEW.id AND status = 'cancelled';

    -- 2. Count existing valid passes using direct assignment
    v_existing_count := (
      SELECT COUNT(*)::int
      FROM public.issued_tickets
      WHERE booking_id = NEW.id
    );

    -- If all passes already exist, ensure total_tickets is consistent and return
    IF v_existing_count >= v_target_count THEN
      UPDATE public.issued_tickets
      SET total_tickets = v_target_count
      WHERE booking_id = NEW.id AND total_tickets <> v_target_count;
      RETURN NEW;
    END IF;

    -- 3. Fetch event_number for prefix
    v_event_number := (
      SELECT event_number::text
      FROM public.events
      WHERE id = NEW.event_id
      LIMIT 1
    );

    v_event_prefix := COALESCE(v_event_number, 'EVT');
    v_booking_prefix := UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 4));

    -- 4. Insert only missing ticket numbers from 1 to target_count (never less, never more)
    FOR i IN 1..v_target_count LOOP
      v_pass_exists := EXISTS (
        SELECT 1 FROM public.issued_tickets
        WHERE booking_id = NEW.id AND ticket_number = i
      );

      IF NOT v_pass_exists THEN
        v_random_str := '';
        FOR j IN 1..5 LOOP
          v_random_str := v_random_str || SUBSTRING(v_alphabet FROM (FLOOR(RANDOM() * 32)::int + 1) FOR 1);
        END LOOP;

        v_ticket_code := 'EG-' || v_event_prefix || '-' || v_booking_prefix || v_random_str || '-' || i;

        INSERT INTO public.issued_tickets (
          id,
          booking_id,
          event_id,
          ticket_number,
          total_tickets,
          ticket_type,
          ticket_code,
          holder_name,
          holder_email,
          holder_phone,
          status,
          created_at
        ) VALUES (
          gen_random_uuid(),
          NEW.id,
          NEW.event_id,
          i,
          v_target_count,
          COALESCE(NEW.ticket_type, 'Standard'),
          v_ticket_code,
          COALESCE(NEW.full_name, 'Guest'),
          COALESCE(NEW.user_email, ''),
          COALESCE(NEW.phone_number, ''),
          'valid',
          NOW()
        );
      END IF;
    END LOOP;

    -- Ensure all passes for this booking have total_tickets set correctly
    UPDATE public.issued_tickets
    SET total_tickets = v_target_count
    WHERE booking_id = NEW.id AND total_tickets <> v_target_count;

  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Attach the Trigger to the bookings table
DROP TRIGGER IF EXISTS trg_booking_verified_generate_tickets ON public.bookings;
CREATE TRIGGER trg_booking_verified_generate_tickets
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.handle_booking_verified_generate_tickets();
