/**
 * Links dos materiais ESE na pasta compartilhada do OneDrive.
 * O compartilhamento ("qualquer pessoa com o link") fica só na variável ONEDRIVE_ESE_SHARE, fora do repositório;
 * cada estudo guarda o caminho do arquivo dentro da pasta ESE (coluna app.studies.onedrive).
 */
const DOCUMENTS = "/personal/699c14a510e3c852/Documents";
const ESE_ROOT = `${DOCUMENTS}/CENTRO ESPIRITA/DPTO DE DOUTRINA/ESE`;

export const ONEDRIVE_KINDS = ["roteiro", "perguntas", "texto"] as const;
export type OneDriveKind = (typeof ONEDRIVE_KINDS)[number];
export type OneDriveLinks = Partial<Record<OneDriveKind, string>>;

/** O OneDrive abre um arquivo da pasta compartilhada com o próprio link de compartilhamento em base64 ("redeem"). */
export function oneDriveFileUrl(share: string, relativePath: string) {
  const redeem = Buffer.from(share).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const id = `${ESE_ROOT}/${relativePath}`;
  const parent = id.slice(0, id.lastIndexOf("/"));
  return `https://onedrive.live.com/?redeem=${redeem}&id=${encodeURIComponent(id)}&parent=${encodeURIComponent(parent)}`
    + `&listurl=${encodeURIComponent(DOCUMENTS)}&ga=1`;
}

/** Sem a variável configurada, os links simplesmente não aparecem. */
export function oneDriveLinks(files: unknown, share = process.env.ONEDRIVE_ESE_SHARE): OneDriveLinks | null {
  if (!share || !files || typeof files !== "object") return null;
  const links: OneDriveLinks = {};
  for (const kind of ONEDRIVE_KINDS) {
    const path = (files as Record<string, unknown>)[kind];
    if (typeof path === "string" && path && !path.includes("..")) links[kind] = oneDriveFileUrl(share, path);
  }
  return Object.keys(links).length ? links : null;
}
