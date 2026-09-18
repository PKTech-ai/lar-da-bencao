-- Contribuição como no mock v215: cada trabalhador tem um valor mensal combinado e um dia previsto;
-- a Tesouraria acompanha, mês a mês, o que era esperado e o que entrou.
-- A contribuição recebida entra no caixa do mês como receita (conta 1.01.01), sem lançamento manual.

begin;

alter table app.workers add column if not exists contribution_cents bigint not null default 0 check (contribution_cents >= 0);
alter table app.workers add column if not exists contribution_due_day integer check (contribution_due_day between 1 and 31);

drop table if exists app.treasury_contributions;

create table app.treasury_contributions (
  id uuid primary key default gen_random_uuid(),
  reference_month text not null check (reference_month ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$'),
  worker_id uuid not null references app.workers(id),
  expected_cents bigint not null default 0 check (expected_cents >= 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  paid_date date,
  payment_method text check (payment_method in ('Dinheiro','PIX','Cartão de Débito','Cartão de Crédito','Transferência Bancária','Boleto','Débito em Conta','Não informado')),
  reference text not null default '' check (char_length(reference) <= 120),
  notes text not null default '' check (char_length(notes) <= 1000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  unique (reference_month, worker_id),
  check (paid_cents = 0 or (paid_date is not null and payment_method is not null))
);
create index if not exists treasury_contributions_month on app.treasury_contributions (reference_month);
grant select, insert, update on app.treasury_contributions to lar_app;

commit;
