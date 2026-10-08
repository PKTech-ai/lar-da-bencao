import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { query } from "@/lib/db";
import { isFlagEnabled } from "@/lib/feature-flags";
import { PUBLIC_WORKER_FORM_FLAG } from "@/lib/worker-submissions";
import { PublicWorkerForm } from "./public-worker-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cadastro de trabalhador — Lar da Bênção" };

/** Formulário público (sem login), aberto por link ou QR code; o envio cai na fila de revisão. */
export default async function CadastroTrabalhadorPage() {
  const open = await isFlagEnabled(PUBLIC_WORKER_FORM_FLAG);
  const departments = open
    ? (await query<{ key: string; label: string }>("select key, label from app.departments where active order by label")).rows
    : [];
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="cadastro-title">
        <Brand prominent />
        <h1 id="cadastro-title">Cadastro de trabalhador</h1>
        {open ? (
          <>
            <p className="muted">Preencha ou atualize a sua ficha. Seus dados serão conferidos pela administração antes de entrar no sistema.</p>
            <PublicWorkerForm departments={departments} />
          </>
        ) : (
          <div className="notice" role="status">
            <strong>Formulário fechado.</strong> O cadastro online não está recebendo envios no momento. Procure a administração do Lar da Bênção.
          </div>
        )}
      </section>
    </main>
  );
}
