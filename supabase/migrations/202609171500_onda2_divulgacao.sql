-- Onda 2 — Divulgação/Livraria: obras por destinação, estoque, empréstimos com devolução e vendas.
-- Tabelas geradas a partir de lib/resources/defs/divulgacao.ts (resourceDDL).

begin;

create table if not exists app.books (
  id uuid primary key default gen_random_uuid(),
  code text not null default '' check (char_length(code) <= 50),
  title text not null default '' check (char_length(title) <= 200),
  purpose text not null,
  author text not null default '' check (char_length(author) <= 180),
  isbn text not null default '' check (char_length(isbn) <= 40),
  price_cents bigint,
  active text not null,
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.books to lar_app;

create table if not exists app.book_stock_moves (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references app.books(id) not null,
  direction text not null,
  quantity integer not null,
  move_date date not null,
  reason text not null default '' check (char_length(reason) <= 250),
  notes text not null default '' check (char_length(notes) <= 500),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.book_stock_moves to lar_app;

create table if not exists app.book_loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references app.books(id) not null,
  borrower text not null default '' check (char_length(borrower) <= 180),
  quantity integer not null,
  contact text,
  loan_date date not null,
  due_date date not null,
  notes text not null default '' check (char_length(notes) <= 500),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.book_loans to lar_app;

create table if not exists app.book_sales (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references app.books(id) not null,
  quantity integer not null,
  unit_price_cents bigint not null,
  sale_date date not null,
  payment_method text not null,
  buyer text not null default '' check (char_length(buyer) <= 180),
  notes text not null default '' check (char_length(notes) <= 500),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.book_sales to lar_app;

alter table app.books add constraint books_purpose_check check (purpose in ('Empréstimos','Revenda'));
alter table app.books add constraint books_active_check check (active in ('Ativo','Inativo'));
create unique index if not exists books_code_key on app.books (upper(regexp_replace(code, '\s+', '', 'g')));
alter table app.book_stock_moves add constraint book_stock_direction_check check (direction in ('Entrada','Baixa'));
alter table app.book_stock_moves add constraint book_stock_quantity_check check (quantity > 0);
alter table app.book_loans add constraint book_loans_quantity_check check (quantity > 0);
alter table app.book_loans add constraint book_loans_due_check check (due_date >= loan_date);
alter table app.book_sales add constraint book_sales_quantity_check check (quantity > 0);
alter table app.book_sales add constraint book_sales_payment_check check (payment_method in ('PIX','Dinheiro','Cartão','Transferência'));
create index if not exists book_stock_book on app.book_stock_moves (book_id);
create index if not exists book_loans_book on app.book_loans (book_id);
create index if not exists book_sales_book on app.book_sales (book_id);

-- Devoluções de um empréstimo (o saldo em aberto libera o inventário).
create table if not exists app.book_loan_returns (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references app.book_loans(id),
  return_date date not null,
  quantity integer not null check (quantity > 0),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id)
);
create index if not exists book_loan_returns_loan on app.book_loan_returns (loan_id);
grant select, insert on app.book_loan_returns to lar_app;

commit;
