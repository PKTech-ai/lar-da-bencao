import { SuggestionsBox } from "@/components/suggestions-box";

/** Sugestões e melhorias no fim de todas as páginas do departamento. */
export default function EducationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SuggestionsBox />
    </>
  );
}
