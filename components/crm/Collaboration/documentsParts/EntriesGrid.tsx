"use client";
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
	const card = `fs-card animate-fade-in transition-colors duration-150 hover:border-[rgba(198,255,77,0.28)] ${grid ? "flex flex-col items-center gap-8 p-14 text-center" : "flex items-center gap-16 p-14"}`;
	const open = `flex min-w-0 flex-1 gap-8 transition-colors hover:text-[#c6ff4d] ${grid ? "flex-col items-center" : "items-center text-left"}`;
	return (
		<>
			<ul className={`grid gap-12 ${grid ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
				{subfolders.map((f) => (
					<li key={f.id} className={card}>
						<button type="button" onClick={() => onOpenFolder(f.id)} className={open}>
							<EntryIcon folder size={grid ? 36 : 30} />
							<span className="w-full truncate text-13 font-medium text-[#f1f4ee]">{f.name}</span>
						</button>
						<RowMenu actions={folderActions(f)} />
					</li>
				))}
				{docs.map((d) => (
					<li key={d.id} className={card}>
						<button type="button" onClick={() => onOpenDoc(d)} className={open}>
							<EntryIcon doc={d} size={grid ? 36 : 30} />
							<span className="w-full min-w-0">
								<span className="block truncate text-13 font-medium text-[#f1f4ee]">{d.name}</span>
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
