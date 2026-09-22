import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import { cleanItems, computeTotals } from "@/lib/finance/totals";
import { toInvoiceDTO } from "@/lib/finance/dto";
import Invoice from "@/models/Invoice";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/invoices?status=&kind= — список счетов, самые новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const url = new URL(req.url);
    const filter: Record<string, unknown> = { org: user.id };
    const status = url.searchParams.get("status"); if (status) filter.status = status;
    const kind = url.searchParams.get("kind"); if (kind) filter.kind = kind;
    const list = await Invoice.find(filter).sort({ createdAt: -1 }).limit(300);
    return NextResponse.json(list.map(toInvoiceDTO));
}

// POST /api/invoices — счёт напрямую (не через заказ), например разовая услуга без отдельного Order
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const customerName = typeof b?.customerName === "string" ? b.customerName.trim().slice(0, 200) : "";
    if (!customerName) return badRequest("customerName is required");
    const items = cleanItems(b.items);
    if (!items.length) return badRequest("At least one line item is required");
    await connectDB();
    const [settings, author] = await Promise.all([financeSettings(user.id), User.findById(user.userId).select("firstname lastname")]);
    const number = await nextNumber(user.id, settings.invoicePrefix || "RE");
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);
    const invoice = await Invoice.create({
        org: user.id, number, kind: "invoice", customerName, items,
        customerAddress: typeof b.customerAddress === "string" ? b.customerAddress.trim().slice(0, 500) : "",
        customerTaxId: typeof b.customerTaxId === "string" ? b.customerTaxId.trim().slice(0, 60) : "",
        contact: b.contact || undefined, company: b.company || undefined, deal: b.deal || undefined,
        currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : "EUR",
        smallBusinessNote: !!settings.smallBusiness,
        issueDate: typeof b.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.issueDate) ? b.issueDate : today,
        dueDate: typeof b.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) ? b.dueDate : due,
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    return NextResponse.json(toInvoiceDTO(invoice), { status: 201 });
}
