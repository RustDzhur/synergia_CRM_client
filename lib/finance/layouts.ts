import { computeTotals, taxBreakdown } from "./totals";
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
//
// Общий каркас у всех десяти один и рисуется в одном месте, чтобы варианты не «жили своей жизнью»:
//   • логотип занимает заранее отведённый слот и рисуется ПОСЛЕ подложек шаблона — его никто не закрашивает,
//     а текст шапки в этот слот не заходит (ему сужается колонка);
//   • подвал (реквизиты, примечания, QR) всегда стоит внизу ПОСЛЕДНЕЙ страницы; его высота измеряется по
//     фактическому тексту настроек и резервируется на каждой странице — блоки не налезают друг на друга;
//   • когда содержимое не помещается, страница честно заканчивается и открывается новая с шапкой-продолжением,
//     а не так, как раньше: pdfkit сам добавлял страницу ровно под последней строкой.

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
    if (d.kind === "delivery_note") {
        // В накладной важны дата поставки и ссылка на заказ, по которому она сделана
        add(L.deliveryDate, d.supplyDate || d.issueDate);
        add(L.ourOrder, d.orderNumber);
    }
    else if (d.kind === "invoice" || d.kind === "credit_note") { add(L.issueDate, d.issueDate); add(L.dueDate, d.dueDate); }
    else if (d.kind === "quote") { add(L.date, d.issueDate); add(L.validUntil, d.validUntil); }
    else if (d.kind === "order") { add(L.orderDate, d.issueDate); }
    else { add(L.startDate, d.startDate); add(L.endDate, d.endDate); }
    // Период оказания услуг — обязательное поле счёта в Германии (§14 Abs. 4 Nr. 6 UStG):
    // без него счёт формально неполный. Печатаем и в счёте, и в кредит-ноте, и в подтверждении заказа.
    if (d.supplyPeriodFrom || d.supplyPeriodTo) {
        add(L.supplyPeriod, [d.supplyPeriodFrom, d.supplyPeriodTo].filter(Boolean).join(" – "));
    } else if (d.supplyDate) add(L.supplyDate, d.supplyDate);
    // Напоминание всегда называет новый срок оплаты и, если он есть, начисленный сбор
    if (d.dunningNewDue) add(L.dunningNewDue, d.dunningNewDue);
    return out;
}

// Заголовок документа. У счёта со ступенью напоминания вместо «Rechnung» печатается название ступени
// («Zahlungserinnerung», «1. Mahnung»), иначе клиент не поймёт, что это уже не первый документ.
const title = (d: PdfDocumentData, L: L) => {
    const level = Number(d.dunningLevel) || 0;
    if (d.kind === "invoice" && level > 0) return `${L[`level_${Math.min(4, level)}`] ?? L.invoice} ${d.number}`;
    return `${L[d.kind]} ${d.number}`;
};
// Реквизиты продавца в шапке. Помимо названия, адреса и налогового номера печатаем контакты
// и регистровый номер: в Германии счёт без обратного адреса и контактов продавца считается неполным.
const senderLines = (s: PdfSettings) => [
    s.legalName,
    s.address,
    s.taxId,
    s.vatId ? `${s.vatId}` : "",
    s.registerNumber,
    [s.phone, s.email, s.website].filter(Boolean).join(" · "),
].filter((v): v is string => !!v);
const partyLines = (p: PdfParty) => [p.name || "—", p.address, p.taxId].filter(Boolean) as string[];
// Срок оплаты печатаем только у счёта: предложение и заказ ещё не требуют платежа, договор живёт по своим датам
const payerKind = (k: DocKind) => k === "invoice" || k === "credit_note";

// --- геометрия страницы ---------------------------------------------------------------------------------

// Документ создаётся с полями 50 pt (lib/finance/pdf.ts), поэтому нижняя граница содержимого — 791.89.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const PAGE_MARGIN = 50;
const MAX_Y = PAGE_H - PAGE_MARGIN; // = doc.page.maxY(): ниже этой линии pdfkit открывает новую страницу
const CONTENT_GAP = 12; // воздух между содержимым и нижней полосой
const BRAND_H = 10; // строка бренда в самом низу
const BRAND_GAP = 8; // отступ между строкой бренда и полосой подвала
const QR_GAP = 16; // зазор между текстом подвала и QR-кодом

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

// Подпись сверху, значение под ней — «этикетка» блоков с реквизитами. Возвращает занятую высоту:
// вызывающий ставит следующий блок по ней, а не по «примерно столько же» — иначе блоки смыкались.
function labelled(doc: Doc, label: string, value: string, x: number, y: number, o: { labelColor?: string; valueColor?: string; size?: number; width?: number } = {}): number {
    const h = text(doc, label.toUpperCase(), x, y, { size: 7.5, color: o.labelColor ?? "#999999", width: o.width });
    const hv = text(doc, value, x, y + h + 1, { size: o.size ?? 10, color: o.valueColor ?? "#333333", width: o.width });
    return h + 1 + hv;
}

// Строка, гарантированно влезающая в одну строку: длинную строку бренда обрезаем, а не переносим —
// перенос уводил её за нижнее поле и pdfkit открывал из-за этого лишнюю страницу.
function oneLine(doc: Doc, str: string, size: number, width: number): string {
    doc.fontSize(size);
    if (doc.widthOfString(str) <= width) return str;
    let s = str;
    while (s.length > 1 && doc.widthOfString(`${s}…`) > width) s = s.slice(0, -1);
    return `${s}…`;
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

// --- логотип -------------------------------------------------------------------------------------------

const LOGO_MAX_W = 160;
const LOGO_MAX_H = 44;

interface LogoSlot { x: number; y: number; w: number; h: number }

// Слот логотипа в правом верхнем углу: текст шапки в него не заходит (см. headerWidth), поэтому
// картинка ничего не перекрывает.
const logoSlotTopRight = (t: TemplateDef): LogoSlot => ({
    x: PAGE_W - t.margin - LOGO_MAX_W,
    y: t.margin - 6,
    w: LOGO_MAX_W,
    h: LOGO_MAX_H,
});

// Ширина текста шапки, который не должен залезать в слот логотипа
const headerWidth = (w: number) => w - LOGO_MAX_W - 16;

// Размеры логотипа по пропорциям картинки, вписанные в слот. pdfkit умеет openImage в рантайме,
// но его нет в типах — читаем размеры через него.
function logoSize(doc: Doc, s: PdfSettings, slot: LogoSlot): { w: number; h: number } | null {
    if (!s.logo?.startsWith("data:image/")) return null;
    try {
        const buf = Buffer.from(s.logo.slice(s.logo.indexOf(",") + 1), "base64");
        const probe = doc as unknown as { openImage: (b: Buffer) => { width: number; height: number } };
        const img = probe.openImage(buf);
        if (!img?.width || !img?.height) return null;
        const scale = Math.min(slot.h / img.height, slot.w / img.width);
        return { w: img.width * scale, h: img.height * scale };
    } catch { return null; }
}

// Логотип прижат к правому краю слота. Рисуется после подложек шаблона, поэтому его ничто не закрашивает.
function logoDraw(doc: Doc, s: PdfSettings, slot: LogoSlot): { w: number; h: number } | null {
    const size = logoSize(doc, s, slot);
    if (!size) return null;
    try {
        const buf = Buffer.from(s.logo!.slice(s.logo!.indexOf(",") + 1), "base64");
        doc.image(buf, slot.x + slot.w - size.w, slot.y, { width: size.w, height: size.h });
        return size;
    } catch { return null; }
}

// --- QR-блок и подвал ----------------------------------------------------------------------------------

// Ссылка на оплату: код рисуем только там, где платёж действительно ожидается и есть куда платить — счёт,
// кредит-нота, с IBAN продавца и ненулевой суммой. У предложения, заказа и договора счёта на оплату нет.
function qrPayloadFor(d: PdfDocumentData, s: PdfSettings, L: L, gross: number): { payload: string; caption: string } | null {
    if (!payerKind(d.kind) || !s.iban || !s.legalName || gross <= 0) return null;
    return {
        payload: epcPayload({ name: s.legalName, iban: s.iban, bic: s.bic, amount: gross, remittance: `${L[d.kind]} ${d.number}` }),
        caption: L.payByQr,
    };
}

const QR_CAPTION_GAP = 4; // от подписи до кода
const QR_HINT_GAP = 2; // от пояснения до подписи

// Высота блока с QR считается по фактическим переносам подписи и пояснения: у узкого кода подпись
// переносится на две строки, и зарезервированных «на глаз» 52 pt не хватало.
function qrBlockHeight(doc: Doc, qr: { payload: string; caption: string } | null, size: number, L: L): number {
    if (!qr) return 0;
    doc.fontSize(7.5);
    const capH = doc.heightOfString(qr.caption, { width: size });
    doc.fontSize(7);
    const hintH = doc.heightOfString(L.qrHint, { width: size });
    return size + QR_CAPTION_GAP + capH + QR_HINT_GAP + hintH;
}

// Блок с QR и пояснением — во всех шаблонах одинаковый по смыслу, отличается только место
function qrBlock(doc: Doc, qr: { payload: string; caption: string } | null, x: number, y: number, size: number, L: L, align: "left" | "center" | "right" = "left") {
    if (!qr) return;
    drawQr(doc, qr.payload, x, y, size);
    const capH = text(doc, qr.caption, x, y + size + QR_CAPTION_GAP, { size: 7.5, color: "#999999", width: size, align });
    text(doc, L.qrHint, x, y + size + QR_CAPTION_GAP + capH + QR_HINT_GAP, { size: 7, color: "#B3B3B3", width: size, align });
}

// Строки подвала в порядке печати. Один источник и для измерения высоты, и для отрисовки: иначе
// зарезервированное место разошлось бы с фактическим и подвал налез бы на таблицу.
interface FootLine { str: string; size: number; color: string; gap: number }
function footerLines(d: PdfDocumentData, s: PdfSettings, L: L, base: number, color?: string): FootLine[] {
    const out: FootLine[] = [];
    if (d.smallBusinessNote) out.push({ str: L.smallBusiness, size: base, color: "#999999", gap: 6 });
    if (d.notes) {
        out.push({ str: L.notes, size: base + 1, color: "#333333", gap: 2 });
        out.push({ str: d.notes, size: base, color: color ?? "#666666", gap: 6 });
    }
    if (payerKind(d.kind)) out.push({ str: `${L.paymentTerms}: ${s.paymentTermsDays} ${L.days}`, size: base, color: "#999999", gap: 2 });
    if (s.iban) out.push({ str: `${L.iban}: ${s.iban}${s.bic ? `   ${L.bic}: ${s.bic}` : ""}`, size: base, color: "#999999", gap: 2 });
    // Свой текст фирмы (благодарность за своевременную оплату, условия гарантии, часы работы)
    if (s.footerText) out.push({ str: s.footerText, size: base, color: color ?? "#666666", gap: 4 });
    if (s.managingDirector) out.push({ str: s.managingDirector, size: base, color: "#999999", gap: 0 });
    return out;
}

function footerHeight(doc: Doc, lines: FootLine[], width: number): number {
    let h = 0;
    for (const ln of lines) {
        doc.fontSize(ln.size);
        h += doc.heightOfString(ln.str, { width }) + ln.gap;
    }
    return h;
}

interface BandOpts {
    x: number; width: number;
    qr: { payload: string; caption: string } | null;
    qrSize: number;
    footer?: { size?: number; color?: string; align?: "left" | "center" };
}

// Нижняя полоса документа: подвал слева, QR справа — одинаково во всех десяти шаблонах.
// Высота полосы измеряется по фактическому содержимому, а не берётся константой.
interface Band { h: number; top: number; draw: () => void }
function footBand(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, o: BandOpts): Band {
    const lines = footerLines(d, s, L, o.footer?.size ?? 9, o.footer?.color);
    const footW = o.width - (o.qr ? o.qrSize + QR_GAP : 0);
    const h = Math.max(footerHeight(doc, lines, footW), qrBlockHeight(doc, o.qr, o.qrSize, L));
    const top = MAX_Y - BRAND_H - BRAND_GAP - h;
    return {
        h, top,
        draw: () => {
            let cy = top;
            for (const ln of lines) cy += text(doc, ln.str, o.x, cy, { size: ln.size, color: ln.color, width: footW, align: o.footer?.align }) + ln.gap;
            qrBlock(doc, o.qr, o.x + o.width - o.qrSize, top, o.qrSize, L, "right");
        },
    };
}

// Копирайт-строка фирмы в самом низу страницы — вне блоков шаблона, чтобы не мешать подписям и QR.
// Печатается на каждой странице, всегда внутри нижнего поля.
function footerBrand(doc: Doc, s: PdfSettings, t: TemplateDef) {
    const line = [s.legalName, s.registerNumber, s.taxId, s.vatId].filter(Boolean).join(" · ");
    if (!line) return;
    const size = 7;
    const width = PAGE_W - t.margin * 2;
    doc.fontSize(size);
    const str = oneLine(doc, line, size, width);
    const h = doc.heightOfString(str, { width });
    text(doc, str, t.margin, MAX_Y - h - 0.5, { size, color: "#B3B3B3", width, align: "center" });
}

// --- поток страниц -------------------------------------------------------------------------------------

// Как только содержимое перестаёт помещаться, страница заканчивается (строка бренда), открывается
// новая и на ней повторяется шапка-продолжение. Раньше pdfkit сам добавлял страницу по последней
// строке — отсюда и «второй лист из одной серой строчки», и наложение подвала на таблицу.
interface Flow {
    bottom: number; // докуда можно рисовать содержимое на любой странице
    fit: (y: number, h: number) => number; // пропустить блок только при достатке места
    brk: () => number; // новая страница, возвращает y содержимого
}
function flow(doc: Doc, s: PdfSettings, t: TemplateDef, band: Band, contHeader: () => number): Flow {
    const bottom = Math.max(band.top - CONTENT_GAP, t.margin + 80);
    const brk = () => { footerBrand(doc, s, t); doc.addPage(); return contHeader(); };
    return { bottom, brk, fit: (y, h) => (y + h > bottom ? brk() : y) };
}

// Шапка листа-продолжения: номер документа и даты — иначе вторая страница выглядит оторванной от первой
function contHeader(doc: Doc, d: PdfDocumentData, L: L, t: TemplateDef, x: number, w: number): number {
    const hw = headerWidth(w);
    let y = t.margin;
    y += text(doc, `${title(d, L)} — ${L.continued}`, x, y, { size: 10, color: t.accent, width: hw });
    y += text(doc, dateLines(d, L).join("     "), x, y + 2, { size: 9, color: "#666666", width: hw }) + 8;
    rule(doc, x, y, x + w, "#E6E6E6");
    return y + 14;
}

// --- таблица позиций и итоги ---------------------------------------------------------------------------

interface TableOpts {
    x: number; width: number; accent: string; tint: string;
    size?: number; rowPad?: number; headerFill?: boolean; grid?: boolean; zebra?: boolean; border?: string;
    noPrices?: boolean; // накладная: печатаем только наименование и количество
    bottom?: number; // предел содержимого страницы
    onBreak?: () => number; // перенос строки на новую страницу: возвращает y после шапки
}

// Таблица позиций: опции делают её плотной (compact), с сеткой (boxed) или с акцентной шапкой (modern/twocol).
// Длинная таблица рвётся по строкам с повтором шапки, а не уезжает за нижнее поле.
function itemsTable(doc: Doc, d: PdfDocumentData, L: L, y: number, o: TableOpts): number {
    // В накладной цен нет по определению — решаем это здесь, а не в каждом из десяти шаблонов
    if (d.kind === "delivery_note") o = { ...o, noPrices: true };
    const size = o.size ?? 10;
    const pad = o.rowPad ?? 6;
    const cols = { desc: o.x, qty: o.x + o.width - 245, price: o.x + o.width - 185, tax: o.x + o.width - 105, total: o.x + o.width - 65 };
    const widths = { qty: 50, price: 60, tax: 40, total: 65 };
    const headerH = size + pad;
    const drawHeader = (yy: number): number => {
        if (o.headerFill) box(doc, o.x, yy, o.width, headerH, { fill: o.accent });
        const headerColor = o.headerFill ? "#FFFFFF" : "#999999";
        const hy = yy + pad / 2;
        text(doc, L.description, cols.desc, hy, { size: size - 1, color: headerColor });
        text(doc, L.qty, cols.qty, hy, { size: size - 1, color: headerColor, width: widths.qty, align: "right" });
        if (!o.noPrices) {
            text(doc, L.unitPrice, cols.price, hy, { size: size - 1, color: headerColor, width: widths.price, align: "right" });
            text(doc, L.tax, cols.tax, hy, { size: size - 1, color: headerColor, width: widths.tax, align: "right" });
            text(doc, L.lineTotal, cols.total, hy, { size: size - 1, color: headerColor, width: widths.total, align: "right" });
        }
        const top = yy + headerH;
        if (!o.headerFill) rule(doc, o.x, top - pad / 2, o.x + o.width, o.border ?? "#E6E6E6");
        return top;
    };
    const rowH = (it: PdfLineItem) => Math.max(doc.fontSize(size).heightOfString(it.description, { width: cols.qty - o.x - 6 }), size) + pad;
    const bottom = o.bottom ?? Number.POSITIVE_INFINITY;
    // Шапка не должна отрываться от первой строки: если они вместе не помещаются — переносим заранее
    if (o.onBreak && d.items.length && y + headerH + rowH(d.items[0]) > bottom) y = o.onBreak();
    let top = drawHeader(y);
    let pageTop = top;
    let row = 0;
    for (const it of d.items) {
        const h = rowH(it);
        // Строку переносим только если на этой странице уже есть строки — иначе получилась бы петля
        if (o.onBreak && top + h > bottom && top > pageTop) { top = drawHeader(o.onBreak()); pageTop = top; }
        if (o.zebra && row % 2 === 1) box(doc, o.x, top, o.width, h, { fill: o.tint });
        if (o.grid) box(doc, o.x, top, o.width, h, { stroke: o.border ?? "#E6E6E6" });
        const ty = top + pad / 2;
        text(doc, it.description, cols.desc, ty, { size, color: "#333333", width: cols.qty - o.x - 6 });
        text(doc, String(it.qty), cols.qty, ty, { size, color: "#333333", width: widths.qty, align: "right" });
        if (!o.noPrices) {
            text(doc, fmt(it.unitPrice, d.currency), cols.price, ty, { size, color: "#333333", width: widths.price, align: "right" });
            // у документа без налога в колонке ставки стоит прочерк: печатать там 19 % при нулевом налоге — противоречие
            text(doc, d.smallBusinessNote ? "—" : `${it.taxRate}%`, cols.tax, ty, { size, color: "#333333", width: widths.tax, align: "right" });
            text(doc, fmt(it.qty * it.unitPrice, d.currency), cols.total, ty, { size, color: "#333333", width: widths.total, align: "right" });
        }
        top += h;
        row++;
    }
    rule(doc, o.x, top, o.x + o.width, o.border ?? "#E6E6E6");
    return top;
}

// Итоги: нетто, налог (кроме пометки малого бизнеса) и итог. В рамке, на подложке или просто справа — по шаблону.
function totalsRows(d: PdfDocumentData, L: L, totals: ReturnType<typeof computeTotals>): [string, string, boolean][] {
    const rows: [string, string, boolean][] = [[L.net, fmt(totals.net, d.currency), false]];
    // Освобождённый документ: строки налога нет вовсе, итог равен нетто (считает computeTotals).
    // Документ с налогом: печатаем сумму по КАЖДОЙ ставке — при смешанных 19 % и 7 % одной общей
    // цифры недостаточно, этого требует §14 Abs. 4 Nr. 8 UStG.
    if (!totals.exempt) {
        const breakdown = taxBreakdown(d.items, { exempt: totals.exempt });
        if (breakdown.length <= 1) rows.push([L.taxTotal, fmt(totals.tax, d.currency), false]);
        else for (const b of breakdown) rows.push([`${L.taxTotal} ${b.rate}% ${L.taxOn} ${fmt(b.net, d.currency)}`, fmt(b.tax, d.currency), false]);
    }
    const dunningFee = Number(d.dunningFee) || 0;
    if (dunningFee > 0) rows.push([L.dunningFee, fmt(dunningFee, d.currency), false]);
    rows.push([L.gross, fmt(totals.gross + dunningFee, d.currency), true]);
    return rows;
}

// Высоты строк итогов: подпись вида «USt. 19 % auf 1.800,00 €» при узком блоке переносится,
// поэтому строку меряем, а не считаем по одной константе — иначе строки налезали друг на друга.
function totalsMetrics(doc: Doc, d: PdfDocumentData, L: L, totals: ReturnType<typeof computeTotals>, w: number, size: number) {
    const rows = totalsRows(d, L, totals);
    const heights = rows.map(([label, , strong]) => {
        doc.fontSize(strong ? size + 1 : size);
        return Math.max(doc.heightOfString(label, { width: w - 100 }), size + 7);
    });
    return { rows, heights, h: heights.reduce((a, b) => a + b, 0) + 12 };
}

// Высота блока итогов — чтобы шаблон мог заранее решить, поместится ли он на странице
function totalsHeight(doc: Doc, d: PdfDocumentData, L: L, totals: ReturnType<typeof computeTotals>, w: number, size = 10): number {
    return totalsMetrics(doc, d, L, totals, w, size).h;
}

function totalsBlock(doc: Doc, d: PdfDocumentData, L: L, totals: ReturnType<typeof computeTotals>, x: number, y: number, w: number, o: { accent: string; tint: string; boxed?: boolean; size?: number; grid?: boolean }) {
    // У накладной нет сумм: это документ о передаче товара, а не о деньгах
    if (d.kind === "delivery_note") return y;
    const size = o.size ?? 10;
    const { rows, heights, h } = totalsMetrics(doc, d, L, totals, w, size);
    const top = y + 8;
    if (o.boxed) {
        box(doc, x, top - 6, w, h, { fill: o.tint, stroke: o.grid ? o.accent : undefined });
        box(doc, x, top - 6, 3, h, { fill: o.accent });
    }
    let ty = top;
    rows.forEach(([label, value, strong], i) => {
        text(doc, label, x + 12, ty, { size: strong ? size + 1 : size, color: strong ? "#333333" : "#666666", width: w - 100 });
        text(doc, value, x + w - 88, ty, { size: strong ? size + 1 : size, color: strong ? "#333333" : "#666666", width: 76, align: "right" });
        ty += heights[i];
    });
    if (!o.boxed) { rule(doc, x + 12, top - 6, x + w - 12, "#E6E6E6"); rule(doc, x + 12, ty - heights[heights.length - 1] + 2, x + w - 12, o.accent, 0.8); }
    return ty;
}

// --- шаблоны -------------------------------------------------------------------------------------------

type Layout = (doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L, t: TemplateDef, totals: ReturnType<typeof computeTotals>, qr: { payload: string; caption: string } | null) => void;

// Классика: реквизиты продавца сверху, документ слева, таблица с линейкой, итоги справа, подвал с QR
const classic: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2, hw = headerWidth(w);
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 78 });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    let y = t.margin;
    for (const line of senderLines(s)) y += text(doc, line, x, y, { size: 9, color: "#666666", width: w / 2 }) + 1;
    y += 14;
    y += text(doc, title(d, L), x, y, { size: 20, color: "#333333", width: hw }) + 4;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 11, color: "#666666", width: hw }) + 2;
    for (const line of dateLines(d, L)) y += text(doc, line, x, y, { size: 10, color: "#666666", width: hw }) + 1;
    y += 14;
    y += labelled(doc, L.billTo, "", x, y, {}) + 2;
    for (const line of partyLines(d.customer)) y += text(doc, line, x, y, { size: 10, color: "#333333", width: w / 2 }) + 1;
    y += 18;
    // Логотип — в правом верхнем углу, поверх ничего не рисуется: реквизиты, даты и покупатель идут
    // колонками до x + w/2 или ограничены headerWidth
    logoDraw(doc, s, logoSlotTopRight(t));
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 6, totalsHeight(doc, d, L, totals, 200));
        y = totalsBlock(doc, d, L, totals, x + w - 200, y + 6, 200, { accent: t.accent, tint: t.tint });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12, width: hw });
    band.draw();
};

// Современный: акцентная полоса сверху, шапка таблицы на цвете, зебра, итоги в цветной рамке, QR справа
const modern: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2, hw = headerWidth(w);
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 86 });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    box(doc, x, t.margin, w, 78, { fill: t.tint });
    box(doc, x, t.margin, 5, 78, { fill: t.accent });
    text(doc, L[d.kind].toUpperCase(), x + 18, t.margin + 16, { size: 9, color: t.accent, width: w - 36 });
    text(doc, d.number, x + 18, t.margin + 30, { size: 22, color: "#333333", width: hw });
    if (d.kind === "credit_note" && d.creditForNumber) text(doc, `${L.creditFor} ${d.creditForNumber}`, x + 18, t.margin + 62, { size: 9, color: "#666666", width: hw });
    // Логотип ставим ПОД полосой, а не на неё: полоса непрозрачная, картинка на ней не читается
    logoDraw(doc, s, { x: PAGE_W - t.margin - LOGO_MAX_W, y: t.margin + 78 + 8, w: LOGO_MAX_W, h: LOGO_MAX_H });
    let y = t.margin + 94;
    const send = senderLines(s);
    for (const line of send) y += text(doc, line, x, y, { size: 9, color: "#666666", width: hw, align: "right" }) + 1;
    y += 12;
    const labH = labelled(doc, L.billTo, d.customer.name || "—", x, y, { labelColor: t.accent, size: 11 });
    let dy = y;
    for (const line of dateLines(d, L)) dy += text(doc, line, x + w / 2, dy, { size: 10, color: "#666666", width: w / 2, align: "right" }) + 1;
    let py = y + labH + 3;
    for (const line of [d.customer.address, d.customer.taxId].filter(Boolean) as string[]) py += text(doc, line, x, py, { size: 10, color: "#333333", width: w / 2 }) + 1;
    y = Math.max(py, dy) + 20;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, headerFill: true, zebra: true, bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 8, totalsHeight(doc, d, L, totals, 210));
        y = totalsBlock(doc, d, L, totals, x + w - 210, y + 8, 210, { accent: t.accent, tint: t.tint, boxed: true, size: 10 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12, width: hw });
    band.draw();
};

// Минимализм: без цвета и рамок, только тонкие линейки, широкие поля
const minimal: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2, hw = headerWidth(w);
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 74, footer: { color: "#999999" } });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    let y = t.margin;
    y += text(doc, senderLines(s).join("  ·  "), x, y, { size: 8.5, color: "#999999", width: hw }) + 10;
    rule(doc, x, y, x + hw, "#E6E6E6");
    y += 22;
    y += text(doc, L[d.kind].toUpperCase(), x, y, { size: 11, color: "#111111", width: hw }) + 2;
    y += text(doc, d.number, x, y, { size: 24, color: "#111111", width: hw }) + 8;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 9, color: "#999999", width: hw }) + 2;
    y += text(doc, dateLines(d, L).join("     "), x, y, { size: 9, color: "#666666", width: hw }) + 24;
    y += text(doc, L.billTo.toUpperCase(), x, y, { size: 7.5, color: "#999999", width: hw }) + 2;
    for (const line of partyLines(d.customer)) y += text(doc, line, x, y, { size: 11, color: "#333333", width: w }) + 1;
    y += 26;
    logoDraw(doc, s, logoSlotTopRight(t));
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 10, rowPad: 9, bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 10, totalsHeight(doc, d, L, totals, 190));
        y = totalsBlock(doc, d, L, totals, x + w - 190, y + 10, 190, { accent: t.accent, tint: t.tint, size: 10 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12, width: hw });
    band.draw();
};

// Рамки: продавец и покупатель в рамках, таблица с полной сеткой, итоги в рамке
const boxed: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2, hw = headerWidth(w);
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 80 });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    // Заголовок и даты живут в левой колонке и обрываются до рамки продавца (bx = x + w - 220),
    // иначе их строки формально заходили под рамку
    const titleW = Math.min(hw, w - 250);
    let y = t.margin;
    y += text(doc, title(d, L), x, y, { size: 19, color: t.accent, width: titleW }) + 2;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 10, color: "#666666", width: titleW }) + 2;
    for (const line of dateLines(d, L)) y += text(doc, line, x, y, { size: 10, color: "#666666", width: titleW }) + 1;
    // Продавец — в рамке справа от заголовка. Высота рамки считается по строкам реквизитов,
    // чтобы логотип встал точно под рамкой, а не внутри неё.
    const bx = x + w - 220;
    const send = senderLines(s);
    doc.fontSize(7);
    let sellerH = 10 + doc.heightOfString(L.seller.toUpperCase(), { width: 196 }) + 2;
    doc.fontSize(9);
    for (const line of send) sellerH += doc.heightOfString(line, { width: 196 }) + 1;
    sellerH += 8;
    box(doc, bx, t.margin, 220, sellerH, { fill: t.tint, stroke: "#DCDCDC" });
    let by = t.margin + 10;
    by += text(doc, L.seller.toUpperCase(), bx + 12, by, { size: 7, color: "#999999", width: 196 }) + 2;
    for (const line of send) by += text(doc, line, bx + 12, by, { size: 9, color: "#333333", width: 196 }) + 1;
    y = Math.max(y, by) + 16;
    logoDraw(doc, s, { x: PAGE_W - t.margin - LOGO_MAX_W, y: t.margin + sellerH + 8, w: LOGO_MAX_W, h: LOGO_MAX_H });
    const party = partyLines(d.customer);
    doc.fontSize(7);
    let partyH = 8 + doc.heightOfString(L.billTo.toUpperCase(), { width: 226 }) + 2;
    doc.fontSize(10);
    for (const line of party) partyH += doc.heightOfString(line, { width: 226 }) + 1;
    partyH += 8;
    const py = y;
    box(doc, x, py, 250, partyH, { fill: t.tint, stroke: "#DCDCDC" });
    let yy = py + 8;
    yy += text(doc, L.billTo.toUpperCase(), x + 12, yy, { size: 7, color: "#999999", width: 226 }) + 2;
    for (const line of party) yy += text(doc, line, x + 12, yy, { size: 10, color: "#333333", width: 226 }) + 1;
    y = Math.max(yy + 8, py + partyH) + 10;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, grid: true, border: "#DCDCDC", bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 8, totalsHeight(doc, d, L, totals, 210));
        y = totalsBlock(doc, d, L, totals, x + w - 210, y + 8, 210, { accent: t.accent, tint: t.tint, boxed: true, grid: true });
    } else if (d.kind === "contract") {
        box(doc, x, y, 250, 40, { fill: t.tint, stroke: "#DCDCDC" });
        text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x + 12, y + 14, { size: 12, color: "#333333", width: 226 });
        y += 50;
    }
    band.draw();
};

// Боковая колонка: слева цветная полоса с логотипом и реквизитами продавца, содержимое сдвинуто вправо
const sidebar: Layout = (doc, d, s, L, t, totals, qr) => {
    const col = 148;
    const x = col + 34, w = PAGE_W - x - t.margin;
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 100 });
    // Колонка продавца повторяется на каждой странице — вместе с логотипом, чтобы лист-продолжение
    // не выглядел чужим
    const panel = () => {
        box(doc, 0, 0, col, PAGE_H, { fill: t.tint });
        box(doc, col, 0, 3, PAGE_H, { fill: t.accent });
        let sy = t.margin + 6;
        const lg = logoDraw(doc, s, { x: 24, y: sy, w: col - 48, h: LOGO_MAX_H });
        if (lg) sy += lg.h + 12;
        sy += text(doc, L.seller.toUpperCase(), 24, sy, { size: 7.5, color: t.accent, width: col - 48 }) + 4;
        for (const line of senderLines(s)) sy += text(doc, line, 24, sy, { size: 9, color: "#333333", width: col - 48 }) + 2;
    };
    const header = (): number => {
        let y = t.margin + 6;
        y += text(doc, title(d, L), x, y, { size: 20, color: "#333333", width: w }) + 4;
        if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 10, color: "#666666", width: w }) + 2;
        for (const line of dateLines(d, L)) y += text(doc, line, x, y, { size: 10, color: "#666666", width: w }) + 1;
        y += 16;
        y += labelled(doc, L.billTo, partyLines(d.customer)[0], x, y, { labelColor: t.accent }) + 4;
        for (const line of partyLines(d.customer).slice(1)) y += text(doc, line, x, y, { size: 10, color: "#333333", width: w }) + 1;
        return y + 18;
    };
    const fl = flow(doc, s, t, band, () => { panel(); return contHeader(doc, d, L, t, x, w); });
    panel();
    let y = header();
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 9.5, headerFill: true, bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 8, totalsHeight(doc, d, L, totals, 190));
        y = totalsBlock(doc, d, L, totals, x + w - 190, y + 8, 190, { accent: t.accent, tint: t.tint });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12 });
    band.draw();
};

// Баннер: цветная шапка во всю ширину, ниже две колонки (продавец и покупатель), таблица с акцентной шапкой
const banner: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2;
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 84 });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    box(doc, 0, 0, PAGE_W, 104, { fill: t.accent });
    box(doc, 0, 104, PAGE_W, 4, { fill: t.tint });
    text(doc, L[d.kind].toUpperCase(), x, 30, { size: 10, color: "#FFFFFF", width: w / 2 });
    text(doc, d.number, x, 46, { size: 26, color: "#FFFFFF", width: w / 2 });
    // Строка кредит-ноты ниже номера: вплотную она смыкалась с его строкой (дефект старых версий)
    if (d.kind === "credit_note" && d.creditForNumber) text(doc, `${L.creditFor} ${d.creditForNumber}`, x, 84, { size: 9, color: "#EAF3FA", width: w / 2 });
    let dy = 34;
    for (const line of dateLines(d, L)) dy += text(doc, line, x + w / 2, dy, { size: 10, color: "#FFFFFF", width: w / 2, align: "right" }) + 1;
    // Логотип — под полосой: она непрозрачная и закрасила бы картинку
    const lg = logoDraw(doc, s, { x: PAGE_W - t.margin - LOGO_MAX_W, y: 108 + 8, w: LOGO_MAX_W, h: LOGO_MAX_H });
    let y = lg ? 116 + lg.h + 14 : 126;
    const colW = (w - 24) / 2;
    let ly = y;
    ly += text(doc, L.seller.toUpperCase(), x, ly, { size: 7.5, color: t.accent, width: colW }) + 2;
    for (const line of senderLines(s)) ly += text(doc, line, x, ly, { size: 9.5, color: "#333333", width: colW }) + 1;
    let ry = y;
    ry += text(doc, L.billTo.toUpperCase(), x + colW + 24, ry, { size: 7.5, color: t.accent, width: colW }) + 2;
    for (const line of partyLines(d.customer)) ry += text(doc, line, x + colW + 24, ry, { size: 10, color: "#333333", width: colW }) + 1;
    y = Math.max(ly, ry) + 20;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, headerFill: true, bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 8, totalsHeight(doc, d, L, totals, 205));
        y = totalsBlock(doc, d, L, totals, x + w - 205, y + 8, 205, { accent: t.accent, tint: t.tint });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12 });
    band.draw();
};

// Две колонки: слева продавец, справа покупатель, под ними полоса дат
const twocol: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2, hw = headerWidth(w);
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 82 });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    let y = t.margin;
    y += text(doc, title(d, L), x, y, { size: 18, color: t.accent, width: hw }) + 4;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 10, color: "#666666", width: hw }) + 2;
    y += 12;
    const colW = (w - 16) / 2;
    // Высота колонок — по фактическим строкам реквизитов: при полном наборе настроек
    // фиксированные 96 pt заканчивались раньше текста
    doc.fontSize(7);
    let boxH = 10 + doc.heightOfString(L.seller.toUpperCase(), { width: colW - 24 }) + 2;
    doc.fontSize(9);
    for (const line of senderLines(s)) boxH += doc.heightOfString(line, { width: colW - 24 }) + 1;
    let partyBoxH = 10 + doc.heightOfString(L.billTo.toUpperCase(), { width: colW - 24 }) + 2;
    for (const line of partyLines(d.customer)) partyBoxH += doc.heightOfString(line, { width: colW - 24 }) + 1;
    boxH = Math.max(boxH, partyBoxH) + 12;
    // Логотип занимает правый верхний угол, поэтому подложки колонок начинаются ниже него:
    // иначе непрозрачная подложка закрасила бы картинку
    const slot = logoSlotTopRight(t);
    const lg = logoSize(doc, s, slot);
    y = Math.max(y, lg ? slot.y + lg.h + 10 : y);
    box(doc, x, y, colW, boxH, { fill: t.tint });
    box(doc, x + colW + 16, y, colW, boxH, { fill: t.tint });
    let ly = y + 10;
    ly += text(doc, L.seller.toUpperCase(), x + 12, ly, { size: 7, color: t.accent, width: colW - 24 }) + 2;
    for (const line of senderLines(s)) ly += text(doc, line, x + 12, ly, { size: 9, color: "#333333", width: colW - 24 }) + 1;
    let ry = y + 10;
    ry += text(doc, L.billTo.toUpperCase(), x + colW + 28, ry, { size: 7, color: t.accent, width: colW - 24 }) + 2;
    for (const line of partyLines(d.customer)) ry += text(doc, line, x + colW + 28, ry, { size: 10, color: "#333333", width: colW - 24 }) + 1;
    y += boxH + 12;
    logoDraw(doc, s, slot);
    // полоса дат: подпись и значение в одну строку, ячейками. Высота ячеек считается по фактическому
    // переносу: длинная строка («Leistungszeitraum» или новый срок оплаты) переносится на две строки.
    const dates = dateLines(d, L);
    if (dates.length) {
        const cellW = w / dates.length;
        doc.fontSize(10);
        const cellH = Math.max(...dates.map((line) => doc.heightOfString(line, { width: cellW - 20 }))) + 20;
        box(doc, x, y, w, cellH, { stroke: "#E6E6E6" });
        dates.forEach((line, i) => text(doc, line, x + i * cellW + 10, y + 10, { size: 10, color: "#666666", width: cellW - 20 }));
        y += cellH + 12;
    } else y += 10;
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, headerFill: true, zebra: true, bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 8, totalsHeight(doc, d, L, totals, 205));
        y = totalsBlock(doc, d, L, totals, x + w - 205, y + 8, 205, { accent: t.accent, tint: t.tint, boxed: true });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12, width: hw });
    band.draw();
};

// Компактный: мелкий шрифт и плотные строки — длинный счёт помещается на одной странице
const compact: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2, hw = headerWidth(w);
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 60, footer: { size: 7.5 } });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    const slot = logoSlotTopRight(t);
    const lg = logoSize(doc, s, slot);
    let y = t.margin;
    y += text(doc, title(d, L), x, y, { size: 13, color: "#333333", width: hw }) + 1;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 8, color: "#666666", width: hw }) + 2;
    // Даты отдельной строкой под заголовком: раньше правый блок дат смыкался с заголовком в одной полосе
    y += text(doc, dateLines(d, L).join("   "), x, y, { size: 8.5, color: "#666666", width: hw }) + 6;
    y = Math.max(y, lg ? slot.y + lg.h + 6 : y);
    y += text(doc, [senderLines(s).join(" · "), partyLines(d.customer).join(" · ")].join("\n"), x, y, { size: 8, color: "#666666", width: w }) + 8;
    logoDraw(doc, s, slot);
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 8.5, rowPad: 3, zebra: true, bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 4, totalsHeight(doc, d, L, totals, 180, 8.5));
        y = totalsBlock(doc, d, L, totals, x + w - 180, y + 4, 180, { accent: t.accent, tint: t.tint, size: 8.5 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 10, width: hw });
    band.draw();
};

// Элегантный: всё по центру, подписи вразрядку, тонкие линейки, сдержанный цвет
const elegant: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2;
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 78, footer: { align: "left" } });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    let y = t.margin;
    // Центрированный шаблон: логотип встаёт по центру над реквизитами — правый верхний угол здесь
    // занят центрированными строками
    const lg = logoDraw(doc, s, { x: x + (w - LOGO_MAX_W) / 2, y: t.margin, w: LOGO_MAX_W, h: LOGO_MAX_H });
    if (lg) y = t.margin + lg.h + 10;
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
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 10, rowPad: 8, bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 12, totalsHeight(doc, d, L, totals, 210));
        y = totalsBlock(doc, d, L, totals, x + w - 210, y + 12, 210, { accent: t.accent, tint: t.tint, size: 10 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x, y, { size: 12, width: w, align: "center" });
    band.draw();
};

// Швейцарский: строгая сетка «подпись — значение», крупный номер, только линейки
const swiss: Layout = (doc, d, s, L, t, totals, qr) => {
    const x = t.margin, w = PAGE_W - t.margin * 2, hw = headerWidth(w);
    const band = footBand(doc, d, s, L, { x, width: w, qr, qrSize: 78, footer: { color: "#111111" } });
    const fl = flow(doc, s, t, band, () => contHeader(doc, d, L, t, x, w));
    let y = t.margin;
    text(doc, L[d.kind].toUpperCase(), x, y, { size: 8, color: "#666666", width: hw });
    y += 12;
    // Номер — под надписью вида документа: правый верхний угол отдан логотипу, крупная цифра
    // в нём налезала на картинку
    y += text(doc, d.number, x, y, { size: 26, color: "#111111", width: hw }) + 4;
    if (d.kind === "credit_note" && d.creditForNumber) y += text(doc, `${L.creditFor} ${d.creditForNumber}`, x, y, { size: 9, color: "#666666", width: hw }) + 4;
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
    logoDraw(doc, s, logoSlotTopRight(t));
    if (d.items.length) {
        y = itemsTable(doc, d, L, y, { x, width: w, accent: t.accent, tint: t.tint, size: 9.5, rowPad: 5, border: "#111111", bottom: fl.bottom, onBreak: fl.brk });
        y = fl.fit(y + 6, totalsHeight(doc, d, L, totals, 220, 9.5));
        y = totalsBlock(doc, d, L, totals, x + w - 220, y + 6, 220, { accent: t.accent, tint: t.tint, grid: true, size: 9.5 });
    } else if (d.kind === "contract") y += text(doc, `${L.contractValue}: ${fmt(Number(d.value) || 0, d.currency)}`, x + labelW, y, { size: 12, color: "#111111", width: w - labelW });
    band.draw();
};

const LAYOUTS: Record<string, Layout> = {
    classic, modern, minimal, boxed, sidebar, banner, twocol, compact, elegant, swiss,
};

// Точка входа: считает суммы, решает, нужен ли QR на оплату, и отдаёт документ выбранному шаблону
export function renderLayout(doc: Doc, d: PdfDocumentData, s: PdfSettings, L: L) {
    const t = templateDef(d.template || s.template);
    // Освобождение от налога считается здесь же: и в итогах, и в сумме QR-кода должна стоять одна и та же цифра.
    const totals = computeTotals(d.items, { exempt: !!d.smallBusinessNote });
    // В сумму к оплате входит и сбор за напоминание — иначе клиент заплатит меньше, чем должен
    const dueTotal = totals.gross + (Number(d.dunningFee) || 0);
    const qr = (s.paymentQr ?? true) ? qrPayloadFor(d, s, L, dueTotal) : null;
    (LAYOUTS[t.id] ?? classic)(doc, d, s, L, t, totals, qr);
    footerBrand(doc, s, t);
}
