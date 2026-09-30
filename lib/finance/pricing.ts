// Цены и скидки опта (ТЗ §12): тип цены клиента, ступени по количеству, скидка за объём и
// кредитный лимит. Чистые функции — их проверяет тест, и они же используются в формах документов,
// чтобы цена в счёте не расходилась с прайсом.

export interface PriceTier {
    type: string; // «опт», «партнер»…; пустая строка — базовая цена
    price: number;
    minQty: number; // от какого количества действует
}

export interface PricedProduct {
    salePrice: number;
    prices?: PriceTier[];
}

/**
 * Цена товара для клиента: сперва ищем ступень его типа цены, подходящую по количеству (берём
 * большую из подходящих ступеней — с самым высоким minQty), затем ступень без типа, затем базовую.
 * Ступени без цены (0) не применяются: ноль в прайсе — это «не задано», а не «бесплатно».
 */
export function priceFor(product: PricedProduct, opts: { priceType?: string; qty?: number } = {}): number {
    const qty = Number(opts.qty) || 1;
    const type = (opts.priceType ?? "").trim();
    const tiers = (product.prices ?? []).filter((t) => Number(t.price) > 0 && Number(t.minQty) <= qty);
    const own = tiers.filter((t) => (t.type ?? "") === type && type !== "").sort((a, b) => b.minQty - a.minQty)[0];
    if (own) return Number(own.price);
    const base = tiers.filter((t) => !t.type).sort((a, b) => b.minQty - a.minQty)[0];
    if (base) return Number(base.price);
    return Number(product.salePrice) || 0;
}

export interface DiscountRule {
    percent: number; // скидка, %
    minTotal: number; // от какой суммы заказа действует
}

/** Скидка за объём: берётся наибольшая подходящая ступень по сумме. */
export function volumeDiscount(total: number, rules: DiscountRule[]): number {
    const fit = (rules ?? []).filter((r) => total >= r.minTotal && r.percent > 0).sort((a, b) => b.percent - a.percent)[0];
    return fit ? Number(fit.percent) : 0;
}

export interface CreditState {
    used: number; // сколько уже должны по открытым счетам
    limit: number; // кредитный лимит клиента (0 — без лимита)
    overdue: number; // из них просрочено
}

/** Хватает ли кредитного лимита на новый счёт: возвращает null, если лимита нет, иначе — остаток. */
export function creditRoom(state: CreditState, newAmount: number): { ok: boolean; leftAfter: number } | null {
    if (!state.limit) return null;
    const left = state.limit - state.used;
    return { ok: newAmount <= left, leftAfter: Math.round((left - newAmount) * 100) / 100 };
}

/** Акт сверки: долг клиента по документам — начислено, оплачено, сальдо на дату. */
export interface ReconciliationInput {
    invoices: Array<{ number: string; date: string; amount: number; paid: number }>;
    from: string;
    to: string;
    openingBalance?: number; // сальдо на начало (из прежних периодов), если известно
}

export interface ReconciliationRow {
    number: string;
    date: string;
    charged: number; // начислено
    paid: number; // оплачено
    balance: number; // сальдо нарастающим итогом до этой строки
}

export function reconciliation(input: ReconciliationInput): { rows: ReconciliationRow[]; opening: number; closing: number } {
    const opening = Number(input.openingBalance) || 0;
    const inPeriod = input.invoices
        .filter((i) => i.date >= input.from && i.date <= input.to)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.number.localeCompare(b.number)));
    let balance = opening;
    const rows = inPeriod.map((i) => {
        balance = Math.round((balance + i.amount - i.paid) * 100) / 100;
        return { number: i.number, date: i.date, charged: i.amount, paid: i.paid, balance };
    });
    return { rows, opening, closing: Math.round(balance * 100) / 100 };
}
