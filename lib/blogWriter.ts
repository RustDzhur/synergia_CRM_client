// Ежедневный блог-робот внутри CRM: пишет 1–2 статьи в сутки на en/de/ua/uz (en/de обязательны,
// ua/uz — если модель справится, иначе en-фолбэк), с картинкой из Openverse (CC0/PD) и публикует их
// сразу (published: true). Вызывается из /api/cron/blog (защищён CRON_SECRET) cron'ом сервера каждые
// 10 минут; защита от дублей — здесь: не больше 2 статей за сутки, вторая — не раньше чем через 8 часов.
// Тема пула — «ИИ и автоматизация в работе малого бизнеса»; без выдуманных цифр и цен.

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

const SYSTEM = [
    "You are the blog author of Firmspace AI, an AI platform for small businesses (CRM, finance, stock, the AI assistant Ayris).",
    "Write a practical, no-fluff article for the landing page: 5-8 paragraphs on the given topic.",
    "Rules: plain text without HTML, no invented figures, prices or promises about the product, no marketing fluff — answer the practical question for a busy small-business owner.",
    "Reply with ONLY a JSON object, no markdown and no explanations:",
    '{ "title": {"en": "…", "de": "…", "ua": "…", "uz": "…"}, "excerpt": {"en": "…", "de": "…", "ua": "…", "uz": "…"}, "body": [{"en": "…", "de": "…", "ua": "…", "uz": "…"}] }',
    "Limits: title ≤ 160 characters, excerpt ≤ 400, each paragraph ≤ 4000, all four languages required.",
].join("\n");

const plain = (v: unknown) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/\r/g, "").trim();

// Модель могла обернуть JSON в пояснение — берём первые фигурные скобки
const extractJson = (text: string): Record<string, unknown> => {
    const m = /\{[\s\S]*\}/.exec(text ?? "");
    if (!m) throw new Error("The model returned no JSON");
    const v = JSON.parse(m[0]);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("The model returned no JSON");
    return v as Record<string, unknown>;
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
    const reply = await complete(SYSTEM, [{ role: "user", text: `Topic: ${topic}` }], [], { maxTokens: 4000 });
    const o = extractJson(reply.text);
    const title = localize(o.title);
    const excerpt = localize(o.excerpt);
    const bodyRaw = Array.isArray(o.body) ? o.body : [];
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
