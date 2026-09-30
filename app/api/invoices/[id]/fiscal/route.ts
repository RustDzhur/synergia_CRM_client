import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import { fiscalizeInvoice, fiscalizeReturn, fiscalAdvice } from "@/lib/finance/fiscal";
import { toInvoiceDTO } from "@/lib/finance/dto";
import Invoice from "@/models/Invoice";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/invoices/:id/fiscal — фискальный чек (ПРРО Checkbox):
//   обычный вызов           — чек продажи (вручную или повтор попытки после ошибки);
//   { payType: "CASH"|"CARD" } — способ оплаты в чеке (готівка или картка);
//   { action: "return" }    — чек возврата по кредит-ноте: ссылается на чек продажи.
// Автоматически чек продажи пробивается при полной оплате картой (см. pay/route.ts); здесь —
// кнопка в счёте для всего остального.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    // Фискальные чеки — украинское ПРРО
    await requireMarket(user.id, "UA");
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!inv) return notFound();
    const b = await req.json().catch(() => ({}));
    const payType = b?.payType === "CASH" || b?.payType === "CARD" ? b.payType : undefined;
    const { gross } = computeTotals(inv.items as never);
    const paid = Number(inv.paidAmount) || 0;

    // Чек возврата: сумма — всей оплаты (или указанная), ссылка на чек продажи внутри
    if (b?.action === "return") {
        if (inv.fiscalReturnCode) return badRequest("Чек повернення за цим рахунком уже пробито");
        const amountReturn = Number.isFinite(Number(b?.amount)) ? Math.max(0, Number(b.amount)) : paid || gross;
        try {
            const receipt = await fiscalizeReturn(user.id, inv, amountReturn, payType);
            inv.fiscalReturnId = receipt.receiptId;
            inv.fiscalReturnCode = receipt.fiscalCode;
            inv.fiscalReturnAt = new Date();
            inv.fiscalReturnError = "";
            await inv.save();
            return NextResponse.json(toInvoiceDTO(inv), { status: 201 });
        } catch (e) {
            inv.fiscalReturnError = e instanceof Error ? e.message.slice(0, 300) : "Чек повернення не вдалося пробити";
            await inv.save();
            return NextResponse.json({ message: inv.fiscalReturnError, invoice: toInvoiceDTO(inv) }, { status: 502 });
        }
    }

    if (inv.fiscalCode) return badRequest("Чек за цим рахунком уже пробито");
    const amount = Number.isFinite(Number(b?.amount)) ? Math.max(0, Number(b.amount)) : paid || gross;
    try {
        const receipt = await fiscalizeInvoice(user.id, inv, amount, payType);
        inv.fiscalId = receipt.receiptId;
        inv.fiscalCode = receipt.fiscalCode;
        inv.fiscalUrl = receipt.url;
        inv.fiscalAt = new Date();
        inv.fiscalPayType = payType ?? fiscalAdvice(inv).payType;
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
