import { describe, expect, it } from "vitest";
import { fetchPage, isPrivateIp, readHtml, WebError } from "@/lib/ai/webFetch";
import { toolsFor, TEMPLATES } from "@/lib/office/templates";

describe("web_fetch для роботов", () => {
    it("внутренние адреса закрыты", async () => {
        for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"]) expect(isPrivateIp(ip)).toBe(true);
        expect(isPrivateIp("8.8.8.8")).toBe(false);
        for (const u of ["http://localhost/", "http://127.0.0.1:3000/", "http://169.254.169.254/latest", "file:///etc/passwd", "http://user:pw@example.com/"]) await expect(fetchPage(u)).rejects.toBeInstanceOf(WebError);
    });
    it("страница → текст без скриптов, заголовок, ссылки", () => {
        const r = readHtml('<html><head><title>Preise &amp; Pläne</title><meta name="description" content="Alles"><script>evil()</script></head><body><h1>Pro</h1><p>49 €</p><a href="/kontakt">Kontakt</a></body></html>', new URL("https://example.com/"));
        expect(r.title).toBe("Preise & Pläne");
        expect(r.description).toBe("Alles");
        expect(r.text).toContain("49 €");
        expect(r.text).not.toContain("evil");
        expect(r.links[0].url).toBe("https://example.com/kontakt");
    });
    it("навык web даёт инструменты и есть робот-исследователь", () => {
        expect(toolsFor(["web"]).sort()).toEqual(["list_research", "save_research", "send_telegram_report", "web_fetch"]);
        expect(TEMPLATES.find((t) => t.id === "scout")?.skills).toContain("web");
    });
});
