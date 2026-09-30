import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { invoicePdfBuffer, pdfTemplate, pdfLocale } from "@/lib/finance/document";
import Invoice from "@/models/Invoice";

export const dynamic = "force-dynamic";

// GET /api/invoices/:id/pdf?locale= — счёт/кредит-нота как PDF-файл для скачивания или печати
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return notFound();
        await connectDB();
        const inv = await Invoice.findOne({ _id: params.id, org: user.id });
        if (!inv) return notFound();
        const buffer = await invoicePdfBuffer(user.id, inv, pdfLocale(new URL(req.url).searchParams.get("locale")), pdfTemplate(new URL(req.url).searchParams.get("template")));
        return new Response(buffer as unknown as BodyInit, {
            headers: {
                "content-type": "application/pdf",
                "content-disposition": contentDisposition(`${inv.number}.pdf`),
                "cache-control": "private, no-store",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
