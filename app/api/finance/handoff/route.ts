import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { handoffZip } from "@/lib/finance/handoff";

export const dynamic = "force-dynamic";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/finance/handoff?from=&to= — архив CSV-реестров за период «отдать бухгалтеру»
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "", to = url.searchParams.get("to") ?? "";
    if (!DATE.test(from) || !DATE.test(to) || from > to) return badRequest("from and to must be dates (YYYY-MM-DD)");
    try {
        const zip = await handoffZip(user.id, from, to);
        return new Response(zip, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="handoff-${from}_${to}.zip"` } });
    } catch (e) {
        return failure(e);
    }
}
