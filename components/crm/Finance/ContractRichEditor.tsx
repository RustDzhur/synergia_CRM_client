"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { TbAlignCenter, TbAlignJustified, TbAlignLeft, TbAlignRight, TbBold, TbItalic, TbLink, TbList, TbListNumbers, TbPhoto, TbStrikethrough, TbUnderline } from "react-icons/tb";
import { chipHtml, TOKEN_RE } from "@/lib/finance/contractRich";

// Визуальный редактор текста договора (как в макете): панель форматирования, «бумага» с текстом и поля {{Field}}
// в виде подсвеченных чипов. Чип вставляется перетаскиванием из палитры (drop в нужное место текста) или кликом.
// Наружу отдаётся HTML; простой текст для PDF получает родитель через htmlToText.

export interface RichEditorHandle { insertToken: (key: string) => void }

const ALLOWED = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "H1", "H2", "H3", "UL", "OL", "LI", "A", "IMG", "SPAN", "BLOCKQUOTE"]);

/** Оставляет только безопасную разметку: чужой HTML (из файла, вставки) не должен тащить скрипты и обработчики. */
export function sanitizeHtml(html: string): string {
	const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
	const walk = (node: Element) => {
		for (const child of Array.from(node.children)) {
			if (!ALLOWED.has(child.tagName)) { child.replaceWith(...Array.from(child.childNodes)); continue; }
			const chip = child.tagName === "SPAN" && child.hasAttribute("data-key");
			const style = child instanceof HTMLElement ? child.style.textAlign : "";
			for (const a of Array.from(child.attributes)) {
				const keep = (child.tagName === "A" && a.name === "href" && /^(https?:|mailto:)/i.test(a.value))
					|| (child.tagName === "IMG" && a.name === "src" && /^(https?:|data:image\/)/i.test(a.value))
					|| (chip && (a.name === "data-key" || a.name === "class" || a.name === "contenteditable"));
				if (!keep) child.removeAttribute(a.name);
			}
			if (style && child instanceof HTMLElement) child.style.textAlign = style;
			if (chip) { child.textContent = `{{${child.getAttribute("data-key")}}}`; child.className = "ct-chip"; child.setAttribute("contenteditable", "false"); }
			else walk(child);
		}
	};
	walk(doc.body);
	return doc.body.innerHTML;
}

const BLOCKS = [["p", "Normal"], ["h1", "H1"], ["h2", "H2"], ["h3", "H3"]] as const;

const ContractRichEditor = forwardRef<RichEditorHandle, { html: string; onChange: (html: string) => void; placeholder?: string; blockLabels?: Record<string, string>; toolbarExtra?: React.ReactNode; palette?: React.ReactNode }>(function ContractRichEditor({ html, onChange, placeholder, blockLabels, toolbarExtra, palette }, ref) {
	const box = useRef<HTMLDivElement>(null);
	const saved = useRef<Range | null>(null);
	const lastHtml = useRef<string | null>(null);

	// Внешнее значение попадает в редактор только когда оно не наше собственное: иначе при каждом наборе сбивался бы курсор
	useEffect(() => {
		if (box.current && html !== lastHtml.current) { box.current.innerHTML = sanitizeHtml(html); lastHtml.current = html; }
	}, [html]);

	const emit = useCallback(() => {
		if (!box.current) return;
		const h = box.current.innerHTML;
		lastHtml.current = h;
		onChange(h);
	}, [onChange]);

	useEffect(() => {
		const onSel = () => {
			const sel = window.getSelection();
			if (sel && sel.rangeCount && box.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
		};
		document.addEventListener("selectionchange", onSel);
		return () => document.removeEventListener("selectionchange", onSel);
	}, []);

	function placeChip(key: string, range: Range | null) {
		const el = box.current;
		if (!el) return;
		el.focus();
		const sel = window.getSelection();
		const r = range ?? (() => { const e = document.createRange(); e.selectNodeContents(el); e.collapse(false); return e; })();
		sel?.removeAllRanges();
		sel?.addRange(r);
		document.execCommand("insertHTML", false, `${chipHtml(key)}&nbsp;`);
		emit();
	}

	useImperativeHandle(ref, () => ({ insertToken: (key: string) => placeChip(key, saved.current) }));

	function rangeAt(x: number, y: number): Range | null {
		const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
		if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
		const p = d.caretPositionFromPoint?.(x, y);
		if (!p) return null;
		const r = document.createRange();
		r.setStart(p.offsetNode, p.offset);
		r.collapse(true);
		return r;
	}

	function onDrop(e: React.DragEvent) {
		const text = e.dataTransfer.getData("text/plain");
		const m = new RegExp(TOKEN_RE.source).exec(text);
		if (!m || text.trim() !== m[0]) return; // чужое содержимое (текст, файл) браузер обработает сам
		e.preventDefault();
		placeChip(m[1], rangeAt(e.clientX, e.clientY));
	}

	function cmd(name: string, value?: string) {
		box.current?.focus();
		const sel = window.getSelection();
		if (saved.current && sel && !box.current?.contains(sel.anchorNode)) { sel.removeAllRanges(); sel.addRange(saved.current); }
		document.execCommand(name, false, value);
		emit();
	}

	// onMouseDown + preventDefault: кнопки панели не должны забирать фокус и сбрасывать выделение
	const btn = (title: string, icon: React.ReactNode, run: () => void) => (
		<button key={title} type="button" title={title} aria-label={title} onMouseDown={(e) => { e.preventDefault(); run(); }} className="flex h-32 w-32 items-center justify-center rounded-8 text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.08)] hover:text-white">{icon}</button>
	);
	const sep = (k: string) => <span key={k} className="mx-4 h-20 w-px bg-[rgba(255,255,255,0.12)]" />;

	return (
		<div className="overflow-hidden rounded-12 border border-[rgba(255,255,255,0.1)] bg-[#0f1417]">
			<div className="flex flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.1)] bg-[#161d21] px-8 py-6">
				<select
					defaultValue="p"
					onChange={(e) => { cmd("formatBlock", e.target.value); e.target.value = "p"; }}
					className="fs-field mr-4 h-32 px-8 text-12 outline-none"
					aria-label="Style"
				>
					{BLOCKS.map(([v, l]) => <option key={v} value={v}>{blockLabels?.[v] ?? l}</option>)}
				</select>
				{sep("1")}
				{btn("Bold (Ctrl+B)", <TbBold size={16} />, () => cmd("bold"))}
				{btn("Italic (Ctrl+I)", <TbItalic size={16} />, () => cmd("italic"))}
				{btn("Underline (Ctrl+U)", <TbUnderline size={16} />, () => cmd("underline"))}
				{btn("Strikethrough", <TbStrikethrough size={16} />, () => cmd("strikeThrough"))}
				{sep("2")}
				{btn("Left", <TbAlignLeft size={16} />, () => cmd("justifyLeft"))}
				{btn("Center", <TbAlignCenter size={16} />, () => cmd("justifyCenter"))}
				{btn("Right", <TbAlignRight size={16} />, () => cmd("justifyRight"))}
				{btn("Justify", <TbAlignJustified size={16} />, () => cmd("justifyFull"))}
				{sep("3")}
				{btn("Bulleted list", <TbList size={16} />, () => cmd("insertUnorderedList"))}
				{btn("Numbered list", <TbListNumbers size={16} />, () => cmd("insertOrderedList"))}
				{btn("Link", <TbLink size={16} />, () => { const url = window.prompt("URL (https://…)"); if (url && /^(https?:|mailto:)/i.test(url)) cmd("createLink", url); })}
				{btn("Image", <TbPhoto size={16} />, () => { const url = window.prompt("Image URL (https://…)"); if (url && /^https?:/i.test(url)) cmd("insertImage", url); })}
				{toolbarExtra && <span className="ml-auto flex items-center">{toolbarExtra}</span>}
			</div>
			{palette}
			<div className="fs-scroll max-h-[640px] overflow-auto bg-[#0b0f11] p-12 md:p-20">
				<div
					ref={box}
					contentEditable
					suppressContentEditableWarning
					spellCheck
					data-placeholder={placeholder}
					onInput={emit}
					onBlur={emit}
					onDragOver={(e) => { if (e.dataTransfer.types.includes("text/plain")) e.preventDefault(); }}
					onDrop={onDrop}
					onPaste={(e) => {
						// вставка из Word/сайта: только безопасная разметка
						const h = e.clipboardData.getData("text/html");
						if (!h) return;
						e.preventDefault();
						document.execCommand("insertHTML", false, sanitizeHtml(h));
						emit();
					}}
					className="ct-paper mx-auto min-h-[420px] max-w-[820px] rounded-4 bg-white p-24 text-[14px] leading-[1.7] text-[#1b2430] outline-none md:p-40"
				/>
			</div>
			<style>{`
				.ct-paper h1{font-size:30px;font-weight:700;margin:0 0 14px;color:#101828}
				.ct-paper h2{font-size:20px;font-weight:600;margin:22px 0 8px;color:#101828}
				.ct-paper h3{font-size:16px;font-weight:600;margin:16px 0 6px;color:#101828}
				.ct-paper p{margin:0 0 6px;min-height:1.7em}
				.ct-paper ul{list-style:disc;padding-left:24px;margin:6px 0}
				.ct-paper ol{list-style:decimal;padding-left:24px;margin:6px 0}
				.ct-paper a{color:#1d4ed8;text-decoration:underline}
				.ct-paper img{max-width:100%}
				.ct-paper .ct-chip{display:inline-block;padding:0 8px;border-radius:6px;background:#dbeafe;color:#1d4ed8;font-weight:500;cursor:default;user-select:all}
				.ct-paper:empty::before{content:attr(data-placeholder);color:#94a3b8}
			`}</style>
		</div>
	);
});

export default ContractRichEditor;
