import { NextResponse } from "next/server";
import { complete, aiConfigured, type Msg } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/cron/translate-blog — перевод статей сайта на русский.
 *
 * Тело: { items: [{ slug, title, excerpt, body[] }] } (не больше 4 статей за вызов).
 * Ответ: { items: [{ slug, title, excerpt, body[] }] } — те же поля по-русски.
 * Зачем: страница блога обязана говорить на языке интерфейса; английский
 * текст в русском интерфейсе — это не перевод, а подмена.
 */
interface Item {
    slug: string;
    title: string;
    excerpt: string;
    body: string[];
}

function parseJson(text: string): { items: Item[] } | null {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
        return JSON.parse(cleaned.slice(start, end + 1)) as { items: Item[] };
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (!aiConfigured()) {
        return NextResponse.json({ message: "AI is not configured", code: "not_configured" }, { status: 503 });
    }
    let payload: { items?: Item[] };
    try {
        payload = (await req.json()) as { items?: Item[] };
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const items = Array.isArray(payload.items) ? payload.items.slice(0, 4) : [];
    if (items.length === 0) return NextResponse.json({ items: [] });

    const prompt = [
        "Переведи статьи блога на русский язык. Верни ТОЛЬКО JSON без пояснений.",
        'Формат ответа: {"items":[{"slug":"...","title":"...","excerpt":"...","body":["абзац 1","абзац 2"]}]}',
        "Правила: сохрани количество абзацев и их порядок; не сокращай и не добавляй факты, цифры и обещания; деловые имена и названия продуктов (Firmspace, DATEV, CRM) — без перевода; без HTML и без markdown.",
        "",
        "Статьи:",
        JSON.stringify(items.map((item) => ({ slug: item.slug, title: item.title, excerpt: item.excerpt, body: item.body }))),
    ].join("\n");

    try {
        const messages: Msg[] = [{ role: "user", text: prompt }];
        const reply = await complete("Du bist ein professioneller Übersetzer.", messages, [], { maxTokens: 8000 });
        const parsed = parseJson(reply.text);
        if (!parsed?.items) return NextResponse.json({ message: "Model returned no JSON" }, { status: 502 });
        const bySlug = new Map(parsed.items.map((item) => [String(item.slug), item]));
        const result = items.map((item) => {
            const translated = bySlug.get(item.slug);
            const body = translated && Array.isArray(translated.body) && translated.body.length === item.body.length
                ? translated.body
                : item.body;
            return {
                slug: item.slug,
                title: (translated && translated.title) || item.title,
                excerpt: (translated && translated.excerpt) || item.excerpt,
                body,
            };
        });
        return NextResponse.json({ items: result });
    } catch (e) {
        console.error("translate-blog failed", e instanceof Error ? e.message : "unknown");
        return NextResponse.json({ message: "Translation failed" }, { status: 500 });
    }
}
