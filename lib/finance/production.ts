// Производство: чистая логика (ТЗ §13). Взрыв спецификации (в том числе многоуровневой),
// расчёт потребности и себестоимости. Здесь нет базы — спецификации передаются картой, поэтому
// многоуровневый BOM проверяется тестом на контрольном примере (приёмка V5).

export interface BomComponentLike {
    product: string;
    qty: number; // на одно изделие
    wastePercent?: number; // допустимый перерасход, %
    optional?: boolean;
}

export interface BomOperationLike {
    name: string;
    minutes: number; // на одно изделие
    costPerHour: number;
    workCenter?: string;
}

export interface BomLike {
    product: string;
    components: BomComponentLike[];
    operations: BomOperationLike[];
    outputs?: Array<{ product: string; qty: number }>;
    overheadPercent?: number;
}

export interface ExplosionResult {
    materials: Array<{ product: string; qty: number }>; // суммарная потребность на партию
    operations: Array<{ name: string; minutes: number; costPerHour: number; workCenter: string }>;
    outputs: Array<{ product: string; qty: number }>;
    /** Цепочка циклов, если спецификации ссылаются друг на друга по кругу — это ошибка данных */
    cycles: string[];
    /** Компоненты, на которые нет спецификации (сырьё) — их и закупают */
    purchased: string[];
}

/**
 * Взрыв состава: сколько сырья и операций нужно на партию изделия.
 * Многоуровневость — рекурсия по спецификациям компонентов; цикл (A содержит B, B содержит A)
 * не роняет расчёт, а отмечается в cycles: такие данные надо исправлять, но и увидеть их нужно.
 */
export function explodeBom(product: string, qty: number, boms: Map<string, BomLike>, opts: { includeOptional?: boolean } = {}): ExplosionResult {
    const materials = new Map<string, number>();
    const operations = new Map<string, { minutes: number; costPerHour: number; workCenter: string }>();
    const outputs = new Map<string, number>();
    const cycles: string[] = [];
    const purchased = new Set<string>();

    const walk = (id: string, factor: number, stack: string[]) => {
        const bom = boms.get(id);
        if (!bom) {
            purchased.add(id);
            return;
        }
        for (const c of bom.components ?? []) {
            if (c.optional && !opts.includeOptional) continue;
            const need = factor * (Number(c.qty) || 0) * (1 + (Number(c.wastePercent) || 0) / 100);
            if (!need) continue;
            if (boms.has(c.product)) {
                if (stack.includes(c.product)) {
                    // Цикл: дальше не идём, но запоминаем — расчёт не должен зависать на плохих данных
                    if (!cycles.includes(c.product)) cycles.push(c.product);
                    continue;
                }
                walk(c.product, need, [...stack, c.product]);
            } else {
                materials.set(c.product, round((materials.get(c.product) ?? 0) + need));
            }
        }
        for (const op of bom.operations ?? []) {
            const prev = operations.get(op.name) ?? { minutes: 0, costPerHour: Number(op.costPerHour) || 0, workCenter: op.workCenter ?? "" };
            prev.minutes = round(prev.minutes + (Number(op.minutes) || 0) * factor);
            operations.set(op.name, prev);
        }
        for (const out of bom.outputs ?? []) {
            outputs.set(out.product, round((outputs.get(out.product) ?? 0) + (Number(out.qty) || 0) * factor));
        }
    };

    walk(product, Number(qty) || 0, [product]);
    // Сырьё (то, что не производим сами) — все листья взрыва: их и закупают
    for (const leaf of Array.from(materials.keys())) purchased.add(leaf);
    return {
        materials: Array.from(materials, ([p, q]) => ({ product: p, qty: q })).sort((a, b) => b.qty - a.qty),
        operations: Array.from(operations, ([name, v]) => ({ name, ...v })),
        outputs: Array.from(outputs, ([p, q]) => ({ product: p, qty: q })),
        cycles,
        purchased: Array.from(purchased),
    };
}

export interface ProductionCostInput {
    materials: Array<{ qty: number; unitCost: number }>;
    operations: Array<{ minutes: number; costPerHour: number }>;
    overheadPercent?: number; // % от трудовых затрат
}

export interface ProductionCost {
    materials: number;
    labor: number;
    overhead: number;
    total: number;
}

export function productionCost(input: ProductionCostInput): ProductionCost {
    const materials = round((input.materials ?? []).reduce((s, m) => s + (Number(m.qty) || 0) * (Number(m.unitCost) || 0), 0));
    const labor = round((input.operations ?? []).reduce((s, o) => s + ((Number(o.minutes) || 0) / 60) * (Number(o.costPerHour) || 0), 0));
    const overhead = round(labor * ((Number(input.overheadPercent) || 0) / 100));
    return { materials, labor, overhead, total: round(materials + labor + overhead) };
}

/** Цена выпущенной единицы: полная себестоимость партии, делённая на выпуск (брак тоже её несёт). */
export function unitCostOf(cost: ProductionCost, producedQty: number): number {
    const qty = Number(producedQty) || 0;
    return qty > 0 ? round(cost.total / qty) : 0;
}

export interface MrpOrder {
    product: string;
    qty: number;
    due?: string;
}

export interface MrpRow {
    product: string;
    required: number; // потребность по открытым заказам
    inStock: number; // остаток на складе
    toBuy: number; // к закупке (не меньше нуля)
}

/** Потребность в материалах под заказы (простой MRP): взрыв составов минус остатки. */
export function mrpRequirements(orders: MrpOrder[], stock: Map<string, number>, boms: Map<string, BomLike>): MrpRow[] {
    const required = new Map<string, number>();
    for (const o of orders) {
        const explosion = explodeBom(o.product, o.qty, boms);
        for (const m of explosion.materials) required.set(m.product, round((required.get(m.product) ?? 0) + m.qty));
    }
    return Array.from(required, ([product, need]) => {
        const inStock = round(stock.get(product) ?? 0);
        return { product, required: need, inStock, toBuy: round(Math.max(0, need - inStock)) };
    }).sort((a, b) => b.toBuy - a.toBuy);
}

const round = (n: number) => Math.round(n * 10000) / 10000;
