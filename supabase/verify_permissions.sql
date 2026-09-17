\set ON_ERROR_STOP on

-- Confere os privilégios do papel de runtime (lar_app) depois das migrações.
do $$
declare
  t text;
begin
  if has_table_privilege('lar_app', 'app.audit_events', 'UPDATE')
     or has_table_privilege('lar_app', 'app.audit_events', 'DELETE') then
    raise exception 'lar_app não pode alterar ou excluir auditoria';
  end if;
  if not has_table_privilege('lar_app', 'app.audit_events', 'SELECT') then
    raise exception 'lar_app precisa consultar a auditoria autorizada';
  end if;
  if not has_function_privilege('lar_app', 'app.verify_audit_chain()', 'EXECUTE') then
    raise exception 'lar_app precisa verificar a cadeia de auditoria';
  end if;

  -- Cadastros sensíveis: exclusão só pela função de reversão da importação (SECURITY DEFINER).
  foreach t in array array['app.workers','app.speakers','app.studies','app.scale_months','app.users','app.legacy_id_map','app.worker_approval_decisions','app.evangelizando_renewals'] loop
    if has_table_privilege('lar_app', t, 'DELETE') then
      raise exception 'lar_app não deve ter DELETE em %', t;
    end if;
  end loop;
  -- Históricos: somente inclusão.
  foreach t in array array['app.worker_approval_decisions','app.evangelizando_renewals','app.legacy_id_map'] loop
    if has_table_privilege('lar_app', t, 'UPDATE') then
      raise exception 'lar_app não deve ter UPDATE em %', t;
    end if;
  end loop;
  -- Flags: só as colunas de controle.
  if has_column_privilege('lar_app', 'app.feature_flags', 'key', 'UPDATE')
     or has_column_privilege('lar_app', 'app.feature_flags', 'wave', 'UPDATE') then
    raise exception 'lar_app só pode alterar enabled/uat_reference/enabled_at/updated_* em feature_flags';
  end if;
  if not has_column_privilege('lar_app', 'app.feature_flags', 'enabled', 'UPDATE') then
    raise exception 'lar_app precisa ligar/desligar módulos';
  end if;
  -- Funções privilegiadas usadas pela aplicação.
  if not has_function_privilege('lar_app', 'app.revoke_auth_sessions(uuid)', 'EXECUTE')
     or not has_function_privilege('lar_app', 'app.rollback_legacy_import(uuid, uuid)', 'EXECUTE') then
    raise exception 'lar_app precisa executar revoke_auth_sessions e rollback_legacy_import';
  end if;
  if has_function_privilege('anon', 'app.revoke_auth_sessions(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'app.rollback_legacy_import(uuid, uuid)', 'EXECUTE') then
    raise exception 'funções privilegiadas expostas a anon/authenticated';
  end if;
  -- Esquema app fechado para a API pública do Supabase.
  if has_schema_privilege('anon', 'app', 'USAGE') or has_schema_privilege('authenticated', 'app', 'USAGE') then
    raise exception 'schema app não pode ser acessível por anon/authenticated';
  end if;
end
$$;

select * from app.verify_audit_chain();
