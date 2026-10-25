-- Migration: Add description column to sos_reports for landmarks and scene notes
ALTER TABLE public.sos_reports
ADD COLUMN IF NOT EXISTS description TEXT;
