import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { actPdfBuffer, pdfLocale, pdfTemplate } from "@/lib/finance/document";
import { financeSettings } from "@/lib/finance/settings";
import { nextNumber } from "@/lib/finance/numbering";
import { logAudit } from "@/lib/audit";
import Order from "@/models/Order";
import User from "@/models/User";
import { requireMarket } from "@/lib/finance/marketGuard";
import { numberPrefix } from "@/lib/finance/documents/store";

export const dynamic = "force-dynamic";

// GET /api/orders/:id/act?locale=&template=&actDate= — акт виконаних робіт по заказу.
// В украинском учёте это самостоятельный документ со своим номером и датой; подписи исполнителя
// и заказчика печатает сам PDF (lib/finance/layouts.ts). Номер, как у накладной, присваивается
// один раз: повторная печать отдаёт тот же документ, а не съедает номер из последовательности.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    // Акт виконаних робіт — украинский документ: в немецком режиме его не выпускаем
    await requireMarket(user.id, "UA");

    const order = await Order.findOne({ _id: params.id, org: user.id });
    if (!order) return notFound();
    if (order.status === "cancelled") return badRequest("This order is cancelled");

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("actDate");
    const actDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : order.actDate || "";

    if (!order.actNumber || actDate !== order.actDate) {
        const settings = await financeSettings(user.id);
        const number = order.actNumber || (await nextNumber(user.id, await numberPrefix(user.id, "act", settings.actPrefix || "АКТ")));
        order.actNumber = number;
        order.actDate = actDate;
        await order.save();
        const author = await User.findById(user.userId).select("firstname lastname");
        await logAudit({
            org: user.id,
            userName: author ? `${author.firstname} ${author.lastname}`.trim() : "—",
            action: "order.act_created",
            entityType: "order",
            entityId: String(order._id),
            summary: `Act ${number} issued for order ${order.number}`,
        });
    }

    const buffer = await actPdfBuffer(user.id, order, pdfLocale(url.searchParams.get("locale")), pdfTemplate(url.searchParams.get("template")));
    return new Response(buffer as unknown as BodyInit, {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${order.actNumber}.pdf"`,
            "Cache-Control": "no-store",
        },
    });
}
