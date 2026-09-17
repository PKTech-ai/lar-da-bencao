-- Ondas 2 e 3: flags dos módulos (desligadas até o UAT), setores do Brechó/Clube de Mães
-- e o módulo de Patrimônio (bens, autorização de baixa pela Diretoria e escala de limpeza).

begin;

insert into app.feature_flags (key, enabled, description, wave) values
  ('module_patrimonio', false, 'Patrimônio: bens, baixas e escala de limpeza', '2'),
  ('module_assistencia', false, 'Assistência e Promoção Social', '2'),
  ('module_eventos', false, 'Eventos: agenda, itens, escala e avaliação', '2'),
  ('module_divulgacao', false, 'Divulgação: livraria', '2'),
  ('module_secretaria', false, 'Secretaria: reuniões, atas e admissões', '2'),
  ('module_presidencia', false, 'Presidência: painel da Diretoria e decisões', '2'),
  ('module_tesouraria', false, 'Tesouraria: contribuições, caixa e conciliação', '3'),
  ('module_conselho_fiscal', false, 'Conselho Fiscal: análise e parecer', '3'),
  ('module_juridico', false, 'Jurídico: eleições e modelos', '3'),
  ('module_whatsapp', false, 'Fila segura de mensagens por WhatsApp (com consentimento)', '3')
on conflict (key) do update set wave = excluded.wave, description = excluded.description;

-- Brechó e Clube de Mães: o perfil do setor lança no próprio livro caixa;
-- quem tem acesso completo à Assistência também.
insert into app.role_permissions (role_key, resource, action, department_scoped) values
  ('brecho', 'social_brecho', 'read', false),
  ('brecho', 'social_brecho', 'create', false),
  ('brecho', 'social_brecho', 'update', false),
  ('clube_maes', 'social_clube_maes', 'read', false),
  ('clube_maes', 'social_clube_maes', 'create', false),
  ('clube_maes', 'social_clube_maes', 'update', false)
on conflict do nothing;

create or replace function app.has_permission(
  p_user_id uuid,
  p_resource text,
  p_action text,
  p_department text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, extensions, public, pg_temp
as $$
declare
  v_page text := app.page_for_resource(p_resource, p_department);
  v_level text;
begin
  if v_page is not null then
    v_level := app.page_level(p_user_id, v_page);
    return v_level = 'full' or (v_level = 'read' and p_action in ('read','print','export','download'));
  end if;
  if p_resource in ('social_brecho', 'social_clube_maes') then
    v_level := app.page_level(p_user_id, 'assistencia');
    if v_level = 'full' or (v_level = 'read' and p_action in ('read','print','export','download')) then
      return true;
    end if;
  end if;
  if not app.user_access_allowed(p_user_id) then return false; end if;
  return exists (
    select 1
      from app.users u
      join app.role_permissions rp on rp.role_key = u.role_key
     where u.id = p_user_id
       and rp.resource in ('*', p_resource)
       and rp.action in ('*', p_action)
       and (
         not rp.department_scoped
         or (p_department is not null and exists (
           select 1 from app.user_departments ud where ud.user_id = u.id and ud.department_key = p_department
         ))
       )
  );
end;
$$;

-- Bens patrimoniais (cadastro do motor genérico: lib/resources/defs/patrimonio.ts).
create table if not exists app.patrimony_assets (
  id uuid primary key default gen_random_uuid(),
  tombamento text not null default '' check (char_length(tombamento) <= 60),
  condition text not null check (condition in ('Novo', 'Usado')),
  description text not null default '' check (char_length(description) <= 500),
  department_key text references app.departments(key) not null,
  entry_date date not null,
  disposal_date date,
  value_cents bigint not null check (value_cents >= 0),
  location text not null default '' check (char_length(location) <= 200),
  responsible text not null default '' check (char_length(responsible) <= 150),
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  check (disposal_date is null or disposal_date >= entry_date)
);
create unique index if not exists patrimony_assets_tombamento_key
  on app.patrimony_assets (upper(regexp_replace(tombamento, '\s+', '', 'g')));

-- Memorandos de baixa (PAT-BAIXA-AAAA-NNNN). Um pendente por bem.
create table if not exists app.patrimony_disposals (
  id uuid primary key default gen_random_uuid(),
  number text not null unique check (number ~ '^PAT-BAIXA-\d{4}-\d{4,}$'),
  asset_id uuid not null references app.patrimony_assets(id),
  asset_snapshot jsonb not null,
  request_date date not null,
  reason text not null check (char_length(reason) between 1 and 2000),
  destination text not null default '' check (char_length(destination) <= 250),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid not null references app.users(id),
  requested_at timestamptz not null default now(),
  decision_date date,
  disposal_date date,
  decision_reference text not null default '' check (char_length(decision_reference) <= 200),
  decision_notes text not null default '' check (char_length(decision_notes) <= 2000),
  decided_by uuid references app.users(id),
  decided_at timestamptz,
  cancel_reason text not null default '' check (char_length(cancel_reason) <= 1000),
  cancelled_by uuid references app.users(id),
  cancelled_at timestamptz,
  version integer not null default 1,
  check (status <> 'approved' or (decision_date is not null and disposal_date is not null and disposal_date >= decision_date)),
  check (status <> 'rejected' or (decision_date is not null and char_length(decision_notes) > 0)),
  check (status <> 'cancelled' or char_length(cancel_reason) > 0),
  check (decision_date is null or decision_date >= request_date)
);
create unique index if not exists patrimony_disposals_one_pending
  on app.patrimony_disposals (asset_id) where status = 'pending';

-- Escala de limpeza: um registro por trabalhador por domingo.
create table if not exists app.cleaning_roster (
  id uuid primary key default gen_random_uuid(),
  clean_date date not null check (extract(isodow from clean_date) = 7),
  worker_id uuid not null references app.workers(id),
  worker_snapshot jsonb not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'fee', 'cancelled')),
  fee_cents integer not null default 0 check (fee_cents in (0, 5000)),
  payment_status text check (payment_status in ('pending', 'paid')),
  payment_date date,
  payment_method text check (payment_method in ('PIX', 'Dinheiro', 'Transferência', 'Cartão')),
  payment_reference text not null default '' check (char_length(payment_reference) <= 150),
  payment_recorded_by uuid references app.users(id),
  payment_recorded_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1500),
  cancel_reason text not null default '' check (char_length(cancel_reason) <= 1000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  check ((status = 'fee') = (fee_cents = 5000)),
  check ((status = 'fee') = (payment_status is not null)),
  check (payment_status is distinct from 'paid' or (payment_date is not null and payment_method is not null)),
  check (status <> 'cancelled' or char_length(cancel_reason) > 0)
);
create unique index if not exists cleaning_roster_worker_day
  on app.cleaning_roster (clean_date, worker_id) where status <> 'cancelled';
create index if not exists cleaning_roster_date on app.cleaning_roster (clean_date);

-- Repetição de trabalhador no mesmo ano mantida conscientemente (Conferir conflitos).
create table if not exists app.cleaning_conflict_decisions (
  year integer not null check (year between 1900 and 2199),
  worker_id uuid not null references app.workers(id),
  roster_ids uuid[] not null,
  decided_by uuid not null references app.users(id),
  decided_at timestamptz not null default now(),
  primary key (year, worker_id)
);

grant select, insert, update on app.patrimony_assets, app.patrimony_disposals, app.cleaning_roster to lar_app;
grant select, insert, update, delete on app.cleaning_conflict_decisions to lar_app;

commit;
