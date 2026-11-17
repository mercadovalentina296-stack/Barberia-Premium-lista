
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'client' check (role in ('client','admin')),
  created_at timestamptz not null default now()
);


create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Cliente'),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id),
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists appointments_no_double_booking
on public.appointments (appointment_date, appointment_time)
where status in ('pending', 'confirmed');

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  discount_percent numeric(5,2) check (discount_percent between 0 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;
alter table public.promotions enable row level security;


create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;


drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select to authenticated
using (auth.uid() = id or public.is_admin());

drop policy if exists services_read_active on public.services;
create policy services_read_active on public.services for select to anon, authenticated using (active = true or public.is_admin());
drop policy if exists services_admin_all on public.services;
create policy services_admin_all on public.services for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists appointments_read_own on public.appointments;
create policy appointments_read_own on public.appointments for select to authenticated
using (auth.uid() = customer_id or public.is_admin());
drop policy if exists appointments_insert_own on public.appointments;
create policy appointments_insert_own on public.appointments for insert to authenticated with check (auth.uid() = customer_id);
drop policy if exists appointments_update_own on public.appointments;
drop policy if exists appointments_update_admin on public.appointments;
create policy appointments_update_admin on public.appointments for update to authenticated
using (public.is_admin())
with check (public.is_admin());
drop policy if exists appointments_delete_own on public.appointments;
create policy appointments_delete_own on public.appointments for delete to authenticated
using (auth.uid() = customer_id or public.is_admin());



create or replace function public.cancel_own_appointment(p_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  if auth.uid() is null then
    raise exception 'Debés iniciar sesión para cancelar una reserva.';
  end if;
  update public.appointments
     set status = 'cancelled'
   where id = p_appointment_id
     and customer_id = auth.uid()
     and status in ('pending', 'confirmed');
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.cancel_own_appointment(uuid) from public;
grant execute on function public.cancel_own_appointment(uuid) to authenticated;


drop policy if exists reviews_read_approved on public.reviews;
create policy reviews_read_approved on public.reviews for select to anon, authenticated
using (approved = true or public.is_admin());
drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews for insert to authenticated with check (auth.uid() = customer_id);
drop policy if exists reviews_admin_update on public.reviews;
create policy reviews_admin_update on public.reviews for update to authenticated
using (public.is_admin())
with check (public.is_admin());


drop policy if exists promotions_read_active on public.promotions;
create policy promotions_read_active on public.promotions for select to anon, authenticated
using (active = true or public.is_admin());
drop policy if exists promotions_admin_all on public.promotions;
create policy promotions_admin_all on public.promotions for all to authenticated
using (public.is_admin())
with check (public.is_admin());


insert into public.services (name, description, price, duration_minutes)
select * from (values
  ('Corte clásico', 'Corte prolijo y personalizado.', 5000::numeric, 30),
  ('Arreglo de barba', 'Perfilado y cuidado de barba.', 3500::numeric, 20),
  ('Corte + barba', 'Servicio completo de corte y barba.', 7500::numeric, 50)
) as initial(name, description, price, duration_minutes)
where not exists (select 1 from public.services s where s.name = initial.name);


