begin;

-- BL-006/BL-007 + paridade com ACCESS_PROFILES do mock v215:
-- acesso por PÁGINA (total ou leitura) com padrões por perfil, concessão automática ao(s) departamento(s)
-- vinculado(s), sobrescritas editáveis pela matriz e vigência por biênio para os perfis da Diretoria.

create table if not exists app.pages (
  key text primary key check (key ~ '^[a-z]+$'),
  label text not null,
  sort_order integer not null
);
insert into app.pages (key, label, sort_order) values
  ('home','Visão Geral',1),('documentos','Estatuto e Regimento',2),('organograma','Organograma',3),('acesso','Controle de Acesso',4),
  ('doutrina','Doutrina',5),('infancia','Infância',6),('juventude','Juventude',7),('assistencia','Assistência Social',8),
  ('tesouraria','Tesouraria',9),('conselhofiscal','Conselho Fiscal',10),('patrimonio','Patrimônio',11),('eventos','Eventos',12),
  ('divulgacao','Divulgação',13),('juridico','Jurídico',14),('secretaria','Secretaria',15),('diretoria','Presidência',16)
on conflict (key) do update set label = excluded.label, sort_order = excluded.sort_order;

alter table app.departments add column if not exists page_key text references app.pages(key);
update app.departments d set page_key = v.page from (values
  ('diretoria','diretoria'),('secretaria','secretaria'),('tesouraria','tesouraria'),('conselho_fiscal','conselhofiscal'),
  ('doutrina','doutrina'),('infancia','infancia'),('juventude','juventude'),('assistencia_social','assistencia'),
  ('patrimonio','patrimonio'),('eventos','eventos'),('divulgacao','divulgacao'),('juridico','juridico')
) as v(dept, page) where d.key = v.dept;

insert into app.roles (key, label, description) values
  ('membro_efetivo', 'Membro Efetivo', 'Consulta aos documentos e à estrutura institucional; não gera acesso operacional a departamento.')
on conflict (key) do nothing;

-- Padrões por perfil (ACCESS_PROFILES.fixedFull / fixedRead). Documentos e Organograma: leitura para todos (regra na função).
create table if not exists app.page_grants (
  role_key text not null references app.roles(key) on delete cascade,
  page_key text not null references app.pages(key),
  level text not null check (level in ('full','read')),
  primary key (role_key, page_key)
);
insert into app.page_grants (role_key, page_key, level)
select r, p, 'full' from (values
  ('presidente', array['home','doutrina','infancia','juventude','assistencia','tesouraria','patrimonio','eventos','divulgacao','juridico','secretaria','diretoria']),
  ('secretario', array['home','secretaria']),
  ('tesoureiro', array['home','tesouraria']),
  ('conselheiro_fiscal', array['home','conselhofiscal']),
  ('coordenador', array['home']), ('subcoordenador', array['home']), ('trabalhador', array['home']),
  ('membro_efetivo', array['home']), ('brecho', array['home']), ('clube_maes', array['home'])
) as g(r, pages), unnest(g.pages) as p
on conflict do nothing;
insert into app.page_grants (role_key, page_key, level)
select r, p, 'read' from (values
  ('presidente', array['conselhofiscal']),
  ('vice_presidente', array['home','doutrina','infancia','juventude','assistencia','tesouraria','conselhofiscal','patrimonio','eventos','divulgacao','juridico','secretaria','diretoria']),
  ('secretario', array['doutrina','infancia','juventude','assistencia','patrimonio','eventos','divulgacao','juridico','diretoria']),
  ('tesoureiro', array['conselhofiscal','diretoria']),
  ('conselheiro_fiscal', array['tesouraria','diretoria']),
  ('brecho', array['assistencia']), ('clube_maes', array['assistencia']),
  ('auditor', array['home'])
) as g(r, pages), unnest(g.pages) as p
on conflict do nothing;

-- Matriz editável (BL-006): sobrescreve o padrão do perfil para a página. Sem linha = padrão.
create table if not exists app.page_grant_overrides (
  role_key text not null references app.roles(key) on delete cascade,
  page_key text not null references app.pages(key) check (page_key <> 'acesso'),
  level text not null check (level in ('full','read','none')),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  primary key (role_key, page_key)
);

-- Biênio (BL-007): a coluna antiga era texto sem uso.
alter table app.users drop column if exists biennium_id;
alter table app.users add column if not exists biennium_id uuid references app.bienniums(id);
alter table app.bienniums add column if not exists created_by uuid references app.users(id);
alter table app.bienniums add column if not exists updated_by uuid references app.users(id);
alter table app.bienniums add column if not exists version integer not null default 1;

create or replace function app.director_role(p_role text) returns boolean
language sql immutable as $$
  select p_role in ('presidente','vice_presidente','secretario','tesoureiro','conselheiro_fiscal');
$$;

-- Conta ativa e, para perfis da Diretoria, dentro do biênio (posse até fim + 15 dias de fechamento).
create or replace function app.user_access_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path = app, extensions, public, pg_temp as $$
  select exists (
    select 1 from app.users u
      left join app.bienniums b on b.id = u.biennium_id
     where u.id = p_user_id and u.status = 'active'
       and (not app.director_role(u.role_key)
            or (b.id is not null
                and (now() at time zone 'America/Sao_Paulo')::date between b.starts_on and b.ends_on + 15))
  );
$$;

create or replace function app.page_level(p_user_id uuid, p_page text) returns text
language plpgsql stable security definer set search_path = app, extensions, public, pg_temp as $$
declare
  v_role text;
  v_override text;
  v_level text;
begin
  if not app.user_access_allowed(p_user_id) then return null; end if;
  select role_key into v_role from app.users where id = p_user_id;
  if v_role = 'administrador' then return 'full'; end if;
  if p_page = 'acesso' then return null; end if;

  select level into v_override from app.page_grant_overrides where role_key = v_role and page_key = p_page;
  if v_override is not null then
    return nullif(v_override, 'none');
  end if;

  if p_page in ('documentos','organograma') then return 'read'; end if;
  select level into v_level from app.page_grants where role_key = v_role and page_key = p_page;
  if v_level = 'full' then return 'full'; end if;

  if exists (select 1 from app.user_departments ud join app.departments d on d.key = ud.department_key
              where ud.user_id = p_user_id and d.page_key = p_page) then
    if v_role in ('coordenador','subcoordenador') then return 'full'; end if;
    if v_role in ('trabalhador','evangelizador') then return 'read'; end if;
  end if;
  return v_level;
end;
$$;

create or replace function app.page_for_resource(p_resource text, p_department text) returns text
language sql stable security definer set search_path = app, extensions, public, pg_temp as $$
  select case
    when p_resource = 'department' then (select page_key from app.departments where key = p_department)
    when p_resource = 'presidencia' then 'diretoria'
    when p_resource = 'conselho_fiscal' then 'conselhofiscal'
    when p_resource = 'institucional' then 'documentos'
    when exists (select 1 from app.pages where key = p_resource) then p_resource
    else null
  end;
$$;

create or replace function app.has_permission(
  p_user_id uuid,
  p_resource text,
  p_action text,
  p_department text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, extensions, public, pg_temp
as $$
declare
  v_page text := app.page_for_resource(p_resource, p_department);
  v_level text;
begin
  if v_page is not null then
    v_level := app.page_level(p_user_id, v_page);
    return v_level = 'full' or (v_level = 'read' and p_action in ('read','print','export','download'));
  end if;
  -- Recursos especiais (auditoria, usuários, anexos, módulos, lançamentos de turma...).
  if not app.user_access_allowed(p_user_id) then return false; end if;
  return exists (
    select 1
      from app.users u
      join app.role_permissions rp on rp.role_key = u.role_key
     where u.id = p_user_id
       and rp.resource in ('*', p_resource)
       and rp.action in ('*', p_action)
       and (not rp.department_scoped
            or (p_department is not null and exists (
                  select 1 from app.user_departments ud where ud.user_id = u.id and ud.department_key = p_department)))
  );
end;
$$;

-- Concessões de página agora vêm do modelo acima; retira as linhas equivalentes da matriz de papéis.
delete from app.role_permissions where resource in ('department','institucional','presidencia','secretaria','tesouraria','conselho_fiscal','modules')
  and role_key <> 'administrador';
-- Brechó e Clube de Mães: somente o próprio setor (a antiga concessão abria toda a Assistência).
delete from app.role_permissions where role_key in ('brecho','clube_maes') and resource = 'attachments';

-- Tipo do anexo no cadastro (foto, nota fiscal, comprovante...).
alter table app.attachments add column if not exists kind text check (kind is null or kind ~ '^[a-z_]{1,40}$');

grant select on app.pages, app.page_grants to lar_app;
grant select, insert, update, delete on app.page_grant_overrides to lar_app;
grant select, insert, update on app.bienniums to lar_app;
grant execute on function app.page_level(uuid, text), app.user_access_allowed(uuid), app.page_for_resource(text, text), app.director_role(text) to lar_app;
revoke all on function app.page_level(uuid, text), app.user_access_allowed(uuid), app.page_for_resource(text, text) from public, anon, authenticated;

commit;
