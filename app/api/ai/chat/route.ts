import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/provider";
import { dailyLimit, runChat, takeQuota } from "@/lib/ai/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ai/chat — { messages: [{ role, text }], locale, page, today, now }
// Ответ: { reply, steps: [названия использованных инструментов], actions: [предложенные изменения, ожидающие подтверждения], remaining }
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!aiConfigured()) return NextResponse.json({ message: "AI is not set up on this site yet", code: "not_configured" }, { status: 503 });

    const b = await req.json().catch(() => null);
    const raw: unknown[] = Array.isArray(b?.messages) ? b.messages.slice(-20) : [];
    const history = raw
        .map((m) => m as { role?: unknown; text?: unknown })
        .filter((m): m is { role: "user" | "assistant"; text: string } => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim() !== "")
        .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
    if (!history.length || history[history.length - 1].role !== "user") return badRequest("The last message must be from the user");

    await connectDB();
    const limit = await dailyLimit(user.id);
    if (!(await takeQuota(user.id, limit))) return NextResponse.json({ message: "The daily AI limit of your plan is used up. It resets tomorrow.", code: "limit", remaining: 0 }, { status: 429 });

    const now = new Date();
    const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(b.now)) ? String(b.now) : now.toISOString().slice(0, 16);
    try {
        const result = await runChat(
            { org: user.id, userId: user.userId, role: user.role, modules: user.modules, today: local.slice(0, 10), now: local },
            { history, locale: String(b.locale ?? "en"), page: String(b.page ?? "").slice(0, 120), orgName: user.orgName }
        );
        return NextResponse.json(result);
    } catch (e) {
        return failure(e);
    }
}
