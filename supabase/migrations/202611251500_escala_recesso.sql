-- Dias de recesso da escala da Doutrina, escolhidos na tela da escala:
-- a casa não abre naquela data, ninguém é escalado e a folha mostra o recesso.
-- Fica separado do mês para valer também em "Gerar novamente" e antes de a escala existir.

begin;

create table if not exists app.scale_recess (
  department_key text not null default 'doutrina' references app.departments(key),
  recess_date date not null,
  created_by uuid not null references app.users(id),
  created_at timestamptz not null default now(),
  primary key (department_key, recess_date)
);

grant select, insert, update, delete on app.scale_recess to lar_app;

commit;
