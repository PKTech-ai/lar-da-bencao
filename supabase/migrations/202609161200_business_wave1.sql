begin;

-- Onda 1: cadastros-base, Doutrina, Infância/Juventude, documentos e home operacional.

create table if not exists app.bienniums (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 2 and 80),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists app.workers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 160),
  email citext,
  phone text,
  birth_date date,
  status text not null default 'pending' check (status in ('pending','active','inactive','rejected')),
  notes text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);

create table if not exists app.worker_departments (
  worker_id uuid not null references app.workers(id) on delete cascade,
  department_key text not null references app.departments(key),
  primary key (worker_id, department_key)
);

create table if not exists app.admission_requests (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references app.workers(id) on delete set null,
  requester_user_id uuid not null references app.users(id),
  department_key text not null references app.departments(key),
  full_name text not null check (char_length(full_name) between 2 and 160),
  email citext,
  phone text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_by uuid references app.users(id),
  decision_at timestamptz,
  notes text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.speakers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 160),
  phone text,
  notes text not null default '',
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);

create table if not exists app.study_folders (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references app.departments(key),
  title text not null check (char_length(title) between 1 and 160),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists app.studies (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references app.departments(key),
  folder_id uuid references app.study_folders(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  status text not null default 'planned' check (status in ('planned','in_progress','done','cancelled')),
  scheduled_on date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);

create table if not exists app.scale_months (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references app.departments(key),
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  unique (department_key, year, month)
);

create table if not exists app.scale_assignments (
  id uuid primary key default gen_random_uuid(),
  scale_month_id uuid not null references app.scale_months(id) on delete cascade,
  work_date date not null,
  role_label text not null check (char_length(role_label) between 1 and 80),
  worker_id uuid references app.workers(id) on delete set null,
  notes text not null default ''
);

create table if not exists app.attendance_sheets (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references app.departments(key),
  sheet_date date not null,
  kind text not null check (kind in ('doctrine','evangelizando','juventude')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  unique (department_key, sheet_date, kind)
);

create table if not exists app.attendance_marks (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references app.attendance_sheets(id) on delete cascade,
  person_key text not null,
  person_name text not null,
  present boolean not null default false,
  notes text not null default '',
  unique (sheet_id, person_key)
);

create table if not exists app.evangelizandos (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references app.departments(key) check (department_key in ('infancia','juventude')),
  full_name text not null check (char_length(full_name) between 2 and 160),
  birth_date date,
  guardian_name text,
  guardian_phone text,
  class_group text,
  status text not null default 'active' check (status in ('active','inactive')),
  year_enrolled integer check (year_enrolled between 2000 and 2100),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);

create table if not exists app.culto_lar_entries (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  host_name text not null check (char_length(host_name) between 2 and 160),
  visitors_count integer not null default 0 check (visitors_count >= 0),
  notes text not null default '',
  worker_id uuid references app.workers(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);

create table if not exists app.institutional_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]+$'),
  title text not null check (char_length(title) between 2 and 200),
  attachment_id uuid references app.attachments(id) on delete set null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workers_status_idx on app.workers (status, full_name);
create index if not exists admission_status_idx on app.admission_requests (status, department_key, created_at desc);
create index if not exists studies_dept_idx on app.studies (department_key, status, scheduled_on);
create index if not exists scale_assignments_date_idx on app.scale_assignments (work_date);
create index if not exists evangelizandos_dept_idx on app.evangelizandos (department_key, status, full_name);
create index if not exists culto_lar_date_idx on app.culto_lar_entries (visit_date desc);

insert into app.feature_flags (key, enabled, description) values
  ('business_modules', true, 'Módulos operacionais da onda 1 liberados.'),
  ('module_workers', true, 'Trabalhadores e admissões.'),
  ('module_doutrina', true, 'Doutrina: palestrantes, estudos, escalas, frequência, culto.'),
  ('module_infancia', true, 'Infância — evangelizandos.'),
  ('module_juventude', true, 'Juventude — evangelizandos.'),
  ('module_documentos', true, 'Estatuto e documentos institucionais.'),
  ('module_home_ops', true, 'KPIs e atalhos da visão geral.')
on conflict (key) do update set enabled = excluded.enabled, description = excluded.description, updated_at = now();

grant select, insert, update on app.bienniums, app.workers, app.admission_requests, app.speakers,
  app.study_folders, app.studies, app.scale_months, app.scale_assignments, app.attendance_sheets,
  app.attendance_marks, app.evangelizandos, app.culto_lar_entries, app.institutional_documents to lar_app;
grant select, insert, update, delete on app.worker_departments to lar_app;

commit;
