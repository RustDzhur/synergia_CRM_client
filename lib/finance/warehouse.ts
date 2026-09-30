// Чистая логика склада (ТЗ §12): оценка себестоимости, оборотка, инвентаризация, ABC.
//
// Здесь нет базы и сети — только арифметика над движениями. Так её можно проверить тестом на
// контрольных примерах (приёмка этапа V2: «остаток = сумма движений; сторно; отчёты сходятся»),
// а потом те же функции использовать в маршрутах и отчётах.

export interface MovementLike {
    product: string; // id товара строкой
    warehouse?: string | null; // склад движения; null — склад по умолчанию
    qty: number; // знак важен: плюс — приход, минус — расход
    reason: string;
    unitCost?: number;
    at: string; // ISO-дата движения (для FIFO и периодов)
}

/** Остаток товара: сумма всех движений. Это и есть определение остатка — остальное кэш. */
export function stockOnHand(movements: MovementLike[], product?: string): number {
    return round(
        movements
            .filter((m) => !product || m.product === product)
            .reduce((sum, m) => sum + (Number(m.qty) || 0), 0)
    );
}

/** Остаток по складам: {склад или "" → {товар → количество}} */
export function stockByWarehouse(movements: MovementLike[]): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const m of movements) {
        const w = m.warehouse ?? "";
        out[w] = out[w] ?? {};
        out[w][m.product] = round((out[w][m.product] ?? 0) + (Number(m.qty) || 0));
    }
    return out;
}

/** Остаток на дату: сумма движений с датой ≤ указанной (границей включительно). */
export function stockAt(movements: MovementLike[], date: string, product?: string): number {
    return round(
        movements
            .filter((m) => (!product || m.product === product) && m.at.slice(0, 10) <= date)
            .reduce((sum, m) => sum + (Number(m.qty) || 0), 0)
    );
}

export interface TurnoverRow {
    product: string;
    opening: number; // остаток на начало периода
    incoming: number; // приход за период
    outgoing: number; // расход за период (положительное число)
    closing: number; // остаток на конец
}

/** Оборотка по складу за период: остаток на начало, приход, расход, остаток на конец. */
export function turnover(movements: MovementLike[], from: string, to: string): TurnoverRow[] {
    const products = Array.from(new Set(movements.map((m) => m.product)));
    return products
        .map((product) => {
            const opening = stockAt(movements, dayBefore(from), product);
            let incoming = 0;
            let outgoing = 0;
            for (const m of movements) {
                if (m.product !== product) continue;
                const day = m.at.slice(0, 10);
                if (day < from || day > to) continue;
                if (m.qty >= 0) incoming += m.qty;
                else outgoing += -m.qty;
            }
            return { product, opening, incoming: round(incoming), outgoing: round(outgoing), closing: round(opening + incoming - outgoing) };
        })
        .sort((a, b) => a.product.localeCompare(b.product));
}

/** Себестоимость списания по средней: средняя цена приходов до момента расхода. */
export function averageCost(movements: MovementLike[], product: string, at?: string): number {
    const receipts = movements.filter((m) => m.product === product && m.qty > 0 && (!at || m.at <= at));
    const qty = receipts.reduce((s, m) => s + m.qty, 0);
    if (!qty) return 0;
    const value = receipts.reduce((s, m) => s + m.qty * (Number(m.unitCost) || 0), 0);
    return round(value / qty);
}

export interface FifoConsumption {
    qty: number;
    cost: number; // списано по FIFO (по партиям в порядке поступления)
    remaining: Array<{ qty: number; unitCost: number }>; // что осталось в партиях
}

/** Списание по FIFO: расход закрывается самыми ранними партиями. */
export function fifoConsume(movements: MovementLike[], product: string, qtyToConsume: number): FifoConsumption {
    const layers: Array<{ qty: number; unitCost: number }> = [];
    let cost = 0;
    let left = Math.abs(qtyToConsume);
    const ordered = movements.filter((m) => m.product === product).sort((a, b) => (a.at < b.at ? -1 : 1));
    for (const m of ordered) {
        if (left <= 0) {
            // всё, что после момента расхода, остаётся партиями
            if (m.qty > 0) layers.push({ qty: m.qty, unitCost: Number(m.unitCost) || 0 });
            continue;
        }
        if (m.qty > 0) {
            const take = Math.min(m.qty, left);
            cost += take * (Number(m.unitCost) || 0);
            left -= take;
            if (m.qty - take > 0) layers.push({ qty: m.qty - take, unitCost: Number(m.unitCost) || 0 });
        } else {
            // расходы внутри периода тоже списывают партии — иначе FIFO поедет
            let l = -m.qty;
            while (l > 0 && layers.length) {
                const layer = layers[0];
                const take = Math.min(layer.qty, l);
                layer.qty -= take;
                l -= take;
                if (layer.qty <= 0) layers.shift();
            }
        }
    }
    // Остаток, который не закрылся партиями (расход больше прихода), считаем по средней — иначе
    // себестоимость молча стала бы нулевой, и отчёт о прибыли завысил бы маржу
    if (left > 0) cost += left * averageCost(movements, product);
    return { qty: round(Math.abs(qtyToConsume) - left), cost: round(cost), remaining: layers.map((l) => ({ qty: round(l.qty), unitCost: l.unitCost })) };
}

/** Себестоимость проданного: средняя или FIFO — как выбрала фирма. */
export function costOfGoodsSold(movements: MovementLike[], product: string, qty: number, method: "avg" | "fifo"): number {
    return method === "fifo" ? fifoConsume(movements, product, qty).cost : round(Math.abs(qty) * averageCost(movements, product));
}

export interface InventoryLine {
    product: string;
    book: number; // по учёту
    counted: number; // по факту
    diff: number; // counted - book: плюс — излишек, минус — недостача
}

/** Расхождения инвентаризации: по ним оформляются документы (излишки — оприбуткування, недостача — списание). */
export function inventoryDiff(book: Record<string, number>, counted: Record<string, number>): InventoryLine[] {
    const products = Array.from(new Set([...Object.keys(book), ...Object.keys(counted)]));
    return products
        .map((product) => {
            const b = round(book[product] ?? 0);
            const c = round(counted[product] ?? 0);
            return { product, book: b, counted: c, diff: round(c - b) };
        })
        .filter((l) => l.diff !== 0)
        .sort((a, b) => a.product.localeCompare(b.product));
}

export interface AbcRow {
    product: string;
    revenue: number;
    share: number; // доля в выручке, %
    group: "A" | "B" | "C"; // A — 80 % выручки, B — до 95 %, C — остальное
}

/** ABC-анализ по выручке: A — первые 80 %, B — до 95 %, C — остальное. */
export function abcAnalysis(sales: Array<{ product: string; revenue: number }>): AbcRow[] {
    const sorted = [...sales].sort((a, b) => b.revenue - a.revenue);
    const total = sorted.reduce((s, r) => s + r.revenue, 0);
    if (!total) return sorted.map((r) => ({ ...r, share: 0, group: "C" as const }));
    let running = 0;
    return sorted.map((r) => {
        running += r.revenue;
        const cumulative = (running / total) * 100;
        const group: AbcRow["group"] = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C";
        return { product: r.product, revenue: round(r.revenue), share: round((r.revenue / total) * 100), group };
    });
}

/** Неликвид: товар есть на складе, но не продавался дольше указанных дней. */
export function deadStock(movements: MovementLike[], today: string, days = 90): string[] {
    const lastSale: Record<string, string> = {};
    for (const m of movements) {
        if (m.reason === "sale" && (!lastSale[m.product] || m.at > lastSale[m.product])) lastSale[m.product] = m.at;
    }
    const limit = new Date(new Date(today).getTime() - days * 86400000).toISOString().slice(0, 10);
    return Array.from(new Set(movements.map((m) => m.product)))
        .filter((p) => stockOnHand(movements, p) > 0 && (!lastSale[p] || lastSale[p].slice(0, 10) < limit))
        .sort();
}

const round = (n: number) => Math.round(n * 10000) / 10000;

function dayBefore(date: string): string {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
