import { ProviderError } from "@/lib/http";
import { applyTaxPolicy } from "./tax";
import { cleanItems, computeTotals } from "./totals";
import { financeSettings } from "./settings";
import { moveStock } from "./stock";
import { fiscalAdvice, fiscalConfig, fiscalizeInvoice, fiscalizeReturn, findFiscal } from "./fiscal";
import { nextNumber } from "./numbering";
import { numberPrefix } from "./documents/store";
import Invoice from "@/models/Invoice";
import Product from "@/models/Product";

// Розница/POS (ТЗ §12): продажа за прилавком — штрихкод, количество, скидка, готівка или картка.
//
// Продажа — это счёт, отмеченный оплаченным: так она автоматически попадает в книгу доходов,
// реестр ПН и отчётность, а не живёт отдельной «кассовой» сущностью мимо учёта. Склад списывается
// движениями, фискальный чек пробивается по правилам ПРРО (наличная и карточная оплата — нужен).
// DE: без сертифицированной кассы (TSE) розничную продажу не проводим — интерфейс об этом скажет.

export interface RetailLine { product: string; qty: number; price?: number }

export interface RetailSaleInput {
    lines: RetailLine[];
    payType: "cash" | "card";
    discountPercent?: number; // скидка на весь чек
    warehouse?: string; // склад списания
    by?: string;
}

export async function retailSale(org: string, input: RetailSaleInput) {
    const settings = await financeSettings(org);
    const raw = (input.lines ?? []).filter((l) => l.product && Number(l.qty) > 0);
    if (!raw.length) throw new ProviderError("Чек порожній — додайте товар");

    // Цены: из карточки товара, если кассир не перебил вручную; скидка применяется ко всем строкам
    const discount = Math.max(0, Math.min(90, Number(input.discountPercent) || 0));
    const products = await Product.find({ _id: { $in: raw.map((l) => l.product) }, org });
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const items = cleanItems(
        raw.map((l) => {
            const p = byId.get(String(l.product));
            if (!p) throw new ProviderError("Товар не знайдено");
            const base = Number(l.price) || Number(p.salePrice) || 0;
            return { description: p.name, qty: Math.abs(Number(l.qty)), unitPrice: Math.round(base * (1 - discount / 100) * 100) / 100, taxRate: p.taxRate ?? undefined, product: String(p._id) };
        })
    );
    const withTax = applyTaxPolicy(items, settings);
    const totals = computeTotals(withTax as never, { exempt: false });

    const prefix = await numberPrefix(org, "invoice", settings.invoicePrefix || "РАХ");
    const number = await nextNumber(org, prefix);
    const invoice = await Invoice.create({
        org,
        number,
        kind: "invoice",
        customerName: "Роздрібний покупець",
        items: withTax,
        currency: settings.currency || "UAH",
        smallBusinessNote: !settings.uaVatPayer && (settings.country ?? "").toUpperCase() === "UA" ? true : !!settings.smallBusiness,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        status: "paid",
        paidAt: new Date(),
        paidAmount: totals.gross,
        paidVia: input.payType,
        notes: discount > 0 ? `Роздрібний продаж, знижка ${discount} %` : "Роздрібний продаж",
    });

    // Склад: товарные строки списываются, услуг каса не касается
    for (const it of withTax) {
        const product = (it as { product?: string }).product;
        if (!product) continue;
        const info = byId.get(String(product));
        if (!info || info.type !== "good") continue;
        await moveStock(org, String(product), -Math.abs(Number((it as { qty?: number }).qty) || 0), "sale", {
            warehouse: input.warehouse ?? null,
            unitCost: Number(info.purchasePrice) || 0,
            note: `Роздрібний чек ${number}`,
            by: input.by ?? "",
        });
    }

    // ПРРО: чек обязателен для готівки и картки — пробиваем сразу, ошибку храним в счёте
    let fiscal: { fiscalCode: string; url: string } | null = null;
    try {
        const doc = await findFiscal(org);
        if (doc && fiscalConfig(doc).auto) {
            const receipt = await fiscalizeInvoice(org, invoice, totals.gross, input.payType === "cash" ? "CASH" : "CARD");
            invoice.fiscalId = receipt.receiptId;
            invoice.fiscalCode = receipt.fiscalCode;
            invoice.fiscalUrl = receipt.url;
            invoice.fiscalAt = new Date();
            invoice.fiscalPayType = input.payType === "cash" ? "CASH" : "CARD";
            invoice.fiscalError = "";
            await invoice.save();
            fiscal = { fiscalCode: receipt.fiscalCode, url: receipt.url };
        } else {
            invoice.fiscalError = fiscalAdvice({ paidVia: input.payType }).reason;
            await invoice.save();
        }
    } catch (e) {
        invoice.fiscalError = e instanceof Error ? e.message.slice(0, 300) : "Чек не вдалося пробити";
        await invoice.save();
    }

    return { invoice, totals, fiscal };
}

/** Возврат по чеку: кредит-нота + возврат товара на склад + чек возврата (если чек продажи был). */
export async function retailReturn(org: string, invoiceId: string, input: { warehouse?: string; by?: string } = {}) {
    const source = await Invoice.findOne({ _id: invoiceId, org, kind: "invoice" });
    if (!source) throw new ProviderError("Чек не знайдено");
    if (source.status !== "paid") throw new ProviderError("Повернення роблять за оплаченим чеком");

    const settings = await financeSettings(org);
    const items = (source.items as Array<{ description: string; qty: number; unitPrice: number; taxRate: number; product?: string }>).map((it) => ({
        description: it.description,
        qty: -Math.abs(Number(it.qty) || 0),
        unitPrice: Math.abs(Number(it.unitPrice) || 0),
        taxRate: it.taxRate,
        product: it.product,
    }));
    const prefix = await numberPrefix(org, "credit_note", settings.creditNotePrefix || "КН");
    const number = await nextNumber(org, prefix);
    const credit = await Invoice.create({
        org,
        number,
        kind: "credit_note",
        creditFor: source._id,
        customerName: source.customerName,
        items,
        currency: source.currency,
        smallBusinessNote: source.smallBusinessNote,
        issueDate: new Date().toISOString().slice(0, 10),
        status: "sent",
        sentAt: new Date(),
        notes: `Повернення за чеком ${source.number}`,
    });

    // Товар возвращается на склад движением «повернення»
    for (const it of items) {
        if (!it.product) continue;
        const product = await Product.findOne({ _id: it.product, org }).select("type purchasePrice");
        if (!product || product.type !== "good") continue;
        await moveStock(org, String(it.product), Math.abs(it.qty), "return", {
            warehouse: input.warehouse ?? null,
            unitCost: Number(product.purchasePrice) || 0,
            note: `Повернення за чеком ${source.number}`,
            by: input.by ?? "",
        });
    }

    // Чек возврата: ссылается на чек продажи — без него возврат не сойдётся в кассе
    if (source.fiscalId) {
        try {
            const doc = await findFiscal(org);
            if (doc && fiscalConfig(doc).auto) {
                const receipt = await fiscalizeReturn(org, source, Math.abs(computeTotals(source.items as never).gross), (source.fiscalPayType as "CASH" | "CARD") || "CARD");
                credit.fiscalReturnId = receipt.receiptId;
                credit.fiscalReturnCode = receipt.fiscalCode;
                credit.fiscalReturnAt = new Date();
                credit.fiscalReturnError = "";
                await credit.save();
            } else {
                credit.fiscalReturnError = "Чек повернення не пробито — автофіскалізацію вимкнено";
                await credit.save();
            }
        } catch (e) {
            credit.fiscalReturnError = e instanceof Error ? e.message.slice(0, 300) : "Чек повернення не вдалося пробити";
            await credit.save();
        }
    }

    return { credit };
}

/** Последние розничные чеки: для списка возвратов на кассе. */
export const recentRetail = (org: string) =>
    Invoice.find({ org, kind: "invoice", paidVia: { $in: ["cash", "card"] }, status: "paid" }).sort({ paidAt: -1 }).limit(30);
