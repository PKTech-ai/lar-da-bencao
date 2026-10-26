-- Trabalhadores fixos da escala da Doutrina: a mesma pessoa na mesma função de uma atividade
-- em todas as semanas, até ser desmarcada. A geração coloca os fixos primeiro e preenche o resto.

begin;

create table if not exists app.scale_fixed_assignments (
  id uuid primary key default gen_random_uuid(),
  department_key text not null default 'doutrina' references app.departments(key),
  dow integer not null check (dow in (0, 1, 3, 4, 5, 6)),
  section_index integer not null check (section_index between 0 and 20),
  role_index integer not null check (role_index between 0 and 20),
  position integer not null check (position between 0 and 10),
  -- Retrato do modelo na marcação (o modelo vive no código: lib/doutrina-scale.ts).
  section_name text not null check (char_length(section_name) between 1 and 120),
  role_label text not null check (char_length(role_label) between 1 and 60),
  -- Fixo é configuração, não histórico: excluir a ficha libera a posição.
  worker_id uuid not null references app.workers(id) on delete cascade,
  created_by uuid not null references app.users(id),
  created_at timestamptz not null default now(),
  unique (department_key, dow, section_index, role_index, position)
);
create index if not exists scale_fixed_assignments_worker on app.scale_fixed_assignments (worker_id);

grant select, insert, delete on app.scale_fixed_assignments to lar_app;

commit;
