import { NextResponse } from "next/server";
import { reportError } from "@/lib/reportError";

export const dynamic = "force-dynamic";

// Ошибки из браузера: то, что иначе остаётся только в консоли и о чём никто не узнает. Приходят сюда
// без входа — публичные страницы тоже могут сломаться, — поэтому строго ограничены частотой и размером:
// иначе кто угодно мог бы завалить владельца сообщениями.
const WINDOW_MS = 10 * 60_000;
const LIMIT = 20;
const hits = new Map<string, { count: number; until: number }>();

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: Request) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const now = Date.now();
    const hit = hits.get(ip);
    if (hit && hit.until > now && hit.count >= LIMIT) return NextResponse.json({ ok: false });
    hits.set(ip, hit && hit.until > now ? { count: hit.count + 1, until: hit.until } : { count: 1, until: now + WINDOW_MS });
    if (hits.size > 500) hits.clear();

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const message = text(b.message, 500);
    if (!message) return NextResponse.json({ ok: false });

    await reportError(new Error(message), {
        where: `браузер: ${text(b.kind, 40) || "ошибка"}`,
        detail: { адрес: text(b.url, 300), стек: text(b.stack, 1500) },
    });
    return NextResponse.json({ ok: true });
}
