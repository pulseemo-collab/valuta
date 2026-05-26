-- Valuta — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query)

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Expenses ────────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'ALL',
  category text not null,
  note text not null default '',
  date text not null,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "Users can view own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

create index if not exists expenses_user_date_idx on public.expenses(user_id, date desc);

-- ── Budgets ─────────────────────────────────────────────────────────────────
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  monthly numeric(12, 2) not null default 0,
  currency text not null default 'ALL',
  updated_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

create policy "Users can view own budget"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Users can upsert own budget"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budget"
  on public.budgets for update
  using (auth.uid() = user_id);

-- ── Invoices ─────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'ALL',
  issue_date text not null,
  due_date text not null,
  status text not null default 'ne_pritje',
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

create policy "Users can view own invoices"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "Users can insert own invoices"
  on public.invoices for insert
  with check (auth.uid() = user_id);

create policy "Users can update own invoices"
  on public.invoices for update
  using (auth.uid() = user_id);

create policy "Users can delete own invoices"
  on public.invoices for delete
  using (auth.uid() = user_id);

create index if not exists invoices_user_date_idx on public.invoices(user_id, created_at desc);
