"use client";

import { type FormEvent, useState } from "react";
import { DOCTRINE_FUNCTIONS, WEEKDAYS } from "@/lib/worker-constants";

export type Option = { key: string; label: string };

export type FichaValues = {
  full_name: string; email: string | null; phone: string | null; birth_date: string | null;
  naturality: string | null; marital_status: string | null; profession: string | null; address: string | null;
  filled_date: string | null; volunteer_service: string; accepts_volunteer_law: boolean; image_authorization: boolean;
  functions: string[]; available_days: number[]; departments: string[]; notes: string;
};

const dateOnly = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : "");

export function readFicha(form: HTMLFormElement) {
  const values = new FormData(form);
  const text = (name: string) => String(values.get(name) ?? "");
  return {
    full_name: text("full_name"),
    email: text("email"),
    phone: text("phone"),
    birth_date: text("birth_date"),
    naturality: text("naturality"),
    marital_status: text("marital_status"),
    profession: text("profession"),
    address: text("address"),
    filled_date: text("filled_date"),
    volunteer_service: text("volunteer_service"),
    accepts_volunteer_law: values.get("accepts_volunteer_law") === "on",
    image_authorization: values.get("image_authorization") === "on",
    functions: values.getAll("functions").map(String),
    available_days: values.getAll("available_days").map(Number),
    departments: values.getAll("departments").map(String),
    notes: text("notes")
  };
}

export function WorkerFichaForm({
  departments, initial, originOptions, submitLabel, busy, notice, onSubmit, onCancel
}: {
  departments: Option[];
  initial?: FichaValues;
  /** Departamentos que o usuário pode indicar como solicitante (somente no cadastro). */
  originOptions?: Option[];
  submitLabel: string;
  busy: boolean;
  notice?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(initial?.departments ?? (originOptions?.[0] ? [originOptions[0].key] : []));
  const doctrine = selected.includes("doutrina");
  const toggle = (key: string, checked: boolean) => setSelected((current) => (checked ? [...current, key] : current.filter((item) => item !== key)));

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      {notice ? <div className="notice">{notice}</div> : null}
      {originOptions ? (
        <label>Departamento solicitante
          <select name="origin_department" defaultValue={originOptions[0]?.key} onChange={(event) => { const key = event.target.value; if (!selected.includes(key)) toggle(key, true); }}>
            {originOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
      ) : null}
      <div className="form-row">
        <label>Nome completo *<input name="full_name" defaultValue={initial?.full_name} required minLength={2} maxLength={160} /></label>
        <label>Telefone<input name="phone" defaultValue={initial?.phone ?? ""} maxLength={40} inputMode="tel" /></label>
        <label>E-mail<input name="email" type="email" defaultValue={initial?.email ?? ""} /></label>
      </div>
      <div className="form-row">
        <label>Data de nascimento<input name="birth_date" type="date" defaultValue={dateOnly(initial?.birth_date)} /></label>
        <label>Naturalidade<input name="naturality" defaultValue={initial?.naturality ?? ""} maxLength={120} /></label>
        <label>Estado civil<input name="marital_status" defaultValue={initial?.marital_status ?? ""} maxLength={40} /></label>
        <label>Profissão<input name="profession" defaultValue={initial?.profession ?? ""} maxLength={120} /></label>
      </div>
      <div className="form-row">
        <label>Endereço<input name="address" defaultValue={initial?.address ?? ""} maxLength={300} /></label>
        <label>Preenchimento da ficha<input name="filled_date" type="date" defaultValue={dateOnly(initial?.filled_date)} /></label>
      </div>
      <fieldset className="check-grid">
        <legend>Departamentos em que atuará *</legend>
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
          {DOCTRINE_FUNCTIONS.map((fn) => (
            <label key={fn}><input type="checkbox" name="functions" value={fn} defaultChecked={initial?.functions.includes(fn)} />{fn}</label>
          ))}
        </fieldset>
      ) : null}
      <fieldset className="check-grid">
        <legend>Dias disponíveis</legend>
        {WEEKDAYS.map((day, index) => (
          <label key={day}><input type="checkbox" name="available_days" value={index} defaultChecked={(initial?.available_days ?? [0, 1, 3, 4, 5, 6]).includes(index)} />{day}</label>
        ))}
      </fieldset>
      <label>Serviço voluntário<textarea name="volunteer_service" rows={2} maxLength={2000} defaultValue={initial?.volunteer_service ?? ""} placeholder="Descrição das atividades voluntárias" /></label>
      <fieldset className="check-grid">
        <legend>Termos</legend>
        <label><input type="checkbox" name="accepts_volunteer_law" defaultChecked={initial?.accepts_volunteer_law} />Termo de voluntariado (Lei 9.608/98) aceito</label>
        <label><input type="checkbox" name="image_authorization" defaultChecked={initial?.image_authorization} />Autorização de uso de imagem</label>
      </fieldset>
      <label>Observações<textarea name="notes" rows={2} maxLength={2000} defaultValue={initial?.notes ?? ""} /></label>
      <div className="row-actions">
        <button className="button primary" disabled={busy || !selected.length}>{submitLabel}</button>
        {onCancel ? <button type="button" className="button" onClick={onCancel}>Cancelar</button> : null}
      </div>
    </form>
  );
}
