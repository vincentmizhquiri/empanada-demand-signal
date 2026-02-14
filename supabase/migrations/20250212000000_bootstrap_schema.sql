-- Bootstrap schema for Empanada Demand Signal
-- Run via: supabase db push (or apply manually in SQL Editor)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/New_York',
  open_days int[] not null default '{3,4,5,6,0}',
  open_time text not null default '11:00',
  close_time text not null default '19:00',
  default_comparable_days int not null default 3,
  waste_factor numeric not null default 0.9
);

create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  category text not null,
  unique(shop_id, name)
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  unit text not null,
  unique(shop_id, name)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.skus(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  amount_per_unit numeric not null,
  unique(sku_id, ingredient_id)
);
