/**
 * Leitor mínimo de ZIP (armazenado ou DEFLATE), sem dependências: usa DecompressionStream,
 * disponível nos navegadores atuais e no Node 20. Não aceita ZIP64 nem arquivos criptografados.
 */

export type ZipEntry = { name: string; method: number; compressedSize: number; size: number; offset: number; flags: number };

const MAX_ENTRIES = 50_000;

function findEndOfCentralDirectory(view: DataView) {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error("Arquivo ZIP inválido ou corrompido.");
}

export function listEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);
  const dirOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || dirOffset === 0xffffffff) throw new Error("ZIP64 não é suportado.");
  if (count > MAX_ENTRIES) throw new Error("O pacote tem arquivos demais.");
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  let p = dirOffset;
  for (let i = 0; i < count; i += 1) {
    if (p + 46 > view.byteLength || view.getUint32(p, true) !== 0x02014b50) throw new Error("Diretório do ZIP corrompido.");
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    if (flags & 0x1) throw new Error("ZIP criptografado não é suportado.");
    if (name.includes("..") || name.startsWith("/")) throw new Error(`Caminho inválido no pacote: ${name}`);
    if (entries.has(name)) throw new Error(`Arquivo duplicado no pacote: ${name}`);
    entries.set(name, { name, method, compressedSize, size, offset, flags });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array, expectedSize: number) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  if (out.byteLength !== expectedSize) throw new Error("Tamanho descompactado não confere.");
  return out;
}

export async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== 0x04034b50) throw new Error(`Cabeçalho local inválido: ${entry.name}`);
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (data.byteLength !== entry.compressedSize) throw new Error(`Arquivo truncado: ${entry.name}`);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRaw(data, entry.size);
  throw new Error(`Método de compressão não suportado em ${entry.name}.`);
}

export async function sha256Hex(data: Uint8Array | string) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
