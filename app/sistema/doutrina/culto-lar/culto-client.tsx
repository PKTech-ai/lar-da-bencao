"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Entry = { id: string; visit_date: string; host_name: string; visitors_count: number; notes: string };

export function CultoLarClient() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/culto-lar", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setRows(body.entries);
  }, []);
  // A carga inicial sincroniza esta tela cliente com a API protegida.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = event.currentTarget; const values = new FormData(form);
    try {
      const response = await fetch("/api/culto-lar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visit_date: values.get("visit_date"),
          host_name: values.get("host_name"),
          visitors_count: Number(values.get("visitors_count") || 0),
          notes: values.get("notes")
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      form.reset(); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Falha."); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Registrar culto</h2>
        <form className="form-stack" onSubmit={create}>
          <label>Data<input name="visit_date" type="date" required /></label>
          <label>Anfitrião<input name="host_name" required /></label>
          <label>Participantes<input name="visitors_count" type="number" min={0} defaultValue={0} /></label>
          <label>Observações<textarea name="notes" rows={2} /></label>
          <button className="button primary" disabled={busy}>Salvar</button>
        </form>
      </section>
      {error ? <div className="error">{error}</div> : null}
      <section className="card">
        <h2>Registros</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Anfitrião</th><th>Participantes</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}><td>{row.visit_date}</td><td>{row.host_name}</td><td>{row.visitors_count}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
