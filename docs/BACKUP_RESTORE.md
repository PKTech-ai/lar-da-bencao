# Backup e restauração (RF-007 · BL-058)

Metas do MVP: **RPO 24 h** e **RTO 4 h**. O banco inclui os binários dos anexos (`app.attachment_chunks`), então todo backup e toda restauração precisam conferir esses dados.

## 1. Configuração (produção)

| Item | Onde | Situação |
|---|---|---|
| PITR (point-in-time recovery) | Supabase → Database → Backups (plano Pro + add-on PITR) | ☐ ativado, janela ≥ 7 dias |
| Backup diário | Supabase (incluído no plano) | ☐ conferido na tela de backups |
| Cópia isolada fora do projeto | Operador de backup, máquina institucional (seção 3) | ☐ semanal, criptografada, retenção de 30 dias |
| Alerta de backup falho | Supabase → e-mail do responsável técnico | ☐ |

**Dupla confirmação:** restauração em produção só com dois responsáveis (técnico + Diretoria), registrada no formulário da seção 5.

## 2. Restauração integral (trimestral) e amostral (mensal)

Sempre restaurar **em um projeto Supabase novo e temporário**, nunca por cima da produção, exceto em incidente real (seção 4).

1. Supabase → Backups → *Restore to new project* (ou PITR para o horário alvo).
2. Anote: horário alvo, horário de início e de fim (para medir o RTO).
3. No projeto restaurado, com o owner:
   ```bash
   psql "$RESTORED_OWNER_URL" -f supabase/verify_permissions.sql
   psql "$RESTORED_OWNER_URL" -f supabase/verify_restore.sql
   ```
   `verify_restore.sql` precisa retornar `ok = true` em **cadeia_auditoria**, **anexos_sha256** (SHA-256 recalculado de cada anexo a partir das partes BYTEA) e **anexos_sem_binario**.
4. Compare as contagens por tabela com a origem (mesmo script na produção, só leitura).
5. **Amostral (mensal):** baixe 3 anexos aleatórios pelo app apontado para o projeto restaurado (ambiente local) e confira que abrem.
6. Registre o resultado (seção 5) e **exclua** o projeto temporário.

## 3. Cópia isolada (semanal)

Feita por um operador em máquina institucional, **nunca na CI** (a CI não recebe credenciais de produção):

```bash
# Login somente leitura criado para o backup (sem acesso de escrita)
pg_dump "$BACKUP_READONLY_URL" --format=custom --no-owner --file "lar-$(date +%F).dump"
age -r "$CHAVE_PUBLICA_BACKUP" -o "lar-$(date +%F).dump.age" "lar-$(date +%F).dump" && shred -u "lar-$(date +%F).dump"
# Envie o .age para o armazenamento externo aprovado pela Diretoria; mantenha 30 dias.
```

A chave privada fica com dois responsáveis, em cofre separado.

## 4. Restauração de produção (incidente)

1. Declare o incidente (docs/RUNBOOKS.md) e coloque os módulos em manutenção: **Módulos e ondas** → desligar `business_modules`.
2. Escolha o horário alvo (antes do evento) e restaure via PITR **no próprio projeto** somente com as duas confirmações.
3. Rode `verify_permissions.sql` e `verify_restore.sql`.
4. Religue os módulos, comunique os usuários e registre tudo no Dedo-duro e no formulário abaixo.

## 5. Registro de restauração

| Data | Tipo (integral/amostral/incidente) | Horário alvo | Início → fim (RTO) | Perda estimada (RPO) | Resultado dos scripts | Responsáveis |
|---|---|---|---|---|---|---|
| | | | | | | |
