/** Upload fracionado para /api/attachments (navegador): init → partes → finalize (hash + antimalware). */
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  csv: "text/csv", ofx: "application/x-ofx", webm: "audio/webm", ogg: "audio/ogg"
};

export async function uploadAttachment(file: File, ownerType: string, ownerId: string, onProgress?: (percent: number) => void) {
  const mimeType = file.type || mimeByExtension[file.name.split(".").pop()?.toLowerCase() ?? ""] || "application/octet-stream";
  const digest = hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  const init = await fetch("/api/attachments/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerType, ownerId, filename: file.name, mimeType, sizeBytes: file.size, sha256: digest })
  });
  const created = await init.json();
  if (!init.ok) throw new Error(created.error);
  for (let part = 0; part < created.chunkCount; part += 1) {
    const chunk = file.slice(part * created.chunkSize, Math.min(file.size, (part + 1) * created.chunkSize));
    const sent = await fetch(`/api/attachments/${created.id}/chunks/${part}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream", "X-Upload-Token": created.token },
      body: chunk
    });
    const sentBody = await sent.json();
    if (!sent.ok) throw new Error(sentBody.error);
    onProgress?.(Math.round(((part + 1) / created.chunkCount) * 85));
  }
  const final = await fetch(`/api/attachments/${created.id}/finalize`, { method: "POST", headers: { "X-Upload-Token": created.token } });
  const finalBody = await final.json();
  if (!final.ok) throw new Error(finalBody.error);
  onProgress?.(100);
  return created.id as string;
}
