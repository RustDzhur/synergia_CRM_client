import { isTemplate, renderDocumentPdf, PdfSettings, PdfParty, PdfLineItem } from "./pdf";
import { financeSettings } from "./settings";
import { marketOf } from "./market";
import { activeTemplate, applyTemplate, templateAllowsRate } from "./documents/store";
import { contractDate, contractValueText, defaultContractText, fillContractText } from "./contractText";
import { firmRate } from "./rates";
import { isValidObjectId } from "mongoose";
import Contact from "@/models/Contact";
import Company from "@/models/Company";
import Invoice from "@/models/Invoice";
import Product from "@/models/Product";

// Общие сборщики PDF для всех финансовых документов: и маршруты скачивания (/api/<kind>/<id>/pdf),
// и отправка клиенту (lib/finance/send.ts) берут готовый буфер отсюда, чтобы файл в письме и файл
// из кнопки «Скачать» были одним и тем же документом.

export const LOCALES = ["en", "de", "ua"] as const;
export const pdfLocale = (v: unknown) => (typeof v === "string" && (LOCALES as readonly string[]).includes(v) ? v : "en");

// Шаблон оформления: явный выбор в запросе (?template=modern) важнее шаблона самого документа, а тот —
// умолчания из настроений бухгалтерии. Неизвестное значение молча игнорируется, рендер берёт classic.

// Курс к гривне для документов в валюте: у украинской фирмы в счёте печатается и сумма в ₴.
// Курс берём из lib/finance/rates.ts (НБУ плюс наценка фирмы) и только когда он вообще нужен —
// для гривневого документа или для фирмы без курса поле остаётся пустым.
async function uahRateFor(org: string, currency: string, stored?: { base?: number; margin?: number; value?: number; at?: string }) {
    if (!currency || currency.toUpperCase() === "UAH") return null;
    // Снимок курса на дате документа важнее живого: перепечатка счёта через месяц должна показывать
    // ту же сумму в ₴, что и в день выставления (ТЗ §8.2, находка A15)
    if (stored?.value) return { rate: stored.value, base: stored.base ?? 0, margin: stored.margin ?? 0, at: stored.at ?? "" };
    try {
        return await firmRate(org, currency);
    } catch {
        return null;
    }
}

export const pdfTemplate = (v: unknown) => (isTemplate(v) ? v : undefined);

export const toPdfSettings = (s: any): PdfSettings => {
    const ua = marketOf(s?.country) === "UA";
    // Реквизиты украинской фирмы печатаются со своими подписями: «ЄДРПОУ 12345678», «ІПН …»,
    // банк и МФО — вместо немецких налогового номера и BIC. Подписи (названия строк) приходят
    // из UA_LABELS, поэтому здесь собираем строки целиком.
    const uaIds = [s?.uaEdrpou ? `ЄДРПОУ ${s.uaEdrpou}` : "", s?.uaIpn ? `ІПН ${s.uaIpn}` : ""].filter(Boolean).join(" · ");
    const uaBankParts = [s?.uaBank ? `${s.uaBank}` : "", s?.uaMfo ? `МФО ${s.uaMfo}` : ""].filter(Boolean).join(" · ");
    return {
        legalName: s?.legalName ?? "",
        address: s?.address ?? "",
        taxId: ua ? uaIds || (s?.taxId ?? "") : (s?.taxId ?? ""),
        // Налоговый номер и USt-IdNr. — разные строки: на немецком счёте обычно указывают оба
        vatId: s?.vatId ?? "",
        iban: ua ? s?.uaIban || (s?.iban ?? "") : (s?.iban ?? ""),
        bic: ua ? s?.uaMfo || (s?.bic ?? "") : (s?.bic ?? ""),
        bank: ua ? s?.uaBank || "" : "",
        paymentTermsDays: Number(s?.paymentTermsDays) || 0,
        phone: s?.phone ?? "",
        email: s?.email ?? "",
        website: s?.website ?? "",
        registerNumber: ua ? (s?.uaVatCertificate ? `Свідоцтво ПДВ ${s.uaVatCertificate}` : uaBankParts) : (s?.registerNumber ?? ""),
        managingDirector: s?.managingDirector ?? "",
        uaSigner: ua && (s?.uaSignerName || s?.uaSignerPosition) ? { name: s?.uaSignerName ?? "", position: s?.uaSignerPosition ?? "" } : undefined,
        signature: ua ? s?.uaSignature || "" : "",
        seal: ua ? s?.uaSeal || "" : "",
        logo: s?.logo ?? "",
        footerText: s?.footerText ?? "",
        template: isTemplate(s?.template) ? s.template : undefined,
        paymentQr: s?.paymentQr !== false, // по умолчанию код на оплату печатается
        country: s?.country ?? "", // UA — документы называются по-украински (см. UA_LABELS в pdf.ts)
    };
};

export const toPdfItems = (items: any): PdfLineItem[] =>
    (Array.isArray(items) ? items : []).map((it: any) => ({
        description: String(it?.description ?? ""),
        qty: Number(it?.qty) || 0,
        unitPrice: Number(it?.unitPrice) || 0,
        taxRate: Number(it?.taxRate) || 0,
    }));

// Плательщик для бумаг, у которых нет собственного снимка клиента (предложение, заказ, договор): адрес и
// налоговый номер берём из связанной фирмы клиента, имя — из самого документа, иначе из контакта/фирмы.
// Ссылки проверяем на формат ObjectId: у старых документов в contact/company могла остаться произвольная
// строка — раньше из-за неё весь PDF падал с ошибкой приведения типа (CastError), и «старые пропозиции
// не скачиваются» было именно этим.
export async function customerParty(org: string, doc: { customerName?: string; contact?: any; company?: any }): Promise<PdfParty> {
    const party: PdfParty = { name: String(doc.customerName ?? "").trim() };
    if (doc.company && isValidObjectId(doc.company)) {
        const c = await Company.findOne({ _id: doc.company, owner: org });
        if (c) {
            if (!party.name) party.name = c.name;
            party.address = c.address || "";
            party.taxId = c.code || "";
        }
    }
    if (!party.name && doc.contact && isValidObjectId(doc.contact)) {
        const c = await Contact.findOne({ _id: doc.contact, owner: org }).select("name");
        if (c) party.name = c.name;
    }
    return party;
}

// Счёт и кредит-нота: стороны и позиции — снимок внутри документа, поэтому дополнительных запросов нет
export async function invoicePdfBuffer(org: string, inv: any, locale: string, template?: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    // Активный бланк вида: его тексты (условия оплаты, примечания), блоки и подпись/печать
    const tpl = await activeTemplate(org, inv.kind === "credit_note" ? "credit_note" : "invoice");
    let creditForNumber: string | undefined;
    if (inv.kind === "credit_note" && inv.creditFor) {
        const orig = await Invoice.findOne({ _id: inv.creditFor, org }).select("number");
        creditForNumber = orig?.number;
    }
    return renderDocumentPdf(
        {
            kind: inv.kind === "credit_note" ? "credit_note" : "invoice",
            number: inv.number,
            creditForNumber,
            customer: { name: inv.customerName, address: inv.customerAddress, taxId: inv.customerTaxId },
            items: toPdfItems(inv.items),
            currency: tpl?.currency || inv.currency,
            uahRate: templateAllowsRate(tpl) ? await uahRateFor(org, inv.currency, inv.rate) : null,
            smallBusinessNote: !!inv.smallBusinessNote,
            issueDate: inv.issueDate,
            supplyDate: inv.supplyDate,
            supplyPeriodFrom: inv.supplyPeriodFrom,
            supplyPeriodTo: inv.supplyPeriodTo,
            dueDate: inv.dueDate,
            // Ступень манаведения и начисленный сбор попадают и в заголовок документа, и в сумму к оплате
            dunningLevel: Number(inv.dunningLevel) || 0,
            dunningFee: Number(inv.dunningFee) || 0,
            dunningNewDue: Number(inv.dunningLevel) > 0 ? (inv.dunningLog?.length ? String(inv.dunningLog[inv.dunningLog.length - 1].dueDate || "") : "") || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) : undefined,
            notes: inv.notes,
            template: template ?? pdfTemplate(inv.template),
        },
        applyTemplate(toPdfSettings(settings), tpl, pdfLocale(locale)),
        pdfLocale(locale)
    );
}

export async function quotePdfBuffer(org: string, q: any, locale: string, template?: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    const tpl = await activeTemplate(org, "quote");
    return renderDocumentPdf(
        {
            kind: "quote",
            number: q.number,
            customer: await customerParty(org, q),
            items: toPdfItems(q.items),
            currency: tpl?.currency || q.currency,
            uahRate: templateAllowsRate(tpl) ? await uahRateFor(org, q.currency, q.rate) : null,
            issueDate: q.issueDate,
            validUntil: q.validUntil,
            notes: q.notes,
            template: template ?? pdfTemplate(q.template),
        },
        applyTemplate(toPdfSettings(settings), tpl, pdfLocale(locale)),
        pdfLocale(locale)
    );
}

export async function orderPdfBuffer(org: string, o: any, locale: string, template?: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    const tpl = await activeTemplate(org, "order");
    return renderDocumentPdf(
        {
            kind: "order",
            number: o.number,
            customer: await customerParty(org, o),
            items: toPdfItems(o.items),
            currency: tpl?.currency || o.currency,
            uahRate: templateAllowsRate(tpl) ? await uahRateFor(org, o.currency, o.rate) : null,
            issueDate: o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : "",
            notes: o.notes,
            template: template ?? pdfTemplate(o.template),
        },
        applyTemplate(toPdfSettings(settings), tpl, pdfLocale(locale)),
        pdfLocale(locale)
    );
}

// Накладная (Lieferschein): выписывается по заказу, цен не содержит — только что и сколько передано.
// Номер присваивается один раз при первой выписке (см. app/api/orders/[id]/delivery-note/route.ts),
// поэтому повторная печать даёт тот же документ, а не новый номер.
export async function deliveryNotePdfBuffer(org: string, order: any, locale: string, template?: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    const tpl = await activeTemplate(org, "delivery_note");
    return renderDocumentPdf(
        {
            kind: "delivery_note",
            number: order.deliveryNoteNumber || order.number,
            orderNumber: order.number,
            customer: await customerParty(org, order),
            items: toPdfItems(order.items),
            currency: tpl?.currency || order.currency,
            uahRate: templateAllowsRate(tpl) ? await uahRateFor(org, order.currency, order.rate) : null,
            // Дата поставки: если её не указали, берём сегодняшнюю — накладная всегда про состоявшуюся передачу
            supplyDate: order.deliveryDate || new Date().toISOString().slice(0, 10),
            notes: order.notes,
            template: template ?? pdfTemplate(order.template),
        },
        applyTemplate(toPdfSettings(settings), tpl, pdfLocale(locale)),
        pdfLocale(locale)
    );
}

// Акт виконаних робіт: как счёт по составу (позиции и суммы), но со своими подписями сторон
// и отдельной нумерацией — в украинском учёте это самостоятельный документ
export async function actPdfBuffer(org: string, order: any, locale: string, template?: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    const tpl = await activeTemplate(org, "act");
    return renderDocumentPdf(
        {
            kind: "act",
            number: order.actNumber || order.number,
            orderNumber: order.number,
            customer: await customerParty(org, order),
            items: toPdfItems(order.items),
            currency: tpl?.currency || order.currency,
            uahRate: templateAllowsRate(tpl) ? await uahRateFor(org, order.currency, order.rate) : null,
            issueDate: order.actDate || new Date().toISOString().slice(0, 10),
            notes: order.notes,
            template: template ?? pdfTemplate(order.template),
        },
        applyTemplate(toPdfSettings(settings), tpl, pdfLocale(locale)),
        pdfLocale(locale)
    );
}

export async function contractPdfBuffer(org: string, c: any, locale: string, template?: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    const tpl = await activeTemplate(org, "contract");
    const party = await customerParty(org, c);
    const market = marketOf(settings.country);
    // Текст договора: свой у документа, иначе типовой фирмы из настроек, иначе встроенный типовой.
    // Значения подставляются в {{…}} — без этого PDF оставался пустым листом с одной строкой суммы
    const rawBody = String(c.body ?? "").trim() || String(settings.contractTemplate ?? "").trim() || defaultContractText(market);
    const body = fillContractText(rawBody, {
        number: c.number,
        date: contractDate(new Date().toISOString().slice(0, 10)),
        firm: settings.legalName ?? "",
        firmAddress: settings.address ?? "",
        firmTaxId: settings.taxId ?? "",
        signer: settings.uaSignerName || settings.managingDirector || "",
        customer: party.name,
        customerAddress: party.address ?? "",
        customerTaxId: party.taxId ?? "",
        value: contractValueText(Number(c.value) || 0, tpl?.currency || c.currency),
        start: contractDate(c.startDate),
        end: contractDate(c.endDate),
    });
    return renderDocumentPdf(
        {
            kind: "contract",
            number: c.number,
            customer: party,
            items: [], // у договора позиций нет: печатается сумма договора, текст и подписи
            currency: tpl?.currency || c.currency,
            uahRate: templateAllowsRate(tpl) ? await uahRateFor(org, c.currency) : null,
            value: c.value,
            startDate: c.startDate,
            endDate: c.endDate,
            body,
            notes: c.notes,
            template: template ?? pdfTemplate(c.template),
        },
        applyTemplate(toPdfSettings(settings), tpl, pdfLocale(locale)),
        pdfLocale(locale)
    );
}

// Упаковочный лист (ВЭД): позиции заказа с кодами УКТ ЗЕД/HS, весом и страной происхождения —
// данные для брокера и таможни. Цен в нём нет: это документ о грузе, а не о деньгах.
// У листа свой номер (как у накладной и акта) и свой бланк: раньше он брал бланк и номер накладной
// и отличался от неё только заголовком — фирма видела два одинаковых документа.
export async function packingListPdfBuffer(org: string, order: any, locale: string, template?: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    const tpl = (await activeTemplate(org, "packing_list")) ?? (await activeTemplate(org, "delivery_note"));
    const items = await toPackingItems(org, order.items ?? []);
    return renderDocumentPdf(
        {
            kind: "packing_list",
            number: order.packingNumber || order.number,
            orderNumber: order.number,
            customer: await customerParty(org, order),
            items,
            currency: order.currency,
            uahRate: null,
            supplyDate: order.packingDate || order.deliveryDate || new Date().toISOString().slice(0, 10),
            notes: order.notes,
            template: template ?? pdfTemplate(order.template),
        },
        applyTemplate(toPdfSettings(settings), tpl, pdfLocale(locale)),
        pdfLocale(locale)
    );
}

// Строки упаковочного листа: у каждой — код УКТ ЗЕД, вес единицы и страна происхождения отдельными
// полями. Раньше всё сшивалось в одно описание, и при пустых карточках товара лист выглядел копией
// накладной; теперь колонки печатает itemsTable, а «—» показывает, чего не хватает в карточке товара.
async function toPackingItems(org: string, items: any[]): Promise<PdfLineItem[]> {
    const ids = items.map((it) => it?.product).filter(Boolean);
    const products = ids.length ? await Product.find({ _id: { $in: ids }, org }).select("hsCode weightKg originCountry") : [];
    const info = new Map(products.map((p) => [String(p._id), p]));
    return (items ?? []).map((it) => {
        const p = info.get(String(it?.product ?? ""));
        return {
            description: String(it?.description ?? ""),
            qty: Number(it?.qty) || 0,
            unitPrice: 0,
            taxRate: 0,
            hsCode: p?.hsCode ? String(p.hsCode) : "",
            unitWeightKg: Number(p?.weightKg) || 0,
            originCountry: p?.originCountry ? String(p.originCountry) : "",
        };
    });
}
