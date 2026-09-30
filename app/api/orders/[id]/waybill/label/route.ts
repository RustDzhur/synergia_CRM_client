import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { waybillPrintUrl } from "@/lib/finance/delivery";
import Order from "@/models/Order";

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
        await connectDB();
        await requireMarket(user.id, "UA");
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        const ref = String(order.waybill?.ref ?? "");
        if (!ref) return badRequest("У замовлення немає ТТН — спершу створіть її");
        const printUrl = await waybillPrintUrl(user.id, ref, kind);
        const res = await fetch(printUrl);
        if (!res.ok || !res.body) return badRequest("Нова Пошта не віддала бланк — спробуйте ще раз або завантажте його з кабінету");
        return new Response(res.body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": contentDisposition(`waybill-${order.waybill.number}-${kind}.pdf`),
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Не вдалося отримати бланк");
    }
}
