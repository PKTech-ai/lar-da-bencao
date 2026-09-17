-- Onda 3 — Conselho Fiscal (análise do mês enviado) e Jurídico (eleições e documentos).

begin;

create table if not exists app.fiscal_reviews (
  id uuid primary key default gen_random_uuid(),
  reference_month text not null,
  status text not null,
  review_date date not null,
  reviewers text not null default '' check (char_length(reviewers) <= 300),
  analysis text not null default '' check (char_length(analysis) <= 8000),
  opinion text not null default '' check (char_length(opinion) <= 8000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.fiscal_reviews to lar_app;

create table if not exists app.elections (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (char_length(title) <= 200),
  year integer not null,
  stage text not null,
  notice_date date,
  registration_end date,
  vote_date date,
  term_start date,
  biennium_label text not null default '' check (char_length(biennium_label) <= 80),
  notes text not null default '' check (char_length(notes) <= 4000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.elections to lar_app;

alter table app.fiscal_reviews add constraint fiscal_reviews_status_check check (status in ('Em análise','Aprovado','Aprovado com ressalvas','Reprovado'));
create unique index if not exists fiscal_reviews_month on app.fiscal_reviews (reference_month);
alter table app.elections add constraint elections_stage_check check (stage in ('Edital','Inscrições','Homologação','Votação','Apuração','Posse','Encerrada'));

commit;

-- Fila de mensagens de WhatsApp: envio manual, sempre com consentimento registrado.
begin;
create table if not exists app.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('tesouraria','doutrina')),
  recipient_name text not null check (char_length(recipient_name) between 2 and 160),
  phone text not null check (phone ~ '^55[0-9]{10,11}$'),
  body text not null check (char_length(body) between 5 and 1000),
  consent_source text not null check (char_length(consent_source) between 3 and 200),
  status text not null default 'Na fila' check (status in ('Na fila','Enviada','Cancelada')),
  cancel_reason text not null default '' check (char_length(cancel_reason) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  sent_at timestamptz,
  sent_by uuid references app.users(id),
  version integer not null default 1
);
create index if not exists whatsapp_messages_scope on app.whatsapp_messages (scope, created_at desc);
grant select, insert, update on app.whatsapp_messages to lar_app;
commit;
