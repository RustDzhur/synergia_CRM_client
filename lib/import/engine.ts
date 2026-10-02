import { parseAmount, parseDate } from "@/lib/finance/bank";
import { fieldError } from "@/lib/validation/common";
import { cleanBarcode } from "@/lib/finance/productFields";
import { moveStock } from "@/lib/finance/stock";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "./csv";
import { IMPORT_KINDS, guessMapping, type ImportKind } from "./kinds";
import { groupBomRows, type BomImportRow } from "./bomGroup";

// Мастер импорта (ТЗ §17): предпросмотр с проверкой → импорт → отчёт об ошибках → откат пакета.
//
//   1. previewImport — чистая функция: разбирает CSV и проверяет значения; ничего не пишет;
//   2. applyImport — пишет только валидные строки, обновляет существующие по ключу, создаёт
//      остатки движениями склада (журнал неизменяем);
//   3. rollbackImport — удаляет созданное пакетом и возвращает изменённое, движения гасит обратными.

export interface PreviewRow {
    line: number;
    values: Record<string, string>;
    errors: Array<{ field: string; code: string }>;
    empty: boolean;
}

export interface ImportPreview {
    kind: ImportKind;
    columns: string[];
    mapping: Record<string, string>;
    unknownColumns: string[];
    missingRequired: string[];
    rows: PreviewRow[];
    summary: { total: number; valid: number; invalid: number };
}

const isTruthy = (v: string) => /^(1|true|yes|так|да|ja|good|товар|product)$/i.test(v.trim());

/** Разбор и проверка файла без записи в базу. mapping — заголовок → поле; без него угадывается. */
export function previewImport(kind: ImportKind, text: string, mapping?: Record<string, string>): ImportPreview {
    const def = IMPORT_KINDS[kind];
    const { columns, rows } = parseCsv(text || "");
    const map = mapping && Object.keys(mapping).length ? mapping : guessMapping(kind, columns);
    const used = new Set(Object.values(map).filter(Boolean));
    const missingRequired = def.fields.filter((f) => f.required && !used.has(f.key)).map((f) => f.key);
    const unknownColumns = columns.filter((c) => !map[c]);

    const out: PreviewRow[] = rows.map((cells, i) => {
        const values: Record<string, string> = {};
        columns.forEach((col, j) => {
            const target = map[col];
            if (target) values[target] = (cells[j] ?? "").trim();
        });
        const empty = Object.values(values).every((v) => !v);
        const errors: Array<{ field: string; code: string }> = [];
        if (!empty) {
            for (const f of def.fields) {
                if (!values[f.key]) continue;
                if (f.code === "amount" || f.code === "rate") {
                    const n = parseAmount(values[f.key]);
                    if (Number.isFinite(n)) values[f.key] = String(n);
                } else if (f.code === "date") {
                    const d = parseDate(values[f.key]);
                    if (d) values[f.key] = d;
                }
            }
            for (const f of def.fields) {
                if (f.required && !values[f.key]) {
                    errors.push({ field: f.key, code: "required" });
                    continue;
                }
                if (f.code) {
                    const err = fieldError(f.code, values[f.key]);
                    if (err) errors.push({ field: f.key, code: err });
                }
            }
            if (kind === "products") {
                if (values.type && !/^(good|service)$/i.test(values.type)) values.type = isTruthy(values.type) ? "good" : "service";
                if (!values.type && values.stockQty) values.type = "good";
            }
        }
        return { line: i + 1, values, errors, empty };
    });

    return {
        kind,
        columns,
        mapping: map,
        unknownColumns,
        missingRequired,
        rows: out,
        summary: {
            total: out.filter((r) => !r.empty).length,
            valid: out.filter((r) => !r.empty && r.errors.length === 0).length,
            invalid: out.filter((r) => !r.empty && r.errors.length > 0).length,
        },
    };
}

export interface ImportReport {
    batchId: string;
    summary: { total: number; created: number; updated: number; skipped: number; failed: number };
    log: Array<{ row: number; status: "created" | "updated" | "skipped" | "failed"; message: string }>;
}

const num = (v: string | undefined, def = 0) => (v ? (Number.isFinite(parseAmount(v)) ? parseAmount(v) : def) : def);

type AnyDoc = Record<string, any> & { id: string };

/** Импорт предпросмотра в базу. Возвращает отчёт; изменения можно откатить по batchId. */
export async function applyImport(org: string, preview: ImportPreview, opts: { fileName?: string; by?: string } = {}): Promise<ImportReport> {
    if (preview.kind === "boms") return applyBomsImport(org, preview, opts);
    const log: ImportReport["log"] = [];
    const createdIds: string[] = [];
    const updatedBefore: Array<{ id: string; before: Record<string, unknown> }> = [];
    const stockMovements: string[] = [];
    let created = 0, updated = 0, skipped = 0, failed = 0;

    for (const row of preview.rows) {
        if (row.empty) continue;
        if (row.errors.length) {
            failed++;
            log.push({ row: row.line, status: "failed", message: row.errors.map((e) => `${e.field}:${e.code}`).join(", ") });
            continue;
        }
        try {
            const result = await applyRow(org, preview.kind, row.values, { createdIds, updatedBefore, stockMovements });
            if (result === "created") created++;
            else if (result === "updated") updated++;
            else skipped++;
            log.push({ row: row.line, status: result, message: "" });
        } catch (e) {
            failed++;
            log.push({ row: row.line, status: "failed", message: e instanceof Error ? e.message.slice(0, 200) : "помилка" });
        }
    }

    const batch = await prisma.importBatch.create({
        data: {
            org,
            kind: preview.kind,
            fileName: opts.fileName ?? "",
            by: opts.by ?? "",
            summary: { total: preview.summary.total, created, updated, skipped, failed } as any,
            log: log.slice(0, 1000) as any,
            createdIds,
            updatedBefore: updatedBefore as any,
            stockMovements,
        },
    });
    return { batchId: batch.id, summary: { total: preview.summary.total, created, updated, skipped, failed }, log };
}

async function applyRow(
    org: string,
    kind: ImportKind,
    v: Record<string, string>,
    undo: { createdIds: string[]; updatedBefore: Array<{ id: string; before: Record<string, unknown> }>; stockMovements: string[] }
): Promise<"created" | "updated" | "skipped"> {
    if (kind === "products") {
        const patch: Record<string, unknown> = {
            name: v.name,
            ...(v.sku !== undefined ? { sku: v.sku } : {}),
            ...(v.barcode ? { barcode: cleanBarcode(v.barcode) } : {}),
            ...(v.type ? { type: v.type.toLowerCase() === "good" ? "good" : "service" } : {}),
            ...(v.unit ? { unit: v.unit } : {}),
            ...(v.purchasePrice ? { purchasePrice: num(v.purchasePrice) } : {}),
            ...(v.salePrice ? { salePrice: num(v.salePrice) } : {}),
            ...(v.taxRate ? { taxRate: num(v.taxRate) } : {}),
            ...(v.reorderLevel ? { reorderLevel: num(v.reorderLevel) } : {}),
            ...(v.image ? { image: v.image.slice(0, 500) } : {}),
            ...(v.hsCode ? { hsCode: v.hsCode.trim().slice(0, 20) } : {}),
            ...(v.weightKg ? { weightKg: num(v.weightKg) } : {}),
            ...(v.originCountry ? { originCountry: v.originCountry.trim().toUpperCase().slice(0, 2) } : {}),
        };
        const existing = v.sku
            ? await prisma.product.findFirst({ where: { org, sku: v.sku } })
            : await prisma.product.findFirst({ where: { org, name: v.name } });
        let product: AnyDoc;
        if (existing) {
            undo.updatedBefore.push({ id: existing.id, before: snapshot(existing, Object.keys(patch)) });
            const updated = await prisma.product.update({ where: { id: existing.id }, data: patch as any });
            product = updated as AnyDoc;
            await addStock(org, product, v, undo);
            return "updated";
        }
        const created = await prisma.product.create({ data: { org, ...(patch as any) } });
        undo.createdIds.push(created.id);
        product = created as AnyDoc;
        await addStock(org, product, v, undo);
        return "created";
    }

    if (kind === "stock") {
        const product = v.sku ? await prisma.product.findFirst({ where: { org, sku: v.sku } }) : await prisma.product.findFirst({ where: { org, name: v.name } });
        if (!product) throw new Error("товар не знайдено — спочатку імпортуйте каталог");
        const qty = num(v.qty);
        if (!qty) return "skipped";
        const moved = await moveStock(org, product.id, Math.abs(qty), "purchase", { note: "Імпорт залишків" });
        if (moved) undo.stockMovements.push(moved.movement.id);
        if (v.cost) {
            undo.updatedBefore.push({ id: product.id, before: { purchasePrice: product.purchasePrice } });
            await prisma.product.update({ where: { id: product.id }, data: { purchasePrice: num(v.cost) } });
        }
        return "updated";
    }

    if (kind === "contacts") {
        const existing =
            (v.email ? await prisma.contact.findFirst({ where: { owner: org, email: v.email } }) : null) ??
            (v.phone ? await prisma.contact.findFirst({ where: { owner: org, phone: v.phone } }) : null) ??
            (await prisma.contact.findFirst({ where: { owner: org, name: v.name } }));
        const patch = pick(v, ["name", "email", "phone", "position", "company", "website", "notes"]);
        if (existing) {
            undo.updatedBefore.push({ id: existing.id, before: snapshot(existing, Object.keys(patch)) });
            await prisma.contact.update({ where: { id: existing.id }, data: patch as any });
            return "updated";
        }
        const created = await prisma.contact.create({ data: { owner: org, source: "import", ...(patch as any) } });
        undo.createdIds.push(created.id);
        return "created";
    }

    // companies
    const existing = (v.code ? await prisma.company.findFirst({ where: { owner: org, code: v.code } }) : null) ?? (await prisma.company.findFirst({ where: { owner: org, name: v.name } }));
    const patch: Record<string, unknown> = pick(v, ["name", "code", "status", "address", "email", "authorisedPerson", "businessType"]);
    if (v.registrationDate) patch.registrationDate = parseDate(v.registrationDate) || "";
    if (existing) {
        undo.updatedBefore.push({ id: existing.id, before: snapshot(existing, Object.keys(patch)) });
        await prisma.company.update({ where: { id: existing.id }, data: patch as any });
        return "updated";
    }
    const created = await prisma.company.create({ data: { owner: org, ...(patch as any) } });
    undo.createdIds.push(created.id);
    return "created";
}

// Спецификации: строки собираются в BOM по изделию; существующая спецификация не переписывается,
// а поднимает версию — старые производственные заказы считаются по своей версии.
async function applyBomsImport(org: string, preview: ImportPreview, opts: { fileName?: string; by?: string }): Promise<ImportReport> {
    const log: ImportReport["log"] = [];
    const createdIds: string[] = [];
    const updatedBefore: Array<{ id: string; before: Record<string, unknown> }> = [];
    let created = 0;
    let failed = 0;

    const valid = preview.rows.filter((r) => !r.empty);
    const productCache = new Map<string, string | null>();
    const findProduct = async (sku: string, name: string): Promise<string | null> => {
        const key = `${sku.toLowerCase()}|${name.toLowerCase()}`;
        if (productCache.has(key)) return productCache.get(key) ?? null;
        const doc = (sku ? await prisma.product.findFirst({ where: { org, sku } }) : null) ?? (await prisma.product.findFirst({ where: { org, name } }));
        productCache.set(key, doc ? doc.id : null);
        return doc ? doc.id : null;
    };

    const bad = valid.filter((r) => r.errors.length);
    for (const row of bad) {
        failed++;
        log.push({ row: row.line, status: "failed", message: row.errors.map((e) => `${e.field}:${e.code}`).join(", ") });
    }
    const goodRows = valid.filter((r) => !r.errors.length);
    const groups = groupBomRows(goodRows.map((r) => r.values as unknown as BomImportRow));
    const rowsOfGroup = (g: { product: string; productSku: string }) =>
        goodRows.filter((r) => (r.values.product ?? "").trim().toLowerCase() === g.product.toLowerCase() && (r.values.productSku ?? "").trim().toLowerCase() === g.productSku.toLowerCase());

    for (const group of groups) {
        const productId = await findProduct(group.productSku, group.product);
        if (!productId) {
            for (const r of rowsOfGroup(group)) {
                failed++;
                log.push({ row: r.line, status: "failed", message: `товар не знайдено: ${group.product} — спочатку імпортуйте каталог` });
            }
            continue;
        }
        const components: Array<{ product: string; qty: number; wastePercent: number }> = [];
        let missing = "";
        for (const c of group.components) {
            const cid = await findProduct(c.sku, c.name);
            if (!cid) {
                missing = c.name;
                break;
            }
            components.push({ product: cid, qty: c.qty, wastePercent: c.wastePercent });
        }
        if (missing) {
            for (const r of rowsOfGroup(group)) {
                failed++;
                log.push({ row: r.line, status: "failed", message: `компонент не знайдено: ${missing}` });
            }
            continue;
        }
        const latest = await prisma.bom.findFirst({ where: { org, product: productId }, orderBy: { version: "desc" } });
        const nextVersion = (Number(latest?.version) || 0) + 1;
        const doc = await prisma.bom.create({
            data: {
                org,
                product: productId,
                name: group.product,
                version: nextVersion,
                active: true,
                components: components as any,
                operations: [] as any,
                outputs: [] as any,
                overheadPercent: group.overheadPercent || 0,
                note: `Імпорт ${opts.fileName ?? ""}`.trim(),
            },
        });
        createdIds.push(doc.id);
        created += rowsOfGroup(group).length;
        for (const r of rowsOfGroup(group)) log.push({ row: r.line, status: "created", message: nextVersion > 1 ? `версія ${nextVersion}` : "" });
    }

    const batch = await prisma.importBatch.create({
        data: {
            org,
            kind: preview.kind,
            fileName: opts.fileName ?? "",
            by: opts.by ?? "",
            summary: { total: preview.summary.total, created, updated: 0, skipped: 0, failed } as any,
            log: log.slice(0, 1000) as any,
            createdIds,
            updatedBefore: updatedBefore as any,
            stockMovements: [],
        },
    });
    return { batchId: batch.id, summary: { total: preview.summary.total, created, updated: 0, skipped: 0, failed }, log };
}

// Остаток из файла каталога становится приходом документом «Імпорт» — остаток не правится напрямую
async function addStock(org: string, product: AnyDoc, v: Record<string, string>, undo: { stockMovements: string[] }) {
    if (product.type !== "good" || !v.stockQty) return;
    const qty = num(v.stockQty);
    if (!qty) return;
    const moved = await moveStock(org, product.id, Math.abs(qty), "purchase", { note: "Імпорт каталогу" });
    if (moved) undo.stockMovements.push(moved.movement.id);
}

// Снимок только изменяемых полей: откат возвращает именно их, не трогая остальное
function snapshot(doc: AnyDoc, keys: string[]) {
    const before: Record<string, unknown> = {};
    for (const k of keys) before[k] = (doc as any)[k] ?? (doc as any).get?.(k);
    return before;
}

function pick(v: Record<string, string>, keys: string[]) {
    const out: Record<string, string> = {};
    for (const k of keys) if (v[k] !== undefined && v[k] !== "") out[k] = v[k];
    return out;
}

/** Откат пакета: созданное удаляем, изменённое возвращаем, движения гасим обратными записями. */
export async function rollbackImport(org: string, batchId: string): Promise<{ ok: boolean; message: string }> {
    const batch = await prisma.importBatch.findFirst({ where: { id: batchId, org } });
    if (!batch) return { ok: false, message: "not_found" };
    if (batch.rolledBackAt) return { ok: false, message: "already_rolled_back" };

    const delegate: any = batch.kind === "contacts" ? prisma.contact : batch.kind === "companies" ? prisma.company : batch.kind === "boms" ? prisma.bom : prisma.product;
    // У товаров, остатков и спецификаций владелец — org; у контактов и фирм — owner (историческое поле)
    const scope: any = batch.kind === "contacts" || batch.kind === "companies" ? { owner: org } : { org };
    if (batch.createdIds.length) {
        await delegate.deleteMany({ where: { id: { in: batch.createdIds }, ...scope } });
    }
    for (const entry of ((batch.updatedBefore as any[]) ?? [])) {
        const doc = await delegate.findFirst({ where: { id: entry.id, ...scope } });
        if (doc) await delegate.update({ where: { id: entry.id }, data: entry.before });
    }
    // Движения склада неизменяемы: откат пишет обратные движения и связывает их с пакетом
    const movements = [...batch.stockMovements];
    for (const movementId of batch.stockMovements) {
        const movement = await prisma.stockMovement.findFirst({ where: { id: movementId, org } });
        if (!movement) continue;
        const reverse = await moveStock(org, String(movement.product), -movement.qty, "adjustment", { note: "Відкат імпорту" });
        if (reverse) movements.push(reverse.movement.id);
    }

    await prisma.importBatch.update({ where: { id: batch.id }, data: { stockMovements: movements, rolledBackAt: new Date() } });
    return { ok: true, message: "rolled_back" };
}
