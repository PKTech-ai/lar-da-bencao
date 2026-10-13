/**
 * Quadro "Sobre o departamento" — gerado por scripts/extract-department-info.mjs a partir do HTML v215.
 * Não editar à mão: rode o script de novo.
 */
export type DepartmentInfo = { title: string; basis: string; purpose: string; activities: string[]; flow: string };
export type DepartmentInfoKey = "doutrina" | "infancia" | "juventude" | "assistencia" | "tesouraria" | "conselhofiscal" | "patrimonio" | "eventos" | "divulgacao" | "juridico" | "secretaria" | "presidencia";

export const DEPARTMENT_INFO: Record<DepartmentInfoKey, DepartmentInfo> = {
  "doutrina": {
    "title": "Dpto de Doutrina",
    "basis": "Regimento Interno — arts. 39 a 49",
    "purpose": "Responsável pela organização das atividades doutrinárias da Casa, abrangendo divulgação doutrinária, estudos sistematizados e orientação dos trabalhos de estudo e exposição.",
    "activities": [
      "Organizar e acompanhar reuniões públicas, cursos e grupos de estudo.",
      "Coordenar a programação de temas, expositores, dirigentes e orientações doutrinárias.",
      "Organizar estudos sistematizados, inclusive conteúdos de fluidos e passes.",
      "Acompanhar a Caravana no Lar nos termos do Regimento e os requisitos de seus colaboradores.",
      "Elaborar o calendário anual das atividades doutrinárias e encaminhá-lo à Diretoria.",
      "Registrar e acompanhar quantitativamente a frequência das atividades para avaliação interna do Departamento."
    ],
    "flow": "Planejar programação → Organizar estudos e reuniões → Orientar trabalhadores → Executar → Registrar e encaminhar calendário"
  },
  "infancia": {
    "title": "Dpto da Infância",
    "basis": "Regimento Interno — arts. 58 e seguintes, especialmente organização da evangelização",
    "purpose": "Responsável pela evangelização espírita da infância, organizando as crianças por ciclos e faixas etárias e promovendo atividades educativas de formação moral e doutrinária.",
    "activities": [
      "Organizar a evangelização infantil em turmas/ciclos conforme as faixas etárias previstas no Regimento.",
      "Realizar as atividades de evangelização aos domingos, conforme a organização regimental da Casa.",
      "Designar e acompanhar os evangelizadores responsáveis por cada ciclo.",
      "Planejar conteúdos e atividades adequados à faixa etária, preservando a orientação espírita.",
      "Acompanhar a participação dos evangelizandos e a organização anual das turmas."
    ],
    "flow": "Organizar turmas → Designar evangelizadores → Preparar atividades → Evangelizar → Acompanhar"
  },
  "juventude": {
    "title": "Dpto da Juventude",
    "basis": "Regimento Interno — arts. 58 e seguintes",
    "purpose": "Responsável pela evangelização espírita dos jovens, promovendo estudo, formação moral, convivência fraterna e continuidade do processo educativo iniciado na infância.",
    "activities": [
      "Organizar grupos da Pré-Juventude e Juventude conforme a estrutura da evangelização da Casa.",
      "Promover estudos e atividades espíritas adequados à faixa etária dos jovens.",
      "Designar e acompanhar evangelizadores responsáveis pelos grupos.",
      "Estimular participação, convivência fraterna e formação moral à luz da Doutrina Espírita.",
      "Acompanhar a programação e o desenvolvimento das atividades do departamento."
    ],
    "flow": "Organizar grupos → Designar evangelizadores → Preparar estudos → Realizar encontros → Acompanhar"
  },
  "assistencia": {
    "title": "Dpto de Assistência e Promoção Social",
    "basis": "Regimento Interno — arts. 81 a 87",
    "purpose": "Responsável pela assistência e promoção social espírita, prestando auxílio temporário, apoio emergencial e ações de promoção humana às pessoas e famílias atendidas pela Casa.",
    "activities": [
      "Prestar assistência social espírita de caráter temporário às pessoas e famílias necessitadas.",
      "Organizar ações de promoção social que favoreçam autonomia e melhoria das condições de vida.",
      "Prestar apoio em situações emergenciais dentro das possibilidades da instituição.",
      "Elaborar e acompanhar projetos e atividades sociais do departamento.",
      "Organizar voluntários, materiais e recursos destinados às ações de assistência e promoção social."
    ],
    "flow": "Acolher necessidade → Avaliar → Definir auxílio/projeto → Executar → Acompanhar e registrar"
  },
  "tesouraria": {
    "title": "Tesouraria",
    "basis": "Regimento Interno — arts. 50 a 52; Estatuto — atribuições do Tesoureiro",
    "purpose": "Responsável pela arrecadação, guarda, movimentação, registro e prestação de informações financeiras da instituição, em articulação com a Presidência.",
    "activities": [
      "Receber contribuições, doações e demais recursos destinados à Casa.",
      "Emitir recibos, realizar depósitos e manter controle das entradas financeiras.",
      "Movimentar contas bancárias em conjunto com a Presidência, conforme as normas da instituição.",
      "Efetuar pagamentos autorizados e manter organizados os livros e documentos financeiros.",
      "Realizar o fechamento mensal e preparar demonstrativos, balancetes e informações para prestação de contas."
    ],
    "flow": "Receber → Registrar e depositar → Pagar despesas autorizadas → Fechar mês → Prestar informações"
  },
  "conselhofiscal": {
    "title": "Conselho Fiscal",
    "basis": "Estatuto — arts. 29 e 30",
    "purpose": "Órgão de fiscalização da administração econômico-financeira e patrimonial, independente da Diretoria no exercício de suas atribuições e subordinado institucionalmente à Assembleia Geral.",
    "activities": [
      "Acompanhar e fiscalizar as atividades financeiras e patrimoniais da instituição.",
      "Examinar demonstrativos mensais, balanço anual e demais documentos apresentados pela administração.",
      "Emitir parecer sobre as contas e a situação econômico-financeira da Casa.",
      "Apontar, impugnar ou devolver contas quando identificar irregularidades ou necessidade de esclarecimentos.",
      "Reunir-se periodicamente para exercer a fiscalização e registrar suas análises."
    ],
    "flow": "Receber demonstrativos → Examinar → Solicitar esclarecimentos quando necessário → Emitir parecer → Encaminhar à Assembleia"
  },
  "patrimonio": {
    "title": "Dpto de Patrimônio",
    "basis": "Regimento Interno — arts. 53 e 54",
    "purpose": "Responsável pelo controle, conservação e organização do patrimônio material da instituição, incluindo imóveis, instalações, móveis, equipamentos e demais bens.",
    "activities": [
      "Controlar os bens, materiais, equipamentos e instalações da Casa.",
      "Manter inventário e registros patrimoniais atualizados.",
      "Acompanhar conservação, manutenção e necessidades de reparo dos bens.",
      "Controlar localização e utilização dos bens patrimoniais.",
      "Acompanhar aquisições e necessidades materiais relacionadas ao patrimônio."
    ],
    "flow": "Registrar bem → Identificar e localizar → Conservar/manter → Inventariar → Atualizar controle"
  },
  "eventos": {
    "title": "Dpto de Eventos",
    "basis": "Regimento Interno — arts. 55 a 57",
    "purpose": "Responsável pelo planejamento, organização e acompanhamento de eventos, campanhas e promoções promovidos pela instituição.",
    "activities": [
      "Planejar previamente eventos, campanhas e promoções da Casa.",
      "Definir organização, responsáveis, recursos e necessidades para cada atividade.",
      "Acompanhar a realização e o encerramento dos eventos.",
      "Apresentar prestação de contas referente aos recursos movimentados.",
      "Entregar relatório final do evento e respectiva prestação de contas no prazo previsto no Regimento, de até 30 dias após o encerramento."
    ],
    "flow": "Planejar → Aprovar/organizar → Realizar → Prestar contas → Entregar relatório final"
  },
  "divulgacao": {
    "title": "Dpto de Divulgação",
    "basis": "Regimento Interno — arts. 70 e seguintes",
    "purpose": "Responsável pela divulgação institucional e pelo apoio aos setores de comunicação, Relações Públicas, Livraria, Biblioteca e Brinquedoteca.",
    "activities": [
      "Promover a divulgação das atividades e informações institucionais da Casa.",
      "Organizar e acompanhar o setor de Relações Públicas.",
      "Acompanhar e apoiar a Livraria.",
      "Organizar e apoiar a Biblioteca.",
      "Acompanhar a Brinquedoteca e suas atividades de apoio."
    ],
    "flow": "Receber informação/necessidade → Organizar conteúdo ou setor → Divulgar/atender → Acompanhar"
  },
  "juridico": {
    "title": "Dpto Jurídico",
    "basis": "Regimento Interno — art. 88",
    "purpose": "Responsável pelo apoio jurídico judicial e extrajudicial da instituição e pela orientação da Presidência e da Diretoria quando solicitado.",
    "activities": [
      "Prestar apoio jurídico em questões judiciais e extrajudiciais da instituição.",
      "Emitir orientação ou parecer jurídico quando solicitado pela Presidência.",
      "Analisar documentos e situações que demandem suporte jurídico.",
      "Assistir às reuniões da Diretoria quando sua presença for solicitada.",
      "Apoiar a instituição na prevenção e encaminhamento adequado de questões jurídicas."
    ],
    "flow": "Receber demanda → Analisar → Orientar/emitir parecer → Acompanhar providências"
  },
  "secretaria": {
    "title": "Secretaria",
    "basis": "Estatuto — arts. 23 e 27, I e IV; Regimento — art. 36 e parágrafo único",
    "purpose": "Organizar e manter os serviços de secretaria, apoiar a documentação institucional e redigir as atas. A Secretaria cadastra e acompanha as fichas; as decisões de aprovação ou reprovação são registradas pela Diretoria.",
    "activities": [
      "Manter organizados os registros administrativos utilizados pela Casa.",
      "Cadastrar, atualizar e encaminhar as fichas de trabalhadores para decisão da Diretoria.",
      "Manter relações e informações administrativas de trabalhadores atualizadas.",
      "Dar suporte documental às atividades da Diretoria e dos departamentos.",
      "Executar outras rotinas administrativas definidas internamente, respeitando Estatuto e Regimento."
    ],
    "flow": "Receber informação/documento → Registrar → Organizar → Encaminhar → Arquivar/atualizar"
  },
  "presidencia": {
    "title": "Presidência",
    "basis": "Estatuto — arts. 8º, 23 e 24; Regimento — arts. 30 e 65, VI",
    "purpose": "Órgão responsável pela direção e administração da instituição, executando as deliberações e acompanhando o funcionamento geral da Casa.",
    "activities": [
      "Dirigir e administrar a instituição e executar seu programa de atividades.",
      "Analisar e registrar a aprovação ou reprovação das fichas de trabalhadores de todos os departamentos.",
      "Elaborar regulamentos e adotar medidas necessárias ao funcionamento da Casa.",
      "Deliberar e acompanhar operações financeiras, obras e demais atos administrativos de sua competência.",
      "Propor alterações e reformas quando necessárias, observando as competências da Assembleia Geral.",
      "Acompanhar demonstrativos financeiros mensais e o balanço anual.",
      "Reunir-se ordinariamente conforme a periodicidade estabelecida no Estatuto."
    ],
    "flow": "Planejar → Deliberar → Administrar/executar → Acompanhar departamentos e finanças → Prestar contas"
  }
};

export function departmentInfoFor(moduleSlug: string): DepartmentInfo | null {
  return (DEPARTMENT_INFO as Record<string, DepartmentInfo>)[moduleSlug] ?? null;
}
