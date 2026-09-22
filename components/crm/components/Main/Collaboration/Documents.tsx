"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdCloudUpload, MdFolder, MdImage, MdInsertDriveFile, MdKeyboardArrowDown, MdMoreHoriz, MdRefresh } from "react-icons/md";
import type { DocItemDTO, DocKind, FolderDTO } from "@/app/types/documents";
import { authHeaders } from "@/app/store/crmApi";
import { useAiStore } from "@/app/store/useAiStore";
import { useDocsStore } from "@/app/store/useDocsStore";
import Dropdown from "@/app/utils/Dropdown";
import { shrinkImage } from "@/app/utils/imageResize";
import { stripLocale } from "@/app/utils/locale";
import { useClickOutside } from "@/app/utils/useClickOutside";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import { TAB_BAR } from "../shared/tabBar";
import FileTypeIcon from "./FileTypeIcon";

type Layout = "list" | "grid" | "tile";
type StatusFilter = "active" | "archived" | "all";
type GoogleKind = Exclude<DocKind, "file">;
const GOOGLE_KINDS: GoogleKind[] = ["gdoc", "gsheet", "gslide"];
const ICON_TYPE = { gdoc: "docx", gsheet: "xlsx", gslide: "pptx" } as const;
const INLINE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

type NameMode = { kind: "doc"; docKind: GoogleKind } | { kind: "folder-new" } | { kind: "folder-rename"; folder: FolderDTO } | { kind: "doc-rename"; doc: DocItemDTO };
type Target = { type: "folder"; folder: FolderDTO } | { type: "doc"; doc: DocItemDTO };

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

interface Action { label: string; onClick: () => void; danger?: boolean }

function RowMenu({ actions }: { actions: Action[] }) {
	const t = useTranslations("collab");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, () => setOpen(false));
	const item = "block w-full px-16 py-10 text-left text-16 text-[#666666] transition-colors hover:bg-gray";
	return (
		<div ref={ref} className="relative inline-block">
			<button type="button" aria-label={t("more")} aria-expanded={open} onClick={() => setOpen(!open)} className="text-[#999999] transition-colors hover:text-primaryColor">
				<MdMoreHoriz size={22} />
			</button>
			<Dropdown open={open} className="right-0 top-full mt-8 min-w-[190px]">
				<div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white text-left shadow-custom">
					{actions.map((a, i) => (
						<React.Fragment key={a.label}>
							{a.danger && i > 0 && <div className="border-t border-[#E2F1F5]" />}
							<button type="button" className={`${item} ${a.danger ? "!text-danger" : ""}`} onClick={() => { setOpen(false); a.onClick(); }}>{a.label}</button>
						</React.Fragment>
					))}
				</div>
			</Dropdown>
		</div>
	);
}

function EntryIcon({ doc, folder, size }: { doc?: DocItemDTO; folder?: boolean; size: number }) {
	if (folder) return <MdFolder size={size} className="shrink-0 text-[#FABF4D]" aria-hidden />;
	if (doc && doc.kind !== "file") return <FileTypeIcon type={ICON_TYPE[doc.kind]} size={size} withLabel={false} />;
	if (doc?.mime.startsWith("image/")) return <MdImage size={size} className="shrink-0 text-[#7CB305]" aria-hidden />;
	return <MdInsertDriveFile size={size} className="shrink-0 text-[#999999]" aria-hidden />;
}

// Online Documents (/crm/collaboration/online-documents): Google Docs / Sheets / Slides создаются на Google Drive пользователя
// (редактируются в Google в новой вкладке и сохраняются там сами), файлы и фото хранятся в Firebase Storage. Всё раскладывается по папкам.
export default function Documents() {
	const t = useTranslations("collab");
	const tAi = useTranslations("ai");
	const locale = useLocale();
	const pagePath = stripLocale(usePathname());
	const { show: showAi, send: sendAi, status: aiStatus, loadStatus: loadAiStatus } = useAiStore();
	useEffect(() => { if (!useAiStore.getState().status) loadAiStatus(); }, [loadAiStatus]);
	const canAnalyzeDocs = !!aiStatus?.configured && (aiStatus.tools.some((x) => x.name === "read_document"));
	const { state, loading, load, createFolder, patchFolder, deleteFolder, createDoc, patchDoc, deleteDoc, upload, connectDrive, disconnectDrive } = useDocsStore();

	const [layout, setLayout] = useState<Layout>("list");
	const [status, setStatus] = useState<StatusFilter>("active");
	const [statusOpen, setStatusOpen] = useState(false);
	const [sortAsc, setSortAsc] = useState(true);
	const [current, setCurrent] = useState<string | null>(null);
	const [nameMode, setNameMode] = useState<NameMode | null>(null);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [moving, setMoving] = useState<Target | null>(null);
	const [moveTo, setMoveTo] = useState("");
	const [toDelete, setToDelete] = useState<Target | null>(null);
	const statusRef = useRef<HTMLDivElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	useClickOutside(statusRef, statusOpen, () => setStatusOpen(false));

	// возврат с Google после подключения Диска: ?drive=connected|denied|error
	useEffect(() => {
		const q = new URLSearchParams(window.location.search);
		const result = q.get("drive");
		if (result) {
			window.history.replaceState(null, "", window.location.pathname);
			if (result === "connected") toast.success(t("driveConnectedToast"));
			else if (result === "denied") toast(t("driveDenied"));
			else toast.error(t("driveError", { message: q.get("message") ?? "" }));
		}
		load(true);
	}, [load, t]);

	const folders = useMemo(() => state?.folders ?? [], [state]);
	const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
	const collator = useMemo(() => new Intl.Collator(locale === "ua" ? "uk" : locale), [locale]);

	// цепочка папок от корня до текущей (хлебные крошки)
	const path = useMemo(() => {
		const out: FolderDTO[] = [];
		let id = current;
		while (id && byId.has(id) && out.length < 20) {
			out.unshift(byId.get(id)!);
			id = byId.get(id)!.parent;
		}
		return out;
	}, [current, byId]);

	const subfolders = useMemo(() => folders.filter((f) => f.parent === current).sort((a, b) => (sortAsc ? 1 : -1) * collator.compare(a.name, b.name)), [folders, current, sortAsc, collator]);
	const docs = useMemo(
		() => (state?.docs ?? []).filter((d) => d.folder === current && (status === "all" || (status === "archived") === d.archived)).sort((a, b) => (sortAsc ? 1 : -1) * collator.compare(a.name, b.name)),
		[state, current, status, sortAsc, collator]
	);

	const drive = state?.drive;
	const storage = state?.storage;

	// Кнопка подключения Диска: ошибку (например, не настроены ключи Google) показываем, а не молчим
	async function connect() {
		const res = await connectDrive(locale);
		if (!res.ok) toast.error(res.message);
	}

	function startCreate(kind: GoogleKind) {
		if (!drive?.connected) {
			// подсказка со ссылкой-кнопкой: сразу можно подключить Диск, не ища блок вверху страницы
			return void toast(
				(m) => (
					<span className="flex flex-col gap-8">
						<span>{drive && !drive.configured ? t("driveNotConfigured") : t("driveConnectFirst")}</span>
						{(!drive || drive.configured) && (
							<button type="button" onClick={() => { toast.dismiss(m.id); connect(); }} className="self-start rounded-8 bg-primaryColor px-14 py-6 text-14 font-medium text-white transition-opacity hover:opacity-80">
								{t("driveConnectButton")}
							</button>
						)}
					</span>
				),
				{ duration: 10000 }
			);
		}
		setName(t("newDocument"));
		setNameMode({ kind: "doc", docKind: kind });
	}

	async function submitName(e: React.FormEvent) {
		e.preventDefault();
		const value = name.trim();
		if (!value) return void toast.error(t("nameRequired"));
		if (!nameMode || busy) return;
		setBusy(true);
		if (nameMode.kind === "doc") {
			// вкладку открываем сразу по клику (иначе браузер заблокирует всплывающее окно), а адрес подставляем, когда документ создан
			const tab = window.open("", "_blank");
			const res = await createDoc(nameMode.docKind, value, current);
			setBusy(false);
			if (!res.ok || !res.doc) {
				tab?.close();
				return void toast.error(res.message);
			}
			if (tab && res.doc.url) tab.location.href = res.doc.url;
			else toast(t("docCreatedOpen"), { duration: 6000 });
			setNameMode(null);
			return void toast.success(t("docCreated"));
		}
		const res =
			nameMode.kind === "folder-new" ? await createFolder(value, current)
			: nameMode.kind === "folder-rename" ? await patchFolder(nameMode.folder.id, { name: value })
			: await patchDoc(nameMode.doc.id, { name: value });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setNameMode(null);
		toast.success(t("saved"));
	}

	async function openDoc(d: DocItemDTO) {
		if (d.kind !== "file") return void window.open(d.url, "_blank", "noopener");
		const inline = INLINE_TYPES.includes(d.mime);
		const tab = inline ? window.open("", "_blank") : null;
		try {
			const res = await fetch(`/api/documents/${d.id}/content`, { headers: authHeaders(false) });
			if (!res.ok) throw new Error();
			const url = URL.createObjectURL(await res.blob());
			if (tab) tab.location.href = url;
			else {
				const a = document.createElement("a");
				a.href = url;
				a.download = d.name;
				a.click();
			}
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch {
			tab?.close();
			toast.error(t("fileOpenFailed"));
		}
	}

	async function onFiles(list: FileList | null) {
		if (!list?.length) return;
		let done = 0;
		for (const original of Array.from(list)) {
			const id = toast.loading(t("uploading", { name: original.name }));
			const res = await upload(await shrinkImage(original), current);
			toast.dismiss(id);
			if (res.ok) done += 1;
			else toast.error(t("uploadFailed", { name: original.name, message: res.message }));
		}
		if (done) toast.success(t("uploadedCount", { count: done }));
		if (fileRef.current) fileRef.current.value = "";
	}

	function startUpload() {
		if (!storage?.configured) return void toast(t("storageNotConfigured"));
		fileRef.current?.click();
	}

	// список папок для окна «Переместить»: с отступами по вложенности, без самой папки и её потомков
	const moveOptions = useMemo(() => {
		const banned = new Set<string>();
		if (moving?.type === "folder") {
			const walk = (id: string) => { banned.add(id); folders.filter((f) => f.parent === id).forEach((f) => walk(f.id)); };
			walk(moving.folder.id);
		}
		const out: { id: string; label: string }[] = [{ id: "", label: t("rootFolder") }];
		const add = (parent: string | null, depth: number) => {
			for (const f of folders.filter((x) => x.parent === parent).sort((a, b) => collator.compare(a.name, b.name))) {
				if (banned.has(f.id)) continue;
				out.push({ id: f.id, label: `${"  ".repeat(depth)}${depth ? "↳ " : ""}${f.name}` });
				add(f.id, depth + 1);
			}
		};
		add(null, 0);
		return out;
	}, [moving, folders, collator, t]);

	function startMove(target: Target) {
		setMoveTo(target.type === "folder" ? target.folder.parent ?? "" : target.doc.folder ?? "");
		setMoving(target);
	}
	async function submitMove(e: React.FormEvent) {
		e.preventDefault();
		if (!moving || busy) return;
		setBusy(true);
		const dest = moveTo || null;
		const res = moving.type === "folder" ? await patchFolder(moving.folder.id, { parent: dest }) : await patchDoc(moving.doc.id, { folder: dest });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setMoving(null);
		toast.success(t("moved"));
	}

	async function confirmDelete() {
		const target = toDelete;
		setToDelete(null);
		if (!target) return;
		const res = target.type === "folder" ? await deleteFolder(target.folder.id) : await deleteDoc(target.doc.id);
		if (!res.ok) toast.error(res.message);
	}

	const kindLabel = (d: DocItemDTO) => (d.kind === "file" ? fmtSize(d.size) : t(`kind_${d.kind}`));
	const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(locale === "ua" ? "uk" : locale);
	const folderActions = (f: FolderDTO): Action[] => [
		{ label: t("open"), onClick: () => setCurrent(f.id) },
		{ label: t("rename"), onClick: () => { setName(f.name); setNameMode({ kind: "folder-rename", folder: f }); } },
		{ label: t("moveTo"), onClick: () => startMove({ type: "folder", folder: f }) },
		{ label: t("delete"), onClick: () => setToDelete({ type: "folder", folder: f }), danger: true },
	];
	function analyzeDoc(d: DocItemDTO) {
		showAi();
		sendAi(tAi("analyzeDocPrompt", { name: d.name }), { locale, page: pagePath });
	}
	const docActions = (d: DocItemDTO): Action[] => [
		{ label: d.kind === "file" ? t("openFile") : t("openInGoogle"), onClick: () => openDoc(d) },
		...(canAnalyzeDocs && d.kind === "file" && d.mime === "application/pdf" ? [{ label: tAi("analyzeDoc"), onClick: () => analyzeDoc(d) }] : []),
		{ label: t("rename"), onClick: () => { setName(d.name); setNameMode({ kind: "doc-rename", doc: d }); } },
		{ label: t("moveTo"), onClick: () => startMove({ type: "doc", doc: d }) },
		{ label: d.archived ? t("restore") : t("archive"), onClick: () => void patchDoc(d.id, { archived: !d.archived }) },
		{ label: t("delete"), onClick: () => setToDelete({ type: "doc", doc: d }), danger: true },
	];

	const th = "border-l border-[#F0F0F0] px-10 py-16 text-center text-16 font-medium text-[#999999] first:border-l-0 md:text-18";
	const td = "truncate px-10 text-center text-16 text-[#999999] md:text-18";
	const statusLabel = { active: t("active"), archived: t("archived"), all: t("all") };
	const primary = "h-[44px] rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60";
	const empty = subfolders.length === 0 && docs.length === 0;

	return (
		<div className="p-16 pt-0 md:p-30">
			<div className="mx-auto max-w-[1000px] pt-16 md:pt-0">
				{drive && !drive.connected && (
					<div className="mb-16 flex flex-col gap-12 rounded-16 bg-white p-16 shadow-heroImage md:flex-row md:items-center md:justify-between">
						<div>
							<p className="text-16 font-medium text-[#333333]">{t("driveConnectTitle")}</p>
							<p className="mt-2 text-14 text-[#666666]">{drive.configured ? t("driveConnectText") : t("driveNotConfigured")}</p>
						</div>
						{drive.configured && <button type="button" onClick={connect} className={`${primary} shrink-0`}>{t("driveConnectButton")}</button>}
					</div>
				)}
				{drive?.connected && (
					<p className="mb-16 flex flex-wrap items-center gap-x-12 gap-y-2 text-14 text-[#999999]">
						{t("driveConnectedAs", { email: drive.email || "Google" })}
						<button type="button" onClick={() => disconnectDrive()} className="text-primaryColor transition-opacity hover:opacity-80">{t("driveDisconnect")}</button>
					</p>
				)}

				<ul className="grid grid-cols-2 gap-16 md:grid-cols-4 md:gap-24 lg:gap-35">
					{GOOGLE_KINDS.map((kind) => (
						<li key={kind}>
							<button
								type="button"
								onClick={() => startCreate(kind)}
								className={`flex aspect-square w-full flex-col items-center justify-center gap-10 rounded-24 bg-white shadow-heroImage transition-transform duration-200 hover:-translate-y-2 lg:max-h-[240px] ${drive?.connected ? "" : "opacity-60"}`}>
								<FileTypeIcon type={ICON_TYPE[kind]} size={72} />
								<span className="text-16 font-semibold text-[#999999] md:text-18">{t(`kind_${kind}`)}</span>
							</button>
						</li>
					))}
					<li>
						<button
							type="button"
							onClick={startUpload}
							className={`flex aspect-square w-full flex-col items-center justify-center gap-10 rounded-24 bg-white shadow-heroImage transition-transform duration-200 hover:-translate-y-2 lg:max-h-[240px] ${storage?.configured ? "" : "opacity-60"}`}>
							<MdCloudUpload size={72} className="text-[#B3B3B3]" aria-hidden />
							<span className="text-16 font-semibold text-[#999999] md:text-18">{t("uploadFile")}</span>
						</button>
						<input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} aria-label={t("uploadFile")} />
					</li>
				</ul>
			</div>

			<div className="mx-auto mt-24 flex max-w-[1000px] flex-wrap items-center justify-between gap-x-16 gap-y-12 md:mt-30">
				<div className={`${TAB_BAR} justify-center md:w-fit md:justify-start`}>
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
				<div className="flex items-center gap-12">
					<button type="button" onClick={() => load(true)} aria-label={t("refresh")} title={t("refresh")} className="text-primaryColor transition-opacity hover:opacity-80">
						<MdRefresh size={24} className={loading ? "animate-spin" : ""} />
					</button>
					<button type="button" onClick={() => { setName(""); setNameMode({ kind: "folder-new" }); }} className="h-[44px] rounded-8 border border-[#5EA8F5] px-20 text-16 font-medium text-primaryColor transition-opacity hover:opacity-80">
						{t("folderNew")}
					</button>
				</div>
			</div>

			<nav aria-label={t("breadcrumbs")} className="mx-auto mt-16 flex max-w-[1000px] flex-wrap items-center gap-x-8 gap-y-2 text-16">
				<button type="button" onClick={() => setCurrent(null)} className={current === null ? "font-semibold text-[#666666]" : "text-primaryColor hover:underline"}>{t("rootFolder")}</button>
				{path.map((f, i) => (
					<React.Fragment key={f.id}>
						<span className="text-[#CCCCCC]" aria-hidden>/</span>
						<button type="button" onClick={() => setCurrent(f.id)} className={i === path.length - 1 ? "font-semibold text-[#666666]" : "text-primaryColor hover:underline"}>{f.name}</button>
					</React.Fragment>
				))}
			</nav>

			<div className="mx-auto mt-16 min-h-[300px] max-w-[1000px] rounded-16 bg-white shadow-heroImage">
				{layout === "list" ? (
					<div className="max-md:min-h-[200px] max-md:overflow-x-auto">
						<table className="w-full min-w-[620px] table-fixed border-collapse">
							<thead>
								<tr className="border-b border-[#F0F0F0] bg-[#FAFCFF]">
									<th className={`${th} w-[38%]`}>
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
									<th className={th}>{t("modified")}</th>
									<th className="w-[50px]" />
								</tr>
							</thead>
							<tbody>
								{subfolders.map((f) => (
									<tr key={f.id} className="h-[64px] animate-fade-in border-b border-[#F0F0F0] transition-colors duration-150 hover:bg-[#F7F9FF]">
										<td className="px-16">
											<button type="button" onClick={() => setCurrent(f.id)} className="flex w-full items-center gap-10 text-left">
												<EntryIcon folder size={26} />
												<span className="truncate text-16 font-medium text-[#666666] md:text-18">{f.name}</span>
											</button>
										</td>
										<td className={td}>{t("folder")}</td>
										<td className={td}>—</td>
										<td className={td}>—</td>
										<td className="pr-10 text-center"><RowMenu actions={folderActions(f)} /></td>
									</tr>
								))}
								{docs.map((d) => (
									<tr key={d.id} className="h-[64px] animate-fade-in border-b border-[#F0F0F0] transition-colors duration-150 hover:bg-[#F7F9FF]">
										<td className="px-16">
											<button type="button" onClick={() => openDoc(d)} className="flex w-full items-center gap-10 text-left" title={d.kind === "file" ? t("openFile") : t("openInGoogle")}>
												<EntryIcon doc={d} size={22} />
												<span className="min-w-0">
													<span className="block truncate text-16 text-[#666666] md:text-18">{d.name}</span>
													<span className="block truncate text-12 text-[#B3B3B3]">{kindLabel(d)}</span>
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
					</div>
				) : (
					<ul className={`grid gap-16 p-16 md:p-24 ${layout === "grid" ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
						{subfolders.map((f) => (
							<li key={f.id} className={`animate-fade-in rounded-16 border border-[#EFEFEF] shadow-custom ${layout === "grid" ? "flex flex-col items-center gap-8 p-16 text-center" : "flex items-center gap-16 p-16"}`}>
								<button type="button" onClick={() => setCurrent(f.id)} className={`flex min-w-0 flex-1 gap-8 ${layout === "grid" ? "flex-col items-center" : "items-center text-left"}`}>
									<EntryIcon folder size={layout === "grid" ? 50 : 44} />
									<span className="w-full truncate text-16 font-medium text-[#666666]">{f.name}</span>
								</button>
								<RowMenu actions={folderActions(f)} />
							</li>
						))}
						{docs.map((d) => (
							<li key={d.id} className={`animate-fade-in rounded-16 border border-[#EFEFEF] shadow-custom ${layout === "grid" ? "flex flex-col items-center gap-8 p-16 text-center" : "flex items-center gap-16 p-16"}`}>
								<button type="button" onClick={() => openDoc(d)} className={`flex min-w-0 flex-1 gap-8 ${layout === "grid" ? "flex-col items-center" : "items-center text-left"}`}>
									<EntryIcon doc={d} size={layout === "grid" ? 50 : 44} />
									<span className="w-full min-w-0">
										<span className="block truncate text-16 font-medium text-[#666666]">{d.name}</span>
										<span className="block truncate text-14 text-[#999999]">{kindLabel(d)}</span>
									</span>
								</button>
								<RowMenu actions={docActions(d)} />
							</li>
						))}
					</ul>
				)}
				{state && empty && <p className="py-40 text-center text-16 text-[#999999]">{current === null ? t("docsEmpty") : t("folderEmpty")}</p>}
				{!state && <p className="py-40 text-center text-16 text-[#999999]">…</p>}
			</div>

			<Modal open={nameMode !== null} onClose={() => setNameMode(null)} label={t("document")} className="w-full max-w-[440px]">
				<form onSubmit={submitName} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-20 flex items-center gap-12 text-24 font-medium text-black">
						{nameMode?.kind === "doc" && <FileTypeIcon type={ICON_TYPE[nameMode.docKind]} size={26} withLabel={false} />}
						{(nameMode?.kind === "folder-new" || nameMode?.kind === "folder-rename") && <MdFolder size={28} className="text-[#FABF4D]" aria-hidden />}
						{nameMode?.kind === "doc" ? t("newDocument") : nameMode?.kind === "folder-new" ? t("folderNew") : t("rename")}
					</h2>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={100}
						autoFocus
						placeholder={nameMode?.kind === "folder-new" || nameMode?.kind === "folder-rename" ? t("folderName") : undefined}
						aria-label={t("fileName")}
						className="h-50 w-full rounded-8 border border-[#E6E6E6] bg-[#FBFBFB] px-16 text-16 text-black shadow-custom outline-none transition-colors focus:border-[#5EA8F5]"
					/>
					{nameMode?.kind === "doc" && <p className="mt-10 text-14 text-[#999999]">{t("docOpenNote")}</p>}
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setNameMode(null)} className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray">{t("cancel")}</button>
						<button type="submit" disabled={busy} className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">
							{busy ? "…" : nameMode?.kind === "doc" || nameMode?.kind === "folder-new" ? t("create") : t("save")}
						</button>
					</div>
				</form>
			</Modal>

			<Modal open={moving !== null} onClose={() => setMoving(null)} label={t("moveTo")} className="w-full max-w-[440px]">
				<form onSubmit={submitMove} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-6 text-24 font-medium text-black">{t("moveTo")}</h2>
					<p className="mb-16 truncate text-14 text-[#999999]">{moving?.type === "folder" ? moving.folder.name : moving?.doc.name}</p>
					<select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label={t("moveTo")} className="h-50 w-full rounded-8 border border-[#E6E6E6] bg-[#FBFBFB] px-12 text-16 text-black outline-none focus:border-[#5EA8F5]">
						{moveOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
					</select>
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setMoving(null)} className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray">{t("cancel")}</button>
						<button type="submit" disabled={busy} className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">{busy ? "…" : t("moveHere")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog
				open={toDelete !== null}
				title={t("delete")}
				text={toDelete?.type === "folder" ? t("confirmDeleteFolder") : toDelete?.doc.kind === "file" ? t("confirmDeleteFile") : t("confirmDeleteDoc")}
				onCancel={() => setToDelete(null)}
				onConfirm={confirmDelete}
			/>
		</div>
	);
}
