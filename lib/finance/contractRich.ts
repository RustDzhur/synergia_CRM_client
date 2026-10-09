// Визуальный редактор договоров: текст шаблона хранится в двух видах.
// body — простой текст с метками {{key}}: его читает PDF и подстановка (fillContractText), поэтому он остаётся главным.
// bodyHtml — то, что видит юрист в редакторе (заголовки, жирный, списки, чипы полей); без него шаблон открывается из body.
// Файл чистый (без DOM): работает и в браузере, и в тестах.

export const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/** Чип поля в редакторе: нередактируемый «пузырёк» {{key}}. */
export function chipHtml(key: string): string {
	const k = esc(key);
	return `<span class="ct-chip" data-key="${k}" contenteditable="false">{{${k}}}</span>`;
}

/** Простой текст → HTML редактора: строка — абзац, {{key}} — чип. */
export function textToHtml(text: string): string {
	return String(text ?? "")
		.split(/\r?\n/)
		.map((line) => {
			if (!line.trim()) return "<p><br></p>";
			let out = "";
			let last = 0;
			const re = new RegExp(TOKEN_RE.source, "g");
			for (let m = re.exec(line); m; m = re.exec(line)) {
				out += esc(line.slice(last, m.index)) + chipHtml(m[1]);
				last = m.index + m[0].length;
			}
			return `<p>${out}${esc(line.slice(last))}</p>`;
		})
		.join("");
}

/** HTML редактора → простой текст с {{key}}: абзацы и пункты — строками, списки получают «• »/«1. ». */
export function htmlToText(html: string): string {
	const stack: string[] = [];
	const counters: number[] = [];
	let out = "";
	const parts = String(html ?? "")
		.replace(/<span\b[^>]*\bdata-key="([^"]*)"[^>]*>.*?<\/span>/gis, (_, k: string) => `{{${unesc(k)}}}`)
		.split(/(<[^>]+>)/);
	for (const part of parts) {
		const tag = /^<\s*(\/?)\s*([a-zA-Z0-9]+)/.exec(part);
		if (!tag) { out += unesc(part); continue; }
		const closing = tag[1] === "/";
		const name = tag[2].toLowerCase();
		if (name === "br") { out += "\n"; continue; }
		if (name === "ul" || name === "ol") {
			if (closing) { stack.pop(); counters.pop(); } else { stack.push(name); counters.push(0); }
			if (!out.endsWith("\n") && out) out += "\n";
			continue;
		}
		if (name === "li") {
			if (!closing) {
				const kind = stack[stack.length - 1] ?? "ul";
				if (kind === "ol") counters[counters.length - 1]++;
				if (out && !out.endsWith("\n")) out += "\n";
				out += kind === "ol" ? `${counters[counters.length - 1]}. ` : "• ";
			} else out += "\n";
			continue;
		}
		if (closing && /^(p|div|h[1-6]|blockquote)$/.test(name)) out += "\n";
	}
	// пустой <p><br></p> даёт \n\n — это и есть пустая строка договора; хвостовые переводы строк не нужны
	return out.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

/** Ключи полей, использованные в HTML или тексте. */
export function keysIn(textOrHtml: string): string[] {
	const seen: string[] = [];
	const re = new RegExp(TOKEN_RE.source, "g");
	const src = String(textOrHtml ?? "");
	for (let m = re.exec(src); m; m = re.exec(src)) if (!seen.includes(m[1])) seen.push(m[1]);
	return seen;
}
