import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { orderPdfBuffer, pdfTemplate, pdfLocale } from "@/lib/finance/document";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/orders/:id/pdf?locale= — заказ как PDF (подтверждение заказа клиенту)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return notFound();
        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        const buffer = await orderPdfBuffer(user.id, order, pdfLocale(new URL(req.url).searchParams.get("locale")), pdfTemplate(new URL(req.url).searchParams.get("template")));
        return new Response(buffer as unknown as BodyInit, {
            headers: {
                "content-type": "application/pdf",
                "content-disposition": contentDisposition(`${order.number}.pdf`),
                "cache-control": "private, no-store",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
