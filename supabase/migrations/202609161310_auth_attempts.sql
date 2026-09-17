begin;

-- BL-005: limitação e bloqueio progressivo de tentativas de login.
-- Guarda só HMAC do e-mail normalizado e do IP (nunca o valor em claro); expurgo diário pelo cron.

create table if not exists app.auth_attempts (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('email','ip')),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_attempts_lookup_idx on app.auth_attempts (scope, key_hash, created_at desc);
create index if not exists auth_attempts_created_idx on app.auth_attempts (created_at);

grant select, insert, delete on app.auth_attempts to lar_app;
grant usage, select on all sequences in schema app to lar_app;

commit;
