import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { financeSettings } from "@/lib/finance/settings";
import { renderInvoicePdf } from "@/lib/finance/pdf";
import Invoice from "@/models/Invoice";

export const dynamic = "force-dynamic";

// GET /api/invoices/:id/pdf?locale= — счёт/кредит-нота как PDF-файл для скачивания или печати
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!inv) return notFound();
    const settings = await financeSettings(user.id);
    let creditForNumber: string | undefined;
    if (inv.kind === "credit_note" && inv.creditFor) {
        const orig = await Invoice.findOne({ _id: inv.creditFor, org: user.id }).select("number");
        creditForNumber = orig?.number;
    }
    const locale = new URL(req.url).searchParams.get("locale") || "en";
    const buffer = await renderInvoicePdf(
        {
            number: inv.number, kind: inv.kind as "invoice" | "credit_note", creditForNumber,
            customerName: inv.customerName, customerAddress: inv.customerAddress, customerTaxId: inv.customerTaxId,
            items: (inv.items as any) ?? [], currency: inv.currency, smallBusinessNote: !!inv.smallBusinessNote,
            issueDate: inv.issueDate, dueDate: inv.dueDate, notes: inv.notes,
        },
        { legalName: settings.legalName, address: settings.address, taxId: settings.taxId, iban: settings.iban, bic: settings.bic, paymentTermsDays: settings.paymentTermsDays },
        ["en", "de", "ua"].includes(locale) ? locale : "en"
    );
    return new Response(buffer as unknown as BodyInit, {
        headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${inv.number}.pdf"`,
            "cache-control": "private, no-store",
        },
    });
}
