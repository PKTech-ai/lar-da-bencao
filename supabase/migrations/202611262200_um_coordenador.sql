-- Organograma de Vinculação: cada departamento tem UM(A) Coordenador(a) e UM(A) Subcoordenador(a) (Marcel, 26/11/2026).
-- Antes a Coordenação aceitava mais de uma pessoa. Se algum departamento já tiver dois coordenadores vinculados, o
-- índice não é criado e nada muda (a atualização inteira volta atrás); aí é tirar um deles na tela e aplicar de novo.

begin;

create unique index if not exists org_links_department_seat on app.org_links (seat, department_key)
  where seat in ('coordenacao', 'subcoordenacao');
drop index if exists app.org_links_subcoordenacao;

commit;
