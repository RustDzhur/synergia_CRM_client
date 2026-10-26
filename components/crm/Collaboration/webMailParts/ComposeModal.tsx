"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Modal from "../../shared/Modal";
import { sanitizeMailHtml } from "./mailHtml";
import { execFormat, insertDictatedText, isEditorEmpty, textToEditorHtml } from "./composeHtml";
import ComposeToolbar from "./ComposeToolbar";
import type { Draft } from "./model";
import { useDictation } from "./useDictation";

interface Props {
	open: boolean;
	draft: Draft;
	sending: boolean;
	onChange: (draft: Draft) => void;
	onClose: () => void;
	onSave: (asDraft: boolean) => void;
}

const inputClass = "fs-field h-40 w-full px-12 text-13 outline-none";
const editorClass =
	"fs-field mail-editor min-h-[180px] max-h-[46vh] overflow-y-auto whitespace-pre-wrap p-12 text-13 leading-[1.55] outline-none [overflow-wrap:anywhere]";

// Окно написания письма: получатель, тема и редактор с панелью форматирования и диктовкой.
// Тело письма — contentEditable: уходит HTML (форматирование сохраняется у получателя) и обычный
// текст (для клиентов без HTML и поиска). Вставка из буфера чистится той же проверкой, что и
// входящие письма, а надиктованный текст вставляется как обычный текст в позицию курсора.
export default function ComposeModal({ open, draft, sending, onChange, onClose, onSave }: Props) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const editorRef = useRef<HTMLDivElement>(null);
	const savedRange = useRef<Range | null>(null);
	const draftRef = useRef(draft);
	draftRef.current = draft;
	const [empty, setEmpty] = useState(true);

	const emit = useCallback(() => {
		const root = editorRef.current;
		if (!root) return;
		const raw = root.innerHTML;
		// HTML не чистим на каждое нажатие: сервер делает это при сохранении черновика и отправке,
		// а вставка из буфера уже прошла проверку. Пустой редактор — не содержимое письма.
		const html = isEditorEmpty(raw) ? "" : raw.slice(0, 300_000);
		const text = (root.innerText || "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000);
		setEmpty(isEditorEmpty(raw));
		onChange({ ...draftRef.current, body: text, html });
	}, [onChange]);

	const insertDictation = useCallback((text: string) => {
		insertDictatedText(editorRef.current, text, savedRange.current);
		const selection = window.getSelection();
		if (selection?.rangeCount) savedRange.current = selection.getRangeAt(0).cloneRange();
		emit();
	}, [emit]);

	const dictation = useDictation({ locale, onText: insertDictation });
	const { cancel: cancelDictation, state: dictationState } = dictation;
	const busy = dictationState !== "idle";

	// Открыли окно (новое письмо или черновик) — показываем его содержимое в редакторе.
	// Зависимости намеренно только open/draft.id: каждое нажатие клавиши меняет draft, и реакция
	// на него перезаписывала бы редактор, теряя каретку.
	useEffect(() => {
		if (!open) {
			cancelDictation();
			return;
		}
		const root = editorRef.current;
		const current = draftRef.current;
		const html = current.html || textToEditorHtml(current.body);
		if (root) root.innerHTML = html;
		setEmpty(isEditorEmpty(html));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, draft.id]);

	// Позиция курсора в редакторе: кнопка панели забирает фокус, и без сохранения команда
	// применилась бы к пустому месту, а не к выделенному тексту
	useEffect(() => {
		const onSelection = () => {
			const selection = window.getSelection();
			const root = editorRef.current;
			if (!selection || !root || !selection.rangeCount) return;
			if (root.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
		};
		document.addEventListener("selectionchange", onSelection);
		return () => document.removeEventListener("selectionchange", onSelection);
	}, []);

	const command = (cmd: string, value?: string) => {
		execFormat(editorRef.current, savedRange.current, cmd, value);
		emit();
	};

	// Вставка из буфера: сохраняем форматирование, но вычищаем скрипты и обработчики —
	// вставленный HTML не должен выполниться ни в редакторе, ни в письме у получателя
	const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
		e.preventDefault();
		const html = e.clipboardData.getData("text/html");
		const text = e.clipboardData.getData("text/plain");
		editorRef.current?.focus();
		if (html) {
			try {
				// <style> из буфера убрали бы вёрстку всего кабинета, поэтому из вставки он исключён
				const clean = sanitizeMailHtml(html).replace(/<style[\s\S]*?<\/style>/gi, "");
				if (clean) document.execCommand("insertHTML", false, clean);
				else document.execCommand("insertText", false, text);
			} catch {
				document.execCommand("insertText", false, text);
			}
		} else {
			document.execCommand("insertText", false, text);
		}
		emit();
	};

	const submit = (asDraft: boolean) => {
		if (busy) return;
		emit();
		onSave(asDraft);
	};

	return (
		<Modal open={open} onClose={onClose} label={t("newEmail")} className="w-full max-w-[600px]">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit(false);
				}}
				className="fs-popover p-24">
				<h2 className="mb-20 text-16 font-semibold text-[#edf2ff]">{t("newEmail")}</h2>
				<div className="flex flex-col gap-12">
					<input value={draft.to} onChange={(e) => onChange({ ...draft, to: e.target.value })} placeholder={t("mailTo")} aria-label={t("mailTo")} maxLength={300} className={inputClass} />
					<input value={draft.subject} onChange={(e) => onChange({ ...draft, subject: e.target.value })} placeholder={t("mailSubject")} aria-label={t("mailSubject")} maxLength={200} className={inputClass} />
					<div className="fs-field overflow-hidden">
						<ComposeToolbar disabled={sending} dictation={dictation} onCommand={command} />
						<div className="relative">
							<div
								ref={editorRef}
								role="textbox"
								aria-multiline="true"
								aria-label={t("mailBody")}
								contentEditable={!sending}
								suppressContentEditableWarning
								spellCheck
								className={editorClass}
								onInput={emit}
								onBlur={emit}
								onPaste={onPaste}
							/>
							{empty && <span className="pointer-events-none absolute left-12 top-12 text-13 text-[#6b7a99]">{t("mailBody")}</span>}
						</div>
					</div>
				</div>
				<div className="mt-20 flex flex-wrap justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
					<button type="button" disabled={sending || busy} onClick={() => submit(true)} className="fs-btn fs-btn-ghost h-40 disabled:opacity-50">{t("saveDraft")}</button>
					<button type="submit" disabled={sending || busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-50">{sending ? "…" : t("send")}</button>
				</div>
			</form>
		</Modal>
	);
}
