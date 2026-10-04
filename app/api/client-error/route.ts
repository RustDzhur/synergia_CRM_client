import { NextResponse } from "next/server";
import { ingest } from "@/lib/errorHub";

export const dynamic = "force-dynamic";

// Ошибки из браузера: исключения, отказавшие промисы, console.error, упавшие запросы, не загрузившиеся файлы, поломки отрисовки — всё, что
// иначе остаётся только в консоли браузера. Приходят без входа (публичные страницы тоже ломаются), поэтому строго ограничены частотой и
// размером: иначе кто угодно мог бы завалить владельца сообщениями. Дальше — lib/errorHub.ts (повторы, объяснение, Telegram).
const WINDOW_MS = 10 * 60_000;
const LIMIT = 60;
const hits = new Map<string, { count: number; until: number }>();

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const KINDS: Record<string, string> = {
    error: "исключение", rejection: "необработанный промис", console: "console.error", fetch: "запрос не удался", resource: "файл не загрузился",
    render: "поломка отрисовки страницы", csp: "блокировка политики безопасности",
};

export async function POST(req: Request) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const now = Date.now();
    const hit = hits.get(ip);
    if (hit && hit.until > now && hit.count >= LIMIT) return NextResponse.json({ ok: false });
    hits.set(ip, hit && hit.until > now ? { count: hit.count + 1, until: hit.until } : { count: 1, until: now + WINDOW_MS });
    if (hits.size > 500) hits.clear();

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const message = text(b.message, 600);
    if (!message) return NextResponse.json({ ok: false });
    const extra = (b.extra && typeof b.extra === "object" ? b.extra : {}) as Record<string, unknown>;
    const crumbs = Array.isArray(b.crumbs) ? b.crumbs.slice(-8).map((c) => text(c, 160)).filter(Boolean).join(" → ") : "";

    await ingest({
        source: "browser",
        kind: KINDS[text(b.kind, 20)] ?? (text(b.kind, 40) || "ошибка"),
        message,
        stack: text(b.stack, 2000),
        url: text(b.url, 300),
        detail: {
            браузер: text(b.ua, 160),
            экран: text(b.viewport, 30),
            язык: text(b.lang, 10),
            "что было до": crumbs,
            ...(extra.status ? { статус: String(extra.status).slice(0, 10) } : {}),
            ...(extra.method ? { метод: String(extra.method).slice(0, 10) } : {}),
            ...(extra.target ? { элемент: text(extra.target, 200) } : {}),
        },
    });
    return NextResponse.json({ ok: true });
}
