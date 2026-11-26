-- Organograma de Vinculação: o Vice-Presidente passa a só CONSULTAR a Diretoria (decidido com a Presidência em
-- 26/11/2026; antes o vínculo dava acesso total). O código novo já vincula assim (lib/org-links.ts → seatLevel).
-- Aqui, quem já estava vinculado como Vice perde o "alterar" nos departamentos que esse vínculo liberou, a não ser
-- onde outro vínculo da mesma pessoa (que não seja de Vice) dá acesso total. Fica registrado no Dedo-duro.
-- O Conselho Fiscal passa a ter no máximo 3 membros (conferido na hora de vincular; hoje ninguém passa disso).

begin;

with alvo as (
  select l.user_id, d.key as department_key
    from app.org_links l
    cross join lateral unnest(l.granted) as d(key)
   where l.seat = 'vice_presidente'
     and not exists (
       select 1 from app.org_links o
        where o.user_id = l.user_id and o.id <> l.id and o.seat <> 'vice_presidente' and d.key = any(o.granted))
), modulos as (
  update app.user_module_access m set can_edit = false, updated_at = now()
    from alvo a
   where m.user_id = a.user_id and m.department_key = a.department_key and m.can_edit
  returning m.user_id
), resumo as (
  update app.user_departments ud set access_level = 'consulta', keeps_coordination = false, updated_at = now()
    from alvo a
   where ud.user_id = a.user_id and ud.department_key = a.department_key and ud.access_level <> 'consulta'
  returning ud.user_id, ud.department_key
)
select app.append_audit_event(
         null, null, 'Sistema (atualização)', 'system', 'Segurança', 'Vice-Presidente passa a só consultar',
         'Controle de Acesso', 'Organograma de Vinculação', 'user', r.user_id::text, 'success', null,
         coalesce(w.full_name, u.full_name) || ' · Vice-Presidente · passa a só consultar: ' || d.label,
         jsonb_build_object('department_key', r.department_key, 'access_level', 'coordenacao'),
         jsonb_build_object('department_key', r.department_key, 'access_level', 'consulta'),
         jsonb_build_object('migration', '202611262000_vice_presidente_consulta', 'modulos', (select count(*) from modulos)))
  from resumo r
  join app.users u on u.id = r.user_id
  left join app.workers w on w.id = u.worker_id
  join app.departments d on d.key = r.department_key;

commit;
