\set ON_ERROR_STOP on
-- BL-058: evidência de restauração íntegra. Rodar com o owner no banco RESTAURADO.
-- 1) cadeia do Dedo-duro; 2) SHA-256 de todos os anexos ativos recalculado a partir das partes BYTEA;
-- 3) contagens por tabela para comparar com o banco de origem.
set search_path = app, extensions, public;

select 'cadeia_auditoria' as verificacao, valid::text as ok, event_count::text as detalhe from app.verify_audit_chain();

with rebuilt as (
  select a.id, a.sha256 as esperado, a.size_bytes,
         encode(digest(string_agg(c.data, ''::bytea order by c.part_no), 'sha256'), 'hex') as obtido,
         sum(c.size_bytes) as bytes, count(c.part_no) as partes, a.chunk_count
    from app.attachments a
    join app.attachment_chunks c on c.attachment_id = a.id
   where a.status = 'active'
   group by a.id
)
select 'anexos_sha256' as verificacao,
       (count(*) filter (where esperado <> obtido or bytes <> size_bytes or partes <> chunk_count) = 0)::text as ok,
       format('%s conferido(s), %s divergente(s)', count(*), count(*) filter (where esperado <> obtido or bytes <> size_bytes or partes <> chunk_count)) as detalhe
  from rebuilt;

select 'anexos_sem_binario' as verificacao,
       (count(*) = 0)::text as ok, count(*)::text as detalhe
  from app.attachments a
 where a.status = 'active' and not exists (select 1 from app.attachment_chunks c where c.attachment_id = a.id);

-- Contagens para o relatório de restauração (comparar com a origem).
select relname as tabela, n_live_tup as linhas_estimadas
  from pg_stat_user_tables where schemaname = 'app' order by relname;
