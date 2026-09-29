import { computeTotals } from "./totals";

// Оплата счёта приходит двумя путями: кнопкой «отметить оплаченным» и сверкой с банком, когда
// движение из выписки привязывают к счёту. Арифметика у них одна, иначе два пути расходились бы
// в оценке «оплачен ли счёт» — поэтому правило живёт здесь.
//
// Частичные платежи копятся в paidAmount, а статус «paid» ставится только когда набралось на полную
// сумму: раньше любая сумма (в том числе аванс) переводила счёт в «оплачен», и остаток терялся.

export interface PaymentInput {
    items?: unknown;
    paidAmount?: number;
}

export interface PaymentResult {
    paid: number; // сколько всего зачтено по счёту
    gross: number; // сколько всего к оплате
    full: boolean; // набралось ли на полную сумму
}

export function applyPayment(invoice: PaymentInput, amount: number): PaymentResult {
    const gross = computeTotals((invoice.items ?? []) as never).gross;
    const round = (n: number) => Math.round(n * 100) / 100;
    // счёт без строк (сумма 0) считаем оплаченным сразу: иначе он навсегда остался бы «частичным»
    const paid = Math.max(0, round((Number(invoice.paidAmount) || 0) + amount));
    const full = gross <= 0 || paid + 0.005 >= gross;
    return { paid, gross, full };
}

// Статус счёта после учёта суммы: «оплачен» — только когда набралось на полную. Если оплату сняли
// (сверка с банком отвязала движение), счёт возвращается в работу: платёж перестал существовать.
export function statusAfterPayment(current: string, full: boolean): string {
    if (full) return "paid";
    return current === "paid" ? "sent" : current;
}
