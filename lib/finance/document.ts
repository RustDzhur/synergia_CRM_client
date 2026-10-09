import { isTemplate, renderDocumentPdf, PdfSettings, PdfParty, PdfLineItem } from "./pdf";
import { financeSettings } from "./settings";
import { marketOf } from "./market";
import { activeTemplate, applyTemplate, templateAllowsRate } from "./documents/store";
import { contractDate, contractValueText, defaultContractText, fillContractText } from "./contractText";
import { firmRate } from "./rates";
import { validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { UzProfile } from "@/lib/validation/uz";

// Общие сборщики PDF для всех финансовых документов: и маршруты скачивания (/api/<kind>/<id>/pdf),
// и отправка клиенту (lib/finance/send.ts) берут готовый буфер отсюда, чтобы файл в письме и файл
// из кнопки «Скачать» были одним и тем же документом.

export const LOCALES = ["en", "de", "ua", "uz", "ru"] as const;
export const pdfLocale = (v: unknown) => (typeof v === "string" && (LOCALES as readonly string[]).includes(v) ? v : "en");

// Курс к гривне для документов в валюте: у украинской фирмы в счёте печатается и сумма в ₴.
async function uahRateFor(org: string, currency: string, stored?: { base?: number; margin?: number; value?: number; at?: string } | null) {
    // Национальная валюта рынка: у украинской фирмы — гривна (курс НБУ), у узбекской — сум (курс ЦБ Узбекистана)
    const home = marketOf((await financeSettings(org)).country) === "UZ" ? "UZS" : "UAH";
    if (!currency || currency.toUpperCase() === home) return null;
    // Снимок курса на дате документа важнее живого
    if (stored?.value) return { rate: stored.value, base: stored.base ?? 0, margin: stored.margin ?? 0, at: stored.at ?? "", home };
    try {
        return await firmRate(org, currency, stored?.at || undefined);
    } catch {
        return null;
    }
}

export const pdfTemplate = (v: unknown) => (isTemplate(v) ? v : undefined);

export const toPdfSettings = (s: any): PdfSettings => {
    const ua = marketOf(s?.country) === "UA";
    const uzMarket = marketOf(s?.country) === "UZ";
    const uz = (uzMarket && s?.uz && typeof s.uz === "object" ? s.uz : {}) as Partial<UzProfile>;
    // Реквизиты узбекской фирмы: STIR/JShShIR, код плательщика QQS, банк + MFO, расчётный счёт, руководитель
    const uzIds = [uz.inn ? `STIR/ИНН ${uz.inn}` : "", uz.pinfl ? `JShShIR/ПИНФЛ ${uz.pinfl}` : ""].filter(Boolean).join(" · ");
    const uzBankParts = [uz.bank ?? "", uz.mfo ? `MFO/МФО ${uz.mfo}` : ""].filter(Boolean).join(" · ");
    const uaIds = [s?.uaEdrpou ? `ЄДРПОУ ${s.uaEdrpou}` : "", s?.uaIpn ? `ІПН ${s.uaIpn}` : ""].filter(Boolean).join(" · ");
    const uaBankParts = [s?.uaBank ? `${s.uaBank}` : "", s?.uaMfo ? `МФО ${s.uaMfo}` : ""].filter(Boolean).join(" · ");
    return {
        legalName: s?.legalName ?? "",
        address: s?.address ?? "",
        taxId: ua ? uaIds || (s?.taxId ?? "") : uzMarket ? uzIds || (s?.taxId ?? "") : (s?.taxId ?? ""),
        vatId: uzMarket ? (uz.vatCode ? `QQS/НДС ${uz.vatCode}` : (s?.vatId ?? "")) : (s?.vatId ?? ""),
        iban: ua ? s?.uaIban || (s?.iban ?? "") : uzMarket ? uz.account || (s?.iban ?? "") : (s?.iban ?? ""),
        bic: ua ? s?.uaMfo || (s?.bic ?? "") : uzMarket ? uz.mfo || (s?.bic ?? "") : (s?.bic ?? ""),
        bank: ua ? s?.uaBank || "" : uzMarket ? uz.bank || "" : "",
        paymentTermsDays: Number(s?.paymentTermsDays) || 0,
        phone: s?.phone ?? "",
        email: s?.email ?? "",
        website: s?.website ?? "",
        registerNumber: ua ? (s?.uaVatCertificate ? `Свідоцтво ПДВ ${s.uaVatCertificate}` : uaBankParts) : uzMarket ? uzBankParts || (s?.registerNumber ?? "") : (s?.registerNumber ?? ""),
        managingDirector: uzMarket ? uz.director || (s?.managingDirector ?? "") : (s?.managingDirector ?? ""),
        uaSigner: ua && (s?.uaSignerName || s?.uaSignerPosition) ? { name: s?.uaSignerName ?? "", position: s?.uaSignerPosition ?? "" } : undefined,
        signature: ua ? s?.uaSignature || "" : "",
        seal: ua ? s?.uaSeal || "" : "",
        logo: s?.logo ?? "",
        footerText: s?.footerText ?? "",
        template: isTemplate(s?.template) ? s.template : undefined,
        paymentQr: s?.paymentQr !== false,
        country: s?.country ?? "",
    };
};

export const toPdfItems = (items: any): PdfLineItem[] =>
    (Array.isArray(items) ? items : []).map((it: any) => ({
        description: String(it?.description ?? ""),
        qty: Number(it?.qty) || 0,
        unitPrice: Number(it?.unitPrice) || 0,
        taxRate: Number(it?.taxRate) || 0,
        ...(typeof it?.unit === "string" && it.unit ? { unit: it.unit } : {}),
    }));

// Плательщик для бумаг, у которых нет собственного снимка клиента (предложение, заказ, договор): адрес и
// налоговый номер берём из связанной фирмы клиента, имя — из самого документа, иначе из контакта/фирмы.
export async function customerParty(org: string, doc: { customerName?: string; contact?: any; company?: any }): Promise<PdfParty> {
    const party: PdfParty = { name: String(doc.customerName ?? "").trim() };
    if (doc.company && validId(String(doc.company))) {
        const c = await prisma.company.findFirst({ where: { id: String(doc.company), owner: org } });
        if (c) {
            if (!party.name) party.name = c.name;
            party.address = c.address || "";
            party.taxId = c.code || "";
            party.email = c.email || "";
            party.person = c.authorisedPerson || "";
        }
    }
    // Контакт даёт телефон, e-mail и контактное лицо; имя — если ещё не задано (для договоров важно: {{customerPhone}} и т.п.)
    if (doc.contact && validId(String(doc.contact))) {
        const c = await prisma.contact.findFirst({ where: { id: String(doc.contact), owner: org }, select: { name: true, phone: true, email: true } });
        if (c) {
            if (!party.name) party.name = c.name;
            party.phone = c.phone ?? "";
            if (!party.email) party.email = c.email ?? "";
            if (!party.person) party.person = c.name;
        }
    }
    return party;
}

// Счёт и кредит-нота: стороны и позиции — снимок внутри документа, поэтому дополнительных запросов нет
export async function invoicePdfBuffer(org: string, inv: any, locale: string, template?: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    const tpl = await activeTemplate(org, inv.kind === "credit_note" ? "credit_note" : "invoice");
    let creditForNumber: string | undefined;
    if (inv.kind === "credit_note" && inv.creditFor) {
        const orig = await prisma.invoice.findFirst({ where: { id: String(inv.creditFor), org }, select: { number: true } });
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
            supplyDate: order.deliveryDate || new Date().toISOString().slice(0, 10),
            notes: order.notes,
            template: template ?? pdfTemplate(order.template),
        },
        applyTemplate(toPdfSettings(settings), tpl, pdfLocale(locale)),
        pdfLocale(locale)
    );
}

// Акт виконаних робіт: как счёт по составу, но со своими подписями сторон и отдельной нумерацией
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
    const rawBody = String(c.body ?? "").trim() || String(settings.contractTemplate ?? "").trim() || defaultContractText(market);
    const body = fillContractText(rawBody, {
        ...((c.fields && typeof c.fields === "object" ? c.fields : {}) as Record<string, string>),
        number: c.number,
        date: contractDate(new Date().toISOString().slice(0, 10)),
        firm: settings.legalName ?? "",
        firmAddress: settings.address ?? "",
        firmTaxId: settings.taxId ?? "",
        signer: settings.uaSignerName || settings.managingDirector || "",
        customer: party.name,
        customerAddress: party.address ?? "",
        customerTaxId: party.taxId ?? "",
        customerPhone: party.phone ?? "",
        customerEmail: party.email ?? "",
        customerPerson: party.person ?? "",
        value: contractValueText(Number(c.value) || 0, tpl?.currency || c.currency),
        start: contractDate(c.startDate),
        end: contractDate(c.endDate),
        firmPhone: settings.phone ?? "",
        firmEmail: settings.email ?? "",
        firmWebsite: settings.website ?? "",
        firmBank: settings.uaBank || "",
        firmIban: settings.uaIban || settings.iban || "",
        today: contractDate(new Date().toISOString().slice(0, 10)),
    });
    return renderDocumentPdf(
        {
            kind: "contract",
            number: c.number,
            customer: party,
            items: [],
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

// Упаковочный лист (ВЭД): позиции заказа с кодами УКТ ЗЕД/HS, весом и страной происхождения.
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

// Строки упаковочного листа: у каждой — код УКТ ЗЕД, вес единицы и страна происхождения отдельными полями.
async function toPackingItems(org: string, items: any[]): Promise<PdfLineItem[]> {
    const ids = items.map((it) => it?.product).filter(Boolean);
    const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids }, org }, select: { id: true, hsCode: true, weightKg: true, originCountry: true } }) : [];
    const info = new Map(products.map((p) => [p.id, p]));
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
