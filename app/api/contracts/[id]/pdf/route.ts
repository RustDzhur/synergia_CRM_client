import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { contractPdfBuffer, pdfTemplate, pdfLocale } from "@/lib/finance/document";
import Contract from "@/models/Contract";

export const dynamic = "force-dynamic";

// GET /api/contracts/:id/pdf?locale= — договор как PDF (номер, стороны, сумма, срок)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const contract = await Contract.findOne({ _id: params.id, org: user.id });
    if (!contract) return notFound();
    const buffer = await contractPdfBuffer(user.id, contract, pdfLocale(new URL(req.url).searchParams.get("locale")), pdfTemplate(new URL(req.url).searchParams.get("template")));
    return new Response(buffer as unknown as BodyInit, {
        headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${contract.number}.pdf"`,
            "cache-control": "private, no-store",
        },
    });
}
