-- AI News Aggregation Platform — Supabase / Postgres schema
-- Run in Supabase SQL editor (or via `psql`).
-- Re-runnable: uses IF NOT EXISTS where possible.

create extension if not exists "pgcrypto";

-- ============================================================
-- USERS & PREFERENCES
-- ============================================================
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text,
  role          text not null default 'reader',  -- 'admin' | 'reader'
  timezone      text default 'Asia/Shanghai',
  language      text default 'zh-CN',
  is_active     boolean default true,
  created_at    timestamptz default now()
);

create table if not exists user_preferences (
  user_id            uuid primary key references users(id) on delete cascade,
  topics             text[] default '{}',         -- ['ai','markets','china']
  source_ids         uuid[] default '{}',         -- whitelist; empty = all
  exclude_source_ids uuid[] default '{}',
  summary_style      text default 'briefing',     -- 'briefing'|'deepdive'|'bullets'
  summary_language   text default 'zh-CN',
  digest_frequency   text default 'daily',        -- 'realtime'|'hourly'|'daily'|'weekly'
  send_hour_local    int  default 8,              -- 0-23, in user's tz
  max_items          int  default 12,
  updated_at         timestamptz default now()
);

-- Delivery destinations (a user can have many across channels)
create table if not exists delivery_targets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  channel     text not null,   -- 'email'|'slack'|'discord'|'feishu'|'wecom'|'web'
  label       text,
  config      jsonb not null,  -- { email } | { webhook_url } | { webhook_url, secret } | ...
  is_active   boolean default true,
  created_at  timestamptz default now()
);
create index if not exists idx_delivery_targets_user on delivery_targets(user_id);

-- ============================================================
-- SOURCES
-- ============================================================
create table if not exists sources (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,   -- 'email'|'rss'|'api'|'scrape'
  name          text not null,
  vendor        text,             -- 'wsj'|'theinformation'|'bloomberg'|'custom'
  url           text,
  config        jsonb not null default '{}',   -- per-type cfg (cookie, auth, schedule, ...)
  topics        text[] default '{}',
  poll_interval_minutes int default 60,
  is_active     boolean default true,
  last_polled_at timestamptz,
  last_status   text,
  last_error    text,
  created_at    timestamptz default now()
);
create index if not exists idx_sources_type on sources(type) where is_active;

-- ============================================================
-- ARTICLES (raw normalized content)
-- ============================================================
create table if not exists articles (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid references sources(id) on delete set null,
  external_id    text,                 -- vendor id or rss guid
  url            text,
  title          text not null,
  author         text,
  published_at   timestamptz,
  ingested_at    timestamptz default now(),
  language       text,
  topics         text[] default '{}',
  raw_html       text,
  content_text   text not null,        -- cleaned plaintext
  content_hash   text not null,        -- sha256(content_text) for dedupe
  metadata       jsonb default '{}'
);
create unique index if not exists uq_articles_hash on articles(content_hash);
create index if not exists idx_articles_published on articles(published_at desc);
create index if not exists idx_articles_source on articles(source_id);

-- ============================================================
-- SUMMARIES (AI output cached per style)
-- ============================================================
create table if not exists summaries (
  id            uuid primary key default gen_random_uuid(),
  article_id    uuid not null references articles(id) on delete cascade,
  style         text not null default 'briefing',
  language      text not null default 'zh-CN',
  title_cn      text,
  one_liner     text,
  bullets       jsonb,                -- ['point1','point2',...]
  body_md       text,
  model         text,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz default now(),
  unique (article_id, style, language)
);

-- ============================================================
-- DIGESTS & DELIVERIES
-- ============================================================
create table if not exists digests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  period_start   timestamptz not null,
  period_end     timestamptz not null,
  title          text,
  body_md        text,
  article_ids    uuid[] default '{}',
  status         text default 'draft',  -- 'draft'|'ready'|'sent'|'failed'
  created_at     timestamptz default now()
);
create index if not exists idx_digests_user on digests(user_id, created_at desc);

create table if not exists deliveries (
  id          uuid primary key default gen_random_uuid(),
  digest_id   uuid not null references digests(id) on delete cascade,
  target_id   uuid not null references delivery_targets(id) on delete cascade,
  channel     text not null,
  status      text not null default 'pending', -- 'pending'|'sent'|'failed'
  response    jsonb,
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz default now()
);
create index if not exists idx_deliveries_digest on deliveries(digest_id);

-- ============================================================
-- INGESTION JOURNAL (for debugging + idempotency)
-- ============================================================
create table if not exists ingest_jobs (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id) on delete set null,
  trigger      text not null,    -- 'cron'|'manual'|'webhook'
  started_at   timestamptz default now(),
  finished_at  timestamptz,
  items_found  int default 0,
  items_new    int default 0,
  status       text default 'running',
  error        text
);
