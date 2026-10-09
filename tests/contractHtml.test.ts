import { describe, expect, it } from "vitest";
import { fillContractHtml, htmlToText, isHtmlBody, parseHtml, sanitizeHtml, textToHtml, tokensInHtml } from "@/lib/finance/contractHtml";

describe("очистка HTML договора", () => {
	it("скрипты, обработчики, чужие теги и стили выбрасываются; форматирование и выравнивание остаются", () => {
		const dirty = `<p style="text-align:center;color:red" onclick="x()">Привіт <b>жирний</b><script>alert(1)</script> <i>курсив</i></p><iframe src="http://evil"></iframe><div align="right">справа</div><a href="javascript:alert(1)">bad</a><a href="https://ok.example/a?b=1&c=2">ok</a>`;
		const out = sanitizeHtml(dirty);
		expect(out).toBe(`<p style="text-align:center">Привіт <strong>жирний</strong> <em>курсив</em></p><p style="text-align:right">справа</p>bad<a href="https://ok.example/a?b=1&amp;c=2">ok</a>`);
		expect(out).not.toMatch(/script|onclick|javascript|iframe|color/i);
		expect(sanitizeHtml(out)).toBe(out); // идемпотентна
	});
	it("картинки: только data-URL png/jpeg/gif/webp, внешние адреса и svg отбрасываются", () => {
		const ok = `<img src="data:image/png;base64,iVBORw0KGgo=" width="300">`;
		expect(sanitizeHtml(ok)).toBe(ok);
		expect(sanitizeHtml(`<img src="https://evil/x.png"><img src="data:image/svg+xml;base64,PHN2Zz4="><img src="javascript:1">`)).toBe("");
	});
	it("поля-меточки приводятся к каноническому виду, мусорные ключи отбрасываются", () => {
		expect(sanitizeHtml(`<p><span class="chip" style="x" data-field="customerName" contenteditable="false">Имя клиента</span> и <span data-field="bad key!">x</span></p>`)).toBe(`<p><span data-field="customerName">{{customerName}}</span> и x</p>`);
	});
	it("незакрытые теги закрываются, лишние закрывающие игнорируются, сущности не двоятся", () => {
		expect(sanitizeHtml(`<p>a &amp; b &lt;c&gt; <b>bold</i></p></div>`)).toBe(`<p>a &amp; b &lt;c&gt; <strong>bold</strong></p>`);
	});
});

describe("обычный текст ⇄ HTML", () => {
	it("{{ключи}} становятся полями, пробелы-колонки сохраняются, пустые строки — абзацы", () => {
		const html = textToHtml("ДОГОВІР № {{number}}\n\nЗамовник: {{customer}}    Адреса: {{ customerAddress }}");
		expect(isHtmlBody(html)).toBe(true);
		expect(html).toContain(`<span data-field="number">{{number}}</span>`);
		expect(html).toContain("<p><br></p>");
		expect(tokensInHtml(html)).toEqual(["number", "customer", "customerAddress"]);
		expect(htmlToText(html)).toBe("ДОГОВІР № {{number}}\n\nЗамовник: {{customer}}    Адреса: {{customerAddress}}");
		expect(isHtmlBody("ДОГОВІР № {{number}}")).toBe(false);
	});
	it("списки и заголовки в текстовом виде", () => {
		expect(htmlToText(`<h1>Договір</h1><ul><li>один</li><li>два</li></ul><p>A<br>B</p>`)).toBe("Договір\n• один\n• два\nA\nB");
	});
});

describe("подстановка в HTML", () => {
	it("значения экранируются, неизвестные метки остаются, HTML из значений не проходит", () => {
		const html = `<p>Клієнт: <span data-field="customer">{{customer}}</span>, {{Name}}, <span data-field="nope">{{nope}}</span></p>`;
		const vals: Record<string, string> = { customer: `<b>ООО "Ромашка"</b> & Co`, name: "Іван" };
		const out = fillContractHtml(html, (k) => vals[k.toLowerCase()]);
		expect(out).toBe(`<p>Клієнт: &lt;b&gt;ООО &quot;Ромашка&quot;&lt;/b&gt; &amp; Co, Іван, {{nope}}</p>`);
	});
	it("дерево разбирается: вложенность и атрибуты", () => {
		const t = parseHtml(`<ul><li a="1">x</li></ul>`);
		expect(t.children).toHaveLength(1);
	});
});

import { extractText, getDocumentProxy } from "unpdf";
import { renderDocumentPdf } from "@/lib/finance/pdf";
import { varResolver } from "@/lib/finance/contractText";

describe("PDF с богатым текстом договора", () => {
	it("форматирование печатается, значения подставлены, длинный текст переносится на следующие листы", async () => {
		const para = `<p style="text-align:justify">Пункт <strong>жирный</strong>, <em>курсив</em>, <u>подчёркнутый</u>, <s>зачёркнутый</s> и <a href="https://example.com">ссылка</a>. Заказчик <span data-field="customer">{{customer}}</span> принимает услуги. ${"Длинное предложение для проверки переноса по словам. ".repeat(6)}</p>`;
		const html = `<h1 style="text-align:center">ДОГОВІР № <span data-field="number">{{number}}</span></h1>` + `<ul><li>Первый пункт</li><li>Второй пункт</li></ul><ol><li>Раз</li><li>Два</li></ol>` + para.repeat(14)
			+ `<p style="text-align:right">Подпись: ______  {{unknownTag}}</p><p>Колонки:&nbsp;&nbsp;&nbsp;&nbsp;слева&nbsp;&nbsp;&nbsp;&nbsp;справа</p>`;
		const vars = { number: "HF-77", customer: `ООО «Ромашка» & <Co>` };
		const body = fillContractHtml(html, varResolver(vars));
		const buf = await renderDocumentPdf(
			{ kind: "contract", number: "HF-77", customer: { name: "ООО «Ромашка»" }, items: [], currency: "UZS", value: 1500000, body, issueDate: "2026-10-09" },
			{ legalName: "Firmspace MChJ", address: "Toshkent", taxId: "301", iban: "", bic: "", paymentTermsDays: 5, country: "UZ" },
			"uz"
		);
		expect(buf.subarray(0, 4).toString()).toBe("%PDF");
		const pdf = await getDocumentProxy(new Uint8Array(buf));
		expect(pdf.numPages).toBeGreaterThan(1);
		const { text } = await extractText(pdf, { mergePages: true });
		expect(text).toContain("HF-77");
		expect(text).toContain("Ромашка");
		expect(text).toContain("{{unknownTag}}");
		expect(text).toContain("Второй пункт");
		expect(text).not.toContain("<strong>");
		expect(text).not.toContain("data-field");
	});
});
