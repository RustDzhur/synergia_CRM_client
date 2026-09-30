import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import { fiscalizeInvoice } from "@/lib/finance/fiscal";
import { toInvoiceDTO } from "@/lib/finance/dto";
import Invoice from "@/models/Invoice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/invoices/:id/fiscal — пробить фискальный чек (ПРРО Checkbox) вручную или повторить попытку.
// Автоматически это происходит при полной оплате (см. pay/route.ts); здесь — кнопка в счёте,
// когда автофискализация выключена или первая попытка не удалась.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!inv) return notFound();
    if (inv.fiscalCode) return badRequest("Чек за цим рахунком уже пробито");
    const b = await req.json().catch(() => ({}));
    const { gross } = computeTotals(inv.items as never);
    const paid = Number(inv.paidAmount) || 0;
    const amount = Number.isFinite(Number(b?.amount)) ? Math.max(0, Number(b.amount)) : paid || gross;
    try {
        const receipt = await fiscalizeInvoice(user.id, inv, amount);
        inv.fiscalId = receipt.receiptId;
        inv.fiscalCode = receipt.fiscalCode;
        inv.fiscalUrl = receipt.url;
        inv.fiscalAt = new Date();
        inv.fiscalError = "";
        await inv.save();
        return NextResponse.json(toInvoiceDTO(inv), { status: 201 });
    } catch (e) {
        // Ошибку фискализации храним в счёте: её видит бухгалтер, и она не теряется при закрытии окна
        inv.fiscalError = e instanceof Error ? e.message.slice(0, 300) : "Чек не вдалося пробити";
        await inv.save();
        return NextResponse.json({ message: inv.fiscalError, invoice: toInvoiceDTO(inv) }, { status: 502 });
    }
}
