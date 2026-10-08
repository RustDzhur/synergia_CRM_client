import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { registerPayment } from "@/lib/sync/payments";
import { ensureSupplyDate } from "@/lib/finance/issue";
import { prisma } from "@/lib/prisma";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { withPeriodLock } from "@/lib/finance/periodLock";

// POST /api/invoices/:id/pay — { amount? }: «деньги поступили» (без amount — вся сумма, с amount — частично). Работает для черновика, отправленного и просроченного счёта.
// Оплата фиксируется вручную: деньги приходят переводом или наличными, а в CRM их вносят человек
// или сверка с банком (app/api/bank/transactions). Тарифы платформы оплачиваются отдельно, переводом (lib/transferPay.ts).
async function handlePOST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const inv = await prisma.invoice.findFirst({ where: { id: params.id, org: user.id } });
    if (!inv) return notFound();
    // Оплата не зависит от отправки: деньги могли прийти и по счёту, отданному клиенту другим путём, — закрыть можно и черновик
    if (!["draft", "sent", "overdue"].includes(inv.status)) return badRequest("Only an open invoice (draft, sent or overdue) can be marked paid");
    const b = await req.json().catch(() => ({}));
    const amount = Number.isFinite(Number(b.amount)) ? Math.max(0, Number(b.amount)) : undefined;
    if (inv.status === "draft") await ensureSupplyDate(inv);
    // Ключ идемпотентности: тот же запрос, повторённый двойным кликом или повтором сети, не прибавит сумму второй раз.
    // Клиент может прислать свой idempotencyKey; иначе ключ строится из состояния счёта на момент запроса.
    const key = typeof b.idempotencyKey === "string" && b.idempotencyKey ? b.idempotencyKey.slice(0, 80) : `${inv.id}:${inv.paidAmount}:${amount ?? "full"}`;
    // Единая точка учёта оплаты (lib/sync/payments.ts): та же, что у webhook эквайринга, банка и ассистента
    const res = await registerPayment(user.id, inv.id, { amount, source: "manual", externalId: key, actor: { userId: user.userId } });
    if (!res.ok) return badRequest(res.reason === "closed" ? "Only an open invoice (draft, sent or overdue) can be marked paid" : "Not found");
    return NextResponse.json(toInvoiceDTO(res.invoice));
}

// Закрытый период (сторож в lib/prisma.ts) отвечает здесь 423, а не «Server error»
export const POST = withPeriodLock(handlePOST);
