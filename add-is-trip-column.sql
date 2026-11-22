-- SQL Migration: Add is_trip column to events table
-- Safe on existing data. All existing events remain normal events (is_trip = false).
-- Run this in your Supabase SQL Editor:

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_trip boolean DEFAULT false;
