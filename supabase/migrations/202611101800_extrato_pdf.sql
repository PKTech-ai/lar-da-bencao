-- Extrato bancário: além de OFX e CSV, aceita o arquivo em PDF.
alter table app.bank_statements drop constraint if exists bank_statements_format_check;
alter table app.bank_statements add constraint bank_statements_format_check check (format in ('OFX','CSV','PDF'));
