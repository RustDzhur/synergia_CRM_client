import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, serverError, unauthorized } from "@/lib/api";
import { KEY_MODULES, createKey, listKeys, revokeKey } from "@/lib/connect/keys";
import { decideRequest, listRequests } from "@/lib/connect/tools";
import { orgFeatures } from "@/lib/features";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Управление подключениями агентов ФИРМЫ (CRM → Настройки → Интеграции → «Подключить агента»). Владелец и администратор фирмы.
//   GET  — ключи (без самих ключей), очередь запросов агентов, доступные разделы, есть ли доступ по тарифу
//   POST — { action: "create", name, level, modules, approval } → ключ (показывается ОДИН раз) | "revoke" {id} | "approve" {id} | "reject" {id}
async function owner(req: Request) {
    const user = await requireUser(req);
    if (!user) return { res: unauthorized(req) };
    if (user.role !== "owner" && user.role !== "admin") return { res: NextResponse.json({ message: "Only the owner or an administrator can manage agent access", code: "forbidden" }, { status: 403 }) };
    return { user };
}

export async function GET(req: Request) {
    const a = await owner(req);
    if (!a.user) return a.res;
    try {
        const org = await prisma.organization.findUnique({ where: { id: a.user.id } });
        return NextResponse.json({
            keys: await listKeys(a.user.id), requests: await listRequests(a.user.id), modules: KEY_MODULES,
            allowed: !!org && orgFeatures(org as never).aiAssistant, base: (process.env.APP_URL || "https://www.firmspace.de").replace(/\/+$/, ""),
        });
    } catch (e) {
        return serverError(e);
    }
}

export async function POST(req: Request) {
    const a = await owner(req);
    if (!a.user) return a.res;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
        if (b.action === "create") return NextResponse.json({ ok: true, ...(await createKey(a.user.id, a.user.userId, { name: b.name, level: b.level, modules: b.modules, approval: b.approval })) }, { status: 201 });
        if (b.action === "revoke") return (await revokeKey(a.user.id, String(b.id ?? ""))) ? NextResponse.json({ ok: true }) : badRequest("No such key");
        if (b.action === "approve" || b.action === "reject") {
            const now = new Date();
            const r = await decideRequest({ org: a.user.id, userId: a.user.userId, role: a.user.role, modules: a.user.modules, today: now.toISOString().slice(0, 10), now: now.toISOString().slice(0, 16) }, String(b.id ?? ""), b.action === "approve");
            return r.done ? NextResponse.json({ ok: true, message: r.message }) : badRequest(r.message);
        }
        return badRequest("Unknown action");
    } catch (e) {
        if (e instanceof Error && /^(Give the agent|Choose at least|Too many)/.test(e.message)) return badRequest(e.message);
        return serverError(e);
    }
}
