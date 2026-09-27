import PDFDocument from "pdfkit";
import notoSansUrl from "@/assets/fonts/NotoSans-Regular.ttf";
import { computeTotals } from "./totals";

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
}
export interface PdfSettings { legalName: string; address: string; taxId: string; iban: string; bic: string; paymentTermsDays: number }

const fmt = (n: number, currency: string) => {
    try { return new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
    catch { return `${n.toFixed(2)} ${currency}`; }
};

// Даты документа: у каждой бумаги свой набор и свои подписи (у счёта — дата выставления и срок оплаты,
// у предложения — дата и срок действия, у договора — начало и конец).
function dateLines(d: PdfDocumentData, L: Record<string, string>): string[] {
    const out: string[] = [];
    const add = (label: string, value?: string) => { if (value) out.push(`${label}: ${value}`); };
    if (d.kind === "invoice" || d.kind === "credit_note") {
        add(L.issueDate, d.issueDate);
        add(L.dueDate, d.dueDate);
    } else if (d.kind === "quote") {
        add(L.date, d.issueDate);
        add(L.validUntil, d.validUntil);
    } else if (d.kind === "order") {
        add(L.orderDate, d.issueDate);
    } else {
        add(L.startDate, d.startDate);
        add(L.endDate, d.endDate);
    }
    return out;
}

// Рендерит PDF финансового документа в буфер — вызывается из app/api/*/[id]/pdf/route.ts (скачивание и печать)
// и из lib/finance/send.ts (вложение к письму клиенту). Вёрстка табличная, без шаблонов: этого достаточно для
// юридически корректного документа (номер, даты, стороны, позиции, суммы).
export function renderDocumentPdf(d: PdfDocumentData, settings: PdfSettings, locale = "en"): Promise<Buffer> {
    const L = LABELS[locale] ?? LABELS.en;
    return new Promise((resolve, reject) => {
        // pdfkit принимает буфер шрифта в options.font (разбирает его fontkit), но в его типах там только имя шрифта
        const doc = new PDFDocument({ size: "A4", margin: 50, font: DOC_FONT as unknown as string });
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Шапка: продавец
        doc.fontSize(10).fillColor("#666666");
        if (settings.legalName) doc.text(settings.legalName);
        if (settings.address) doc.text(settings.address);
        if (settings.taxId) doc.text(settings.taxId);

        doc.moveDown(1.5);
        doc.fontSize(20).fillColor("#333333").text(`${L[d.kind]} ${d.number}`);
        if (d.kind === "credit_note" && d.creditForNumber) {
            doc.fontSize(11).fillColor("#666666").text(`${L.creditFor} ${d.creditForNumber}`);
        }
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor("#666666");
        for (const line of dateLines(d, L)) doc.text(line);

        doc.moveDown(1);
        doc.fontSize(11).fillColor("#333333").text(L.billTo, { underline: true });
        doc.fontSize(10).fillColor("#333333").text(d.customer.name || "—");
        if (d.customer.address) doc.text(d.customer.address);
        if (d.customer.taxId) doc.text(d.customer.taxId);

        const totals = computeTotals(d.items);
        if (d.items.length) {
            doc.moveDown(1.5);
            const colX = { desc: 50, qty: 300, price: 360, tax: 430, total: 480 };
            const top = doc.y;
            doc.fontSize(9).fillColor("#999999");
            doc.text(L.description, colX.desc, top);
            doc.text(L.qty, colX.qty, top, { width: 50, align: "right" });
            doc.text(L.unitPrice, colX.price, top, { width: 60, align: "right" });
            doc.text(L.tax, colX.tax, top, { width: 40, align: "right" });
            doc.text(L.lineTotal, colX.total, top, { width: 65, align: "right" });
            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#E6E6E6").stroke();
            doc.moveDown(0.3);

            doc.fontSize(10).fillColor("#333333");
            for (const it of d.items) {
                const line = it.qty * it.unitPrice;
                const y = doc.y;
                doc.text(it.description, colX.desc, y, { width: 240 });
                doc.text(String(it.qty), colX.qty, y, { width: 50, align: "right" });
                doc.text(fmt(it.unitPrice, d.currency), colX.price, y, { width: 60, align: "right" });
                doc.text(`${it.taxRate}%`, colX.tax, y, { width: 40, align: "right" });
                doc.text(fmt(line, d.currency), colX.total, y, { width: 65, align: "right" });
                doc.moveDown(0.6);
            }

            doc.moveDown(0.5);
            doc.moveTo(350, doc.y).lineTo(545, doc.y).strokeColor("#E6E6E6").stroke();
            doc.moveDown(0.3);
            const totalLine = (label: string, value: string, bold = false) => {
                doc.fontSize(bold ? 11 : 10).fillColor(bold ? "#333333" : "#666666");
                doc.text(label, 350, doc.y, { width: 130, align: "right", continued: true });
                doc.text(`  ${value}`, { width: 65, align: "right" });
            };
            totalLine(L.net, fmt(totals.net, d.currency));
            if (!d.smallBusinessNote) totalLine(L.taxTotal, fmt(totals.tax, d.currency));
            totalLine(L.gross, fmt(totals.gross, d.currency), true);
        } else if (d.kind === "contract") {
            // У договора нет позиций — вместо таблицы печатаем сумму договора
            doc.moveDown(1.5);
            doc.fontSize(12).fillColor("#333333").text(`${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`);
        }

        if (d.smallBusinessNote) {
            doc.moveDown(1);
            doc.fontSize(9).fillColor("#999999").text(L.smallBusiness, 50, doc.y, { width: 495 });
        }

        if (d.notes) {
            doc.moveDown(1);
            doc.fontSize(10).fillColor("#333333").text(L.notes, { underline: true });
            doc.fontSize(10).fillColor("#666666").text(d.notes, { width: 495 });
        }

        doc.moveDown(1.5);
        doc.fontSize(9).fillColor("#999999");
        // Срок оплаты печатаем только у счёта: предложение и заказ ещё не требуют платежа, договор живёт по своим датам
        if (d.kind === "invoice" || d.kind === "credit_note") doc.text(`${L.paymentTerms}: ${settings.paymentTermsDays} ${L.days}`);
        if (settings.iban) doc.text(`${L.iban}: ${settings.iban}${settings.bic ? `   ${L.bic}: ${settings.bic}` : ""}`);

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
