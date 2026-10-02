import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { cleanItems } from "@/lib/finance/totals";
import { ownedContact, ownedCompany } from "@/lib/deals";
import { toRecurringInvoiceDTO } from "@/lib/finance/dto";
import { defaultCurrency } from "@/lib/finance/settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/recurring-invoices — список шаблонов повторяющихся счетов фирмы
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await prisma.recurringInvoice.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(list.map(toRecurringInvoiceDTO));
}

// POST /api/recurring-invoices — новый шаблон: раз в interval, начиная с nextRunDate, создаёт Invoice из items
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const customerName = typeof b?.customerName === "string" ? b.customerName.trim().slice(0, 200) : "";
    if (!customerName) return badRequest("customerName is required");
    const items = cleanItems(b.items);
    if (!items.length) return badRequest("At least one line item is required");
    const interval = b.interval === "yearly" ? "yearly" : "monthly";
    const dayOfMonth = Number.isFinite(Number(b.dayOfMonth)) ? Math.min(28, Math.max(1, Math.round(Number(b.dayOfMonth)))) : 1;
    const nextRunDate = typeof b.nextRunDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.nextRunDate) ? b.nextRunDate : new Date().toISOString().slice(0, 10);
    const [contact, company] = await Promise.all([ownedContact(b.contact, user.id), ownedCompany(b.company, user.id)]);
    const r = await prisma.recurringInvoice.create({
        data: {
        org: user.id, customerName, items: items as any,
        customerAddress: typeof b.customerAddress === "string" ? b.customerAddress.trim().slice(0, 500) : "",
        customerTaxId: typeof b.customerTaxId === "string" ? b.customerTaxId.trim().slice(0, 60) : "",
        contact: contact ? String(contact) : undefined, company: company ? String(company) : undefined,
        currency: typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : await defaultCurrency(user.id),
        notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
        interval, dayOfMonth, autoSend: !!b.autoSend, nextRunDate,
        },
    });
    return NextResponse.json(toRecurringInvoiceDTO(r), { status: 201 });
}
