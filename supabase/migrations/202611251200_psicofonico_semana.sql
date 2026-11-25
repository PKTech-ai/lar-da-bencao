-- RN-ESC-001 — exclusividade semanal dos médiuns psicofônicos, e ninguém em duas funções na mesma data.
-- Última barreira: telas e rotas já recusam (lib/doutrina-scale.ts → slotAvailability); aqui nada passa,
-- nem por importação nem por acesso direto ao banco.
-- * Mesma data: uma pessoa só pode ocupar uma posição por data, em qualquer escala.
-- * Psicofônico de quarta e de sexta: só numa das duas reuniões da mesma semana (segunda a domingo,
--   date_trunc('week'), mesmo quando a semana vira o mês ou o ano). Segunda e domingo não entram.
--   O modelo da escala vive no código; aqui o psicofônico é reconhecido pelo rótulo gravado ("... → PSICOF."),
--   e um teste do código garante que só essa função usa esse rótulo.
-- Só confere a linha que mudou de pessoa, data ou função: dados antigos não travam outras edições
-- (eles aparecem como pendência na Conferência).

begin;

create or replace function app.scale_assignment_guard()
returns trigger
language plpgsql
set search_path = app, pg_temp
as $$
declare
  v_label text;
  v_date date;
begin
  if new.worker_id is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.worker_id is not distinct from old.worker_id
     and new.work_date = old.work_date and new.role_label = old.role_label then
    return null;
  end if;
  if not exists (select 1 from app.scale_months m where m.id = new.scale_month_id and m.status <> 'deleted') then
    return null;
  end if;

  -- Mesma trava das rotas (lib/doutrina-data.ts → lockScales): uma escrita de escala por vez.
  perform pg_advisory_xact_lock(hashtext('escala:doutrina'));

  select a.role_label into v_label
    from app.scale_assignments a
    join app.scale_months m on m.id = a.scale_month_id
   where a.worker_id = new.worker_id and a.work_date = new.work_date and a.id <> new.id and m.status <> 'deleted'
   limit 1;
  if found then
    raise exception using errcode = 'LB409',
      message = format('Este trabalhador já está escalado em %s nesta data. Ninguém exerce duas funções na mesma data: tire-o de lá antes.', v_label);
  end if;

  if new.role_label ~ ' PSICOF\.$' and extract(isodow from new.work_date) in (3, 5) then
    select a.work_date into v_date
      from app.scale_assignments a
      join app.scale_months m on m.id = a.scale_month_id
     where a.worker_id = new.worker_id and a.id <> new.id and m.status <> 'deleted'
       and a.role_label ~ ' PSICOF\.$' and extract(isodow from a.work_date) in (3, 5)
       and a.work_date <> new.work_date
       and date_trunc('week', a.work_date) = date_trunc('week', new.work_date)
     order by a.work_date
     limit 1;
    if found then
      raise exception using errcode = 'LB409',
        message = 'Este médium já está escalado como psicofônico na '
          || case extract(isodow from v_date) when 3 then 'quarta-feira' else 'sexta-feira' end
          || ' desta semana. Sua inclusão na outra reunião mediúnica não será permitida, '
          || 'respeitando o período destinado ao estudo e ao aperfeiçoamento doutrinário.';
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists scale_assignments_guard on app.scale_assignments;
create trigger scale_assignments_guard
after insert or update of worker_id, work_date, role_label on app.scale_assignments
for each row execute function app.scale_assignment_guard();

commit;
