-- Quem é da coordenação e teve algum item desmarcado continua aparecendo como coordenação no Organograma,
-- no painel do departamento e na escala impressa (decidido com a Presidência em 10/11/2026).
-- Só afeta essas listas: o que a pessoa abre ou altera continua vindo das marcas por módulo.

begin;

alter table app.user_departments add column if not exists keeps_coordination boolean not null default false;

-- Quem já teve item desmarcado desde que as caixinhas entraram no ar (09/11/2026).
update app.user_departments ud
   set keeps_coordination = true
  from app.users u
 where u.id = ud.user_id
   and u.role_key in ('coordenador', 'subcoordenador')
   and ud.access_level = 'consulta'
   and exists (
     select 1 from app.user_module_access m
      where m.user_id = ud.user_id and m.department_key = ud.department_key and m.can_edit
   );

commit;
