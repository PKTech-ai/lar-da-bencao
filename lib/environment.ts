/**
 * Ambiente de execução (BL-059: nunca parecer produção fora dela).
 * O rascunho (preview) usa o banco de produção, então conta como produção nas travas de dados.
 */
export function runtimeEnvironment() {
  const env = process.env.VERCEL_ENV;
  if (env === "production") return { production: true, label: "Produção · Vercel" } as const;
  if (env === "preview") return { production: true, label: "Rascunho · dados reais" } as const;
  return { production: false, label: "Ambiente local — somente dados sintéticos" } as const;
}
