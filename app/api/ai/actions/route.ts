import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { log } from "@/lib/ai/run";
import { ToolError, allowedTools } from "@/lib/ai/tools";
import { ProviderError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ai/actions — { tool, args }: пользователь подтвердил действие, которое предложил ИИ.
// Выполняется от имени пользователя с теми же проверками, что и обычный запрос к CRM: аргументы проверяются заново,
// раздел должен быть доступен роли, наблюдатель ничего менять не может (этот адрес — POST, requireUser это проверяет).
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const tool = allowedTools(user).find((t) => t.write && t.def.name === b?.tool);
    if (!tool || !b.args || typeof b.args !== "object") return badRequest("This action is not available");
    await connectDB();
    const ctx = { org: user.id, userId: user.userId, role: user.role, modules: user.modules, today: "", now: "" };
    try {
        const args = tool.check ? tool.check(b.args as Record<string, unknown>) : (b.args as Record<string, unknown>);
        const out = (await tool.run(ctx, args)) as { params?: Record<string, string>; link?: string };
        await log(ctx, "executed", tool.def.name, args);
        return NextResponse.json({ ok: true, tool: tool.def.name, params: out.params ?? {}, link: out.link ?? "" });
    } catch (e) {
        await log(ctx, "failed", tool.def.name, b.args, e instanceof Error ? e.message : "");
        if (e instanceof ToolError) return NextResponse.json({ message: e.message }, { status: 400 });
        if (e instanceof ProviderError) return failure(e);
        return failure(e);
    }
}
