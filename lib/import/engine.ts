import { parseAmount, parseDate } from "@/lib/finance/bank";
import { fieldError } from "@/lib/validation/common";
import { moveStock } from "@/lib/finance/stock";
import { parseCsv } from "./csv";
import { IMPORT_KINDS, guessMapping, type ImportKind } from "./kinds";
import ImportBatch from "@/models/ImportBatch";
import Product from "@/models/Product";
import Contact from "@/models/Contact";
import Company from "@/models/Company";
import StockMovement from "@/models/StockMovement";

// Мастер импорта (ТЗ §17): предпросмотр с проверкой → импорт → отчёт об ошибках → откат пакета.
//
// Порядок работы выбран так, чтобы файл нельзя было «залить и потом разбираться»:
//   1. previewImport — чистая функция: разбирает CSV, раскладывает колонки и проверяет значения
//      (теми же валидаторами, что и формы); ничего не пишет;
//   2. applyImport — пишет только валидные строки, обновляет существующие по ключу (SKU/почта/код),
//      создаёт остатки движениями склада (журнал неизменяем);
//   3. rollbackImport — удаляет созданное этим пакетом и возвращает изменённое к прежним значениям,
//      а созданные движения гасит обратными.

export interface PreviewRow {
    line: number; // номер строки в файле (1 — первая строка данных, заголовок не считается)
    values: Record<string, string>; // поле → значение (только сопоставленные колонки)
    errors: Array<{ field: string; code: string }>;
    empty: boolean; // строка целиком пустая — не ошибка, просто пропускается
}

export interface ImportPreview {
    kind: ImportKind;
    columns: string[];
    mapping: Record<string, string>; // заголовок файла → поле
    unknownColumns: string[]; // колонки без поля — их видно в окне, данные не теряются молча
    missingRequired: string[]; // обязательные поля без колонки — импорт не запустится
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
            // Числа и даты из файла приводятся к каноническому виду до проверки: Excel пишет «1 234,56»,
            // «31.12.2026», а валидаторы и база ждут «1234.56» и «2026-12-31». Не разобравшееся значение
            // остаётся как есть — его и покажет валидатор как ошибку строки.
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
                // Обязательные поля проверяем на заполненность, остальные — валидатором (он пропускает пустоту)
                if (f.required && !values[f.key]) {
                    errors.push({ field: f.key, code: "required" });
                    continue;
                }
                if (f.code) {
                    const err = fieldError(f.code, values[f.key]);
                    if (err) errors.push({ field: f.key, code: err });
                }
            }
            // Тип товара: в файлах пишут и «услуга», и «service» — приводим к словарю модели;
            // без типа, но с остатком строка считается товаром (у услуги остатка не бывает)
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

type AnyDoc = Record<string, any> & { _id: unknown; save(): Promise<unknown> };

/** Импорт предпросмотра в базу. Возвращает отчёт; изменения можно откатить по batchId. */
export async function applyImport(org: string, preview: ImportPreview, opts: { fileName?: string; by?: string } = {}): Promise<ImportReport> {
    const log: ImportReport["log"] = [];
    const createdIds: unknown[] = [];
    const updatedBefore: Array<{ id: unknown; before: Record<string, unknown> }> = [];
    const stockMovements: unknown[] = [];
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

    const batch = await ImportBatch.create({
        org,
        kind: preview.kind,
        fileName: opts.fileName ?? "",
        by: opts.by ?? "",
        summary: { total: preview.summary.total, created, updated, skipped, failed },
        log: log.slice(0, 1000), // отчёт не должен раздувать документ на 5000 строк
        createdIds,
        updatedBefore,
        stockMovements,
    });
    return { batchId: String(batch._id), summary: { total: preview.summary.total, created, updated, skipped, failed }, log };
}

async function applyRow(
    org: string,
    kind: ImportKind,
    v: Record<string, string>,
    undo: { createdIds: unknown[]; updatedBefore: Array<{ id: unknown; before: Record<string, unknown> }>; stockMovements: unknown[] }
): Promise<"created" | "updated" | "skipped"> {
    if (kind === "products") {
        const patch: Record<string, unknown> = {
            name: v.name,
            ...(v.sku !== undefined ? { sku: v.sku } : {}),
            ...(v.type ? { type: v.type.toLowerCase() === "good" ? "good" : "service" } : {}),
            ...(v.unit ? { unit: v.unit } : {}),
            ...(v.purchasePrice ? { purchasePrice: num(v.purchasePrice) } : {}),
            ...(v.salePrice ? { salePrice: num(v.salePrice) } : {}),
            ...(v.taxRate ? { taxRate: num(v.taxRate) } : {}),
            ...(v.reorderLevel ? { reorderLevel: num(v.reorderLevel) } : {}),
            ...(v.image ? { image: v.image.slice(0, 500) } : {}),
        };
        const existing = v.sku
            ? await Product.findOne({ org, sku: v.sku })
            : await Product.findOne({ org, name: v.name });
        let product: AnyDoc;
        if (existing) {
            undo.updatedBefore.push({ id: existing._id, before: snapshot(existing, Object.keys(patch)) });
            existing.set(patch);
            await existing.save();
            product = existing as AnyDoc;
            await addStock(org, product, v, undo);
            return "updated";
        }
        const created = await Product.create({ org, ...patch });
        undo.createdIds.push(created._id);
        product = created as AnyDoc;
        await addStock(org, product, v, undo);
        return "created";
    }

    if (kind === "stock") {
        const product = v.sku ? await Product.findOne({ org, sku: v.sku }) : await Product.findOne({ org, name: v.name });
        if (!product) throw new Error("товар не знайдено — спочатку імпортуйте каталог");
        const qty = num(v.qty);
        if (!qty) return "skipped";
        const moved = await moveStock(org, String(product._id), Math.abs(qty), "purchase", { note: "Імпорт залишків" });
        if (moved) undo.stockMovements.push(moved.movement._id);
        if (v.cost) {
            product.set({ purchasePrice: num(v.cost) });
            undo.updatedBefore.push({ id: product._id, before: { purchasePrice: (product as AnyDoc).purchasePrice } });
            await product.save();
        }
        return "updated";
    }

    if (kind === "contacts") {
        const existing =
            (v.email ? await Contact.findOne({ owner: org, email: v.email }) : null) ??
            (v.phone ? await Contact.findOne({ owner: org, phone: v.phone }) : null) ??
            (await Contact.findOne({ owner: org, name: v.name }));
        const patch = pick(v, ["name", "email", "phone", "position", "company", "website", "notes"]);
        if (existing) {
            undo.updatedBefore.push({ id: existing._id, before: snapshot(existing, Object.keys(patch)) });
            existing.set(patch);
            await existing.save();
            return "updated";
        }
        const created = await Contact.create({ owner: org, source: "import", ...patch });
        undo.createdIds.push(created._id);
        return "created";
    }

    // companies
    const existing = (v.code ? await Company.findOne({ owner: org, code: v.code }) : null) ?? (await Company.findOne({ owner: org, name: v.name }));
    const patch = pick(v, ["name", "code", "status", "address", "email", "authorisedPerson", "businessType"]);
    if (v.registrationDate) patch.registrationDate = parseDate(v.registrationDate) || "";
    if (existing) {
        undo.updatedBefore.push({ id: existing._id, before: snapshot(existing, Object.keys(patch)) });
        existing.set(patch);
        await existing.save();
        return "updated";
    }
    const created = await Company.create({ owner: org, ...patch });
    undo.createdIds.push(created._id);
    return "created";
}

// Остаток из файла каталога становится приходом документом «Імпорт» — остаток не правится напрямую
async function addStock(org: string, product: AnyDoc, v: Record<string, string>, undo: { stockMovements: unknown[] }) {
    if (product.type !== "good" || !v.stockQty) return;
    const qty = num(v.stockQty);
    if (!qty) return;
    const moved = await moveStock(org, String(product._id), Math.abs(qty), "purchase", { note: "Імпорт каталогу" });
    if (moved) undo.stockMovements.push(moved.movement._id);
}

// Снимок только изменяемых полей: откат возвращает именно их, не трогая остальное
function snapshot(doc: AnyDoc, keys: string[]) {
    const before: Record<string, unknown> = {};
    for (const k of keys) before[k] = doc[k] ?? doc.get?.(k);
    return before;
}

function pick(v: Record<string, string>, keys: string[]) {
    const out: Record<string, string> = {};
    for (const k of keys) if (v[k] !== undefined && v[k] !== "") out[k] = v[k];
    return out;
}

/** Откат пакета: созданное удаляем, изменённое возвращаем, движения гасим обратными записями. */
export async function rollbackImport(org: string, batchId: string): Promise<{ ok: boolean; message: string }> {
    const batch = await ImportBatch.findOne({ _id: batchId, org });
    if (!batch) return { ok: false, message: "not_found" };
    if (batch.rolledBackAt) return { ok: false, message: "already_rolled_back" };

    const model = batch.kind === "contacts" ? Contact : batch.kind === "companies" ? Company : Product;
    if (batch.createdIds.length) {
        const ids = batch.createdIds;
        await model.deleteMany({ _id: { $in: ids }, ...(batch.kind === "products" || batch.kind === "stock" ? { org } : { owner: org }) });
    }
    for (const entry of batch.updatedBefore) {
        const doc = await model.findOne({ _id: entry.id, ...(batch.kind === "products" || batch.kind === "stock" ? { org } : { owner: org }) });
        if (doc) {
            doc.set(entry.before as never);
            await doc.save();
        }
    }
    // Движения склада неизменяемы: откат пишет обратные движения и связывает их с пакетом
    for (const movementId of batch.stockMovements) {
        const movement = await StockMovement.findOne({ _id: movementId, org });
        if (!movement) continue;
        const reverse = await moveStock(org, String(movement.product), -movement.qty, "adjustment", { note: "Відкат імпорту" });
        if (reverse) batch.stockMovements.push(reverse.movement._id);
    }

    batch.rolledBackAt = new Date();
    batch.markModified("stockMovements");
    await batch.save();
    return { ok: true, message: "rolled_back" };
}
