import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { closePeriod, closingChecklist, listPeriods, reopenPeriod } from "@/lib/finance/periodLock";
import { actorOf, reviewFailure } from "@/lib/review/http";

export const dynamic = "force-dynamic";

const CAN = ["owner", "admin", "advisor", "counsel"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET — закрытые периоды фирмы; с ?from=&to= дополнительно — что мешает закрыть этот период (чек-лист закрытия)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "", to = url.searchParams.get("to") ?? "";
    const checklist = DATE.test(from) && DATE.test(to) ? await closingChecklist(user.id, from, to) : undefined;
    return NextResponse.json({ periods: await listPeriods(user.id), ...(checklist ? { checklist } : {}) });
}

// POST { action: "close", from, to, note?, acknowledge? } | { action: "reopen", id, reason } — закрыть период / открыть заново (причина обязательна)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!CAN.includes(user.role)) return NextResponse.json({ message: "Only the owner, an administrator or a specialist can close periods", code: "forbidden" }, { status: 403 });
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        const actor = await actorOf(user);
        if (b.action === "close") {
            const r = await closePeriod(user.id, actor, b);
            return NextResponse.json({ lock: r.lock, checklist: r.checklist }, { status: 201 });
        }
        if (b.action === "reopen") return NextResponse.json({ lock: await reopenPeriod(user.id, actor, String(b.id ?? ""), b.reason) });
        return badRequest("Unknown action");
    } catch (e) {
        return reviewFailure(e);
    }
}
