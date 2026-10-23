-- Excluir ficha sem dar DELETE direto ao papel da aplicação.
-- A conferência de privilégios recusa DELETE de lar_app em app.workers.
create or replace function app.delete_worker_ficha(p_id uuid)
returns void
language plpgsql
security definer
set search_path = app, pg_temp
as $$
begin
  update app.users set worker_id = null where worker_id = p_id;
  delete from app.workers where id = p_id;
end;
$$;

revoke all on function app.delete_worker_ficha(uuid) from public, anon, authenticated;
grant execute on function app.delete_worker_ficha(uuid) to lar_app;

-- Acesso à área de Admissões, escolhido no convite. Fica desligado até alguém marcar.
alter table app.users
  add column if not exists admissions_access boolean not null default false;

comment on column app.users.admissions_access is
  'Quando verdadeiro, a conta vê Admissões. Administrador e Presidente veem a área mesmo sem esta marca.';
