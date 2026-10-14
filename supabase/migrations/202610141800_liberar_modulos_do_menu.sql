begin;

-- Menu igual ao visual v215: Diretoria e departamentos visíveis.
-- Cadastro público e WhatsApp continuam desligados.
update app.feature_flags
   set enabled = true,
       uat_reference = coalesce(uat_reference, 'Paridade visual v215 — menu completo — 2026-10-14'),
       enabled_at = coalesce(enabled_at, now()),
       updated_at = now()
 where key = 'business_modules'
    or key in (
      'module_home_ops',
      'module_documentos',
      'module_workers',
      'module_doutrina',
      'module_infancia',
      'module_juventude',
      'module_assistencia',
      'module_patrimonio',
      'module_eventos',
      'module_divulgacao',
      'module_secretaria',
      'module_tesouraria',
      'module_conselho_fiscal',
      'module_juridico',
      'module_presidencia'
    );

commit;
