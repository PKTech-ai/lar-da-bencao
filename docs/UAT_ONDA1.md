# UAT — Onda 1 (RF-008 · BL-063)

Executar **em ambiente local com dados sintéticos** (ou importação de demonstração), com o dono de cada módulo. A liberação em produção só acontece em **Módulos e ondas**, informando a referência deste UAT (ex.: “UAT Onda 1 — Doutrina — 20/09/2026 — Coord. Fulana”).

**Rollback da onda:** desligar o módulo em Módulos e ondas (efeito imediato; dados preservados). Para desfazer uma importação: Importação v215 → Reverter.

## Fundação (Administrador)
- [ ] Convite → definir senha → MFA → códigos de recuperação → termos → painel
- [ ] Login errado 5× bloqueia; mensagem igual para e-mail inexistente
- [ ] Usar código de recuperação → recadastrar autenticador
- [ ] Redefinir MFA e Encerrar sessões de outro usuário (o aparelho dele sai)
- [ ] Dedo-duro mostra todos os eventos acima; exportação CSV
- [ ] Anexos: PDF válido ativa; arquivo EICAR vai para quarentena e aparece no painel
- [ ] Módulos e ondas: liberar exige referência de UAT; desligar tira o menu e a API responde 404

## Trabalhadores e Diretoria (Secretaria, coordenadores, Presidente)
- [ ] Coordenador cadastra ficha → fica PENDENTE; não aparece nas escalas
- [ ] Coordenador não aprova; Presidente aprova com data e ata; histórico mostra a decisão
- [ ] Reprovar exige motivo; salvar ficha reprovada reenvia para análise
- [ ] Mudar departamentos/funções de ficha aprovada volta para PENDENTE
- [ ] Afastar/reativar; impressão da ficha só para aprovado
- [ ] Trabalhador de outro departamento não vê a ficha

## Doutrina (Coordenação da Doutrina)
- [ ] Palestrantes externos: cadastrar, editar, inativar (some das opções da escala)
- [ ] Biblioteca: pasta, subpasta, estudo com PDF, download por trabalhador da Doutrina, retirar/restaurar
- [ ] Escala: gerar mês; conferir; criar duplicidade manual → conferência aponta; aprovar bloqueado com pendência; corrigir; aprovar; publicar
- [ ] Psicofônico: sistema impede quarta e sexta da mesma semana
- [ ] Adicional de passista (Grupo do Passe), recepcionista e psicofônico; remover adicional
- [ ] Imprimir folha e mês consolidado (responsável, contato e citação)
- [ ] Gerar novamente e excluir escala (frequência preservada)
- [ ] Frequência do mês: lançar, totais do dia, KPIs, imprimir

## Infância e Juventude (Coordenações e um Evangelizador)
- [ ] Matricular: turma calculada pela idade em 30/06; idade fora da faixa é recusada; responsável obrigatório
- [ ] Juventude: maior de 18 sem responsável é aceito
- [ ] Foto: enviar, ver
- [ ] Renovar matrícula; inativar; excluir ficha (com frequência)
- [ ] Turmas: 2 evangelizadores diferentes, só aprovados
- [ ] Evangelizador vê e lança chamada/cronograma só da própria turma
- [ ] Chamada P/F/branco só aos domingos; janeiro e fevereiro sem aulas
- [ ] Cronograma: tema e evangelizadores; planejamento mostra o tema
- [ ] Planejamento: criar ano, atividades especiais (sem datas antes do retorno), ações de organização
- [ ] Relatório anual e aniversariantes; impressão

## Importação (Administrador, se aplicável)
- [ ] Pacote real: conferência sem erros; simulação; relatório conferido com a Diretoria
- [ ] Importar; conferir amostras nas telas; reverter em ambiente local para ensaio

## Assinaturas

| Módulo | Responsável | Data | Resultado | Referência usada na liberação |
|---|---|---|---|---|
| Fundação | | | | |
| Trabalhadores/Diretoria | | | | |
| Doutrina | | | | |
| Infância | | | | |
| Juventude | | | | |
