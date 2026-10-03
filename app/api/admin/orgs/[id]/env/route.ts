import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest, notFound, validId } from "@/lib/api";
import { deleteFirmEnv, getFirmEnv, listFirmEnv, setFirmEnv } from "@/lib/firmEnv";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Переменные окружения фирмы (только администратор платформы): GET — имена и длины (?reveal=ИМЯ показывает значение одной переменной администратору, с записью в аудит),
// PUT { name, value } — задать или заменить, DELETE ?name= — удалить. Значения шифруются (lib/firmEnv.ts).
async function guard(req: Request, id: string) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return { res: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    if (!validId(id)) return { res: notFound() };
    // "platform" — общие переменные платформы (для агентов и внутренних задач), не привязанные к фирме
    const org = id === "platform" ? { id: "platform", name: "Platform" } : await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } });
    return org ? { admin, org } : { res: notFound() };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const g = await guard(req, params.id);
    if (!g.org) return g.res;
    // ?reveal=ИМЯ — показать значение одной переменной администратору платформы (каждый показ пишется в журнал аудита)
    const reveal = new URL(req.url).searchParams.get("reveal");
    if (reveal) {
        const value = await getFirmEnv(g.org.id, reveal.trim().toUpperCase());
        if (!value) return notFound();
        await logAudit({ org: g.org.id, userId: String((g.admin as { id?: string }).id ?? ""), action: "env.reveal", entityType: "env", entityId: reveal, summary: `Variable ${reveal.toUpperCase()} revealed to platform admin`, meta: {} }).catch(() => undefined);
        return NextResponse.json({ name: reveal.toUpperCase(), value });
    }
    return NextResponse.json(await listFirmEnv(g.org.id));
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const g = await guard(req, params.id);
    if (!g.org || !g.admin) return g.res;
    const b = (await req.json().catch(() => ({}))) as { name?: unknown; value?: unknown };
    try {
        await setFirmEnv(g.org.id, String(b.name ?? "").trim().toUpperCase(), String(b.value ?? ""), String((g.admin as { id?: string; email?: string }).email ?? ""));
    } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Invalid variable");
    }
    await logAudit({ org: g.org.id, userId: String((g.admin as { id?: string }).id ?? ""), action: "env.set", entityType: "env", entityId: String(b.name ?? ""), summary: `Variable ${String(b.name ?? "").toUpperCase()} set by platform admin`, meta: {} }).catch(() => undefined);
    return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const g = await guard(req, params.id);
    if (!g.org) return g.res;
    const name = new URL(req.url).searchParams.get("name") ?? "";
    if (!(await deleteFirmEnv(g.org.id, name))) return notFound();
    return NextResponse.json({ ok: true });
}
