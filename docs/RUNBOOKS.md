# Runbooks de suporte e incidentes (RF-015)

**Severidade**

| Nível | Exemplo | Resposta | Comunicação |
|---|---|---|---|
| P1 | Sistema fora do ar; suspeita de vazamento; dado corrompido | Início em até 1 h no horário acordado | Presidência + responsável técnico imediatamente |
| P2 | Módulo indisponível; anexos não sobem; login falhando para vários | Até 4 h | Coordenador do módulo |
| P3 | Erro pontual, dúvida de uso | Próximo dia útil | Solicitante |

Todo atendimento registra: protocolo (o `requestId` mostrado nos erros), horário, responsável, ações e encerramento.

## 1. Sistema indisponível

1. `curl -s https://sistema.lardabencao.org/api/health` → `ok` / `degraded` / `unavailable`.
2. `unavailable`: banco inacessível → status do Supabase; credencial `DATABASE_URL` (Vercel → Settings → Environment Variables); limite de conexões.
3. `degraded` com `schema: false`: migração pendente → aplicar as migrações em ordem (docs/DEPLOY.md).
4. `degraded` com `integrity: false`: o cron diário não rodou nos últimos 36 h → Vercel → Cron Jobs; rodar manualmente com `CRON_SECRET`.
5. Vercel com falha de deploy: *Instant Rollback* para o último deploy bom.

## 2. Cadeia do Dedo-duro quebrada (`AUDIT_CHAIN_BROKEN`)

Tratar como **P1 / suspeita de adulteração**. Não corrigir dados. Preservar evidências (snapshot/PITR), identificar a sequência (`brokenSequence`) e acionar a seção 6.

## 3. Conta bloqueada ou MFA perdido

1. Confirme a identidade fora do sistema (presencialmente ou por contato já cadastrado).
2. Login bloqueado por tentativas: aguarde a janela (15 min a 24 h) ou verifique no Dedo-duro “Login bloqueado por excesso de tentativas”.
3. MFA perdido: o titular usa um código de recuperação em `/mfa`; sem códigos, o administrador usa **Usuários → Redefinir MFA** (encerra sessões e exige novo cadastro).
4. Suspeita de conta comprometida: **Encerrar sessões**, suspender o usuário e seguir a seção 6.

## 4. Anexos não sobem / quarentena

1. Erro `MALWARE_SCAN_UNAVAILABLE`: serviço de inspeção fora → contatar o fornecedor; anexos ficam pendentes e podem ser reenviados.
2. Arquivo em quarentena: **Anexos** → verificar motivo; nunca liberar manualmente. Descartar com motivo.
3. Volume do banco perto do limite: **Anexos** mostra o tamanho; rever plano e política de retenção.

## 5. Falha de integração (e-mail do Auth, scanner)

- E-mail de convite/recuperação não chega: Supabase → Auth → Logs; SMTP institucional; limites de envio.
- Scanner: seção 4.

## 6. Suspeita de vazamento ou acesso indevido (P1)

1. **Conter:** encerrar sessões dos envolvidos, suspender contas, desligar o módulo afetado em **Módulos e ondas**, rotacionar segredos se houver indício (Supabase keys, `DATABASE_URL`, `CRON_SECRET`).
2. **Preservar:** exportar o Dedo-duro do período (CSV), anotar horários; não apagar registros.
3. **Avaliar:** quais titulares, quais dados (atenção a menores), por quanto tempo.
4. **Comunicar:** o encarregado de dados (docs/PRIVACIDADE.md) avalia risco relevante. Se houver, comunicar a ANPD e os titulares em **até 3 dias úteis** (Resolução CD/ANPD nº 15/2024).
5. **Registrar:** formulário de incidente (docs/PRIVACIDADE.md §5), mesmo quando não houver comunicação.

## 7. Suporte privilegiado

Acesso de administrador para suporte é temporário: conceder o perfil, registrar o motivo e o protocolo, e retirar ao encerrar. Tudo fica no Dedo-duro.
