import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/finance/totals";

// Общее для Payme и Click (docs/UZ_PAYMENTS.md): счёт ищется по номеру в рамках фирмы, платят только в сумах,
// сумма платежа должна совпасть с остатком к оплате.

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PayableInvoice { id: string; number: string; currency: string; status: string; outstanding: number }

/** Счёт фирмы по номеру; null — нет такого. outstanding — сколько ещё осталось оплатить. */
export async function findPayableInvoice(org: string, number: string): Promise<PayableInvoice | null> {
    if (!number) return null;
    const inv = await prisma.invoice.findFirst({ where: { org, number } });
    if (!inv) return null;
    const { gross } = computeTotals(inv.items as never);
    return { id: inv.id, number: inv.number, currency: inv.currency || "", status: inv.status, outstanding: Math.max(0, round2(gross - (Number(inv.paidAmount) || 0))) };
}

/** Можно ли сейчас принять оплату по счёту: сум, не отменён, остаток больше нуля. */
export const isPayable = (inv: PayableInvoice) => inv.currency === "UZS" && ["draft", "sent", "overdue"].includes(inv.status) && inv.outstanding > 0;

/** Ключ идемпотентности зачёта платежа в registerPayment. */
export const payKey = (provider: "payme" | "click", externalId: string) => `${provider}:${externalId}`;
