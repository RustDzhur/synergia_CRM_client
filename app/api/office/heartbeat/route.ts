import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { recordHeartbeat } from "@/lib/office/platform";

export const dynamic = "force-dynamic";

// POST /api/office/heartbeat — сигнал от сторожа на сервере (deploy/agentwatch.py): «агент Harness (seo-agent, article-writer…) последний раз
// что-то делал тогда-то и писал такое-то». По нему робот платформы в Робот-офисе сидит за компьютером «в работе» или отдыхает.
// Защита — общий секрет CRON_SECRET в заголовке Authorization, как у /api/errors/ingest.
//   { agent: "seo-agent", lastActivity: "2026-10-08T10:12:00Z", note: "последняя строка журнала" }
function allowed(header: string | null): boolean {
    const secret = process.env.CRON_SECRET ?? "";
    const given = (header ?? "").startsWith("Bearer ") ? (header ?? "").slice(7) : "";
    if (!secret || !given) return false;
    const a = Buffer.from(given), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
    if (!allowed(req.headers.get("authorization"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ok = await recordHeartbeat(String(b.agent ?? ""), { lastActivity: String(b.lastActivity ?? ""), note: String(b.note ?? "") });
    return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
