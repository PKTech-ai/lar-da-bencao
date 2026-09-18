-- Paridade com o mock v215 no fechamento do caixa e no parecer do Conselho Fiscal:
--  • fechar o mês já libera o relatório ao Conselho Fiscal (não há passo separado de envio);
--  • reabrir é possível enquanto o Conselho não decidiu, e tira o relatório da análise;
--  • a decisão do Conselho é Deferido ou Indeferido, e pode ser arquivada (trava alterações).

begin;

alter table app.treasury_months drop constraint if exists treasury_months_status_check;
update app.treasury_months set status = 'Fechado' where status = 'Enviado ao Conselho Fiscal';
alter table app.treasury_months add constraint treasury_months_status_check check (status in ('Aberto', 'Fechado'));
alter table app.treasury_months rename column sent_by to released_by;
alter table app.treasury_months rename column sent_at to released_at;
alter table app.treasury_months add column if not exists reopened_at timestamptz;
alter table app.treasury_months add column if not exists reopen_reason text not null default '' check (char_length(reopen_reason) <= 500);
update app.treasury_months set released_at = coalesce(released_at, closed_at), released_by = coalesce(released_by, closed_by) where status = 'Fechado';

alter table app.fiscal_reviews drop constraint if exists fiscal_reviews_status_check;
update app.fiscal_reviews set status = case status when 'Aprovado' then 'Deferido' when 'Aprovado com ressalvas' then 'Deferido' when 'Reprovado' then 'Indeferido' else 'Em análise' end;
alter table app.fiscal_reviews add constraint fiscal_reviews_status_check check (status in ('Em análise', 'Deferido', 'Indeferido'));
alter table app.fiscal_reviews add column if not exists locked_at timestamptz;
alter table app.fiscal_reviews add column if not exists locked_by uuid references app.users(id);

commit;

-- Um parecer vigente por competência: o parecer retirado da pauta vai para o histórico
-- e não impede um novo quando a Tesouraria fecha o caixa de novo.
begin;
drop index if exists app.fiscal_reviews_month;
create unique index if not exists fiscal_reviews_month on app.fiscal_reviews (reference_month) where archived_at is null;
commit;
