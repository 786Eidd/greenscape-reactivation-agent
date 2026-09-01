-- ============================================================
-- Seed data — a representative slice of Greenscape Pro's
-- 1,400+ closed-lost GHL backlog. Run after schema.sql.
--
-- NOTE ON EMAILS: every address is @example.com on purpose so that a
-- misfire during development cannot reach a real inbox. Before recording
-- the demo, change ONE row's email to your own address and send to that.
-- ============================================================

truncate table public.events, public.messages, public.leads restart identity cascade;

insert into public.leads
  (ghl_contact_id, first_name, last_name, email, phone, city, project_interest,
   estimated_value, notes, lost_reason, last_contact_at, status)
values
  ('ghl_10041','Dana','Whitfield','dana.whitfield@example.com','+16025550142','Scottsdale',
   'Paver patio + built-in fire pit', 34000,
   'Site walk 4/18. Wanted travertine, north-facing yard, HOA is Sonoran Ridge. Said budget was ~30k. Ghosted after proposal went out. Husband was the holdout.',
   'went_cold','2025-05-02','dormant'),

  ('ghl_10088','Rob','Castellanos','rob.castellanos@example.com','+16025550188','Gilbert',
   'Outdoor kitchen + pergola', 61000,
   'Referral from the Ainsworth job. Loved the render. Came in 12k over what he wanted. Went with a cheaper builder out of Mesa. Said "call me next spring".',
   'price','2025-03-14','dormant'),

  ('ghl_10112','Priya','Raghunathan','priya.r@example.com','+16025550119','Chandler',
   'Artificial turf + irrigation rework', 18500,
   'Two dogs, wants pet-safe turf. Quoted 18.5k. Was comparing 3 bids. Never heard back after the second follow-up.',
   'went_with_competitor','2025-02-27','dormant'),

  ('ghl_10156','Marcus','Feldman','m.feldman@example.com','+16025550170','Paradise Valley',
   'Pool deck resurface + water feature', 88000,
   'Big one. Wanted it done before a July party, we were booked 7 weeks out so timing killed it. Property is on Mockingbird. Said he still wants the water feature eventually.',
   'timing','2025-04-09','dormant'),

  ('ghl_10203','Sheila','Okonkwo','sheila.okonkwo@example.com','+16025550133','Tempe',
   'Retaining wall + planting', 22000,
   'Drainage issue on the slope behind the house. We flagged it needed engineering. She got nervous about the scope. Very polite, just went quiet.',
   'went_cold','2025-01-22','dormant'),

  ('ghl_10247','Trent','Boulware','trent.b@example.com','+16025550151','Mesa',
   'Fire pit + seating wall', 12000,
   'Small job. Phone quote only, never got a site walk on the calendar. Rescheduled twice.',
   'unresponsive','2024-11-30','dormant'),

  ('ghl_10298','Angela','Duartes','angela.duartes@example.com','+16025550164','Scottsdale',
   'Full backyard redesign', 95000,
   'Architect-involved. Wanted a phased build across two seasons, we quoted it as one project. Probably lost on structure, not price. Worth revisiting phased.',
   'price','2025-06-11','dormant'),

  ('ghl_10334','Bill','Kranz','bill.kranz@example.com','+16025550107','Queen Creek',
   'Pergola + turf', 27000,
   'Wife wanted it, he did not. Classic. Said "we are going to sit on it".',
   'went_cold','2025-05-28','dormant'),

  ('ghl_10371','Yasmin','El-Amin','yasmin.elamin@example.com','+16025550196','Ahwatukee',
   'Outdoor kitchen', 44000,
   'Detailed spec, wanted a Kamado built in. We were slow getting the proposal out (11 days). She told us straight up someone else quoted in 3 days.',
   'went_with_competitor','2025-07-03','dormant'),

  ('ghl_10402','Doug','Petrarca','doug.petrarca@example.com','+16025550125','Cave Creek',
   'Retaining wall repair + patio extension', 31000,
   'Existing wall failing. Insurance claim involved, timeline was unclear on their end. Never resolved.',
   'timing','2025-02-05','dormant'),

  ('ghl_10455','Kim','Nakashima','kim.nakashima@example.com','+16025550178','Gilbert',
   'Water feature + lighting', 26000,
   'Came from the Reels campaign. Very engaged early, went dark after we sent pricing. No stated objection.',
   'unknown','2025-08-15','dormant'),

  ('ghl_10489','Ernesto','Villalobos','ernesto.v@example.com','+16025550139','Peoria',
   'Turf + putting green', 39000,
   'Wanted a 4-hole putting green. Quoted. Said he was waiting on a bonus. That was 9 months ago.',
   'timing','2024-12-18','dormant'),

  ('ghl_10510','Hannah','Brightwell','hannah.brightwell@example.com','+16025550183','Scottsdale',
   'Patio cover + fans', 16000,
   'Renting at the time, told us to check back if she bought. She did buy — saw it on social.',
   'unknown','2025-03-30','dormant'),

  ('ghl_10544','Sam','Ogletree','sam.ogletree@example.com','+16025550190','Chandler',
   'Fire pit + paver walkway', 14500,
   'Price shopper, called three times about discounts. Not our customer honestly, but the yard was a good fit.',
   'price','2025-01-09','dormant'),

  ('ghl_10577','Nadia','Christoff','nadia.christoff@example.com','+16025550116','Fountain Hills',
   'Full outdoor living build', 120000,
   'Biggest quote we ever sent. Carlos did two render rounds. She went with a design-only firm and self-managed the build. Heard it went badly.',
   'went_with_competitor','2025-04-25','dormant');

-- One already-suppressed record, so the suppression path is visible in the demo.
insert into public.leads
  (ghl_contact_id, first_name, last_name, email, phone, city, project_interest,
   estimated_value, notes, lost_reason, last_contact_at, status, suppressed_reason)
values
  ('ghl_10601','Greg','Halvorsen','greg.halvorsen@example.com','+16025550172','Mesa',
   'Patio + pergola', 29000,
   'Closed-lost in 2024 but signed a maintenance contract in June. Active client now — must never receive a reactivation blast.',
   'went_cold','2024-08-02','suppressed','Now an active maintenance client');
