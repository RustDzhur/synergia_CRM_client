import PDFDocument from "pdfkit";
import { DOC_FONT } from "./pdf";

// Печать складского документа (ТЗ §12): приход/расход/перемещение/списание/излишки/инвентаризация.
// Это внутренняя бумага, а не документ для клиента, поэтому она рисуется отдельным простым рендером,
// а не десятью шаблонами счетов: набор реквизитов у неё свой (два склада, строки, подписи сдал/принял,
// у инвентаризации — учёт, факт и расхождение).

export interface StockDocPdfData {
	number: string;
	kind: string;
	date: string;
	warehouseFrom: string;
	warehouseTo: string;
	note: string;
	by: string;
	reversed: boolean;
	lines: Array<{ name: string; sku: string; unit: string; qty: number; price: number; diff: number }>;
}

export interface StockDocPdfSettings {
	legalName: string;
	address: string;
	taxId: string;
	/** Рынок фирмы: украинской документ печатается по-украински независимо от языка интерфейса */
	market: "DE" | "UA" | null;
}

const L: Record<string, Record<string, string>> = {
	ua: {
		receipt: "Прибуткова накладна (внутрішня)", issue: "Видаткова накладна (внутрішня)", transfer: "Накладна на переміщення",
		surplus: "Оприбуткування надлишків", writeoff: "Акт списання", inventory: "Інвентаризаційний опис",
		date: "Дата", warehouse: "Склад", from: "Звідки", to: "Куди", note: "Примітка", postedBy: "Провів", reversed: "СКАСОВАНО (сторно)",
		colNum: "№", colItem: "Товар", colSku: "Артикул", colUnit: "Од.", colQty: "К-сть", colBook: "За обліком", colDiff: "Розходження", colPrice: "Собівартість", colSum: "Сума",
		signedBy: "Здав", acceptedBy: "Прийняв",
	},
	de: {
		receipt: "Wareneingang (intern)", issue: "Warenausgang (intern)", transfer: "Umlagerungsschein",
		surplus: "Inventurüberschuss", writeoff: "Abschreibungsakt", inventory: "Inventurliste",
		date: "Datum", warehouse: "Lager", from: "Von", to: "Nach", note: "Anmerkung", postedBy: "Gebucht von", reversed: "STORNIERT",
		colNum: "Nr.", colItem: "Artikel", colSku: "Art.-Nr.", colUnit: "Einh.", colQty: "Menge", colBook: "Laut Bestand", colDiff: "Abweichung", colPrice: "Kosten", colSum: "Summe",
		signedBy: "Übergeben", acceptedBy: "Übernommen",
	},
	en: {
		receipt: "Goods receipt (internal)", issue: "Goods issue (internal)", transfer: "Transfer note",
		surplus: "Stock surplus posting", writeoff: "Write-off act", inventory: "Inventory sheet",
		date: "Date", warehouse: "Warehouse", from: "From", to: "To", note: "Note", postedBy: "Posted by", reversed: "REVERSED",
		colNum: "#", colItem: "Item", colSku: "SKU", colUnit: "Unit", colQty: "Qty", colBook: "On record", colDiff: "Difference", colPrice: "Cost", colSum: "Amount",
		signedBy: "Handed over", acceptedBy: "Received",
	},
};

export function stockDocPdfBuffer(doc: StockDocPdfData, s: StockDocPdfSettings, locale = "ua"): Promise<Buffer> {
	// Украинская фирма печатает по-украински, остальные — на языке интерфейса
	const lang = s.market === "UA" ? "ua" : (L[locale] ? locale : "en");
	const Lx = L[lang];
	return new Promise((resolve, reject) => {
		const pdf = new PDFDocument({ size: "A4", margin: 50, font: DOC_FONT as unknown as string });
		const chunks: Buffer[] = [];
		pdf.on("data", (c: Buffer) => chunks.push(c));
		pdf.on("end", () => resolve(Buffer.concat(chunks)));
		pdf.on("error", reject);

		const x = 50;
		const w = 595.28 - 100;
		const bottom = 841.89 - 50;
		let y = 50;

		const line = (str: string, opts: { size?: number; color?: string; width?: number; align?: "left" | "right" | "center"; bold?: boolean } = {}) => {
			pdf.fontSize(opts.size ?? 10).fillColor(opts.color ?? "#333333");
			pdf.text(str, x, y, { width: opts.width ?? w, align: opts.align });
			y += pdf.heightOfString(str, { width: opts.width ?? w }) + (opts.size && opts.size > 12 ? 6 : 2);
		};
		const maybeBreak = (need: number) => {
			if (y + need > bottom - 80) {
				pdf.addPage();
				y = 50;
			}
		};

		// Шапка: фирма
		if (s.legalName) line(s.legalName, { size: 12 });
		if (s.address) line(s.address, { size: 9, color: "#666666" });
		if (s.taxId) line(s.taxId, { size: 9, color: "#666666" });
		y += 10;

		// Заголовок и номер
		line(`${Lx[doc.kind] ?? doc.kind} № ${doc.number}`, { size: 16 });
		line(`${Lx.date}: ${doc.date}`, { size: 10, color: "#555555" });
		const route = [doc.warehouseFrom, doc.warehouseTo].filter(Boolean).join(" → ");
		if (route) line(`${Lx.warehouse}: ${route}`, { size: 10, color: "#555555" });
		if (doc.by) line(`${Lx.postedBy}: ${doc.by}`, { size: 10, color: "#555555" });
		if (doc.reversed) line(Lx.reversed, { size: 11, color: "#B00020" });
		if (doc.note) line(`${Lx.note}: ${doc.note}`, { size: 10, color: "#555555" });
		y += 8;

		// Колонки строк: у инвентаризации — учёт и расхождение, у остальных — количество и стоимость
		const inventory = doc.kind === "inventory";
		const cols = inventory
			? { num: x, item: x + 24, sku: x + w - 250, unit: x + w - 160, qty: x + w - 110, book: x + w - 70, diff: x + w - 10, price: 0, sum: 0 }
			: { num: x, item: x + 24, sku: x + w - 250, unit: x + w - 160, qty: x + w - 100, book: 0, diff: 0, price: x + w - 60, sum: x + w - 10 };
		const header = () => {
			pdf.fontSize(8).fillColor("#999999");
			const top = y;
			const cell = (str: string, cx: number, o: { align?: "right"; width?: number } = {}) => pdf.text(str, cx, top, { width: o.width ?? 60, align: o.align ?? "left" });
			cell(Lx.colNum, cols.num, { width: 20 });
			cell(Lx.colItem, cols.item, { width: cols.sku - cols.item - 6 });
			cell(Lx.colSku, cols.sku, { width: 84 });
			cell(Lx.colUnit, cols.unit, { width: 44 });
			if (inventory) {
				cell(Lx.colQty, cols.qty, { align: "right", width: 46 });
				cell(Lx.colBook, cols.book, { align: "right", width: 46 });
				cell(Lx.colDiff, cols.diff, { align: "right", width: 50 });
			} else {
				cell(Lx.colQty, cols.qty, { align: "right", width: 46 });
				cell(Lx.colPrice, cols.price, { align: "right", width: 46 });
				cell(Lx.colSum, cols.sum, { align: "right", width: 60 });
			}
			y += 12;
			pdf.moveTo(x, y - 3).lineTo(x + w, y - 3).lineWidth(0.5).strokeColor("#DDDDDD").stroke();
		};
		header();

		// Строки
		let total = 0;
		doc.lines.forEach((l, i) => {
			maybeBreak(16 + 80);
			const height = Math.max(pdf.fontSize(9).heightOfString(l.name || "—", { width: cols.sku - cols.item - 6 }), 10) + 3;
			const ty = y;
			const cell = (str: string, cx: number, o: { align?: "right"; width?: number; color?: string } = {}) => {
				pdf.fontSize(9).fillColor(o.color ?? "#333333").text(str, cx, ty, { width: o.width ?? 60, align: o.align ?? "left" });
			};
			const fmtQty = (n: number) => (Math.round(n * 1000) / 1000).toString().replace(".", ",");
			const fmtSum = (n: number) => n.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
			if (i % 2 === 1) pdf.rect(x, ty - 2, w, height + 2).fill("#F7F7F7");
			cell(String(i + 1), cols.num, { width: 20, color: "#666666" });
			cell(l.name || "—", cols.item, { width: cols.sku - cols.item - 6 });
			cell(l.sku, cols.sku, { width: 84, color: "#666666" });
			cell(l.unit, cols.unit, { width: 44, color: "#666666" });
			if (inventory) {
				cell(fmtQty(l.qty), cols.qty, { align: "right", width: 46 });
				cell(fmtQty(l.qty - l.diff), cols.book, { align: "right", width: 46, color: "#666666" });
				cell(`${l.diff > 0 ? "+" : ""}${fmtQty(l.diff)}`, cols.diff, { align: "right", width: 50, color: l.diff === 0 ? "#666666" : "#B00020" });
			} else {
				const sum = Math.round(l.qty * l.price * 100) / 100;
				total += sum;
				cell(fmtQty(l.qty), cols.qty, { align: "right", width: 46 });
				cell(l.price ? fmtSum(l.price) : "—", cols.price, { align: "right", width: 46, color: "#666666" });
				cell(l.price ? fmtSum(sum) : "—", cols.sum, { align: "right", width: 60 });
			}
			y = ty + height;
		});
		if (!inventory && total > 0) {
			pdf.moveTo(x, y).lineTo(x + w, y).lineWidth(0.5).strokeColor("#DDDDDD").stroke();
			y += 4;
			pdf.fontSize(10).fillColor("#333333").text(`${Lx.colSum}: ${total.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, cols.price - 40, y, { width: 60 + 40, align: "right" });
			y += 16;
		}

		// Подписи: сдал/принял
		y += 24;
		if (y > bottom - 60) {
			pdf.addPage();
			y = 80;
		}
		pdf.moveTo(x, y).lineTo(x + 180, y).lineWidth(0.5).strokeColor("#999999").stroke();
		pdf.moveTo(x + w - 180, y).lineTo(x + w, y).lineWidth(0.5).strokeColor("#999999").stroke();
		pdf.fontSize(9).fillColor("#666666").text(Lx.signedBy, x, y + 4, { width: 180 });
		pdf.text(Lx.acceptedBy, x + w - 180, y + 4, { width: 180 });

		pdf.end();
	});
}
