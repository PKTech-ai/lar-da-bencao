-- Onda 2 — Eventos: agenda, itens (previsto x disponível), escala de trabalho e avaliação.
-- Tabelas geradas a partir de lib/resources/defs/eventos.ts (resourceDDL).

begin;

create table if not exists app.events (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 160),
  event_date date,
  event_time text not null default '' check (char_length(event_time) <= 5),
  place text not null default '' check (char_length(place) <= 200),
  responsible text not null default '' check (char_length(responsible) <= 160),
  status text not null,
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
grant select, insert, update on app.events to lar_app;

create table if not exists app.event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references app.events(id) not null,
  item text not null default '' check (char_length(item) <= 160),
  category text,
  unit text not null default '' check (char_length(unit) <= 20),
  planned_qty integer not null,
  received_qty integer not null,
  value_cents bigint,
  responsible text not null default '' check (char_length(responsible) <= 160),
  notes text not null default '' check (char_length(notes) <= 500),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.event_items to lar_app;

create table if not exists app.event_shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references app.events(id) not null,
  worker_id uuid references app.workers(id) not null,
  place text not null default '' check (char_length(place) <= 160),
  notes text not null default '' check (char_length(notes) <= 500),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.event_shifts to lar_app;

create table if not exists app.event_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references app.events(id) not null,
  product text not null default '' check (char_length(product) <= 160),
  purchased text not null default '' check (char_length(purchased) <= 120),
  suggestion text not null default '' check (char_length(suggestion) <= 1000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.event_reviews to lar_app;

alter table app.events add constraint events_status_check check (status in ('A definir','Planejado','Em preparação','Realizado','Cancelado'));
alter table app.events add constraint events_time_check check (event_time = '' or event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table app.event_items add constraint event_items_category_check check (category is null or category in ('Alimentos','Materiais e apoio','Descartáveis','Outros'));
create index if not exists event_items_event on app.event_items (event_id);
create index if not exists event_shifts_event on app.event_shifts (event_id);
create index if not exists event_reviews_event on app.event_reviews (event_id);
create unique index if not exists event_shifts_worker on app.event_shifts (event_id, worker_id) where archived_at is null;

commit;
