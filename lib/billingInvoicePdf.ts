import PDFDocument from "pdfkit";
import { DOC_FONT } from "@/lib/finance/pdf";
import { qrMatrix } from "@/lib/finance/qr";
import { orderView, qrPayloadFor, type Order, type PayRequisites } from "@/lib/transferPay";

// PDF-счёт на тариф платформы: реквизиты продавца, покупатель, позиция, сумма, способ оплаты и QR-код.
// Печатается шрифтом Noto Sans (кириллица и €/₴), как и остальные документы CRM.

const T = {
    de: { invoice: "Rechnung", number: "Nr.", date: "Datum", due: "Zahlbar bis", billTo: "Rechnungsempfänger", desc: "Leistung", total: "Gesamtbetrag", payment: "Zahlung", scan: "QR-Code mit der Banking-App scannen", scanWallet: "QR-Code mit dem Wallet scannen", plan: "Firmspace CRM – Tarif", month: "1 Monat", year: "12 Monate", usdt: "Zahlung in USDT (TRC-20)", thanks: "Vielen Dank! Der Tarif wird nach Zahlungseingang freigeschaltet." },
    ua: { invoice: "Рахунок", number: "№", date: "Дата", due: "Оплатити до", billTo: "Платник", desc: "Послуга", total: "Всього до сплати", payment: "Оплата", scan: "Скануйте QR-код у банківському застосунку", scanWallet: "Скануйте QR-код у гаманці", plan: "Firmspace CRM – тариф", month: "1 місяць", year: "12 місяців", usdt: "Оплата в USDT (TRC-20)", thanks: "Дякуємо! Тариф буде активовано після надходження коштів." },
};

export function billingInvoicePdf(o: Order, r: PayRequisites): Promise<Buffer> {
    const L = T[o.market === "UA" ? "ua" : "de"];
    const v = orderView(o, r);
    const planName = ({ standard: "Standard", professional: "Professional" } as Record<string, string>)[o.plan] ?? o.plan;
    const total = o.method === "usdt" ? `${o.usdtAmount.toFixed(2)} USDT` : `${o.amount.toFixed(2)} ${o.currency}`;
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(o.market === "UA" ? "uk-UA" : "de-DE");
    const due = new Date(new Date(o.createdAt).getTime() + 14 * 86400_000).toISOString();
    return new Promise((resolve, reject) => {
        const pdf = new PDFDocument({ size: "A4", margin: 50, font: DOC_FONT as unknown as string });
        const chunks: Buffer[] = [];
        pdf.on("data", (c: Buffer) => chunks.push(c));
        pdf.on("end", () => resolve(Buffer.concat(chunks)));
        pdf.on("error", reject);

        const left = 50, right = 545;
        pdf.fillColor("#111111").fontSize(20).text(`${L.invoice} ${o.number}`, left, 50);
        pdf.fontSize(9).fillColor("#666666").text(`${L.date}: ${fmtDate(o.createdAt)}   ·   ${L.due}: ${fmtDate(due)}`, left, 78);

        // продавец (справа) и покупатель (слева)
        pdf.fontSize(10).fillColor("#111111").text(v.seller.name, 330, 50, { width: right - 330, align: "right" });
        pdf.fontSize(9).fillColor("#555555");
        for (const line of [v.seller.address, v.seller.taxId]) if (line) pdf.text(line, 330, pdf.y, { width: right - 330, align: "right" });

        pdf.fontSize(8).fillColor("#888888").text(L.billTo.toUpperCase(), left, 120);
        pdf.fontSize(11).fillColor("#111111").text(o.company, left, pdf.y + 2, { width: 300 });
        if (o.vatId) pdf.fontSize(9).fillColor("#555555").text(o.vatId, left, pdf.y + 2);

        // позиция
        let y = 200;
        pdf.rect(left, y, right - left, 22).fill("#F2F2F2");
        pdf.fillColor("#333333").fontSize(9).text(L.desc, left + 8, y + 7).text(L.total, 400, y + 7, { width: right - 408, align: "right" });
        y += 32;
        const per = o.interval === "year" ? L.year : L.month;
        pdf.fillColor("#111111").fontSize(11).text(`${L.plan} ${planName} (${per})`, left + 8, y, { width: 330 });
        pdf.text(total, 400, y, { width: right - 408, align: "right" });
        y += 34;
        pdf.moveTo(left, y).lineTo(right, y).strokeColor("#DDDDDD").stroke();
        y += 10;
        pdf.fontSize(13).fillColor("#111111").text(`${L.total}: ${total}`, left, y, { width: right - left, align: "right" });
        if (v.seller.note) pdf.fontSize(8).fillColor("#777777").text(v.seller.note, left, pdf.y + 4, { width: right - left, align: "right" });

        // оплата: реквизиты слева, QR справа
        y = 380;
        pdf.fontSize(8).fillColor("#888888").text((o.method === "usdt" ? L.usdt : L.payment).toUpperCase(), left, y);
        let ly = y + 16;
        for (const l of v.lines) {
            if (l.label) pdf.fontSize(8).fillColor("#888888").text(l.label, left, ly, { width: 120 });
            pdf.fontSize(l.label ? 10 : 9).fillColor(l.label ? "#111111" : "#B25500").text(l.value, l.label ? left + 125 : left, ly, { width: l.label ? 215 : 340 });
            ly = pdf.y + 6;
        }

        const payload = qrPayloadFor(o, r);
        const m = qrMatrix(payload);
        const size = 150, quiet = 2, cell = size / (m.size + quiet * 2), qx = right - size, qy = y + 10;
        pdf.rect(qx, qy, size, size).fill("#FFFFFF");
        pdf.fillColor("#000000");
        for (let row = 0; row < m.size; row++) {
            let c = 0;
            while (c < m.size) {
                if (!m.isDark(row, c)) { c++; continue; }
                let end = c;
                while (end + 1 < m.size && m.isDark(row, end + 1)) end++;
                pdf.rect(qx + (c + quiet) * cell, qy + (row + quiet) * cell, (end - c + 1) * cell, cell).fill();
                c = end + 1;
            }
        }
        pdf.fontSize(7.5).fillColor("#888888").text(o.method === "usdt" ? L.scanWallet : L.scan, qx - 10, qy + size + 6, { width: size + 20, align: "center" });
        pdf.fontSize(9).fillColor("#555555").text(L.thanks, left, 720, { width: right - left });
        pdf.end();
    });
}
