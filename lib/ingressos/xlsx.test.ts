import { writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildXlsx, crc32 } from "@/lib/ingressos/xlsx";

/** Lê as entradas do .zip pelos cabeçalhos locais (o suficiente para conferir a planilha gerada). */
function unzip(buffer: Buffer) {
  const files = new Map<string, string>();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const crc = buffer.readUInt32LE(offset + 14);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extra;
    const data = inflateRawSync(buffer.subarray(start, start + size));
    expect(crc32(data)).toBe(crc);
    files.set(name, data.toString("utf8"));
    offset = start + size;
  }
  return files;
}

describe("planilha .xlsx do caixa", () => {
  it("CRC32 padrão", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("gera abas, texto escapado e valores em R$", () => {
    const buffer = buildXlsx([
      { name: "Resumo", rows: [[{ bold: "Evento" }, "Feijoada & Cia <teste>"], [{ bold: "Total" }, { money: 123456 }], ["n", 3, null]] },
      { name: "Vendas", rows: [["Comprador"], ["Rosa Lima"]] }
    ]);
    if (process.env.XLSX_SAMPLE) writeFileSync(process.env.XLSX_SAMPLE, buffer);
    const files = unzip(buffer);
    expect([...files.keys()]).toEqual(expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]));
    expect(files.get("xl/workbook.xml")).toContain('<sheet name="Resumo" sheetId="1" r:id="rId1"/>');
    const sheet = files.get("xl/worksheets/sheet1.xml") ?? "";
    expect(sheet).toContain("Feijoada &amp; Cia &lt;teste&gt;");
    expect(sheet).toContain('<c r="B2" s="1"><v>1234.56</v></c>');
    expect(sheet).toContain('<c r="B3"><v>3</v></c>');
  });
});
