import PDFDocument from "pdfkit";
import notoSansUrl from "@/assets/fonts/NotoSans-Regular.ttf";
import { isTemplate, renderLayout } from "./layouts";
export { TEMPLATES, TEMPLATE_IDS, isTemplate, templateDef } from "./templates";
export type { TemplateDef, TemplateVariant } from "./templates";

// Данные шрифта из data-URI — см. scripts/ttf-data-uri-loader.js и правило webpack в next.config.js. Шрифт встроен
// в бандл, поэтому рендер PDF не зависит от файлов node_modules: иначе pdfkit для своей встроенной гарнитуры
// Helvetica лениво грузит node_modules/pdfkit/js/standard-fonts/*, которых в функциях на Vercel нет, и генерация
// падала с "Cannot find module '#standard-fonts/Helvetica'". Noto Sans заодно покрывает кириллицу и знаки €/₴/№,
// которых у Helvetica нет.
const DOC_FONT = Buffer.from(notoSansUrl.slice(notoSansUrl.indexOf(",") + 1), "base64");

// Какие бумаги рисует этот файл. Счёт и кредит-нота жили здесь и раньше, предложение/заказ/договор добавлены,
// чтобы каждый финансовый документ можно было и скачать, и отправить клиенту одним и тем же рендером.
export type DocKind = "invoice" | "credit_note" | "quote" | "order" | "contract";

// Небольшой словарь подписей PDF на трёх языках интерфейса — сам PDFKit не знает про next-intl (это не React-рендер),
// поэтому подписи держим здесь же, минимальным набором, без обращения к messages/*.json.
const LABELS: Record<string, Record<string, string>> = {
    en: {
        invoice: "Invoice", credit_note: "Credit Note", quote: "Quotation", order: "Order confirmation", contract: "Contract",
        creditFor: "Credit note for invoice",
        billTo: "Bill to", issueDate: "Issue date", dueDate: "Due date", date: "Date", orderDate: "Order date",
        validUntil: "Valid until", startDate: "Start date", endDate: "End date", contractValue: "Contract value",
        description: "Description", qty: "Qty", unitPrice: "Unit price", tax: "Tax", lineTotal: "Total",
        net: "Net", taxTotal: "Tax", gross: "Total",
        smallBusiness: "No VAT is charged pursuant to the small business regulation (§19 UStG or equivalent).",
        paymentTerms: "Payment terms", days: "days", iban: "IBAN", bic: "BIC", notes: "Notes",
        seller: "Seller", payByQr: "Pay by QR code", qrHint: "Scan with your banking app",
    },
    de: {
        invoice: "Rechnung", credit_note: "Gutschrift", quote: "Angebot", order: "Auftragsbestätigung", contract: "Vertrag",
        creditFor: "Gutschrift zur Rechnung",
        billTo: "Rechnungsempfänger", issueDate: "Rechnungsdatum", dueDate: "Fällig am", date: "Datum", orderDate: "Bestelldatum",
        validUntil: "Gültig bis", startDate: "Beginn", endDate: "Ende", contractValue: "Vertragswert",
        description: "Beschreibung", qty: "Menge", unitPrice: "Einzelpreis", tax: "USt.", lineTotal: "Summe",
        net: "Netto", taxTotal: "USt.", gross: "Gesamt",
        smallBusiness: "Gemäß §19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.",
        paymentTerms: "Zahlungsziel", days: "Tage", iban: "IBAN", bic: "BIC", notes: "Anmerkungen",
        seller: "Verkäufer", payByQr: "Zahlung per QR-Code", qrHint: "Mit der Banking-App scannen",
    },
    ua: {
        invoice: "Рахунок", credit_note: "Кредит-нота", quote: "Комерційна пропозиція", order: "Підтвердження замовлення", contract: "Договір",
        creditFor: "Кредит-нота до рахунку",
        billTo: "Платник", issueDate: "Дата виставлення", dueDate: "Термін оплати", date: "Дата", orderDate: "Дата замовлення",
        validUntil: "Дійсний до", startDate: "Початок", endDate: "Завершення", contractValue: "Сума договору",
        description: "Опис", qty: "К-сть", unitPrice: "Ціна", tax: "ПДВ", lineTotal: "Сума",
        net: "Нетто", taxTotal: "ПДВ", gross: "Разом",
        smallBusiness: "ПДВ не нараховується згідно з режимом для малого підприємця (§19 UStG або аналог).",
        paymentTerms: "Термін оплати", days: "днів", iban: "IBAN", bic: "BIC", notes: "Примітки",
        seller: "Постачальник", payByQr: "Оплата за QR-кодом", qrHint: "Скануйте у банківському застосунку",
    },
};

export interface PdfLineItem { description: string; qty: number; unitPrice: number; taxRate: number }
export interface PdfParty { name: string; address?: string; taxId?: string }
export interface PdfDocumentData {
    kind: DocKind;
    number: string;
    creditForNumber?: string; // для kind "credit_note" — номер исправляемого счёта
    customer: PdfParty;
    items: PdfLineItem[]; // у договора позиций нет — вместо таблицы печатается сумма договора
    currency: string;
    smallBusinessNote?: boolean;
    issueDate?: string;
    dueDate?: string; // счёт
    validUntil?: string; // предложение
    startDate?: string; // договор
    endDate?: string;
    value?: number; // договор: сумма договора
    notes?: string;
    template?: string; // id шаблона оформления; если не задан — берётся умолчание из настроек бухгалтерии
}
export interface PdfSettings {
    legalName: string; address: string; taxId: string; iban: string; bic: string; paymentTermsDays: number;
    template?: string; // шаблон оформления по умолчанию для новых документов
    paymentQr?: boolean; // печатать ли QR-код на оплату в счетах
}

// Рендерит PDF финансового документа в буфер — вызывается из app/api/*/[id]/pdf/route.ts (скачивание и печать)
// и из lib/finance/send.ts (вложение к письму клиенту). Сам рендер (десять шаблонов оформления) живёт в
// lib/finance/layouts.ts; здесь остаётся только создание документа с встроенным шрифтом и выбор языка подписей.
export function renderDocumentPdf(d: PdfDocumentData, settings: PdfSettings, locale = "en"): Promise<Buffer> {
    const L = LABELS[locale] ?? LABELS.en;
    return new Promise((resolve, reject) => {
        // pdfkit принимает буфер шрифта в options.font (разбирает его fontkit), но в его типах там только имя шрифта
        const doc = new PDFDocument({ size: "A4", margin: 50, font: DOC_FONT as unknown as string });
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        renderLayout(doc, d, settings, L);

        doc.end();
    });
}

// Обратная совместимость: счета и кредит-ноты рисовались этой функцией до того, как рендер стал общим.
// У счёта стороны — снимок на момент выставления (customerName/customerAddress/customerTaxId), а не ссылки.
export function renderInvoicePdf(
    inv: {
        number: string; kind: "invoice" | "credit_note"; creditForNumber?: string;
        customerName: string; customerAddress: string; customerTaxId: string;
        items: PdfLineItem[]; currency: string; smallBusinessNote: boolean; issueDate: string; dueDate: string; notes: string;
    },
    settings: PdfSettings,
    locale = "en"
): Promise<Buffer> {
    return renderDocumentPdf(
        {
            kind: inv.kind,
            number: inv.number,
            creditForNumber: inv.creditForNumber,
            customer: { name: inv.customerName, address: inv.customerAddress, taxId: inv.customerTaxId },
            items: inv.items ?? [],
            currency: inv.currency,
            smallBusinessNote: !!inv.smallBusinessNote,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            notes: inv.notes,
        },
        settings,
        locale
    );
}
