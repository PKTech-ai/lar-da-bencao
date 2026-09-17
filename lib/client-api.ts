/** Chamada JSON do navegador para as APIs do sistema; lança Error com a mensagem do servidor. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error ?? "Falha na operação."), { code: body.code as string | undefined });
  return body as T;
}

export const postJson = <T>(url: string, body: unknown, method = "POST") => api<T>(url, { method, body: JSON.stringify(body) });

export function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
