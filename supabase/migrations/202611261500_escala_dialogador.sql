-- Linha DIALOGADOR na Mediúnica — Funcionamento Interno (segunda-feira).
-- O modelo da escala vive no código (lib/doutrina-scale.ts): a linha nova entrou no fim (chave `1|0|3|dia|posição`),
-- para não mudar a chave das posições já gravadas, e a folha a mostra logo abaixo do PASSISTA.
-- Escalas já geradas deste mês em diante ganham a posição vazia em cada segunda-feira, para a Doutrina escolher
-- o dialogador sem precisar gerar a escala de novo (o que apagaria as trocas feitas à mão). Meses passados ficam como estão.
-- A segunda-feira é reconhecida pela posição do DIRIG. (`1|0|0|dia|0`), que toda escala gerada tem, inclusive em recesso.

begin;

insert into app.scale_assignments (scale_month_id, slot_key, slot_value, work_date, role_label, edited, is_extra)
select a.scale_month_id, '1|0|3|' || extract(day from a.work_date)::int || '|0', '', a.work_date,
       'MEDIÚNICA — FUNCIONAMENTO INTERNO → DIALOGADOR', false, false
  from app.scale_assignments a
  join app.scale_months m on m.id = a.scale_month_id
 where m.department_key = 'doutrina' and m.status <> 'deleted'
   and make_date(m.year, m.month, 1) >= date_trunc('month', current_date)::date
   and a.slot_key ~ '^1\|0\|0\|[0-9]+\|0$'
on conflict (scale_month_id, slot_key) do nothing;

commit;
