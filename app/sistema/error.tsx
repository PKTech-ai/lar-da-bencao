"use client";

export default function SystemError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = error.message
    .replace(/informe ao suporte[^.]*\.?/gi, "")
    .replace(/protocolo[:\s]*[A-Z0-9]+/gi, "")
    .trim();
  return (
    <section className="card" role="alert">
      <h1>Não foi possível carregar esta página</h1>
      <p>{message || "Tente novamente."}</p>
      <button className="button primary" onClick={reset}>Tentar novamente</button>
    </section>
  );
}
