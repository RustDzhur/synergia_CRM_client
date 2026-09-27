import { renderDocumentPdf, PdfSettings, PdfParty, PdfLineItem } from "./pdf";
import { financeSettings } from "./settings";
import Contact from "@/models/Contact";
import Company from "@/models/Company";
import Invoice from "@/models/Invoice";

// Общие сборщики PDF для всех финансовых документов: и маршруты скачивания (/api/<kind>/<id>/pdf),
// и отправка клиенту (lib/finance/send.ts) берут готовый буфер отсюда, чтобы файл в письме и файл
// из кнопки «Скачать» были одним и тем же документом.

export const LOCALES = ["en", "de", "ua"] as const;
export const pdfLocale = (v: unknown) => (typeof v === "string" && (LOCALES as readonly string[]).includes(v) ? v : "en");

export const toPdfSettings = (s: any): PdfSettings => ({
    legalName: s?.legalName ?? "",
    address: s?.address ?? "",
    taxId: s?.taxId ?? "",
    iban: s?.iban ?? "",
    bic: s?.bic ?? "",
    paymentTermsDays: Number(s?.paymentTermsDays) || 0,
});

export const toPdfItems = (items: any): PdfLineItem[] =>
    (Array.isArray(items) ? items : []).map((it: any) => ({
        description: String(it?.description ?? ""),
        qty: Number(it?.qty) || 0,
        unitPrice: Number(it?.unitPrice) || 0,
        taxRate: Number(it?.taxRate) || 0,
    }));

// Плательщик для бумаг, у которых нет собственного снимка клиента (предложение, заказ, договор): адрес и
// налоговый номер берём из связанной фирмы клиента, имя — из самого документа, иначе из контакта/фирмы.
export async function customerParty(org: string, doc: { customerName?: string; contact?: any; company?: any }): Promise<PdfParty> {
    const party: PdfParty = { name: String(doc.customerName ?? "").trim() };
    if (doc.company) {
        const c = await Company.findOne({ _id: doc.company, owner: org });
        if (c) {
            if (!party.name) party.name = c.name;
            party.address = c.address || "";
            party.taxId = c.code || "";
        }
    }
    if (!party.name && doc.contact) {
        const c = await Contact.findOne({ _id: doc.contact, owner: org }).select("name");
        if (c) party.name = c.name;
    }
    return party;
}

// Счёт и кредит-нота: стороны и позиции — снимок внутри документа, поэтому дополнительных запросов нет
export async function invoicePdfBuffer(org: string, inv: any, locale: string): Promise<Buffer> {
    const settings = await financeSettings(org);
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
            currency: inv.currency,
            smallBusinessNote: !!inv.smallBusinessNote,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            notes: inv.notes,
        },
        toPdfSettings(settings),
        pdfLocale(locale)
    );
}

export async function quotePdfBuffer(org: string, q: any, locale: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    return renderDocumentPdf(
        {
            kind: "quote",
            number: q.number,
            customer: await customerParty(org, q),
            items: toPdfItems(q.items),
            currency: q.currency,
            issueDate: q.issueDate,
            validUntil: q.validUntil,
            notes: q.notes,
        },
        toPdfSettings(settings),
        pdfLocale(locale)
    );
}

export async function orderPdfBuffer(org: string, o: any, locale: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    return renderDocumentPdf(
        {
            kind: "order",
            number: o.number,
            customer: await customerParty(org, o),
            items: toPdfItems(o.items),
            currency: o.currency,
            issueDate: o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : "",
            notes: o.notes,
        },
        toPdfSettings(settings),
        pdfLocale(locale)
    );
}

export async function contractPdfBuffer(org: string, c: any, locale: string): Promise<Buffer> {
    const settings = await financeSettings(org);
    return renderDocumentPdf(
        {
            kind: "contract",
            number: c.number,
            customer: await customerParty(org, c),
            items: [], // у договора позиций нет: печатается сумма договора и срок
            currency: c.currency,
            value: c.value,
            startDate: c.startDate,
            endDate: c.endDate,
            notes: c.notes,
        },
        toPdfSettings(settings),
        pdfLocale(locale)
    );
}
