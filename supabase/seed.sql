-- Mock data for local development. `supabase db reset` loads it after the migrations.
-- Quantities, dates and lesson times are placeholders until the school confirms them;
-- replace before the pilot (CLAUDE.md decisions 4 and 5).

insert into public.device_types (name, total_quantity) values
  ('Sülearvuti', 30),
  ('Tahvelarvuti', 20),
  ('LEGO WeDo 2.0', 12),
  ('LEGO SPIKE', 12),
  ('Ozobot', 15),
  ('DJI Tello EDU', 6),
  ('3D-printer', 1),
  ('Cricut', 1);

with school_year as (
  insert into public.school_years (starts_on, ends_on)
  values ('2026-09-01', '2027-06-05')
  returning id
)
insert into public.non_teaching_periods (school_year_id, kind, name, starts_on, ends_on)
select school_year.id, 'break', period.name, period.starts_on::date, period.ends_on::date
from school_year,
  (values
    ('Sügisvaheaeg', '2026-10-26', '2026-11-01'),
    ('Jõuluvaheaeg', '2026-12-23', '2027-01-02'),
    ('Kevadvaheaeg', '2027-03-22', '2027-03-28')
  ) as period (name, starts_on, ends_on);

insert into public.lesson_periods (lesson_number, starts_time, ends_time) values
  (1, '08:15', '09:00'),
  (2, '09:10', '09:55'),
  (3, '10:05', '10:50'),
  (4, '11:00', '11:45'),
  (5, '12:15', '13:00'),
  (6, '13:10', '13:55'),
  (7, '14:05', '14:50'),
  (8, '15:00', '15:45');
