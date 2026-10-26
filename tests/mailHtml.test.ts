import { describe, expect, it } from "vitest";
import { escapeHtml, htmlToText, sanitizeOutgoingHtml, textToHtml } from "@/lib/mail/html";

describe("HTML исходящего письма", () => {
    it("форматирование панели сохраняется, а скрипты и обработчики вырезаются", () => {
        const html = '<p><b>Жирный</b> <i>курсив</i> <u>подчёркнутый</u> <strike>зачёркнутый</strike></p><ul><li>пункт</li></ul><font size="5" color="#eb5757">крупный</font><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">ссылка</a>';
        const clean = sanitizeOutgoingHtml(html);
        expect(clean).toContain("<b>Жирный</b>");
        expect(clean).toContain("<i>курсив</i>");
        expect(clean).toContain("<u>подчёркнутый</u>");
        expect(clean).toContain("<strike>зачёркнутый</strike>");
        expect(clean).toContain("<ul><li>пункт</li></ul>");
        expect(clean).toContain('<font size="5" color="#eb5757">');
        expect(clean).not.toMatch(/script|onerror|javascript:/i);
    });

    it("опасные контейнеры удаляются вместе с содержимым", () => {
        const clean = sanitizeOutgoingHtml('<p>до</p><iframe src="https://evil"></iframe><form><input value="x"></form><p>после</p>');
        expect(clean).toBe("<p>до</p><p>после</p>");
    });

    it("обычный текст превращается в HTML без исполнения разметки", () => {
        expect(textToHtml("<b>не тег</b>\nвторая строка")).toBe("&lt;b&gt;не тег&lt;/b&gt;<br>вторая строка");
        expect(escapeHtml('кавычки " и \'')).toBe("кавычки &quot; и &#39;");
    });

    it("HTML → текст: абзацы и списки не склеиваются, сущности раскрываются", () => {
        expect(htmlToText("<p>Привет</p><ul><li>раз</li><li>два</li></ul><p>Пока&nbsp;&amp;&nbsp;всё</p>")).toBe("Привет\n• раз\n• два\nПока & всё");
    });
});
