import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { pdfTemplate, pdfLocale, quotePdfBuffer } from "@/lib/finance/document";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/quotes/:id/pdf?locale= — коммерческое предложение как PDF для скачивания, печати и вложения в письмо.
// Ошибку отдаём через failure(): раньше исключение становилось 500-й страницей Next, интерфейс не мог
// прочитать причину и показывал голое «quotes» — этим и выглядели «старые пропозиции не скачиваются».
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return notFound();
        const quote = await prisma.quote.findFirst({ where: { id: params.id, org: user.id } });
        if (!quote) return notFound();
        const buffer = await quotePdfBuffer(user.id, quote, pdfLocale(new URL(req.url).searchParams.get("locale")), pdfTemplate(new URL(req.url).searchParams.get("template")));
        return new Response(buffer as unknown as BodyInit, {
            headers: {
                "content-type": "application/pdf",
                "content-disposition": contentDisposition(`${quote.number}.pdf`),
                "cache-control": "private, no-store",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
