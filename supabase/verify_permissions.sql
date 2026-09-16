\set ON_ERROR_STOP on

do $$
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
end
$$;

select * from app.verify_audit_chain();
