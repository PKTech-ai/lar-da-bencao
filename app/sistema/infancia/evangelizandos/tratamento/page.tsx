import { TreatmentPrintPage } from "@/components/education/treatment-sheet";

export default async function InfanciaTratamentoPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <TreatmentPrintPage department="infancia" id={(await searchParams).id} />;
}
