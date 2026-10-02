import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized, validId } from "@/lib/api";
import { paySupplierInvoice, supplierInvoices } from "@/lib/purchases";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Счета поставщиков (ТЗ §12): список и оплата. Частичные оплаты копятся, «оплачено» — только по
// полной сумме; в отличие от клиентских счетов здесь нет рассылок и напоминаний — это долг фирмы.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await supplierInvoices(user.id);
    const suppliers = await prisma.supplier.findMany({ where: { org: user.id }, select: { id: true, name: true } });
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json(
        list.map((i) => ({
            id: String(i.id),
            supplier: i.supplier ? names.get(String(i.supplier)) ?? "" : "",
            number: i.number,
            date: i.date,
            dueDate: i.dueDate,
            amount: i.amount,
            paidAmount: i.paidAmount ?? 0,
            status: i.status,
            currency: i.currency,
            overdue: i.status !== "paid" && !!i.dueDate && i.dueDate < today,
        }))
    );
}

// PATCH — { id, action: "pay", amount? } / { id, action: "cancel" }
export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const id = String(b?.id ?? "");
    if (!validId(id)) return badRequest("id is required");
    try {
        if (b?.action === "pay") {
            const inv = await paySupplierInvoice(user.id, id, b.amount === undefined ? undefined : Number(b.amount));
            return NextResponse.json({ id: String(inv.id), paidAmount: inv.paidAmount, status: inv.status });
        }
        if (b?.action === "cancel") {
            const found = await prisma.supplierInvoice.findFirst({ where: { id, org: user.id } });
            if (!found) return badRequest("not found");
            await prisma.supplierInvoice.update({ where: { id: found.id }, data: { status: "cancelled" } });
            return NextResponse.json({ ok: true });
        }
        return badRequest('action must be "pay" or "cancel"');
    } catch (e) {
        return failure(e);
    }
}
