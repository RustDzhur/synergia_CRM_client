import PDFDocument from "pdfkit";
import { computeTotals } from "./totals";

// Небольшой словарь подписей PDF на трёх языках интерфейса — сам PDFKit не знает про next-intl (это не React-рендер),
// поэтому подписи держим здесь же, минимальным набором, без обращения к messages/*.json.
const LABELS: Record<string, Record<string, string>> = {
    en: {
        invoice: "Invoice", credit_note: "Credit Note", creditFor: "Credit note for invoice",
        issueDate: "Issue date", dueDate: "Due date", customer: "Bill to",
        description: "Description", qty: "Qty", unitPrice: "Unit price", tax: "Tax", lineTotal: "Total",
        net: "Net", taxTotal: "Tax", gross: "Total", smallBusiness: "No VAT is charged pursuant to the small business regulation (§19 UStG or equivalent).",
        paymentTerms: "Payment terms", iban: "IBAN", bic: "BIC", notes: "Notes",
    },
    de: {
        invoice: "Rechnung", credit_note: "Gutschrift", creditFor: "Gutschrift zur Rechnung",
        issueDate: "Rechnungsdatum", dueDate: "Fällig am", customer: "Rechnungsempfänger",
        description: "Beschreibung", qty: "Menge", unitPrice: "Einzelpreis", tax: "USt.", lineTotal: "Summe",
        net: "Netto", taxTotal: "USt.", gross: "Gesamt", smallBusiness: "Gemäß §19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.",
        paymentTerms: "Zahlungsziel", iban: "IBAN", bic: "BIC", notes: "Anmerkungen",
    },
    ua: {
        invoice: "Рахунок", credit_note: "Кредит-нота", creditFor: "Кредит-нота до рахунку",
        issueDate: "Дата виставлення", dueDate: "Термін оплати", customer: "Платник",
        description: "Опис", qty: "К-сть", unitPrice: "Ціна", tax: "ПДВ", lineTotal: "Сума",
        net: "Нетто", taxTotal: "ПДВ", gross: "Разом", smallBusiness: "ПДВ не нараховується згідно з режимом для малого підприємця (§19 UStG або аналог).",
        paymentTerms: "Термін оплати", iban: "IBAN", bic: "BIC", notes: "Примітки",
    },
};

interface PdfInvoice {
    number: string; kind: "invoice" | "credit_note"; creditForNumber?: string;
    customerName: string; customerAddress: string; customerTaxId: string;
    items: { description: string; qty: number; unitPrice: number; taxRate: number }[];
    currency: string; smallBusinessNote: boolean; issueDate: string; dueDate: string; notes: string;
}
interface PdfSettings { legalName: string; address: string; taxId: string; iban: string; bic: string; paymentTermsDays: number }

const fmt = (n: number, currency: string) => {
    try { return new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
    catch { return `${n.toFixed(2)} ${currency}`; }
};

// Рендерит PDF счёта/кредит-ноты в буфер — вызывается из app/api/invoices/[id]/pdf/route.ts. Простая табличная вёрстка
// без внешних шрифтов/шаблонов: этого достаточно для юридически корректного документа (номер, даты, стороны, позиции, суммы).
export function renderInvoicePdf(inv: PdfInvoice, settings: PdfSettings, locale = "en"): Promise<Buffer> {
    const L = LABELS[locale] ?? LABELS.en;
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
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
        doc.fontSize(20).fillColor("#333333").text(`${L[inv.kind]} ${inv.number}`);
        if (inv.kind === "credit_note" && inv.creditForNumber) {
            doc.fontSize(11).fillColor("#666666").text(`${L.creditFor} ${inv.creditForNumber}`);
        }
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor("#666666").text(`${L.issueDate}: ${inv.issueDate}`);
        if (inv.dueDate) doc.text(`${L.dueDate}: ${inv.dueDate}`);

        doc.moveDown(1);
        doc.fontSize(11).fillColor("#333333").text(L.customer, { underline: true });
        doc.fontSize(10).fillColor("#333333").text(inv.customerName);
        if (inv.customerAddress) doc.text(inv.customerAddress);
        if (inv.customerTaxId) doc.text(inv.customerTaxId);

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
        for (const it of inv.items) {
            const line = it.qty * it.unitPrice;
            const y = doc.y;
            doc.text(it.description, colX.desc, y, { width: 240 });
            doc.text(String(it.qty), colX.qty, y, { width: 50, align: "right" });
            doc.text(fmt(it.unitPrice, inv.currency), colX.price, y, { width: 60, align: "right" });
            doc.text(`${it.taxRate}%`, colX.tax, y, { width: 40, align: "right" });
            doc.text(fmt(line, inv.currency), colX.total, y, { width: 65, align: "right" });
            doc.moveDown(0.6);
        }

        doc.moveDown(0.5);
        doc.moveTo(350, doc.y).lineTo(545, doc.y).strokeColor("#E6E6E6").stroke();
        doc.moveDown(0.3);
        const totals = computeTotals(inv.items);
        const totalLine = (label: string, value: string, bold = false) => {
            doc.fontSize(bold ? 11 : 10).fillColor(bold ? "#333333" : "#666666");
            doc.text(label, 350, doc.y, { width: 130, align: "right", continued: true });
            doc.text(`  ${value}`, { width: 65, align: "right" });
        };
        totalLine(L.net, fmt(totals.net, inv.currency));
        if (!inv.smallBusinessNote) totalLine(L.taxTotal, fmt(totals.tax, inv.currency));
        totalLine(L.gross, fmt(totals.gross, inv.currency), true);

        if (inv.smallBusinessNote) {
            doc.moveDown(1);
            doc.fontSize(9).fillColor("#999999").text(L.smallBusiness, 50, doc.y, { width: 495 });
        }

        if (inv.notes) {
            doc.moveDown(1);
            doc.fontSize(10).fillColor("#333333").text(L.notes, { underline: true });
            doc.fontSize(10).fillColor("#666666").text(inv.notes, { width: 495 });
        }

        doc.moveDown(1.5);
        doc.fontSize(9).fillColor("#999999");
        if (inv.kind === "invoice") doc.text(`${L.paymentTerms}: ${settings.paymentTermsDays} ${locale === "de" ? "Tage" : locale === "ua" ? "днів" : "days"}`);
        if (settings.iban) doc.text(`${L.iban}: ${settings.iban}${settings.bic ? `   ${L.bic}: ${settings.bic}` : ""}`);

        doc.end();
    });
}
