-- Onda 2 — Assistência: planejamento anual do departamento.

begin;

create table if not exists app.social_plan_items (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null,
  action text not null default '' check (char_length(action) <= 200),
  activity text,
  status text not null,
  basis text not null default '' check (char_length(basis) <= 250),
  responsible text not null default '' check (char_length(responsible) <= 160),
  goal text not null default '' check (char_length(goal) <= 120),
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
grant select, insert, update on app.social_plan_items to lar_app;

alter table app.social_plan_items add constraint social_plan_status_check check (status in ('Planejada','Em andamento','Concluída','Cancelada'));
alter table app.social_plan_items add constraint social_plan_month_check check (month between 1 and 12);
create index if not exists social_plan_year on app.social_plan_items (year, month);

commit;
