import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import { applyTaxPolicy, taxExempt } from "@/lib/finance/tax";
import "@/lib/finance/pdf";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";
import { logDocEvent } from "@/lib/sync/documents";

// POST /api/orders/:id/invoice — { customerAddress?, customerTaxId? }: выставить счёт по заказу. Заказ переходит в "invoiced"
// и получает ссылку на счёт; повторно выставить счёт по тому же заказу нельзя (один заказ — один счёт).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
    if (!order) return notFound();
    if (order.invoice) return badRequest("This order already has an invoice");
    if (!((order.items as any[]) ?? []).length) return badRequest("The order has no line items to invoice");

    const b = await req.json().catch(() => ({}));
    const [settings, author] = await Promise.all([financeSettings(user.id), prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } })]);
    const number = await nextNumber(user.id, settings.invoicePrefix || "RE");
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);

    const invoice = await prisma.invoice.create({
        data: {
            org: user.id, number, kind: "invoice",
            contact: order.contact, company: order.company, customerName: order.customerName,
            customerAddress: typeof b.customerAddress === "string" ? b.customerAddress.trim().slice(0, 500) : "",
            customerTaxId: typeof b.customerTaxId === "string" ? b.customerTaxId.trim().slice(0, 60) : "",
            deal: order.deal, order: order.id, contract: order.contract,
            items: applyTaxPolicy((order.items as any[]) ?? [], settings) as any, currency: order.currency,
            smallBusinessNote: taxExempt(settings),
            issueDate: today, dueDate: due,
            template: order.template, // счёт по заказу печатается так же, как сам заказ
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    await prisma.order.update({ where: { id: order.id }, data: { invoice: invoice.id, status: "invoiced" } });
    await logDocEvent(user.id, invoice, "invoice", `Счёт ${invoice.number} выставлен по заказу ${order.number}`, "created");
    await emit(user.id, { type: "order_status", data: { id: order.id, number: order.number, status: "invoiced", customerName: order.customerName } });
    return NextResponse.json(toInvoiceDTO(invoice), { status: 201 });
}
