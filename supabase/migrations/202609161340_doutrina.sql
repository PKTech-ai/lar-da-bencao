begin;

-- BL-021/BL-022: Doutrina — palestrantes externos, biblioteca de estudos, escala mensal e frequência (paridade v215).

-- Palestrantes externos: casa, cidade e temas.
alter table app.speakers
  add column if not exists house text check (house is null or char_length(house) <= 160),
  add column if not exists city text check (city is null or char_length(city) <= 120),
  add column if not exists themes text[] not null default '{}';

-- Biblioteca: pastas com subpastas e estudos tipados (o tipo alimenta a escala).
alter table app.study_folders
  add column if not exists parent_id uuid references app.study_folders(id) on delete restrict,
  add column if not exists system boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();
create unique index if not exists study_folders_name_idx
  on app.study_folders (department_key, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(title));

alter table app.studies
  add column if not exists study_type text check (study_type is null or study_type in ('ESE','ESDE','MEP','OBRA','PALESTRA','TREINAMENTO','OUTRO')),
  add column if not exists code text check (code is null or char_length(code) <= 40),
  add column if not exists reference text check (reference is null or char_length(reference) <= 300),
  add column if not exists attachment_id uuid references app.attachments(id) on delete set null,
  add column if not exists active boolean not null default true;
create index if not exists studies_type_idx on app.studies (department_key, study_type) where active;

insert into app.study_folders (department_key, title, system, sort_order)
select 'doutrina', v.title, true, v.ord
  from (values ('ESE',1),('ESDE',2),('MEP',3),('LE',4),('Treinamentos',5)) as v(title, ord)
 where not exists (
   select 1 from app.study_folders f where f.department_key='doutrina' and f.parent_id is null and lower(f.title)=lower(v.title)
 );

-- Escala mensal: estado do fluxo (gerar → conferir → aprovar → publicar; exclusão lógica).
alter table app.scale_months
  add column if not exists status text not null default 'generated'
    check (status in ('generated','in_review','pending_issues','checked','approved','published','deleted')),
  add column if not exists reviewed boolean not null default false,
  add column if not exists generated_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references app.users(id),
  add column if not exists published_at timestamptz;

-- Posição da escala: chave `dia-da-semana|seção|linha|dia|posição` do modelo.
alter table app.scale_assignments
  add column if not exists slot_key text,
  add column if not exists slot_value text not null default '' check (slot_value ~ '^(|w:[0-9a-f-]{36}|s:[0-9a-f-]{36}|t:[0-9a-f-]{36}|free:Tema Livre)$'),
  add column if not exists speaker_id uuid references app.speakers(id) on delete set null,
  add column if not exists study_id uuid references app.studies(id) on delete set null,
  add column if not exists is_extra boolean not null default false,
  add column if not exists edited boolean not null default false;
create unique index if not exists scale_assignments_slot_idx on app.scale_assignments (scale_month_id, slot_key);
create index if not exists scale_assignments_worker_idx on app.scale_assignments (worker_id) where worker_id is not null;

-- Frequência da Doutrina: participações por atividade e dia (totais são calculados).
create table if not exists app.attendance_counts (
  id uuid primary key default gen_random_uuid(),
  department_key text not null references app.departments(key),
  sheet_date date not null,
  row_id text not null check (row_id ~ '^[a-z_0-9]{2,40}$'),
  value integer not null check (value between 0 and 100000),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  unique (department_key, sheet_date, row_id)
);

-- Contato do departamento exibido nas escalas impressas.
create table if not exists app.department_contacts (
  department_key text primary key references app.departments(key),
  phone text not null default '' check (char_length(phone) <= 40),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);

grant select, insert, update, delete on app.attendance_counts to lar_app;
grant select, insert, update on app.department_contacts to lar_app;
grant delete on app.study_folders to lar_app;

commit;
