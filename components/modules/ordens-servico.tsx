"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api, postJson } from "@/lib/client-api";
import { uploadAttachment } from "@/lib/upload-client";

type Status = "open" | "in_progress" | "done" | "rejected" | "cancelled";
type Update = { id: string; kind: "created" | "status" | "note" | "cancel"; status: Status; note: string; created_at: string; created_by_name: string };
type Photo = { id: string; filename: string; status: "active" | "pending_scan"; uploaded_at: string };
type Order = {
  id: string; number: string; department_key: string; department_label: string; kind: string; priority: string; title: string;
  description: string; location: string; status: Status; requested_at: string; requested_by_name: string; updated_at: string;
  closed_at: string | null; version: number; asset_id: string | null; asset_tombamento: string | null; asset_description: string | null;
  updates: Update[]; photos: Photo[];
};
type Department = { key: string; label: string };
type Asset = { id: string; tombamento: string; description: string };
type Capabilities = { open: boolean; execute: boolean; requesterOf: string[] };

const STATUS: Record<Status, string> = { open: "Aberta", in_progress: "Em andamento", done: "Concluída", rejected: "Recusada", cancelled: "Cancelada" };
const STATUS_CLASS: Record<Status, string> = { open: "", in_progress: "building", done: "ready", rejected: "blocked", cancelled: "" };
const KINDS = ["Manutenção", "Conserto", "Instalação", "Limpeza", "Outro"];
const PRIORITIES = ["Baixa", "Normal", "Urgente"];
const ACTIVE: Status[] = ["open", "in_progress"];
const MAX_PHOTOS = 5;

const TZ = "America/Sao_Paulo";
const when = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
const day = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: TZ });

function updateLabel(u: Update) {
  if (u.kind === "created") return "OS aberta";
  if (u.kind === "cancel") return "Cancelada pelo departamento";
  if (u.kind === "status") return STATUS[u.status];
  return "Posição";
}

/** Foto do celular vira JPEG de até 1600 px: sobe rápido no 4G e cabe no limite do anexo. */
async function compressPhoto(file: File, index: number) {
  const name = `foto-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}-${index + 1}.jpg`;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (blob) return new File([blob], name, { type: "image/jpeg" });
  } catch { /* navegador sem suporte: tenta o arquivo original abaixo */ }
  if (["image/jpeg", "image/png"].includes(file.type)) return file;
  throw new Error("Não foi possível ler esta foto. Tire outra ou escolha uma imagem JPG ou PNG.");
}

/** Botões de câmera e galeria com miniaturas; no celular, "Tirar foto" abre a câmera traseira. */
function PhotoPicker({ files, onChange, max }: { files: File[]; onChange: (files: File[]) => void; max: number }) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const add = (list: FileList | null) => { if (list?.length) onChange([...files, ...Array.from(list)].slice(0, max)); };
  const full = files.length >= max;
  return (
    <div className="os-photo-picker">
      <div className="os-photo-buttons">
        <label className={`button primary${full ? " disabled" : ""}`}>
          📷 Tirar foto
          <input type="file" accept="image/*" capture="environment" hidden disabled={full} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
        <label className={`button${full ? " disabled" : ""}`}>
          🖼 Escolher da galeria
          <input type="file" accept="image/*" multiple hidden disabled={full} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {previews.length ? (
        <ul className="os-photo-grid">
          {previews.map((src, i) => (
            <li key={src}>
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) antes do envio */}
              <img src={src} alt={`Foto ${i + 1}`} />
              <button type="button" className="os-photo-remove" aria-label={`Remover foto ${i + 1}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="small muted">{full ? `Limite de ${max} fotos.` : `Até ${max} fotos.`}</p>
    </div>
  );
}

function PhotoGallery({ photos }: { photos: Photo[] }) {
  if (!photos.length) return <p className="small muted">Nenhuma foto.</p>;
  return (
    <ul className="os-photo-grid">
      {photos.map((p) => (
        <li key={p.id}>
          {p.status === "active" ? (
            <a href={`/api/attachments/${p.id}/download?inline=1`} target="_blank" rel="noreferrer" title="Abrir a foto">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem protegida servida pela API de anexos */}
              <img src={`/api/attachments/${p.id}/download?inline=1`} alt={p.filename} loading="lazy" />
            </a>
          ) : <span className="os-photo-pending">Em verificação</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Ordens de Serviço. `area="patrimonio"`: fila de todas as OS para executar.
 * Com `department`: só as OS daquele departamento. Sem nenhum dos dois: as OS dos departamentos do usuário.
 */
export function ServiceOrdersPanel({ area, department }: { area?: "patrimonio"; department?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [caps, setCaps] = useState<Capabilities>({ open: false, execute: false, requesterOf: [] });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // `?os=<id>` (link do Painel do Patrimônio) já abre aquela OS, também na navegação sem recarregar a página.
  const linked = useSearchParams().get("os");
  const [seenLinked, setSeenLinked] = useState<string | null>(null);
  if (linked && linked !== seenLinked) {
    setSeenLinked(linked);
    setOpenId(linked);
  }
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [morePhotos, setMorePhotos] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const focus = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q });
    if (department) params.set("department", department);
    const body = await api<{ orders: Order[]; departments: Department[]; assets: Asset[]; capabilities: Capabilities }>(`/api/patrimonio/os?${params}`);
    setOrders(body.orders);
    setDepartments(body.departments);
    setAssets(body.assets);
    setCaps(body.capabilities);
  }, [q, department]);

  useEffect(() => { const t = setTimeout(() => void load().catch((e) => setError(e.message)), 200); return () => clearTimeout(t); }, [load]);

  async function run(label: string, work: () => Promise<string>) {
    setBusy(label); setError(""); setMessage("");
    try { setMessage(await work()); }
    catch (e) { setError((e as Error).message); await load().catch(() => undefined); }
    finally { setBusy(""); }
  }

  /** Envia as fotos uma a uma; devolve quantas falharam (a OS já existe, então não desfaz nada). */
  async function sendPhotos(orderId: string, files: File[]) {
    let failed = 0;
    for (const [i, file] of files.entries()) {
      setBusy(`Enviando foto ${i + 1} de ${files.length}…`);
      try { await uploadAttachment(await compressPhoto(file, i), "service_order", orderId, undefined, "photo"); }
      catch { failed += 1; }
    }
    return failed;
  }

  const openDepartments = department ? departments.filter((d) => d.key === department) : departments;
  const canOpen = caps.open && openDepartments.length > 0;
  const current = orders.find((o) => o.id === openId) ?? null;
  // Leva a tela até o formulário ou a OS aberta (no celular eles ficam acima da lista), inclusive vindo do Painel.
  const showing = creating ? "new" : current?.id ?? "";
  useEffect(() => { if (showing) focus.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [showing]);
  const urgent = (o: Order) => ACTIVE.includes(o.status) && o.priority === "Urgente";
  const shown = orders.filter((o) => status === "active" ? ACTIVE.includes(o.status) : status === "urgent" ? urgent(o) : !status || o.status === status);
  const count = (s: Status) => orders.filter((o) => o.status === s).length;
  const canWrite = (o: Order) => ACTIVE.includes(o.status) && (caps.execute || caps.requesterOf.includes(o.department_key));

  function show(id: string | null) { setOpenId(id); setCreating(false); setMorePhotos([]); }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    void run("Abrindo a OS…", async () => {
      const saved = await postJson<{ id: string; number: string }>("/api/patrimonio/os", {
        department_key: data.get("department_key"), kind: data.get("kind"), priority: data.get("priority"), title: data.get("title"),
        description: data.get("description"), location: data.get("location"), asset_id: data.get("asset_id") ?? ""
      });
      const failed = await sendPhotos(saved.id, newPhotos);
      form.reset();
      setNewPhotos([]);
      setCreating(false);
      await load();
      setOpenId(saved.id);
      return failed
        ? `OS ${saved.number} aberta, mas ${failed} foto(s) não subiram. Abra a OS e envie de novo.`
        : `OS ${saved.number} aberta e enviada ao Patrimônio.`;
    });
  }

  function submitMorePhotos() {
    const target = current!;
    void run("Enviando fotos…", async () => {
      const failed = await sendPhotos(target.id, morePhotos);
      setMorePhotos([]);
      await load();
      return failed ? `${failed} foto(s) não subiram. Tente de novo.` : "Fotos adicionadas à OS.";
    });
  }

  function submitAction(event: FormEvent<HTMLFormElement>, action: "status" | "note" | "cancel") {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    const target = current!;
    void run("Registrando…", async () => {
      const result = await postJson<{ status: Status }>(`/api/patrimonio/os/${target.id}`, {
        action, version: target.version, status: data.get("status") ?? undefined, note: data.get("note") ?? ""
      });
      form.reset();
      await load();
      if (action === "note") return "Posição registrada.";
      if (action === "cancel") return "OS cancelada. Ela continua no histórico.";
      return `OS ${target.number}: ${STATUS[result.status]}.`;
    });
  }

  return (
    <div className="grid os-panel">
      <div className="toolbar">
        <p className="small muted">
          {area === "patrimonio"
            ? "Pedidos de serviço de todos os departamentos. Mude a situação e escreva a posição para quem abriu acompanhar."
            : "Peça um serviço ao Patrimônio (conserto, manutenção, instalação) com fotos do local e acompanhe a posição por aqui."}
        </p>
        {canOpen ? <button type="button" className="button primary no-print os-open-button" onClick={() => { setCreating(true); setOpenId(null); }}>+ Abrir OS</button> : null}
      </div>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {busy ? <div className="notice" role="status">{busy}</div> : null}
      {/* Os números também filtram a lista: toque em "Abertas" para ver só as abertas; de novo, volta às em aberto. */}
      <div className="grid cards os-filter-cards" role="group" aria-label="Filtrar por situação">
        {([["open", "Abertas", count("open")], ["in_progress", "Em andamento", count("in_progress")],
          ["urgent", "Urgentes em aberto", orders.filter(urgent).length], ["done", "Concluídas", count("done")]] as const).map(([key, label, total]) => (
          <button key={key} type="button" className="card kpi" aria-pressed={status === key} onClick={() => setStatus(status === key ? "active" : key)}>
            <span className="small">{label}</span><b>{total}</b>
          </button>
        ))}
      </div>

      {creating ? (
        <section className="card no-print" aria-label="Abrir ordem de serviço" ref={focus}>
          <h2>Abrir ordem de serviço</h2>
          <p className="small muted">A OS recebe um número e vai direto para o Patrimônio.</p>
          <form className="form-stack" onSubmit={submitCreate}>
            <div className="form-row">
              <label style={{ gridColumn: "1 / -1" }}>O que precisa ser feito? *<input name="title" required maxLength={150} placeholder="Ex.: Trocar a lâmpada da sala 2" /></label>
              <label style={{ gridColumn: "1 / -1" }}>Onde é o serviço? *<input name="location" required maxLength={200} placeholder="Ex.: Salão principal, banheiro feminino" /></label>
            </div>
            <fieldset className="os-fieldset">
              <legend>Fotos do local</legend>
              <PhotoPicker files={newPhotos} onChange={setNewPhotos} max={MAX_PHOTOS} />
            </fieldset>
            <div className="form-row">
              <label>Departamento *
                <select name="department_key" required defaultValue={openDepartments.length === 1 ? openDepartments[0].key : ""}>
                  {openDepartments.length > 1 ? <option value="">Selecione</option> : null}
                  {openDepartments.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label>Tipo de serviço *
                <select name="kind" required defaultValue="">
                  <option value="">Selecione</option>
                  {KINDS.map((k) => <option key={k}>{k}</option>)}
                </select>
              </label>
              <label>Urgência *
                <select name="priority" required defaultValue="Normal">{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              <label>Bem do patrimônio (se houver)
                <select name="asset_id" defaultValue="">
                  <option value="">Nenhum</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.tombamento} — {a.description}</option>)}
                </select>
              </label>
              <label style={{ gridColumn: "1 / -1" }}>Descrição *<textarea name="description" required maxLength={2000} rows={4} placeholder="Conte o que está acontecendo." /></label>
            </div>
            <div className="row-actions os-actions">
              <button type="button" className="button" onClick={() => { setCreating(false); setNewPhotos([]); }}>Cancelar</button>
              <button className="button primary" disabled={Boolean(busy)}>Abrir OS{newPhotos.length ? ` com ${newPhotos.length} foto(s)` : ""}</button>
            </div>
          </form>
        </section>
      ) : null}

      {current ? (
        <section className="card" aria-label={`OS ${current.number}`} ref={focus}>
          <div className="toolbar">
            <h2>OS {current.number} — {current.title}</h2>
            <div className="row-actions no-print">
              <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
              <button type="button" className="button" onClick={() => show(null)}>Fechar</button>
            </div>
          </div>
          <p><span className={`status ${STATUS_CLASS[current.status]}`}>{STATUS[current.status]}</span>{current.priority === "Urgente" ? <> <span className="status blocked">Urgente</span></> : null}</p>
          <dl className="details-grid">
            {([
              ["Onde", current.location], ["Departamento", current.department_label], ["Tipo de serviço", current.kind], ["Urgência", current.priority],
              ["Bem do patrimônio", current.asset_tombamento ? `${current.asset_tombamento} — ${current.asset_description}` : ""],
              ["Aberta por", `${current.requested_by_name} · ${when(current.requested_at)}`]
            ] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "Não informado"}</dd></div>)}
          </dl>
          <h3>Descrição</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{current.description}</p>
          <h3>Fotos</h3>
          <PhotoGallery photos={current.photos} />
          {canWrite(current) ? (
            <div className="no-print os-more-photos">
              <PhotoPicker files={morePhotos} onChange={setMorePhotos} max={Math.max(0, MAX_PHOTOS * 2 - current.photos.length)} />
              {morePhotos.length ? <button type="button" className="button primary" disabled={Boolean(busy)} onClick={submitMorePhotos}>Enviar {morePhotos.length} foto(s)</button> : null}
            </div>
          ) : null}
          <h3>Posição</h3>
          <ol className="os-timeline">
            {current.updates.map((u) => (
              <li key={u.id}>
                <strong>{updateLabel(u)}</strong> <span className="small muted">· {u.created_by_name} · {when(u.created_at)}</span>
                {u.note ? <p>{u.note}</p> : null}
              </li>
            ))}
          </ol>

          {ACTIVE.includes(current.status) && caps.execute ? (
            <form className="form-stack no-print" onSubmit={(e) => submitAction(e, "status")}>
              <h3>Mudar a situação</h3>
              <div className="form-row">
                <label>Nova situação *
                  <select name="status" required defaultValue="">
                    <option value="">Selecione</option>
                    {current.status === "open" ? <option value="in_progress">Em andamento</option> : null}
                    <option value="done">Concluída</option>
                    <option value="rejected">Recusada</option>
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>Posição (obrigatória para concluir ou recusar)<textarea name="note" maxLength={2000} rows={3} /></label>
              </div>
              <div className="os-actions"><button className="button primary" disabled={Boolean(busy)}>Registrar</button></div>
            </form>
          ) : null}

          {canWrite(current) ? (
            <form className="form-stack no-print" onSubmit={(e) => submitAction(e, "note")}>
              <h3>Escrever uma posição</h3>
              <label>Mensagem *<textarea name="note" required maxLength={2000} rows={2} placeholder="Ex.: Material comprado, serviço na próxima semana." /></label>
              <div className="os-actions"><button className="button" disabled={Boolean(busy)}>Registrar posição</button></div>
            </form>
          ) : null}

          {current.status === "open" && caps.requesterOf.includes(current.department_key) ? (
            <form className="form-stack no-print" onSubmit={(e) => submitAction(e, "cancel")}>
              <h3>Cancelar a OS</h3>
              <p className="small muted">Só enquanto o Patrimônio ainda não começou. A OS fica no histórico.</p>
              <label>Motivo do cancelamento *<textarea name="note" required minLength={3} maxLength={2000} rows={2} /></label>
              <div className="os-actions"><button className="button" disabled={Boolean(busy)}>Cancelar OS</button></div>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="card no-print">
        <div className="filters">
          <label>Buscar OS<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, serviço, local ou tombamento" /></label>
          <label>Situação
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Em aberto</option>
              <option value="urgent">Urgentes em aberto</option>
              <option value="">Todas</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="table-wrap os-table">
          <table>
            <thead><tr><th>OS / data</th><th>Serviço</th>{department ? null : <th>Departamento</th>}<th>Urgência</th><th>Situação</th><th>Última posição</th><th>Ações</th></tr></thead>
            <tbody>
              {shown.map((o) => {
                const last = o.updates[o.updates.length - 1];
                return (
                  <tr key={o.id}>
                    <td><strong>{o.number}</strong><br /><span className="small">{day(o.requested_at)}</span></td>
                    <td>{o.title}<br /><span className="small">{o.kind}{o.location ? ` · ${o.location}` : ""}{o.photos.length ? ` · 📷 ${o.photos.length}` : ""}</span></td>
                    {department ? null : <td>{o.department_label}</td>}
                    <td>{o.priority === "Urgente" ? <span className="status blocked">Urgente</span> : o.priority}</td>
                    <td><span className={`status ${STATUS_CLASS[o.status]}`}>{STATUS[o.status]}</span></td>
                    <td>{last ? <><span className="small">{day(last.created_at)}</span>{last.note ? <><br /><span className="small">{last.note.slice(0, 80)}{last.note.length > 80 ? "…" : ""}</span></> : null}</> : "—"}</td>
                    <td><button type="button" className="button" onClick={() => show(o.id)}>{caps.execute && ACTIVE.includes(o.status) ? "Atender" : "Consultar"}</button></td>
                  </tr>
                );
              })}
              {!shown.length ? <tr><td colSpan={department ? 6 : 7}>Nenhuma OS encontrada.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {/* No celular a lista vira cartões que se tocam inteiros. */}
        <ul className="os-cards">
          {shown.map((o) => (
            <li key={o.id}>
              <button type="button" className="os-card" onClick={() => show(o.id)}>
                <span className="os-card-head"><strong>{o.number}</strong><span className={`status ${STATUS_CLASS[o.status]}`}>{STATUS[o.status]}</span></span>
                <span className="os-card-title">{o.title}</span>
                <span className="small muted">
                  {o.location ? `${o.location} · ` : ""}{department ? "" : `${o.department_label} · `}{day(o.requested_at)}{o.photos.length ? ` · 📷 ${o.photos.length}` : ""}
                </span>
                {o.priority === "Urgente" ? <span className="status blocked">Urgente</span> : null}
              </button>
            </li>
          ))}
          {!shown.length ? <li className="small muted">Nenhuma OS encontrada.</li> : null}
        </ul>
      </section>
    </div>
  );
}
