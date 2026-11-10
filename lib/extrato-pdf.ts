import { AppError } from "@/lib/errors";
import type { StatementLine } from "@/lib/treasury";

/** Pedaço de texto do PDF com a posição na página (y cresce para cima). */
export type PdfItem = { page: number; x: number; y: number; text: string };

type Row = { page: number; y: number; items: PdfItem[] };
type Columns = { history: number; document: number };
type Anchor = { row: Row; date: string; text: string; document: string; cents: number; signed: boolean; above: string[]; below: string[] };

const UNKNOWN_LAYOUT = "Não reconheci este PDF. O sistema lê o extrato de conta corrente do Banco do Brasil; de outros bancos, importe em OFX ou CSV.";
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const VALUE = /^(-?)(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s*(\(\+\)|\(-\)|C|D))?$/i;
const SIGN = /^(\(\+\)|\(-\)|C|D)$/i;
const BALANCE = /^(saldo( anterior| do dia| final)?|s\s*a\s*l\s*d\s*o)$/i;
const SAME_ROW = 2;
const COLUMN_SLACK = 5;
/** Distância máxima entre a linha com data e valor e os complementos do histórico (acima ou abaixo dela). */
const NEAR = 14;
const MAX_PAGES = 100;

const clean = (item: PdfItem) => item.text.trim();

function toRows(items: PdfItem[]) {
  const rows: Row[] = [];
  const sorted = items.filter(clean).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  for (const item of sorted) {
    const row = rows.at(-1);
    if (row && row.page === item.page && row.y - item.y <= SAME_ROW) row.items.push(item);
    else rows.push({ page: item.page, y: item.y, items: [item] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

function findColumns(rows: Row[]): Columns {
  for (const row of rows) {
    const history = row.items.find((item) => /^hist[oó]rico$/i.test(clean(item)));
    if (!history || !row.items.some((item) => /^valor/i.test(clean(item)))) continue;
    return { history: history.x, document: row.items.find((item) => /^documento$/i.test(clean(item)))?.x ?? history.x };
  }
  throw new AppError(UNKNOWN_LAYOUT);
}

function toAnchor(row: Row, columns: Columns): Anchor | null {
  const date = clean(row.items[0]).match(DATE);
  if (!date || row.items.length < 2) return null;
  const items = [...row.items];
  let marker = "";
  if (SIGN.test(clean(items[items.length - 1]))) marker = clean(items.pop() as PdfItem);
  const value = items.length > 1 ? clean(items[items.length - 1]).match(VALUE) : null;
  if (!value) return null;
  items.pop();
  marker = value[3] ?? marker;
  const negative = value[1] === "-" || /^(\(-\)|D)$/i.test(marker);
  const cents = Number(value[2].replace(/\D/g, ""));
  const inHistory = (item: PdfItem) => item.x >= columns.history - COLUMN_SLACK;
  return {
    row,
    date: `${date[3]}-${date[2]}-${date[1]}`,
    text: items.filter(inHistory).map(clean).join(" "),
    document: items.filter((item) => !inHistory(item) && item.x >= columns.document - COLUMN_SLACK).map(clean).join(" "),
    cents: negative ? -cents : cents,
    signed: value[1] === "-" || Boolean(marker),
    above: [],
    below: []
  };
}

/** Prende cada linha só de texto (complemento do histórico) à linha com data e valor mais próxima. */
function attachDetails(rows: Row[], anchors: Anchor[], columns: Columns) {
  const anchored = new Set(anchors.map((anchor) => anchor.row));
  for (const row of rows) {
    if (anchored.has(row) || row.items.some((item) => item.x < columns.history - COLUMN_SLACK)) continue;
    let best: Anchor | null = null;
    for (const anchor of anchors) {
      if (anchor.row.page !== row.page) continue;
      const distance = Math.abs(anchor.row.y - row.y);
      if (distance <= NEAR && (!best || distance < Math.abs(best.row.y - row.y))) best = anchor;
    }
    if (!best) continue;
    (row.y > best.row.y ? best.above : best.below).push(row.items.map(clean).join(" "));
  }
}

/** Lê o extrato de conta corrente em PDF: cada lançamento tem dia, valor com sinal e histórico em até três linhas. */
export function parsePdfStatement(items: PdfItem[]): StatementLine[] {
  const rows = toRows(items);
  const columns = findColumns(rows);
  const anchors = rows.map((row) => toAnchor(row, columns)).filter((anchor): anchor is Anchor => anchor !== null);
  if (!anchors.length) throw new AppError(UNKNOWN_LAYOUT);
  attachDetails(rows, anchors, columns);

  const balances = anchors.filter((anchor) => BALANCE.test(anchor.text));
  const movements = anchors.filter((anchor) => !BALANCE.test(anchor.text));
  if (movements.some((anchor) => !anchor.signed)) throw new AppError(UNKNOWN_LAYOUT);

  // O próprio extrato confere a leitura: saldo anterior + movimentos tem de dar o saldo final.
  const opening = balances.find((anchor) => /anterior/i.test(anchor.text));
  const closing = balances.at(-1);
  if (opening && closing && opening !== closing) {
    const total = movements.reduce((sum, anchor) => sum + anchor.cents, 0);
    if (opening.cents + total !== closing.cents) throw new AppError("A soma das linhas do PDF não fecha com o saldo do extrato. Nada foi importado; importe este mês em OFX.");
  }

  return movements.map((anchor) => ({
    line_date: anchor.date,
    description: [...anchor.above, anchor.text, ...anchor.below].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 300),
    amount_cents: anchor.cents,
    document: anchor.document.slice(0, 120)
  }));
}

/** Tira o texto e a posição de cada pedaço do PDF, recebido em base64. */
export async function readPdfItems(base64: string): Promise<PdfItem[]> {
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") throw new AppError("O arquivo enviado não é um PDF válido.");
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes, { isEvalSupported: false }).catch((error: Error) => {
    throw new AppError(error.name === "PasswordException" ? "Este PDF tem senha. Baixe o extrato sem senha ou importe em OFX." : "Não foi possível abrir este PDF.");
  });
  if (pdf.numPages > MAX_PAGES) throw new AppError("Este PDF tem páginas demais para um extrato mensal.");
  const items: PdfItem[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) items.push({ page: number, x: item.transform[4], y: item.transform[5], text: item.str });
    }
  }
  if (!items.length) throw new AppError("Este PDF é uma imagem, sem texto para ler. Importe em OFX ou CSV.");
  return items;
}
