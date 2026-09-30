import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { ProviderError } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import { shipmentFormUrl } from "@/lib/ukrposhta";
import Integration from "@/models/Integration";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/orders/:id/ukrposhta/form — печатная форма отправления (100×100).
// Токен Укрпошты стоит в адресе печати, поэтому браузеру его не отдаём: сервер скачивает PDF и
// передаёт потоком — как и бланки Новой Пошты.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        const uuid = String(order.ukrposhta?.uuid ?? "");
        if (!uuid) return badRequest("Ця накладна створена в кабінеті Укрпошти — роздрукуйте її там");

        const doc = await Integration.findOne({ owner: user.id, type: "ukrposhta", status: "connected" });
        const token = doc ? String(secretsOf<{ token?: string }>(doc).token ?? "") : "";
        if (!token) throw new ProviderError("У кабінеті Укрпошти не збережено токен");

        const res = await fetch(shipmentFormUrl(token, uuid));
        if (!res.ok || !res.body) return badRequest("Укрпошта не віддала форму — спробуйте ще раз");
        return new Response(res.body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": contentDisposition(`ukrposhta-${order.ukrposhta.barcode}.pdf`),
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Не вдалося отримати форму");
    }
}
