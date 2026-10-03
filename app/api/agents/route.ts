import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, serverError, unauthorized } from "@/lib/api";
import { isPlatformAdminUser } from "@/lib/admin";
import { AGENT_SCOPES, createAgent, listAgents, revokeAgent } from "@/lib/agents";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Реестр агентов платформы (CRM → Настройки → Интеграции → «Агенты»). Только для администратора платформы: агент получает
// доступ к платформе, а не к одной фирме.
//   GET  — список агентов (без токенов) и доступные права
//   POST — { action: "create", name, scopes } → токен (показывается ОДИН раз) | { action: "revoke", id }
async function admin(req: Request) {
    const user = await requireUser(req);
    if (!user) return { res: unauthorized(req) };
    const me = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!(await isPlatformAdminUser(me as never))) return { res: NextResponse.json({ message: "Only a platform administrator can manage agents", code: "forbidden" }, { status: 403 }) };
    return { user };
}

export async function GET(req: Request) {
    const a = await admin(req);
    if (!a.user) return a.res;
    try {
        return NextResponse.json({ agents: await listAgents(), scopes: AGENT_SCOPES, base: (process.env.APP_URL || "").replace(/\/+$/, "") });
    } catch (e) {
        return serverError(e);
    }
}

export async function POST(req: Request) {
    const a = await admin(req);
    if (!a.user) return a.res;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
        if (b.action === "create") {
            const r = await createAgent(String(b.name ?? ""), Array.isArray(b.scopes) ? b.scopes.map(String) : [], a.user.userId);
            return NextResponse.json({ ok: true, ...r }, { status: 201 });
        }
        if (b.action === "revoke") {
            return (await revokeAgent(String(b.id ?? ""))) ? NextResponse.json({ ok: true }) : badRequest("No such agent");
        }
        return badRequest("Unknown action");
    } catch (e) {
        if (e instanceof Error && /^(Give the agent|Choose at least|Too many)/.test(e.message)) return badRequest(e.message);
        return serverError(e);
    }
}
