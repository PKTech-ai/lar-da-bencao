"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

/**
 * Leitura de QR pela câmera traseira. Usa o leitor do próprio navegador (BarcodeDetector, Android/Chrome)
 * e, quando ele não existe (iPhone), o jsQR carregado sob demanda.
 */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const result = useRef(onResult);
  useEffect(() => { result.current = onResult; }, [onResult]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    const canvas = document.createElement("canvas");

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        setError("Não foi possível abrir a câmera. Permita o uso da câmera ou digite o código.");
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      const native = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped || !video.current) return;
        const v = video.current;
        if (v.readyState >= 2 && v.videoWidth) {
          let text: string | null = null;
          if (native) {
            const codes = await native.detect(v).catch(() => []);
            text = codes[0]?.rawValue ?? null;
          } else if (jsQR) {
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            const c = canvas.getContext("2d", { willReadFrequently: true });
            if (c) {
              c.drawImage(v, 0, 0, canvas.width, canvas.height);
              const image = c.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          }
          if (text) { result.current(text); return; }
        }
        timer = window.setTimeout(tick, 180);
      };
      void tick();
    }
    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="ing-step">
      {error ? <div className="error" role="alert">{error}</div> : <video ref={video} playsInline muted aria-label="Câmera para ler o QR do ticket" />}
      <button type="button" className="ing-btn" onClick={onClose}>Fechar câmera</button>
    </div>
  );
}
