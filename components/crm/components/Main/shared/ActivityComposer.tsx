"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdAlternateEmail, MdAttachFile, MdInsertDriveFile } from "react-icons/md";
import { NewActivity } from "@/app/store/crmApi";

export interface ComposerTab {
	key: string;
	label: string;
	type: NewActivity["type"];
	// "line" — одна строка «Things To Do» (с необязательной датой), "area" — большое поле с панелью инструментов
	mode: "line" | "area";
	placeholder: string;
	withDate?: boolean;
}

interface Props {
	tabs: ComposerTab[];
	onSubmit: (activity: NewActivity) => Promise<void> | void;
	// подпись главной кнопки в режиме area: «Save» (заметки) или «Send» (сделка)
	submitLabel: string;
}

// Форма добавления записи в ленту: вкладки сверху (New Note / E-Mail / Call ... или Activity / Comment / Task ...)
// и поле ввода. Одна и та же для сделки, контакта и компании.
export default function ActivityComposer({ tabs, onSubmit, submitLabel }: Props) {
	const t = useTranslations("crm");
	const [active, setActive] = useState(tabs[0].key);
	const [text, setText] = useState("");
	const [when, setWhen] = useState("");
	const [busy, setBusy] = useState(false);
	const areaRef = useRef<HTMLTextAreaElement>(null);
	const tab = tabs.find((x) => x.key === active) ?? tabs[0];

	// при смене вкладки черновик сбрасывается — он относится к конкретному типу записи
	useEffect(() => {
		setText("");
		setWhen("");
	}, [active]);

	async function submit() {
		if (!text.trim() || busy) return;
		setBusy(true);
		await onSubmit({ type: tab.type, text: text.trim(), meta: when || undefined });
		setBusy(false);
		setText("");
		setWhen("");
	}

	function insertMention() {
		const el = areaRef.current;
		const pos = el?.selectionStart ?? text.length;
		setText(text.slice(0, pos) + "@" + text.slice(pos));
		requestAnimationFrame(() => el?.focus());
	}

	const toolbarButton = "flex items-center gap-4 text-12 text-[#8c948b]";
	const disabledTip = t("soon");

	return (
		<div className="fs-card overflow-hidden">
			<div role="tablist" className="flex overflow-x-auto overflow-y-hidden border-b border-inkLine px-4">
				{tabs.map((x) => (
					<button
						key={x.key}
						type="button"
						role="tab"
						aria-selected={x.key === active}
						onClick={() => setActive(x.key)}
						className={`relative shrink-0 px-16 py-10 text-13 font-medium transition-colors duration-200 ${
							x.key === active ? "text-[#c6ff4d]" : "text-[#8c948b] hover:text-[#f1f4ee]"
						}`}>
						{x.label}
						<span
							className={`absolute inset-x-0 bottom-[-1px] h-[2px] bg-[#c6ff4d] transition-transform duration-200 ${
								x.key === active ? "scale-x-100" : "scale-x-0"
							}`}
						/>
					</button>
				))}
			</div>

			<div className="p-16">
				{tab.mode === "line" ? (
					<div className="flex flex-col gap-10">
						<input
							value={text}
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && submit()}
							placeholder={tab.placeholder}
							className="fs-field h-40 w-full px-12 text-13 outline-none transition-colors"
						/>
						{text.trim() !== "" && (
							<div className="flex animate-fade-in-up flex-wrap items-center justify-end gap-12">
								{tab.withDate && (
									<input
										type="datetime-local"
										value={when}
										onChange={(e) => setWhen(e.target.value)}
										className="fs-field h-34 px-10 text-12 outline-none"
									/>
								)}
								<button type="button" onClick={() => setText("")} className="px-12 py-8 text-12 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
									{t("cancel")}
								</button>
								<button
									type="button"
									onClick={submit}
									disabled={busy}
									className="fs-btn fs-btn-primary h-34 disabled:opacity-60">
									{submitLabel}
								</button>
							</div>
						)}
					</div>
				) : (
					<div className="fs-field p-14 transition-colors">
						<textarea
							ref={areaRef}
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder={tab.placeholder}
							rows={5}
							className="w-full resize-none bg-transparent text-13 text-[#f1f4ee] outline-none placeholder:text-[#9AA396]"
						/>
						<div className="mt-10 flex flex-wrap items-center justify-between gap-12">
							<div className="flex flex-wrap items-center gap-16">
								<button type="button" disabled title={disabledTip} className={`${toolbarButton} cursor-not-allowed opacity-60`}>
									<MdAttachFile size={16} />
									{t("file")}
								</button>
								<button type="button" disabled title={disabledTip} className={`${toolbarButton} cursor-not-allowed opacity-60`}>
									<MdInsertDriveFile size={16} />
									{t("createDocument")}
								</button>
								<button type="button" onClick={insertMention} className={`${toolbarButton} transition-colors hover:text-primaryColor`}>
									<MdAlternateEmail size={16} />
									{t("mention")}
								</button>
							</div>
							<div className="flex items-center gap-16">
								<button type="button" onClick={() => setText("")} className="text-12 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
									{t("cancel")}
								</button>
								<button
									type="button"
									onClick={submit}
									disabled={busy || !text.trim()}
									className="fs-btn fs-btn-primary h-34 disabled:opacity-60">
									{submitLabel}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
