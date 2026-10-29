-- KupKop: test clinics for the prototype, so "Admit" has somewhere to hand off.
-- Fake names and phone numbers (prototype rule); status 'Listed', never 'Verified'.
-- Safe to run more than once: each clinic is added only if its name is not there yet.

INSERT INTO public.facilities (name, address, phone, latitude, longitude, status, last_active_at)
SELECT v.name, v.address, v.phone, v.latitude, v.longitude, 'Listed', now() - v.idle
FROM (
  VALUES
    ('Test Clinic A (Katipunan)',  'Katipunan Ave, Quezon City',        '0000-000-0001', 14.6391, 121.0766, interval '2 hours'),
    ('Test Clinic B (New Manila)', 'E. Rodriguez Sr. Ave, New Manila',  '0000-000-0002', 14.6225, 121.0331, interval '4 days'),
    ('Test Clinic C (Aurora Blvd)','Aurora Blvd near Broadway',         '0000-000-0003', 14.6128, 121.0287, interval '12 days'),
    ('Test Shelter D (Kamias)',    'Kamias Rd near Anonas',             '0000-000-0004', 14.6262, 121.0546, interval '15 days')
) AS v(name, address, phone, latitude, longitude, idle)
WHERE NOT EXISTS (SELECT 1 FROM public.facilities f WHERE f.name = v.name);
