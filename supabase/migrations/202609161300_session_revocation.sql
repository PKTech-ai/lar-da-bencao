begin;

-- BL-002: revogação administrativa de sessões.
-- 1) Corte imediato na aplicação: sessões autenticadas antes de sessions_valid_after são recusadas.
-- 2) Corte no Supabase Auth: remove auth.sessions (refresh tokens caem em cascata).

alter table app.users add column if not exists sessions_valid_after timestamptz;

create or replace function app.revoke_auth_sessions(p_auth_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = app, pg_temp
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from app.users where auth_user_id = p_auth_user_id) then
    raise exception 'usuário institucional inexistente';
  end if;
  delete from auth.sessions where user_id = p_auth_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function app.revoke_auth_sessions(uuid) from public, anon, authenticated;
grant execute on function app.revoke_auth_sessions(uuid) to lar_app;

commit;
