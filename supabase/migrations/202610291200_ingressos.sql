-- Eventos — Ingressos: tickets de refeição dos eventos beneficentes (PRD v1.3, docs/ingressos/DECISOES.md).
-- Venda em 3 toques por Coordenação, Equipe e trabalhadores (acesso temporário por link + PIN),
-- baixa manual (Pix ou Dinheiro), entrega atômica, caixa, metas e acerto do dinheiro em mãos.
-- Valores sempre em centavos (inteiro). "Hoje" = America/Manaus.

begin;

-- Organizador: normalmente a própria Casa. Logo guardada já reduzida (≤ 1024 px) para a página pública e a arte.
create table if not exists app.ticket_organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  logo bytea check (logo is null or octet_length(logo) <= 1500000),
  logo_mime text check (logo_mime is null or logo_mime in ('image/png','image/jpeg')),
  logo_updated_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);

create table if not exists app.ticket_events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references app.ticket_organizers(id),
  kind text not null check (kind in ('feijoada','cafe_da_manha','almoco','outro')),
  name text not null check (char_length(name) between 2 and 60),
  purpose text not null check (char_length(purpose) between 3 and 140),
  event_date date not null,
  event_time text not null default '' check (event_time = '' or event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  place text not null default '' check (char_length(place) <= 80),
  price_cents integer not null check (price_cents > 0 and price_cents <= 10000000),
  pix_key_type text not null check (pix_key_type in ('cnpj','cpf','email','telefone','aleatoria')),
  pix_key text not null check (char_length(pix_key) between 1 and 77),
  pix_receiver text not null check (char_length(pix_receiver) between 1 and 25),
  pix_city text not null default 'MANAUS' check (char_length(pix_city) between 1 and 15),
  reservations_whatsapp text check (reservations_whatsapp is null or reservations_whatsapp ~ '^55[0-9]{10,11}$'),
  goal_tickets integer check (goal_tickets is null or goal_tickets between 1 and 100000),
  status text not null default 'draft' check (status in ('draft','active','closed')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
-- RN-11: um único evento ativo.
create unique index if not exists ticket_events_one_active on app.ticket_events ((true)) where status = 'active';

-- Vendedor: trabalhador da Casa (ficha em app.workers) ou usuário do sistema. Reaproveitado entre eventos.
create table if not exists app.ticket_sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  whatsapp text check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  worker_id uuid references app.workers(id),
  user_id uuid references app.users(id),
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id)
);
create unique index if not exists ticket_sellers_worker on app.ticket_sellers (worker_id) where worker_id is not null;
create unique index if not exists ticket_sellers_user on app.ticket_sellers (user_id) where user_id is not null;

create table if not exists app.ticket_goals (
  event_id uuid not null references app.ticket_events(id),
  seller_id uuid not null references app.ticket_sellers(id),
  goal smallint not null check (goal between 1 and 999),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  primary key (event_id, seller_id)
);

-- Acesso temporário do trabalhador (RF-12). Token do link e PIN guardados só como hash.
create table if not exists app.ticket_access (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references app.ticket_events(id),
  seller_id uuid not null references app.ticket_sellers(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  pin_hash text,
  device_hash text check (device_hash is null or device_hash ~ '^[a-f0-9]{64}$'),
  valid_until date not null,
  sent_at timestamptz not null default now(),
  first_access_at timestamptz,
  last_access_at timestamptz,
  pin_failures smallint not null default 0,
  locked_until timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references app.users(id),
  revoke_reason text check (revoke_reason is null or revoke_reason in ('bloqueado','reenviado','removido')),
  expired_logged_at timestamptz,
  created_by uuid not null references app.users(id)
);
create unique index if not exists ticket_access_current on app.ticket_access (event_id, seller_id) where revoked_at is null;

-- Sessão de 12 h aberta pelo PIN. Bloqueio/expiração do acesso derruba a sessão na checagem de cada requisição.
create table if not exists app.ticket_seller_sessions (
  id uuid primary key default gen_random_uuid(),
  access_id uuid not null references app.ticket_access(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists ticket_seller_sessions_access on app.ticket_seller_sessions (access_id);

-- Comprador: cadastro único da Casa, identificado pelo WhatsApp (RF-17). Sem WhatsApp = registro só com nome.
create table if not exists app.ticket_buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  whatsapp text unique check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  created_at timestamptz not null default now(),
  created_by_user uuid references app.users(id),
  created_by_seller uuid references app.ticket_sellers(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
create index if not exists ticket_buyers_name on app.ticket_buyers (lower(name));

create table if not exists app.ticket_sales (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references app.ticket_events(id),
  buyer_id uuid not null references app.ticket_buyers(id),
  seller_id uuid not null references app.ticket_sellers(id),
  quantity smallint not null check (quantity between 1 and 20),
  unit_price_cents integer not null check (unit_price_cents > 0),
  total_cents integer not null check (total_cents = quantity * unit_price_cents),
  due_date date,
  registered_by_user uuid references app.users(id),
  registered_by_seller uuid references app.ticket_sellers(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by_user uuid references app.users(id),
  cancelled_by_seller uuid references app.ticket_sellers(id),
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) between 3 and 200),
  undone boolean not null default false,
  check (registered_by_user is not null or registered_by_seller is not null),
  check (cancelled_at is null or cancel_reason is not null)
);
create index if not exists ticket_sales_event on app.ticket_sales (event_id, cancelled_at);
create index if not exists ticket_sales_seller on app.ticket_sales (seller_id, created_at desc);
create index if not exists ticket_sales_buyer on app.ticket_sales (buyer_id);

-- Links públicos dos ingressos (RF-16). Cada reenvio gera um link novo; os anteriores continuam valendo.
create table if not exists app.ticket_sale_links (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references app.ticket_sales(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists ticket_sale_links_sale on app.ticket_sale_links (sale_id);

create table if not exists app.ticket_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references app.ticket_sales(id),
  amount_cents integer not null check (amount_cents > 0),
  method text not null check (method in ('pix','dinheiro')),
  received_at timestamptz not null default now(),
  registered_by_user uuid references app.users(id),
  registered_by_seller uuid references app.ticket_sellers(id),
  custody_seller_id uuid references app.ticket_sellers(id),
  reversed_at timestamptz,
  reversed_by uuid references app.users(id),
  reverse_reason text check (reverse_reason is null or char_length(reverse_reason) between 3 and 200),
  check (registered_by_user is not null or registered_by_seller is not null),
  check (custody_seller_id is null or method = 'dinheiro')
);
create index if not exists ticket_payments_sale on app.ticket_payments (sale_id);
create index if not exists ticket_payments_custody on app.ticket_payments (custody_seller_id) where custody_seller_id is not null;

-- Acerto do dinheiro em mãos do trabalhador com a coordenação (RF-13).
create table if not exists app.ticket_settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references app.ticket_events(id),
  seller_id uuid not null references app.ticket_sellers(id),
  amount_cents integer not null check (amount_cents > 0),
  received_by uuid not null references app.users(id),
  received_at timestamptz not null default now(),
  note text not null default '' check (char_length(note) <= 200)
);
create index if not exists ticket_settlements_seller on app.ticket_settlements (event_id, seller_id);

create table if not exists app.ticket_tickets (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references app.ticket_sales(id),
  event_id uuid not null references app.ticket_events(id),
  number smallint not null check (number between 1 and 20),
  code text not null check (code ~ '^[ACDEFGHJKMNPQRTUVWXY34679]{4}$'),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{22,64}$'),
  delivered_at timestamptz,
  delivered_by uuid references app.users(id),
  unique (event_id, code),
  unique (sale_id, number)
);
create index if not exists ticket_tickets_event on app.ticket_tickets (event_id, delivered_at);

-- Limite por IP de links inválidos na página pública e de aberturas do link de acesso.
create table if not exists app.ticket_rate_hits (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('link','acesso','pin')),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists ticket_rate_hits_lookup on app.ticket_rate_hits (scope, key_hash, created_at desc);

grant select, insert, update on app.ticket_organizers, app.ticket_events, app.ticket_sellers, app.ticket_access,
  app.ticket_seller_sessions, app.ticket_buyers, app.ticket_sales, app.ticket_payments, app.ticket_tickets to lar_app;
grant select, insert, update, delete on app.ticket_goals to lar_app;
grant delete on app.ticket_events to lar_app;
grant select, insert on app.ticket_sale_links, app.ticket_settlements to lar_app;
grant select, insert, delete on app.ticket_rate_hits to lar_app;
grant usage, select on all sequences in schema app to lar_app;

commit;
