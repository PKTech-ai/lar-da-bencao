begin;

-- BL-013: a ficha do trabalhador é a própria solicitação de admissão (paridade com o mock v215).
-- Estados de app.workers.status: pending (aguardando Diretoria), active (aprovado e atuando),
-- inactive (aprovado, afastado), rejected (reprovado; reenviar a ficha volta para pending).
-- app.admission_requests (onda 1 inicial) deixa de ser usada pela aplicação; mantida só por histórico.

alter table app.workers
  add column if not exists naturality text check (naturality is null or char_length(naturality) <= 120),
  add column if not exists marital_status text check (marital_status is null or char_length(marital_status) <= 40),
  add column if not exists profession text check (profession is null or char_length(profession) <= 120),
  add column if not exists address text check (address is null or char_length(address) <= 300),
  add column if not exists filled_date date,
  add column if not exists volunteer_service text not null default '' check (char_length(volunteer_service) <= 2000),
  add column if not exists accepts_volunteer_law boolean not null default false,
  add column if not exists image_authorization boolean not null default false,
  add column if not exists functions text[] not null default '{}',
  add column if not exists available_days smallint[] not null default '{0,1,3,4,5,6}',
  add column if not exists origin_department text references app.departments(key),
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists approved_at date;

alter table app.workers drop constraint if exists workers_functions_check;
alter table app.workers add constraint workers_functions_check check (
  functions <@ array['Passista','Psicofônico','Dialogador','Dirigente de Reunião','Dirigente de Estudo',
                     'Expositor de Estudo','Palestrante','Dirigente de Palestra','Entrevistador','Recepcionista']::text[]
);
alter table app.workers drop constraint if exists workers_available_days_check;
alter table app.workers add constraint workers_available_days_check check (available_days <@ array[0,1,2,3,4,5,6]::smallint[]);

create table if not exists app.worker_approval_decisions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references app.workers(id) on delete cascade,
  decision text not null check (decision in ('approved','rejected')),
  authority text not null default 'Diretoria',
  meeting_date date not null,
  minute_ref text not null default '' check (char_length(minute_ref) <= 200),
  reason text not null default '' check (char_length(reason) <= 2000),
  departments text[] not null default '{}',
  functions text[] not null default '{}',
  decided_by uuid not null references app.users(id),
  decided_at timestamptz not null default now(),
  check (decision = 'approved' or char_length(reason) > 0)
);

create index if not exists worker_decisions_worker_idx on app.worker_approval_decisions (worker_id, decided_at desc);
create index if not exists worker_departments_dept_idx on app.worker_departments (department_key, worker_id);

-- Decisões são histórico: a aplicação só insere e consulta.
grant select, insert on app.worker_approval_decisions to lar_app;

-- Escala e frequência precisam remover linhas (BL-022 e lançamentos de frequência).
grant delete on app.scale_assignments, app.attendance_marks to lar_app;

commit;
