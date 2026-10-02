import PDFDocument from "pdfkit";
import { DOC_FONT } from "@/lib/finance/pdf";

// Простой PDF-отчёт для ассистента: заголовок, пояснение и таблицы. Для писем «пришли мне список в PDF»
// (остатки склада, неоплаченные счета…). Шрифт встроен (кириллица и €/₴ печатаются как во всех документах CRM).
export interface ReportSection { heading?: string; columns: string[]; rows: (string | number)[][] }
export interface ReportInput { title: string; subtitle?: string; intro?: string; sections: ReportSection[]; footer?: string }

const MARGIN = 40;
const INK = "#1b1f1a", MUTED = "#6b7280", LINE = "#d6dad3", HEAD_BG = "#eef1ea";

export function reportPdf(r: ReportInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const pdf = new PDFDocument({ size: "A4", margin: MARGIN, font: DOC_FONT as unknown as string, info: { Title: r.title } });
        const chunks: Buffer[] = [];
        pdf.on("data", (c: Buffer) => chunks.push(c));
        pdf.on("end", () => resolve(Buffer.concat(chunks)));
        pdf.on("error", reject);

        const width = pdf.page.width - MARGIN * 2;
        const bottom = () => pdf.page.height - MARGIN - 20;

        pdf.fillColor(INK).fontSize(20).text(r.title, { width });
        if (r.subtitle) pdf.moveDown(0.2).fontSize(10).fillColor(MUTED).text(r.subtitle, { width });
        if (r.intro) pdf.moveDown(0.8).fontSize(11).fillColor(INK).text(r.intro, { width });
        pdf.moveDown(0.8);

        for (const s of r.sections) {
            if (s.heading) {
                if (pdf.y > bottom() - 60) pdf.addPage();
                pdf.fontSize(13).fillColor(INK).text(s.heading, MARGIN, pdf.y, { width }).moveDown(0.3);
            }
            const cols = s.columns.length || 1;
            // ширина колонки — по самому длинному содержимому (в разумных пределах), чтобы числа не растягивались, а названия не ломались
            const weights = Array.from({ length: cols }, (_, i) => Math.min(40, Math.max(6, ...[s.columns[i] ?? "", ...s.rows.map((row) => String(row[i] ?? ""))].map((x) => String(x).length))));
            const total = weights.reduce((a, b) => a + b, 0);
            const widths = weights.map((w) => (w / total) * width);
            const x0 = MARGIN;

            const drawRow = (cells: (string | number)[], head: boolean) => {
                pdf.fontSize(head ? 9 : 9.5);
                const heights = cells.map((c, i) => pdf.heightOfString(String(c ?? ""), { width: widths[i] - 8 }));
                const h = Math.max(...heights, 12) + 8;
                if (pdf.y + h > bottom()) { pdf.addPage(); if (!head) drawRow(s.columns, true); }
                const y = pdf.y;
                if (head) pdf.rect(x0, y, width, h).fill(HEAD_BG);
                let x = x0;
                cells.forEach((c, i) => {
                    pdf.fillColor(head ? MUTED : INK).text(String(c ?? ""), x + 4, y + 4, { width: widths[i] - 8 });
                    x += widths[i];
                });
                pdf.moveTo(x0, y + h).lineTo(x0 + width, y + h).strokeColor(LINE).lineWidth(0.5).stroke();
                pdf.x = MARGIN;
                pdf.y = y + h;
            };
            drawRow(s.columns, true);
            for (const row of s.rows) drawRow(row, false);
            pdf.moveDown(1);
        }
        if (r.footer) pdf.fontSize(8.5).fillColor(MUTED).text(r.footer, MARGIN, pdf.y + 4, { width });
        pdf.end();
    });
}
