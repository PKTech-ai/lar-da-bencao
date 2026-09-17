# Go-live — portas de entrada dos dados reais

Cada linha abaixo é uma porta: enquanto uma delas estiver aberta, o sistema continua **só com dados sintéticos**. A coluna “Quem faz” separa o que é código (já entregue) do que depende de decisão, contrato ou execução de vocês.

## 1. Antes de qualquer dado real

| Porta | Quem faz | Como comprovar |
|---|---|---|
| Migrações aplicadas na base de produção | Administrador do sistema | `scripts/migrate.sh --dry-run` sem pendências |
| Supabase Auth configurado (signup fechado, MFA, limites, templates, sessões) | Administrador do sistema | Prints das telas — checklist em `docs/SECURITY_AUTH.md` |
| **PITR / backup contínuo ligado** | Responsável pela conta Supabase (plano Pro) | Print da tela de Backups + `docs/BACKUP_RESTORE.md` §1 |
| **Restauração testada** (amostral) | Administrador do sistema | Registro preenchido em `docs/BACKUP_RESTORE.md` §5 |
| **Scanner antimalware HTTPS contratado** (`ANTIMALWARE_API_URL`) | Diretoria (contratação) + Administrador (configuração) | Upload de teste EICAR indo para quarentena |
| **Alertas de monitoramento** (health, erro 5xx, cron, fila de e-mail) | Administrador do sistema | `docs/OBSERVABILIDADE.md` §2 e teste do alerta §4 |
| **Aviso de privacidade publicado e encarregado nomeado** | Diretoria | `docs/PRIVACIDADE.md` §1 e §6 assinados em ata |
| **Termo de uso aceito pela primeira leva de usuários** | Cada pessoa, no primeiro acesso | Dedo-duro: evento de aceite por usuário |
| **Teste de invasão / revisão externa** (recomendado antes de dados sensíveis) | Diretoria (contratação) | Relatório arquivado + itens críticos corrigidos |
| **UAT da fundação e da onda 1** | Donos dos módulos | `docs/UAT_ONDA1.md` preenchido |
| **UAT das ondas 2 e 3** | Donos dos módulos | `docs/UAT_ONDAS_2_3.md` preenchido |
| **Site estático v215 despublicado** | Quem hospeda o HTML hoje | URL antiga fora do ar (ou com aviso de sistema novo) |

## 2. Configuração institucional (uma vez, pelo Administrador)

1. `/sistema/instituicao` — nome, fundação, CNPJ, endereço e contatos.
2. `/sistema/acesso` → **Biênios** — biênio vigente **antes** de criar as contas da Diretoria.
3. `/sistema/usuarios` — cada conta com perfil, departamentos, biênio (cargos da Diretoria) e ficha de trabalhador.
4. `/sistema/acesso` → **Matriz** — conferir o padrão por perfil; registrar exceções só onde a Casa decidir diferente.
5. `/sistema/modulos` — liberar um módulo por vez, com a referência do UAT.

## 3. Ordem sugerida de liberação

1. Fundação (já ligada) → acesso, anexos, Dedo-duro.
2. Onda 1: Trabalhadores, Doutrina, Infância, Juventude, Documentos.
3. Onda 2: Patrimônio, Assistência, Eventos, Divulgação, Secretaria, Presidência.
4. Onda 3: Tesouraria → Conselho Fiscal (depende do envio mensal) → Jurídico → WhatsApp.

A cada liberação: uma semana de uso acompanhado, com o Dedo-duro revisado no fim da semana.

## 4. Plano de volta atrás

- **Módulo com problema:** desligar em `/sistema/modulos` (efeito imediato, dados preservados).
- **Importação v215 equivocada:** `Importação v215 → Reverter` (remove só o que aquela importação criou).
- **Erro de dados pontual:** corrigir no próprio módulo — nada é apagado de verdade; arquivamento e estorno ficam no histórico.
- **Incidente de segurança:** `docs/RUNBOOKS.md` §6, com encerramento de sessões e rotação de segredos.

## 5. O que o sistema **não** faz (combinado com a Casa)

- Não envia mensagem de WhatsApp sozinho: abre a conversa e registra o envio.
- Não lê extrato em PDF: só OFX e CSV (o PDF pode ficar anexado).
- Não gera ata sozinho: a minuta é escrita por quem secretaria; o sistema guarda áudio e transcrição.
- Não guarda dado de negócio no navegador: tudo fica no PostgreSQL, com auditoria.
