import { Brand } from "@/components/brand";
import { RecoveryForm } from "./recovery-form";

export default function RecoveryPage(){return <main className="auth-shell"><section className="auth-card"><Brand/><h1>Recuperar acesso</h1><p className="muted">Enviaremos um link para o e-mail cadastrado, se a conta existir.</p><RecoveryForm/></section></main>;}
