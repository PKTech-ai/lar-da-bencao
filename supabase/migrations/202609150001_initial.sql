begin;

create extension if not exists pgcrypto;
create extension if not exists citext;
create schema if not exists app;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lar_app') then
    create role lar_app nologin;
  end if;
end
$$;

revoke all on schema app from public;
revoke all on schema app from anon;
revoke all on schema app from authenticated;

create table app.roles (
  key text primary key check (key ~ '^[a-z_]+$'),
  label text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table app.departments (
  key text primary key check (key ~ '^[a-z_]+$'),
  label text not null unique,
  active boolean not null default true
);

create table app.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  email citext not null unique,
  full_name text not null check (char_length(full_name) between 2 and 160),
  role_key text not null references app.roles(key),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  biennium_id text,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  version integer not null default 1
);

create table app.user_departments (
  user_id uuid not null references app.users(id) on delete cascade,
  department_key text not null references app.departments(key),
  primary key (user_id, department_key)
);

create table app.role_permissions (
  role_key text not null references app.roles(key) on delete cascade,
  resource text not null,
  action text not null check (action in ('*','read','create','update','delete','approve','export','print','download','admin')),
  department_scoped boolean not null default false,
  primary key (role_key, resource, action)
);

create table app.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  enabled boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);

create table app.audit_events (
  sequence bigint generated always as identity unique,
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default clock_timestamp(),
  actor_user_id uuid references app.users(id),
  auth_user_id text,
  actor_name_snapshot text not null,
  role_snapshot text not null,
  category text not null check (category in ('Acesso','Inclusão','Edição','Exclusão','Impressão','Segurança')),
  action text not null,
  module text not null,
  section text,
  entity_type text,
  entity_id text,
  result text not null check (result in ('success','denied','failed','cancelled')),
  reason_code text,
  details text,
  before_json jsonb,
  after_json jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  request_id text,
  session_id text,
  masked_ip text,
  user_agent text,
  app_version text,
  previous_hash bytea,
  event_hash bytea not null
);

create index audit_events_occurred_idx on app.audit_events (occurred_at desc);
create index audit_events_actor_idx on app.audit_events (actor_user_id, occurred_at desc);
create index audit_events_filter_idx on app.audit_events (module, category, result, occurred_at desc);

create table app.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type ~ '^[a-z_]+$'),
  owner_id text not null,
  department_key text references app.departments(key),
  filename text not null check (char_length(filename) between 1 and 240),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','audio/webm','audio/ogg','text/csv','application/x-ofx')),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  chunk_count integer not null check (chunk_count between 1 and 7),
  status text not null default 'uploading' check (status in ('uploading','pending_scan','active','quarantined','deleted')),
  upload_token_hash bytea not null,
  scan_result text,
  scan_engine text,
  uploaded_by uuid not null references app.users(id),
  uploaded_at timestamptz not null default now(),
  activated_at timestamptz,
  removed_at timestamptz,
  retention_until date,
  version integer not null default 1,
  unique (owner_type, owner_id, sha256)
);

create table app.attachment_chunks (
  attachment_id uuid not null references app.attachments(id) on delete restrict,
  part_no integer not null check (part_no between 0 and 6),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  data bytea not null,
  created_at timestamptz not null default now(),
  primary key (attachment_id, part_no),
  check (octet_length(data) = size_bytes)
);

create index attachments_owner_idx on app.attachments (owner_type, owner_id, status);
create index attachments_pending_idx on app.attachments (status, uploaded_at);

create table app.legacy_imports (
  id uuid primary key default gen_random_uuid(),
  source_version integer not null,
  source_sha256 text not null unique,
  status text not null check (status in ('validating','ready','importing','completed','failed','rolled_back')),
  report jsonb not null default '{}'::jsonb,
  package_attachment_id uuid references app.attachments(id),
  created_by uuid not null references app.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger users_touch_updated_at
before update on app.users
for each row execute function app.touch_updated_at();

create or replace function app.has_permission(
  p_user_id uuid,
  p_resource text,
  p_action text,
  p_department text default null
)
returns boolean
language sql
stable
security definer
set search_path = app, pg_temp
as $$
  select exists (
    select 1
      from app.users u
      join app.role_permissions rp on rp.role_key = u.role_key
     where u.id = p_user_id
       and u.status = 'active'
       and rp.resource in ('*', p_resource)
       and rp.action in ('*', p_action)
       and (
         not rp.department_scoped
         or (
           p_department is not null
           and exists (
             select 1 from app.user_departments ud
              where ud.user_id = u.id and ud.department_key = p_department
           )
         )
       )
  );
$$;

create or replace function app.append_audit_event(
  p_actor_user_id uuid,
  p_auth_user_id text,
  p_actor_name text,
  p_role text,
  p_category text,
  p_action text,
  p_module text,
  p_section text,
  p_entity_type text,
  p_entity_id text,
  p_result text,
  p_reason_code text,
  p_details text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
  v_at timestamptz := clock_timestamp();
  v_previous bytea;
  v_hash bytea;
begin
  perform pg_advisory_xact_lock(709216);
  select event_hash into v_previous from app.audit_events order by sequence desc limit 1;
  v_hash := digest(
    coalesce(encode(v_previous, 'hex'), '') || '|' ||
    v_id::text || '|' || v_at::text || '|' || coalesce(p_actor_user_id::text, '') || '|' ||
    p_category || '|' || p_action || '|' || p_module || '|' || p_result || '|' ||
    coalesce(p_entity_type, '') || '|' || coalesce(p_entity_id, '') || '|' ||
    coalesce(p_details, '') || '|' || coalesce(p_before::text, '') || '|' ||
    coalesce(p_after::text, '') || '|' || coalesce(p_metadata::text, ''),
    'sha256'
  );
  insert into app.audit_events (
    id, occurred_at, actor_user_id, auth_user_id, actor_name_snapshot, role_snapshot,
    category, action, module, section, entity_type, entity_id, result, reason_code,
    details, before_json, after_json, metadata_json, request_id, session_id,
    masked_ip, user_agent, app_version, previous_hash, event_hash
  ) values (
    v_id, v_at, p_actor_user_id, p_auth_user_id, left(p_actor_name,160), left(p_role,80),
    p_category, left(p_action,200), left(p_module,120), left(p_section,160),
    left(p_entity_type,80), left(p_entity_id,160), p_result, left(p_reason_code,100),
    left(p_details,2000), p_before, p_after, coalesce(p_metadata,'{}'::jsonb),
    left(p_metadata->>'requestId',160), left(p_metadata->>'sessionId',160),
    left(p_metadata->>'maskedIp',80), left(p_metadata->>'userAgent',300),
    left(p_metadata->>'appVersion',80), v_previous, v_hash
  );
  return v_id;
end;
$$;

create or replace function app.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

create trigger audit_events_append_only
before update or delete on app.audit_events
for each row execute function app.prevent_audit_mutation();

create or replace function app.verify_audit_chain()
returns table(valid boolean, event_count bigint, broken_sequence bigint)
language sql
stable
security definer
set search_path = app, pg_temp
as $$
  with ordered as (
    select e.*,
           lag(event_hash) over (order by sequence) as expected_previous
      from app.audit_events e
  ), checked as (
    select sequence,
           previous_hash is not distinct from expected_previous
           and event_hash = digest(
             coalesce(encode(previous_hash, 'hex'), '') || '|' ||
             id::text || '|' || occurred_at::text || '|' || coalesce(actor_user_id::text, '') || '|' ||
             category || '|' || action || '|' || module || '|' || result || '|' ||
             coalesce(entity_type, '') || '|' || coalesce(entity_id, '') || '|' ||
             coalesce(details, '') || '|' || coalesce(before_json::text, '') || '|' ||
             coalesce(after_json::text, '') || '|' || coalesce(metadata_json::text, ''),
             'sha256'
           ) as ok
      from ordered
  )
  select coalesce(bool_and(ok), true), count(*)::bigint,
         min(sequence) filter (where not ok)
    from checked;
$$;

insert into app.roles (key,label,description) values
  ('administrador','Administrador do Sistema','Administração técnica e funcional.'),
  ('presidente','Presidente','Decisões da Presidência e acompanhamento institucional.'),
  ('vice_presidente','Vice-presidente','Consulta ampla e atuação delegada.'),
  ('secretario','Secretaria','Atas, reuniões e cadastros administrativos.'),
  ('tesoureiro','Tesouraria','Rotinas financeiras e comprovantes.'),
  ('conselheiro_fiscal','Conselho Fiscal','Análise financeira e pareceres.'),
  ('coordenador','Coordenador','Edição nos departamentos vinculados.'),
  ('subcoordenador','Subcoordenador','Edição nos departamentos vinculados.'),
  ('evangelizador','Evangelizador','Consulta e lançamentos no grupo vinculado.'),
  ('trabalhador','Trabalhador','Consulta das próprias rotinas.'),
  ('brecho','Brechó','Operação restrita ao Brechó.'),
  ('clube_maes','Clube de Mães','Operação restrita ao Clube de Mães.'),
  ('auditor','Auditoria','Consulta e exportação autorizadas.')
on conflict (key) do update set label=excluded.label, description=excluded.description;

insert into app.departments (key,label) values
  ('diretoria','Diretoria'),('secretaria','Secretaria'),('tesouraria','Tesouraria'),
  ('conselho_fiscal','Conselho Fiscal'),('doutrina','Doutrina'),('infancia','Infância'),
  ('juventude','Juventude'),('assistencia_social','Assistência e Promoção Social'),
  ('patrimonio','Patrimônio'),('eventos','Eventos'),('divulgacao','Divulgação'),('juridico','Jurídico')
on conflict (key) do update set label=excluded.label;

insert into app.role_permissions (role_key,resource,action,department_scoped) values
  ('administrador','*','*',false),
  ('presidente','dashboard','read',false),('presidente','institucional','read',false),
  ('presidente','presidencia','*',false),('presidente','audit','read',false),
  ('vice_presidente','dashboard','read',false),('vice_presidente','institucional','read',false),
  ('vice_presidente','modules','read',false),
  ('secretario','dashboard','read',false),('secretario','institucional','read',false),
  ('secretario','secretaria','*',false),('secretario','attachments','*',false),
  ('tesoureiro','dashboard','read',false),('tesoureiro','institucional','read',false),
  ('tesoureiro','tesouraria','*',false),('tesoureiro','attachments','*',false),
  ('conselheiro_fiscal','dashboard','read',false),('conselheiro_fiscal','institucional','read',false),
  ('conselheiro_fiscal','conselho_fiscal','*',false),('conselheiro_fiscal','tesouraria','read',false),
  ('conselheiro_fiscal','attachments','read',false),('conselheiro_fiscal','attachments','download',false),
  ('coordenador','dashboard','read',false),('coordenador','institucional','read',false),
  ('coordenador','department','*',true),('coordenador','attachments','*',true),
  ('subcoordenador','dashboard','read',false),('subcoordenador','institucional','read',false),
  ('subcoordenador','department','*',true),('subcoordenador','attachments','*',true),
  ('evangelizador','dashboard','read',false),('evangelizador','department','read',true),
  ('trabalhador','dashboard','read',false),('trabalhador','department','read',true),
  ('brecho','dashboard','read',false),('brecho','department','*',true),('brecho','attachments','*',true),
  ('clube_maes','dashboard','read',false),('clube_maes','department','*',true),('clube_maes','attachments','*',true),
  ('auditor','dashboard','read',false),('auditor','audit','read',false),('auditor','audit','export',false)
on conflict do nothing;

insert into app.feature_flags (key,enabled,description) values
  ('audit',true,'Dedo-duro protegido no servidor.'),
  ('attachments',true,'Anexos binários no PostgreSQL.'),
  ('legacy_import',false,'Importação assistida da versão 215.'),
  ('business_modules',false,'Módulos operacionais migrados da versão 215.')
on conflict (key) do nothing;

revoke all on all tables in schema app from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;

-- A conexão de runtime deve usar um login membro de lar_app, nunca o owner
-- empregado para executar migrações. A auditoria não recebe UPDATE/DELETE.
grant usage on schema app to lar_app;
grant select on app.roles, app.departments, app.role_permissions, app.feature_flags, app.audit_events to lar_app;
grant select, insert, update on app.users to lar_app;
grant select, insert, update, delete on app.user_departments to lar_app;
grant select, insert, update, delete on app.attachments, app.attachment_chunks, app.legacy_imports to lar_app;
grant usage, select on all sequences in schema app to lar_app;
grant execute on all functions in schema app to lar_app;

commit;
