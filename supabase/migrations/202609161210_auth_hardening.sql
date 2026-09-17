begin;

create table if not exists app.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mfa_recovery_user_idx on app.mfa_recovery_codes (user_id) where used_at is null;

create table if not exists app.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  unique (user_id, terms_version)
);

grant select, insert, update on app.mfa_recovery_codes, app.terms_acceptances to lar_app;

commit;
