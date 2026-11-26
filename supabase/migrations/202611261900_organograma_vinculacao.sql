-- Organograma de Vinculação (Organograma › aba nova): o Administrador vincula as pessoas aos cargos da estrutura e o
-- vínculo já dá acesso total (consultar, alterar e excluir) no setor do cargo:
--   Presidente      → todos os departamentos e a Diretoria (o Conselho Fiscal não: ele fiscaliza a Diretoria);
--   Vice-Presidente → Diretoria;  Secretário(a) → Secretaria;  Tesoureiro(a) → Tesouraria;
--   Conselho Fiscal → Conselho Fiscal;  Coordenação → o próprio departamento.
-- `granted` guarda os departamentos que o vínculo liberou quando foi feito: ao desvincular, sai só esse acesso
-- (e só onde nenhum outro vínculo da mesma pessoa ainda dá acesso). O perfil da pessoa não muda.
-- O acesso em si continua em app.user_module_access / app.user_departments, como em Usuários › Acesso.

begin;

create table if not exists app.org_links (
  id uuid primary key default gen_random_uuid(),
  seat text not null check (seat in ('presidente', 'vice_presidente', 'secretario', 'tesoureiro', 'conselho_fiscal', 'coordenacao')),
  department_key text references app.departments(key),
  user_id uuid not null references app.users(id) on delete cascade,
  granted text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id) on delete set null,
  check ((seat = 'coordenacao') = (department_key is not null))
);

-- Cada cargo da Diretoria tem uma pessoa só; no Conselho Fiscal e na Coordenação cabem várias, sem repetir a mesma.
create unique index if not exists org_links_board_seat on app.org_links (seat)
  where seat in ('presidente', 'vice_presidente', 'secretario', 'tesoureiro');
create unique index if not exists org_links_person on app.org_links (seat, coalesce(department_key, ''), user_id);
create index if not exists org_links_user_idx on app.org_links (user_id);

grant select, insert, delete on app.org_links to lar_app;

commit;
