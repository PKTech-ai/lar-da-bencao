-- Culto no Lar dos Trabalhadores: programação do ano, um por mês no penúltimo sábado, com o nome do trabalhador
-- digitado na tela (até 120 caracteres, sem caractere de controle — lib/doutrina-extras.ts → cultoHostName).
-- O último sábado do mês é da Caravana do Amor (Assistência Social): o culto nunca pode cair nele.
-- Caravana do Amor: aba nova (só consulta) em Assistência Social › Famílias e entregas. Quem já tem alguma aba
-- desse grupo marcada em Usuários › Acesso passa a ver também a Caravana do Amor (só ver; não há o que alterar).

begin;

alter table app.culto_lar_months add column if not exists host_name text not null default '';

alter table app.culto_lar_months drop constraint if exists culto_lar_months_host_name_check;
alter table app.culto_lar_months add constraint culto_lar_months_host_name_check
  check (char_length(host_name) <= 120 and host_name !~ '[[:cntrl:]]');

-- Uma semana depois do culto ainda é o mesmo mês: o culto nunca é no último sábado (o da Caravana do Amor).
alter table app.culto_lar_months drop constraint if exists culto_lar_months_not_last_saturday;
alter table app.culto_lar_months add constraint culto_lar_months_not_last_saturday
  check (extract(month from culto_date + 7) = month);

insert into app.user_module_access (user_id, department_key, module_key, can_edit)
select distinct m.user_id, 'assistencia_social', 'caravana', false
  from app.user_module_access m
 where m.department_key = 'assistencia_social' and m.module_key in ('familias', 'rancho', 'kits', 'atividades')
on conflict (user_id, department_key, module_key) do nothing;

commit;
