-- Acesso por módulo (decidido com a Presidência em 09/11/2026).
-- Cada linha é um módulo marcado para a pessoa no departamento: existe = Consultar; can_edit = também Alterar.
-- Quem não tem linha neste departamento segue o nível que já estava em app.user_departments, que continua
-- sendo o resumo lido pelo restante do sistema. Nada é convertido nem apagado aqui.

begin;

create table if not exists app.user_module_access (
  user_id uuid not null references app.users(id) on delete cascade,
  department_key text not null references app.departments(key),
  module_key text not null,
  can_edit boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id) on delete set null,
  primary key (user_id, department_key, module_key)
);

create index if not exists user_module_access_user_department_idx on app.user_module_access (user_id, department_key);

grant select, insert, update, delete on app.user_module_access to lar_app;

commit;
