-- Dia sem escala na Doutrina passa a ter um tipo, escolhido na tela da escala:
-- recesso (a casa não abre) ou um evento da casa que toma o lugar das atividades do dia
-- (encerramento da evangelização, confraternização dos trabalhadores com café da manhã).
-- Em todos, ninguém é escalado; a folha mostra o nome do dia. Os recessos já marcados continuam recesso.
-- As chaves e os nomes vivem em lib/doutrina-scale.ts (RECESS_KINDS).

begin;

alter table app.scale_recess add column if not exists kind text not null default 'recesso';

alter table app.scale_recess drop constraint if exists scale_recess_kind_check;
alter table app.scale_recess add constraint scale_recess_kind_check
  check (kind in ('recesso', 'encerramento_evangelizacao', 'confraternizacao'));

commit;
