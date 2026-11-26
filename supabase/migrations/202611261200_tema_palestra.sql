-- Tema da palestra pública: além do Tema Livre e dos estudos cadastrados (temas de palestra e roteiros do ESE),
-- a tela grava o tema digitado como `txt:<texto>` — até 120 caracteres, sem quebra de linha nem outro caractere
-- de controle. O formato e o limite vivem em lib/doutrina-scale.ts (TYPED_THEME, THEME_MAX).
-- A regra antiga foi criada junto com a coluna, sem nome escolhido: apaga qualquer regra de `slot_value` antes.

begin;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'app.scale_assignments'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%slot_value%'
  loop
    execute format('alter table app.scale_assignments drop constraint %I', c.conname);
  end loop;
end $$;

alter table app.scale_assignments add constraint scale_assignments_slot_value_check
  check (slot_value ~ '^(|w:[0-9a-f-]{36}|s:[0-9a-f-]{36}|t:[0-9a-f-]{36}|free:Tema Livre|txt:[^[:cntrl:]]{2,120})$');

commit;
