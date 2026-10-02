import Link from "next/link";
import QRCode from "qrcode";
import { PrintButton } from "@/components/print-button";
import { serverEnv } from "@/lib/env";
import { isFlagEnabled } from "@/lib/feature-flags";
import { requireModulePage } from "@/lib/page-auth";
import { PUBLIC_WORKER_FORM_FLAG } from "@/lib/worker-submissions";

/** QR code do formulário público e cartaz A4. O endereço vem sempre de APP_URL. */
export default async function CadastroOnlineQrPage() {
  await requireModulePage("module_workers", { resource: "modules", action: "admin" });
  const url = `${serverEnv().APP_URL.replace(/\/+$/, "")}/cadastro/trabalhador`;
  // Preto sobre branco de propósito: leitores de QR precisam do contraste, inclusive no tema escuro.
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  const open = await isFlagEnabled(PUBLIC_WORKER_FORM_FLAG);
  return (
    <>
      <header className="page-heading no-print">
        <div><h1>QR code do cadastro online</h1><p>Cartaz para imprimir em A4. Quem ler o código abre o formulário de cadastro no celular.</p></div>
        <div className="row-actions">
          <Link className="button" href="/sistema/trabalhadores/cadastros-online">Voltar</Link>
          <PrintButton label="⎙ Imprimir cartaz" />
        </div>
      </header>
      <div className="notice no-print" style={{ marginBottom: 16 }}>
        <strong>Confira antes de imprimir:</strong> o código aponta para <strong>{url}</strong>. Abra esse endereço no celular e só imprima se o formulário carregar.
        {open ? "" : " O formulário está fechado no momento: quem ler o código verá o aviso “Formulário fechado”."}
      </div>
      <section className="card" style={{ textAlign: "center" }}>
        <h2>Cadastro de trabalhadores — Lar da Bênção</h2>
        <p>Aponte a câmera do celular para o código e preencha ou atualize a sua ficha.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt={`QR code para ${url}`} style={{ width: "min(420px, 100%)", height: "auto" }} />
        <p className="small muted">{url}</p>
      </section>
    </>
  );
}
