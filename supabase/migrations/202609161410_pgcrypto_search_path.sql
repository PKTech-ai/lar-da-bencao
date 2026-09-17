begin;

-- Correção: as funções do Dedo-duro usam digest() (pgcrypto). No Supabase a extensão fica no
-- schema `extensions`, fora do search_path original (app, pg_temp), e a gravação de auditoria falharia.
-- Bancos que aplicaram a versão anterior da migração inicial recebem o search_path corrigido aqui.
alter function app.has_permission(uuid, text, text, text) set search_path = app, extensions, public, pg_temp;
alter function app.append_audit_event(uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb)
  set search_path = app, extensions, public, pg_temp;
alter function app.verify_audit_chain() set search_path = app, extensions, public, pg_temp;

commit;
