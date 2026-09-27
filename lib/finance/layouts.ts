import type PDFDocument from "pdfkit";
import { computeTotals } from "./totals";
import { epcPayload, qrMatrix } from "./qr";
import { templateDef } from "./templates";
export { TEMPLATES, TEMPLATE_IDS, isTemplate, templateDef } from "./templates";
export type { TemplateDef, TemplateVariant } from "./templates";
import type { TemplateDef } from "./templates";

// Десять вариантов оформления финансового документа. Все они печатают один и тот же обязательный набор:
// продавца с налоговым номером, вид документа и номер, даты, покупателя, позиции с количеством/ценой/ставкой,
// нетто/налог/итог, пометку малого бизнеса, примечания, срок оплаты и банковские реквизиты, а у счёта — QR-код
// на оплату. Отличаются вёрстка, акцентный цвет и порядок блоков, а не набор данных: любой шаблон годится
// для отправки клиенту и соответствует требованиям к счёту (§14 UStG и аналоги в ЕС).
// Раскладка намеренно разная: колонка слева, баннер сверху, две колонки, сетка, компактный вариант и т.д.

import type { DocKind, PdfDocumentData, PdfLineItem, PdfParty, PdfSettings } from "./pdf";

export type { DocKind, PdfDocumentData, PdfLineItem, PdfParty, PdfSettings };

const fmt = (n: number, currency: string) => {
    try { return new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
    catch { return `${n.toFixed(2)} ${currency}`; }
};

type Doc = PDFKit.PDFDocument;
type L = Record<string, string>;

// Даты документа: у каждой бумаги свой набор и свои подписи (у счёта — дата выставления и срок оплаты,
// у предложения — дата и срок действия, у договора — начало и конец).
export function dateLines(d: PdfDocumentData, L: L): string[] {
    const out: string[] = [];
    const add = (label: string, value?: string) => { if (value) out.push(`${label}: ${value}`); };
    if (d.kind === "invoice" || d.kind === "credit_note") { add(L.issueDate, d.issueDate); add(L.dueDate, d.dueDate); }
    else if (d.kind === "quote") { add(L.date, d.issueDate); add(L.validUntil, d.validUntil); }
    else if (d.kind === "order") { add(L.orderDate, d.issueDate); }
    else { add(L.startDate, d.startDate); add(L.endDate, d.endDate); }
    return out;
}

const title = (d: PdfDocumentData, L: L) => `${L[d.kind]} ${d.number}`;
const senderLines = (s: PdfSettings) => [s.legalName, s.address, s.taxId].filter(Boolean);
const partyLines = (p: PdfParty) => [p.name || "—", p.address, p.taxId].filter(Boolean) as string[];
// Срок оплаты печатаем только у счёта: предложение и заказ ещё не требуют платежа, договор живёт по своим датам
const payerKind = (k: DocKind) => k === "invoice" || k === "credit_note";

// --- примитивы вёрстки ---------------------------------------------------------------------------------

// Абзац в точке (x, y): возвращает высоту, чтобы блоки можно было ставить друг под друга
function text(doc: Doc, str: string, x: number, y: number, o: { size?: number; color?: string; width?: number; align?: "left" | "right" | "center"; lineGap?: number } = {}): number {
    const size = o.size ?? 10;
    doc.fontSize(size).fillColor(o.color ?? "#333333");
    const opts: Record<string, unknown> = { width: o.width, align: o.align, lineGap: o.lineGap };
    doc.text(str, x, y, opts);
    return doc.heightOfString(str, { width: o.width, lineGap: o.lineGap });
}

function rule(doc: Doc, x1: number, y: number, x2: number, color: string, width = 0.5) {
    doc.moveTo(x1, y).lineTo(x2, y).lineWidth(width).strokeColor(color).stroke();
}

function box(doc: Doc, x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string } = {}) {
    if (o.fill) doc.rect(x, y, w, h).fill(o.fill);
    if (o.stroke) doc.rect(x, y, w, h).lineWidth(0.7).strokeColor(o.stroke).stroke();
}

// Подпись сверху, значение под ней — «этикетка» блоков с реквизитами
function labelled(doc: Doc, label: string, value: string, x: number, y: number, o: { labelColor?: string; valueColor?: string; size?: number; width?: number } = {}) {
    const h = text(doc, label.toUpperCase(), x, y, { size: 7.5, color: o.labelColor ?? "#999999", width: o.width });
    text(doc, value, x, y + h + 1, { size: o.size ?? 10, color: o.valueColor ?? "#333333", width: o.width });
}

// QR-код на оплату: белый квадрат под модули, тёмные модули — прямоугольниками. Соседние модули в строке
// сливаем в один прямоугольник: иначе на код уходило бы несколько тысяч команд рисования.
function drawQr(doc: Doc, payload: string, x: number, y: number, size: number) {
    const m = qrMatrix(payload);
    const quiet = 2;
    const cell = size / (m.size + quiet * 2);
    box(doc, x, y, size, size, { fill: "#FFFFFF" });
    doc.fillColor("#000000");
    for (let r = 0; r < m.size; r++) {
        let c = 0;
        while (c < m.size) {
            if (!m.isDark(r, c)) { c++; continue; }
            let end = c;
            while (end + 1 < m.size && m.isDark(r, end + 1)) end++;
            doc.rect(x + (c + quiet) * cell, y + (r + quiet) * cell, (end - c + 1) * cell, cell).fill();
            c = end + 1;
        }
    }
}

// Где начинать подвал. Обычно сразу под содержимым, но не ниже, чем позволяет нижнее поле страницы: иначе
// хвост документа (код, подписи под ним, реквизиты) уезжает за границу и pdfkit добавляет вторую страницу.
const PAGE_H = 841.89;
const QR_EXTRA = 52; // подпись под кодом и пояснение к ней (при узком коде пояснение переносится на две строки)
const FOOT_EXTRA = 70; // сам подвал без кода: пометка малого бизнеса, примечания, срок оплаты, реквизиты
function footerTop(t: TemplateDef, contentY: number, gap: number, qrSize: number, hasQr: boolean, minY = 690): number {
    const limit = PAGE_H - t.margin - (hasQr ? qrSize + QR_EXTRA : FOOT_EXTRA);
    return Math.max(Math.min(Math.max(contentY + gap, minY), limit), t.margin);
}

// Ссылка на оплату: код рисуем только там, где платёж действительно ожидается и есть куда платить — счёт,
// кредит-нота, с IBAN продавца и ненулевой суммой. У предложения, заказа и договора счёта на оплату нет.
function qrPayloadFor(d: PdfDocumentData, s: PdfSettings, L: L, gross: number): { payload: string; caption: string } | null {
    if (!payerKind(d.kind) || !s.iban || !s.legalName || gross <= 0) return null;
    return {
        payload: epcPayload({ name: s.legalName, iban: s.iban, bic: s.bic, amount: gross, remittance: `${L[d.kind]} ${d.number}` }),
        caption: L.payByQr,
    };
}

// Блок с QR и пояснением — во всех шаблонах одинаковый по смыслу, отличается только место
function qrBlock(doc: Doc, qr: { payload: string; caption: string } | null, x: number, y: number, size: number, L: L, align: "left" | "center" | "right" = "left") {
    if (!qr) return;
    drawQr(doc, qr.payload, x, y, size);
    text(doc, qr.caption, x, y + size + 4, { size: 7.5, color: "#999999", width: size, align: align === "center" ? "center" : align });
    text(doc, L.qrHint, x, y + size + 14, { size: 7, color: "#B3B3B3", width: size, align: align === "center" ? "center" : align });
}

interface TableOpts {
    x: number; width: number; accent: string; tint: string;
    size?: number; rowPad?: number; headerFill?: boolean; grid?: boolean; zebra?: boolean; border?: string;
}

// Таблица позиций: опции делают её плотной (compact), с сеткой (boxed) или с акцентной шапкой (modern/twocol)
function itemsTable(doc: Doc, d: PdfDocumentData, L: L, y: number, o: TableOpts): number {
    const size = o.size ?? 10;
    const pad = o.rowPad ?? 6;
    const cols = { desc: o.x, qty: o.x + o.width - 245, price: o.x + o.width - 185, tax: o.x + o.width - 105, total: o.x + o.width - 65 };
    const widths = { qty: 50, price: 60, tax: 40, total: 65 };
    if (o.headerFill) box(doc, o.x, y, o.width, size + pad, { fill: o.accent });
    const headerColor = o.headerFill ? "#FFFFFF" : "#999999";
    const hy = y + pad / 2;
    text(doc, L.description, cols.desc, hy, { size: size - 1, color: headerColor });
    text(doc, L.qty, cols.qty, hy, { size: size - 1, color: headerColor, width: widths.qty, align: "right" });
    text(doc, L.unitPrice, cols.price, hy, { size: size - 1, color: headerColor, width: widths.price, align: "right" });
    text(doc, L.tax, cols.tax, hy, { size: size - 1, color: headerColor, width: widths.tax, align: "right" });
    text(doc, L.lineTotal, cols.total, hy, { size: size - 1, color: headerColor, width: widths.total, align: "right" });
    let top = y + size + pad;
    if (!o.headerFill) rule(doc, o.x, top - pad / 2, o.x + o.width, o.border ?? "#E6E6E6");
    let row = 0;
    for (const it of d.items) {
        const descH = doc.fontSize(size).heightOfString(it.description, { width: cols.qty - o.x - 6 });
        const h = Math.max(descH, size) + pad;
        if (o.zebra && row % 2 === 1) box(doc, o.x, top, o.width, h, { fill: o.tint });
        if (o.grid) box(doc, o.x, top, o.width, h, { stroke: o.border ?? "#E6E6E6" });
        const ty = top + pad / 2;
        text(doc, it.description, cols.desc, ty, { size, color: "#333333", width: cols.qty - o.x - 6 });
        text(doc, String(it.qty), cols.qty, ty, { size, color: "#333333", width: widths.qty, align: "right" });
        text(doc, fmt(it.unitPrice, d.currency), cols.price, ty, { size, color: "#333333", width: widths.price, align: "right" });
        text(doc, `${it.taxRate}%`, cols.tax, ty, { size, color: "#333333", width: widths.tax, align: "right" });
        text(doc, fmt(it.qty * it.unitPrice, d.currency), cols.total, ty, { size, color: "#333333", width: widths.total, align: "right" });
        top += h;
        row++;
    }
    rule(doc, o.x, top, o.x + o.width, o.border ?? "#E6E6E6");
    return top;
}

// Итоги: нетто, налог (кроме пометки малого бизнеса) и итог. В рамке, на подложке или просто справа — по шаблону.
function totalsBlock(doc: Doc, d: PdfDocumentData, L: L, totals: ReturnType<typeof computeTotals>, x: number, y: number, w: number, o: { accent: string; tint: string; boxed?: boolean; size?: number; grid?: boolean }) {
    const size = o.size ?? 10;
    const rows: [string, string, boolean][] = [[L.net, fmt(totals.net, d.currency), false]];
    if (!d.smallBusinessNote) rows.push([L.taxTotal, fmt(totals.tax, d.currency), false]);
    rows.push([L.gross, fmt(totals.gross, d.currency), true]);
    const lineH = size + 7;
    const h = rows.length * lineH + 12;
    const top = y + 8;
    if (o.boxed) {
        box(doc, x, top - 6, w, h, { fill: o.tint, stroke: o.grid ? o.accent : undefined });
        box(doc, x, top - 6, 3, h, { fill: o.accent });
    }
    let ty = top;
    for (const [label, value, strong] of rows) {
        text(doc, label, x + 12, ty, { size: strong ? size + 1 : size, color: strong ? "#333333" : "#666666", width: w - 100 });
        text(doc, value, x + w - 88, ty, { size: strong ? size + 1 : size, color: strong ? "#333333" : "#666666", width: 76, align: "right" });
        ty += lineH;
    }
    if (!o.boxed) { rule(doc, x + 12, top - 6, x + w - 12, "#E6E6E6"); rule(doc, x + 12, ty - lineH + 2, x + w - 12, o.accent, 0.8); }
    return ty;
}

// Подвал: срок оплаты, банковские реквизиты, пометка малого бизнеса и примечания
function footerBlocks(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, x: number, y: number, width: number, o: { size?: number; align?: "left" | "center"; color?: string } = {}) {
    const size = o.size ?? 9;
    const align = o.align ?? "left";
    let cy = y;
    if (d.smallBusinessNote) { cy += text(doc, L.smallBusiness, x, cy, { size, color: "#999999", width, align }) + 6; }
    if (d.notes) {
        cy += text(doc, L.notes, x, cy, { size: size + 1, color: "#333333", width, align }) + 2;
        cy += text(doc, d.notes, x, cy, { size, color: o.color ?? "#666666", width, align }) + 6;
    }
    if (payerKind(d.kind)) cy += text(doc, `${L.paymentTerms}: ${s.paymentTermsDays} ${L.days}`, x, cy, { size, color: "#999999", width, align }) + 2;
    if (s.iban) text(doc, `${L.iban}: ${s.iban}${s.bic ? `   ${L.bic}: ${s.bic}` : ""}`, x, cy, { size, color: "#999999", width, align });
    return cy;
}

// --- шаблоны -------------------------------------------------------------------------------------------

// Классика: реквизиты продавца сверху, документ слева, таблица с линейкой, итоги справа, подвал с QR слева
function classic(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    let y = t.margin;
    for (const line of senderLines(s)) y += text(doc, line, x, y, { size: 9, color: "#666666", width: w / 2 }) + 1;
    y += 14;
    y += text(doc, title(d, L), x, y, { size: 20, color: "#333333", width: w }) + 4;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 11, color: "#666666", width: w }) + 2;
    for (const line of dateLines(d, L)) y += text(doc, line, x, y, { size: 10, color: "#666666", width: w }) + 1;
    y += 14;
    labelled(doc, L.billTo, "", x, y, {});
    y += 12;
    for (const line of partyLines(d.customer)) y += text(doc, line, x, y, { size: 10, color: "#333333", width: w / 2 }) + 1;
    y += 18;
    if (d.items.length) { y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint }); y = totalsBlock(doc, d, L, totals, x + w - 200, y + 6, 200, { accent: t.accent, tint: t.tint }); }
    else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12 });
    y += 12;
    const qrSize = 78;
    const footY = footerTop(t, y, 16, qrSize, !!qr, 686);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 16 : w);
    qrBlock(doc, qr, x, footY + 4, qrSize, L);
}

// Современный: акцентная полоса сверху, шапка таблицы на цвете, зебра, итоги в цветной рамке, QR справа
function modern(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    box(doc, x, t.margin, w, 74, { fill: t.tint });
    box(doc, x, t.margin, 5, 74, { fill: t.accent });
    text(doc, L[d.kind].toUpperCase(), x + 18, t.margin + 18, { size: 9, color: t.accent, width: w - 36 });
    text(doc, d.number, x + 18, t.margin + 32, { size: 22, color: "#333333", width: w - 36 });
    if (d.kind === "credit_note" && d.creditForNumber) text(doc, `${L.creditFor} ${d.creditForNumber}`, x + 18, t.margin + 58, { size: 9, color: "#666666", width: w - 36 });
    let y = t.margin + 90;
    const send = senderLines(s);
    for (const line of send) y += text(doc, line, x, y, { size: 9, color: "#666666", width: w, align: "right" }) + 1;
    y += 12;
    labelled(doc, L.billTo, d.customer.name || "—", x, y, { labelColor: t.accent, size: 11 });
    let dy = y;
    for (const line of dateLines(d, L)) dy += text(doc, line, x + w / 2, dy, { size: 10, color: "#666666", width: w / 2, align: "right" }) + 1;
    let py = y + 26;
    for (const line of [d.customer.address, d.customer.taxId].filter(Boolean) as string[]) py += text(doc, line, x, py, { size: 10, color: "#333333", width: w / 2 }) + 1;
    y = Math.max(py, dy) + 20;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, headerFill: true, zebra: true });
        y = totalsBlock(doc, d, L, totals, x + w - 210, y + 8, 210, { accent: t.accent, tint: t.tint, boxed: true, size: 10 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12 });
    const qrSize = 86;
    const footY = footerTop(t, y, 16, qrSize, !!qr, 690);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 16 : w);
    qrBlock(doc, qr, x + w - qrSize, footY - 4, qrSize, L, "right");
}

// Минимализм: без цвета и рамок, только тонкие линейки, широкие поля
function minimal(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    let y = t.margin;
    y += text(doc, senderLines(s).join("  ·  "), x, y, { size: 8.5, color: "#999999", width: w }) + 10;
    rule(doc, x, y, x + w, "#E6E6E6");
    y += 22;
    y += text(doc, L[d.kind].toUpperCase(), x, y, { size: 11, color: "#111111", width: w }) + 2;
    y += text(doc, d.number, x, y, { size: 24, color: "#111111", width: w }) + 8;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 9, color: "#999999", width: w }) + 2;
    y += text(doc, dateLines(d, L).join("     "), x, y, { size: 9, color: "#666666", width: w }) + 24;
    y += text(doc, L.billTo.toUpperCase(), x, y, { size: 7.5, color: "#999999", width: w }) + 2;
    for (const line of partyLines(d.customer)) y += text(doc, line, x, y, { size: 11, color: "#333333", width: w }) + 1;
    y += 26;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 10, rowPad: 9 });
        y = totalsBlock(doc, d, L, totals, x + w - 190, y + 10, 190, { accent: t.accent, tint: t.tint, size: 10 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12 });
    const qrSize = 74;
    const footY = footerTop(t, y, 24, qrSize, !!qr, 690);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 20 : w, { color: "#999999" });
    qrBlock(doc, qr, x, footY, qrSize, L);
}

// Рамки: продавец и покупатель в рамках, таблица с полной сеткой, итоги в рамке
function boxed(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    let y = t.margin;
    y += text(doc, title(d, L), x, y, { size: 19, color: t.accent, width: w - 250 }) + 2;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 10, color: "#666666", width: w - 250 }) + 2;
    for (const line of dateLines(d, L)) y += text(doc, line, x, y, { size: 10, color: "#666666", width: w - 250 }) + 1;
    // Продавец — в рамке справа от заголовка, покупатель — в рамке под ним
    const bx = x + w - 220;
    box(doc, bx, t.margin, 220, 96, { fill: t.tint, stroke: "#DCDCDC" });
    let by = t.margin + 10;
    by += text(doc, L.seller.toUpperCase(), bx + 12, by, { size: 7, color: "#999999", width: 196 }) + 2;
    for (const line of senderLines(s)) by += text(doc, line, bx + 12, by, { size: 9, color: "#333333", width: 196 }) + 1;
    y = Math.max(y, by) + 16;
    const py = y;
    box(doc, x, py, 250, 22 + partyLines(d.customer).length * 13 + 8, { fill: t.tint, stroke: "#DCDCDC" });
    let yy = py + 8;
    yy += text(doc, L.billTo.toUpperCase(), x + 12, yy, { size: 7, color: "#999999", width: 226 }) + 2;
    for (const line of partyLines(d.customer)) yy += text(doc, line, x + 12, yy, { size: 10, color: "#333333", width: 226 }) + 1;
    y = Math.max(yy + 8, py + 100) + 10;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, grid: true, border: "#DCDCDC" });
        y = totalsBlock(doc, d, L, totals, x + w - 210, y + 8, 210, { accent: t.accent, tint: t.tint, boxed: true, grid: true });
    } else if (d.kind === "contract") {
        box(doc, x, y, 250, 40, { fill: t.tint, stroke: "#DCDCDC" });
        text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x + 12, y + 14, { size: 12, color: "#333333", width: 226 });
        y += 50;
    }
    const qrSize = 80;
    const footY = footerTop(t, y, 14, qrSize, !!qr, 686);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 16 : w);
    qrBlock(doc, qr, x + w - qrSize, footY - 6, qrSize, L, "right");
}

// Боковая колонка: слева цветная полоса с реквизитами продавца, содержимое сдвинуто вправо
function sidebar(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const col = 148;
    const x = col + 34, w = 595.28 - x - t.margin;
    box(doc, 0, 0, col, 841.89, { fill: t.tint });
    box(doc, col, 0, 3, 841.89, { fill: t.accent });
    let sy = t.margin + 6;
    sy += text(doc, L.seller.toUpperCase(), 24, sy, { size: 7.5, color: t.accent, width: col - 48 }) + 4;
    for (const line of senderLines(s)) sy += text(doc, line, 24, sy, { size: 9, color: "#333333", width: col - 48 }) + 2;
    let y = t.margin + 6;
    y += text(doc, title(d, L), x, y, { size: 20, color: "#333333", width: w }) + 4;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 10, color: "#666666", width: w }) + 2;
    for (const line of dateLines(d, L)) y += text(doc, line, x, y, { size: 10, color: "#666666", width: w }) + 1;
    y += 16;
    labelled(doc, L.billTo, partyLines(d.customer)[0], x, y, { labelColor: t.accent });
    y += 24;
    for (const line of partyLines(d.customer).slice(1)) y += text(doc, line, x, y, { size: 10, color: "#333333", width: w }) + 1;
    y += 18;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 9.5, headerFill: true });
        y = totalsBlock(doc, d, L, totals, x + w - 190, y + 8, 190, { accent: t.accent, tint: t.tint });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12 });
    const qrSize = 100;
    footerBlocks(doc, d, s, L, x, footerTop(t, y, 16, 0, false, 660), w);
    // QR уходит в нижнюю часть колонки — под реквизитами продавца
    if (qr) { const qy = footerTop(t, 0, 0, qrSize, true, 0); qrBlock(doc, qr, 24, qy, qrSize, L); }
}

// Баннер: цветная шапка во всю ширину, ниже две колонки (продавец и покупатель), таблица с акцентной шапкой
function banner(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    box(doc, 0, 0, 595.28, 104, { fill: t.accent });
    box(doc, 0, 104, 595.28, 4, { fill: t.tint });
    text(doc, L[d.kind].toUpperCase(), x, 30, { size: 10, color: "#FFFFFF", width: w / 2 });
    text(doc, d.number, x, 46, { size: 26, color: "#FFFFFF", width: w / 2 });
    if (d.kind === "credit_note" && d.creditForNumber) text(doc, `${L.creditFor} ${d.creditForNumber}`, x, 78, { size: 9, color: "#EAF3FA", width: w / 2 });
    let dy = 34;
    for (const line of dateLines(d, L)) dy += text(doc, line, x + w / 2, dy, { size: 10, color: "#FFFFFF", width: w / 2, align: "right" }) + 1;
    let y = 126;
    const colW = (w - 24) / 2;
    let ly = y;
    ly += text(doc, L.seller.toUpperCase(), x, ly, { size: 7.5, color: t.accent, width: colW }) + 2;
    for (const line of senderLines(s)) ly += text(doc, line, x, ly, { size: 9.5, color: "#333333", width: colW }) + 1;
    let ry = y;
    ry += text(doc, L.billTo.toUpperCase(), x + colW + 24, ry, { size: 7.5, color: t.accent, width: colW }) + 2;
    for (const line of partyLines(d.customer)) ry += text(doc, line, x + colW + 24, ry, { size: 10, color: "#333333", width: colW }) + 1;
    y = Math.max(ly, ry) + 20;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, headerFill: true });
        y = totalsBlock(doc, d, L, totals, x + w - 205, y + 8, 205, { accent: t.accent, tint: t.tint });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12 });
    const qrSize = 84;
    const footY = footerTop(t, y, 16, qrSize, !!qr, 682);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 16 : w);
    qrBlock(doc, qr, x + w - qrSize, footY - 4, qrSize, L, "right");
}

// Две колонки: слева продавец, справа покупатель, под ними полоса дат
function twocol(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    let y = t.margin;
    y += text(doc, title(d, L), x, y, { size: 18, color: t.accent, width: w }) + 4;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 10, color: "#666666", width: w }) + 2;
    y += 12;
    const colW = (w - 16) / 2;
    const boxH = 96;
    box(doc, x, y, colW, boxH, { fill: t.tint });
    box(doc, x + colW + 16, y, colW, boxH, { fill: t.tint });
    let ly = y + 10;
    ly += text(doc, L.seller.toUpperCase(), x + 12, ly, { size: 7, color: t.accent, width: colW - 24 }) + 2;
    for (const line of senderLines(s)) ly += text(doc, line, x + 12, ly, { size: 9, color: "#333333", width: colW - 24 }) + 1;
    let ry = y + 10;
    ry += text(doc, L.billTo.toUpperCase(), x + colW + 28, ry, { size: 7, color: t.accent, width: colW - 24 }) + 2;
    for (const line of partyLines(d.customer)) ry += text(doc, line, x + colW + 28, ry, { size: 10, color: "#333333", width: colW - 24 }) + 1;
    y += boxH + 12;
    // полоса дат: подпись и значение в одну строку, ячейками
    const dates = dateLines(d, L);
    if (dates.length) {
        const cellW = w / dates.length;
        box(doc, x, y, w, 30, { stroke: "#E6E6E6" });
        dates.forEach((line, i) => text(doc, line, x + i * cellW + 10, y + 10, { size: 10, color: "#666666", width: cellW - 20 }));
        y += 42;
    } else y += 10;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, headerFill: true, zebra: true });
        y = totalsBlock(doc, d, L, totals, x + w - 205, y + 8, 205, { accent: t.accent, tint: t.tint, boxed: true });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12 });
    const qrSize = 82;
    const footY = footerTop(t, y, 16, qrSize, !!qr, 684);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 16 : w);
    qrBlock(doc, qr, x + w - qrSize, footY - 4, qrSize, L, "right");
}

// Компактный: мелкий шрифт и плотные строки — длинный счёт помещается на одной странице
function compact(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    let y = t.margin;
    y += text(doc, title(d, L), x, y, { size: 13, color: "#333333", width: w - 180 }) + 1;
    text(doc, dateLines(d, L).join("   "), x + w - 300, t.margin + 2, { size: 8.5, color: "#666666", width: 300, align: "right" });
    y += 2;
    y += text(doc, [senderLines(s).join(" · "), partyLines(d.customer).join(" · ")].join("\n"), x, y, { size: 8, color: "#666666", width: w }) + 8;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 8, color: "#666666", width: w }) + 2;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 8.5, rowPad: 3, zebra: true });
        y = totalsBlock(doc, d, L, totals, x + w - 180, y + 4, 180, { accent: t.accent, tint: t.tint, size: 8.5 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 10 });
    const qrSize = 60;
    const footY = footerTop(t, y, 10, qrSize, !!qr, 726);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 12 : w, { size: 7.5 });
    qrBlock(doc, qr, x + w - qrSize, footY - 6, qrSize, L, "right");
}

// Элегантный: всё по центру, подписи вразрядку, тонкие линейки, сдержанный цвет
function elegant(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    let y = t.margin;
    for (const line of senderLines(s)) y += text(doc, line, x, y, { size: 9, color: "#666666", width: w, align: "center" }) + 1;
    y += 12;
    rule(doc, x + w / 3, y, x + (w * 2) / 3, t.accent, 0.8);
    y += 18;
    y += text(doc, L[d.kind].toUpperCase(), x, y, { size: 12, color: t.accent, width: w, align: "center" }) + 4;
    y += text(doc, d.number, x, y, { size: 22, color: "#333333", width: w, align: "center" }) + 10;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 9, color: "#999999", width: w, align: "center" }) + 2;
    y += 18;
    const colW = (w - 40) / 2;
    let ly = y;
    ly += text(doc, L.billTo.toUpperCase(), x, ly, { size: 7.5, color: "#999999", width: colW }) + 2;
    for (const line of partyLines(d.customer)) ly += text(doc, line, x, ly, { size: 11, color: "#333333", width: colW }) + 1;
    let ry = y;
    for (const line of dateLines(d, L)) ry += text(doc, line, x + colW + 40, ry, { size: 10, color: "#666666", width: colW, align: "right" }) + 1;
    y = Math.max(ly, ry) + 24;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 10, rowPad: 8 });
        y = totalsBlock(doc, d, L, totals, x + w - 210, y + 12, 210, { accent: t.accent, tint: t.tint, size: 10 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12, width: w, align: "center" });
    const qrSize = 78;
    const footY = footerTop(t, y, 22, qrSize, !!qr, 688);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 20 : w, { align: "left" });
    qrBlock(doc, qr, x + w - qrSize, footY - 6, qrSize, L, "right");
}

// Швейцарский: строгая сетка «подпись — значение», крупный номер справа сверху, только линейки
function swiss(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) {
    const x = t.margin, w = 595.28 - t.margin * 2;
    let y = t.margin;
    text(doc, L[d.kind].toUpperCase(), x, y, { size: 8, color: "#666666", width: w - 220 });
    text(doc, d.number, x + w - 220, y - 6, { size: 26, color: "#111111", width: 220, align: "right" });
    y += 34;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 9, color: "#666666", width: w }) + 4;
    rule(doc, x, y, x + w, "#111111", 1);
    y += 14;
    const labelW = 96;
    const row = (label: string, value: string) => {
        const h = Math.max(doc.fontSize(8).heightOfString(label.toUpperCase(), { width: labelW }), doc.fontSize(10).heightOfString(value, { width: w - labelW }));
        text(doc, label.toUpperCase(), x, y, { size: 8, color: "#999999", width: labelW });
        text(doc, value, x + labelW, y - 1, { size: 10, color: "#111111", width: w - labelW });
        y += h + 8;
    };
    row(L.seller, senderLines(s).join(", "));
    row(L.billTo, partyLines(d.customer).join(", "));
    for (const line of dateLines(d, L)) { const i = line.indexOf(": "); row(line.slice(0, i), line.slice(i + 2)); }
    y += 6;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 9.5, rowPad: 5, border: "#111111" });
        y = totalsBlock(doc, d, L, totals, x + w - 220, y + 6, 220, { accent: t.accent, tint: t.tint, grid: true, size: 9.5 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x + labelW, y, { size: 12, color: "#111111", width: w - labelW });
    const qrSize = 78;
    const footY = footerTop(t, y, 16, qrSize, !!qr, 690);
    footerBlocks(doc, d, s, L, x, footY, qr ? w - qrSize - 16 : w, { color: "#111111" });
    qrBlock(doc, qr, x + w - qrSize, footY - 6, qrSize, L, "right");
}

const LAYOUTS: Record<string, (doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) => void> = {
    classic, modern, minimal, boxed, sidebar, banner, twocol, compact, elegant, swiss,
};

// Точка входа: считает суммы, решает, нужен ли QR на оплату, и отдаёт документ выбранному шаблону
export function renderLayout(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L) {
    const t = templateDef(d.template || s.template);
    const totals = computeTotals(d.items);
    const qr = (s.paymentQr ?? true) ? qrPayloadFor(d, s, L, totals.gross) : null;
    (LAYOUTS[t.id] ?? classic)(doc, d, s, L, t, totals, qr);
}
