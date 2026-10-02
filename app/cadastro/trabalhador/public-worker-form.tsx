"use client";

import { useState, type FormEvent } from "react";
import { DOCTRINE_FUNCTIONS, WEEKDAYS } from "@/lib/worker-constants";

type Option = { key: string; label: string };

const MARITAL_STATUS = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];

export function PublicWorkerForm({ departments }: { departments: Option[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const doctrine = selected.includes("doutrina");
  const toggle = (key: string, checked: boolean) => setSelected((current) => (checked ? [...current, key] : current.filter((item) => item !== key)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (name: string) => String(values.get(name) ?? "");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/worker-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: text("full_name"),
          phone: text("phone"),
          email: text("email"),
          birth_date: text("birth_date"),
          naturality: text("naturality"),
          marital_status: text("marital_status"),
          profession: text("profession"),
          address: text("address"),
          volunteer_service: text("volunteer_service"),
          departments: values.getAll("departments").map(String),
          functions: values.getAll("functions").map(String),
          available_days: values.getAll("available_days").map(Number),
          accepts_volunteer_law: values.get("accepts_volunteer_law") === "on",
          image_authorization: values.get("image_authorization") === "on",
          privacy_acknowledged: values.get("privacy_acknowledged") === "on",
          website: text("website")
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Não foi possível enviar o cadastro.");
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar o cadastro.");
    } finally {
      setBusy(false);
    }
  }

  // A confirmação não repete nenhum dado informado.
  if (sent) {
    return (
      <div className="success" role="status">
        <strong>Cadastro enviado.</strong> Obrigado! A administração do Lar da Bênção vai conferir as informações. Você já pode fechar esta página.
      </div>
    );
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label>Nome completo *<input name="full_name" required minLength={2} maxLength={160} autoComplete="name" /></label>
      <div className="form-row">
        <label>Telefone com DDD *<input name="phone" type="tel" required minLength={10} maxLength={40} inputMode="tel" autoComplete="tel" placeholder="(51) 99999-9999" /></label>
        <label>Data de nascimento *<input name="birth_date" type="date" required min="1900-01-01" autoComplete="bday" /></label>
      </div>
      <label>E-mail<input name="email" type="email" maxLength={320} autoComplete="email" /></label>
      <div className="form-row">
        <label>Naturalidade<input name="naturality" maxLength={120} placeholder="Cidade onde nasceu" /></label>
        <label>Estado civil
          <select name="marital_status" defaultValue="">
            <option value="">Prefiro não informar</option>
            {MARITAL_STATUS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <label>Profissão<input name="profession" maxLength={120} /></label>
      <label>Endereço<input name="address" maxLength={300} autoComplete="street-address" /></label>
      <fieldset className="check-grid">
        <legend>Departamentos em que você atua *</legend>
        {departments.map((department) => (
          <label key={department.key}>
            <input type="checkbox" name="departments" value={department.key} checked={selected.includes(department.key)} onChange={(event) => toggle(department.key, event.target.checked)} />
            {department.label}
          </label>
        ))}
      </fieldset>
      {doctrine ? (
        <fieldset className="check-grid">
          <legend>Funções na Doutrina</legend>
          {DOCTRINE_FUNCTIONS.map((fn) => <label key={fn}><input type="checkbox" name="functions" value={fn} />{fn}</label>)}
        </fieldset>
      ) : null}
      <fieldset className="check-grid">
        <legend>Dias disponíveis</legend>
        {WEEKDAYS.map((day, index) => <label key={day}><input type="checkbox" name="available_days" value={index} />{day}</label>)}
      </fieldset>
      <label>Serviço voluntário<textarea name="volunteer_service" rows={3} maxLength={2000} placeholder="Descreva as atividades que você realiza no Lar da Bênção" /></label>
      {/* Campo-isca contra robôs: fora da tela e fora da navegação por teclado e leitor de tela. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <label>Site<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="notice">
        <strong>Termo de voluntariado.</strong> O serviço voluntário no Lar da Bênção é prestado de forma espontânea e não remunerada, nos termos da Lei nº 9.608/98, e não gera vínculo empregatício nem obrigação trabalhista ou previdenciária.
      </div>
      <div className="notice">
        <strong>Aviso de privacidade.</strong> O Centro Espírita Filantrópico Lar da Bênção usa os dados deste formulário apenas para organizar o trabalho voluntário (ficha do trabalhador, escalas e contato). Eles são conferidos pela administração antes de entrar no cadastro e ficam restritos aos responsáveis pelos departamentos em que você atua, à Secretaria e à Diretoria. Para consultar, corrigir ou pedir a exclusão dos seus dados, procure a administração do Lar da Bênção.
      </div>
      <fieldset className="check-grid">
        <legend>Termos</legend>
        <label><input type="checkbox" name="accepts_volunteer_law" required />Li e aceito o termo de voluntariado (Lei 9.608/98) *</label>
        <label><input type="checkbox" name="privacy_acknowledged" required />Estou ciente do aviso de privacidade *</label>
        <label><input type="checkbox" name="image_authorization" />Autorizo o uso da minha imagem em registros e divulgações do Lar da Bênção (opcional)</label>
      </fieldset>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className="button primary" type="submit" disabled={busy || !selected.length}>{busy ? "Enviando…" : "Enviar cadastro"}</button>
      {!selected.length ? <p className="small muted">Marque pelo menos um departamento para enviar.</p> : null}
    </form>
  );
}
