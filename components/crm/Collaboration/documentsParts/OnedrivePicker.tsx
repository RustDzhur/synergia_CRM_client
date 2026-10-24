"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbChevronRight, TbFile, TbFolder, TbRefresh } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import Modal from "../../shared/Modal";

interface Entry {
	id: string;
	name: string;
	size: number;
	mime: string;
	folder: boolean;
	modified: string;
}

// Окно выбора файлов OneDrive: показывается дерево (корень и вложенные папки), файлы отмечают
// галочками и переносят в CRM. Копии не делаем — в CRM заводятся записи со ссылками на файлы,
// как и у перенесённых с Google Диска.
export default function OnedrivePicker({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
	const t = useTranslations("collab");
	const [stack, setStack] = useState<{ id: string; name: string }[]>([]);
	const [entries, setEntries] = useState<Entry[] | null>(null);
	const [checked, setChecked] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);

	const folderId = stack.length ? stack[stack.length - 1].id : "";

	async function load(id: string) {
		setEntries(null);
		const res = await apiCall<{ files: Entry[] }>(`/api/onedrive/files?folder=${encodeURIComponent(id)}`);
		if (!res.ok) {
			setEntries([]);
			return void toast.error(res.message);
		}
		setEntries(res.data?.files ?? []);
	}

	useEffect(() => {
		if (open) {
			setStack([]);
			setChecked(new Set());
			void load("");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	function enter(entry: Entry) {
		setStack((s) => [...s, { id: entry.id, name: entry.name }]);
		void load(entry.id);
	}

	function goTo(index: number) {
		const next = stack.slice(0, index);
		setStack(next);
		void load(next.length ? next[next.length - 1].id : "");
	}

	function toggle(id: string) {
		setChecked((s) => {
			const next = new Set(s);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	async function submit() {
		if (!checked.size || busy) return;
		setBusy(true);
		const res = await apiCall<{ imported: number; skipped: number }>("/api/onedrive/import", "POST", { ids: Array.from(checked) });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		const imported = res.data?.imported ?? 0;
		toast.success(imported ? t("cloudImportDone", { count: imported }) : t("cloudImportEmpty"));
		onImported();
		onClose();
	}

	return (
		<Modal open={open} onClose={onClose} label={t("onedrivePickerTitle")} align="top" className="w-full max-w-[640px]">
			<div className="fs-popover flex max-h-[calc(100dvh-32px)] flex-col p-20">
				<div className="mb-12 flex items-center justify-between gap-12">
					<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("onedrivePickerTitle")}</h2>
					<button type="button" onClick={() => void load(folderId)} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]" aria-label={t("refresh")}>
						<TbRefresh size={17} />
					</button>
				</div>

				<nav className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-12" aria-label={t("breadcrumbs")}>
					<button type="button" onClick={() => goTo(0)} className={stack.length ? "text-[#c6ff4d] hover:underline" : "font-medium text-[#f1f4ee]"}>
						{t("onedriveRoot")}
					</button>
					{stack.map((f, i) => (
						<span key={f.id} className="flex items-center gap-6">
							<TbChevronRight size={13} className="text-[#8C948B]" aria-hidden />
							<button type="button" onClick={() => goTo(i + 1)} className={i === stack.length - 1 ? "font-medium text-[#f1f4ee]" : "text-[#c6ff4d] hover:underline"}>
								{f.name}
							</button>
						</span>
					))}
				</nav>

				<div className="fs-scroll min-h-0 flex-1 overflow-y-auto rounded-10 border border-inkLineSoft">
					{entries === null ? (
						<p className="p-16 text-13 text-[#8c948b]">…</p>
					) : entries.length === 0 ? (
						<p className="p-16 text-13 text-[#8c948b]">{t("onedriveEmpty")}</p>
					) : (
						<ul>
							{entries.map((e) => (
								<li key={e.id} className="border-b border-inkLineSoft last:border-0">
									{e.folder ? (
										<button type="button" onClick={() => enter(e)} className="flex w-full items-center gap-10 px-12 py-10 text-left text-13 text-[#f1f4ee] transition-colors hover:bg-[rgba(255,255,255,0.03)]">
											<TbFolder size={17} className="shrink-0 text-[#c6ff4d]" />
											<span className="truncate">{e.name}</span>
										</button>
									) : (
										<label className="flex cursor-pointer items-center gap-10 px-12 py-10 text-13 text-[#f1f4ee] transition-colors hover:bg-[rgba(255,255,255,0.03)]">
											<input type="checkbox" checked={checked.has(e.id)} onChange={() => toggle(e.id)} className="h-[15px] w-[15px] shrink-0 cursor-pointer accent-[#c6ff4d]" />
											<TbFile size={17} className="shrink-0 text-[#8c948b]" />
											<span className="min-w-0 flex-1 truncate">{e.name}</span>
											{e.size > 0 && <span className="shrink-0 text-12 text-[#8c948b]">{Math.max(1, Math.round(e.size / 1024))} {t("kb")}</span>}
										</label>
									)}
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="mt-14 flex items-center justify-end gap-12">
					<button type="button" onClick={onClose} className="px-12 py-8 text-12 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">{t("cancel")}</button>
					<button type="button" onClick={submit} disabled={busy || !checked.size} className="fs-btn fs-btn-primary h-34 disabled:opacity-60">
						{busy ? t("onedriveImportRunning") : t("onedriveImportSelected", { count: checked.size })}
					</button>
				</div>
			</div>
		</Modal>
	);
}
