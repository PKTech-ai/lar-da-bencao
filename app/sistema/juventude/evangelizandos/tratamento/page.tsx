import { TreatmentPrintPage } from "@/components/education/treatment-sheet";

export default async function JuventudeTratamentoPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <TreatmentPrintPage department="juventude" id={(await searchParams).id} />;
}
