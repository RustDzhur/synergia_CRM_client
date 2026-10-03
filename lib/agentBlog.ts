import { timingSafeEqual } from "node:crypto";

// Доступ внешнего агента (например, из DeepSeek Harness) к блогу лендинга. Токен AGENT_BLOG_TOKEN даёт ровно одно право —
// читать список статей и класть статьи в блог (по умолчанию черновиками); к данным фирм, пользователям и настройкам он
// доступа не даёт. Отозвать — убрать переменную из .env сервера и перезапустить контейнер.
export const LANGS = ["en", "de", "ua"] as const;
export type Tx3 = { en: string; de: string; ua: string };

export function agentAuthorized(req: Request): "ok" | "off" | "denied" {
    const secret = process.env.AGENT_BLOG_TOKEN ?? "";
    if (secret.length < 24) return "off"; // не задан или слишком короткий — доступ агентов выключен
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const a = Buffer.from(token), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}

// Только текст: теги вырезаем, чтобы статья не принесла на лендинг чужую разметку или скрипт
const plain = (v: unknown, max: number) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/\r/g, "").trim().slice(0, max);

function tx3(v: unknown, what: string, max: number): Tx3 {
    const o = (v ?? {}) as Record<string, unknown>;
    const out = {} as Tx3;
    for (const l of LANGS) {
        const s = plain(o[l], max);
        if (!s) throw new Error(`${what}: text in "${l}" is required (all of en, de, ua)`);
        out[l] = s;
    }
    return out;
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const IMAGE = /^\/images\/blog\/[A-Za-z0-9._-]{1,80}$/;

export interface ParsedPost { slug: string; title: Tx3; excerpt: Tx3; body: Tx3[]; image?: string; publish: boolean; overwrite: boolean }

/** Разбор и проверка статьи от агента. Бросает Error с понятным сообщением — агент увидит его в ответе и исправит. */
export function parsePost(b: unknown): ParsedPost {
    const o = (b ?? {}) as Record<string, unknown>;
    const title = tx3(o.title, "title", 160);
    const excerpt = tx3(o.excerpt, "excerpt", 400);
    if (!Array.isArray(o.body) || !o.body.length) throw new Error("body must be a non-empty array of paragraphs, each {en, de, ua}");
    if (o.body.length > 60) throw new Error("body has too many paragraphs (max 60)");
    const body = o.body.map((p, i) => tx3(p, `body[${i}]`, 4000));
    const slug = plain(o.slug, 80) ? slugify(plain(o.slug, 80)) : slugify(title.en);
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug)) throw new Error("slug must be 3–80 chars of a–z, 0–9 and dashes (or omit it to build one from the English title)");
    const image = o.image === undefined || o.image === "" ? undefined : String(o.image);
    if (image !== undefined && !IMAGE.test(image)) throw new Error("image must be a path like /images/blog/name.jpg (or omit it)");
    return { slug, title, excerpt, body, image, publish: o.publish === true && process.env.AGENT_BLOG_AUTOPUBLISH === "1", overwrite: o.overwrite === true };
}
