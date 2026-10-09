import { describe, expect, it } from "vitest";
import { chipHtml, htmlToText, keysIn, textToHtml } from "@/lib/finance/contractRich";

describe("contractRich", () => {
	it("текст → HTML → текст сохраняет метки и пустые строки", () => {
		const text = "Kundenvertrag\n\nzwischen {{CompanyName}}, vertreten durch {{ContactPerson}}";
		expect(htmlToText(textToHtml(text))).toBe(text);
	});
	it("чип превращается в {{key}}, форматирование в тексте не мешает", () => {
		const html = `<h2>§ 2</h2><p>Der Vertrag beginnt am ${chipHtml("StartDate")} <b>und</b> endet.</p>`;
		expect(htmlToText(html)).toBe("§ 2\nDer Vertrag beginnt am {{StartDate}} und endet.");
	});
	it("списки получают маркеры и номера", () => {
		expect(htmlToText("<ul><li>a</li><li>b</li></ul><ol><li>c</li><li>d</li></ol>")).toBe("• a\n• b\n1. c\n2. d");
	});
	it("экранирует HTML из текста и находит ключи", () => {
		expect(textToHtml("<b>x</b> {{Price}}")).toContain("&lt;b&gt;x&lt;/b&gt;");
		expect(keysIn("{{a}} {{ b }} {{a}}")).toEqual(["a", "b"]);
	});
});
