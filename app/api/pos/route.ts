import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { logAudit } from "@/lib/audit";
import { recentRetail, retailReturn, retailSale, type RetailLine } from "@/lib/finance/pos";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Касса (ТЗ §12, «Розница»): продажа по штрихбкоду и возврат по чеку.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    // отказ по режиму рынка — 409 с кодом market, а не 500 от исключения
    try { await requireMarket(user.id, "UA"); } catch (e) { return failure(e); }
    const sales = await recentRetail(user.id);
    const products = await prisma.product.findMany({ where: { org: user.id, type: "good", archived: false }, select: { id: true, name: true, sku: true, barcode: true, salePrice: true, unit: true, stockQty: true, image: true } });
    // Возвращённые чеки: кредит-нота ссылается на исходный чек (creditFor) — в списке кассы такая
    // продажа помечается «Повернено», и повторный возврат по ней уже не предлагается
    const credits = await prisma.invoice.findMany({ where: { org: user.id, kind: "credit_note", creditFor: { in: sales.map((s) => s.id) } }, select: { number: true, creditFor: true } }).catch(() => []);
    const returnedOf = new Map(credits.map((c) => [String(c.creditFor), c.number]));
    return NextResponse.json({
        recent: sales.map((s) => ({ id: s.id, number: s.number, at: s.paidAt ? new Date(s.paidAt).toISOString() : "", total: Number(s.paidAmount) || 0, currency: s.currency, fiscalCode: s.fiscalCode ?? "", payType: s.paidVia ?? "", customerName: s.customerName, returnedBy: returnedOf.get(s.id) ?? "" })),
        products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "", price: p.salePrice ?? 0, unit: p.unit ?? "", stockQty: p.stockQty ?? 0, image: p.image ?? "" })),
    });
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    try {
        await requireMarket(user.id, "UA");
        const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const by = author ? `${author.firstname} ${author.lastname}`.trim() : "";

        if (b?.action === "sale") {
            const payType = b?.payType === "cash" || b?.payType === "card" ? b.payType : null;
            if (!payType) return badRequest("payType must be cash or card");
            const lines = (Array.isArray(b?.lines) ? b.lines : []) as RetailLine[];
            const result = await retailSale(user.id, {
                lines: lines.map((l) => ({ product: String(l.product ?? ""), qty: Number(l.qty) || 0, price: Number(l.price) || 0 })),
                payType,
                discountPercent: Number(b?.discountPercent) || 0,
                warehouse: typeof b?.warehouse === "string" ? b.warehouse : undefined,
                by,
            });
            await logAudit({ org: user.id, userId: user.userId, action: "pos.sale", entityType: "invoice", entityId: result.invoice.id, summary: `Retail sale ${result.invoice.number}: ${result.totals.gross} ${result.invoice.currency} (${payType})`, meta: { payType, fiscal: result.fiscal?.fiscalCode ?? "" } });
            return NextResponse.json({ invoice: toInvoiceDTO(result.invoice), totals: result.totals, fiscal: result.fiscal }, { status: 201 });
        }

        if (b?.action === "return") {
            const invoiceId = String(b?.invoiceId ?? "");
            if (!invoiceId) return badRequest("invoiceId is required");
            const result = await retailReturn(user.id, invoiceId, { warehouse: typeof b?.warehouse === "string" ? b.warehouse : undefined, by });
            await logAudit({ org: user.id, userId: user.userId, action: "pos.return", entityType: "invoice", entityId: result.credit.id, summary: `Retail return ${result.credit.number} for ${invoiceId}`, meta: {} });
            return NextResponse.json({ credit: toInvoiceDTO(result.credit) }, { status: 201 });
        }

        if (b?.action === "sale-status") {
            const inv = await prisma.invoice.findFirst({ where: { id: String(b?.invoiceId ?? ""), org: user.id }, select: { number: true, fiscalCode: true, fiscalUrl: true, fiscalError: true, fiscalPayType: true } });
            if (!inv) return badRequest("not found");
            return NextResponse.json({ number: inv.number, fiscalCode: inv.fiscalCode ?? "", fiscalUrl: inv.fiscalUrl ?? "", fiscalError: inv.fiscalError ?? "", fiscalPayType: inv.fiscalPayType ?? "" });
        }

        return badRequest('action must be "sale", "return" or "sale-status"');
    } catch (e) {
        return failure(e);
    }
}
