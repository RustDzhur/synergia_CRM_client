import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/rateLimit";
import { authenticate, type Connection } from "./keys";

// Общая проверка входа для внешних агентов: ключ, тариф, лимиты. Ответ-ошибка или подключение.
const day = (globalThis as { __connectDay?: Map<string, { d: string; n: number }> });
export async function connectGate(req: Request): Promise<{ res: Response } | { conn: Connection }> {
    const a = await authenticate(req);
    if (a.state === "denied") return { res: NextResponse.json({ message: "Invalid or revoked key" }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="Firmspace"' } }) };
    if (a.state === "plan") return { res: NextResponse.json({ message: "Agent access needs a plan with the AI assistant (Professional)", code: "plan" }, { status: 403 }) };
    const conn = (a as { state: "ok"; conn: Connection }).conn;
    if (rateLimited(`connect:${conn.key.id}`, 120, 60_000)) return { res: NextResponse.json({ message: "Too many requests — slow down (120 per minute per key)" }, { status: 429 }) };
    const today = new Date().toISOString().slice(0, 10);
    const map = (day.__connectDay ??= new Map());
    const cur = map.get(conn.org);
    const c = cur && cur.d === today ? cur : { d: today, n: 0 };
    if (++c.n > 5000) return { res: NextResponse.json({ message: "Daily limit of agent calls for this firm reached (5000)" }, { status: 429 }) };
    map.set(conn.org, c);
    return { conn };
}
