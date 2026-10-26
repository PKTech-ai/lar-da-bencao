/** Colunas da lista impressa de trabalhadores (puras, testadas em unidade). */

/** Aniversário (dd/mm), ano de nascimento e idade completa na data informada (AAAA-MM-DD). */
export function birthInfo(birth: string | null | undefined, today: string) {
  if (!birth || !/^\d{4}-\d{2}-\d{2}/.test(birth)) return { birthday: "—", year: "—", age: "—" };
  const [y, m, d] = birth.slice(0, 10).split("-");
  const [ty, tm, td] = today.split("-").map(Number);
  const age = ty - Number(y) - (tm < Number(m) || (tm === Number(m) && td < Number(d)) ? 1 : 0);
  return { birthday: `${d}/${m}`, year: y, age: age >= 0 ? String(age) : "—" };
}

export function brDateOnly(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10).split("-").reverse().join("/") : "—";
}
