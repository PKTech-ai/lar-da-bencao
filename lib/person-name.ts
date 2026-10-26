/**
 * Padrão de escrita de nomes de pessoas: cada palavra com inicial maiúscula e o resto minúsculo,
 * preposições em minúsculas (de, da, do, das, dos, e), iniciais e algarismos romanos em maiúsculas.
 * Ex.: "MARIA DA SILVA" e "maria da silva" → "Maria da Silva"; "ANA CLAUDIA M SILVA" → "Ana Claudia M Silva".
 */
const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del"]);
const ROMAN = /^(ii|iii|iv|vi|vii|viii|ix|xi|xii)$/;

const capitalize = (part: string): string => {
  // D'Ávila, O'Neil: maiúscula também depois do apóstrofo.
  const quote = part.search(/['’]/);
  if (quote > 0 && quote < part.length - 1) return capitalize(part.slice(0, quote)) + part[quote] + capitalize(part.slice(quote + 1));
  return part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1);
};

export function formatPersonName(value: string) {
  const words = value.normalize("NFC").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return words.map((word, index) => word.split("-").map((raw) => {
    const part = raw.toLocaleLowerCase("pt-BR");
    if (!part) return part;
    if (index > 0 && PARTICLES.has(part)) return part;
    if (index > 0 && ROMAN.test(part)) return part.toLocaleUpperCase("pt-BR");
    // Inicial solta (com ou sem ponto): "M" ou "M.".
    if (/^\p{L}\.?$/u.test(part)) return part.toLocaleUpperCase("pt-BR");
    return capitalize(part);
  }).join("-")).join(" ");
}
