import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { closeFiscalShift, findFiscal, fiscalAdvice, fiscalConfig, openFiscalShift, shiftState } from "@/lib/finance/fiscal";
import Invoice from "@/models/Invoice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ПРРО (Украина): состояние кассы, смены с Z-отчётами и последние чеки. Вкладка «ПРРО» в финансах:
// чеки пробиваются из счёта, смена открывается первым чеком или кнопкой, закрывается Z-отчётом.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    await requireMarket(user.id, "UA");

    const doc = await findFiscal(user.id);
    const connected = !!doc;
    const auto = doc ? fiscalConfig(doc).auto : false;
    const shift = connected ? await shiftState(user.id).catch(() => ({ open: null, recent: [] })) : { open: null, recent: [] };

    // Последние чеки и ошибки фискализации — из счетов: отдельного журнала чеков не нужно,
    // каждый чек и так принадлежит счёту
    const list = await Invoice.find({ org: user.id, $or: [{ fiscalCode: { $ne: "" } }, { fiscalError: { $ne: "" } }, { fiscalReturnCode: { $ne: "" } }, { fiscalReturnError: { $ne: "" } }] })
        .sort({ fiscalAt: -1, paidAt: -1, createdAt: -1 })
        .limit(60)
        .select("number kind customerName status currency items paidAmount paidVia fiscalId fiscalCode fiscalUrl fiscalAt fiscalError fiscalPayType fiscalReturnId fiscalReturnCode fiscalReturnUrl fiscalReturnAt fiscalReturnError");

    // Отметка «товар повернули»: кредит-нота ссылается на исходный счёт (creditFor). Без неё
    // возвращённый чек выглядел в списке как обычная продажа (жалоба владельца)
    const ids = list.map((i) => i._id);
    const returns = await Invoice.find({ org: user.id, kind: "credit_note", creditFor: { $in: ids } })
        .select("number creditFor status")
        .catch(() => []);
    const returnOf = new Map(returns.map((r) => [String(r.creditFor), { number: r.number, status: r.status }]));

    return NextResponse.json({
        connected,
        auto,
        shift,
        receipts: list.map((inv) => {
            const advice = fiscalAdvice(inv);
            const returned = returnOf.get(String(inv._id));
            return {
                id: String(inv._id),
                number: inv.number,
                kind: inv.kind,
                customerName: inv.customerName,
                status: inv.status,
                currency: inv.currency,
                paidAmount: Number(inv.paidAmount) || 0,
                fiscalCode: inv.fiscalCode ?? "",
                fiscalUrl: inv.fiscalUrl ?? "",
                fiscalAt: inv.fiscalAt ? new Date(inv.fiscalAt).toISOString() : "",
                fiscalError: inv.fiscalError ?? "",
                fiscalPayType: inv.fiscalPayType ?? "",
                fiscalReturnCode: inv.fiscalReturnCode ?? "",
                fiscalReturnUrl: inv.fiscalReturnUrl ?? "",
                fiscalReturnAt: inv.fiscalReturnAt ? new Date(inv.fiscalReturnAt).toISOString() : "",
                fiscalReturnError: inv.fiscalReturnError ?? "",
                // Проданный чек, по которому выпущена кредит-нота: в списке помечается «Повернено»
                returnedBy: returned?.number ?? "",
                needed: advice.needed,
                reason: advice.reason,
            };
        }),
    });
}

// POST /api/finance/fiscal — { action: "open" | "close" }: открыть смену или закрыть её Z-отчётом
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        if (b?.action === "open") {
            const opened = await openFiscalShift(user.id);
            return NextResponse.json({ ok: true, shiftId: opened.id });
        }
        if (b?.action === "close") {
            const report = await closeFiscalShift(user.id);
            return NextResponse.json({ ok: true, ...report });
        }
        return badRequest('action must be "open" or "close"');
    } catch (e) {
        return failure(e);
    }
}
