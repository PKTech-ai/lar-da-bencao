# Privacidade e proteção de dados (RF-013 · BL-061) — RASCUNHO PARA APROVAÇÃO

> Documento técnico de apoio. **Não substitui parecer jurídico.** Bases legais, prazos e responsáveis precisam ser validados e aprovados pela Diretoria antes do uso com dados reais.

## 1. Papéis

| Papel | Quem | Situação |
|---|---|---|
| Controlador | Centro Espírita Filantrópico Lar da Bênção | — |
| Encarregado (canal do titular) | *a definir pela Diretoria* | ☐ |
| Operadores | Vercel (hospedagem), Supabase (banco/Auth), fornecedor do scanner | ☐ contratos/termos revisados |

## 2. Inventário de dados (onda 1)

| Categoria | Onde | Finalidade | Base legal proposta | Retenção proposta | Quem acessa |
|---|---|---|---|---|---|
| Contas de usuários (nome, e-mail, perfil) | `app.users`, Supabase Auth | Acesso individual e auditoria | Legítimo interesse / execução das atividades | Enquanto vinculado + 5 anos (segurança) | Administrador |
| Ficha de trabalhador (contato, nascimento, endereço, profissão, termos de voluntariado e imagem) | `app.workers`, decisões | Admissão e organização do voluntariado (Lei 9.608/98) | Termo de voluntariado / legítimo interesse | Enquanto voluntário + 5 anos | Departamentos vinculados, Secretaria, Presidência |
| Evangelizandos — **crianças e adolescentes** (nome, nascimento, responsáveis, contatos, endereço, foto, religião) | `app.evangelizandos`, fotos em anexos | Evangelização, chamada, segurança das crianças | Consentimento específico de pelo menos um responsável (art. 14 LGPD) — **validar** | Matrícula vigente + 2 anos; foto removida ao encerrar | Coordenação do departamento; evangelizador só da própria turma |
| Frequência (P/F) e cronograma | `app.evangelizando_attendance`, `app.education_schedule` | Acompanhamento pedagógico e relatório anual | Mesma dos evangelizandos | 5 anos (relatório anual) | Departamento |
| Palestrantes externos (nome, casa, cidade, contato) | `app.speakers` | Escala de palestras | Legítimo interesse | Enquanto ativo + 2 anos | Doutrina |
| Tentativas de login (hash de e-mail/IP) | `app.auth_attempts` | Segurança | Legítimo interesse | 2 dias (expurgo automático) | Ninguém pela interface |
| Dedo-duro (ator, ação, IP mascarado, navegador) | `app.audit_events` | Segurança e prestação de contas | Legítimo interesse / obrigação | 5 anos para segurança (PRD §8) | Administrador, Auditoria, Presidência |

## 3. Controles já implementados

- Login individual com MFA obrigatório; bloqueio de tentativas; revogação de sessões.
- Autorização no servidor por perfil e departamento; o evangelizador vê só as próprias turmas.
- Dados só no PostgreSQL da produção; local e CI usam dados sintéticos; importação recusa o pacote de demonstração em produção.
- Anexos privados, inspecionados e baixados só por quem pode ler o registro; downloads auditados.
- Dedo-duro append-only com cadeia de hash; IP mascarado.
- Termos aceitos no primeiro acesso (versão registrada).
- Exclusão definitiva de ficha de evangelizando (com a frequência) pela coordenação, auditada.

## 4. Atendimento ao titular

1. Canal: *e-mail institucional a definir* (publicar no aviso de privacidade e nos termos).
2. Confirmar a identidade (ou a responsabilidade legal, no caso de menores).
3. Prazo de resposta: até 15 dias (art. 19, II LGPD).
4. Acesso/cópia: gerar a partir das telas (ficha, impressão) e registrar no Dedo-duro.
5. Correção: editar o cadastro (auditado).
6. Eliminação: ficha de evangelizando → “Excluir ficha”; trabalhador → inativar e, após o prazo de retenção, eliminar pelo suporte técnico com registro.
7. Registrar a solicitação (data, pedido, resposta, responsável).

## 5. Registro de incidente

| Campo | Conteúdo |
|---|---|
| Data/hora da ciência | |
| Descrição e dados afetados | |
| Titulares afetados (há menores?) | |
| Medidas de contenção | |
| Avaliação de risco relevante | |
| Comunicação ANPD/titulares (até 3 dias úteis) | ☐ sim ☐ não — justificativa |
| Responsáveis | |

Procedimento operacional: docs/RUNBOOKS.md §6.

## 6. Pendências para aprovação

- [ ] Encarregado e canal do titular definidos
- [ ] Bases legais validadas (especialmente crianças/adolescentes e fotos)
- [ ] Prazos de retenção aprovados → implementar expurgo automático
- [ ] Texto dos termos (`/termos`) e do aviso de privacidade revisados
- [ ] Contratos/termos dos operadores revisados
