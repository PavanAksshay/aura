-- Migration 0022: Ensure profile and patient names store and display first name only

-- Normalize existing profiles
UPDATE public.profiles
SET full_name = split_part(trim(full_name), ' ', 1)
WHERE full_name IS NOT NULL AND position(' ' in trim(full_name)) > 0;

-- Normalize existing patients
UPDATE public.patients
SET full_name = split_part(trim(full_name), ' ', 1)
WHERE full_name IS NOT NULL AND position(' ' in trim(full_name)) > 0;
