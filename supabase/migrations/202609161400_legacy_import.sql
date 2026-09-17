begin;

-- BL-010: importação assistida do backup completo v215 (ZIP) com simulação, idempotência,
-- relatório origem × destino e reversão.

alter table app.legacy_imports
  add column if not exists manifest jsonb not null default '{}'::jsonb,
  add column if not exists rolled_back_at timestamptz,
  add column if not exists rolled_back_by uuid references app.users(id);

-- Um mesmo pacote pode ser importado de novo depois de revertido.
alter table app.legacy_imports drop constraint if exists legacy_imports_source_sha256_key;
create unique index if not exists legacy_imports_active_sha_idx on app.legacy_imports (source_sha256) where status <> 'rolled_back';

create table if not exists app.legacy_id_map (
  id bigint generated always as identity primary key,
  import_id uuid not null references app.legacy_imports(id) on delete cascade,
  entity text not null check (entity ~ '^[a-z_]+$'),
  legacy_key text not null check (char_length(legacy_key) between 1 and 200),
  target_ref text not null check (char_length(target_ref) between 1 and 200),
  created_at timestamptz not null default now()
);
-- Idempotência: um registro legado só é importado uma vez enquanto a importação estiver ativa.
create unique index if not exists legacy_id_map_entity_idx on app.legacy_id_map (entity, legacy_key);
create index if not exists legacy_id_map_import_idx on app.legacy_id_map (import_id, entity);

-- Reversão: remove, em ordem de dependência, somente o que a importação criou.
create or replace function app.rollback_legacy_import(p_import_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_status text;
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
begin
  select status into v_status from app.legacy_imports where id = p_import_id for update;
  if v_status is null then raise exception 'importação inexistente'; end if;
  if v_status <> 'completed' then raise exception 'somente importação concluída pode ser revertida (situação: %)', v_status; end if;

  delete from app.evangelizando_attendance a using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'evangelizando_attendance'
     and a.evangelizando_id::text || '|' || a.class_date::text = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('evangelizando_attendance', v_n);

  delete from app.education_schedule s using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'education_schedule'
     and s.department_key || '|' || s.class_date::text || '|' || s.class_group = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('education_schedule', v_n);

  delete from app.education_group_evangelizers g using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'group_evangelizer'
     and g.department_key || '|' || g.class_group || '|' || g.position::text = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('group_evangelizer', v_n);

  delete from app.attendance_counts c using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'doctrine_attendance' and c.id::text = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('doctrine_attendance', v_n);

  delete from app.scale_months s using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'scale_month' and s.id::text = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('scale_month', v_n);

  delete from app.evangelizandos e using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'evangelizando' and e.id::text = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('evangelizando', v_n);

  delete from app.studies s using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'study' and s.id::text = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('study', v_n);

  -- Pastas: filhas antes das mães; pastas padrão (system) nunca são removidas.
  loop
    delete from app.study_folders f using app.legacy_id_map m
     where m.import_id = p_import_id and m.entity = 'study_folder' and f.id::text = m.target_ref and not f.system
       and not exists (select 1 from app.study_folders c where c.parent_id = f.id);
    get diagnostics v_n = row_count;
    exit when v_n = 0;
    v_counts := v_counts || jsonb_build_object('study_folder', coalesce((v_counts->>'study_folder')::int, 0) + v_n);
  end loop;

  delete from app.speakers s using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'speaker' and s.id::text = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('speaker', v_n);

  delete from app.workers w using app.legacy_id_map m
   where m.import_id = p_import_id and m.entity = 'worker' and w.id::text = m.target_ref;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('worker', v_n);

  delete from app.legacy_id_map where import_id = p_import_id;
  update app.legacy_imports set status = 'rolled_back', rolled_back_at = now(), rolled_back_by = p_user_id where id = p_import_id;
  return v_counts;
end;
$$;

revoke all on function app.rollback_legacy_import(uuid, uuid) from public, anon, authenticated;
grant execute on function app.rollback_legacy_import(uuid, uuid) to lar_app;
grant select, insert on app.legacy_id_map to lar_app;

commit;
