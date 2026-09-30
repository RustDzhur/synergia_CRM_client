// Сборка спецификаций из строк импорта (ТЗ §17, «виробництво»): файл со строками
// «изделие; компонент; количество» превращается в спецификации, где строки с одним изделием
// собираются вместе. Функция чистая — её проверяет тест, а пишет в базу engine.ts.

export interface BomImportRow {
    product: string; // название изделия (обязательно)
    productSku?: string;
    component: string; // название компонента (обязательно)
    componentSku?: string;
    qty: string; // норма на единицу (как в файле; приведение чисел — за вызывающим)
    wastePercent?: string;
    overheadPercent?: string; // накладные изделия (берётся из любой строки изделия)
}

export interface BomGroup {
    product: string;
    productSku: string;
    overheadPercent: number;
    components: Array<{ name: string; sku: string; qty: number; wastePercent: number }>;
}

/** Группировка строк файла в спецификации; порядок изделий — как в файле. */
export function groupBomRows(rows: BomImportRow[]): BomGroup[] {
    const groups = new Map<string, BomGroup>();
    const order: string[] = [];
    for (const row of rows) {
        const key = `${(row.productSku ?? "").trim().toLowerCase()}|${row.product.trim().toLowerCase()}`;
        let group = groups.get(key);
        if (!group) {
            group = { product: row.product.trim(), productSku: (row.productSku ?? "").trim(), overheadPercent: 0, components: [] };
            groups.set(key, group);
            order.push(key);
        }
        const overhead = Number(String(row.overheadPercent ?? "").replace(",", "."));
        if (Number.isFinite(overhead) && overhead > 0) group.overheadPercent = overhead;
        group.components.push({
            name: row.component.trim(),
            sku: (row.componentSku ?? "").trim(),
            qty: Number(String(row.qty).replace(/\s/g, "").replace(",", ".")) || 0,
            wastePercent: Number(String(row.wastePercent ?? "").replace(",", ".")) || 0,
        });
    }
    return order.map((k) => groups.get(k)!);
}
