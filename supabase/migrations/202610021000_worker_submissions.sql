begin;

-- Cadastro online de trabalhadores: o formulário público (sem login) só grava nesta fila.
-- Nada chega a app.workers antes de o Administrador revisar cada envio (vincular a uma ficha,
-- criar ficha nova ou descartar). Do IP guarda-se só o HMAC, como em app.auth_attempts.

create table if not exists app.worker_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'received' check (status in ('received','applied','discarded')),
  matched_worker_id uuid references app.workers(id) on delete set null,
  reviewed_by uuid references app.users(id),
  reviewed_at timestamptz,
  review_note text not null default '' check (char_length(review_note) <= 500),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  privacy_version text not null check (char_length(privacy_version) between 1 and 40),
  check (status = 'received' or (reviewed_by is not null and reviewed_at is not null))
);

create index if not exists worker_submissions_status_idx on app.worker_submissions (status, created_at desc);
create index if not exists worker_submissions_ip_idx on app.worker_submissions (ip_hash, created_at desc);

-- delete: expurgo dos envios já tratados pelo job de manutenção.
grant select, insert, update, delete on app.worker_submissions to lar_app;

-- Nasce desligada: o formulário só abre quando o Administrador liberar em Módulos e ondas.
insert into app.feature_flags (key, enabled, description, wave) values
  ('public_worker_form', false, 'Cadastro online de trabalhadores (formulário público)', '1')
on conflict (key) do update set wave = excluded.wave, description = excluded.description;

commit;
