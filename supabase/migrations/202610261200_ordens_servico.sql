-- Ordens de Serviço (OS-AAAA-NNNN): qualquer departamento abre o pedido, o Patrimônio executa
-- e registra a posição. Fica sob a flag module_patrimonio (sem flag nova).

begin;

create table if not exists app.service_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique check (number ~ '^OS-\d{4}-\d{4,}$'),
  department_key text not null references app.departments(key),
  asset_id uuid references app.patrimony_assets(id),
  kind text not null check (kind in ('Manutenção', 'Conserto', 'Instalação', 'Limpeza', 'Outro')),
  priority text not null default 'Normal' check (priority in ('Baixa', 'Normal', 'Urgente')),
  title text not null check (char_length(title) between 1 and 150),
  description text not null check (char_length(description) between 1 and 2000),
  location text not null default '' check (char_length(location) <= 200),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'rejected', 'cancelled')),
  requested_by uuid not null references app.users(id),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  version integer not null default 1,
  check ((status in ('done', 'rejected', 'cancelled')) = (closed_at is not null))
);
create index if not exists service_orders_status on app.service_orders (status);
create index if not exists service_orders_department on app.service_orders (department_key);

-- Posição da OS: cada mudança de situação ou observação vira uma linha (só inclusão).
create table if not exists app.service_order_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references app.service_orders(id),
  kind text not null check (kind in ('created', 'status', 'note', 'cancel')),
  status text not null check (status in ('open', 'in_progress', 'done', 'rejected', 'cancelled')),
  note text not null default '' check (char_length(note) <= 2000),
  created_by uuid not null references app.users(id),
  created_at timestamptz not null default now()
);
create index if not exists service_order_updates_order on app.service_order_updates (order_id, created_at);

grant select, insert, update on app.service_orders to lar_app;
grant select, insert on app.service_order_updates to lar_app;

commit;
