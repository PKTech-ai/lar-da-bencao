# Ingressos — decisões e adaptações

Módulo de Ingressos do Departamento de Eventos (PRD v1.3, 29/10/2026). Este arquivo registra o que o PRD não cobria
e onde o repositório pediu adaptação.

## Onde fica

- **Coordenação e Equipe:** `/sistema/ingressos` (Vender, Validar, Caixa, Metas e Eventos na engrenagem). A aba
  **Ingressos** do Departamento de Eventos leva para lá.
- **Trabalhador (acesso temporário):** `/ingressos/acesso/{token}` (primeiro acesso e PIN) e `/ingressos` (Vender e
  Minhas vendas), sem o menu do sistema. Manifesto em `public/ingressos.webmanifest` para "Adicionar à tela inicial".
- **Comprador:** `/i/{token}` (página pública, só leitura).
- **Código:** regras puras em `lib/ingressos/regras.ts`; servidor em `lib/ingressos/*.ts`; rotas em
  `app/api/ingressos/**`; telas em `components/ingressos/*`. Banco: `supabase/migrations/202610291200_ingressos.sql`.

## Permissões

O sistema não tem permissões por ação. O acesso é por **página** (total ou leitura), definido pelo perfil, pelo
departamento vinculado e pela matriz editável em Controle de Acesso. As 13 permissões do PRD foram mapeadas sobre a
página **Eventos** em `lib/ingressos/acesso.ts`:

| Situação na página Eventos | Papel no módulo | Pode |
|---|---|---|
| Acesso total (ex.: coordenador/subcoordenador de Eventos, Presidente, Administrador) | Coordenação | tudo |
| Leitura **e** vínculo com o Departamento de Eventos (ex.: trabalhador de Eventos) | Equipe | vender, dar baixa, validar, ver o caixa |
| Leitura sem vínculo (ex.: Vice-presidente, Secretário) | Consulta | só ver o caixa |

Assim a Diretoria que só "lê" Eventos não vende nem dá baixa. Toda ação confere o papel no servidor.

A liberação usa a flag já existente `module_eventos` (nenhuma flag nova desligada).

## Trabalhador (acesso temporário)

- Vendedor = `app.ticket_sellers`, ligado à ficha de trabalhador (`app.workers`) quando escolhido pela busca, ou só
  com nome e WhatsApp. Usuários do sistema que vendem ganham uma linha de vendedor automaticamente (ligada à mesma ficha,
  se a conta tiver `worker_id`).
- Token do link (32 bytes) e PIN guardados só como hash (SHA-256 e scrypt do Node, sem dependência nova).
- Vínculo com o aparelho por cookie `HttpOnly` de longa duração; sessão de 12 h em `app.ticket_seller_sessions`.
- O app do trabalhador chama as mesmas rotas `/api/ingressos/*` com o cabeçalho `X-Ingressos-Modo: vendedor`; sem
  ele, vale o login normal. As rotas de `/api/ingressos` estão liberadas no `proxy.ts` porque cada uma confere a
  sessão (login ou acesso do trabalhador) por dentro.
- Expiração: checada a cada requisição (`valid_until >= hoje em Manaus`) e também na rotina diária
  `/api/maintenance/integrity`, que registra "Acesso de vendedor expirado" no histórico e derruba as sessões.
- "Remover" um trabalhador da lista de metas apaga a meta e bloqueia o acesso; as vendas continuam no nome dele.

## Dinheiro em mãos (custódia)

- Pagamento em dinheiro registrado **pelo trabalhador** (no app dele) fica em mãos dele.
- Venda lançada pela Equipe/Coordenação na **tela completa** em nome de outro vendedor ("Vendido por"), paga em
  dinheiro, também fica em mãos desse vendedor (foi ele quem recebeu).
- Baixas posteriores registradas por Equipe/Coordenação não geram custódia: o dinheiro já está com a Casa.

## Vendas, links e tickets

- O link público da venda guarda só o hash. Como o link não pode ser recuperado, **"Reenviar" e "Copiar mensagem"
  geram um link novo** (tabela `app.ticket_sale_links`); os links enviados antes continuam valendo.
- O "Desfazer venda" usa o relógio do banco (`now()`), não o do celular.
- Código de 4 caracteres com sorteio sem viés (`crypto.randomBytes`), único por evento, nova tentativa em colisão.
- Na tela Validar, 4 letras que podem ser código **ou** nome (ex.: "MARK"): procura o código; se não existir, procura
  pelo nome.
- Ativar um evento: o anterior volta a rascunho se não tiver vendas; com vendas, é encerrado.
- Excluir evento só sem vendas e sem acessos enviados; senão, Encerrar.

## Fuso, valores e mensagens

- "Hoje", vencimentos, validade do acesso e horários usam **America/Manaus** (o resto do sistema usa São Paulo).
- Valores sempre em centavos inteiros.
- Mensagens do WhatsApp seguem a seção 10, com artigo certo por tipo: "retirar **a** feijoada", "**o** café da manhã".
- O WhatsApp abre na mesma aba (`location.href`): no iPhone, abrir janela nova depois de esperar a rede é bloqueado.
  A venda já fica gravada e, ao voltar, a tela "Venda feita" aparece.

## Organizador e logo

- O primeiro organizador vem pré-preenchido com os dados da instituição (nome, CNPJ válido, telefone).
- A logo é reduzida no navegador (até 1024 px) e guardada no próprio cadastro do organizador (`bytea`), servida por
  `/api/ingressos/logo/{id}`. Motivo: os anexos do sistema exigem login para baixar, e a logo aparece na página
  pública dos ingressos, no link do trabalhador e na arte. Sem logo, usa a marca do Lar da Bênção.

## Fase 2 (entregue junto)

- **QR no ticket e câmera:** leitor nativo do navegador (BarcodeDetector) e, no iPhone, `jsqr` (única dependência nova).
- **Arte de divulgação:** desenhada no navegador (canvas) nos dois tamanhos, com paleta por tipo e QR Pix estático
  sem valor (BR Code com CRC16 testado). Refeita sempre que a tela do evento abre com dados novos.
- **Planilha .xlsx:** gerada sem biblioteca (`lib/ingressos/xlsx.ts`) com as abas Resumo, Trabalhadores, Vendas
  (canceladas à parte), Recebimentos, Tickets e Acertos.
- **PDF:** página de impressão A4 (`/sistema/ingressos/caixa/imprimir`) com cabeçalho, resumo, vendas, rodapé
  "Posição em" e espaço para assinaturas; "salvar em PDF" pelo próprio navegador, como as outras impressões do sistema.
- **Histórico:** todas as ações vão para o histórico (Dedo-duro) já existente, módulo "Eventos", seção "Ingressos".
  Ações de trabalhadores aparecem com o nome dele e "(trabalhador)".

## Limites e pontos em aberto (padrão do PRD assumido)

- WhatsApp de reservas na arte: o do evento; se vazio, o do organizador.
- Máximo de 20 ingressos por venda.
- Página pública e link de acesso: limite por IP só para tentativas com token inválido (40 e 20 em 15 min), para não
  barrar uma fila de pessoas abrindo os próprios ingressos pela mesma rede.
- "Salvar imagem" dos tickets (opcional no PRD) não foi feito: a página do link já mostra QR e código.
- O nome digitado diferente para um WhatsApp já cadastrado fica no histórico da venda (`metadata.nome_digitado`).
