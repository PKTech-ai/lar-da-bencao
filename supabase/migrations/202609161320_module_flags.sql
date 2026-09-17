begin;

-- BL-011: liberação de módulos por onda, com registro de UAT.
-- Módulos de negócio nascem DESLIGADOS; o administrador liga em /sistema/modulos após UAT.

alter table app.feature_flags add column if not exists wave text
  check (wave is null or wave in ('fundacao','1','2','3'));
alter table app.feature_flags add column if not exists uat_reference text
  check (uat_reference is null or char_length(uat_reference) between 3 and 300);
alter table app.feature_flags add column if not exists enabled_at timestamptz;

update app.feature_flags set wave = 'fundacao' where key in ('audit','attachments','legacy_import','business_modules');
update app.feature_flags set wave = '1' where key like 'module\_%' escape '\';

-- A migração da onda 1 ligava tudo por padrão. Sem UAT registrado, desliga.
update app.feature_flags
   set enabled = false, updated_at = now()
 where (key like 'module\_%' escape '\' or key = 'business_modules')
   and uat_reference is null;

grant update (enabled, uat_reference, enabled_at, updated_at, updated_by) on app.feature_flags to lar_app;

commit;
