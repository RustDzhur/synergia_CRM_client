// Ежедневный блог-робот внутри CRM: пишет 1–2 статьи в сутки на en/de/ua/uz (en/de обязательны,
// ua/uz — если модель справится, иначе en-фолбэк), с картинкой из Openverse (CC0/PD) и публикует их
// сразу (published: true). Вызывается из /api/cron/blog (защищён CRON_SECRET) cron'ом сервера каждые
// 10 минут; защита от дублей — здесь: не больше 2 статей за сутки, вторая — не раньше чем через 8 часов.
// Тема пула — «ИИ и автоматизация в работе малого бизнеса»; без выдуманных цифр и цен.
// Статья пишется двумя вызовами модели: заголовок+аннотация (маленький ответ) и абзацы (большой ответ
// с увеличенным бюджетом токенов) — иначе JSON четырёх языков обрезался лимитом.

import { execFileSync } from "node:child_process";
import { complete } from "@/lib/ai/provider";
import { parsePost, slugify } from "@/lib/agentBlog";
import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;
const GAP = 8 * 60 * 60 * 1000; // вторая статья дня — не раньше чем через 8 часов после первой
const MAX_TOPIC_ATTEMPTS = 3;

const TOPICS = [
    "How AI handles everyday small-business paperwork",
    "Automating invoice reminders without losing the personal touch",
    "Why one shared inbox beats scattered e-mail accounts in a small team",
    "Turning website visitors into tracked leads automatically",
    "Practical ways to automate follow-ups after a quote",
    "Stock control for small businesses without spreadsheets",
    "How a small firm can draft contracts safely with AI support",
    "Simple automations that save an office manager hours every week",
    "From voice note to task: hands-free delegation with an AI assistant",
    "What a small business can learn from its own sales data",
    "AI support for boring but necessary compliance tasks",
    "How automatic document recognition speeds up bookkeeping",
];

const HEAD_SYSTEM = [
    "You are the blog author of Firmspace AI, an AI platform for small businesses (CRM, finance, stock, the AI assistant Ayris).",
    "Pick a title and a one-sentence excerpt for a practical, no-fluff article on the given topic.",
    "Rules: plain text without HTML, no invented figures, prices or promises about the product.",
    "Reply with ONLY a JSON object, no markdown and no explanations:",
    '{ "title": {"en": "…", "de": "…", "ua": "…", "uz": "…"}, "excerpt": {"en": "…", "de": "…", "ua": "…", "uz": "…"} }',
    "Limits: title ≤ 160 characters, excerpt ≤ 400, all four languages required.",
].join("\n");

const BODY_SYSTEM = [
    "You write the body of a blog article for Firmspace AI, an AI platform for small businesses.",
    "Write 5-6 short paragraphs on the given topic — practical, no fluff, for a busy small-business owner.",
    "Rules: plain text without HTML, no invented figures, prices or promises; 2-4 sentences per paragraph; all four languages required.",
    "Reply with ONLY a JSON object, no markdown and no explanations:",
    '{ "body": [{"en": "…", "de": "…", "ua": "…", "uz": "…"}] }',
    "Each paragraph ≤ 1500 characters per language.",
].join("\n");

const plain = (v: unknown) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/\r/g, "").trim();

// Модель могла обернуть JSON в пояснение или упереться в лимит токенов: берём от первой «{»,
// пробуем как есть, с обрезкой хвоста и с достройкой закрывающих скобок оборванного JSON.
const extractJson = (text: string): Record<string, unknown> => {
    const start = String(text ?? "").indexOf("{");
    if (start < 0) throw new Error("The model returned no JSON");
    const base = text.slice(start);
    const repairs = ["", "}", "]", "}]", "]}", "\"}", "\"]}", "}", "}]}"];
    const candidates: string[] = [];
    for (const r of repairs) candidates.push(base + r);
    for (let cut = 1; cut <= Math.min(400, base.length); cut += 25) candidates.push(base.slice(0, base.length - cut));
    for (const c of candidates) {
        try {
            const v = JSON.parse(c);
            if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
        } catch { /* пробуем следующий вариант */ }
    }
    throw new Error("The model returned no valid JSON");
};

// {en,de,ua,uz} из ответа модели; пустой язык — текст en (en обязателен, de/ua/uz — фолбэк)
const localize = (json: unknown): { en: string; de: string; ua: string; uz: string } => {
    const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
    const en = plain(o.en);
    if (!en) throw new Error("The model returned no English text");
    return { en, de: plain(o.de) || en, ua: plain(o.ua) || en, uz: plain(o.uz) || en };
};

// Одна статья по теме → готовый объект для parsePost; slug строится из английского заголовка
async function generate(topic: string) {
    const head = await complete(HEAD_SYSTEM, [{ role: "user", text: `Topic: ${topic}` }], [], { maxTokens: 1500 });
    const h = extractJson(head.text);
    const title = localize(h.title);
    const excerpt = localize(h.excerpt);
    const bodyReply = await complete(BODY_SYSTEM, [{ role: "user", text: `Topic: ${topic}. Title (for context): ${title.en}. Write the body now.` }], [], { maxTokens: 8000 });
    const b = extractJson(bodyReply.text);
    const bodyRaw = Array.isArray(b.body) ? b.body : [];
    if (!bodyRaw.length) throw new Error("The model returned no body");
    const body = bodyRaw.map((p) => localize(p));
    return { slug: slugify(title.en), title, excerpt, body };
}

// Картинка к статье: Openverse → 1200×630 → public/images/blog/<slug>.jpg (+ копия на томе /data/storage).
// Возвращает путь /images/blog/<slug>.jpg; сбой картинки не срывает публикацию (остаётся картинка по умолчанию).
function fetchImage(slug: string, query: string): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const out = execFileSync(process.execPath, ["scripts/fetch-blog-image.mjs", slug, query], {
                cwd: process.cwd(),
                encoding: "utf8",
                timeout: 120_000,
                stdio: ["ignore", "pipe", "pipe"],
            });
            const path = out.trim().split("\n").pop() ?? "";
            /^\/images\/blog\/[A-Za-z0-9._-]{1,80}$/.test(path) ? resolve(path) : reject(new Error("image script returned no path"));
        } catch (e) {
            reject(e);
        }
    });
}

export interface WriteResult { ok: boolean; slug?: string; skipped?: boolean; image?: boolean }

/** Публикует одну статью, если лимит дня позволяет. null-результат маршрут превращает в «skipped». */
export async function writeBlogArticle(): Promise<WriteResult | null> {
    const since = new Date(Date.now() - DAY);
    const recent = await prisma.blogPost.findMany({
        where: { published: true, publishedAt: { gte: since } },
        orderBy: { publishedAt: "desc" },
        select: { slug: true, publishedAt: true },
    });
    if (recent.length >= 2) return null; // лимит: не больше 2 статей в сутки
    if (recent.length === 1 && Date.now() - new Date(recent[0].publishedAt).getTime() < GAP) return null; // вторая — не раньше чем через 8 часов

    const known = new Set((await prisma.blogPost.findMany({ select: { slug: true } })).map((r) => r.slug));
    const start = Math.floor(Date.now() / DAY) % TOPICS.length;
    let lastError = "";
    for (let attempt = 0; attempt < MAX_TOPIC_ATTEMPTS; attempt++) {
        const topic = TOPICS[(start + attempt) % TOPICS.length];
        try {
            const article = await generate(topic);
            if (known.has(article.slug)) { lastError = `slug ${article.slug} already exists`; continue; }
            const image = await fetchImage(article.slug, topic).catch(() => "");
            const post = parsePost({ ...article, ...(image ? { image } : {}), publish: true });
            const saved = await prisma.blogPost.create({
                data: {
                    slug: post.slug,
                    title: post.title as never,
                    excerpt: post.excerpt as never,
                    body: post.body as never,
                    image: image || "/images/blog/code.jpg",
                    published: true,
                },
            });
            return { ok: true, slug: saved.slug, image: !!image };
        } catch (e) {
            lastError = e instanceof Error ? e.message : "unknown";
        }
    }
    throw new Error(`blog writer failed: ${lastError}`);
}
