"use client";

export default function SystemError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="card" role="alert">
      <h1>Não foi possível carregar esta página</h1>
      <p>Tente novamente. Se o problema continuar, informe ao suporte o protocolo abaixo.</p>
      <p><strong>Protocolo:</strong> {error.digest ?? "indisponível"}</p>
      <button className="button primary" onClick={reset}>Tentar novamente</button>
    </section>
  );
}
