-- Onda 3 — Tesouraria: plano de contas do mock, caixa mensal com fechamento, contribuições,
-- mantenedores e doações, extrato bancário e conciliação.

begin;

create table if not exists app.financial_accounts (
  code text primary key check (code ~ '^[0-9]+(\.[0-9]{2}){0,2}$'),
  name text not null check (char_length(name) between 2 and 120),
  nature text not null check (nature in ('Receita','Despesa','Transferência')),
  account_group text not null check (char_length(account_group) <= 60),
  is_parent boolean not null default false,
  active boolean not null default true
);
insert into app.financial_accounts (code, name, nature, account_group, is_parent) values
  ('1', 'RECEITAS', 'Receita', 'Receitas', true),
  ('1.01', 'Contribuições', 'Receita', 'Contribuições', true),
  ('1.01.01', 'Contribuição Mensal', 'Receita', 'Contribuições', false),
  ('1.01.02', 'Contribuição Eventual', 'Receita', 'Contribuições', false),
  ('1.02', 'Lanchonete', 'Receita', 'Lanchonete', true),
  ('1.02.01', 'Venda da Lanchonete', 'Receita', 'Lanchonete', false),
  ('1.03', 'Brechó', 'Receita', 'Brechó', true),
  ('1.03.01', 'Venda do Brechó', 'Receita', 'Brechó', false),
  ('1.04', 'Doações', 'Receita', 'Doações', true),
  ('1.04.01', 'Doação em Dinheiro', 'Receita', 'Doações', false),
  ('1.04.02', 'Doação via PIX', 'Receita', 'Doações', false),
  ('1.05', 'Eventos e Campanhas', 'Receita', 'Eventos e Campanhas', true),
  ('1.05.01', 'Receita de Eventos', 'Receita', 'Eventos e Campanhas', false),
  ('1.05.02', 'Campanhas / Arrecadações', 'Receita', 'Eventos e Campanhas', false),
  ('1.06', 'Outras Receitas', 'Receita', 'Outras Receitas', true),
  ('1.06.01', 'Outras Receitas', 'Receita', 'Outras Receitas', false),
  ('2', 'DESPESAS', 'Despesa', 'Despesas', true),
  ('2.01', 'Despesas Administrativas', 'Despesa', 'Administrativo', true),
  ('2.01.01', 'Material de Escritório', 'Despesa', 'Administrativo', false),
  ('2.01.02', 'Impressões e Papelaria', 'Despesa', 'Administrativo', false),
  ('2.01.03', 'Correios / Cartório / Taxas', 'Despesa', 'Administrativo', false),
  ('2.02', 'Água, Energia e Comunicação', 'Despesa', 'Utilidades', true),
  ('2.02.01', 'Energia Elétrica', 'Despesa', 'Utilidades', false),
  ('2.02.02', 'Água', 'Despesa', 'Utilidades', false),
  ('2.02.03', 'Internet / Telefonia', 'Despesa', 'Utilidades', false),
  ('2.03', 'Manutenção e Patrimônio', 'Despesa', 'Patrimônio', true),
  ('2.03.01', 'Manutenção Predial', 'Despesa', 'Patrimônio', false),
  ('2.03.02', 'Material de Limpeza', 'Despesa', 'Patrimônio', false),
  ('2.03.03', 'Reparos e Conservação', 'Despesa', 'Patrimônio', false),
  ('2.03.04', 'Aquisição de Bens / Equipamentos', 'Despesa', 'Patrimônio', false),
  ('2.04.01', 'Departamento de Doutrina', 'Despesa', 'Doutrina', false),
  ('2.05.01', 'Departamento da Infância', 'Despesa', 'Infância', false),
  ('2.06.01', 'Departamento da Juventude', 'Despesa', 'Juventude', false),
  ('2.07', 'Assistência e Promoção Social', 'Despesa', 'Assistência Social', true),
  ('2.07.01', 'Rancho / Cestas', 'Despesa', 'Assistência Social', false),
  ('2.07.02', 'Auxílios Emergenciais', 'Despesa', 'Assistência Social', false),
  ('2.07.03', 'Projetos Sociais', 'Despesa', 'Assistência Social', false),
  ('2.08.01', 'Eventos', 'Despesa', 'Eventos', false),
  ('2.09.01', 'Divulgação', 'Despesa', 'Divulgação', false),
  ('2.10', 'Lanchonete', 'Despesa', 'Lanchonete', true),
  ('2.10.01', 'Compra de Alimentos', 'Despesa', 'Lanchonete', false),
  ('2.10.02', 'Bebidas e Insumos', 'Despesa', 'Lanchonete', false),
  ('2.10.03', 'Embalagens / Descartáveis', 'Despesa', 'Lanchonete', false),
  ('2.11', 'Brechó', 'Despesa', 'Brechó', true),
  ('2.11.01', 'Materiais e Organização do Brechó', 'Despesa', 'Brechó', false),
  ('2.12', 'Despesas Bancárias', 'Despesa', 'Financeiro', true),
  ('2.12.01', 'Tarifas Bancárias', 'Despesa', 'Financeiro', false),
  ('2.12.02', 'Tarifas de Maquininha / PIX', 'Despesa', 'Financeiro', false),
  ('2.13.01', 'Outras Despesas', 'Despesa', 'Outras Despesas', false),
  ('3', 'MOVIMENTAÇÕES FINANCEIRAS', 'Transferência', 'Movimentações', true),
  ('3.01.01', 'Transferência entre Caixa e Banco', 'Transferência', 'Movimentações', false),
  ('3.02.01', 'Transferência entre Contas Bancárias', 'Transferência', 'Movimentações', false),
  ('3.03.01', 'Aplicação Financeira', 'Transferência', 'Movimentações', false),
  ('3.04.01', 'Resgate de Aplicação', 'Transferência', 'Movimentações', false)
on conflict (code) do update set name = excluded.name, nature = excluded.nature, account_group = excluded.account_group, is_parent = excluded.is_parent;

-- Mês do caixa: fechamento e envio ao Conselho Fiscal.
create table if not exists app.treasury_months (
  reference_month text primary key check (reference_month ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$'),
  status text not null default 'Aberto' check (status in ('Aberto','Fechado','Enviado ao Conselho Fiscal')),
  opening_cents bigint not null default 0,
  closing_cents bigint not null default 0,
  income_cents bigint not null default 0,
  expense_cents bigint not null default 0,
  notes text not null default '' check (char_length(notes) <= 2000),
  closed_by uuid references app.users(id),
  closed_at timestamptz,
  sent_by uuid references app.users(id),
  sent_at timestamptz,
  version integer not null default 1
);

create table if not exists app.treasury_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  account_code text not null default '' check (char_length(account_code) <= 12),
  description text not null default '' check (char_length(description) <= 250),
  amount_cents bigint not null,
  cost_center text not null,
  payment_method text not null,
  fund_source text not null,
  reference text not null default '' check (char_length(reference) <= 120),
  notes text not null default '' check (char_length(notes) <= 1000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.treasury_entries to lar_app;

create table if not exists app.treasury_contributions (
  id uuid primary key default gen_random_uuid(),
  contributor text not null default '' check (char_length(contributor) <= 160),
  worker_id uuid references app.workers(id),
  kind text not null,
  reference_month text not null,
  received_at date not null,
  amount_cents bigint not null,
  payment_method text not null,
  reference text not null default '' check (char_length(reference) <= 120),
  notes text not null default '' check (char_length(notes) <= 1000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.treasury_contributions to lar_app;

create table if not exists app.treasury_supporters (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 160),
  status text not null,
  frequency text not null,
  value_cents bigint,
  phone text,
  birth_date date,
  start_date date not null,
  preferred_day integer,
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
grant select, insert, update on app.treasury_supporters to lar_app;

create table if not exists app.treasury_donations (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid references app.treasury_supporters(id) not null,
  received_at date not null,
  amount_cents bigint not null,
  payment_method text not null,
  destination text not null default '' check (char_length(destination) <= 200),
  reference text not null default '' check (char_length(reference) <= 120),
  notes text not null default '' check (char_length(notes) <= 1000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.treasury_donations to lar_app;

alter table app.treasury_entries add constraint treasury_entries_account_fk foreign key (account_code) references app.financial_accounts(code);
alter table app.treasury_entries add constraint treasury_entries_amount_check check (amount_cents > 0);
create index if not exists treasury_entries_month on app.treasury_entries (entry_date);
create index if not exists treasury_contributions_month on app.treasury_contributions (reference_month);
alter table app.treasury_contributions add constraint treasury_contributions_amount_check check (amount_cents > 0);
alter table app.treasury_donations add constraint treasury_donations_amount_check check (amount_cents > 0);
alter table app.treasury_supporters add constraint treasury_supporters_status_check check (status in ('Colaborando','Pausado','Encerrado'));

-- Extrato bancário importado (OFX/CSV) e conciliação com os lançamentos.
create table if not exists app.bank_statements (
  id uuid primary key default gen_random_uuid(),
  reference_month text not null check (reference_month ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$'),
  filename text not null check (char_length(filename) <= 240),
  format text not null check (format in ('OFX','CSV')),
  attachment_id uuid references app.attachments(id),
  line_count integer not null default 0,
  imported_at timestamptz not null default now(),
  imported_by uuid references app.users(id)
);
create table if not exists app.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references app.bank_statements(id),
  line_date date not null,
  description text not null default '' check (char_length(description) <= 300),
  amount_cents bigint not null,
  document text not null default '' check (char_length(document) <= 120),
  fingerprint text not null,
  status text not null default 'pending' check (status in ('pending','matched','ignored')),
  entry_id uuid references app.treasury_entries(id),
  decided_by uuid references app.users(id),
  decided_at timestamptz,
  reason text not null default '' check (char_length(reason) <= 500)
);
create unique index if not exists bank_statement_lines_fingerprint on app.bank_statement_lines (fingerprint);
create index if not exists bank_statement_lines_statement on app.bank_statement_lines (statement_id);
create unique index if not exists bank_statement_lines_entry on app.bank_statement_lines (entry_id) where entry_id is not null;

grant select, insert, update on app.financial_accounts, app.treasury_months, app.bank_statements, app.bank_statement_lines to lar_app;

commit;
