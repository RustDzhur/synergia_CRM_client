import { ProviderError } from "@/lib/http";
import { nextNumber } from "@/lib/finance/numbering";
import { postStockDoc } from "@/lib/finance/stockDocs";
import Product from "@/models/Product";
import PurchaseOrder from "@/models/PurchaseOrder";
import Supplier from "@/models/Supplier";
import SupplierInvoice from "@/models/SupplierInvoice";

// Закупки (ТЗ §12): заказ поставщику → приход по накладной → счёт поставщика → оплата → возврат.
//
// Цепочка держится на двух правилах:
//   • склад меняет только документ склада (приход), заказ сам остаток не трогает;
//   • приход переносит закупочную цену в товар — по ней потом считается себестоимость продажи,
//     поэтому «закупка → приход → продажа → себестоимость» сходится без ручных правок.

export interface ReceiveInput {
    /** Сколько принимаем по каждой строке (по индексу строки заказа). Не указано — принимаем всё. */
    quantities?: number[];
    /** Счёт поставщика: номер, дата, срок оплаты. Номер необязателен — счёт (долг и расход) создаётся
     *  и без него, а номер можно добавить позже: иначе закупка выпадала бы из отчётов вовсе. */
    invoice?: { number?: string; date?: string; dueDate?: string };
    warehouse?: string;
    by?: string;
}

export async function receivePurchase(org: string, purchaseId: string, input: ReceiveInput = {}) {
    const po = await PurchaseOrder.findOne({ _id: purchaseId, org }).populate("supplier");
    if (!po) throw new ProviderError("Замовлення не знайдено");
    if (po.status === "cancelled") throw new ProviderError("Замовлення скасовано");
    if (po.status === "received") throw new ProviderError("Замовлення вже прийнято повністю");

    const supplier = await Supplier.findOne({ _id: po.supplier, org });
    if (!supplier) throw new ProviderError("Постачальника не знайдено");

    // Принимаемые количества: по умолчанию — весь остаток заказа
    const lines = (po.lines ?? []).map((l: { product: unknown; qty: number; price: number; receivedQty?: number }, i: number) => {
        const left = Math.max(0, Number(l.qty) - Number(l.receivedQty ?? 0));
        const asked = input.quantities?.[i];
        const qty = asked === undefined ? left : Math.max(0, Math.min(left, Number(asked) || 0));
        return { product: String(l.product), qty, price: Number(l.price) || 0, index: i };
    }).filter((l: { qty: number }) => l.qty > 0);
    if (!lines.length) throw new ProviderError("Немає що приймати — усі рядки вже прийняті");

    const warehouse = input.warehouse || (po.warehouse ? String(po.warehouse) : undefined);
    if (!warehouse) throw new ProviderError("Вкажіть склад, на який приймаємо товар");

    // Приход документом склада: цена строки становится себестоимостью партии
    const doc = await postStockDoc(org, {
        kind: "receipt",
        warehouseTo: warehouse,
        lines: lines.map((l: { product: string; qty: number; price: number }) => ({ product: l.product, qty: l.qty, price: l.price })),
        note: `Прихід за замовленням ${po.number}`,
        by: input.by ?? "",
    });

    // Закупочная цена товара обновляется последней ценой прихода — база для себестоимости
    for (const l of lines) {
        if (l.price > 0) await Product.updateOne({ _id: l.product, org }, { $set: { purchasePrice: l.price } });
    }

    // Отмечаем принятое в заказе и закрываем его, если приняли всё
    let fullyReceived = true;
    for (const l of lines) {
        const line = po.lines[l.index] as { receivedQty?: number; qty: number };
        const received = Number(line.receivedQty ?? 0) + l.qty;
        line.receivedQty = received;
        if (received < line.qty) fullyReceived = false;
    }
    po.markModified("lines");
    po.status = fullyReceived ? "received" : "confirmed";
    await po.save();

    // Счёт поставщика: долг фирмы. Сумма — по принятым строкам, валюта заказа. Счёт создаётся ВСЕГДА,
    // даже без номера: без него закупка не попадала ни в отчёты, ни в долги — владелец жаловался,
    // что закупівлі «нигде не видно» в прибыли. Номер приносят позже — его видно в списке и можно
    // вписать при оплате; пустая строка значит «номер ещё не известен», а не «закупки нет».
    let invoice = null;
    const total = lines.reduce((sum: number, l: { qty: number; price: number }) => sum + l.qty * l.price, 0);
    if (total > 0) {
        const date = input.invoice?.date && /^\d{4}-\d{2}-\d{2}$/.test(input.invoice.date) ? input.invoice.date : new Date().toISOString().slice(0, 10);
        invoice = await SupplierInvoice.create({
            org,
            supplier: supplier._id,
            purchase: po._id,
            number: String(input.invoice?.number ?? "").trim().slice(0, 60),
            date,
            dueDate: input.invoice?.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.invoice.dueDate) ? input.invoice.dueDate : addDays(date, supplier.paymentDays || 0),
            amount: Math.round(total * 100) / 100,
            currency: po.currency || "",
            notes: `Прихід за замовленням ${po.number}`,
        });
    }

    return { doc, invoice, fullyReceived };
}

/** Возврат поставщику: списание со склада с пометкой; счёт поставщика при необходимости сторнируется вручную. */
export async function returnToSupplier(org: string, purchaseId: string, input: { lines: Array<{ product: string; qty: number; price?: number }>; warehouse: string; note?: string; by?: string }) {
    const po = await PurchaseOrder.findOne({ _id: purchaseId, org });
    if (!po) throw new ProviderError("Замовлення не знайдено");
    const lines = (input.lines ?? []).filter((l) => l.product && Number(l.qty) > 0);
    if (!lines.length) throw new ProviderError("Немає рядків для повернення");
    if (!input.warehouse) throw new ProviderError("Вкажіть склад, з якого повертаємо");
    const doc = await postStockDoc(org, {
        kind: "writeoff",
        warehouseFrom: input.warehouse,
        lines: lines.map((l) => ({ product: l.product, qty: Math.abs(l.qty), price: Number(l.price) || 0 })),
        note: input.note?.trim() || `Повернення постачальнику за замовленням ${po.number}`,
        by: input.by ?? "",
    });
    return { doc };
}

/** Счёт поставщика: оплата (полная или частичная) — как у клиентских счетов, копится paidAmount. */
export async function paySupplierInvoice(org: string, invoiceId: string, amount?: number) {
    const inv = await SupplierInvoice.findOne({ _id: invoiceId, org });
    if (!inv) throw new ProviderError("Счёт не знайдено");
    if (inv.status === "paid") throw new ProviderError("Счёт вже оплачено");
    const left = Math.max(0, inv.amount - inv.paidAmount);
    const pay = amount === undefined ? left : Math.max(0, Math.min(left, Number(amount) || 0));
    if (!pay) throw new ProviderError("Сума оплати нульова");
    inv.paidAmount = Math.round((inv.paidAmount + pay) * 100) / 100;
    if (inv.paidAmount >= inv.amount - 0.005) inv.status = "paid";
    await inv.save();
    return inv;
}

export const supplierInvoices = (org: string) => SupplierInvoice.find({ org }).sort({ date: -1 }).limit(300);

/** Номер для заказа поставщику — своя последовательность «ЗП». */
export const purchaseNumber = (org: string) => nextNumber(org, "ЗП");

function addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
    return d.toISOString().slice(0, 10);
}
