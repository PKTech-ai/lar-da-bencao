import { requireModulePage } from "@/lib/page-auth";
import { DocumentsClient } from "./documents-client";

/** Resumo institucional do mock v215 (em caso de dúvida, prevalece o texto integral). */
const SUMMARY: [string, string][] = [
  ["Finalidade e princípios da Casa", "O Estatuto define como objetivos o estudo, a prática e a difusão do Espiritismo, a prática da caridade espiritual, moral e material e a união solidária das sociedades espíritas. Também estabelece ausência de discriminação, gratuidade dos cargos de direção e não distribuição de resultados."],
  ["Direitos e deveres dos membros", "Entre os deveres do membro efetivo estão cumprir o Estatuto, o Regimento e as deliberações; manter seu cadastro atualizado junto à Secretaria; contribuir mensalmente conforme suas possibilidades; cumprir os fins da instituição e atender às convocações dos órgãos de que faça parte."],
  ["Admissão e permanência do trabalhador", "O Regimento estabelece, entre outros requisitos, aceitação dos princípios espíritas, conclusão de cursos básicos sistematizados, frequência regular mínima de 75%, equilíbrio emocional, indicação do responsável do setor e maioridade ou autorização do responsável. Também prevê reciclagens e regras para licença e readmissão."],
  ["Contribuição mensal", "O Estatuto determina que a contribuição do membro efetivo seja feita conforme suas possibilidades e de acordo com sua livre e espontânea vontade. O Regimento reforça que não será fixado valor mínimo da mensalidade."],
  ["Doutrina e estudos", "O Regimento atribui ao Departamento de Doutrina a programação das reuniões públicas, escolha e acompanhamento de expositores, organização de estudos sistematizados, calendário, frequência e atualização de dirigentes e trabalhadores."],
  ["Tesouraria e Conselho Fiscal", "A Tesouraria deve controlar recebimentos, contribuições, depósitos, contas bancárias e realizar o fechamento mensal. O Estatuto atribui ao Conselho Fiscal a fiscalização da gestão econômico-financeira, o parecer sobre balancetes mensais e balanço anual e a possibilidade de impugnar contas quando necessário."],
  ["Patrimônio", "O Regimento atribui ao Departamento de Patrimônio o registro e controle dos bens, controle de materiais, previsão anual de consumo, aquisição de materiais, manutenção e conservação, inspeções, distribuição de materiais e documentação das aquisições."],
  ["Infância e Juventude", "O Regimento define ciclos por faixa etária, funcionamento aos domingos, responsabilidades de coordenação, controle de frequência, formação de evangelizadores e composição das equipes. Para cada ciclo de evangelização infantil, prevê dois evangelizadores."],
  ["Assistência e Promoção Social", "O Departamento Social tem finalidade assistencial espírita, beneficente, preventiva e promocional, com programas de apoio, promoção social, auxílio material e espiritual, controle de materiais doados e equipes de trabalho conforme as atividades desenvolvidas."],
  ["Conduta, patrimônio e frequência", "As disposições finais do Regimento determinam o dever de zelar pelo patrimônio, restrições ao uso de bens fora da Casa, recomendação de silêncio, vestuário sóbrio e simples, proibição de bebida alcoólica, droga alucinógena e fumo no interior do Centro e controle de frequência das atividades metódicas."]
];

export default async function DocumentosPage() {
  await requireModulePage("module_documentos", { resource: "institucional" });
  return (
    <>
      <header className="page-heading">
        <div><h1>Estatuto e Regimento</h1><p>Disponível a todos os trabalhadores ativos, independentemente do departamento.</p></div>
      </header>
      <DocumentsClient />
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Resumo institucional para os trabalhadores</h2>
        <p className="small muted">Resumo elaborado a partir dos documentos. Em caso de dúvida, prevalece sempre o texto integral do Estatuto e do Regimento.</p>
        <div className="grid cards">
          {SUMMARY.map(([title, text]) => <article className="card" key={title}><h3>{title}</h3><p className="small">{text}</p></article>)}
        </div>
      </section>
    </>
  );
}
