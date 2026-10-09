import { inflateRawSync } from "node:zlib";

// Текст из .docx (шаблоны договоров от юриста): .docx — это zip, текст лежит в word/document.xml.
// Читаем центральный каталог, достаём нужную запись (store или deflate) и превращаем абзацы в строки.
// Таблицы и колонтитулы не разбираются: для шаблона договора нужен основной текст.

export class DocxError extends Error {}

function readEntry(zip: Buffer, wanted: string): Buffer | null {
    // конец центрального каталога (EOCD) ищем с конца
    let eocd = -1;
    for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new DocxError("Not a zip archive");
    const count = zip.readUInt16LE(eocd + 10);
    let p = zip.readUInt32LE(eocd + 16);
    for (let n = 0; n < count; n++) {
        if (p + 46 > zip.length || zip.readUInt32LE(p) !== 0x02014b50) throw new DocxError("Broken zip directory");
        const method = zip.readUInt16LE(p + 10);
        const csize = zip.readUInt32LE(p + 20);
        const nameLen = zip.readUInt16LE(p + 28), extraLen = zip.readUInt16LE(p + 30), commentLen = zip.readUInt16LE(p + 32);
        const local = zip.readUInt32LE(p + 42);
        const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8");
        if (name === wanted) {
            const lnLen = zip.readUInt16LE(local + 26), leLen = zip.readUInt16LE(local + 28);
            const start = local + 30 + lnLen + leLen;
            const raw = zip.subarray(start, start + csize);
            if (method === 0) return Buffer.from(raw);
            if (method === 8) return inflateRawSync(raw);
            throw new DocxError("Unsupported compression");
        }
        p += 46 + nameLen + extraLen + commentLen;
    }
    return null;
}

const decode = (s: string) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");

/** Текст документа: абзацы — строки, табуляции и переносы сохраняются. */
export function docxToText(file: Buffer): string {
    const xml = readEntry(file, "word/document.xml");
    if (!xml) throw new DocxError("word/document.xml not found");
    const text = xml
        .toString("utf8")
        .replace(/<w:tab\b[^>]*\/>/g, "\t")
        .replace(/<w:(br|cr)\b[^>]*\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:p\b[^>]*>/g, "")
        .replace(/<(?!\/?w:t\b)[^>]+>/g, "")   // всё, кроме текстовых узлов
        .replace(/<\/?w:t\b[^>]*>/g, "");
    return decode(text).replace(/\n{3,}/g, "\n\n").trim();
}
