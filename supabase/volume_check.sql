\set ON_ERROR_STOP on
-- BL-056: ensaio de volume de anexos (NUNCA em produção). Gera N arquivos sintéticos de TAMANHO_MB,
-- mede o crescimento de app.attachment_chunks e desfaz tudo no final (ROLLBACK).
-- Uso: psql "$DEV_OWNER_URL" -v arquivos=2400 -v tamanho_mb=2 -f supabase/volume_check.sql
-- Projeção de referência: ~20 usuários × ~5 arquivos/mês × 12 meses × 2 (margem) ≈ 2400 arquivos.

\if :{?arquivos} \else \set arquivos 2400 \endif
\if :{?tamanho_mb} \else \set tamanho_mb 2 \endif

begin;
set local search_path = app, public, extensions;

select pg_total_relation_size('app.attachment_chunks') as antes_bytes \gset

with owner as (select id from app.users order by created_at limit 1),
files as (
  insert into app.attachments (owner_type, owner_id, filename, mime_type, size_bytes, sha256, chunk_count, status, upload_token_hash, uploaded_by, activated_at)
  select 'system_test', 'volume-check', 'volume-' || g || '.pdf', 'application/pdf',
         (:tamanho_mb * 1048576)::bigint, encode(digest('volume-' || g, 'sha256'), 'hex'),
         ceil(:tamanho_mb / 3.0)::int, 'active', digest('t' || g, 'sha256'), owner.id, now()
    from generate_series(1, :arquivos) g, owner
  returning id, chunk_count
)
insert into app.attachment_chunks (attachment_id, part_no, size_bytes, sha256, data)
select f.id, p, least(3145728, (:tamanho_mb * 1048576)::int - p * 3145728),
       encode(digest(f.id::text || p, 'sha256'), 'hex'),
       -- Conteúdo aleatório (não comprime), como PDFs/fotos reais.
       (select string_agg(gen_random_bytes(1024), ''::bytea) from generate_series(1, least(3072, (:tamanho_mb * 1024)::int - p * 3072)))
  from files f, generate_series(0, f.chunk_count - 1) p;

select pg_total_relation_size('app.attachment_chunks') as depois_bytes \gset

select :arquivos as arquivos, :tamanho_mb as tamanho_mb,
       pg_size_pretty((:depois_bytes - :antes_bytes)::bigint) as crescimento,
       pg_size_pretty(pg_database_size(current_database())) as banco_durante_o_teste;

-- Download de amostra: mede a leitura sequencial das partes de 50 arquivos.
explain (analyze, buffers, format text)
select data from app.attachment_chunks where attachment_id in (select id from app.attachments where owner_id = 'volume-check' limit 50) order by attachment_id, part_no;

rollback;
