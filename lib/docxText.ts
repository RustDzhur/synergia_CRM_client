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

/** .docx → ограниченный HTML (lib/finance/contractHtml.ts): абзацы, заголовки, жирный/курсив/подчёркнутый/зачёркнутый, выравнивание, маркированные списки. */
export function docxToHtml(file: Buffer): string {
	const xml = readEntry(file, "word/document.xml");
	if (!xml) throw new DocxError("word/document.xml not found");
	const src = xml.toString("utf8");
	const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const on = (rpr: string, tag: string) => { const m = new RegExp(`<w:${tag}\\b([^>]*)/?>`).exec(rpr); return !!m && !/w:val="(0|false|none)"/.test(m[1]); };
	const out: string[] = [];
	let list: string[] = [];
	const flushList = () => { if (list.length) { out.push(`<ul>${list.join("")}</ul>`); list = []; } };
	for (const pm of Array.from(src.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g))) {
		const p = pm[1];
		const ppr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(p)?.[1] ?? "";
		const style = /<w:pStyle w:val="([^"]*)"/.exec(ppr)?.[1] ?? "";
		const jc = /<w:jc w:val="([^"]*)"/.exec(ppr)?.[1];
		const align = jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : jc === "both" || jc === "distribute" ? "justify" : "";
		let runs = "";
		for (const rm of Array.from(p.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g))) {
			const r = rm[1];
			const rpr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(r)?.[1] ?? "";
			let t = "";
			for (const tm of Array.from(r.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g))) t += tm[0].startsWith("<w:tab") ? "    " : tm[0].startsWith("<w:br") ? "\n" : esc(decode(tm[1]));
			if (!t) continue;
			let h = t.replace(/\n/g, "<br>");
			if (on(rpr, "strike")) h = `<s>${h}</s>`;
			if (on(rpr, "u")) h = `<u>${h}</u>`;
			if (on(rpr, "i")) h = `<em>${h}</em>`;
			if (on(rpr, "b")) h = `<strong>${h}</strong>`;
			runs += h;
		}
		const isList = /<w:numPr>/.test(ppr);
		const st = align ? ` style="text-align:${align}"` : "";
		if (isList && runs) { list.push(`<li>${runs}</li>`); continue; }
		flushList();
		const heading = /^(Title|Heading ?1)$/i.test(style) ? "h1" : /^Heading ?2$/i.test(style) ? "h2" : /^Heading ?[3-9]$/i.test(style) ? "h3" : "p";
		out.push(runs ? `<${heading}${st}>${runs}</${heading}>` : "<p><br></p>");
	}
	flushList();
	// подряд идущие пустые абзацы схлопываем: Word любит ставить их по нескольку
	return out.join("").replace(/(<p><br><\/p>){2,}/g, "<p><br></p>");
}
