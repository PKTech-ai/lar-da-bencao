import { ResponsiveTables } from "@/components/responsive-tables";
import { SystemFeedback } from "@/components/system-feedback";
import { TopNav } from "@/components/top-nav";
import { runtimeEnvironment } from "@/lib/environment";
import { loadNavigation } from "@/lib/navigation";
import { requirePageActor } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function SystemLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await requirePageActor();
  const nav = await loadNavigation(actor);
  const env = runtimeEnvironment();

  return (
    <div className="app-shell">
      <TopNav actor={actor} roleLabel={nav.roleLabel} capabilities={nav.capabilities} />
      <main className="app-main">
        <SystemFeedback />
        <ResponsiveTables />
        {env.production ? null : (
          <details className="lar-demo-note">
            <summary>Ambiente de teste · dados fictícios</summary>
            <div className="notice" role="note"><strong>{env.label}.</strong> Não cadastre dados pessoais reais neste ambiente.</div>
          </details>
        )}
        {children}
      </main>
    </div>
  );
}
