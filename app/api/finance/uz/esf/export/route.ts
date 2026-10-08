import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { issuedExportCsv, receivedExportCsv } from "@/lib/finance/esf";

export const dynamic = "force-dynamic";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/finance/uz/esf/export?kind=issued|received&from=&to= — CSV для кабинета оператора ЭСФ (по строке на позицию документа).
// Не является ЭСФ и не заменяет его: документ создаёт и подписывает ЭЦП оператор.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try { await requireMarket(user.id, "UZ"); } catch (e) { return failure(e); }
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "", to = url.searchParams.get("to") ?? "";
    if (!DATE.test(from) || !DATE.test(to) || from > to) return badRequest("from and to must be dates (YYYY-MM-DD)");
    const kind = url.searchParams.get("kind") === "received" ? "received" : "issued";
    const body = kind === "issued" ? await issuedExportCsv(user.id, from, to) : await receivedExportCsv(user.id, from, to);
    return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="esf-${kind}-${from}_${to}.csv"` } });
}
