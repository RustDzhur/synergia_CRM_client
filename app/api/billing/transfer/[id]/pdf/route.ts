import { requireUser } from "@/lib/auth";
import { contentDisposition, failure, notFound, unauthorized, validId } from "@/lib/api";
import { billingInvoicePdf } from "@/lib/billingInvoicePdf";
import { findOrder, getRequisites } from "@/lib/transferPay";

export const dynamic = "force-dynamic";

// GET /api/billing/transfer/:id/pdf — оформленный счёт на оплату тарифа (реквизиты платформы по рынку клиента, QR)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const order = await findOrder(params.id, user.id);
    if (!order) return notFound();
    try {
        const buffer = await billingInvoicePdf(order, await getRequisites());
        return new Response(new Uint8Array(buffer), { headers: { "content-type": "application/pdf", "content-disposition": contentDisposition(`${order.number}.pdf`) } });
    } catch (e) {
        return failure(e);
    }
}
