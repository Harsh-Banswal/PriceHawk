-- Supabase Schema for Price Tracker
-- Contains exactly three tables: tracked_products, price_history, scrape_logs

-- Ensure pgcrypto extension is available for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Table 1: tracked_products
create table tracked_products (
  id uuid primary key default gen_random_uuid(),
  store_product_id text not null unique,
  name text not null,
  slug text not null,
  product_url text not null,
  scrape_interval_minutes int not null default 120,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Table 2: price_history
-- CRITICAL RULE: price_history gets a row ONLY when a scrape produces a price
-- that passes reconciliation against MRP and discount.
-- Never write 0, null, or a carried-forward price.
create table price_history (
  id bigserial primary key,
  product_id uuid references tracked_products(id) on delete cascade,
  price numeric(12,2) not null check (price > 0),
  mrp numeric(12,2),
  discount_percent numeric(5,2),
  currency text not null default 'INR',
  stock_status text not null,
  scraped_at timestamptz not null default now()
);

-- Table 3: scrape_logs
-- Every scrape attempt or batch writes to scrape_logs regardless of outcome
create table scrape_logs (
  id bigserial primary key,
  product_id uuid references tracked_products(id) on delete cascade,
  outcome text not null check (outcome in (
    'success',
    'success_after_retry',
    'failed_timeout',
    'failed_navigation',
    'failed_parse',
    'failed_validation'
  )),
  attempt_count int not null,
  duration_ms int,
  error_message text,
  price_reconciled boolean,
  created_at timestamptz not null default now()
);

-- Required Indexes
create index idx_price_history_product_scraped on price_history(product_id, scraped_at desc);
create index idx_scrape_logs_product_created on scrape_logs(product_id, created_at desc);
