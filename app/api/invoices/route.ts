import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import { cleanItems, computeTotals } from "@/lib/finance/totals";
import Invoice from "@/models/Invoice";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export const toInvoiceDTO = (inv: any) => ({
    id: String(inv._id), number: inv.number, kind: inv.kind, creditFor: inv.creditFor ? String(inv.creditFor) : "",
    contact: inv.contact ? String(inv.contact) : "", company: inv.company ? String(inv.company) : "",
    customerName: inv.customerName, customerAddress: inv.customerAddress, customerTaxId: inv.customerTaxId,
    deal: inv.deal ? String(inv.deal) : "", order: inv.order ? String(inv.order) : "", contract: inv.contract ? String(inv.contract) : "",
    items: (inv.items ?? []).map((it: any) => ({ description: it.description, qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate, product: it.product ? String(it.product) : "" })),
    currency: inv.currency, smallBusinessNote: !!inv.smallBusinessNote,
    issueDate: inv.issueDate, dueDate: inv.dueDate, notes: inv.notes,
    status: inv.status, sentAt: inv.sentAt ? inv.sentAt.toISOString() : "", paidAt: inv.paidAt ? inv.paidAt.toISOString() : "", paidAmount: inv.paidAmount,
    totals: computeTotals(inv.items ?? []),
    createdAt: inv.createdAt.toISOString(), updatedAt: inv.updatedAt.toISOString(),
});

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
