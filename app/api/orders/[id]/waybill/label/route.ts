import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { waybillPrintUrl } from "@/lib/finance/delivery";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/orders/:id/waybill/label?kind=marking|document — печатный бланк Новой Пошты.
//
// Печатные адреса Новой Пошты содержат ключ фирмы в самом URL, поэтому браузеру их отдавать нельзя:
// сервер скачивает PDF и отдаёт его потоком. Маркировка 100×100 клеится на посылку, «document» —
// полная накладная A4.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") === "document" ? "document" : "marking";
    try {
        await requireMarket(user.id, "UA");
        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        const ref = String((order.waybill as any)?.ref ?? "");
        if (!ref) return badRequest("У замовлення немає ТТН — спершу створіть її");
        const printUrl = await waybillPrintUrl(user.id, ref, kind);
        const res = await fetch(printUrl);
        if (!res.ok || !res.body) return badRequest("Нова Пошта не віддала бланк — спробуйте ще раз або завантажте його з кабінету");
        return new Response(res.body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": contentDisposition(`waybill-${String((order.waybill as any)?.number ?? "")}-${kind}.pdf`),
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Не вдалося отримати бланк");
    }
}
