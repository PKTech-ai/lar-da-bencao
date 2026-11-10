import { describe, expect, it } from "vitest";
import { parsePdfStatement, type PdfItem } from "@/lib/extrato-pdf";

const HEADER: PdfItem[] = [
  { page: 1, x: 30, y: 726, text: "Dia" }, { page: 1, x: 99, y: 726, text: "Lote" }, { page: 1, x: 148, y: 726, text: "Documento" },
  { page: 1, x: 265, y: 726, text: "Histórico" }, { page: 1, x: 550, y: 726, text: "Valor" }
];
const at = (y: number, x: number, text: string, page = 1): PdfItem => ({ page, x, y, text });
const anchor = (y: number, date: string, value: string, extra: PdfItem[] = []) => [at(y, 30, date), ...extra, at(y, 530, value)];
const OPENING = anchor(711, "30/09/2026", "100,00 (+)", [at(711, 265, "Saldo Anterior")]);
/** Lançamento com o histórico em três linhas, como o banco imprime. */
const movement = (y: number, value: string, first: string, doc: string, detail: string, date = "01/10/2026") => [
  at(y + 5, 265, first),
  ...anchor(y, date, value, [at(y, 99, "14397"), at(y, 148, doc)]),
  at(y - 6, 265, detail)
];

describe("leitura do extrato em PDF", () => {
  it("lê data, valor com sinal, documento e o histórico completo, sem as linhas de saldo", () => {
    const lines = parsePdfStatement([
      ...HEADER, ...OPENING,
      ...movement(691, "1.250,50 (+)", "Pix - Recebido", "111", "01/10 09:00 Pessoa Ficticia"),
      ...movement(667, "50,00 (-)", "Pix - Enviado", "222", "01/10 10:00 Fornecedor Ficticio"),
      ...anchor(640, "01/10/2026", "1.300,50 (+)", [at(640, 265, "Saldo do dia")])
    ]);
    expect(lines).toEqual([
      { line_date: "2026-10-01", description: "Pix - Recebido 01/10 09:00 Pessoa Ficticia", amount_cents: 125050, document: "111" },
      { line_date: "2026-10-01", description: "Pix - Enviado 01/10 10:00 Fornecedor Ficticio", amount_cents: -5000, document: "222" }
    ]);
  });

  it("junta o complemento à linha certa quando o histórico vem mais afastado", () => {
    const lines = parsePdfStatement([
      ...HEADER,
      at(464, 265, "Transferencia recebida"),
      ...anchor(453, "02/10/2026", "10,00 (+)", [at(453, 148, "333"), at(453, 265, "02/10 08:00 Pessoa A")]),
      at(441, 265, "continuacao A"),
      at(428, 265, "Transferencia enviada"),
      ...anchor(417, "02/10/2026", "20,00 (-)", [at(417, 148, "444"), at(417, 265, "02/10 09:00 Pessoa B")]),
      at(405, 265, "continuacao B")
    ]);
    expect(lines.map((line) => line.description)).toEqual([
      "Transferencia recebida 02/10 08:00 Pessoa A continuacao A",
      "Transferencia enviada 02/10 09:00 Pessoa B continuacao B"
    ]);
  });

  it("aceita o sinal em pedaço separado e o C/D no lugar de (+) e (-)", () => {
    const lines = parsePdfStatement([
      ...HEADER,
      at(600, 30, "03/10/2026"), at(600, 265, "Deposito"), at(600, 520, "5,00"), at(600, 560, "C"),
      ...anchor(570, "03/10/2026", "7,00 D", [at(570, 265, "Tarifa")])
    ]);
    expect(lines.map((line) => line.amount_cents)).toEqual([500, -700]);
  });

  it("não importa nada se a soma não fechar com o saldo final", () => {
    expect(() => parsePdfStatement([
      ...HEADER, ...OPENING,
      ...movement(691, "10,00 (+)", "Pix - Recebido", "111", "detalhe"),
      ...anchor(660, "01/10/2026", "999,00 (+)", [at(660, 265, "S A L D O")])
    ])).toThrow(/não fecha com o saldo/);
  });

  it("confere com o saldo final quando a soma fecha", () => {
    expect(parsePdfStatement([
      ...HEADER, ...OPENING,
      ...movement(691, "10,00 (+)", "Pix - Recebido", "111", "detalhe"),
      ...anchor(660, "01/10/2026", "110,00 (+)", [at(660, 265, "S A L D O")])
    ])).toHaveLength(1);
  });

  it("recusa PDF de layout desconhecido e linha sem sinal, em vez de adivinhar entrada ou saída", () => {
    expect(() => parsePdfStatement([at(700, 30, "Qualquer texto"), at(680, 30, "01/10/2026")])).toThrow(/Não reconheci/);
    expect(() => parsePdfStatement([...HEADER, ...anchor(600, "01/10/2026", "10,00", [at(600, 265, "Sem sinal")])])).toThrow(/Não reconheci/);
  });

  it("lê lançamentos de páginas diferentes sem misturar os históricos", () => {
    const lines = parsePdfStatement([
      ...HEADER,
      ...anchor(100, "04/10/2026", "1,00 (+)", [at(100, 265, "Pagina um")]),
      at(100, 30, "04/10/2026", 2), at(100, 265, "Pagina dois", 2), at(100, 530, "2,00 (+)", 2),
      at(106, 265, "Detalhe dois", 2)
    ]);
    expect(lines.map((line) => line.description)).toEqual(["Pagina um", "Detalhe dois Pagina dois"]);
  });
});
