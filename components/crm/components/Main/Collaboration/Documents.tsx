"use client";
import React, { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdKeyboardArrowDown, MdMoreHoriz } from "react-icons/md";
import { DocFile, DocType, useCollabHydration, useCollabStore } from "@/app/store/useCollabStore";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import Checkbox from "../shared/Checkbox";
import { TAB_BAR } from "../shared/tabBar";
import FileTypeIcon from "./FileTypeIcon";

type Layout = "list" | "grid" | "tile";
type StatusFilter = "active" | "archived" | "all";
const TYPES: DocType[] = ["docx", "xlsx", "pptx"];

function RowMenu({ doc, onRename, onDelete }: { doc: DocFile; onRename: () => void; onDelete: () => void }) {
	const t = useTranslations("collab");
	const updateDoc = useCollabStore((s) => s.updateDoc);
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, () => setOpen(false));
	const item = "block w-full px-16 py-10 text-left text-16 text-[#666666] transition-colors hover:bg-gray";
	return (
		<div ref={ref} className="relative inline-block">
			<button type="button" aria-label={t("more")} aria-expanded={open} onClick={() => setOpen(!open)} className="text-[#999999] transition-colors hover:text-primaryColor">
				<MdMoreHoriz size={22} />
			</button>
			<Dropdown open={open} className="right-0 top-full mt-8 min-w-[170px]">
				<div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white text-left shadow-custom">
					<button type="button" className={item} onClick={() => { setOpen(false); onRename(); }}>{t("rename")}</button>
					<button type="button" className={item} onClick={() => { setOpen(false); updateDoc(doc.id, { archived: !doc.archived }); }}>
						{doc.archived ? t("restore") : t("archive")}
					</button>
					<div className="border-t border-[#E2F1F5]" />
					<button type="button" className={`${item} !text-danger`} onClick={() => { setOpen(false); onDelete(); }}>{t("delete")}</button>
				</div>
			</Dropdown>
		</div>
	);
}

// Online Documents (/crm/collaboration/online-documents): три типа новых документов и список созданных
// (List / Grid / Tile). Сами редакторы документов пока не подключены — создаётся запись с именем и владельцем.
export default function Documents() {
	const t = useTranslations("collab");
	const locale = useLocale();
	useCollabHydration();
	const { docs, addDoc, updateDoc, deleteDoc } = useCollabStore();
	const user = useCurrentUserStore((s) => s.user);
	const me = user ? `${user.firstname} ${user.lastname}` : "—";

	const [layout, setLayout] = useState<Layout>("list");
	const [status, setStatus] = useState<StatusFilter>("active");
	const [statusOpen, setStatusOpen] = useState(false);
	const [sortAsc, setSortAsc] = useState(true);
	const [creating, setCreating] = useState<DocType | null>(null);
	const [renaming, setRenaming] = useState<DocFile | null>(null);
	const [name, setName] = useState("");
	const [toDelete, setToDelete] = useState<DocFile | null>(null);
	const statusRef = useRef<HTMLDivElement>(null);
	useClickOutside(statusRef, statusOpen, () => setStatusOpen(false));

	const visible = useMemo(() => {
		const list = docs.filter((d) => status === "all" || (status === "archived") === d.archived);
		return list.sort((a, b) => (sortAsc ? 1 : -1) * a.name.localeCompare(b.name, locale === "ua" ? "uk" : locale));
	}, [docs, status, sortAsc, locale]);

	function openCreate(type: DocType) {
		setName(`${t("newDocument")}`);
		setCreating(type);
	}
	function openRename(doc: DocFile) {
		setName(doc.name);
		setRenaming(doc);
	}
	function submitName(e: React.FormEvent) {
		e.preventDefault();
		const value = name.trim();
		if (!value) return void toast.error(t("nameRequired"));
		if (renaming) updateDoc(renaming.id, { name: value });
		else if (creating) addDoc(value, creating, me);
		setCreating(null);
		setRenaming(null);
		toast.success(t("saved"));
	}

	const th = "border-l border-[#F0F0F0] px-10 py-16 text-center text-16 font-medium text-[#999999] first:border-l-0 md:text-18";
	const td = "truncate px-10 text-center text-16 text-[#999999] md:text-18";
	const statusLabel = { active: t("active"), archived: t("archived"), all: t("all") };

	return (
		<div className="p-16 pt-0 md:p-30">
			<ul className="mx-auto grid max-w-[1000px] grid-cols-2 gap-16 pt-16 md:grid-cols-3 md:gap-24 md:pt-0 lg:gap-35">
				{TYPES.map((type) => (
					<li key={type}>
						<button
							type="button"
							onClick={() => openCreate(type)}
							className="flex aspect-square w-full flex-col items-center justify-center gap-10 rounded-24 bg-white shadow-heroImage transition-transform duration-200 hover:-translate-y-2 lg:max-h-[297px]">
							<FileTypeIcon type={type} size={80} />
							<span className="text-16 font-semibold text-[#999999] md:text-18">{t("document")}</span>
						</button>
					</li>
				))}
			</ul>

			<div className={`${TAB_BAR} mt-24 justify-center md:mt-30 md:w-fit md:justify-start`}>
				{(["list", "grid", "tile"] as const).map((key) => (
					<button
						key={key}
						type="button"
						onClick={() => setLayout(key)}
						className={`rounded-4 px-16 py-10 text-16 font-medium tracking-[0.32px] transition-colors duration-200 md:px-24 ${layout === key ? "bg-primaryColor text-white" : "text-[#CCCCCC] hover:text-[#999999]"}`}>
						{t(key)}
					</button>
				))}
			</div>

			<div className="mt-24 min-h-[300px] rounded-16 bg-white shadow-heroImage md:mt-30">
				{layout === "list" ? (
					<div className="max-md:min-h-[200px] max-md:overflow-x-auto">
						<table className="w-full min-w-[560px] table-fixed border-collapse">
							<thead>
								<tr className="border-b border-[#F0F0F0] bg-[#FAFCFF]">
									<th className={th}>
										<button type="button" onClick={() => setSortAsc(!sortAsc)} className="text-primaryColor" aria-label={t("sortByName")}>
											{t("fileName")} {sortAsc ? "↑" : "↓"}
										</button>
									</th>
									<th className={th}>
										<div ref={statusRef} className="relative inline-block">
											<button type="button" onClick={() => setStatusOpen(!statusOpen)} aria-expanded={statusOpen} className="inline-flex items-center gap-6">
												{statusLabel[status]}
												<MdKeyboardArrowDown size={20} className={`transition-transform duration-200 ${statusOpen ? "rotate-180" : ""}`} />
											</button>
											<Dropdown open={statusOpen} className="left-1/2 top-full mt-8 min-w-[150px] -translate-x-1/2">
												<div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white text-left shadow-custom">
													{(["active", "archived", "all"] as const).map((s) => (
														<button
															key={s}
															type="button"
															onClick={() => { setStatus(s); setStatusOpen(false); }}
															className={`block w-full px-16 py-10 text-left text-16 transition-colors hover:bg-gray ${status === s ? "text-primaryColor" : "text-[#666666]"}`}>
															{statusLabel[s]}
														</button>
													))}
												</div>
											</Dropdown>
										</div>
									</th>
									<th className={th}>{t("createdBy")}</th>
									<th className={th}>{t("shared")}</th>
									<th className="w-[50px]" />
								</tr>
							</thead>
							<tbody>
								{visible.map((d) => (
									<tr key={d.id} className="h-[64px] animate-fade-in border-b border-[#F0F0F0] transition-colors duration-150 hover:bg-[#F7F9FF]">
										<td className="px-16">
											<span className="flex items-center gap-10">
												<FileTypeIcon type={d.type} size={22} withLabel={false} />
												<span className="truncate text-16 text-[#666666] md:text-18">{d.name}</span>
											</span>
										</td>
										<td className={td}>{d.archived ? t("archived") : t("active")}</td>
										<td className={td}>{d.createdBy}</td>
										<td className="text-center">
											<Checkbox checked={d.shared} onChange={(v) => updateDoc(d.id, { shared: v })} label={t("shared")} />
										</td>
										<td className="pr-10 text-center"><RowMenu doc={d} onRename={() => openRename(d)} onDelete={() => setToDelete(d)} /></td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<ul className={`grid gap-16 p-16 md:p-24 ${layout === "grid" ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
						{visible.map((d) => (
							<li key={d.id} className={`animate-fade-in rounded-16 border border-[#EFEFEF] shadow-custom ${layout === "grid" ? "flex flex-col items-center gap-8 p-16 text-center" : "flex items-center gap-16 p-16"}`}>
								<FileTypeIcon type={d.type} size={layout === "grid" ? 50 : 44} />
								<div className="min-w-0 flex-1">
									<p className="truncate text-16 font-medium text-[#666666]">{d.name}</p>
									<p className="truncate text-14 text-[#999999]">{d.createdBy}</p>
								</div>
								<RowMenu doc={d} onRename={() => openRename(d)} onDelete={() => setToDelete(d)} />
							</li>
						))}
					</ul>
				)}
				{visible.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{t("docsEmpty")}</p>}
			</div>

			<Modal open={creating !== null || renaming !== null} onClose={() => { setCreating(null); setRenaming(null); }} label={t("document")} className="w-full max-w-[440px]">
				<form onSubmit={submitName} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-20 flex items-center gap-12 text-24 font-medium text-black">
						{creating && <FileTypeIcon type={creating} size={26} withLabel={false} />}
						{renaming ? t("rename") : t("newDocument")}
					</h2>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={100}
						autoFocus
						aria-label={t("fileName")}
						className="h-50 w-full rounded-8 border border-[#E6E6E6] bg-[#FBFBFB] px-16 text-16 text-black shadow-custom outline-none transition-colors focus:border-[#5EA8F5]"
					/>
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => { setCreating(null); setRenaming(null); }} className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray">
							{t("cancel")}
						</button>
						<button type="submit" className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80">
							{renaming ? t("save") : t("create")}
						</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog
				open={toDelete !== null}
				title={t("delete")}
				text={t("confirmDeleteDoc")}
				onCancel={() => setToDelete(null)}
				onConfirm={() => { const d = toDelete; setToDelete(null); if (d) deleteDoc(d.id); }}
			/>
		</div>
	);
}
