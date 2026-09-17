begin;

-- BL-027/028/029: Infância e Juventude — matrícula anual, turmas/grupos, evangelizadores,
-- chamada dominical, cronograma, planejamento e relatório anual (paridade v215).
-- Dados de menores (RF-013): leitura restrita ao departamento; evangelizador só vê as próprias turmas.

alter table app.evangelizandos
  add column if not exists filled_date date,
  add column if not exists age_reference integer,
  add column if not exists address text check (address is null or char_length(address) <= 300),
  add column if not exists point_reference text check (point_reference is null or char_length(point_reference) <= 300),
  add column if not exists guardian_relation text check (guardian_relation is null or char_length(guardian_relation) <= 60),
  add column if not exists whatsapp text check (whatsapp is null or char_length(whatsapp) <= 40),
  add column if not exists father_name text check (father_name is null or char_length(father_name) <= 160),
  add column if not exists father_contact text check (father_contact is null or char_length(father_contact) <= 40),
  add column if not exists mother_name text check (mother_name is null or char_length(mother_name) <= 160),
  add column if not exists mother_contact text check (mother_contact is null or char_length(mother_contact) <= 40),
  add column if not exists religion text check (religion is null or char_length(religion) <= 80),
  add column if not exists marital_status text check (marital_status is null or char_length(marital_status) <= 40),
  add column if not exists valid_through_year integer check (valid_through_year between 2000 and 2100),
  add column if not exists manual_inactive boolean not null default false,
  add column if not exists inactive_at date,
  add column if not exists inactive_reason text,
  add column if not exists rancho_requested boolean not null default false,
  add column if not exists notes text not null default '' check (char_length(notes) <= 2000),
  add column if not exists photo_attachment_id uuid references app.attachments(id) on delete set null;

update app.evangelizandos set valid_through_year = coalesce(year_enrolled, extract(year from created_at)::int) where valid_through_year is null;
update app.evangelizandos set filled_date = created_at::date where filled_date is null;
alter table app.evangelizandos alter column valid_through_year set not null;
alter table app.evangelizandos alter column filled_date set not null;

create table if not exists app.evangelizando_renewals (
  id uuid primary key default gen_random_uuid(),
  evangelizando_id uuid not null references app.evangelizandos(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  class_group text not null,
  renewed_at timestamptz not null default now(),
  renewed_by uuid not null references app.users(id),
  unique (evangelizando_id, year)
);

create table if not exists app.education_group_evangelizers (
  department_key text not null references app.departments(key) check (department_key in ('infancia','juventude')),
  class_group text not null,
  position smallint not null check (position in (0, 1)),
  worker_id uuid not null references app.workers(id) on delete cascade,
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  primary key (department_key, class_group, position),
  unique (department_key, class_group, worker_id)
);

create table if not exists app.evangelizando_attendance (
  evangelizando_id uuid not null references app.evangelizandos(id) on delete cascade,
  class_date date not null check (extract(dow from class_date) = 0),
  mark text not null check (mark in ('P','F')),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  primary key (evangelizando_id, class_date)
);

create table if not exists app.education_schedule (
  department_key text not null references app.departments(key) check (department_key in ('infancia','juventude')),
  class_date date not null check (extract(dow from class_date) = 0),
  class_group text not null,
  theme text not null default '' check (char_length(theme) <= 300),
  responsible text not null default '' check (char_length(responsible) <= 300),
  -- Campos complementares do Planejamento Anual (programa de aulas integrado ao cronograma).
  objective text not null default '' check (char_length(objective) <= 1000),
  reference text not null default '' check (char_length(reference) <= 300),
  resources text not null default '' check (char_length(resources) <= 1000),
  status text not null default 'Planejado' check (status in ('Planejado','Em andamento','Realizado','Adiado','Cancelado')),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  primary key (department_key, class_date, class_group)
);

create table if not exists app.education_plans (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references app.departments(key) check (department_key in ('infancia','juventude')),
  year integer not null check (year between 2020 and 2100),
  objective text not null default '' check (char_length(objective) <= 4000),
  priorities text not null default '' check (char_length(priorities) <= 4000),
  expected text not null default '' check (char_length(expected) <= 4000),
  notes text not null default '' check (char_length(notes) <= 4000),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  unique (department_key, year)
);

create table if not exists app.education_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references app.education_plans(id) on delete cascade,
  kind text not null check (kind in ('special','management')),
  item_date date,
  month integer check (month between 1 and 12),
  title text not null check (char_length(title) between 1 and 300),
  item_type text not null default '' check (char_length(item_type) <= 60),
  purpose text not null default '' check (char_length(purpose) <= 1000),
  audience text not null default '' check (char_length(audience) <= 160),
  location text not null default '' check (char_length(location) <= 300),
  responsible text not null default '' check (char_length(responsible) <= 300),
  requirements text not null default '' check (char_length(requirements) <= 1000),
  status text not null default 'Planejado' check (status in ('Planejado','Em andamento','Realizado','Adiado','Cancelado')),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  -- Recesso: nada antes do 1º domingo de março (datas) nem em janeiro/fevereiro (meses).
  check (item_date is null or extract(month from item_date) >= 3),
  check (month is null or month >= 3)
);

create index if not exists evangelizandos_group_idx on app.evangelizandos (department_key, class_group);
create index if not exists attendance_date_idx on app.evangelizando_attendance (class_date);
create index if not exists plan_items_plan_idx on app.education_plan_items (plan_id, kind);

-- Evangelizador: consulta e lançamentos (chamada e cronograma) somente nas turmas vinculadas.
insert into app.role_permissions (role_key, resource, action, department_scoped) values
  ('evangelizador', 'education_class', 'update', true),
  ('coordenador', 'education_class', 'update', true),
  ('subcoordenador', 'education_class', 'update', true)
on conflict do nothing;

grant select, insert, update, delete on app.evangelizandos, app.evangelizando_attendance, app.education_group_evangelizers,
  app.education_schedule, app.education_plan_items to lar_app;
grant select, insert on app.evangelizando_renewals to lar_app;
grant select, insert, update on app.education_plans to lar_app;

commit;
