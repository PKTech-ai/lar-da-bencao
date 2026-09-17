# Autenticação: controles e configuração obrigatória

Registro dos controles de identidade da v216 e da configuração que precisa estar ativa no Supabase Auth antes de receber dados reais. Guarde um print de cada tela do Dashboard como evidência do go-live.

## 1. Controles da aplicação

| Controle | Onde | Comportamento |
|---|---|---|
| Login por senha no servidor | `POST /api/auth/login` | Todo login da tela passa por aqui. |
| Limite por e-mail | `lib/login-throttle.ts` | 5 falhas/15 min → espera de 15 min; 10/60 min → 60 min; 20/24 h → 24 h. Um login correto zera o contador do e-mail. |
| Limite por IP | idem | 20 falhas/15 min → 15 min; 60/60 min → 60 min. Um login correto **não** zera o contador do IP. |
| Sem enumeração | idem e `/recuperar` | Mesma mensagem e status para conta inexistente e senha errada; o bloqueio vale também para e-mails inexistentes. A recuperação responde sempre “se o e-mail estiver cadastrado…”. |
| Privacidade das tentativas | `app.auth_attempts` | Só HMAC do e-mail e do IP; expurgo após 2 dias pelo cron `/api/maintenance/integrity`. |
| Dedo-duro | `app.audit_events` | “Falha de login” (`failed`) e “Login bloqueado por excesso de tentativas” (`denied`), com e-mail mascarado (`a***@dominio`). |
| Códigos de recuperação MFA | `/api/mfa/recovery-codes` | 5 falhas/15 min por usuário → 429. |
| Revogação de sessão | `app.users.sessions_valid_after` + `app.revoke_auth_sessions` | Corte imediato na aplicação e remoção das sessões no Auth. |

**Limitação conhecida:** a chave publicável permite chamar a API do Supabase Auth direto, sem passar pela aplicação. Contra esse caminho valem apenas os limites do próprio Supabase (seção 2), por isso eles são obrigatórios.

## 2. Supabase Dashboard (produção e dev)

**Authentication → Sign In / Providers**
- [ ] “Allow new users to sign up” **desligado** (somente convite)
- [ ] Confirm email ligado
- [ ] Senha: mínimo 10 caracteres; exigir letras minúsculas, maiúsculas, dígitos e símbolos
- [ ] “Prevent use of leaked passwords” ligado (se disponível no plano)

**Authentication → Multi-Factor**
- [ ] TOTP habilitado (enroll + verify)

**Authentication → Rate Limits** (valores máximos recomendados para ~20 usuários)
- [ ] Sign-ups and sign-ins: **10 por 5 minutos por IP**
- [ ] Token refreshes: padrão (150/5 min)
- [ ] Token verifications (OTP/MFA): **10 por 5 minutos por IP**
- [ ] E-mails enviados: padrão do SMTP institucional (ex.: 30/h)

**Authentication → Attack Protection**
- [ ] CAPTCHA (Cloudflare Turnstile) — recomendado se houver tentativas diretas na API; exige ajustar o login para enviar o token

**Authentication → Sessions**
- [ ] Time-box de sessão: 12 h
- [ ] Inactivity timeout: 2 h
- [ ] “Single session per user”: opcional (desligado por padrão)

**Authentication → URL Configuration**
- [ ] Site URL = `APP_URL`
- [ ] Redirect URLs = somente `APP_URL/auth/callback`

## 3. Vercel (borda)

- [ ] Firewall → regra de rate limit para `POST /api/auth/login` e `PUT /api/mfa/recovery-codes`: 30 requisições/min por IP → bloqueio de 10 min
- [ ] Attack Challenge Mode disponível para incidentes

## 4. Verificação

```bash
# 6 tentativas com senha errada: a 6ª deve responder 429 com Retry-After
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$APP_URL/api/auth/login" \
    -H "Origin: $APP_URL" -H "Content-Type: application/json" \
    -d '{"email":"teste-sintetico@exemplo.org","password":"errada"}'
done
```

Depois confira no Dedo-duro os eventos “Falha de login” e “Login bloqueado por excesso de tentativas”.
