import { parseHtml, type HNode } from "./contractHtml";

// Печать богатого текста договора (docs/CONTRACT_EDITOR.md): абзацы, заголовки, жирный/курсив/подчёркнутый/зачёркнутый, выравнивание, списки,
// ссылки и картинки. В документе встроен один шрифт (Noto Sans Regular, см. lib/finance/pdf.ts), поэтому жирный рисуется обводкой букв,
// курсив — наклоном: ширина слов измеряется тем же шрифтом, переносы по словам считаются здесь, а не pdfkit, — так разметка слов на строке сохраняется.
// Разрыв страницы решает Flow документа (fit/brk): текст продолжается на следующем листе, как у обычного текста договора.

type Doc = PDFKit.PDFDocument;
export interface RichFlow { bottom: number; fit: (y: number, h: number) => number; brk: () => number }

interface Run { text: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; href?: string }
type Align = "left" | "center" | "right" | "justify";
interface Block { kind: "text" | "hr" | "img"; size: number; bold: boolean; align: Align; indent: number; marker?: string; runs: Run[]; before: number; after: number; img?: Buffer; imgW?: number }

const BASE = 9.5;
const HEAD: Record<string, { size: number; before: number; after: number }> = { h1: { size: 16, before: 8, after: 6 }, h2: { size: 13, before: 7, after: 5 }, h3: { size: 11, before: 6, after: 4 } };

function blocksOf(root: HNode): Block[] {
	const blocks: Block[] = [];
	let cur: Block | null = null;
	const open = (o: Partial<Block> = {}): Block => { cur = { kind: "text", size: BASE, bold: false, align: "left", indent: 0, runs: [], before: 0, after: 3, ...o }; blocks.push(cur); return cur; };
	const alignOf = (n: HNode): Align | undefined => { const m = /text-align:\s*(center|right|justify)/.exec(n.attrs.style ?? ""); return m ? (m[1] as Align) : undefined; };

	function walk(n: HNode | string, st: { bold: boolean; italic: boolean; underline: boolean; strike: boolean; href?: string }, ctx: { list?: { ordered: boolean; n: number }; depth: number; align?: Align }) {
		if (typeof n === "string") {
			const t = n.replace(/[\r\n\t]+/g, " ");
			if (!t) return;
			const b = cur ?? open({ align: ctx.align ?? "left", indent: ctx.depth * 16 });
			b.runs.push({ text: t, bold: st.bold || b.bold, italic: st.italic, underline: st.underline, strike: st.strike, href: st.href });
			return;
		}
		const tag = n.tag;
		const ns = { ...st };
		if (tag === "strong") ns.bold = true;
		else if (tag === "em") ns.italic = true;
		else if (tag === "u") ns.underline = true;
		else if (tag === "s") ns.strike = true;
		else if (tag === "a" && n.attrs.href) { ns.href = n.attrs.href; ns.underline = true; }
		else if (tag === "br") { const b = cur ?? open({ align: ctx.align ?? "left", indent: ctx.depth * 16 }); b.runs.push({ text: "\n", bold: false, italic: false, underline: false, strike: false }); return; }
		else if (tag === "hr") { cur = null; blocks.push({ kind: "hr", size: BASE, bold: false, align: "left", indent: 0, runs: [], before: 4, after: 6 }); return; }
		else if (tag === "img") {
			const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(n.attrs.src ?? "");
			if (m) { cur = null; blocks.push({ kind: "img", size: BASE, bold: false, align: ctx.align ?? "left", indent: ctx.depth * 16, runs: [], before: 2, after: 6, img: Buffer.from(m[1], "base64"), imgW: Number(n.attrs.width) || undefined }); }
			return;
		}
		if (tag === "ul" || tag === "ol") {
			cur = null;
			const list = { ordered: tag === "ol", n: 0 };
			for (const c of n.children) walk(c, ns, { list, depth: ctx.depth + 1, align: ctx.align });
			cur = null;
			return;
		}
		if (tag === "li") {
			cur = null;
			const list = ctx.list ?? { ordered: false, n: 0 };
			list.n++;
			const b = open({ indent: ctx.depth * 16, marker: list.ordered ? `${list.n}.` : "•", align: alignOf(n) ?? ctx.align ?? "left", after: 2 });
			for (const c of n.children) walk(c, ns, { ...ctx, align: b.align });
			cur = null;
			return;
		}
		if (tag === "p" || tag === "h1" || tag === "h2" || tag === "h3") {
			cur = null;
			const h = HEAD[tag];
			const b = open({ ...(h ? { size: h.size, bold: true, before: h.before, after: h.after } : {}), align: alignOf(n) ?? "left", indent: ctx.depth * 16 });
			for (const c of n.children) walk(c, h ? { ...ns, bold: true } : ns, { ...ctx, align: b.align });
			cur = null;
			return;
		}
		for (const c of n.children) walk(c, ns, ctx);
	}
	for (const c of root.children) walk(c, { bold: false, italic: false, underline: false, strike: false }, { depth: 0 });
	return blocks;
}

interface Item { text: string; run: Run; w: number; space: boolean }

/** Рисует HTML договора (значения уже подставлены) с позиции y; возвращает y после последнего блока. */
export function drawRichBody(doc: Doc, html: string, x: number, y: number, w: number, fl: RichFlow): number {
	const blocks = blocksOf(parseHtml(html));
	const measure = (s: string, size: number, bold: boolean) => doc.fontSize(size).widthOfString(s) * (bold ? 1.03 : 1);
	for (const b of blocks) {
		y += b.before;
		if (b.kind === "hr") { y = fl.fit(y, 8); doc.moveTo(x, y + 3).lineTo(x + w, y + 3).lineWidth(0.5).strokeColor("#BBBBBB").stroke(); y += 8 + b.after; continue; }
		if (b.kind === "img" && b.img) {
			try {
				const im = (doc as unknown as { openImage: (b: Buffer) => { width: number; height: number } }).openImage(b.img);
				let iw = Math.min(b.imgW ? b.imgW * 0.75 : im.width * 0.75, w - b.indent), ih = im.height * (iw / im.width);
				if (ih > 280) { iw *= 280 / ih; ih = 280; }
				y = fl.fit(y, ih + 4);
				const px = b.align === "center" ? x + b.indent + (w - b.indent - iw) / 2 : b.align === "right" ? x + w - iw : x + b.indent;
				doc.image(b.img, px, y, { width: iw });
				y += ih + b.after;
			} catch { /* картинка не читается — пропускаем, текст договора важнее */ }
			continue;
		}
		const left = x + b.indent + (b.marker ? 14 : 0), width = Math.max(40, w - b.indent - (b.marker ? 14 : 0));
		const lh = b.size * 1.38;
		// слова и пробелы с их стилем; перенос строки — отдельный элемент
		const items: (Item | "\n")[] = [];
		for (const r of b.runs) {
			for (const part of r.text.split(/(\n)/)) {
				if (part === "\n") { items.push("\n"); continue; }
				for (const tok of part.split(/([ ]+)/)) {
					if (!tok) continue;
					const space = /^ +$/.test(tok);
					items.push({ text: tok, run: r, w: measure(tok, b.size, r.bold), space });
				}
			}
		}
		// строки: жадная укладка; слово шире строки режется по буквам
		const lines: { items: Item[]; forced: boolean }[] = [];
		let line: Item[] = [], lw = 0;
		const pushLine = (forced: boolean) => { while (line.length && line[line.length - 1].space) line.pop(); lines.push({ items: line, forced }); line = []; lw = 0; };
		for (const it of items) {
			if (it === "\n") { pushLine(true); continue; }
			if (it.space && !line.length) continue;
			if (it.w > width && !it.space) {
				if (line.length) pushLine(false);
				let chunk = "";
				for (const ch of Array.from(it.text)) {
					if (measure(chunk + ch, b.size, it.run.bold) > width && chunk) { lines.push({ items: [{ text: chunk, run: it.run, w: measure(chunk, b.size, it.run.bold), space: false }], forced: false }); chunk = ""; }
					chunk += ch;
				}
				if (chunk) { line = [{ text: chunk, run: it.run, w: measure(chunk, b.size, it.run.bold), space: false }]; lw = line[0].w; }
				continue;
			}
			if (lw + it.w > width && !it.space && line.length) pushLine(false);
			if (it.space && !line.length) continue;
			line.push(it); lw += it.w;
		}
		if (line.length || !lines.length) pushLine(true);
		for (let li = 0; li < lines.length; li++) {
			const ln = lines[li];
			y = fl.fit(y, lh * (b.size > BASE && li === 0 ? 2 : 1));
			if (li === 0 && b.marker) doc.fontSize(b.size).fillColor("#333333").text(b.marker, x + b.indent, y, { lineBreak: false });
			const natural = ln.items.reduce((s, i) => s + i.w, 0);
			const spaces = ln.items.filter((i) => i.space).length;
			const justify = b.align === "justify" && !ln.forced && li < lines.length - 1 && spaces > 0 && natural < width;
			const extra = justify ? (width - natural) / spaces : 0;
			let px = left + (b.align === "center" ? (width - natural) / 2 : b.align === "right" ? width - natural : 0);
			for (const it of ln.items) {
				if (!it.space) {
					const r = it.run, color = r.href ? "#1A56DB" : b.size > BASE ? "#111111" : "#333333";
					doc.fontSize(b.size).fillColor(color);
					if (r.italic) { doc.save(); doc.translate(px, y + b.size * 0.8); doc.transform(1, 0, -0.2, 1, 0, 0); }
					const tx = r.italic ? 0 : px, ty = r.italic ? -b.size * 0.8 : y;
					const opts: Record<string, unknown> = { lineBreak: false, underline: r.underline, strike: r.strike };
					if (r.href) opts.link = r.href;
					if (r.bold) { doc.lineWidth(b.size * 0.032).strokeColor(color); opts.fill = true; opts.stroke = true; }
					doc.text(it.text, tx, ty, opts);
					if (r.italic) doc.restore();
				}
				px += it.w + (it.space ? extra : 0);
			}
			y += lh;
		}
		y += b.after;
	}
	return y;
}
