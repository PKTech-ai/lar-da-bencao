import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <Brand />
        <h1 id="login-title">Acesso institucional</h1>
        <p className="muted">Entre com sua conta individual. O segundo fator será solicitado em seguida.</p>
        <Suspense fallback={<div className="notice">Preparando acesso seguro…</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
