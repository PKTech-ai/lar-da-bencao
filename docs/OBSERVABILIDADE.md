# Observabilidade e alertas (RNF-008 · BL-060)

## Health check

`GET /api/health` (público, sem dados internos):

| Resposta | Significado | HTTP |
|---|---|---|
| `ok` | banco acessível, esquema na versão do código, integridade verificada nas últimas 36 h | 200 |
| `degraded` | migração pendente (`schema: false`) ou cron de integridade atrasado em produção (`integrity: false`) | 503 |
| `unavailable` | banco inacessível | 503 |

## Alertas a configurar (produção)

- [ ] Monitor externo (ex.: Better Stack, UptimeRobot, Vercel Checks) em `/api/health` a cada 5 min → alerta por e-mail/WhatsApp do responsável técnico quando ≠ 200 por 2 checagens.
- [ ] Vercel → Cron Jobs: `/api/maintenance/integrity` diário (07:15 UTC); o health acusa atraso.
- [ ] Vercel → Logs/Observability: alerta para taxa de 5xx > 2% em 10 min.
- [ ] Supabase → Reports: conexões, CPU e tamanho do banco (anexos crescem rápido).
- [ ] Dedo-duro: revisar semanalmente “Falha de login”, “Login bloqueado”, “Anexo bloqueado pela inspeção”, “Falha …”.

## Domínio e borda

- [ ] `APP_URL=https://sistema.lardabencao.org`; `proxy.ts` redireciona outros hosts em produção.
- [ ] Vercel Firewall: regra de rate limit (docs/SECURITY_AUTH.md §3).
- [ ] HTTPS obrigatório (o app recusa `APP_URL` e scanner sem HTTPS em produção).

## Teste do alerta

Com o monitor configurado, publique um deploy com `DATABASE_URL` inválida **fora do horário de uso** (ou pause o monitor e simule no ambiente local): o health responde 503 e o alerta precisa chegar. Registre o resultado.
