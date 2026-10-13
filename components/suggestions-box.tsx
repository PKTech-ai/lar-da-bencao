import Link from "next/link";

/** Caixa recolhível "Sugestões e melhorias", presente em toda página do visual v215. */
export function SuggestionsBox() {
  return (
    <details className="visual-suggestions">
      <summary><span>Sugestões e melhorias</span><span className="visual-suggestions-hint">Enviar uma ideia ou acompanhar</span></summary>
      <div className="sg-heading">
        <p>O que você escrever chega à Diretoria. Você acompanha a resposta na central de sugestões.</p>
        <Link className="button primary" href="/sistema/sugestoes">Enviar sugestão</Link>
      </div>
    </details>
  );
}
