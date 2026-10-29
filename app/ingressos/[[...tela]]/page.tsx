import { notFound } from "next/navigation";
import { IngressosApp } from "@/components/ingressos/app";
import { AccessEnded } from "@/components/ingressos/acesso-gate";
import { isFlagEnabled } from "@/lib/feature-flags";
import { FLAG, sellerFromCookies } from "@/lib/ingressos/acesso";

export const dynamic = "force-dynamic";

/** App do trabalhador: Vender e Minhas vendas, presos ao evento do convite. */
export default async function SellerPage({ params }: { params: Promise<{ tela?: string[] }> }) {
  if (!(await isFlagEnabled(FLAG))) notFound();
  const { tela = [] } = await params;
  if (tela.length > 2) notFound();
  const seller = await sellerFromCookies();
  if (!seller) return <AccessEnded text="Abra o link de acesso que a coordenação enviou e digite o seu PIN." />;
  return <IngressosApp mode="seller" tela={tela} />;
}
