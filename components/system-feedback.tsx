"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const FETCH_MARK = Symbol.for("lar.systemFeedbackFetch");
// Chamadas de bastidor (registro de saída/troca de senha) não são ações do usuário na tela.
const SILENT_PATHS = new Set(["/api/auth/events"]);

type MarkedFetch = typeof fetch & { [FETCH_MARK]?: typeof fetch };
type Toast = { kind: "busy" | "done" | "error"; text: string } | null;

function apiPath(input: RequestInfo | URL) {
  const raw = input instanceof Request ? input.url : String(input);
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

/** Só gravações (POST/PUT/PATCH/DELETE) mostram o aviso; leituras ficam silenciosas. */
function isWrite(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  return method !== "GET" && method !== "HEAD";
}

export function SystemFeedback() {
  const pathname = usePathname();
  const [status, setStatus] = useState("");
  const [bar, setBar] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const skipPath = useRef(true);

  useEffect(() => {
    if (skipPath.current) {
      skipPath.current = false;
      return;
    }
    setStatus("");
    setBar(true);
    const timer = window.setTimeout(() => setBar(false), 900);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    let pending = 0;
    let failure = "";
    let clickAt = 0;
    let pressed: HTMLButtonElement | null = null;
    let loading: HTMLButtonElement | null = null;
    let hideTimer = 0;

    const clearButton = () => {
      loading?.classList.remove("is-loading");
      loading = null;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a.nav-link");
      if (link) {
        const label = link.querySelector(".nav-label")?.textContent?.trim() || "o módulo";
        setBar(true);
        setStatus(`Abrindo ${label}…`);
        return;
      }
      const button = target.closest(".app-main button");
      if (!(button instanceof HTMLButtonElement) || button.disabled || button.closest(".lar-toast")) return;
      pressed = button;
      clickAt = performance.now();
    };

    const start = () => {
      if (pending === 0) failure = "";
      pending += 1;
      window.clearTimeout(hideTimer);
      if (!loading && pressed && clickAt > 0 && performance.now() - clickAt <= 1500) {
        loading = pressed;
        loading.classList.add("is-loading");
      }
      setToast({ kind: "busy", text: "Processando…" });
    };

    const finish = (error?: string) => {
      if (error && !failure) failure = error;
      pending = Math.max(0, pending - 1);
      if (pending > 0) return;
      clearButton();
      pressed = null;
      clickAt = 0;
      if (failure) {
        setToast({ kind: "error", text: failure });
        return;
      }
      setToast({ kind: "done", text: "Processado." });
      hideTimer = window.setTimeout(() => setToast(null), 2500);
    };

    document.addEventListener("click", onClick, true);

    const current = window.fetch as MarkedFetch;
    if (!current[FETCH_MARK]) {
      const wrapped: MarkedFetch = async (input, init) => {
        const path = apiPath(input);
        const tracked = path !== null && !SILENT_PATHS.has(path) && isWrite(input, init);
        if (tracked) start();
        try {
          const response = await current(input, init);
          if (tracked) {
            if (response.ok) finish();
            else {
              const body = await response.clone().json().catch(() => null) as { error?: string } | null;
              finish(body?.error || "A operação falhou. Tente de novo.");
            }
          }
          return response;
        } catch (error) {
          if (tracked) finish("Sem resposta do sistema. Tente de novo.");
          throw error;
        }
      };
      wrapped[FETCH_MARK] = current;
      window.fetch = wrapped;
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(hideTimer);
      const active = window.fetch as MarkedFetch;
      if (active[FETCH_MARK]) window.fetch = active[FETCH_MARK];
    };
  }, []);

  return (
    <>
      <div className="route-progress" hidden={!bar} />
      <p className="ops-save" role="status" aria-live="polite">{status}</p>
      {toast ? (
        <div className={`lar-toast is-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"} aria-live={toast.kind === "error" ? "assertive" : "polite"}>
          <span className="lar-toast-icon" aria-hidden="true">{toast.kind === "done" ? "✓" : toast.kind === "error" ? "!" : ""}</span>
          <span>{toast.text}</span>
          {toast.kind === "error" ? <button type="button" className="lar-toast-close" aria-label="Fechar aviso" onClick={() => setToast(null)}>×</button> : null}
        </div>
      ) : null}
    </>
  );
}
