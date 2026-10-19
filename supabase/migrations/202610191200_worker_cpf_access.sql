alter table app.workers
  add column if not exists cpf text;

alter table app.workers
  drop constraint if exists workers_cpf_digits;
alter table app.workers
  add constraint workers_cpf_digits check (cpf is null or cpf ~ '^[0-9]{11}$');

create unique index if not exists workers_cpf_unique
  on app.workers (cpf) where cpf is not null;

alter table app.users
  add column if not exists cpf text,
  add column if not exists worker_id uuid references app.workers(id),
  add column if not exists must_reset_password boolean not null default false;

alter table app.users
  drop constraint if exists users_cpf_digits;
alter table app.users
  add constraint users_cpf_digits check (cpf is null or cpf ~ '^[0-9]{11}$');

create unique index if not exists users_cpf_unique
  on app.users (cpf) where cpf is not null;

create unique index if not exists users_worker_unique
  on app.users (worker_id) where worker_id is not null;
