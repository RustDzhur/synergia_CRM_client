import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { ProviderError } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import { shipmentFormUrl } from "@/lib/ukrposhta";
import { prisma } from "@/lib/prisma";

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
        await requireMarket(user.id, "UA");
        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        const uuid = String((order.ukrposhta as any)?.uuid ?? "");
        if (!uuid) return badRequest("Ця накладна створена в кабінеті Укрпошти — роздрукуйте її там");

        const doc = await prisma.integration.findFirst({ where: { owner: user.id, type: "ukrposhta", status: "connected" } });
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
