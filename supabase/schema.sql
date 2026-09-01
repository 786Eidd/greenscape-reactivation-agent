-- ============================================================
-- Greenscape Pro — Closed-Lost Lead Reactivation Agent
-- Run this first in the Supabase SQL editor, then seed.sql.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- leads
-- Mirrors the shape of a GHL contact export. `notes` is deliberately
-- messy free text, because that is what actually lives in the CRM.
-- ------------------------------------------------------------
create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  ghl_contact_id    text unique,
  first_name        text not null,
  last_name         text,
  email             text,
  phone             text,
  city              text,
  project_interest  text,
  estimated_value   numeric(10,2),
  notes             text,
  lost_reason       text check (lost_reason in (
                      'price','went_with_competitor','went_cold',
                      'timing','unresponsive','unknown')),
  last_contact_at   timestamptz,
  status            text not null default 'dormant' check (status in (
                      'dormant',     -- never re-engaged
                      'drafted',     -- a draft exists awaiting approval
                      'contacted',   -- an approved message was sent
                      'responded',   -- the lead replied (real success metric)
                      'converted',   -- booked a site walk / signed
                      'suppressed'   -- do not contact: bounced, opted out, now a client
                    )),
  suppressed_reason text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists leads_status_idx        on public.leads (status);
create index if not exists leads_last_contact_idx  on public.leads (last_contact_at);
create index if not exists leads_email_idx         on public.leads (lower(email));

-- ------------------------------------------------------------
-- messages
-- One row per AI draft. A message can only reach a customer by moving
-- through 'draft' -> (human approval) -> 'sent'. 'failed' is terminal
-- until regenerated and is never sendable.
-- ------------------------------------------------------------
create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null references public.leads(id) on delete cascade,
  channel             text not null default 'email' check (channel in ('email','sms')),
  subject             text,
  body                text,
  status              text not null default 'draft' check (status in (
                        'draft',    -- generated, passed guardrails, awaiting a human
                        'failed',   -- generated but rejected by guardrails; NOT sendable
                        'sent',     -- approved by a human and handed to the provider
                        'rejected', -- a human declined it
                        'bounced'   -- provider reported hard bounce / complaint
                      )),
  failure_reason      text,
  edited_by_human     boolean not null default false,
  model               text,
  input_tokens        integer,
  output_tokens       integer,
  cost_usd            numeric(10,6),
  approved_by         text,
  sent_at             timestamptz,
  provider_message_id text,
  created_at          timestamptz not null default now()
);

create index if not exists messages_lead_idx    on public.messages (lead_id);
create index if not exists messages_status_idx  on public.messages (status);
create index if not exists messages_created_idx on public.messages (created_at desc);

-- ------------------------------------------------------------
-- events
-- Append-only audit trail. Every generate / approve / send / fail is
-- recorded so "who sent what to my customer, and when" is answerable.
-- ------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references public.leads(id) on delete cascade,
  message_id  uuid references public.messages(id) on delete cascade,
  kind        text not null,
  detail      text,
  actor       text,
  created_at  timestamptz not null default now()
);

create index if not exists events_created_idx on public.events (created_at desc);

-- ------------------------------------------------------------
-- keep leads.updated_at honest
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- All access is server-side via the service role key, which bypasses RLS.
-- RLS is enabled with no public policies so that even if the anon key
-- leaked, the customer list is not readable from a browser.
-- ------------------------------------------------------------
alter table public.leads    enable row level security;
alter table public.messages enable row level security;
alter table public.events   enable row level security;
