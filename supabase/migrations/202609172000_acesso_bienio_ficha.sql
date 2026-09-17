-- Matriz de acesso editável, biênio da Diretoria e vínculo entre conta e ficha de trabalhador.

begin;

-- Uma conta pode apontar para a ficha do trabalhador (base da "Minha área").
alter table app.users add column if not exists worker_id uuid references app.workers(id);
create unique index if not exists users_worker_id_key on app.users (worker_id) where worker_id is not null;

-- Sugestões e elogios (mock: caixa de sugestões).
create table if not exists app.suggestions (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 3 and 160),
  body text not null check (char_length(body) between 5 and 4000),
  area text not null default '' check (char_length(area) <= 80),
  anonymous boolean not null default false,
  status text not null default 'Recebida' check (status in ('Recebida','Em análise','Respondida','Arquivada')),
  answer text not null default '' check (char_length(answer) <= 4000),
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  answered_at timestamptz,
  answered_by uuid references app.users(id),
  version integer not null default 1
);
create index if not exists suggestions_status on app.suggestions (status, created_at desc);

-- Configuração institucional (nome, fundação, contatos) usada na Visão Geral e nas impressões.
create table if not exists app.institution_settings (
  id boolean primary key default true check (id),
  name text not null default 'Lar da Bênção' check (char_length(name) between 2 and 160),
  founded_on date not null default date '1966-01-10',
  cnpj text not null default '' check (char_length(cnpj) <= 20),
  address text not null default '' check (char_length(address) <= 300),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 200),
  motto text not null default 'Uma Casa de estudo, acolhimento e caridade.' check (char_length(motto) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id),
  version integer not null default 1
);
insert into app.institution_settings (id) values (true) on conflict (id) do nothing;

grant select, insert, update on app.suggestions to lar_app;
grant select, update on app.institution_settings to lar_app;

commit;

-- O nível de acesso passa a ter uma única fonte: perfil + departamentos vinculados.
-- Assim a tela "Testar acessos" simula exatamente o que o servidor aplica.
begin;

create or replace function app.page_level_for(p_role text, p_departments text[], p_page text) returns text
language plpgsql stable security definer set search_path = app, extensions, public, pg_temp as $$
declare
  v_override text;
  v_level text;
begin
  if p_role = 'administrador' then return 'full'; end if;
  if p_page = 'acesso' then return null; end if;

  select level into v_override from app.page_grant_overrides where role_key = p_role and page_key = p_page;
  if v_override is not null then
    return nullif(v_override, 'none');
  end if;

  if p_page in ('documentos','organograma') then return 'read'; end if;
  select level into v_level from app.page_grants where role_key = p_role and page_key = p_page;
  if v_level = 'full' then return 'full'; end if;

  if exists (select 1 from app.departments d where d.page_key = p_page and d.key = any(coalesce(p_departments, '{}'))) then
    if p_role in ('coordenador','subcoordenador') then return 'full'; end if;
    if p_role in ('trabalhador','evangelizador') then return 'read'; end if;
  end if;
  return v_level;
end;
$$;

create or replace function app.page_level(p_user_id uuid, p_page text) returns text
language plpgsql stable security definer set search_path = app, extensions, public, pg_temp as $$
declare
  v_role text;
  v_departments text[];
begin
  if not app.user_access_allowed(p_user_id) then return null; end if;
  select u.role_key, coalesce(array_agg(ud.department_key) filter (where ud.department_key is not null), '{}')
    into v_role, v_departments
    from app.users u left join app.user_departments ud on ud.user_id = u.id
   where u.id = p_user_id group by u.role_key;
  if v_role is null then return null; end if;
  return app.page_level_for(v_role, v_departments, p_page);
end;
$$;

grant execute on function app.page_level_for(text, text[], text) to lar_app;
revoke all on function app.page_level_for(text, text[], text) from public, anon, authenticated;

commit;
