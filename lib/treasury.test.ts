import { describe, expect, it } from "vitest";
import { lineFingerprint, parseStatement } from "@/lib/treasury";

const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260903120000[-3:BRT]<TRNAMT>150.00<FITID>2026090301<MEMO>Contribuicao mensal</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260910<TRNAMT>-89.90<FITID>2026091002<MEMO>Energia eletrica</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("leitura do extrato bancário", () => {
  it("lê OFX com data, valor e histórico", () => {
    const lines = parseStatement(OFX, "OFX");
    expect(lines).toEqual([
      { line_date: "2026-09-03", description: "Contribuicao mensal", amount_cents: 15000, document: "2026090301" },
      { line_date: "2026-09-10", description: "Energia eletrica", amount_cents: -8990, document: "2026091002" }
    ]);
  });

  it("lê CSV com cabeçalho, ponto e vírgula e valores no formato brasileiro", () => {
    const csv = "Data;Histórico;Valor;Documento\n03/09/2026;Doação PIX;1.250,00;abc\n10/09/2026;Tarifa bancária;-12,90;def";
    expect(parseStatement(csv, "CSV")).toEqual([
      { line_date: "2026-09-03", description: "Doação PIX", amount_cents: 125000, document: "abc" },
      { line_date: "2026-09-10", description: "Tarifa bancária", amount_cents: -1290, document: "def" }
    ]);
  });

  it("lê CSV sem cabeçalho separado por vírgula", () => {
    const csv = "2026-09-05,Venda da lanchonete,300.50";
    expect(parseStatement(csv, "CSV")).toEqual([{ line_date: "2026-09-05", description: "Venda da lanchonete", amount_cents: 30050, document: "" }]);
  });

  it("recusa data e valor inválidos", () => {
    expect(() => parseStatement("Data;Histórico;Valor\nontem;x;10,00", "CSV")).toThrow(/Data inválida/);
    expect(() => parseStatement("Data;Histórico;Valor\n03/09/2026;x;abc", "CSV")).toThrow(/Valor inválido/);
  });

  it("a impressão digital da linha repete para o mesmo lançamento e muda com o valor", () => {
    const line = { line_date: "2026-09-03", description: "Doação", amount_cents: 1000, document: "1" };
    expect(lineFingerprint("2026-09", line)).toBe(lineFingerprint("2026-09", { ...line }));
    expect(lineFingerprint("2026-09", line)).not.toBe(lineFingerprint("2026-09", { ...line, amount_cents: 1001 }));
  });
});
