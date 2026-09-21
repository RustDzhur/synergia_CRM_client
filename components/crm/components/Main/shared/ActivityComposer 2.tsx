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

	const toolbarButton = "flex items-center gap-4 text-14 text-[#999999]";
	const disabledTip = t("soon");

	return (
		<div className="rounded-16 bg-white shadow-custom">
			<div role="tablist" className="flex overflow-x-auto overflow-y-hidden border-b border-[#EFEFEF] px-4">
				{tabs.map((x) => (
					<button
						key={x.key}
						type="button"
						role="tab"
						aria-selected={x.key === active}
						onClick={() => setActive(x.key)}
						className={`relative shrink-0 px-16 py-12 text-16 font-medium transition-colors duration-200 ${
							x.key === active ? "text-primaryColor" : "text-[#666666] hover:text-black"
						}`}>
						{x.label}
						<span
							className={`absolute inset-x-0 bottom-[-1px] h-[2px] bg-primaryColor transition-transform duration-200 ${
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
							className="h-[50px] w-full rounded-8 border border-[#E6E6E6] px-16 text-16 text-[#666666] outline-none transition-colors placeholder:text-[#CCCCCC] focus:border-[#5EA8F5]"
						/>
						{text.trim() !== "" && (
							<div className="flex animate-fade-in-up flex-wrap items-center justify-end gap-12">
								{tab.withDate && (
									<input
										type="datetime-local"
										value={when}
										onChange={(e) => setWhen(e.target.value)}
										className="h-[40px] rounded-8 border border-[#E6E6E6] px-10 text-14 text-[#666666] outline-none focus:border-[#5EA8F5]"
									/>
								)}
								<button type="button" onClick={() => setText("")} className="px-12 py-8 text-14 text-[#999999] hover:text-black">
									{t("cancel")}
								</button>
								<button
									type="button"
									onClick={submit}
									disabled={busy}
									className="rounded-4 bg-primaryColor px-20 py-8 text-14 font-medium text-white shadow-custom disabled:opacity-60">
									{submitLabel}
								</button>
							</div>
						)}
					</div>
				) : (
					<div className="rounded-8 border border-[#E6E6E6] p-16 transition-colors focus-within:border-[#5EA8F5]">
						<textarea
							ref={areaRef}
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder={tab.placeholder}
							rows={5}
							className="w-full resize-none text-16 text-[#666666] outline-none placeholder:text-[#CCCCCC]"
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
								<button type="button" onClick={() => setText("")} className="text-14 text-[#999999] hover:text-black">
									{t("cancel")}
								</button>
								<button
									type="button"
									onClick={submit}
									disabled={busy || !text.trim()}
									className="rounded-4 bg-primaryColor px-20 py-8 text-14 font-medium text-white shadow-custom transition-opacity disabled:opacity-60">
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
