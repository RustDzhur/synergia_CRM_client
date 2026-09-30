import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { packingListPdfBuffer, pdfLocale, pdfTemplate } from "@/lib/finance/document";
import { financeSettings } from "@/lib/finance/settings";
import { nextNumber } from "@/lib/finance/numbering";
import { numberPrefix } from "@/lib/finance/documents/store";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/orders/:id/packing-list?locale=&template=&packingDate= — упаковочный лист (ВЭД): позиции
// с УКТ ЗЕД/HS, весом и страной происхождения колонками. Цен нет: это документ о грузе.
// Номер у листа свой (префикс «ПЛ»/PL из настроек или бланка) и присваивается один раз при первой
// выписке — раньше он брал номер накладной, и документы было не отличить.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const order = await Order.findOne({ _id: params.id, org: user.id });
    if (!order) return notFound();
    if (order.status === "cancelled") return badRequest("This order is cancelled");

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("packingDate");
    const packingDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : order.packingDate || order.deliveryDate || "";

    if (!order.packingNumber || packingDate !== order.packingDate) {
        const settings = await financeSettings(user.id);
        const number = order.packingNumber || (await nextNumber(user.id, await numberPrefix(user.id, "packing_list", settings.packingPrefix || "PL")));
        order.packingNumber = number;
        order.packingDate = packingDate || new Date().toISOString().slice(0, 10);
        await order.save();
    }

    const buf = await packingListPdfBuffer(user.id, order, pdfLocale(url.searchParams.get("locale")), pdfTemplate(url.searchParams.get("template")));
    if (!buf?.length) return badRequest("Не вдалося скласти пакувальний лист");
    return new Response(new Uint8Array(buf), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": contentDisposition(`packing-list-${order.packingNumber || order.number}.pdf`),
            "Cache-Control": "no-store",
        },
    });
}
