import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { pdfTemplate, pdfLocale, quotePdfBuffer } from "@/lib/finance/document";
import Quote from "@/models/Quote";

export const dynamic = "force-dynamic";

// GET /api/quotes/:id/pdf?locale= — коммерческое предложение как PDF для скачивания, печати и вложения в письмо
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const quote = await Quote.findOne({ _id: params.id, org: user.id });
    if (!quote) return notFound();
    const buffer = await quotePdfBuffer(user.id, quote, pdfLocale(new URL(req.url).searchParams.get("locale")), pdfTemplate(new URL(req.url).searchParams.get("template")));
    return new Response(buffer as unknown as BodyInit, {
        headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${quote.number}.pdf"`,
            "cache-control": "private, no-store",
        },
    });
}
