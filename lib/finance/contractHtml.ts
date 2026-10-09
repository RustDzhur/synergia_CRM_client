// Богатый текст договоров (docs/CONTRACT_EDITOR.md). Шаблон и текст договора хранятся как ограниченный HTML: абзацы, заголовки, жирный/курсив/
// подчёркнутый/зачёркнутый, выравнивание, списки, ссылки, картинки (data-URL) и поля-меточки <span data-field="ключ">{{ключ}}</span>.
// Всё, что вне белого списка, отбрасывается — HTML приходит из браузера и из вставки чужого текста, ему нельзя доверять.
// Прежние договоры — обычный текст с {{…}} — остаются как есть: isHtmlBody() их отличает, редактор при открытии превращает их в абзацы с метками.
// Файл чистый (без DOM и Node-модулей): работает и в браузере (редактор), и на сервере (очистка при сохранении, подстановка, PDF).

export const isHtmlBody = (s: string) => /^\s*<(p|h[1-6]|div|ul|ol|br|hr|img|blockquote|span)\b/i.test(String(s ?? ""));

export const escapeHtml = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…", euro: "€", sect: "§", copy: "©", reg: "®", deg: "°", times: "×", bull: "•" };
export const decodeEntities = (s: string) =>
	s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
		if (e[0] === "#") { const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ""; }
		return ENTITIES[e.toLowerCase()] ?? m;
	});

// ── разбор в лёгкое дерево ─────────────────────────────────────────────────────────────────────────
export interface HNode { tag: string; attrs: Record<string, string>; children: (HNode | string)[] }
const VOID = new Set(["br", "hr", "img"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript", "svg", "math", "head", "title"]);

function parseAttrs(src: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of Array.from(src.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g))) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
	return out;
}

/** Разбор HTML в дерево (теги приводятся к нижнему регистру, лишние закрывающие игнорируются, незакрытые закрываются в конце). */
export function parseHtml(html: string): HNode {
	const root: HNode = { tag: "#root", attrs: {}, children: [] };
	const stack: HNode[] = [root];
	const src = String(html ?? "").replace(/<!--[\s\S]*?-->/g, "");
	const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+|<)/g;
	let skipUntil: string | null = null;
	for (const m of Array.from(src.matchAll(re))) {
		const top = stack[stack.length - 1];
		if (m[4] !== undefined) { if (!skipUntil) top.children.push(decodeEntities(m[4])); continue; }
		const closing = m[1] === "/", tag = m[2].toLowerCase();
		if (skipUntil) { if (closing && tag === skipUntil) skipUntil = null; continue; }
		if (closing) {
			for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
			continue;
		}
		if (DROP_WITH_CONTENT.has(tag)) { if (!/\/\s*$/.test(m[3])) skipUntil = tag; continue; }
		const node: HNode = { tag, attrs: parseAttrs(m[3]), children: [] };
		top.children.push(node);
		if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push(node);
	}
	return root;
}

// ── очистка ────────────────────────────────────────────────────────────────────────────────────────
const BLOCK = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote"]);
const TAG_MAP: Record<string, string> = { b: "strong", strong: "strong", i: "em", em: "em", u: "u", s: "s", strike: "s", del: "s", h4: "h3", h5: "h3", h6: "h3", div: "p", h1: "h1", h2: "h2", h3: "h3", p: "p", ul: "ul", ol: "ol", li: "li", a: "a", br: "br", hr: "hr", span: "span", img: "img", blockquote: "p" };
const FIELD_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,59}$/;
const MAX_IMG = 700_000;

function alignOf(attrs: Record<string, string>): string {
	const style = /text-align\s*:\s*(left|right|center|justify)/i.exec(attrs.style ?? "");
	const a = (style?.[1] ?? attrs.align ?? "").toLowerCase();
	return ["center", "right", "justify"].includes(a) ? a : "";
}
const safeHref = (h: string) => (/^(https?:\/\/|mailto:|tel:)/i.test(h.trim()) ? h.trim().slice(0, 500) : "");
const safeImg = (src: string) => (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src) && src.length <= MAX_IMG ? src.replace(/\s+/g, "") : "");

function ser(node: HNode | string): string {
	if (typeof node === "string") return escapeHtml(node);
	const tag = TAG_MAP[node.tag];
	const inner = () => node.children.map(ser).join("");
	if (!tag) return inner(); // неизвестный тег: оставляем только содержимое
	if (tag === "br" || tag === "hr") return `<${tag}>`;
	if (tag === "img") { const src = safeImg(node.attrs.src ?? ""); if (!src) return ""; const w = Math.round(Number(node.attrs.width) || 0); return `<img src="${src}"${w >= 20 && w <= 800 ? ` width="${w}"` : ""}>`; }
	if (tag === "span") {
		const key = node.attrs["data-field"];
		if (key && FIELD_KEY.test(key)) return `<span data-field="${key}">{{${key}}}</span>`; // поле-меточка: содержимое — всегда канонический вид
		return inner();
	}
	if (tag === "a") { const href = safeHref(node.attrs.href ?? ""); return href ? `<a href="${escapeHtml(href)}">${inner()}</a>` : inner(); }
	const align = BLOCK.has(node.tag) || tag === "p" ? alignOf(node.attrs) : "";
	const style = align ? ` style="text-align:${align}"` : "";
	return `<${tag}${style}>${inner()}</${tag}>`;
}

/** Очищенный HTML: только разрешённые теги и атрибуты; пустой ввод — пустая строка. Идемпотентна. */
export function sanitizeHtml(html: string, maxLength = 300_000): string {
	const out = parseHtml(String(html ?? "").slice(0, maxLength * 2)).children.map(ser).join("");
	return out.length > maxLength ? out.slice(0, maxLength) : out;
}

// ── обычный текст ⇄ HTML ──────────────────────────────────────────────────────────────────────────
/** Преамбула «с метками»: {{key}} превращается в поле-меточку; пробелы подряд сохраняются (колонки реквизитов в старых шаблонах). */
export function textToHtml(text: string): string {
	const para = (line: string) => {
		if (!line.trim()) return "<p><br></p>";
		const parts = line.split(/(\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\})/g).map((p) => {
			const m = /^\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}$/.exec(p);
			return m ? `<span data-field="${m[1]}">{{${m[1]}}}</span>` : escapeHtml(p).replace(/ {2,}/g, (sp) => ` ${" ".repeat(sp.length - 1)}`).replace(/\t/g, "    ");
		});
		return `<p>${parts.join("")}</p>`;
	};
	return String(text ?? "").split(/\r?\n/).map(para).join("");
}

/** Текст без разметки (поиск, письма, запасной вывод): абзацы — строки, метки — {{ключ}}. */
export function htmlToText(html: string): string {
	const lines: string[] = [];
	let cur = "";
	const flush = () => { lines.push(cur.replace(/ /g, " ")); cur = ""; };
	const walk = (n: HNode | string) => {
		if (typeof n === "string") { cur += n; return; }
		const tag = TAG_MAP[n.tag] ?? n.tag;
		if (tag === "br") { flush(); return; }
		if (tag === "hr") { if (cur) flush(); lines.push("————————"); return; }
		if (tag === "span" && n.attrs["data-field"]) { cur += `{{${n.attrs["data-field"]}}}`; return; }
		const block = ["p", "h1", "h2", "h3", "li", "ul", "ol"].includes(tag);
		if (block && cur) flush();
		if (tag === "li") cur += "• ";
		n.children.forEach(walk);
		if (block && cur) flush();
	};
	parseHtml(html).children.forEach(walk);
	if (cur) flush();
	return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Метки в HTML: поля-меточки и {{ключи}} в обычном тексте (по порядку, без повторов, регистр не важен). */
export function tokensInHtml(html: string): string[] {
	const seen = new Set<string>(), out: string[] = [];
	const add = (k: string) => { if (!seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); } };
	const walk = (n: HNode | string) => {
		if (typeof n === "string") { for (const m of Array.from(n.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g))) add(m[1]); return; }
		if (n.tag === "span" && n.attrs["data-field"] && FIELD_KEY.test(n.attrs["data-field"])) { add(n.attrs["data-field"]); return; }
		n.children.forEach(walk);
	};
	parseHtml(html).children.forEach(walk);
	return out;
}

/**
 * Подстановка значений в HTML договора: поля-меточки и {{ключи}} в тексте заменяются экранированными значениями (HTML из значений не попадает);
 * resolve(ключ) возвращает значение или undefined — тогда метка остаётся как написана и её видно в тексте.
 */
export function fillContractHtml(html: string, resolve: (key: string) => string | undefined): string {
	const sub = (key: string, whole: string) => { const v = resolve(key); return v === undefined ? whole : escapeHtml(v); };
	const clean = sanitizeHtml(html);
	return clean
		.replace(/<span data-field="([a-zA-Z0-9_]+)">\{\{[a-zA-Z0-9_]+\}\}<\/span>/g, (_w, k: string) => sub(k, `{{${k}}}`))
		.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (w, k: string) => sub(k, w));
}

/** Текст договора/шаблона при сохранении: богатый текст очищается от опасной разметки, обычный остаётся как есть (с ограничением размера). */
export function cleanBody(body: unknown): string {
	const s = typeof body === "string" ? body.trim() : "";
	return isHtmlBody(s) ? sanitizeHtml(s, 300_000) : s.slice(0, 60_000);
}
