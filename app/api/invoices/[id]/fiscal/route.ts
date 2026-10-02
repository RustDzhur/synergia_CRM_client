import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import { fiscalizeInvoice, fiscalizeReturn, fiscalAdvice, syncReceiptUrls } from "@/lib/finance/fiscal";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/invoices/:id/fiscal — фискальный чек (ПРРО Checkbox):
//   обычный вызов           — чек продажи (вручную или повтор попытки после ошибки);
//   { payType: "CASH"|"CARD" } — способ оплаты в чеке (готівка или картка);
//   { action: "return" }    — чек возврата по кредит-ноте: ссылается на чек продажи;
//   { action: "receipt-link" } — дотянуть ссылку на чек у Checkbox, если она не сохранилась.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    // Фискальные чеки — украинское ПРРО
    await requireMarket(user.id, "UA");
    let inv = await prisma.invoice.findFirst({ where: { id: params.id, org: user.id } });
    if (!inv) return notFound();
    const b = await req.json().catch(() => ({}));
    const payType = b?.payType === "CASH" || b?.payType === "CARD" ? b.payType : undefined;
    const { gross } = computeTotals(inv.items as never);
    const paid = Number(inv.paidAmount) || 0;

    // Ссылка на чек: кликабельный код в списках открывает её — по ней чек смотрят, скачивают и печатают
    if (b?.action === "receipt-link") {
        try {
            const { url, returnUrl } = await syncReceiptUrls(user.id, inv);
            if (url || returnUrl) inv = await prisma.invoice.update({ where: { id: inv.id }, data: { fiscalUrl: url, fiscalReturnUrl: returnUrl } });
            return NextResponse.json({ url, returnUrl, invoice: toInvoiceDTO(inv) });
        } catch (e) {
            return NextResponse.json({ message: e instanceof Error ? e.message : "Не вдалося отримати посилання на чек" }, { status: 502 });
        }
    }

    // Чек возврата: сумма — всей оплаты (или указанная), ссылка на чек продажи внутри
    if (b?.action === "return") {
        if (inv.fiscalReturnCode) return badRequest("Чек повернення за цим рахунком уже пробито");
        const amountReturn = Number.isFinite(Number(b?.amount)) ? Math.max(0, Number(b.amount)) : paid || gross;
        try {
            const receipt = await fiscalizeReturn(user.id, inv, amountReturn, payType);
            inv = await prisma.invoice.update({
                where: { id: inv.id },
                data: { fiscalReturnId: receipt.receiptId, fiscalReturnUrl: receipt.url, fiscalReturnCode: receipt.fiscalCode, fiscalReturnAt: new Date(), fiscalReturnError: "" },
            });
            return NextResponse.json(toInvoiceDTO(inv), { status: 201 });
        } catch (e) {
            const message = e instanceof Error ? e.message.slice(0, 300) : "Чек повернення не вдалося пробити";
            inv = await prisma.invoice.update({ where: { id: inv.id }, data: { fiscalReturnError: message } });
            return NextResponse.json({ message, invoice: toInvoiceDTO(inv) }, { status: 502 });
        }
    }

    if (inv.fiscalCode) return badRequest("Чек за цим рахунком уже пробито");
    const amount = Number.isFinite(Number(b?.amount)) ? Math.max(0, Number(b.amount)) : paid || gross;
    try {
        const receipt = await fiscalizeInvoice(user.id, inv, amount, payType);
        inv = await prisma.invoice.update({
            where: { id: inv.id },
            data: { fiscalId: receipt.receiptId, fiscalCode: receipt.fiscalCode, fiscalUrl: receipt.url, fiscalAt: new Date(), fiscalPayType: payType ?? fiscalAdvice(inv).payType, fiscalError: "" },
        });
        return NextResponse.json(toInvoiceDTO(inv), { status: 201 });
    } catch (e) {
        // Ошибку фискализации храним в счёте: её видит бухгалтер, и она не теряется при закрытии окна
        const message = e instanceof Error ? e.message.slice(0, 300) : "Чек не вдалося пробити";
        inv = await prisma.invoice.update({ where: { id: inv.id }, data: { fiscalError: message } });
        return NextResponse.json({ message, invoice: toInvoiceDTO(inv) }, { status: 502 });
    }
}
