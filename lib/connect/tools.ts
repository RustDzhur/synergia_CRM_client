import { prisma } from "@/lib/prisma";
import { ToolError, allowedTools, type AiCtx, type AiTool } from "@/lib/ai/tools";
import { log } from "@/lib/ai/run";
import type { ConnectKey } from "./keys";

// Инструменты Айрис, отданные внешним агентам. Без служебных (экран, память Айрис, блог платформы) и без разрушительных: удаление
// и чистка наружу не отдаются. Всё остальное — тот же код, те же проверки аргументов и права роли, что у Айрис в CRM.
const HIDDEN = new Set([
    "navigate", "scroll_page", "download_document", "open_record", "queue_tasks", "remember", "forget", "list_memory",
    "list_blog_posts", "publish_blog_post", "delete_record", "cleanup_leads", "analyze_leads", "set_lead_rules",
]);

export const externalTools = (ctx: AiCtx): AiTool[] => allowedTools(ctx).filter((t) => !HIDDEN.has(t.def.name));

const PENDING = "connect:pending";
export interface PendingRequest { id: string; tool: string; args: Record<string, unknown>; target: string; agent: string; at: string }

export async function listRequests(org: string): Promise<PendingRequest[]> {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key: PENDING }, orderBy: { createdAt: "asc" }, take: 100 });
    return rows.map((r) => ({ id: r.rid, ...(r.values as object) }) as PendingRequest);
}

const clipResult = (v: unknown) => {
    const s = JSON.stringify(v ?? null);
    return s.length > 30000 ? s.slice(0, 30000) + "…(truncated)" : s;
};

export type CallResult = { ok: true; status: "done" | "pending_approval"; result?: unknown; requestId?: string; note?: string } | { ok: false; error: string };

/** Вызов инструмента внешним агентом. Чтение выполняется сразу; изменение — сразу или через одобрение владельца (ключ.approval). */
export async function callExternal(ctx: AiCtx, key: ConnectKey, name: string, rawArgs: unknown): Promise<CallResult> {
    const tool = externalTools(ctx).find((t) => t.def.name === name);
    if (!tool) return { ok: false, error: `Unknown or not permitted tool: ${name}` };
    const input = (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {}) as Record<string, unknown>;
    try {
        const args = tool.check ? tool.check(input) : input;
        if (!tool.write) {
            const out = await tool.run(ctx, args);
            await log(ctx, "read", name, args, `agent:${key.name}`);
            return { ok: true, status: "done", result: JSON.parse(clipResult(out)) };
        }
        if (key.approval) {
            const id = `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            const target = String((args as Record<string, unknown>).customer_name ?? (args as Record<string, unknown>).name ?? (args as Record<string, unknown>).title ?? (args as Record<string, unknown>).number ?? "");
            await prisma.sectionRecord.create({ data: { org: ctx.org, key: PENDING, rid: id, values: { tool: name, args, target: target.slice(0, 120), agent: key.name, at: new Date().toISOString() } as never } });
            await log(ctx, "proposed", name, args, `agent:${key.name}`);
            return { ok: true, status: "pending_approval", requestId: id, note: "The change waits for the owner's approval in the CRM (Settings → Integrations → Agents)." };
        }
        const out = await tool.run(ctx, args);
        await log(ctx, "executed", name, args, `agent:${key.name}`);
        return { ok: true, status: "done", result: JSON.parse(clipResult(out)) };
    } catch (e) {
        await log(ctx, "failed", name, input, e instanceof Error ? e.message : "");
        return { ok: false, error: e instanceof ToolError ? e.message : "The call failed" };
    }
}

/** Решение владельца по запросу агента: одобрить (выполнить) или отклонить. */
export async function decideRequest(ctx: AiCtx, id: string, approve: boolean): Promise<{ done: boolean; message: string }> {
    const rec = await prisma.sectionRecord.findFirst({ where: { org: ctx.org, key: PENDING, rid: id } });
    if (!rec) return { done: false, message: "No such request (already decided?)" };
    const v = rec.values as { tool: string; args: Record<string, unknown>; agent: string };
    await prisma.sectionRecord.deleteMany({ where: { org: ctx.org, key: PENDING, rid: id } });
    if (!approve) return { done: true, message: "Rejected" };
    const tool = allowedTools(ctx).find((t) => t.write && t.def.name === v.tool);
    if (!tool) return { done: false, message: "Tool is not available any more" };
    try {
        const args = tool.check ? tool.check(v.args) : v.args;
        await tool.run(ctx, args);
        await log(ctx, "executed", v.tool, args, `approved agent:${v.agent}`);
        return { done: true, message: "Approved and done" };
    } catch (e) {
        return { done: false, message: e instanceof ToolError ? e.message : "The action failed" };
    }
}
