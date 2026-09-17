-- Onda 2 — Assistência e Promoção Social: famílias, voluntários, mantenedores, rancho, kits,
-- controle de atividades, café das crianças e os setores Brechó e Clube de Mães.

begin;

create table if not exists app.social_families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 160),
  status text not null,
  phone text,
  people_count integer,
  birth_date date,
  document text not null default '' check (char_length(document) <= 50),
  neighborhood text not null default '' check (char_length(neighborhood) <= 160),
  address text not null default '' check (char_length(address) <= 300),
  start_date date,
  end_date date,
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.social_families to lar_app;

create table if not exists app.social_volunteers (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 160),
  area text not null,
  status text not null,
  phone text,
  email text,
  birth_date date,
  neighborhood text not null default '' check (char_length(neighborhood) <= 160),
  document text not null default '' check (char_length(document) <= 50),
  address text not null default '' check (char_length(address) <= 300),
  start_date date,
  end_date date,
  availability text not null default '' check (char_length(availability) <= 250),
  skills text not null default '' check (char_length(skills) <= 1000),
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.social_volunteers to lar_app;

create table if not exists app.social_basket_supporters (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 160),
  person_type text not null,
  support_type text not null,
  value_cents bigint,
  frequency text not null,
  status text not null,
  phone text,
  birth_date date,
  preferred_day integer,
  start_date date,
  end_date date,
  pledge text not null default '' check (char_length(pledge) <= 350),
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.social_basket_supporters to lar_app;

create table if not exists app.social_rancho_deliveries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references app.social_families(id) not null,
  reference_month text not null,
  delivery_date date,
  status text not null,
  baskets integer,
  items text not null default '' check (char_length(items) <= 1000),
  responsible text not null default '' check (char_length(responsible) <= 160),
  notes text not null default '' check (char_length(notes) <= 1000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.social_rancho_deliveries to lar_app;

create table if not exists app.social_hygiene_kits (
  id uuid primary key default gen_random_uuid(),
  planned_date date not null,
  status text not null,
  delivery_date date,
  kits_delivered integer,
  responsible text not null default '' check (char_length(responsible) <= 160),
  audience text not null default '' check (char_length(audience) <= 250),
  place text not null default '' check (char_length(place) <= 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.social_hygiene_kits to lar_app;

create table if not exists app.social_activities (
  id uuid primary key default gen_random_uuid(),
  activity text not null,
  status text not null,
  planned_date date,
  effective_date date,
  quantity integer,
  unit text not null default '' check (char_length(unit) <= 40),
  responsible text not null default '' check (char_length(responsible) <= 160),
  audience text not null default '' check (char_length(audience) <= 250),
  place text not null default '' check (char_length(place) <= 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.social_activities to lar_app;

create table if not exists app.social_coffee_donors (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 160),
  link_type text not null,
  worker_id uuid references app.workers(id),
  contribution_type text not null,
  value_cents bigint,
  frequency text not null,
  status text not null,
  phone text,
  start_date date not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.social_coffee_donors to lar_app;

create table if not exists app.social_sector_ledger (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  direction text not null,
  description text not null default '' check (char_length(description) <= 200),
  category text not null default '' check (char_length(category) <= 80),
  quantity integer,
  amount_cents bigint not null,
  payment_method text,
  notes text not null default '' check (char_length(notes) <= 1000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.social_sector_ledger to lar_app;

create table if not exists app.club_people (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 160),
  status text not null,
  phone text,
  start_date date not null,
  notes text not null default '' check (char_length(notes) <= 1000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.club_people to lar_app;

create table if not exists app.club_deliveries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references app.club_people(id) not null,
  delivery_date date not null,
  items text not null default '' check (char_length(items) <= 1000),
  responsible text not null default '' check (char_length(responsible) <= 160),
  notes text not null default '' check (char_length(notes) <= 1000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.club_deliveries to lar_app;

-- Livro caixa dos setores: a coluna sector separa Brechó e Clube de Mães (permissões distintas).
alter table app.social_sector_ledger add column if not exists sector text not null check (sector in ('brecho','clube_maes'));
alter table app.social_sector_ledger add constraint social_ledger_direction_check check (direction in ('Entrada','Saída'));
alter table app.social_sector_ledger add constraint social_ledger_amount_check check (amount_cents > 0);
create index if not exists social_ledger_sector_month on app.social_sector_ledger (sector, entry_date desc);

alter table app.social_families add constraint social_families_status_check check (status in ('Em acompanhamento','Pausado','Encerrado'));
alter table app.social_volunteers add constraint social_volunteers_status_check check (status in ('Disponível','Pausado','Encerrado'));
alter table app.social_basket_supporters add constraint social_supporters_status_check check (status in ('Colaborando','Pausado','Encerrado'));
alter table app.social_rancho_deliveries add constraint social_rancho_status_check check (status in ('Programada','Entregue','Não retirada','Cancelada'));
alter table app.social_hygiene_kits add constraint social_kits_status_check check (status in ('Programada','Realizada','Cancelada'));
alter table app.social_activities add constraint social_activities_status_check check (status in ('Programada','Realizada','Cancelada'));
alter table app.social_coffee_donors add constraint social_coffee_status_check check (status in ('Colaborando','Pausado','Encerrado'));
alter table app.club_people add constraint club_people_status_check check (status in ('Em acompanhamento','Pausada','Encerrada'));
create index if not exists social_rancho_family on app.social_rancho_deliveries (family_id, reference_month);
create index if not exists club_deliveries_person on app.club_deliveries (person_id);

commit;
