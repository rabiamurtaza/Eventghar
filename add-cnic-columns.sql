-- SQL Migration: Add CNIC support per event and user profile
-- Run this in your Supabase SQL Editor:

-- 1. Flag on events table to optionally require CNIC
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS requires_cnic boolean DEFAULT false;

-- 2. Column on bookings table to store attendee CNIC
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS cnic text;

-- 3. Column on users and organizers to support profile auto-fill and auto-save
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS cnic text;

ALTER TABLE public.organizers 
ADD COLUMN IF NOT EXISTS cnic text;

-- 4. Index for high-performance duplicate CNIC checks per event
CREATE INDEX IF NOT EXISTS idx_bookings_event_cnic 
ON public.bookings(event_id, cnic) 
WHERE cnic IS NOT NULL;
