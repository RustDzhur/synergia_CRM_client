"use client";
import type React from "react";
import type { DocItemDTO, FolderDTO } from "@/types/documents";
import EntryIcon from "./EntryIcon";
import RowMenu from "./RowMenu";
import type { Action, Layout } from "./model";

interface Props {
	layout: Exclude<Layout, "list">;
	subfolders: FolderDTO[];
	docs: DocItemDTO[];
	onOpenFolder: (id: string) => void;
	onOpenDoc: (doc: DocItemDTO) => void;
	folderActions: (folder: FolderDTO) => Action[];
	docActions: (doc: DocItemDTO) => Action[];
	kindLabel: (doc: DocItemDTO) => string;
	notice: string | null;
}

// Режимы «Сетка» и «Плитки»: та же выдача карточками
export default function EntriesGrid({ layout, subfolders, docs, onOpenFolder, onOpenDoc, folderActions, docActions, kindLabel, notice }: Props) {
	const grid = layout === "grid";
	// Каждая плитка — отдельный слой (анимация появления создаёт свой контекст наложения), поэтому меню «⋯» открытой плитки пряталось под соседними
	// и по нему нельзя было нажать. Плитка с открытым меню поднимается выше остальных (:has по aria-expanded кнопки меню).
	const card = `fs-card relative min-w-0 animate-fade-in [&:has([aria-expanded=true])]:z-40 transition-colors duration-150 hover:border-[rgba(198,255,77,0.28)] ${grid ? "flex flex-col items-center gap-8 p-14 text-center" : "flex items-center gap-16 p-14"}`;
	// Длинное имя без пробелов раньше шло одной строкой и залезало на соседние плитки: в сетке оно переносится (до двух строк), в плитках обрезается
	const name = grid ? "block w-full min-w-0 [overflow-wrap:anywhere] text-13 font-medium text-[#f1f4ee]" : "block truncate text-13 font-medium text-[#f1f4ee]";
	const clamp = grid ? ({ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties) : undefined;
	const open = `flex min-w-0 flex-1 gap-8 transition-colors hover:text-[#c6ff4d] ${grid ? "flex-col items-center" : "items-center text-left"}`;
	return (
		<>
			<ul className={`grid gap-12 ${grid ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
				{subfolders.map((f) => (
					<li key={f.id} className={card}>
						<button type="button" onClick={() => onOpenFolder(f.id)} className={open}>
							<EntryIcon folder size={grid ? 36 : 30} />
							<span className={name} style={clamp} title={f.name}>{f.name}</span>
						</button>
						<RowMenu actions={folderActions(f)} />
					</li>
				))}
				{docs.map((d) => (
					<li key={d.id} className={card}>
						<button type="button" onClick={() => onOpenDoc(d)} className={open}>
							<EntryIcon doc={d} size={grid ? 36 : 30} />
							<span className="w-full min-w-0">
								<span className={name} style={clamp} title={d.name}>{d.name}</span>
								<span className="block truncate text-11 text-[#8c948b]">{kindLabel(d)}</span>
							</span>
						</button>
						<RowMenu actions={docActions(d)} />
					</li>
				))}
			</ul>
			{notice && <p className="py-40 text-center text-13 text-[#8c948b]">{notice}</p>}
		</>
	);
}
