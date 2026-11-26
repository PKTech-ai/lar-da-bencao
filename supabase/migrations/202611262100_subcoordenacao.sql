-- Organograma de Vinculação: cada departamento tem Coordenador(a) e Subcoordenador(a) (pedido do Marcel em 26/11/2026).
-- O Subcoordenador(a) também ganha acesso total no próprio departamento ao ser vinculado (lib/org-links.ts → seatLevel)
-- e cabe um por departamento. Secretaria e Tesouraria saem do quadro de departamentos porque fazem parte da Diretoria
-- (Secretário(a) e Tesoureiro(a)); isso é só na tela e na API (ORG_DEPARTMENTS), e não havia coordenação vinculada nelas.

begin;

-- Troca as duas regras de conferência da tabela (cargo válido; departamento só na Coordenação/Subcoordenação),
-- seja qual for o nome que ganharam quando a tabela foi criada.
do $$
declare
  c record;
begin
  for c in select conname from pg_constraint where conrelid = 'app.org_links'::regclass and contype = 'c' loop
    execute format('alter table app.org_links drop constraint %I', c.conname);
  end loop;
end $$;

alter table app.org_links add constraint org_links_seat_check
  check (seat in ('presidente', 'vice_presidente', 'secretario', 'tesoureiro', 'conselho_fiscal', 'coordenacao', 'subcoordenacao'));
alter table app.org_links add constraint org_links_department_check
  check ((seat in ('coordenacao', 'subcoordenacao')) = (department_key is not null));

-- Uma Subcoordenação por departamento.
create unique index if not exists org_links_subcoordenacao on app.org_links (department_key) where seat = 'subcoordenacao';

commit;
