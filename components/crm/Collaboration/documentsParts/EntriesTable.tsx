"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbChevronDown } from "react-icons/tb";
import type { DocItemDTO, FolderDTO } from "@/types/documents";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import EntryIcon from "./EntryIcon";
import RowMenu from "./RowMenu";
import type { Action, StatusFilter } from "./model";

interface Props {
	subfolders: FolderDTO[];
	docs: DocItemDTO[];
	sortAsc: boolean;
	onSort: () => void;
	status: StatusFilter;
	onStatus: (status: StatusFilter) => void;
	onOpenFolder: (id: string) => void;
	onOpenDoc: (doc: DocItemDTO) => void;
	folderActions: (folder: FolderDTO) => Action[];
	docActions: (doc: DocItemDTO) => Action[];
	kindLabel: (doc: DocItemDTO) => string;
	dateLabel: (iso: string) => string;
	// «пусто» / «…» под таблицей; null — показывать нечего
	notice: string | null;
}

const th = "px-10 text-center";
const td = "truncate px-10 text-center text-13";

// Режим «Список»: папки, затем файлы; у столбца статуса — выпадающий фильтр архива
export default function EntriesTable({ subfolders, docs, sortAsc, onSort, status, onStatus, onOpenFolder, onOpenDoc, folderActions, docActions, kindLabel, dateLabel, notice }: Props) {
	const t = useTranslations("collab");
	const [statusOpen, setStatusOpen] = useState(false);
	const statusRef = useRef<HTMLDivElement>(null);
	useClickOutside(statusRef, statusOpen, () => setStatusOpen(false));
	const statusLabel = { active: t("active"), archived: t("archived"), all: t("all") };

	return (
		<div className="fs-card overflow-x-auto">
			<table className="fs-table min-w-[620px] table-fixed">
				<thead>
					<tr>
						<th className={`${th} w-[38%]`}>
							<button type="button" onClick={onSort} className="inline-flex items-center gap-6 transition-colors hover:text-[#c6ff4d]" aria-label={t("sortByName")}>
								{t("fileName")} {sortAsc ? "↑" : "↓"}
							</button>
						</th>
						<th className={th}>
							<div ref={statusRef} className="relative inline-block">
								<button type="button" onClick={() => setStatusOpen(!statusOpen)} aria-expanded={statusOpen} className="inline-flex items-center gap-6 transition-colors hover:text-[#c6ff4d]">
									{statusLabel[status]}
									<TbChevronDown size={16} className={`transition-transform duration-200 ${statusOpen ? "rotate-180" : ""}`} />
								</button>
								<Dropdown open={statusOpen} className="left-1/2 top-full mt-8 min-w-[150px] -translate-x-1/2">
									<div className="fs-popover overflow-hidden py-2 text-left">
										{(["active", "archived", "all"] as const).map((s) => (
											<button
												key={s}
												type="button"
												onClick={() => { onStatus(s); setStatusOpen(false); }}
												className={`fs-popover-row block w-full px-14 py-10 text-left text-13 transition-colors duration-150 ${status === s ? "text-[#c6ff4d]" : ""}`}>
												{statusLabel[s]}
											</button>
										))}
									</div>
								</Dropdown>
							</div>
						</th>
						<th className={th}>{t("createdBy")}</th>
						<th className={th}>{t("modified")}</th>
						<th className="w-[50px]" />
					</tr>
				</thead>
				<tbody>
					{subfolders.map((f) => (
						<tr key={f.id} className="h-[52px] animate-fade-in">
							<td className="px-16">
								<button type="button" onClick={() => onOpenFolder(f.id)} className="flex w-full items-center gap-10 text-left transition-colors hover:text-[#c6ff4d]">
									<EntryIcon folder size={20} />
									<span className="truncate text-13 font-medium text-[#f1f4ee]">{f.name}</span>
								</button>
							</td>
							<td className={td}>{t("folder")}</td>
							<td className={td}>—</td>
							<td className={td}>—</td>
							<td className="pr-10 text-center"><RowMenu actions={folderActions(f)} /></td>
						</tr>
					))}
					{docs.map((d) => (
						<tr key={d.id} className="h-[52px] animate-fade-in">
							<td className="px-16">
								<button type="button" onClick={() => onOpenDoc(d)} className="flex w-full items-center gap-10 text-left transition-colors hover:text-[#c6ff4d]" title={d.url ? t("openInGoogle") : t("openFile")}>
									<EntryIcon doc={d} size={18} />
									<span className="min-w-0">
										<span className="block truncate text-13 text-[#f1f4ee]">{d.name}</span>
										<span className="block truncate text-11 text-[#8c948b]">{kindLabel(d)}</span>
									</span>
								</button>
							</td>
							<td className={td}>{d.archived ? t("archived") : t("active")}</td>
							<td className={td}>{d.createdBy}</td>
							<td className={td}>{dateLabel(d.modifiedAt)}</td>
							<td className="pr-10 text-center"><RowMenu actions={docActions(d)} /></td>
						</tr>
					))}
				</tbody>
			</table>
			{notice && <p className="py-40 text-center text-13 text-[#8c948b]">{notice}</p>}
		</div>
	);
}
