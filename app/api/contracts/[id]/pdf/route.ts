import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { contractPdfBuffer, pdfTemplate, pdfLocale } from "@/lib/finance/document";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/contracts/:id/pdf?locale= — договор как PDF (номер, стороны, сумма, срок)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return notFound();
        const contract = await prisma.contract.findFirst({ where: { id: params.id, org: user.id } });
        if (!contract) return notFound();
        const buffer = await contractPdfBuffer(user.id, contract, pdfLocale(new URL(req.url).searchParams.get("locale")), pdfTemplate(new URL(req.url).searchParams.get("template")));
        return new Response(buffer as unknown as BodyInit, {
            headers: {
                "content-type": "application/pdf",
                "content-disposition": contentDisposition(`${contract.number}.pdf`),
                "cache-control": "private, no-store",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
