-- Схема базы данных «Мониторинг стоимости аренды» (Supabase / PostgreSQL)
-- Выполните скрипт в SQL Editor проекта Supabase, затем укажите
-- VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.
-- При первом запуске пустая база заполняется демонстрационными данными.

create table if not exists price_records (
  id             text primary key,
  region         text        not null,
  settlement     text        not null,
  premise_type   text        not null,
  area           numeric     not null check (area > 0),
  monthly_cost   numeric     not null check (monthly_cost >= 0),
  price_per_m2   numeric     not null,
  purchase_date  date        not null,
  source         text        not null,
  address        text,
  demo           boolean     not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists price_records_lookup on price_records (region, settlement, premise_type, purchase_date);

create table if not exists market_offers (
  id            text primary key,
  region        text    not null,
  settlement    text    not null,
  premise_type  text    not null,
  address       text    not null,
  area          numeric not null check (area > 0),
  monthly_cost  numeric not null check (monthly_cost >= 0),
  price_per_m2  numeric not null,
  listed_at     date    not null,
  source        text    not null,
  url           text,
  demo          boolean not null default false
);
create index if not exists market_offers_lookup on market_offers (region, settlement, premise_type, listed_at);

create table if not exists applications (
  id             text primary key,
  number         text        not null unique,
  created_at     timestamptz not null,
  updated_at     timestamptz not null,
  region         text        not null,
  settlement     text        not null,
  premise_type   text        not null,
  address        text        not null,
  area           numeric     not null check (area > 0),
  monthly_cost   numeric     not null check (monthly_cost >= 0),
  supplier       text        not null,
  notes          text,
  price_per_m2   numeric     not null,
  benchmark      jsonb       not null,   -- снимок ценового ориентира на момент расчёта
  deviation      numeric,
  verdict        text        not null check (verdict in ('over', 'within', 'nodata')),
  status         text        not null,
  justification  jsonb,                  -- запрос обоснования, ответ заказчика, вложения
  history        jsonb       not null default '[]'::jsonb,
  demo           boolean     not null default false
);
create index if not exists applications_region on applications (region, status);

create table if not exists app_settings (
  id   int primary key check (id = 1),
  data jsonb not null
);

-- Политики доступа. Для пилотной эксплуатации открыт доступ роли anon;
-- в промышленной эксплуатации замените на политики для аутентифицированных
-- пользователей корпоративного SSO.
alter table price_records enable row level security;
alter table market_offers enable row level security;
alter table applications  enable row level security;
alter table app_settings  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['price_records', 'market_offers', 'applications', 'app_settings'] loop
    execute format('drop policy if exists "pilot_all" on %I', t);
    execute format('create policy "pilot_all" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
