-- Migration 0022: Ensure clinician profile names store and display first name only

-- Normalize existing profiles to first name only
UPDATE public.profiles
SET full_name = split_part(trim(full_name), ' ', 1)
WHERE full_name IS NOT NULL AND position(' ' in trim(full_name)) > 0;
