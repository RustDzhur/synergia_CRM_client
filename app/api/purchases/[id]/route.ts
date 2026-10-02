import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { receivePurchase, returnToSupplier } from "@/lib/purchases";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Заказ поставщику: приход по накладной, возврат, отмена.
//   { action: "receive", quantities?, invoice?, warehouse? } — принять товар: документ склада +
//       закупочная цена в товаре + счёт поставщика (создаётся всегда, номер необязателен);
//   { action: "return", lines, warehouse }                  — вернуть поставщику (списание);
//   { action: "cancel" }                                    — отменить заказ.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    try {
        const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const by = author ? `${author.firstname} ${author.lastname}`.trim() : "";
        const po = await prisma.purchaseOrder.findFirst({ where: { id: params.id, org: user.id } });
        if (!po) return notFound();

        if (b?.action === "receive") {
            const result = await receivePurchase(user.id, params.id, {
                quantities: Array.isArray(b.quantities) ? b.quantities.map((q: unknown) => Number(q) || 0) : undefined,
                invoice: b.invoice && typeof b.invoice === "object" ? { number: String(b.invoice.number ?? ""), date: b.invoice.date, dueDate: b.invoice.dueDate } : undefined,
                warehouse: typeof b.warehouse === "string" ? b.warehouse : undefined,
                by,
            });
            await logAudit({ org: user.id, userId: user.userId, action: "purchase.receive", entityType: "purchase", entityId: params.id, summary: `Purchase ${po.number} received (${result.doc.number})`, meta: { invoice: result.invoice ? result.invoice.number : "" } });
            return NextResponse.json({ doc: { id: String(result.doc.id), number: result.doc.number }, invoice: result.invoice ? { id: String(result.invoice.id), number: result.invoice.number, amount: result.invoice.amount } : null, fullyReceived: result.fullyReceived }, { status: 201 });
        }

        if (b?.action === "return") {
            const result = await returnToSupplier(user.id, params.id, {
                lines: (Array.isArray(b.lines) ? b.lines : []).map((l: { product?: string; qty?: unknown; price?: unknown }) => ({ product: String(l.product ?? ""), qty: Number(l.qty) || 0, price: Number(l.price) || 0 })),
                warehouse: String(b.warehouse ?? po.warehouse ?? ""),
                note: typeof b.note === "string" ? b.note : undefined,
                by,
            });
            await logAudit({ org: user.id, userId: user.userId, action: "purchase.return", entityType: "purchase", entityId: params.id, summary: `Return to supplier for ${po.number} (${result.doc.number})`, meta: {} });
            return NextResponse.json({ doc: { id: String(result.doc.id), number: result.doc.number } }, { status: 201 });
        }

        if (b?.action === "cancel") {
            if (po.status === "received") return badRequest("Прийнятий товар скасовують поверненням, а не відміною замовлення");
            await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "cancelled" } });
            return NextResponse.json({ ok: true });
        }

        if (b?.action === "update") {
            // Правка черновика/подтверждённого заказа: дата, склад, примечание и строки
            if (po.status === "received") return badRequest("Прийняте замовлення не редагується");
            const data: Record<string, unknown> = {};
            if (typeof b.expectedDate === "string") data.expectedDate = b.expectedDate;
            if (typeof b.warehouse === "string" && b.warehouse) data.warehouse = b.warehouse;
            if (typeof b.notes === "string") data.notes = b.notes.slice(0, 600);
            if (Array.isArray(b.lines)) {
                const lines = b.lines.filter((l: { product?: string; qty?: unknown }) => l?.product && Number(l?.qty) > 0);
                if (!lines.length) return badRequest("lines are required");
                data.lines = lines.map((l: { product: string; qty: unknown; price?: unknown; note?: string; receivedQty?: unknown }) => ({ product: l.product, qty: Math.abs(Number(l.qty)), price: Number(l.price) || 0, receivedQty: Number(l.receivedQty) || 0, note: (l.note ?? "").slice(0, 200) }));
            }
            await prisma.purchaseOrder.update({ where: { id: po.id }, data: data as any });
            return NextResponse.json({ ok: true });
        }

        return badRequest('action must be "receive", "return", "cancel" or "update"');
    } catch (e) {
        return failure(e);
    }
}

// GET — детали заказа: строки и связанные счета поставщика
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const po = await prisma.purchaseOrder.findFirst({ where: { id: params.id, org: user.id } });
    if (!po) return notFound();
    const invoices = await prisma.supplierInvoice.findMany({ where: { org: user.id, purchase: po.id } });
    return NextResponse.json({
        id: po.id,
        number: po.number,
        status: po.status,
        currency: po.currency,
        invoices: invoices.map((i) => ({ id: i.id, number: i.number, amount: i.amount, paidAmount: i.paidAmount, status: i.status, date: i.date, dueDate: i.dueDate })),
    });
}
