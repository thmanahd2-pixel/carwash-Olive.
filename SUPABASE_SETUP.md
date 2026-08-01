# Supabase Setup — CarWash Pro

Follow these steps once. After you finish, come back with your **Project URL** and
**anon public key** and the app will connect automatically via `.env`.

## 1. Create the project

1. Go to https://supabase.com → **New project**.
2. Pick a name (e.g. `carwash-pro`), a strong database password (save it somewhere
   safe — you won't need it for the app, only for direct DB access), and a region
   close to you.
3. Wait ~2 minutes for provisioning.

## 2. Run the schema

Open **SQL Editor → New query** in the Supabase dashboard, paste the entire block
below, and click **Run**.

```sql
-- ================= EXTENSIONS =================
create extension if not exists "pgcrypto";

-- ================= CARS =================
create table if not exists cars (
  id uuid primary key default gen_random_uuid(),
  car_number text,
  customer_name text,
  customer_phone text,
  car_type text,
  car_size text,
  dirt_level text,
  notes text,
  service_type text,
  employee_ids jsonb not null default '[]',
  price numeric not null default 0,
  discount numeric not null default 0,
  payment_method text,
  paid boolean not null default false,
  timestamps jsonb not null default '{}',   -- {arrival, washStart, ..., delivered}
  quality jsonb not null default '{}',      -- {rating, problems}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false    -- soft delete: rows are NEVER hard-deleted
);

-- ================= EMPLOYEES =================
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ================= EXPENSES =================
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date text,
  time text,
  category text,
  amount numeric not null default 0,
  description text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ================= SETTINGS (single row) =================
create table if not exists settings (
  id text primary key default 'default',
  targets jsonb not null default '{"small":35,"medium":40,"large":50}',
  updated_at timestamptz not null default now()
);
insert into settings (id) values ('default') on conflict (id) do nothing;

-- ================= CAR PHOTOS =================
create table if not exists car_photos (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars(id) on delete cascade,
  kind text not null check (kind in ('before','after')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index if not exists car_photos_car_id_idx on car_photos(car_id);

-- ================= ROLES (staff access levels) =================
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  role text not null default 'staff' check (role in ('owner','admin','manager','cashier','staff')),
  permissions jsonb not null default '[]',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ================= PARTNERS (co-owners / profit share) =================
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  share_percentage numeric not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ================= DAILY CLOSE (end-of-day cash reconciliation) =================
create table if not exists daily_close (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  opening_cash numeric not null default 0,
  expected_cash numeric not null default 0,
  counted_cash numeric not null default 0,
  difference numeric not null default 0,
  total_revenue numeric not null default 0,
  total_expenses numeric not null default 0,
  cash_by_method jsonb not null default '{}',
  closed_by text,
  notes text,
  status text not null default 'closed' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index if not exists daily_close_date_idx on daily_close(date);

-- ================= FIXED EXPENSES (recurring: rent, salaries, etc.) =================
create table if not exists fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  amount numeric not null default 0,
  frequency text not null default 'monthly' check (frequency in ('weekly','monthly','yearly')),
  due_day integer,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ================= AUDIT LOG (append-only, never edited or deleted) =================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'
);
create index if not exists audit_log_at_idx on audit_log(at desc);

-- ================= updated_at auto-touch =================
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_cars_updated on cars;
create trigger trg_cars_updated before update on cars
  for each row execute function set_updated_at();

drop trigger if exists trg_employees_updated on employees;
create trigger trg_employees_updated before update on employees
  for each row execute function set_updated_at();

drop trigger if exists trg_expenses_updated on expenses;
create trigger trg_expenses_updated before update on expenses
  for each row execute function set_updated_at();

drop trigger if exists trg_roles_updated on roles;
create trigger trg_roles_updated before update on roles
  for each row execute function set_updated_at();

drop trigger if exists trg_partners_updated on partners;
create trigger trg_partners_updated before update on partners
  for each row execute function set_updated_at();

drop trigger if exists trg_daily_close_updated on daily_close;
create trigger trg_daily_close_updated before update on daily_close
  for each row execute function set_updated_at();

drop trigger if exists trg_fixed_expenses_updated on fixed_expenses;
create trigger trg_fixed_expenses_updated before update on fixed_expenses
  for each row execute function set_updated_at();

-- ================= ROW LEVEL SECURITY =================
alter table cars enable row level security;
alter table employees enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;
alter table car_photos enable row level security;
alter table roles enable row level security;
alter table partners enable row level security;
alter table daily_close enable row level security;
alter table fixed_expenses enable row level security;
alter table audit_log enable row level security;

-- Any signed-in user (you / your staff logins) can read & write everything.
-- This is a single-business internal tool, so one shared policy per table is enough.
create policy "authenticated full access" on cars
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on employees
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on expenses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on car_photos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on roles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on partners
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on daily_close
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on fixed_expenses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- audit_log: any signed-in user can insert/read, but rows can never be updated or deleted from the app.
create policy "authenticated read audit_log" on audit_log
  for select using (auth.role() = 'authenticated');
create policy "authenticated insert audit_log" on audit_log
  for insert with check (auth.role() = 'authenticated');
```

> **Note on `roles`:** this table drives in-app permission *display* only for now (Phase 1). Real
> enforcement (blocking writes server-side per role) is a Phase 2 item — see the note in
> `src/hooks/useUserRole.js`. Until then, every table above still uses the same
> "any authenticated user" policy as the rest of the app.

## 3. Create storage buckets (for photos & receipts)

**Storage → New bucket**:

- `car-photos` → Public bucket: **ON**
- `receipts` → Public bucket: **ON**

Then run this in SQL Editor so only signed-in users can upload/delete (everyone can
still *view* photos via their public URL, which is what lets them show up in the app
and in exported reports):

```sql
create policy "authenticated upload car-photos" on storage.objects
  for insert with check (bucket_id = 'car-photos' and auth.role() = 'authenticated');
create policy "authenticated delete car-photos" on storage.objects
  for delete using (bucket_id = 'car-photos' and auth.role() = 'authenticated');
create policy "public read car-photos" on storage.objects
  for select using (bucket_id = 'car-photos');

create policy "authenticated upload receipts" on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.role() = 'authenticated');
create policy "authenticated delete receipts" on storage.objects
  for delete using (bucket_id = 'receipts' and auth.role() = 'authenticated');
create policy "public read receipts" on storage.objects
  for select using (bucket_id = 'receipts');
```

## 4. Create a login for yourself (and staff)

**Authentication → Users → Add user** → enter an email + password for yourself
(and one per employee who needs access, optional). The app has a simple sign-in
screen — no public sign-up, so only accounts you create here can log in.

## 5. Get your API keys

**Project Settings → API**:

- Copy **Project URL**
- Copy **anon public** key (NOT the `service_role` key — never put that in the app)

## 6. Connect the app

In the project folder, copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Restart `npm run dev` (or rebuild/redeploy) and the app will connect. If `.env` is
left empty, the app still runs fully offline on IndexedDB — it will just skip cloud
sync until you add the keys.

## Why this design keeps data safe

- **Soft deletes only** — every table has a `deleted` flag; the app never issues a
  hard `DELETE`, so nothing is ever truly erased server-side. Recovery is always a
  SQL `update ... set deleted=false` away.
- **IndexedDB is the local source of truth** — every write lands on-device first,
  instantly, whether or not you're online. Supabase sync happens in the background.
- **Sync queue** — offline changes are queued and retried automatically when the
  connection returns, so nothing typed while offline is lost.
