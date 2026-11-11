-- "Other" animals can be named by the reporter (rabbit, goat, bird...). Optional, short, plain text,
-- and only allowed when the animal type is 'other'.
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS animal_other TEXT;
ALTER TABLE public.sos_reports DROP CONSTRAINT IF EXISTS sos_reports_animal_other_check;
ALTER TABLE public.sos_reports ADD CONSTRAINT sos_reports_animal_other_check CHECK (
  animal_other IS NULL
  OR (animal_type::text = 'other' AND char_length(animal_other) BETWEEN 2 AND 30 AND animal_other !~ '[<>]')
);
