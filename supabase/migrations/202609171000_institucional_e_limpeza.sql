begin;

-- BL-019: Estatuto e Regimento disponíveis a todos os trabalhadores ativos (paridade com o mock).
insert into app.role_permissions (role_key, resource, action, department_scoped) values
  ('trabalhador', 'institucional', 'read', false),
  ('evangelizador', 'institucional', 'read', false),
  ('brecho', 'institucional', 'read', false),
  ('clube_maes', 'institucional', 'read', false),
  ('auditor', 'institucional', 'read', false)
on conflict do nothing;

alter table app.institutional_documents
  add column if not exists description text not null default '' check (char_length(description) <= 1000),
  add column if not exists sort_order integer not null default 0,
  add column if not exists version integer not null default 1,
  add column if not exists updated_by uuid references app.users(id);

insert into app.institutional_documents (slug, title, description, sort_order, published) values
  ('estatuto', 'Estatuto do Centro Espírita Filantrópico Lar da Benção', 'Aprovado em Assembleia Geral Extraordinária de 16/07/2006.', 1, true),
  ('regimento', 'Regimento Interno', 'Art. 100: aprovado em Assembleia Ordinária de 11/12/2011.', 2, true)
on conflict (slug) do nothing;

-- Tabelas da primeira versão da onda 1 substituídas por workers/worker_approval_decisions e
-- attendance_counts/evangelizando_attendance. Sem uso no código (BL-013/022/028).
drop table if exists app.attendance_marks;
drop table if exists app.attendance_sheets;
drop table if exists app.admission_requests;

commit;
