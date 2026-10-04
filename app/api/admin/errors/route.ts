import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { ingest, recentErrors } from "@/lib/errorHub";

export const dynamic = "force-dynamic";

// GET /api/admin/errors — журнал пойманных ошибок (что бот видел и объяснил); POST { action: "test" } — по одной тестовой ошибке из каждого
// источника, чтобы убедиться, что вся цепочка (браузер/сервер/база/контейнер → объяснение → Telegram) работает.
export async function GET(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json(await recentErrors(40));
}

export async function POST(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = (await req.json().catch(() => ({}))) as { action?: string };
    if (b.action !== "test") return NextResponse.json({ message: "Unknown action" }, { status: 400 });
    const stamp = Date.now();
    const samples = [
        { source: "browser" as const, kind: "исключение", message: `TypeError: Cannot read properties of undefined (reading 'name') — тест ${stamp}`, url: "/crm/contacts" },
        { source: "server" as const, kind: "ошибка API", message: `Error: connect ECONNREFUSED 127.0.0.1:5432 — тест ${stamp}`, where: "GET /api/contacts" },
        { source: "database" as const, kind: "запрос к базе", message: `PrismaClientKnownRequestError P2024: Timed out fetching a new connection — тест ${stamp}`, where: "contact.findMany" },
        { source: "container" as const, kind: "контейнер postgres", message: `FATAL: sorry, too many clients already — тест ${stamp}`, where: "контейнер postgres" },
    ];
    const results = await Promise.all(samples.map((s) => ingest(s)));
    return NextResponse.json({ sent: results.filter(Boolean).length, total: samples.length });
}
