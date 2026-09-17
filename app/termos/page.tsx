import { Brand } from "@/components/brand";
import { TermsForm } from "./terms-form";

export default function TermosPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Brand />
        <h1>Termos de uso institucional</h1>
        <p className="muted">Obrigatório no primeiro acesso após autenticação.</p>
        <TermsForm />
      </div>
    </div>
  );
}
