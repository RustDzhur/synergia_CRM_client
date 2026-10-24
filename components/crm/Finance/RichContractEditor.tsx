"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import toast from "react-hot-toast";
import {
	TbAlignCenter, TbAlignJustified, TbAlignLeft, TbAlignRight, TbArrowBackUp, TbArrowForwardUp, TbBold, TbClearFormatting, TbDots, TbItalic, TbLayoutList,
	TbLink, TbList, TbListNumbers, TbPhoto, TbSearch, TbSeparatorHorizontal, TbStrikethrough, TbTags, TbUnderline,
} from "react-icons/tb";
import { CATALOG, GROUP_LABEL, GROUP_ORDER, fieldOf, fieldsForCountry, labelOf, pickLang, type CatalogField, type Country } from "@/lib/finance/contractFields";
import { isHtmlBody, sanitizeHtml, textToHtml } from "@/lib/finance/contractHtml";
import { trFor } from "./contractUi";

// Редактор текста договора «как в Word» (docs/CONTRACT_EDITOR.md): панель форматирования, белый лист и поля-меточки прямо в тексте.
// Поля берутся из полосы под панелью (по группам, поиском, чипами или списком): перетаскиваются мышью в нужное место или вставляются кликом
// в позицию курсора. В тексте поле выглядит как цветная плашка с названием, хранится как <span data-field="ключ">{{ключ}}</span>.
// Реализация — contentEditable без внешних библиотек; сохраняется ограниченный HTML (lib/finance/contractHtml.ts), PDF рисует его сам.

export interface CustomField { key: string; label: string }
const MIME = "application/x-contract-field";
const ZWSP = "​";
const GROUP_COLOR = ["#C6FF4D", "#FFD166", "#FF6B6B", "#4ECDC4", "#A78BFA", "#F472B6", "#60A5FA", "#34D399", "#FB923C", "#2DD4BF", "#E879F9", "#94A3B8"];
const colorOf = (g: string) => GROUP_COLOR[Math.max(0, GROUP_ORDER.indexOf(g as never)) % GROUP_COLOR.length];

const PAPER_CSS = `
.rce-paper{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:14px;line-height:1.65;color:#17202a;caret-color:#17202a;outline:none;white-space:pre-wrap;word-break:break-word}
.rce-paper p{margin:0 0 .55em}
.rce-paper h1{font-size:1.9em;line-height:1.2;font-weight:800;margin:.2em 0 .5em;color:#0e1726}
.rce-paper h2{font-size:1.35em;line-height:1.3;font-weight:700;margin:.9em 0 .4em;color:#0e1726}
.rce-paper h3{font-size:1.12em;font-weight:700;margin:.8em 0 .35em;color:#0e1726}
.rce-paper ul,.rce-paper ol{margin:0 0 .6em;padding-left:1.6em}
.rce-paper ul{list-style:disc}.rce-paper ol{list-style:decimal}
.rce-paper a{color:#1a56db;text-decoration:underline}
.rce-paper hr{border:0;border-top:1px solid #c9d1da;margin:.9em 0}
.rce-paper img{max-width:100%;height:auto;display:inline-block}
.rce-paper .rce-chip{display:inline-block;padding:0 .5em;margin:0 .1em;border-radius:6px;background:#e3edff;color:#1a4fd1;font-weight:600;font-size:.92em;line-height:1.55;cursor:grab;user-select:all;white-space:nowrap;vertical-align:baseline}
.rce-paper .rce-chip[data-unknown]{background:#fff0d2;color:#a45a00}
.rce-paper .rce-chip.rce-sel{box-shadow:0 0 0 2px #1a56db55}
.rce-paper:empty:before{content:attr(data-placeholder);color:#8a94a0}
`;

interface Props {
	value: string;
	onChange: (html: string) => void;
	country: Country | null;
	customFields?: CustomField[];
	/** высота листа в пикселях (прокрутка внутри) */
	height?: number;
	/** полоса полей под панелью; false — компактный режим без неё */
	palette?: boolean;
	placeholder?: string;
	/** сигнал «текст пришёл снаружи» (загрузка файла): меняется — редактор перечитывает value */
	reloadKey?: number | string;
}

function labelFor(key: string, locale: string, custom: CustomField[]): { label: string; unknown: boolean } {
	const c = custom.find((x) => x.key.toLowerCase() === key.toLowerCase());
	if (c) return { label: c.label || c.key, unknown: false };
	const f = fieldOf(key);
	return f ? { label: labelOf(f, locale), unknown: false } : { label: `{{${key}}}`, unknown: true };
}

export default function RichContractEditor({ value, onChange, country, customFields = [], height = 460, palette = true, placeholder = "", reloadKey }: Props) {
	const locale = useLocale();
	const tr = trFor(locale);
	const rootRef = useRef<HTMLDivElement>(null);
	const savedRange = useRef<Range | null>(null);
	const lastEmitted = useRef<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const customRef = useRef(customFields);
	customRef.current = customFields;
	const [state, setState] = useState({ bold: false, italic: false, underline: false, strike: false, ul: false, ol: false, block: "p", align: "left" });
	const [moreOpen, setMoreOpen] = useState(false);
	const [linkOpen, setLinkOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");

	// ── поле-меточка в тексте ────────────────────────────────────────────────────────────────────────
	const makeChip = useCallback((key: string): HTMLElement => {
		const { label, unknown } = labelFor(key, locale, customRef.current);
		const el = document.createElement("span");
		el.className = "rce-chip";
		el.setAttribute("data-field", key);
		el.setAttribute("contenteditable", "false");
		el.setAttribute("draggable", "true");
		el.setAttribute("title", `{{${key}}}`);
		if (unknown) el.setAttribute("data-unknown", "1");
		el.textContent = label;
		return el;
	}, [locale]);

	/** HTML из хранилища → HTML редактора: канонические поля заменяются плашками. */
	const toEditorHtml = useCallback((html: string) => {
		const src = isHtmlBody(html) ? html : html.trim() ? textToHtml(html) : "<p><br></p>";
		const tpl = document.createElement("div");
		tpl.innerHTML = sanitizeHtml(src);
		tpl.querySelectorAll("span[data-field]").forEach((n) => n.replaceWith(makeChip(n.getAttribute("data-field") ?? "")));
		return tpl.innerHTML || "<p><br></p>";
	}, [makeChip]);

	/** Редактор → хранимый HTML: плашки возвращаются к каноническому виду, служебные символы убираются. */
	const serialize = useCallback((): string => {
		const root = rootRef.current;
		if (!root) return "";
		const clone = root.cloneNode(true) as HTMLElement;
		clone.querySelectorAll("span[data-field]").forEach((n) => { const k = n.getAttribute("data-field") ?? ""; while (n.attributes.length) n.removeAttribute(n.attributes[0].name); n.setAttribute("data-field", k); n.textContent = `{{${k}}}`; });
		const out = sanitizeHtml(clone.innerHTML.replace(/​/g, ""));
		return /^(<p><br><\/p>)?$/.test(out) ? "" : out;
	}, []);

	const emit = useCallback(() => {
		const html = serialize();
		if (html === lastEmitted.current) return;
		lastEmitted.current = html;
		onChange(html);
	}, [onChange, serialize]);

	// Значение пришло снаружи (открыли шаблон, загрузили файл): перечитываем, но не затираем то, что только что вышло из редактора
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		if (lastEmitted.current !== null && value === lastEmitted.current) return;
		root.innerHTML = toEditorHtml(value);
		lastEmitted.current = serialize();
	}, [value, reloadKey, toEditorHtml, serialize]);

	// Переименование полей (свои поля шаблона) — подписи плашек обновляются
	useEffect(() => {
		rootRef.current?.querySelectorAll("span[data-field]").forEach((n) => {
			const { label, unknown } = labelFor(n.getAttribute("data-field") ?? "", locale, customFields);
			if (n.textContent !== label) n.textContent = label;
			if (unknown) n.setAttribute("data-unknown", "1"); else n.removeAttribute("data-unknown");
		});
	}, [customFields, locale]);

	// ── выделение и состояние панели ────────────────────────────────────────────────────────────────
	useEffect(() => {
		const onSel = () => {
			const sel = window.getSelection();
			const root = rootRef.current;
			if (!sel || !root || !sel.rangeCount || !root.contains(sel.anchorNode)) return;
			savedRange.current = sel.getRangeAt(0).cloneRange();
			const q = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
			let block = "p";
			try { block = String(document.queryCommandValue("formatBlock") || "p").toLowerCase().replace(/[<>]/g, ""); } catch { /* не поддерживается */ }
			const el = (sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement | null)) as HTMLElement | null;
			const align = el ? getComputedStyle(el.closest("p,h1,h2,h3,li") ?? el).textAlign : "left";
			setState({ bold: q("bold"), italic: q("italic"), underline: q("underline"), strike: q("strikeThrough"), ul: q("insertUnorderedList"), ol: q("insertOrderedList"), block: ["h1", "h2", "h3"].includes(block) ? block : "p", align: ["center", "right", "justify"].includes(align) ? align : "left" });
		};
		document.addEventListener("selectionchange", onSel);
		return () => document.removeEventListener("selectionchange", onSel);
	}, []);

	const restore = () => {
		const root = rootRef.current;
		if (!root) return;
		root.focus();
		const sel = window.getSelection();
		if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
	};

	const exec = (cmd: string, arg?: string) => {
		restore();
		try { document.execCommand("styleWithCSS", false, "false"); document.execCommand(cmd, false, arg); } catch { /* команда недоступна */ }
		emit();
	};

	function insertChipAt(range: Range, key: string) {
		const root = rootRef.current;
		if (!root) return;
		range.deleteContents();
		const chip = makeChip(key);
		range.insertNode(chip);
		const after = document.createTextNode(ZWSP);
		chip.after(after);
		const r = document.createRange();
		r.setStart(after, 1); r.collapse(true);
		const sel = window.getSelection();
		sel?.removeAllRanges(); sel?.addRange(r);
		savedRange.current = r.cloneRange();
		emit();
	}

	/** Клик по полю в палитре: вставка в позицию курсора (или в конец текста). */
	function insertField(key: string) {
		const root = rootRef.current;
		if (!root) return;
		root.focus();
		let range = savedRange.current && root.contains(savedRange.current.startContainer) ? savedRange.current.cloneRange() : null;
		if (!range) { range = document.createRange(); range.selectNodeContents(root); range.collapse(false); }
		insertChipAt(range, key);
	}

	function caretFromPoint(x: number, y: number): Range | null {
		const d = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
		if (d.caretRangeFromPoint) return d.caretRangeFromPoint(x, y);
		const p = d.caretPositionFromPoint?.(x, y);
		if (!p) return null;
		const r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true);
		return r;
	}

	// ── перетаскивание ────────────────────────────────────────────────────────────────────────────────
	const onDragOver = (e: React.DragEvent) => { if (e.dataTransfer.types.includes(MIME) || e.dataTransfer.types.includes("text/plain")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } };
	const onDrop = (e: React.DragEvent) => {
		const key = e.dataTransfer.getData(MIME);
		if (!key) return; // перенос плашки внутри текста и обычного текста браузер делает сам
		e.preventDefault();
		const range = caretFromPoint(e.clientX, e.clientY);
		if (range && rootRef.current?.contains(range.startContainer)) insertChipAt(range, key);
		else insertField(key);
	};
	// Плашка, которую тянут внутри текста, выглядит как поле: подпись для вставки в другое место — тот же ключ
	const onDragStart = (e: React.DragEvent) => {
		const t = e.target as HTMLElement;
		const chip = t.closest?.("span[data-field]");
		if (chip) { e.dataTransfer.setData("text/plain", `{{${chip.getAttribute("data-field")}}}`); e.dataTransfer.effectAllowed = "move"; }
	};

	// Вставка из буфера: только очищенный HTML; {{ключи}} в вставленном тексте становятся плашками
	const onPaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const html = e.clipboardData.getData("text/html");
		const text = e.clipboardData.getData("text/plain");
		restore();
		const clean = html ? sanitizeHtml(html) : "";
		document.execCommand("insertHTML", false, clean || textToHtml(text).replace(/^<p>|<\/p>$/g, "").replace(/<\/p><p>/g, "<br>"));
		chipify();
		emit();
	};

	/** Текстовые {{ключи}} внутри текста → плашки. */
	function chipify() {
		const root = rootRef.current;
		if (!root) return;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const hits: Text[] = [];
		for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/.test(n.nodeValue ?? "") && !(n.parentElement?.closest("span[data-field]"))) hits.push(n as Text);
		for (const t of hits) {
			const frag = document.createDocumentFragment();
			for (const part of (t.nodeValue ?? "").split(/(\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\})/g)) {
				const m = /^\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}$/.exec(part);
				if (m) frag.appendChild(makeChip(m[1])); else if (part) frag.appendChild(document.createTextNode(part));
			}
			t.replaceWith(frag);
		}
	}

	// ── изображение ───────────────────────────────────────────────────────────────────────────────────
	async function insertImage(file: File) {
		const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
		const img = new Image();
		await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img")); img.src = dataUrl; }).catch(() => undefined);
		if (!img.width) return void toast.error(tr("imageTooBig"));
		const scale = Math.min(1, 900 / img.width);
		const canvas = document.createElement("canvas");
		canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
		canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
		const out = file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
		if (out.length > 650_000) return void toast.error(tr("imageTooBig"));
		exec("insertImage", out);
		if (fileRef.current) fileRef.current.value = "";
	}

	function applyLink() {
		const url = linkUrl.trim();
		if (!url) return;
		exec("createLink", /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`);
		setLinkOpen(false); setLinkUrl("");
	}

	// ── кнопки панели ─────────────────────────────────────────────────────────────────────────────────
	const btn = (active: boolean) => `flex h-34 w-34 items-center justify-center rounded-8 transition-colors ${active ? "bg-[rgba(198,255,77,0.16)] text-[#c6ff4d]" : "text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.07)] hover:text-[#f1f4ee]"}`;
	const tool = (label: string, icon: React.ReactNode, onClick: () => void, active = false) => (
		<button type="button" key={label} title={label} aria-label={label} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={btn(active)}>{icon}</button>
	);
	const sep = <span className="mx-4 h-22 w-px bg-[rgba(255,255,255,0.1)]" aria-hidden />;
	const lang = pickLang(locale);

	return (
		<div className="flex flex-col gap-10">
			<style>{PAPER_CSS}</style>
			<div className="fs-card overflow-visible">
				{/* Панель форматирования */}
				<div className="flex flex-wrap items-center gap-2 border-b border-inkLine p-6">
					<select
						value={state.block}
						onChange={(e) => exec("formatBlock", `<${e.target.value}>`)}
						aria-label={tr("styleNormal")}
						className="fs-field mr-4 h-34 w-[140px] px-8 text-12 outline-none"
					>
						<option value="p">{tr("styleNormal")}</option>
						<option value="h1">{tr("styleH1")}</option>
						<option value="h2">{tr("styleH2")}</option>
						<option value="h3">{tr("styleH3")}</option>
					</select>
					{sep}
					{tool(tr("bold"), <TbBold size={17} />, () => exec("bold"), state.bold)}
					{tool(tr("italic"), <TbItalic size={17} />, () => exec("italic"), state.italic)}
					{tool(tr("underline"), <TbUnderline size={17} />, () => exec("underline"), state.underline)}
					{tool(tr("strike"), <TbStrikethrough size={17} />, () => exec("strikeThrough"), state.strike)}
					{sep}
					{tool(tr("alignLeft"), <TbAlignLeft size={17} />, () => exec("justifyLeft"), state.align === "left")}
					{tool(tr("alignCenter"), <TbAlignCenter size={17} />, () => exec("justifyCenter"), state.align === "center")}
					{tool(tr("alignRight"), <TbAlignRight size={17} />, () => exec("justifyRight"), state.align === "right")}
					{tool(tr("alignJustify"), <TbAlignJustified size={17} />, () => exec("justifyFull"), state.align === "justify")}
					{sep}
					{tool(tr("listBullets"), <TbList size={17} />, () => exec("insertUnorderedList"), state.ul)}
					{tool(tr("listNumbers"), <TbListNumbers size={17} />, () => exec("insertOrderedList"), state.ol)}
					{tool(tr("link"), <TbLink size={17} />, () => { restore(); setLinkOpen((v) => !v); }, linkOpen)}
					{tool(tr("image"), <TbPhoto size={17} />, () => fileRef.current?.click())}
					<input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void insertImage(f); }} />
					<div className="relative">
						{tool(tr("more"), <TbDots size={17} />, () => setMoreOpen((v) => !v), moreOpen)}
						{moreOpen && (
							<div className="fs-popover absolute left-0 top-[40px] z-20 flex w-[220px] flex-col p-6" onMouseLeave={() => setMoreOpen(false)}>
								{[
									[tr("undo"), <TbArrowBackUp key="u" size={15} />, () => exec("undo")],
									[tr("redo"), <TbArrowForwardUp key="r" size={15} />, () => exec("redo")],
									[tr("clearFormat"), <TbClearFormatting key="c" size={15} />, () => exec("removeFormat")],
									[tr("hr"), <TbSeparatorHorizontal key="h" size={15} />, () => exec("insertHorizontalRule")],
									[tr("linkRemove"), <TbLink key="l" size={15} />, () => exec("unlink")],
								].map(([label, icon, fn]) => (
									<button key={label as string} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { (fn as () => void)(); setMoreOpen(false); }} className="flex h-32 items-center gap-8 rounded-8 px-8 text-left text-12 text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.07)]">{icon as React.ReactNode}{label as string}</button>
								))}
							</div>
						)}
					</div>
					<span className="ml-auto flex items-center gap-6 rounded-full border border-inkLine bg-[rgba(255,255,255,0.03)] px-10 py-4 text-11 text-[#cfd4cb]">
						<span className="h-8 w-8 rounded-50 bg-[#34d399]" aria-hidden />{tr("autoFields")}
					</span>
				</div>
				{linkOpen && (
					<div className="flex items-center gap-8 border-b border-inkLine p-8">
						<input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }} placeholder="https://…" className="fs-field h-32 flex-1 px-8 text-12 outline-none" autoFocus />
						<button type="button" onClick={applyLink} className="fs-btn fs-btn-primary h-32">{tr("linkApply")}</button>
					</div>
				)}
				{palette && <FieldStrip country={country} customFields={customFields} onInsert={insertField} lang={lang} />}
			</div>

			{/* Лист */}
			<div className="fs-scroll overflow-auto rounded-12 bg-[rgba(255,255,255,0.03)] p-12 md:p-20" style={{ maxHeight: height + 40 }}>
				<div className="mx-auto w-full max-w-[794px] rounded-6 px-24 py-24 shadow-[0_10px_34px_rgba(0,0,0,0.45)] md:px-48 md:py-40" style={{ minHeight: height, background: "#ffffff" }}>
					<div
						ref={rootRef}
						className="rce-paper"
						contentEditable
						suppressContentEditableWarning
						spellCheck
						data-placeholder={placeholder}
						style={{ minHeight: height - 60 }}
						onInput={emit}
						onBlur={() => { chipify(); emit(); }}
						onDragOver={onDragOver}
						onDrop={onDrop}
						onDragStart={onDragStart}
						onPaste={onPaste}
						onKeyUp={() => { /* состояние панели обновляет selectionchange */ }}
					/>
				</div>
			</div>
		</div>
	);
}

// ── полоса полей под панелью форматирования ──────────────────────────────────────────────────────────
function FieldStrip({ country, customFields, onInsert, lang }: { country: Country | null; customFields: CustomField[]; onInsert: (key: string) => void; lang: "en" | "de" | "ua" | "uz" }) {
	const locale = useLocale();
	const tr = trFor(locale);
	const [group, setGroup] = useState<string>("contract");
	const [query, setQuery] = useState("");
	const [view, setView] = useState<"chips" | "list">("chips");
	const [allCountries, setAllCountries] = useState(false);

	const visible = useMemo(() => fieldsForCountry(allCountries ? null : country, CATALOG), [allCountries, country]);
	const q = query.trim().toLowerCase();
	const groups = useMemo(() => [
		...(customFields.some((f) => f.key) ? [{ id: "custom", label: tr("customFields"), count: customFields.filter((f) => f.key).length }] : []),
		...GROUP_ORDER.map((g) => ({ id: g as string, label: GROUP_LABEL[g][lang], count: visible.filter((f) => f.group === g).length })).filter((g) => g.count),
	], [customFields, visible, lang, tr]);
	const active = groups.some((g) => g.id === group) ? group : groups[0]?.id ?? "contract";

	type Item = { key: string; label: string; color: string };
	const items: Item[] = useMemo(() => {
		const fromCatalog = (list: CatalogField[]): Item[] => list.map((f) => ({ key: f.key, label: labelOf(f, locale), color: colorOf(f.group) }));
		const custom: Item[] = customFields.filter((f) => f.key).map((f) => ({ key: f.key, label: f.label || f.key, color: "#E879F9" }));
		if (q) return [...custom, ...fromCatalog(visible)].filter((i) => i.key.toLowerCase().includes(q) || i.label.toLowerCase().includes(q));
		return active === "custom" ? custom : fromCatalog(visible.filter((f) => f.group === active));
	}, [q, active, visible, customFields, locale]);

	const chipDrag = (key: string) => (e: React.DragEvent) => { e.dataTransfer.setData(MIME, key); e.dataTransfer.setData("text/plain", `{{${key}}}`); e.dataTransfer.effectAllowed = "copy"; };

	return (
		<div className="p-8">
			<div className="flex flex-wrap items-center gap-6">
				<div className="fs-scroll flex min-w-0 flex-1 gap-4 overflow-x-auto pb-4" role="tablist">
					{groups.map((g) => (
						<button key={g.id} type="button" role="tab" aria-selected={active === g.id && !q} onClick={() => { setGroup(g.id); setQuery(""); }} className={`shrink-0 rounded-full px-10 py-4 text-12 transition-colors ${active === g.id && !q ? "bg-[rgba(198,255,77,0.16)] text-[#c6ff4d]" : "text-[#9aa396] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#f1f4ee]"}`}>
							{g.label} <span className="opacity-60">{g.count}</span>
						</button>
					))}
				</div>
				<label className="relative">
					<TbSearch size={14} className="pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 text-[#8c948b]" aria-hidden />
					<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("search")} className="fs-field h-30 w-[190px] pl-26 pr-8 text-12 outline-none" />
				</label>
				<select value={allCountries ? "all" : "mine"} onChange={(e) => setAllCountries(e.target.value === "all")} className="fs-field h-30 px-8 text-12 outline-none" aria-label={tr("allCountries")}>
					<option value="mine">{tr("forCountry")}</option>
					<option value="all">{tr("allCountries")}</option>
				</select>
				<div className="flex rounded-8 border border-inkLine p-2">
					<button type="button" title={tr("viewChips")} aria-label={tr("viewChips")} onClick={() => setView("chips")} className={`flex h-26 w-26 items-center justify-center rounded-6 ${view === "chips" ? "bg-[rgba(198,255,77,0.16)] text-[#c6ff4d]" : "text-[#9aa396]"}`}><TbTags size={14} /></button>
					<button type="button" title={tr("viewList")} aria-label={tr("viewList")} onClick={() => setView("list")} className={`flex h-26 w-26 items-center justify-center rounded-6 ${view === "list" ? "bg-[rgba(198,255,77,0.16)] text-[#c6ff4d]" : "text-[#9aa396]"}`}><TbLayoutList size={14} /></button>
				</div>
			</div>
			<p className="mb-6 mt-6 text-11 text-[#8c948b]">{tr("dragHint")}</p>
			<div className="fs-scroll max-h-[132px] overflow-y-auto">
				{items.length === 0 ? (
					<p className="py-6 text-12 text-[#8c948b]">{tr("nothingFound")}</p>
				) : view === "chips" ? (
					<div className="flex flex-wrap gap-6">
						{items.map((i) => (
							<button key={i.key} type="button" draggable onDragStart={chipDrag(i.key)} onClick={() => onInsert(i.key)} title={`{{${i.key}}}`} className="cursor-grab select-none rounded-full px-10 py-4 text-12 font-semibold text-[#0A0A0A] shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:cursor-grabbing" style={{ background: i.color, color: "#0A0A0A" }}>
								{i.label}
							</button>
						))}
					</div>
				) : (
					<ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
						{items.map((i) => (
							<li key={i.key}>
								<button type="button" draggable onDragStart={chipDrag(i.key)} onClick={() => onInsert(i.key)} className="flex w-full cursor-grab items-center justify-between gap-8 rounded-8 px-8 py-5 text-left text-12 text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.06)]">
									<span className="flex min-w-0 items-center gap-6"><span className="h-8 w-8 shrink-0 rounded-50" style={{ background: i.color }} aria-hidden /><span className="truncate">{i.label}</span></span>
									<span className="shrink-0 font-mono text-11 text-[#8c948b]">{`{{${i.key}}}`}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

