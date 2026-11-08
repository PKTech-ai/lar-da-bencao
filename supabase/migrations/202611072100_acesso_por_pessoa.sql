-- Acesso por pessoa (decidido com a Presidência em 07/11/2026).
-- A ficha diz onde a pessoa trabalha (escalas); o acesso ao sistema é escolhido à parte, por departamento:
--   chamada     = marca a presença das próprias turmas (Infância/Juventude), sem ver o resto do departamento;
--   consulta    = vê o departamento sem mudar nada;
--   coordenacao = tudo do departamento.
-- Sem linha em app.user_departments = Nenhum (só a Minha área). Só o Administrador libera.
-- O acesso escolhido para a pessoa vale acima do padrão e das exceções do perfil.

begin;

alter table app.user_departments
  add column if not exists access_level text not null default 'consulta',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references app.users(id) on delete set null;
alter table app.user_departments drop constraint if exists user_departments_access_level_check;
alter table app.user_departments add constraint user_departments_access_level_check
  check (access_level in ('chamada', 'consulta', 'coordenacao'));

-- Vínculos atuais: o que veio sozinho da ficha deixa de dar acesso (fica Nenhum), menos para quem é
-- evangelizador de uma turma (fica Chamada). Coordenação pelo perfil fica Coordenação. O que foi liberado
-- à mão pelo Administrador (departamento fora da ficha, ou conta sem ficha) continua como Consulta,
-- que é o mesmo nível que essas contas de trabalhador já tinham.
with links as (
  select ud.user_id, ud.department_key, u.role_key,
         exists (select 1 from app.worker_departments wd
                  where wd.worker_id = u.worker_id and wd.department_key = ud.department_key) as from_ficha,
         exists (select 1 from app.education_group_evangelizers g
                  where g.worker_id = u.worker_id and g.department_key = ud.department_key) as has_class
    from app.user_departments ud
    join app.users u on u.id = ud.user_id
)
update app.user_departments ud
   set access_level = case
         when l.role_key in ('coordenador', 'subcoordenador') then 'coordenacao'
         when not l.from_ficha then 'consulta'
         when l.has_class then 'chamada'
         else ud.access_level
       end
  from links l
 where l.user_id = ud.user_id and l.department_key = ud.department_key;

delete from app.user_departments ud
 using app.users u
 where u.id = ud.user_id
   and u.role_key not in ('coordenador', 'subcoordenador')
   and exists (select 1 from app.worker_departments wd
                where wd.worker_id = u.worker_id and wd.department_key = ud.department_key)
   and not exists (select 1 from app.education_group_evangelizers g
                    where g.worker_id = u.worker_id and g.department_key = ud.department_key);

-- Nível da página: primeiro o acesso da pessoa (Coordenação), depois o perfil (exceção, Documentos/Organograma,
-- padrão), depois a Consulta da pessoa. Chamada não abre a página do departamento.
create or replace function app.page_level_links(p_role text, p_read text[], p_full text[], p_page text) returns text
language plpgsql stable security definer set search_path = app, extensions, public, pg_temp as $$
declare
  v_override text;
  v_role_level text;
begin
  if p_role = 'administrador' then return 'full'; end if;
  if p_page = 'acesso' then return null; end if;

  if exists (select 1 from app.departments d where d.page_key = p_page and d.key = any(coalesce(p_full, '{}'))) then
    return 'full';
  end if;

  select level into v_override from app.page_grant_overrides where role_key = p_role and page_key = p_page;
  if v_override is not null then
    v_role_level := nullif(v_override, 'none');
  elsif p_page in ('documentos', 'organograma') then
    v_role_level := 'read';
  else
    select level into v_role_level from app.page_grants where role_key = p_role and page_key = p_page;
  end if;
  if v_role_level = 'full' then return 'full'; end if;

  if exists (select 1 from app.departments d where d.page_key = p_page and d.key = any(coalesce(p_read, '{}'))) then
    return 'read';
  end if;
  return nullif(v_role_level, 'none');
end;
$$;

-- Mesma assinatura de antes (usada pelo "Testar acessos"): os departamentos simulados valem como
-- Coordenação para coordenador/subcoordenador e como Consulta para os demais perfis.
create or replace function app.page_level_for(p_role text, p_departments text[], p_page text) returns text
language plpgsql stable security definer set search_path = app, extensions, public, pg_temp as $$
begin
  if p_role in ('coordenador', 'subcoordenador') then
    return app.page_level_links(p_role, '{}', p_departments, p_page);
  end if;
  return app.page_level_links(p_role, p_departments, '{}', p_page);
end;
$$;

create or replace function app.page_level(p_user_id uuid, p_page text) returns text
language plpgsql stable security definer set search_path = app, extensions, public, pg_temp as $$
declare
  v_role text;
  v_read text[];
  v_full text[];
begin
  if not app.user_access_allowed(p_user_id) then return null; end if;
  select u.role_key,
         coalesce(array_agg(ud.department_key) filter (where ud.access_level = 'consulta'), '{}'),
         coalesce(array_agg(ud.department_key) filter (where ud.access_level = 'coordenacao'), '{}')
    into v_role, v_read, v_full
    from app.users u left join app.user_departments ud on ud.user_id = u.id
   where u.id = p_user_id group by u.role_key;
  if v_role is null then return null; end if;
  return app.page_level_links(v_role, v_read, v_full, p_page);
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
  if p_resource in ('social_brecho', 'social_clube_maes') then
    v_level := app.page_level(p_user_id, 'assistencia');
    if v_level = 'full' or (v_level = 'read' and p_action in ('read','print','export','download')) then
      return true;
    end if;
  end if;
  if not app.user_access_allowed(p_user_id) then return false; end if;
  -- Chamada: marcar a presença no departamento (o recorte pelas turmas da pessoa fica em lib/education-data.ts).
  if p_resource = 'education_class' and p_action in ('read', 'update') and p_department is not null and exists (
    select 1 from app.user_departments ud
     where ud.user_id = p_user_id and ud.department_key = p_department and ud.access_level = 'chamada'
  ) then
    return true;
  end if;
  return exists (
    select 1
      from app.users u
      join app.role_permissions rp on rp.role_key = u.role_key
     where u.id = p_user_id
       and rp.resource in ('*', p_resource)
       and rp.action in ('*', p_action)
       and (
         not rp.department_scoped
         or (p_department is not null and exists (
           -- Coordenação: tudo o que o perfil permite no departamento. Consulta: só ler (nunca alterar, mesmo com perfil de Coordenador).
           select 1 from app.user_departments ud
            where ud.user_id = u.id and ud.department_key = p_department
              and (ud.access_level = 'coordenacao'
                   or (ud.access_level = 'consulta' and p_action in ('read', 'print', 'export', 'download')))
         ))
       )
  );
end;
$$;

grant execute on function app.page_level_links(text, text[], text[], text) to lar_app;
revoke all on function app.page_level_links(text, text[], text[], text) from public, anon, authenticated;

commit;
