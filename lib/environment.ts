/** Ambiente de execução exibido na interface (BL-059: nunca parecer produção fora dela). */
export function runtimeEnvironment() {
  const env = process.env.VERCEL_ENV;
  if (env === "production") return { production: true, label: "Produção · Vercel" } as const;
  return { production: false, label: env === "preview" ? "Pré-visualização — não usar dados reais" : "Ambiente local — somente dados sintéticos" } as const;
}
