import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { packingListPdfBuffer, pdfLocale, pdfTemplate } from "@/lib/finance/document";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/orders/:id/packing-list — упаковочный лист (ВЭД): позиции с УКТ ЗЕД/HS, весом и страной
// происхождения. Цен нет: это документ о грузе. Номер — как у накладной, чтобы лист не путался с ней.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const order = await Order.findOne({ _id: params.id, org: user.id });
    if (!order) return notFound();
    const url = new URL(req.url);
    const locale = pdfLocale(url.searchParams.get("locale"));
    const buf = await packingListPdfBuffer(user.id, order, locale, pdfTemplate(url.searchParams.get("template")));
    if (!buf?.length) return badRequest("Не вдалося скласти пакувальний лист");
    return new Response(new Uint8Array(buf), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="packing-list-${order.number}.pdf"`,
            "Cache-Control": "no-store",
        },
    });
}
