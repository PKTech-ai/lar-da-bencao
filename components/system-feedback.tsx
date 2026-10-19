"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const FETCH_MARK = Symbol.for("lar.systemFeedbackFetch");

type MarkedFetch = typeof fetch & { [FETCH_MARK]?: typeof fetch };

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

export function SystemFeedback() {
  const pathname = usePathname();
  const [status, setStatus] = useState("Pronto para uso");
  const [alert, setAlert] = useState("");
  const [bar, setBar] = useState(false);
  const skipPath = useRef(true);

  useEffect(() => {
    if (skipPath.current) {
      skipPath.current = false;
      return;
    }
    setAlert("");
    setStatus("Módulo aberto.");
    setBar(true);
    const timer = window.setTimeout(() => setBar(false), 900);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    let pending = 0;
    let clickAt = 0;
    let button: HTMLButtonElement | null = null;
    let idleTimer = 0;
    let epoch = 0;

    const clearButton = () => {
      button?.classList.remove("is-loading");
      button = null;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a.nav-link");
      if (link) {
        epoch += 1;
        const label = link.querySelector(".nav-label")?.textContent?.trim() || "o módulo";
        setAlert("");
        setBar(true);
        setStatus(`Abrindo ${label}…`);
        return;
      }
      const pressed = target.closest(".app-main button");
      if (!(pressed instanceof HTMLButtonElement) || pressed.disabled) return;
      epoch += 1;
      const mark = epoch;
      clearButton();
      button = pressed;
      pressed.classList.add("is-loading");
      clickAt = performance.now();
      setAlert("");
      setStatus("Aguarde, registrando sua ação…");
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (mark !== epoch || pending > 0) return;
        clearButton();
        clickAt = 0;
        setStatus("");
      }, 600);
    };

    const finish = async (response: Response, mark: number) => {
      pending = Math.max(0, pending - 1);
      if (pending > 0 || mark !== epoch) return;
      clearButton();
      clickAt = 0;
      if (response.ok) {
        setAlert("");
        setStatus("Pronto. Ação registrada.");
        return;
      }
      const body = await response.clone().json().catch(() => null) as { error?: string } | null;
      setStatus("");
      setAlert(body?.error || "A operação falhou. Tente de novo.");
    };

    const failNetwork = (mark: number) => {
      pending = Math.max(0, pending - 1);
      if (pending > 0 || mark !== epoch) return;
      clearButton();
      clickAt = 0;
      setStatus("");
      setAlert("Sem resposta do sistema. Tente de novo.");
    };

    document.addEventListener("click", onClick, true);

    const current = window.fetch as MarkedFetch;
    if (!current[FETCH_MARK]) {
      const wrapped: MarkedFetch = async (input, init) => {
        const tracked = clickAt > 0 && performance.now() - clickAt <= 1500 && apiPath(input) !== null;
        const mark = epoch;
        if (tracked) {
          pending += 1;
          window.clearTimeout(idleTimer);
        }
        try {
          const response = await current(input, init);
          if (tracked) await finish(response, mark);
          return response;
        } catch (error) {
          if (tracked) failNetwork(mark);
          throw error;
        }
      };
      wrapped[FETCH_MARK] = current;
      window.fetch = wrapped;
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(idleTimer);
      const active = window.fetch as MarkedFetch;
      if (active[FETCH_MARK]) window.fetch = active[FETCH_MARK];
    };
  }, []);

  return (
    <>
      <div className="route-progress" hidden={!bar} />
      {alert
        ? <p className="error" role="alert">{alert}</p>
        : <p className="ops-save" role="status" aria-live="polite">{status}</p>}
    </>
  );
}
