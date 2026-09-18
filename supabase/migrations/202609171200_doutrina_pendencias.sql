begin;

-- BL-023 (Culto no Lar), BL-024 (Planejamento de Treinamentos) e BL-026 (Caravana no Lar) — paridade v215.

-- Culto no Lar dos Trabalhadores: um por mês, no penúltimo sábado. A primeira versão (culto_lar_entries)
-- não seguia o mock e não tem uso no código.
drop table if exists app.culto_lar_entries;

create table if not exists app.culto_lar_months (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  culto_date date not null check (extract(dow from culto_date) = 6),
  requester_id uuid references app.workers(id) on delete set null,
  house text not null default '' check (char_length(house) <= 200),
  leader_id uuid references app.workers(id) on delete set null,
  speaker_id uuid references app.workers(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references app.users(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  unique (year, month),
  check (extract(year from culto_date) = year and extract(month from culto_date) = month)
);

-- Planejamento anual de treinamentos dos trabalhadores.
create table if not exists app.doctrine_trainings (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  catalog_key text check (catalog_key is null or catalog_key ~ '^[a-z_]{2,40}$'),
  title text not null check (char_length(title) between 1 and 200),
  objective text not null default '' check (char_length(objective) <= 4000),
  audience text not null default '' check (char_length(audience) <= 300),
  responsible text not null default '' check (char_length(responsible) <= 300),
  location text not null default '' check (char_length(location) <= 300),
  resources text not null default '' check (char_length(resources) <= 6000),
  status text not null default 'Planejado' check (status in ('Planejado','Em andamento','Concluído','Cancelado')),
  participant_count integer check (participant_count is null or participant_count >= 0),
  completed_at date check (completed_at is null or extract(year from completed_at) = year),
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
create index if not exists doctrine_trainings_year_idx on app.doctrine_trainings (year, sort_order);

create table if not exists app.doctrine_training_sessions (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references app.doctrine_trainings(id) on delete cascade,
  session_date date not null,
  start_time time,
  end_time time,
  topic text not null default '' check (char_length(topic) <= 500),
  check (end_time is null or (start_time is not null and end_time > start_time))
);
create unique index if not exists doctrine_training_sessions_slot_idx
  on app.doctrine_training_sessions (training_id, session_date, coalesce(start_time, time '00:00'));

-- Caravana no Lar: atividades planejadas/realizadas.
create table if not exists app.caravana_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  activity_date date not null,
  activity_time time,
  place text not null default '' check (char_length(place) <= 250),
  responsible text not null check (char_length(responsible) between 1 and 180),
  status text not null default 'Planejada' check (status in ('Planejada','Realizada','Cancelada')),
  participants integer check (participants is null or participants between 0 and 1000000),
  notes text not null default '' check (char_length(notes) <= 6000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  check (status <> 'Realizada' or participants is not null)
);
create index if not exists caravana_activities_date_idx on app.caravana_activities (activity_date);

grant select, insert, update on app.culto_lar_months to lar_app;
grant select, insert, update, delete on app.doctrine_trainings, app.doctrine_training_sessions, app.caravana_activities to lar_app;

commit;
