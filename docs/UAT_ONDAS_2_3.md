# UAT — Ondas 2 e 3

Mesma regra da onda 1: executar **com dados sintéticos**, com a pessoa responsável por cada módulo ao lado. A liberação em produção acontece só em **Módulos e ondas**, informando a referência deste UAT (ex.: “UAT Onda 2 — Patrimônio — 20/09/2026 — Coord. Fulana”).

**Rollback:** desligar o módulo em Módulos e ondas (efeito imediato, dados preservados).

Antes de começar, o Administrador precisa ter feito, em `/sistema/acesso` e `/sistema/instituicao`:
- [ ] biênio vigente cadastrado e vinculado aos cargos da Diretoria
- [ ] matriz de acesso conferida (as exceções registradas são intencionais)
- [ ] dados da instituição preenchidos

## Patrimônio (`module_patrimonio`)
- [ ] Cadastrar um bem com foto e nota fiscal; o tombamento repetido (com espaços ou em caixa diferente) é recusado
- [ ] Solicitar baixa → o memorando recebe número `PAT-BAIXA-AAAA-NNNN` e aparece na Diretoria
- [ ] Um segundo pedido para o mesmo bem é recusado enquanto o primeiro estiver pendente
- [ ] Coordenador do Patrimônio **não** decide; Presidente autoriza e a baixa entra na ficha do bem na data decidida
- [ ] Alterar o cadastro do bem depois do memorando bloqueia a autorização (é preciso cancelar e refazer)
- [ ] Escala de limpeza: sábado é recusado; janeiro e fevereiro também (recesso até o primeiro domingo de março)
- [ ] Escalar a mesma pessoa duas vezes no ano pede confirmação e registra a decisão
- [ ] Taxa de serviço de R$ 50,00: marcar “Recebido” exige data e forma; depois de recebido, a escala só muda voltando para pendente com motivo
- [ ] Geração automática distribui sem repetir pessoa no ano e informa as vagas que faltaram
- [ ] Relatório anual e impressão conferem com os lançamentos

## Assistência e Promoção Social (`module_assistencia`)
- [ ] Cadastrar família, registrar entrega de rancho do mês com comprovante
- [ ] Família com acompanhamento encerrado não recebe nova entrega
- [ ] Kits de higiene e Controle de Atividades: programado x realizado, com quantidade e responsável
- [ ] Voluntários e Mantenedores da Cesta com as situações do mock
- [ ] **Brechó**: a conta do setor entra direto na aba do Brechó e não enxerga as outras
- [ ] **Clube de Mães**: idem, com pessoas atendidas e entregas de enxoval
- [ ] A coordenação da Assistência enxerga e lança nos dois setores
- [ ] Comprovantes anexados abrem e baixam; retirar um anexo exige motivo e ele continua no histórico

## Eventos (`module_eventos`)
- [ ] Agenda com data, local e responsável; “Realizado” exige data efetiva até hoje
- [ ] Itens: previsto x disponível mostra o que falta providenciar
- [ ] Escala de trabalho: a mesma pessoa não entra duas vezes no mesmo evento
- [ ] Avaliação do evento e impressão

## Divulgação — Livraria (`module_divulgacao`)
- [ ] Cadastrar obra para empréstimo e obra para revenda (a mesma obra pode ter cadastro em cada destinação)
- [ ] Entrada de estoque; baixa maior que o disponível é recusada
- [ ] Empréstimo maior que o disponível é recusado; devolução parcial libera exemplares
- [ ] Venda com comprovante; o painel mostra atrasados e disponibilidade
- [ ] Relatório anual

## Secretaria (`module_secretaria`)
- [ ] Criar reunião, gravar áudio pelo navegador e conferir que o arquivo fica na reunião
- [ ] Transcrição: digitar e conferir o autosave (“Salvo às …”); sair com texto pendente avisa
- [ ] Anexar a ata assinada em PDF
- [ ] Aniversariantes e relatório anual

## Presidência (`module_presidencia`)
- [ ] Painel mostra as pendências reais (fichas, baixas, sugestões) e a situação dos módulos
- [ ] Aba de Autorizações de Baixa decide os memorandos do Patrimônio

## Tesouraria (`module_tesouraria`)
- [ ] Lançar entrada e saída usando o plano de contas; conta sintética é recusada
- [ ] Comprovante por lançamento
- [ ] Contribuições do mês e vínculo com a ficha do trabalhador
- [ ] Mantenedores e doações recebidas; mantenedor encerrado não recebe doação
- [ ] Fechar o mês: lançar depois disso é recusado (mensagem clara)
- [ ] Reabrir com motivo; depois de enviado ao Conselho Fiscal, reabrir exige devolução
- [ ] Importar extrato OFX e CSV; reimportar o mesmo arquivo não duplica linhas
- [ ] Conciliar com valor diferente é recusado; “deixar fora” exige motivo; desfazer funciona
- [ ] Relatório anual bate com o caixa mensal

## Conselho Fiscal (`module_conselho_fiscal`)
- [ ] Mês só aparece para análise depois de enviado pela Tesouraria
- [ ] Um parecer por mês; segundo parecer é recusado
- [ ] Parecer assinado anexado; o Conselho não consegue alterar lançamento nenhum

## Jurídico (`module_juridico`)
- [ ] Eleição com etapas e datas encadeadas (edital → inscrições → votação → posse)
- [ ] Anexar modelo `.docx` e PDF

## WhatsApp (`module_whatsapp`)
- [ ] Sem marcar o consentimento, a mensagem não entra na fila
- [ ] “Abrir no WhatsApp” abre a conversa com o texto; marcar como enviada registra quem enviou
- [ ] No Dedo-duro, o telefone aparece mascarado

## Encerramento
- [ ] Dedo-duro mostra todas as ações acima, com autor e data
- [ ] Cada módulo liberado em produção com a referência do UAT registrada
- [ ] Evidências (prints ou anotações) guardadas com a Secretaria
