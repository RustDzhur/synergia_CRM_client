import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { type ErrorSource, ingest } from "@/lib/errorHub";

export const dynamic = "force-dynamic";

// POST /api/errors/ingest — приём ошибок от сторожа сервера (deploy/errorwatch.sh): строки ERROR/FATAL из журналов контейнеров
// (postgres, caddy, redis, minio…), перезапуски контейнеров, недоступность сайта. Защита — общий секрет CRON_SECRET в заголовке Authorization.
//   { source?: "container" | "database" | "server" | "external", name: "postgres", message: "…", lines?: string[] }
const SOURCES: ErrorSource[] = ["container", "database", "server", "external", "cron"];

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
    const name = String(b.name ?? "").slice(0, 60);
    const lines = (Array.isArray(b.lines) ? b.lines : []).map((l) => String(l).slice(0, 300)).slice(0, 12);
    const message = String(b.message ?? lines[0] ?? "").slice(0, 600);
    if (!message) return NextResponse.json({ ok: false });
    const source = SOURCES.includes(b.source as ErrorSource) ? (b.source as ErrorSource) : name === "postgres" ? "database" : "container";
    const sent = await ingest({ source, kind: name ? `контейнер ${name}` : "контейнер", message, stack: lines.join("\n"), where: name ? `контейнер ${name}` : undefined });
    return NextResponse.json({ ok: true, sent });
}
