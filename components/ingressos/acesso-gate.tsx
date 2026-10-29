"use client";
/* eslint-disable @next/next/no-img-element -- logo do organizador servida pela API própria */

import "@/components/ingressos/ingressos.css";
import { useEffect, useState } from "react";
import { shortDate } from "@/lib/ingressos/regras";

type State =
  | { state: "encerrado" }
  | { state: "outro_aparelho" }
  | { state: "criar_pin" | "pin" | "bloqueado_pin"; seller_name: string; event_name: string; event_date: string; valid_until: string; logo_url: string; minutes?: number };

export function AccessEnded({ text = "Acesso encerrado. Fale com a coordenação." }: { text?: string }) {
  return (
    <div className="ing ing-standalone">
      <div className="ing-empty" style={{ paddingTop: 60 }}>
        <img src="/marca-lar-da-bencao.png" alt="Lar da Bênção" width={96} height={100} style={{ justifySelf: "center", objectFit: "contain" }} />
        <h1 style={{ fontSize: 24, color: "var(--blue-900)" }}>{text}</h1>
      </div>
    </div>
  );
}

/** Primeiro acesso (cria PIN de 4 números, duas vezes) e acessos seguintes (só o PIN). */
export function AccessGate({ token }: { token: string }) {
  const [info, setInfo] = useState<State | null>(null);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/ingressos/acesso/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => setInfo(body.state ? body : { state: "encerrado" }))
      .catch(() => setError("Sem conexão. Tente de novo."));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!info || !("seller_name" in info)) return;
    if (!/^\d{4}$/.test(pin)) { setError("O PIN tem 4 números."); return; }
    if (info.state === "criar_pin" && pin !== confirm) { setError("Os dois PINs não são iguais. Digite de novo."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/ingressos/acesso/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info.state === "criar_pin" ? { action: "criar_pin", pin, confirm } : { action: "entrar", pin })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.code === "ACCESS_ENDED") setInfo({ state: "encerrado" });
        else if (body.code === "OTHER_DEVICE") setInfo({ state: "outro_aparelho" });
        setError(body.error ?? "Não foi possível entrar.");
        setPin("");
        setConfirm("");
        setBusy(false);
        return;
      }
      window.location.replace(`${window.location.origin}/ingressos`);
    } catch {
      setError("Sem conexão. Tente de novo.");
      setBusy(false);
    }
  }

  if (!info) return <div className="ing ing-standalone"><p className="ing-empty">{error || "Carregando…"}</p></div>;
  if (info.state === "encerrado") return <AccessEnded />;
  if (info.state === "outro_aparelho") return <AccessEnded text="Este acesso já está em uso em outro celular. Peça um novo link à coordenação." />;

  const creating = info.state === "criar_pin";
  return (
    <div className="ing ing-standalone">
      <form className="ing-step" onSubmit={submit} style={{ paddingTop: 20 }}>
        <img src={info.logo_url} alt="" width={96} height={96} style={{ justifySelf: "center", borderRadius: "50%", objectFit: "contain", background: "#fff", border: "1px solid var(--line)" }} />
        <h1 className="ing-question" style={{ textAlign: "center" }}>{creating ? `Bem-vindo, ${info.seller_name.split(" ")[0]}` : `Olá, ${info.seller_name.split(" ")[0]}`}</h1>
        <p style={{ textAlign: "center", fontSize: 18 }}><b>{info.event_name}</b> · {shortDate(info.event_date, true)}</p>
        <p className="ing-muted" style={{ textAlign: "center" }}>Acesso válido até {shortDate(info.valid_until, true)}</p>
        {info.state === "bloqueado_pin" ? <div className="error">PIN bloqueado por muitas tentativas. Tente de novo em {info.minutes} min.</div> : null}
        <label className="ing-field">{creating ? "Crie um PIN de 4 números" : "Digite o seu PIN"}
          <input className="ing-input" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete={`${creating ? "new" : "current"}-password`} autoFocus
            maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ letterSpacing: 12, textAlign: "center", fontSize: 28 }} />
        </label>
        {creating ? (
          <label className="ing-field">Digite o PIN de novo
            <input className="ing-input" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" maxLength={4} value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ letterSpacing: 12, textAlign: "center", fontSize: 28 }} />
          </label>
        ) : null}
        {error ? <div className="error" role="alert">{error}</div> : null}
        <button className="ing-btn green" disabled={busy || info.state === "bloqueado_pin"}>{busy ? "Entrando…" : creating ? "Criar PIN e entrar" : "Entrar"}</button>
        {creating ? <p className="ing-muted" style={{ textAlign: "center" }}>Guarde o PIN. Ele vale só neste celular. Dica: adicione esta página à tela inicial.</p> : null}
      </form>
    </div>
  );
}
