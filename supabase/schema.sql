-- Priceport Phase 02 schema (prepared; Supabase is not configured yet).
-- Apply when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are available.

create extension if not exists "pgcrypto";

create table if not exists searches (
  id uuid primary key default gen_random_uuid(),
  hotel_name text,
  hotel_location text,
  hotel_url text,
  check_in date not null,
  check_out date not null,
  adults int not null default 2,
  children int not null default 0,
  children_ages jsonb not null default '[]'::jsonb,
  rooms int not null default 1,
  home_country text,
  preferred_currency text,
  created_at timestamptz not null default now()
);

create table if not exists investigation_jobs (
  id text primary key,
  search_id uuid references searches(id) on delete cascade,
  provider text not null,
  market text not null,
  access_method text not null,
  actual_proxy_country text,
  storefront_region text,
  status text not null,
  tinyfish_run_id text,
  streaming_url text,
  source_url text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  raw_result jsonb,
  normalized_offer jsonb,
  created_at timestamptz not null default now()
);

create table if not exists investigation_events (
  id text primary key,
  investigation_id text not null,
  job_id text references investigation_jobs(id) on delete cascade,
  type text not null,
  message text,
  payload jsonb,
  at timestamptz not null default now()
);

create table if not exists offers (
  id text primary key,
  investigation_id text not null,
  job_id text references investigation_jobs(id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists fx_rates (
  id uuid primary key default gen_random_uuid(),
  base text not null,
  quote text not null,
  rate numeric not null,
  source text not null,
  fetched_at timestamptz not null default now()
);

create table if not exists investigation_usage (
  id uuid primary key default gen_random_uuid(),
  investigation_id text not null,
  job_id text,
  tinyfish_run_id text,
  notes text,
  created_at timestamptz not null default now()
);
