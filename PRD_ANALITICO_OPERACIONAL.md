# PRD Analítico — Operacionalização do Sistema Lar da Bênção

**Versão do documento:** 1.1
**Data da análise:** 15/09/2026
**Produto analisado:** Sistema Lar da Bênção v215 — Visual acolhedor
**Status do produto:** protótipo funcional avançado, ainda não apto para produção institucional multiusuário
**Infraestrutura definida:** Vercel, com somente um ambiente hospedado de produção
**Responsável pela decisão de go-live:** Diretoria do Lar da Bênção, com aceite técnico e validação de privacidade

---

## 1. Resumo executivo

A versão 215 possui cobertura funcional ampla, interface responsiva, impressão, cadastros, fluxos administrativos, permissões simuladas, trilha de auditoria local e backup completo manual. A verificação automatizada atual passou nos cenários de navegação, layout, salvamento, frequência, acesso visual e impressão.

Entretanto, o sistema ainda funciona como um arquivo HTML estático, com dados principais no `localStorage` e anexos no `IndexedDB` do navegador. Cada navegador mantém sua própria cópia. Não há banco de dados central, autenticação real, autorização validada em servidor, recuperação segura de acesso, observabilidade, rotina automática de backup externo nem processo operacional de suporte. A própria interface identifica o controle de acesso como demonstrativo.

As decisões complementares deste documento são: autenticação real com MFA; autorização aplicada no servidor; banco relacional central; anexos binários guardados no próprio banco; evolução do “Dedo-duro” atual para auditoria protegida; apenas um ambiente hospedado de produção; e execução da aplicação na Vercel.

**Decisão recomendada:** não cadastrar dados reais de trabalhadores, crianças, famílias atendidas, mantenedores, movimentações financeiras ou documentos jurídicos na hospedagem atual. O endereço de teste existente é um legado temporário e deve ser retirado quando a produção Vercel for ativada; ele não fará parte da arquitetura final de ambiente único.

**Objetivo deste PRD:** transformar o protótipo em uma aplicação web institucional, multiusuário, segura e recuperável, preservando os fluxos já validados.

### 1.1 Decisões de arquitetura já confirmadas

| Tema | Decisão confirmada | Consequência no produto |
|---|---|---|
| Autenticação | Login real com MFA | O seletor de usuário demonstrativo será removido da produção |
| Permissões | Validação obrigatória no servidor | A interface continuará ocultando ações, mas a API será a autoridade final |
| Dados | Banco PostgreSQL central compartilhado | Todos os aparelhos utilizarão uma única fonte de verdade |
| Anexos | Conteúdo binário no próprio PostgreSQL | Upload e download serão fracionados/streamados por causa dos limites das Vercel Functions |
| Auditoria | Aproveitar a experiência do “Dedo-duro” atual | A tela será preservada, mas os eventos serão emitidos e protegidos no backend |
| Ambientes | Somente produção hospedada | Desenvolvimento e testes ocorrerão localmente e na CI, sem base hospedada de homologação |
| Hospedagem | Vercel | Frontend e API usarão Vercel; o PostgreSQL será conectado por integração compatível |

### Diagnóstico em uma frase

As telas estão maduras; faltam a fundação de produção e o processo operacional.

### Índice indicativo de prontidão

| Dimensão | Peso | Situação observada | Nota ponderada |
|---|---:|---|---:|
| Cobertura funcional | 15 | Ampla, com 16 áreas principais e dezenas de fluxos | 13 |
| Experiência e responsividade | 10 | Testada em celular, tablet e computador | 8 |
| Dados compartilhados | 20 | Somente armazenamento local por navegador | 4 |
| Identidade e segurança | 20 | Permissão apenas na interface; sem login real | 2 |
| Continuidade e recuperação | 15 | Backup manual local; sem cópia externa automática | 5 |
| Operação e observabilidade | 10 | Sem saúde, métricas, alertas ou suporte formal | 1 |
| Privacidade e governança | 10 | Requisitos e documentos ainda não formalizados | 2 |
| **Total indicativo** | **100** | **Bom protótipo; produção bloqueada** | **35/100** |

Esta nota não é certificação. Ela serve apenas para tornar visível a diferença entre “funciona na demonstração” e “pode operar com dados reais”.

---

## 2. Evidências da auditoria

### 2.1 O que já existe

- Versão 215 publicada como site estático e organizada no repositório privado.
- Um único `dist/index.html` independente, com aproximadamente 24,7 MB.
- Interface adaptada para celular, tablet e computador.
- Navegação por perfis e departamentos.
- Cadastros, planejamentos, frequências, escalas, aprovações, atas, relatórios, impressões e anexos.
- Diário local para proteger edições entre abas do mesmo navegador e mostrar conflitos.
- Rascunhos e salvamento automático para fluxos compatíveis.
- Backup completo manual em ZIP, incluindo dados e anexos, com verificação de integridade e restauração.
- Histórico/auditoria limitado a 3.000 ocorrências e armazenado junto dos dados locais.
- Integração opcional de WhatsApp dependente de um serviço externo informado manualmente.
- Testes automatizados da v214 e v215 com evidências positivas para os principais fluxos locais.

### 2.2 Evidências técnicas que bloqueiam produção

| Evidência | Impacto operacional |
|---|---|
| O README declara que aparelhos e navegadores diferentes não compartilham uma base central | Dois usuários podem criar versões divergentes da realidade |
| Dados no `localStorage` e anexos no `IndexedDB` | Limpeza do navegador, troca de aparelho ou falha local pode tornar dados indisponíveis |
| “Controle de Acesso” altera o usuário corrente dentro do próprio HTML | Não comprova identidade e não impede acesso por quem obtiver o arquivo ou o navegador aberto |
| Regras de permissão executadas somente em JavaScript no cliente | Um usuário técnico pode contornar a interface; não existe barreira de servidor |
| Site estático sem API de negócio | Não há transação central, concorrência entre aparelhos ou fonte única de verdade |
| Histórico salvo no mesmo objeto local editável | Não constitui trilha de auditoria inviolável |
| Backup depende de ação manual e armazenamento escolhido pelo usuário | RPO e RTO não são controlados pela instituição |
| Manual entregue é da v213, enquanto o sistema está na v215 | Procedimento operacional e produto estão fora de sincronia |
| A página inicia com dados demonstrativos e oferece restaurá-los | Há risco de mistura entre dados fictícios e reais |
| Não foram encontrados health check, telemetria, captura global de erros ou alertas | Falhas podem permanecer invisíveis até um usuário reclamar |

### 2.3 Resultado da verificação executada em 15/09/2026

O `theme-215/verify.cjs` foi executado contra a versão atual e concluiu sem erros:

- scripts válidos;
- identidade visual e “Minha área” funcionais;
- ausência de transbordamento em cinco tamanhos de tela;
- busca e navegação móvel funcionais;
- formulário com salvamento preservado;
- frequência com soma e salvamento automático;
- controle de acesso oculto para perfil não administrador;
- três amostras de impressão sem corte horizontal.

Este resultado valida a camada de apresentação e os fluxos locais selecionados. Ele não valida autenticação, banco central, segurança de API, restauração de infraestrutura, concorrência entre dispositivos ou operação em produção, pois essas camadas ainda não existem.

---

## 3. Problema do produto

O Lar da Bênção precisa coordenar rotinas administrativas, doutrinárias, sociais, financeiras, patrimoniais, jurídicas e de eventos. Hoje, o protótipo reúne essas rotinas em uma interface única, mas cada navegador é uma ilha de dados. Isso impede:

1. colaboração simultânea confiável;
2. acesso seguro por identidade individual;
3. continuidade em caso de perda ou troca do aparelho;
4. responsabilização auditável de ações sensíveis;
5. suporte e diagnóstico proativos;
6. uso legítimo e controlado de dados pessoais reais.

Sem resolver essas seis condições, “publicar o HTML” não equivale a colocar o sistema em operação.

---

## 4. Objetivos e métricas de sucesso

### 4.1 Objetivo principal

Disponibilizar uma fonte única de verdade, acessível pela internet a usuários autorizados, com segurança, rastreabilidade, recuperação e paridade funcional suficiente para substituir os controles manuais definidos para o MVP.

### 4.2 Resultados esperados nos primeiros 90 dias

| Resultado | Métrica | Meta |
|---|---|---:|
| Adoção | Usuários ativos autorizados que concluem ao menos uma tarefa/mês | ≥ 80% |
| Integridade | Registros confirmados perdidos | 0 |
| Confiabilidade | Operações de escrita concluídas sem erro | ≥ 99,5% |
| Desempenho | p95 das operações comuns em conexão estável | ≤ 2 s |
| Recuperação | Teste de restauração integral aprovado | 100% antes do go-live e mensal no piloto |
| Segurança | Ações sensíveis com usuário, data, origem e resultado auditados | 100% |
| Suporte | Incidentes críticos reconhecidos | ≤ 30 min no horário de operação acordado |
| Qualidade | Fluxos críticos aprovados em UAT | 100% |

### 4.3 Não objetivos do MVP

- substituir um sistema contábil ou bancário oficial;
- movimentar dinheiro ou autorizar transações bancárias;
- oferecer prontuário médico;
- operar sem internet com sincronização completa;
- criar aplicativo nativo para Android ou iOS;
- redesenhar novamente todos os módulos já aprovados;
- automatizar decisões estatutárias que exigem deliberação humana.

---

## 5. Usuários e papéis

Os perfis atuais devem ser preservados como ponto de partida, mas sua autorização passará a ser aplicada no servidor.

| Papel | Necessidade principal | Acesso esperado |
|---|---|---|
| Administrador do sistema | Gerir contas, perfis, módulos, backups e parâmetros | Administração técnica, sem necessidade de editar o conteúdo de todos os departamentos por padrão |
| Presidente | Consultar a instituição, decidir admissões e baixas, acompanhar módulos | Presidência e consultas definidas pelo estatuto |
| Vice-presidente | Consulta ampla e atuação delegada | Leitura ou edição conforme matriz aprovada |
| Secretaria/subsecretaria | Reuniões, atas, cadastros e admissões | Secretaria e fluxos relacionados |
| Tesouraria | Caixa, contribuições, extratos, comprovantes e relatórios | Tesouraria com ações sensíveis reforçadas |
| Conselho Fiscal | Conferir competências, comprovantes e emitir parecer | Consulta financeira e registro de parecer |
| Coordenador/subcoordenador | Operar seu departamento | Edição no departamento vinculado |
| Evangelizador/trabalhador | Consultar sua área, escalas e cadastros permitidos | Escopo mínimo por vínculo |
| Brechó/Clube de Mães | Operar o respectivo setor social | Edição restrita ao setor |
| Auditor/consulta | Fiscalizar sem alterar | Somente leitura e exportação autorizada |

**Regra:** “administrador técnico” e “dono dos dados” devem ser conceitos separados. Privilégio técnico não deve conceder automaticamente acesso irrestrito a dados pessoais sensíveis.

---

## 6. Escopo funcional do MVP

### 6.1 Módulos que devem permanecer disponíveis

1. Visão Geral e Minha Área.
2. Estatuto, Regimento e Organograma.
3. Controle de Acesso, usuários, perfis, matriz, biênio e auditoria.
4. Presidência e aprovação de trabalhadores.
5. Secretaria, reuniões, gravações autorizadas e atas.
6. Tesouraria, contribuições, caixa, extratos, conciliação, comprovantes e fechamento.
7. Conselho Fiscal, análise, parecer e histórico.
8. Doutrina, trabalhadores, palestrantes, biblioteca, escalas, frequência, Culto no Lar, treinamentos e Caravana no Lar.
9. Infância e Juventude, evangelizandos, evangelizadores, frequência, cronograma, planejamento e relatório anual.
10. Assistência e Promoção Social, rancho, doações, entregas, voluntários, mantenedores, atividades, Brechó e Clube de Mães.
11. Patrimônio, bens, anexos, baixa autorizada e escala de limpeza.
12. Eventos, agenda, itens, avaliação e escala de trabalho.
13. Divulgação, solicitações e Livraria.
14. Jurídico, eleições e documentos para cartório.
15. Sugestões e melhorias.
16. Relatórios, impressão e exportações existentes.

### 6.2 Estratégia de corte

O MVP operacional não precisa migrar todos os fluxos no mesmo dia. O go-live deve ocorrer por ondas:

- **Onda 1:** identidade, acesso, cadastros-base, Doutrina, Infância/Juventude, agendas e escalas.
- **Onda 2:** Assistência Social, Patrimônio, Eventos, Divulgação e Secretaria.
- **Onda 3:** Tesouraria, Conselho Fiscal, Jurídico, anexos sensíveis e WhatsApp.

Tesouraria e dados de crianças/famílias só entram após as portas de segurança, backup e privacidade estarem aprovadas.

---

## 7. Requisitos funcionais

### RF-001 — Autenticação real — P0

O sistema deve possuir contas individuais, login, encerramento de sessão, recuperação de acesso e bloqueio de contas.

**Solução definida:** a Vercel hospedará a aplicação, mas não substituirá a autenticação do produto. A aplicação deve integrar um provedor de identidade compatível com OpenID Connect/OAuth 2.0 e MFA, evitando implementar internamente senha, recuperação e segundo fator. A tabela local de usuários continuará existindo no PostgreSQL como perfil institucional e será vinculada ao identificador imutável fornecido pelo provedor de identidade.

**Critérios de aceite:**

- nenhum módulo protegido é entregue antes da autenticação;
- senhas nunca são armazenadas em texto puro;
- sessões expiram e podem ser revogadas;
- recuperação de acesso exige canal previamente verificado;
- MFA é obrigatório para todos os usuários; inicialmente TOTP por aplicativo autenticador, com códigos de recuperação de uso único;
- e-mail/SMS, caso usados como recuperação, não substituem o segundo fator nas ações críticas;
- cada conta possui identidade individual; contas genéricas ou compartilhadas são proibidas;
- a primeira autenticação exige ativação do MFA e confirmação dos termos aplicáveis;
- alteração ou remoção do MFA exige nova autenticação, gera auditoria e notificação ao titular da conta;
- administrador pode revogar sessões e iniciar recuperação, mas não visualizar senha, segredo TOTP ou código de recuperação;
- cookies de sessão são `Secure`, `HttpOnly`, `SameSite=Lax` ou mais restritivo, têm rotação e proteção contra fixação;
- tentativas abusivas sofrem limitação e bloqueio progressivo;
- a troca de perfil demonstrativa não existe em produção.

**Jornadas mínimas:** convite de usuário, primeiro acesso, ativação de MFA, login recorrente, recuperação, troca de aparelho autenticador, revogação administrativa, suspensão e encerramento de todas as sessões.

### RF-002 — Autorização no servidor — P0

Todas as leituras, inclusões, alterações, exclusões, downloads e relatórios devem ser autorizados no backend conforme papel, departamento, setor, biênio e situação da conta.

**Modelo definido:** RBAC com escopo institucional. O papel define a capacidade-base; departamento, setor, biênio, vínculo com a pessoa e situação da conta restringem o conjunto de registros. A matriz atual será migrada para tabelas versionadas no PostgreSQL. O frontend poderá consultar as capacidades efetivas para montar a tela, porém não poderá concedê-las.

**Critérios de aceite:**

- esconder um botão não é considerado controle de acesso;
- chamadas diretas à API sem permissão retornam `403`;
- chamadas sem sessão válida retornam `401` sem revelar a existência do registro;
- cada consulta retorna apenas os registros do escopo permitido;
- toda rota declara recurso e ação: `read`, `create`, `update`, `delete`, `approve`, `export`, `print`, `download` ou `admin`;
- filtros de escopo são aplicados antes da consulta ao dado, e não depois de carregá-lo;
- downloads e geração de relatórios repetem a autorização no momento da execução;
- alterações na matriz produzem auditoria e entram em vigor sem republicar o frontend;
- mudanças de perfil revogam sessões ou renovam imediatamente as capacidades da sessão;
- o sistema impede a remoção do último administrador habilitado, mas permite recuperação controlada de emergência;
- testes automáticos cobrem a matriz positiva e negativa de todos os papéis, módulos e ações sensíveis.

### RF-003 — Banco de dados central e transacional — P0

Cadastros e movimentos devem ser persistidos em banco central com identificadores estáveis, restrições, transações e controle de concorrência.

**Solução definida:** PostgreSQL gerenciado conectado à aplicação Vercel por integração do Marketplace ou conexão externa equivalente. A região das Vercel Functions deve ficar próxima da região do banco. O acesso usa TLS, credencial exclusiva de produção, pool compatível com execução serverless e usuário de banco sem privilégios de proprietário para a aplicação.

**Critérios de aceite:**

- dois aparelhos veem a mesma alteração após confirmação;
- edição concorrente nunca sobrescreve silenciosamente outra edição;
- exclusões de negócio são lógicas quando houver obrigação de histórico;
- valores financeiros usam unidade inteira de centavos;
- datas institucionais têm fuso e regras explícitos;
- escrita e auditoria sensível pertencem à mesma transação;
- cada entidade possui `created_at`, `created_by`, `updated_at`, `updated_by` e versão de concorrência quando aplicável;
- migrações são numeradas, repetíveis em banco vazio e executadas antes da ativação da versão;
- conexões possuem timeout, limite e liberação correta ao suspender uma Vercel Function;
- não há dependência de memória da Function para sessão, lock, fila ou estado compartilhado;
- consultas sensíveis usam parâmetros e nunca concatenam entrada do usuário em SQL.

### RF-004 — Anexos binários no próprio banco — P0

Fotos, PDFs, comprovantes, áudios e demais anexos devem sair do `IndexedDB` e ser armazenados no mesmo PostgreSQL central. Não será utilizado object storage como repositório primário.

**Modelo definido:**

- tabela `attachments` para metadados, vínculo lógico, situação e integridade;
- tabela `attachment_chunks` para conteúdo `BYTEA`, numerado e imutável;
- chunks binários de até 3 MiB, enviados como `multipart/form-data`, sem Base64;
- hash SHA-256 por chunk e do arquivo completo;
- situação `uploading`, `pending_scan`, `active`, `quarantined` ou `deleted`;
- associação ao registro de negócio somente após tamanho, quantidade de chunks, hash e inspeção serem confirmados.

O fracionamento é obrigatório porque Vercel Functions possuem limite de 4,5 MB por corpo de requisição/resposta. O arquivo atual aceita anexos de até 15 MB e extratos de até 20 MB; esses limites podem ser preservados usando múltiplas requisições menores e download em streaming.

**Critérios de aceite:**

- nenhum anexo possui URL pública ou caminho direto no banco;
- upload cria identificador opaco e token temporário vinculado ao usuário, finalidade e registro;
- cada chunk é aceito uma única vez e suporta retomada sem duplicação;
- validação de extensão, MIME real, tamanho e assinatura do arquivo;
- varredura antimalware antes de disponibilizar download;
- hash de integridade e metadados auditáveis;
- criptografia em trânsito e em repouso;
- download verifica sessão e permissão, registra a ação e transmite os chunks por `ReadableStream` sem montar o arquivo inteiro em memória;
- retenção, retirada de vínculo e eliminação seguem a política de dados;
- retirada de vínculo não apaga imediatamente o binário quando houver retenção legal ou histórico;
- binários órfãos/incompletos são removidos por rotina após 24 horas;
- o tamanho máximo é 15 MB para anexos comuns e 20 MB para extratos, salvo decisão posterior baseada em capacidade/custo;
- backup do PostgreSQL inclui metadados e binários de forma consistente;
- restauração comprova quantidade, tamanho e SHA-256 dos anexos.

**Campos mínimos de `attachments`:** `id`, `owner_type`, `owner_id`, `filename`, `mime_type`, `size_bytes`, `sha256`, `chunk_count`, `status`, `uploaded_by`, `uploaded_at`, `activated_at`, `removed_at`, `retention_until` e `scan_result`.

**Risco aceito pela decisão:** arquivos binários aumentam rapidamente o banco, o tempo/custo de backup, replicação e restauração. Antes do go-live deve ser executado teste de volume com pelo menos duas vezes a projeção de 12 meses. Se o teste reprovar RPO, RTO, custo ou desempenho, a Diretoria deverá rever formalmente a decisão de guardar os binários no PostgreSQL.

### RF-005 — Migração dos dados locais — P0

O sistema deve importar o backup completo ZIP da v215 para a base central por um assistente de migração.

**Critérios de aceite:**

- modo de simulação informa quantidades, duplicidades, campos inválidos e anexos ausentes;
- dados fictícios podem ser descartados explicitamente;
- nenhum registro é criado se a validação integral falhar;
- repetição da mesma importação é idempotente;
- relatório final compara origem e destino por tipo de registro e hash de anexo;
- pacote original e relatório ficam preservados no banco em área administrativa restrita durante o período aprovado;
- rollback é testado antes da primeira migração real.

### RF-006 — “Dedo-duro” como auditoria protegida — P0

O sistema deve preservar a experiência do “Dedo-duro — Histórico de Atividades” já existente e substituir sua fonte local por uma trilha de eventos de servidor, separada dos registros de negócio e sem comandos de edição ou exclusão para usuários da aplicação.

#### Análise do recurso atual

**Pontos fortes a preservar:**

- tela administrativa dedicada;
- data/hora, usuário, perfil, tipo, módulo, seção/registro e detalhes;
- categorias Acesso, Inclusão, Edição, Exclusão, Impressão e Segurança;
- pesquisa textual e filtros por usuário, categoria, módulo e período;
- indicadores de quantidade;
- impressão e exportação CSV;
- cuidado explícito para não registrar senhas nem o conteúdo digitado nos campos;
- registros específicos em fluxos relevantes, incluindo acesso, permissões, biênio, aprovações, Tesouraria, Social, Patrimônio, Eventos e Jurídico.

**Limitações que devem ser corrigidas:**

- o histórico atual está no mesmo objeto `localStorage` dos demais dados e pode ser alterado ou apagado;
- identidade e horário são informados pelo navegador e não são confiáveis;
- há retenção técnica de apenas 3.000 ocorrências por uso de `.slice(0,3000)`;
- o capturador genérico registra alguns cliques ou mudanças de campo, mesmo quando a operação final falha ou é cancelada;
- listas extensas de exceções deixam cobertura difícil de manter;
- classificação por palavras do botão pode gerar categoria incorreta;
- eventos não têm ID imutável, request ID, session ID, resultado, código de erro, IP resumido, user agent ou versão da aplicação;
- alguns detalhes contêm nomes/descrições e precisam de minimização e controle de acesso;
- CSV gerado no cliente não garante cadeia de custódia nem registra necessariamente a própria exportação.

#### Modelo de auditoria do servidor

Cada evento deve ser criado pelo backend depois de autenticar e autorizar a requisição. Operações de negócio devem gravar a mudança e o evento na mesma transação. Tentativas negadas e falhas técnicas devem ser gravadas de forma independente quando a transação principal não puder ser confirmada.

**Campos mínimos de `audit_events`:**

- `id` UUID imutável;
- `occurred_at` gerado no servidor em UTC;
- `actor_user_id` e identificador do provedor de identidade;
- `actor_name_snapshot` e `role_snapshot`;
- `session_id`, `request_id` e `app_version`;
- `category`, `action`, `module`, `section`;
- `entity_type` e `entity_id`;
- `result`: `success`, `denied`, `failed` ou `cancelled` quando detectável;
- `reason_code` e mensagem segura;
- IP truncado ou transformado conforme política de privacidade;
- resumo do user agent/dispositivo;
- `before_json` e `after_json` somente para campos aprovados, com mascaramento;
- `metadata_json` validado por esquema;
- `previous_hash` e `event_hash` para evidenciar quebra da sequência.

**Critérios de aceite:**

- evento contém usuário autenticado, instante do servidor, ação, entidade, identificador, resultado e contexto técnico mínimo;
- dados secretos e conteúdo de senha nunca entram no log;
- alterações sensíveis registram antes/depois com mascaramento quando necessário;
- exportação e download de dados sensíveis também são auditados;
- retenção da auditoria é configurada por política, não por limite arbitrário de 3.000 itens;
- nenhum papel da aplicação possui `UPDATE` ou `DELETE` na tabela de auditoria;
- inserção ocorre por função de banco/API controlada e não aceita `actor_user_id` enviado pelo cliente;
- tentativas de login, falhas de MFA, bloqueios, revogações, alterações de permissão, exportações, impressões e downloads entram no histórico;
- a tela atual continua oferecendo os mesmos filtros e acrescenta resultado, ação e identificador do evento;
- a consulta usa paginação no servidor e não carrega todo o histórico no navegador;
- CSV e impressão são gerados pelo servidor, respeitam filtros/permissões e criam um novo evento de auditoria;
- integridade da cadeia de hashes é verificada diariamente e gera alerta em caso de quebra;
- administradores podem consultar e exportar, mas não apagar ou editar eventos;
- relógios de aplicação, banco e logs estão sincronizados;
- testes comprovam que clique cancelado não aparece como sucesso e que operação negada aparece como `denied`.

**Retenção inicial proposta:** cinco anos para eventos de segurança e incidentes; para os demais eventos, prazo definido na política institucional antes do go-live. A regra final deve ser validada com privacidade/jurídico para evitar retenção excessiva.

### RF-007 — Backup e recuperação — P0

Backups devem ser automáticos, criptografados, externos ao ambiente principal e testados.

**Critérios de aceite:**

- backup diário do banco completo, incluindo tabelas de binários;
- pelo menos uma cópia isolada do ambiente de produção;
- retenção mínima inicial de 30 dias, sujeita à política institucional;
- objetivo de perda máxima de dados (RPO) de 24 horas no MVP;
- objetivo de restauração (RTO) de 4 horas no MVP;
- restauração integral trimestral e restauração amostral mensal documentadas, incluindo os binários guardados no banco;
- operação de restauração exige dupla confirmação e gera auditoria.

### RF-008 — Paridade dos fluxos críticos — P0

Os fluxos selecionados para cada onda devem manter regras, campos, validações, relatórios e impressão equivalentes à v215, exceto mudanças formalmente aprovadas.

**Critérios de aceite:**

- catálogo de telas mapeia cada função v215 para “migrada”, “substituída”, “adiada” ou “descontinuada”;
- testes de regressão cobrem os fluxos críticos de cada módulo;
- coordenadores responsáveis assinam o UAT do próprio departamento;
- nenhum dado real é lançado em um fluxo ainda classificado como demonstrativo.

### RF-009 — Relatórios, PDF e impressão — P1

Relatórios devem ser gerados a partir da base central e respeitar o mesmo escopo de autorização dos dados exibidos.

**Critérios de aceite:**

- relatórios extensos não são truncados;
- cabeçalhos repetem em páginas subsequentes;
- PDF registra período, data de emissão e emissor quando aplicável;
- arquivo exportado não inclui registros fora do escopo do usuário;
- modelos oficiais mantêm a formatação aprovada;
- geração pesada ocorre em tarefa assíncrona com situação visível.

### RF-010 — Rascunhos e concorrência — P1

O salvamento automático deve ser adaptado à base central sem criar registros incompletos ou sobrescrever mudanças concorrentes.

**Critérios de aceite:**

- rascunho e registro concluído possuem estados distintos;
- falha de rede mantém o rascunho local e informa claramente que não houve confirmação central;
- reconexão oferece sincronização segura;
- conflito mostra as duas versões e exige decisão autorizada;
- telas de decisão financeira, jurídica ou diretiva nunca concluem apenas por autosave.

### RF-011 — Integração WhatsApp — P1

Mensagens em lote ou programadas devem ser processadas exclusivamente por serviço backend controlado.

**Critérios de aceite:**

- credenciais do provedor nunca chegam ao navegador;
- consentimento, finalidade, opt-out e histórico são verificáveis;
- idempotência impede mensagem duplicada;
- fila possui repetição controlada, dead-letter e painel de falhas;
- ambientes de teste não enviam mensagens reais;
- publicação de lote exige prévia, contagem, responsável e confirmação explícita.

### RF-012 — Administração e configuração — P1

Parâmetros institucionais, anos, biênios, permissões e integrações devem ser editáveis sem alterar o código.

**Critérios de aceite:**

- mudanças são validadas, versionadas e auditadas;
- segredos ficam em cofre de configuração;
- somente Production possui recursos remotos; desenvolvimento e testes locais/CI nunca recebem credenciais ou dados reais;
- função “restaurar dados fictícios” não aparece em produção.

### RF-013 — Privacidade e direitos do titular — P0

O produto deve suportar inventário de dados, base legal/finalidade, transparência, correção, exportação e eliminação ou anonimização quando aplicável.

**Critérios de aceite:**

- cada categoria de dado possui finalidade, base de tratamento, responsável, retenção e destino após o prazo;
- existe canal institucional para solicitações do titular;
- dados de crianças e adolescentes recebem controles reforçados e validação jurídica específica;
- relatórios e telas aplicam minimização e mascaramento;
- execução local e CI usam dados sintéticos ou anonimizados;
- incidente de dados possui procedimento, responsáveis e registro próprio.

### RF-014 — Ajuda, manual e versionamento — P1

Produto, ajuda interna, manual e notas de versão devem refletir a mesma versão funcional.

**Critérios de aceite:**

- manual v215 ou posterior publicado antes do treinamento;
- usuário visualiza versão e data do release;
- mudanças que afetam processo têm nota e orientação;
- manual não instrui o usuário a depender do armazenamento local após a migração.

### RF-015 — Suporte e incidentes — P0

O sistema deve possuir canal de suporte, classificação de severidade e responsáveis de plantão no horário acordado.

**Critérios de aceite:**

- página de erro fornece protocolo sem expor detalhes técnicos;
- incidentes P1/P2 têm escalonamento e comunicação definidos;
- ações de suporte privilegiado são temporárias e auditadas;
- existe runbook para indisponibilidade, restauração, conta bloqueada, falha de integração e suspeita de vazamento.

---

## 8. Requisitos não funcionais

| ID | Tema | Requisito do MVP |
|---|---|---|
| RNF-001 | Disponibilidade | Meta mensal inicial de 99,5%, excluindo manutenção comunicada |
| RNF-002 | Desempenho | p95 ≤ 2 s para leituras/escritas comuns; p95 ≤ 5 s para consultas complexas |
| RNF-003 | Escalabilidade | Suportar ao menos 100 usuários cadastrados, 30 sessões simultâneas e crescimento de anexos sem republicar o frontend |
| RNF-004 | Segurança | HTTPS obrigatório, cabeçalhos de segurança, CSP compatível, proteção CSRF quando aplicável, rate limiting, gestão de segredos e dependências verificadas |
| RNF-005 | Qualidade | Testes unitários, integração, autorização, migração e E2E; pipeline bloqueia release reprovado |
| RNF-006 | Compatibilidade | Duas versões estáveis mais recentes de Edge, Chrome, Firefox e Safari móvel |
| RNF-007 | Acessibilidade | Meta WCAG 2.2 nível AA nas jornadas críticas |
| RNF-008 | Observabilidade | Logs estruturados, métricas, rastreamento de erros, health checks e alertas acionáveis |
| RNF-009 | Manutenibilidade | Código modular, migrações versionadas, revisão por pares, testes locais/CI isolados e rollback documentado |
| RNF-010 | Integridade | IDs imutáveis, restrições no banco, transações e idempotência nas operações críticas |
| RNF-011 | Localização | Idioma pt-BR, moeda BRL, fuso institucional `America/Manaus` e datas sem ambiguidade |
| RNF-012 | Portabilidade | Exportação administrativa documentada de dados e anexos em formato aberto |

Segurança deve ser verificada contra riscos atuais de aplicações web, com atenção especial a controle de acesso quebrado, configuração incorreta, falhas de autenticação, integridade e ausência de logging.

---

## 9. Arquitetura-alvo definida para Vercel

### 9.1 Diretriz

Adotar arquitetura web de três camadas na Vercel, com PostgreSQL gerenciado externo conectado ao projeto. Embora os anexos fiquem no PostgreSQL, eles permanecem isolados em tabelas próprias e só são acessados por rotas autorizadas:

```text
Navegador
   │ HTTPS + cookie de sessão
   ▼
Vercel CDN / WAF
   ├── Frontend modular
   └── Vercel Functions / API
          ├── Provedor de identidade + MFA
          ├── PostgreSQL central
          │      ├── dados estruturados
          │      ├── audit_events append-only
          │      └── attachments + attachment_chunks BYTEA
          ├── tarefas de PDF e WhatsApp
          └── logs, métricas e alertas
```

### 9.2 Componentes

- **Frontend na Vercel:** preservar a experiência aprovada, mas dividir o HTML monolítico em módulos versionados.
- **API em Vercel Functions:** concentrar autenticação da sessão, autorização, validação, transações, auditoria e integrações.
- **Banco relacional:** PostgreSQL gerenciado conectado pelo Vercel Marketplace ou provedor externo compatível, com backup ponto-no-tempo quando disponível.
- **Anexos no banco:** metadados e chunks `BYTEA`, sem bucket público ou armazenamento local permanente.
- **Processamento:** funções/tarefas para PDF, migrações, limpeza de uploads incompletos e WhatsApp; nenhum job depende da memória de uma instância.
- **Identidade:** provedor maduro com MFA, recuperação e revogação de sessão.
- **Observabilidade:** Vercel Observability/logs integrados a retenção externa, erros do frontend/backend, disponibilidade, latência e falhas de backup.
- **Proteção:** CSP, cabeçalhos seguros, rate limiting e regras no Vercel WAF.

### 9.3 Estratégia de migração técnica

Usar evolução incremental, não uma reescrita total simultânea:

1. congelar a v215 como referência funcional;
2. criar autenticação, API, PostgreSQL com binários e auditoria;
3. construir um adaptador do modelo local para o modelo central;
4. migrar módulo por módulo, preservando testes de comportamento;
5. manter a v215 apenas como referência local durante o piloto, sem endereço remoto concorrente;
6. retirar escrita no HTML local após a migração validada;
7. arquivar o protótipo e conservar exportações necessárias.

### 9.4 Restrições específicas da Vercel

- A Vercel hospeda frontend e funções; o PostgreSQL é um serviço gerenciado conectado ao projeto. O antigo produto “Vercel Postgres” não é provisionado para novos projetos; devem ser usadas integrações como Neon, Supabase Postgres ou AWS Aurora Postgres.
- O limite de 4,5 MB para payload de Vercel Functions exige upload em chunks de até 3 MiB e download em streaming.
- A região das Functions deve ser escolhida próxima do banco para reduzir latência e tempo de conexão.
- O pool deve ser apropriado a serverless/Fluid Compute e liberar conexões quando a Function for suspensa.
- Toda configuração secreta fica somente em variáveis sensíveis do ambiente Production; nenhum segredo entra em variáveis públicas do frontend.
- Rotas custosas têm `maxDuration` explícito e processamento idempotente; o fluxo não presume execução indefinida.
- O domínio canônico de produção deve ser o único aceito pela aplicação. URLs geradas de deployment devem ser bloqueadas, protegidas ou redirecionadas sem expor o sistema.
- Spend Management/alertas de custo devem cobrir Functions, banda e banco, principalmente por causa dos anexos binários.

**Referências da plataforma:**

- PostgreSQL na Vercel: https://vercel.com/docs/postgres
- Storage pelo Marketplace: https://vercel.com/docs/marketplace-storage
- Limite de payload das Functions: https://vercel.com/docs/errors/function_payload_too_large
- Checklist de produção: https://vercel.com/docs/production-checklist
- Configuração Git/deploy: https://vercel.com/docs/project-configuration/git-configuration

---

## 10. Modelo de dados de alto nível

O desenho detalhado deve começar pelas entidades abaixo e seus responsáveis de negócio:

| Domínio | Entidades centrais |
|---|---|
| Identidade | usuários, identidades, sessões, MFA, perfis, departamentos, permissões, biênios |
| Pessoas | trabalhadores, voluntários, evangelizadores, evangelizandos, responsáveis, palestrantes, mantenedores, famílias atendidas |
| Governança | admissões, decisões, reuniões, atas, documentos institucionais, auditoria |
| Planejamento | atividades, cronogramas, ocorrências, escalas, frequências, treinamentos |
| Social | rancho, doações, entregas, kits, sopa, Brechó, Clube de Mães, participantes |
| Financeiro | contas, lançamentos, contribuições, extratos, conciliações, fechamentos, pareceres |
| Patrimônio | bens, localizações, responsáveis, solicitações de baixa, decisões, limpeza |
| Eventos | eventos, itens, orçamento, avaliação, escala de trabalho |
| Divulgação/Livraria | solicitações, acervo, exemplares, empréstimos, estoque, vendas |
| Jurídico | eleições, chapas, mandatos, documentos de cartório |
| Arquivos | anexos, chunks binários `BYTEA`, versões, hashes, vínculos, retenção e retirada de vínculo |
| Comunicação | consentimentos, modelos, lotes, destinatários, entregas, falhas e opt-out |

Decisões de modelagem devem impedir cópia desnecessária de dados pessoais. Relatórios devem referenciar a fonte canônica ou armazenar apenas o snapshot estritamente necessário para preservar um ato histórico.

---

## 11. Privacidade, segurança e conformidade

O sistema trata ou pode tratar dados pessoais de trabalhadores, doadores, famílias, crianças e adolescentes, além de informações financeiras, documentos, imagens e áudios. Antes do uso real, a instituição deve validar com responsável jurídico/privacidade:

- inventário de operações de tratamento;
- papéis de controlador, operador e fornecedores;
- bases legais e finalidades por processo;
- avisos de privacidade e termos aplicáveis;
- regras de consentimento quando ele for a base adequada;
- retenção e descarte;
- atendimento aos titulares;
- contratos e confidencialidade;
- procedimento de resposta a incidentes;
- tratamento específico de dados de crianças e adolescentes;
- gravação de reuniões e transcrição;
- compartilhamento com provedores de hospedagem, mensagens e arquivos.

A LGPD exige medidas técnicas e administrativas para proteger dados pessoais. A ANPD também orienta agentes de pequeno porte a manter controles de acesso, política de segurança e treinamento. O regulamento de incidentes prevê comunicação em três dias úteis quando o evento puder causar risco ou dano relevante, ressalvadas regras específicas.

**Referências oficiais:**

- Lei Geral de Proteção de Dados — texto compilado: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- Guia de Segurança da Informação da ANPD: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-guia-de-seguranca-para-agentes-de-tratamento-de-pequeno-porte
- Comunicação de Incidente de Segurança: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- OWASP Top 10:2025: https://top10.owasp.org/2025/

Este PRD não substitui parecer jurídico nem teste profissional de segurança.

---

## 12. Produção única na Vercel, entrega e operação

### 12.1 Política de ambiente único

Existirá **somente um ambiente hospedado: Production na Vercel**. Não haverá banco compartilhado de desenvolvimento, homologação ou preview. Essa decisão reduz infraestrutura, mas aumenta o risco de regressão; por isso, as seguintes barreiras são obrigatórias:

- desenvolvimento executado localmente com banco descartável e dados sintéticos;
- testes automatizados executados na CI com PostgreSQL efêmero, sem acesso ao banco de produção;
- UAT executado localmente com pacote sintético versionado antes do merge;
- apenas a branch protegida `main` pode produzir deployment de produção;
- preview deployments automáticos desabilitados usando `git.deploymentEnabled`/Branch Tracking ou a opção “Only build production”;
- variáveis e credenciais cadastradas exclusivamente no escopo Production;
- nenhuma credencial de produção disponível em máquina de desenvolvimento ou job de teste;
- migrações destrutivas proibidas no deploy automático; mudanças de esquema usam estratégia compatível para frente e para trás;
- funcionalidades incompletas chegam desativadas por flag no próprio banco e só podem ser ligadas pelo administrador após smoke test;
- release imutável, rollback imediato para o deployment anterior e migração reversível ou compatível;
- manutenção extraordinária comunicada antes de mudança com risco de indisponibilidade.

**Importante:** “somente produção” significa um único ambiente remoto, não testar alterações diretamente nos dados reais. Toda alteração deve passar por testes locais e CI antes do deploy.

### 12.2 Configuração do projeto Vercel

- Production Branch: `main`.
- Deploy de produção somente após revisão e pipeline aprovado.
- Branch protection no provedor Git, com merge direto bloqueado.
- Preview/branch deployments desabilitados.
- Variáveis `DATABASE_URL`, identidade, criptografia, mensageria e observabilidade somente em Production.
- Região da Function alinhada à região do PostgreSQL.
- Fluid Compute/pooling configurados conforme o driver escolhido.
- domínio institucional com HTTPS automático e redirecionamento do domínio `vercel.app` para o canônico, quando tecnicamente possível;
- WAF/rate limiting em login, MFA, recuperação, upload, exportação e rotas administrativas;
- logs persistidos além da retenção padrão necessária para investigação;
- alertas de falha, latência, custo e backup.

### 12.3 Pipeline mínimo

1. revisão de código;
2. análise de dependências e segredos;
3. testes unitários e de integração;
4. testes de autorização por perfil;
5. testes E2E responsivos e de impressão;
6. migração de banco em ensaio;
7. UAT local com dados sintéticos e evidência anexada ao release;
8. aprovação da mudança;
9. deployment único em Production;
10. migração compatível e ativação controlada por flag;
11. smoke test em produção sem manipular dados pessoais reais além do estritamente necessário;
12. observação reforçada;
13. rollback imediato em caso de falha.

### 12.4 Monitoramento e alertas

Alertar, no mínimo, para:

- aplicação ou API indisponível;
- aumento de erros 5xx;
- falhas de login anormais;
- latência acima da meta;
- fila parada ou mensagens repetidamente falhas;
- armazenamento próximo do limite;
- backup ausente ou restauração reprovada;
- alteração de permissão privilegiada;
- falha na geração de relatório crítico.

---

## 13. Plano de testes

### 13.1 Testes obrigatórios

| Categoria | Cobertura mínima |
|---|---|
| Unidade | Regras de datas, valores, permissões, biênio, frequência e estados |
| Integração | API + PostgreSQL + tabelas binárias + auditoria + tarefas |
| Autorização | Matriz positiva e negativa para cada papel e módulo |
| Concorrência | Edição simultânea, exclusão versus edição, repetição idempotente |
| Migração | Backup válido, alterado, incompleto, duplicado e de grande volume |
| Segurança | SAST, dependências, segredo, sessão, upload, enumeração, CSRF/CORS e teste de invasão antes do go-live |
| E2E | Jornadas críticas em celular, tablet e computador |
| Impressão | Frequência, financeiro, agenda, fichas e modelos oficiais |
| Recuperação | Restauração de banco e anexos em ambiente limpo |
| Acessibilidade | Teclado, foco, nomes acessíveis, contraste, zoom e leitor de tela nas jornadas críticas |
| Carga | Volume esperado, picos de relatórios, uploads e fechamento mensal |

### 13.2 UAT por área

Cada responsável deve aprovar pelo menos:

- inclusão, edição, consulta e histórico;
- bloqueio de ação não autorizada;
- relatório/impressão principal;
- erro de validação e recuperação;
- cenário em celular;
- conferência do dado após outro usuário alterá-lo.

---

## 14. Critérios de go-live

O sistema somente será considerado operacional quando todos os itens abaixo estiverem verdes:

- [ ] autenticação real e MFA dos perfis sensíveis;
- [ ] autorização verificada no servidor;
- [ ] banco central e anexos binários privados no próprio PostgreSQL;
- [ ] migração ensaiada e reconciliada;
- [ ] zero dado fictício misturado à produção;
- [ ] backup automático e restauração integral aprovada;
- [ ] auditoria central e protegida;
- [ ] logs, métricas, health checks e alertas ativos;
- [ ] termos, avisos, retenção e procedimento de incidentes aprovados;
- [ ] teste de segurança sem vulnerabilidade crítica ou alta pendente;
- [ ] testes de regressão e autorização aprovados;
- [ ] UAT assinado pelos donos dos módulos da onda;
- [ ] manual atualizado e treinamento concluído;
- [ ] suporte, responsáveis e rollback definidos;
- [ ] piloto concluído com indicadores dentro das metas.

**Regra de decisão:** qualquer item P0 pendente bloqueia o go-live com dados reais.

---

## 15. Priorização do que falta

### P0 — Bloqueadores absolutos

1. autenticação e sessões reais;
2. autorização no servidor;
3. banco central transacional;
4. armazenamento binário privado no próprio PostgreSQL;
5. importação/migração reconciliada;
6. auditoria central protegida;
7. backup externo automático e restauração testada;
8. isolamento absoluto entre produção e execução local/CI, com retirada dos dados fictícios;
9. privacidade, retenção e resposta a incidentes;
10. observabilidade, suporte e runbooks;
11. regressão, segurança e UAT dos fluxos da primeira onda.

### P1 — Necessário logo após a fundação

1. paridade completa de relatórios e impressão;
2. rascunhos sincronizados e resolução de conflitos;
3. WhatsApp por fila segura;
4. manual v215+ e treinamento;
5. acessibilidade AA nas jornadas críticas;
6. painel operacional de integrações e tarefas.

### P2 — Evolução posterior

1. modo offline mais amplo;
2. aplicativo instalável/PWA com notificações;
3. BI e indicadores históricos avançados;
4. assinatura eletrônica integrada;
5. integrações contábeis e bancárias automáticas, após análise jurídica e de risco;
6. automações de workflow adicionais.

---

## 16. Roadmap e estimativa

Estimativa indicativa para uma equipe de **2 desenvolvedores full-stack, 1 QA parcial e participação semanal dos responsáveis dos módulos**. O prazo deve ser recalculado após inventário de dados e definição da infraestrutura.

| Fase | Entrega | Duração indicativa |
|---|---|---:|
| 0. Descoberta e decisões | Inventário, mapa de dados, owners, arquitetura, política e plano de migração | 1–2 semanas |
| 1. Fundação | Auth/MFA, API, PostgreSQL, chunks binários, auditoria, Vercel, CI/CD e observabilidade | 3–4 semanas |
| 2. Onda 1 | Cadastros-base, módulos educacionais, agendas, escalas, migração e UAT | 3–5 semanas |
| 3. Onda 2 | Social, Patrimônio, Eventos, Divulgação e Secretaria | 3–5 semanas |
| 4. Onda 3 | Tesouraria, Conselho Fiscal, Jurídico e WhatsApp | 4–6 semanas |
| 5. Piloto e go-live | Migração final, segurança, restauração, treinamento, piloto e estabilização | 2–3 semanas |

**Faixa total provável:** 16–25 semanas para o escopo integral, com possibilidade de colocar a Onda 1 em piloto antes disso. Com uma única pessoa desenvolvedora, o prazo e o risco aumentam significativamente.

Não é recomendável estimar por “percentual de telas prontas”: backend, migração, segurança e operação representam a maior parte do risco remanescente.

---

## 17. Riscos e respostas

| Risco | Probabilidade | Impacto | Resposta |
|---|---|---|---|
| Divergência entre cópias locais existentes | Alta | Alto | Escolher fonte oficial, importar em modo simulado e reconciliar por responsável |
| Dados fictícios misturados com reais | Média | Alto | Produção vazia, classificação de origem e limpeza aprovada |
| Regras escondidas no HTML monolítico não migrarem | Alta | Alto | Catálogo de comportamentos, testes de caracterização e migração por módulo |
| Acesso excessivo a dados sensíveis | Alta | Crítico | Menor privilégio, autorização no servidor, MFA e testes negativos |
| Anexos sem política de retenção | Alta | Alto | Inventário, classificação e rotina de retenção nas tabelas binárias |
| Dependência de uma única pessoa técnica | Média | Alto | Documentação, revisão, runbooks e credenciais institucionais |
| Usuários continuarem usando a cópia HTML | Alta | Médio | Modo somente leitura, banner de descontinuação e data de corte |
| Integração de mensagens enviar duplicado | Média | Alto | Idempotência, fila, prévia, consentimento e ambiente sandbox |
| Backup existir mas não restaurar | Média | Crítico | Testes regulares em ambiente limpo e evidência assinada |
| Escopo integral atrasar o primeiro valor | Alta | Médio | Go-live por ondas e critérios de saída por módulo |

---

## 18. Decisões pendentes da Diretoria

Estas decisões devem ser tomadas na Fase 0:

1. Quem é o dono institucional de cada módulo e de cada categoria de dado?
2. Qual navegador ou backup atual contém a fonte oficial de dados, se já houver dados reais?
3. Quais módulos entram na primeira onda?
4. Quais papéis realmente precisam de edição, leitura, exportação e acesso a anexos?
5. Quais dados são obrigatórios e por quanto tempo devem ser guardados?
6. A gravação/transcrição de reuniões continuará no escopo?
7. Quem responde por privacidade e incidentes?
8. Qual horário de suporte e qual disponibilidade são aceitáveis?
9. Qual orçamento mensal pode ser dedicado a Vercel, PostgreSQL, crescimento dos binários, mensagens e monitoramento?
10. Qual domínio institucional e quais contas de e-mail serão usados para identidade e comunicação?
11. Quais relatórios/modelos possuem valor oficial e exigem validação jurídica ou contábil?
12. O WhatsApp entra no MVP ou somente após estabilização?

---

## 19. Próxima ação recomendada

Realizar uma oficina de 90 minutos com Presidência, Secretaria, Tesouraria, Conselho Fiscal e dois coordenadores para fechar cinco artefatos:

1. matriz final de papéis e permissões;
2. ordem das ondas;
3. inventário e classificação dos dados;
4. fonte oficial para migração;
5. critérios de aceite dos dez fluxos mais críticos.

Depois da oficina, executar uma prova técnica curta com autenticação real, banco central e um fluxo completo — preferencialmente cadastro de trabalhador + vínculo + consulta em outro aparelho + auditoria. Essa prova deve validar a arquitetura antes da migração dos demais módulos.

---

## 20. Conclusão

O Sistema Lar da Bênção v215 já demonstra valor e possui uma superfície funcional maior do que a maioria dos protótipos. Contudo, ainda não é um sistema operacional de produção porque identidade, dados, arquivos, auditoria e recuperação estão limitados ao navegador.

O caminho mais seguro é preservar a interface e as regras já aprovadas, criar a fundação central de produção e migrar por ondas. O marco decisivo não será “publicar uma nova versão”, mas comprovar que dois usuários autorizados trabalham sobre a mesma base, que um usuário não autorizado é bloqueado pelo servidor e que a instituição consegue restaurar integralmente os dados após uma falha.
