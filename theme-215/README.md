# Visual acolhedor — 215

Aplica a proposta visual aprovada no PDF: azul suave, verde sálvia, fundo quente claro e logomarca institucional existente.

- Tema de tela para os módulos, navegação, área pessoal, tabelas e formulários.
- Tela inicial com boas-vindas e indicadores reais já calculados pelo sistema.
- Menu com ícones reutilizados; atalhos e visibilidade continuam subordinados às permissões existentes.
- Aviso de dados fictícios permanece disponível em um resumo expansível na tela inicial.
- Telas de celular e tablet mantêm campos de 16px, controles para toque e a primeira coluna fixa nas frequências.
- Impressões comuns recebem a paleta aprovada; os modelos oficiais integrais mantêm sua formatação.

`build.py` gera o HTML independente e `dist/index.html` a partir da versão 214 preservada no diretório de trabalho. `theme.css` e `theme.js` são incorporados ao HTML. Não há novas dependências de execução nem alteração dos cadastros, permissões ou mecanismos de armazenamento.

`verify.cjs` usa um navegador isolado com dados de teste para conferir sintaxe, renderização em cinco larguras, navegação, formulário, frequência, acesso e amostras de impressão. Evidências locais ficam em `tmp/visual-215`, fora da publicação.
