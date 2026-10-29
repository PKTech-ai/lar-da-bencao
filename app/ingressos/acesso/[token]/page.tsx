import { notFound } from "next/navigation";
import { AccessGate } from "@/components/ingressos/acesso-gate";
import { isFlagEnabled } from "@/lib/feature-flags";
import { FLAG } from "@/lib/ingressos/acesso";

export const dynamic = "force-dynamic";

/** Link pessoal do trabalhador: primeiro acesso cria o PIN; depois, só o PIN. */
export default async function AccessPage({ params }: { params: Promise<{ token: string }> }) {
  if (!(await isFlagEnabled(FLAG))) notFound();
  const { token } = await params;
  return <AccessGate token={token} />;
}
