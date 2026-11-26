/**
 * Convite do Culto no Lar dos Trabalhadores: a frase fraterna e a mensagem para o grupo do WhatsApp. Usado na página
 * pública do link (/culto/<código>) e no botão "Copiar convite" da tela do Culto. Sem dependência de servidor.
 */

export const CULTO_CONVITE_HORARIO = "19:30 às 20:30";

export const CULTO_CONVITE =
  "Queridos irmãos de ideal, o Culto no Lar dos Trabalhadores é um encontro simples de prece, leitura do Evangelho e convivência fraterna, realizado uma vez por mês na casa de um de nós. Como nos ensina a Doutrina Espírita, a fraternidade se constrói no convívio: ao abrirmos as portas do nosso lar, estreitamos os laços que nos unem como família espiritual e levamos a paz do Evangelho para dentro de casa. Escolha o seu sábado e receba os companheiros com alegria!";

export const CULTO_VERSICULO = "“Onde estiverem dois ou três reunidos em meu nome, aí estou eu no meio deles.”";
export const CULTO_VERSICULO_FONTE = "Mateus 18:20";

/** Texto pronto para colar no grupo do WhatsApp (negrito e itálico no formato do WhatsApp). */
export function cultoWhatsappMessage(year: number, url: string) {
  return [
    `🏡 *Culto no Lar dos Trabalhadores — ${year}*`,
    "",
    CULTO_CONVITE,
    "",
    `📅 Um culto por mês, sempre no *penúltimo sábado*, das ${CULTO_CONVITE_HORARIO}.`,
    "",
    "👉 Toque no link, escolha um sábado livre e digite o seu nome:",
    url,
    "",
    `_${CULTO_VERSICULO} (${CULTO_VERSICULO_FONTE})_`
  ].join("\n");
}
