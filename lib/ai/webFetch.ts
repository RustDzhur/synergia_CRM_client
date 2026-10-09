import { promises as dns } from "node:dns";
import net from "node:net";

// Чтение публичной веб-страницы для роботов-исследователей (мониторинг конкурентов и т. п.).
// Защита: только http/https, никаких внутренних адресов (SSRF) — проверяется и адрес страницы, и каждый редирект;
// ограничены время, размер и число переходов. Текст страницы — недоверенные данные (run.ts помечает чтение как «чужой текст»).

const MAX_BYTES = 1_500_000;
const MAX_TEXT = 12_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

export class WebError extends Error {}

export function isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split(".").map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

async function assertPublic(u: URL): Promise<void> {
    if (!/^https?:$/.test(u.protocol)) throw new WebError("Only http and https addresses are allowed");
    if (u.username || u.password) throw new WebError("Addresses with a login are not allowed");
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new WebError("This address is not public");
    const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => { throw new WebError("The site could not be found"); })).map((r) => r.address);
    if (!ips.length || ips.some(isPrivateIp)) throw new WebError("This address is not public");
}

const ENT: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&nbsp;": " ", "&euro;": "€" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|nbsp|euro|#39);/g, (m) => ENT[m] ?? m).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Страница → заголовок, описание, чистый текст и ссылки. */
export function readHtml(html: string, base: URL) {
    const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim()).slice(0, 200);
    const description = decode((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1] ?? "").trim()).slice(0, 300);
    const links: { text: string; url: string }[] = [];
    for (const m of Array.from(html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
        if (links.length >= 40) break;
        try {
            const url = new URL(m[1], base);
            if (!/^https?:$/.test(url.protocol)) continue;
            links.push({ text: decode(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 80), url: url.toString() });
        } catch { /* битая ссылка */ }
    }
    const text = decode(html
        .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)\s*>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " "))
        .replace(/[ \t\f\v]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    return { title, description, text: text.slice(0, MAX_TEXT), truncated: text.length > MAX_TEXT, links };
}

export async function fetchPage(rawUrl: string) {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new WebError("Not a valid address"); }
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertPublic(url);
        const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "Mozilla/5.0 (compatible; FirmspaceRobot/1.0)", Accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language": "en,de;q=0.8,uk;q=0.6,ru;q=0.5" } }).catch(() => { throw new WebError("The site did not answer"); });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location") as string, url); continue; }
        if (!res.ok) throw new WebError(`The site answered with status ${res.status}`);
        const type = res.headers.get("content-type") ?? "";
        if (!/text\/|html|xml|json/i.test(type)) throw new WebError(`Unsupported content type (${type || "unknown"})`);
        const reader = res.body?.getReader();
        if (!reader) throw new WebError("Empty answer");
        const chunks: Uint8Array[] = []; let size = 0;
        while (size < MAX_BYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; }
        void reader.cancel().catch(() => undefined);
        const body = Buffer.concat(chunks).toString("utf8");
        const page = /html|xml/i.test(type) ? readHtml(body, url) : { title: "", description: "", text: body.slice(0, MAX_TEXT), truncated: body.length > MAX_TEXT, links: [] };
        return { url: url.toString(), ...page };
    }
    throw new WebError("Too many redirects");
}
