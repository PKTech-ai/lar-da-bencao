"use client";

import { useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/client-api";
import { brDate } from "@/lib/resources/types";
import { uploadAttachment } from "@/lib/upload-client";

type Meeting = { id: string; title: string; meeting_date: string; transcript: string; version: number };
type Audio = { id: string; filename: string; size_bytes: string; status: string; uploaded_at: string };

type SpeechResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechEventLike = { resultIndex: number; results: { length: number } & Record<number, SpeechResultLike> };
type RecognitionLike = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: SpeechEventLike) => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };

const clock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map((v) => String(v).padStart(2, "0")).join(":");
};

/**
 * Grava a reunião no navegador e guarda o áudio no banco, vinculado à reunião.
 * A transcrição ao vivo usa o reconhecimento do próprio navegador, quando houver.
 */
export function MeetingRecorder() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingId, setMeetingId] = useState("");
  const [audios, setAudios] = useState<Audio[]>([]);
  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [progress, setProgress] = useState(0);
  const [savedAt, setSavedAt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recognition = useRef<RecognitionLike | null>(null);
  const startedAt = useRef(0);

  const meeting = meetings.find((m) => m.id === meetingId);

  useEffect(() => {
    void api<{ records: Meeting[] }>("/api/r/secretaria-reunioes").then((b) => setMeetings(b.records)).catch((e: Error) => setError(e.message));
  }, []);

  function changeTranscript(value: string) {
    setTranscript(value);
    setDirty(true);
  }

  function selectMeeting(id: string) {
    setMeetingId(id);
    setDirty(false);
    setTranscript(meetings.find((m) => m.id === id)?.transcript ?? "");
    setAudios([]);
    if (id) void api<{ attachments: Audio[] }>(`/api/attachments?ownerType=meeting_audio&ownerId=${id}`).then((b) => setAudios(b.attachments)).catch(() => setAudios([]));
  }

  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt.current), 500);
    return () => clearInterval(timer);
  }, [state]);

  function startRecognition() {
    const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Engine = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Engine) return;
    const engine = new Engine();
    engine.continuous = true;
    engine.interimResults = false;
    engine.lang = "pt-BR";
    engine.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) if (event.results[i].isFinal) text += `${event.results[i][0].transcript} `;
      if (text) {
        setTranscript((current) => `${current}${current && !current.endsWith("\n") ? "\n" : ""}${text.trim()}`);
        setDirty(true);
      }
    };
    engine.onerror = () => undefined;
    engine.start();
    recognition.current = engine;
  }

  async function start() {
    setError(""); setMessage("");
    if (!meetingId) { setError("Selecione a reunião antes de gravar."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream, MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined);
      chunks.current = [];
      media.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      media.onstop = () => { stream.getTracks().forEach((track) => track.stop()); void upload(); };
      media.onstart = () => { startedAt.current = Date.now(); setElapsed(0); setState("recording"); startRecognition(); };
      media.onresume = () => { startedAt.current = Date.now() - elapsed; setState("recording"); startRecognition(); };
      media.onpause = () => { recognition.current?.stop(); setState("paused"); };
      media.start(1000);
      recorder.current = media;
    } catch {
      setError("Não foi possível acessar o microfone. Conceda a permissão no navegador.");
    }
  }

  function pause() {
    if (!recorder.current) return;
    if (state === "recording") recorder.current.pause();
    else recorder.current.resume();
  }

  function stop() {
    recognition.current?.stop();
    recorder.current?.stop();
    setState("idle");
  }

  async function upload() {
    const blob = new Blob(chunks.current, { type: "audio/webm" });
    if (!blob.size) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const file = new File([blob], `reuniao-${stamp}.webm`, { type: "audio/webm" });
    try {
      setMessage("Enviando o áudio para o banco…");
      await uploadAttachment(file, "meeting_audio", meetingId, (value) => setProgress(value), "audio");
      const list = await api<{ attachments: Audio[] }>(`/api/attachments?ownerType=meeting_audio&ownerId=${meetingId}`);
      setAudios(list.attachments);
      setMessage(`Áudio de ${clock(elapsed)} guardado na reunião.`);
    } catch (caught) {
      setError(`O áudio não foi enviado: ${(caught as Error).message}`);
    } finally {
      setProgress(0);
    }
  }

  async function saveTranscript(silent = false) {
    if (!meeting) return;
    if (!silent) { setError(""); setMessage(""); }
    try {
      await postJson(`/api/r/secretaria-reunioes/${meeting.id}`, { ...meeting, transcript, version: meeting.version }, "PATCH");
      const body = await api<{ records: Meeting[] }>("/api/r/secretaria-reunioes");
      setMeetings(body.records);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
      if (!silent) setMessage("Transcrição salva na reunião.");
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  // Autosave no banco (nunca no navegador) a cada 20 s com texto pendente.
  useEffect(() => {
    if (!dirty || !meetingId) return;
    const timer = setTimeout(() => { void saveTranscript(true); }, 20_000);
    return () => clearTimeout(timer);
  });

  // Avisa antes de sair com texto ainda não gravado.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div className="grid">
      <p className="small muted">A gravação acontece neste aparelho e o arquivo é guardado no banco, vinculado à reunião. A ata continua sendo escrita por quem secretaria — o sistema não inventa decisões.</p>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <section className="card">
        <div className="filters">
          <label>Reunião
            <select value={meetingId} onChange={(e) => selectMeeting(e.target.value)} disabled={state !== "idle"}>
              <option value="">Selecione a reunião</option>
              {meetings.map((m) => <option key={m.id} value={m.id}>{brDate(m.meeting_date)} — {m.title}</option>)}
            </select>
          </label>
          <div className="row-actions">
            {state === "idle"
              ? <button type="button" className="button primary" onClick={() => void start()} disabled={!meetingId}>● Gravar</button>
              : <>
                <button type="button" className="button" onClick={pause}>{state === "paused" ? "Retomar" : "Pausar"}</button>
                <button type="button" className="button danger" onClick={stop}>Parar e guardar</button>
              </>}
          </div>
          <p role="status"><strong>{clock(elapsed)}</strong>{state === "recording" ? " · gravando" : state === "paused" ? " · pausada" : ""}{progress ? ` · enviando ${progress}%` : ""}</p>
        </div>
      </section>
      {meetingId ? (
        <>
          <section className="card">
            <h3>Áudios desta reunião</h3>
            {audios.map((a) => (
              <div key={a.id} className="toolbar small">
                <span>{a.filename} · {Math.ceil(Number(a.size_bytes) / 1024)} KB · {a.status === "active" ? new Date(a.uploaded_at).toLocaleString("pt-BR") : a.status === "quarantined" ? "bloqueado pela inspeção" : "em inspeção"}</span>
                {a.status === "active" ? <a className="button" href={`/api/attachments/${a.id}/download`}>Baixar</a> : null}
              </div>
            ))}
            {!audios.length ? <p className="small muted">Nenhum áudio guardado.</p> : null}
          </section>
          <section className="card">
            <h3>Transcrição</h3>
            <textarea value={transcript} onChange={(e) => changeTranscript(e.target.value)} rows={12} maxLength={100000} />
            <div className="row-actions">
              <button type="button" className="button primary" onClick={() => void saveTranscript()}>Salvar transcrição na reunião</button>
              <span className="small muted" role="status">{dirty ? "Alterações ainda não salvas — o sistema grava sozinho em alguns segundos." : savedAt ? `Salvo às ${savedAt}.` : ""}</span>
            </div>
            <p className="small muted">A transcrição ao vivo depende do reconhecimento de voz do navegador; onde não houver, digite as anotações aqui.</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
