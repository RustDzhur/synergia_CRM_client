"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbChevronDown, TbCloudUpload, TbDots, TbFile, TbFolder, TbPhoto, TbRefresh } from "react-icons/tb";
import type { DocItemDTO, DocKind, FolderDTO } from "@/types/documents";
import { authHeaders } from "@/store/crmApi";
import { useAiStore } from "@/store/useAiStore";
import { useDocsStore } from "@/store/useDocsStore";
import Dropdown from "@/utils/Dropdown";
import { shrinkImage } from "@/utils/imageResize";
import { stripLocale } from "@/utils/locale";
import { useClickOutside } from "@/utils/useClickOutside";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import SearchBox from "../shared/SearchBox";
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
	const item = "fs-popover-row block w-full px-14 py-10 text-left text-13 transition-colors duration-150";
	return (
		<div ref={ref} className="relative inline-block">
			<button type="button" aria-label={t("more")} aria-expanded={open} onClick={() => setOpen(!open)} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
				<TbDots size={20} />
			</button>
			<Dropdown open={open} className="right-0 top-full mt-8 min-w-[190px]">
				<div className="fs-popover overflow-hidden py-2 text-left">
					{actions.map((a, i) => (
						<React.Fragment key={a.label}>
							{a.danger && i > 0 && <div className="border-t border-inkLine" />}
							<button type="button" className={`${item} ${a.danger ? "!text-danger" : ""}`} onClick={() => { setOpen(false); a.onClick(); }}>{a.label}</button>
						</React.Fragment>
					))}
				</div>
			</Dropdown>
		</div>
	);
}

function EntryIcon({ doc, folder, size }: { doc?: DocItemDTO; folder?: boolean; size: number }) {
	if (folder) return <TbFolder size={size} className="shrink-0 text-[#FABF4D]" aria-hidden />;
	if (doc && doc.kind !== "file") return <FileTypeIcon type={ICON_TYPE[doc.kind]} size={size} withLabel={false} />;
	if (doc?.mime.startsWith("image/")) return <TbPhoto size={size} className="shrink-0 text-[#7CB305]" aria-hidden />;
	return <TbFile size={size} className="shrink-0 text-[#8c948b]" aria-hidden />;
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
	const { state, loading, load, createFolder, patchFolder, deleteFolder, createDoc, patchDoc, deleteDoc, upload, connectDrive, importDrive, disconnectDrive } = useDocsStore();

	const [layout, setLayout] = useState<Layout>("list");
	const [status, setStatus] = useState<StatusFilter>("active");
	const [statusOpen, setStatusOpen] = useState(false);
	const [sortAsc, setSortAsc] = useState(true);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<Record<string, string>>({});
	const [current, setCurrent] = useState<string | null>(null);
	const [nameMode, setNameMode] = useState<NameMode | null>(null);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [importing, setImporting] = useState(false);
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

	// Поиск идёт по имени и по папкам, и по файлам: человек ищет файл, а не «список файлов»
	const q = query.trim().toLowerCase();
	const subfolders = useMemo(
		() => folders.filter((f) => f.parent === current && (!q || f.name.toLowerCase().includes(q))).sort((a, b) => (sortAsc ? 1 : -1) * collator.compare(a.name, b.name)),
		[folders, current, sortAsc, collator, q]
	);
	const docs = useMemo(
		() =>
			(state?.docs ?? [])
				.filter((d) => d.folder === current && (status === "all" || (status === "archived") === d.archived))
				.filter((d) => !q || d.name.toLowerCase().includes(q))
				.filter((d) => !filters.kind || d.kind === filters.kind)
				.filter((d) => !filters.source || (filters.source === "drive" ? !!d.imported : !d.imported))
				.filter((d) => !filters.createdBy || d.createdBy === filters.createdBy)
				.sort((a, b) => (sortAsc ? 1 : -1) * collator.compare(a.name, b.name)),
		[state, current, status, sortAsc, collator, q, filters]
	);

	// Фильтры — по столбцам списка, как в других разделах: тип, источник и автор
	const creators = useMemo(() => Array.from(new Set((state?.docs ?? []).map((d) => d.createdBy).filter(Boolean))).sort(), [state]);
	const filterDefs = useMemo(
		() => [
			{
				key: "kind",
				label: t("fileKind"),
				options: [
					{ value: "", label: `${t("all")} — ${t("fileKind")}` },
					{ value: "gdoc", label: t("kind_gdoc") },
					{ value: "gsheet", label: t("kind_gsheet") },
					{ value: "gslide", label: t("kind_gslide") },
					{ value: "file", label: t("kind_file") },
				],
			},
			{
				key: "source",
				label: t("fileSource"),
				options: [
					{ value: "", label: `${t("all")} — ${t("fileSource")}` },
					{ value: "drive", label: t("fileFromDrive") },
					{ value: "crm", label: t("fileInCrm") },
				],
			},
			...(creators.length
				? [{ key: "createdBy", label: t("createdBy"), options: [{ value: "", label: `${t("all")} — ${t("createdBy")}` }, ...creators.map((c) => ({ value: c, label: c }))] }]
				: []),
		],
		[t, creators]
	);

	const drive = state?.drive;
	const storage = state?.storage;

	// Кнопка подключения Диска: ошибку (например, не настроены ключи Google) показываем, а не молчим
	async function connect() {
		const res = await connectDrive(locale);
		if (!res.ok) toast.error(res.message);
	}

	// Перенос файлов, которые уже лежат на Диске: если Диск подключён до расширения прав, сервер просит
	// подключить его заново — тогда в уведомлении показываем кнопку, а не просто текст ошибки
	async function startImport() {
		if (importing) return;
		setImporting(true);
		const res = await importDrive();
		setImporting(false);
		if (res.ok) {
			if (res.imported) {
				setCurrent(null); // импортированные файлы появляются в корне раздела — показываем его
				toast.success(t("driveImportDone", { count: res.imported }));
			} else toast(t("driveImportEmpty"));
			return;
		}
		if (res.code === "drive_scope") {
			return void toast(
				(m) => (
					<span className="flex flex-col gap-8">
						<span>{res.message}</span>
						<button type="button" onClick={() => { toast.dismiss(m.id); connect(); }} className="fs-btn fs-btn-primary h-30 self-start">
							{t("driveReconnect")}
						</button>
					</span>
				),
				{ duration: 10000 }
			);
		}
		toast.error(res.message);
	}

	function startCreate(kind: GoogleKind) {
		if (!drive?.connected) {
			// подсказка со ссылкой-кнопкой: сразу можно подключить Диск, не ища блок вверху страницы
			return void toast(
				(m) => (
					<span className="flex flex-col gap-8">
						<span>{drive && !drive.configured ? t("driveNotConfigured") : t("driveConnectFirst")}</span>
						{(!drive || drive.configured) && (
							<button type="button" onClick={() => { toast.dismiss(m.id); connect(); }} className="fs-btn fs-btn-primary h-30 self-start">
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
		// документ живёт на Диске (Google-документ CRM или импортированный файл) — открываем ссылку Google
		if (d.url) return void window.open(d.url, "_blank", "noopener");
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

	// у импортированных файлов размер не запрашивается — вместо «1 KB» показываем, откуда файл
	const kindLabel = (d: DocItemDTO): string => (d.kind === "file" ? (d.imported ? t("fileFromDrive") : fmtSize(d.size)) : t(`kind_${d.kind}`));
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
		{ label: d.url ? t("openInGoogle") : t("openFile"), onClick: () => openDoc(d) },
		...(canAnalyzeDocs && d.kind === "file" && d.mime === "application/pdf" ? [{ label: tAi("analyzeDoc"), onClick: () => analyzeDoc(d) }] : []),
		{ label: t("rename"), onClick: () => { setName(d.name); setNameMode({ kind: "doc-rename", doc: d }); } },
		{ label: t("moveTo"), onClick: () => startMove({ type: "doc", doc: d }) },
		{ label: d.archived ? t("restore") : t("archive"), onClick: () => void patchDoc(d.id, { archived: !d.archived }) },
		{ label: t("delete"), onClick: () => setToDelete({ type: "doc", doc: d }), danger: true },
	];

	const th = "px-10 text-center";
	const td = "truncate px-10 text-center text-13";
	const statusLabel = { active: t("active"), archived: t("archived"), all: t("all") };
	const empty = subfolders.length === 0 && docs.length === 0;

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader>
				<div className="flex flex-wrap items-center justify-between gap-x-16 gap-y-12">
					<div className={`${TAB_BAR} justify-center md:w-fit md:justify-start`}>
						{(["list", "grid", "tile"] as const).map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => setLayout(key)}
								className={`${TAB_ITEM} md:px-24 ${layout === key ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}>
								{t(key)}
							</button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-12">
						<SearchBox
							value={query}
							onChange={setQuery}
							placeholder={t("filterSearch")}
							filters={filterDefs}
							active={filters}
							onFilter={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
							className="w-full shrink-0 sm:w-[280px] lg:w-[340px]"
						/>
						<button type="button" onClick={() => load(true)} aria-label={t("refresh")} title={t("refresh")} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
							<TbRefresh size={18} className={loading ? "animate-spin" : ""} />
						</button>
						<button type="button" onClick={() => { setName(""); setNameMode({ kind: "folder-new" }); }} className="fs-btn fs-btn-ghost h-40">
							{t("folderNew")}
						</button>
					</div>
				</div>
			</PageHeader>

			{drive && !drive.connected && (
				<div className="fs-card mb-16 flex flex-col gap-12 p-16 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-14 font-medium text-[#f1f4ee]">{t("driveConnectTitle")}</p>
						<p className="mt-2 text-12 text-[#8c948b]">{drive.configured ? t("driveConnectText") : t("driveNotConfigured")}</p>
					</div>
					{drive.configured && <button type="button" onClick={connect} className="fs-btn fs-btn-primary h-38 shrink-0">{t("driveConnectButton")}</button>}
				</div>
			)}
			{drive?.connected && (
				<div className="mb-16 flex flex-wrap items-center gap-x-12 gap-y-8 text-12 text-[#8c948b]">
					<span>{t("driveConnectedAs", { email: drive.email || "Google" })}</span>
					<button type="button" onClick={startImport} disabled={importing} className="fs-btn fs-btn-ghost h-30 disabled:opacity-60">
						{importing ? t("driveImportRunning") : t("driveImportButton")}
					</button>
					<button type="button" onClick={connect} className="fs-link">{t("driveReconnect")}</button>
					<button type="button" onClick={() => disconnectDrive()} className="fs-link">{t("driveDisconnect")}</button>
				</div>
			)}

			<ul className="grid grid-cols-2 gap-12 md:grid-cols-4 md:gap-16 lg:gap-20">
				{GOOGLE_KINDS.map((kind) => (
					<li key={kind}>
						<button
							type="button"
							onClick={() => startCreate(kind)}
							className={`fs-card flex aspect-square w-full flex-col items-center justify-center gap-10 transition-transform duration-200 hover:-translate-y-2 lg:max-h-[240px] ${drive?.connected ? "" : "opacity-60"}`}>
							<FileTypeIcon type={ICON_TYPE[kind]} size={56} />
							<span className="text-12 font-semibold text-[#8c948b] md:text-13">{t(`kind_${kind}`)}</span>
						</button>
					</li>
				))}
				<li>
					<button
						type="button"
						onClick={startUpload}
						className={`fs-card flex aspect-square w-full flex-col items-center justify-center gap-10 transition-transform duration-200 hover:-translate-y-2 lg:max-h-[240px] ${storage?.configured ? "" : "opacity-60"}`}>
						<TbCloudUpload size={56} className="text-[#8c948b]" aria-hidden />
						<span className="text-12 font-semibold text-[#8c948b] md:text-13">{t("uploadFile")}</span>
					</button>
					<input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} aria-label={t("uploadFile")} />
				</li>
			</ul>

			<nav aria-label={t("breadcrumbs")} className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-2 text-13">
				<button type="button" onClick={() => setCurrent(null)} className={current === null ? "font-medium text-[#f1f4ee]" : "text-[#c6ff4d] hover:underline"}>{t("rootFolder")}</button>
				{path.map((f, i) => (
					<React.Fragment key={f.id}>
						<span className="text-[#8C948B]" aria-hidden>/</span>
						<button type="button" onClick={() => setCurrent(f.id)} className={i === path.length - 1 ? "font-medium text-[#f1f4ee]" : "text-[#c6ff4d] hover:underline"}>{f.name}</button>
					</React.Fragment>
				))}
			</nav>

			<div className="mt-16 min-h-[240px]">
				{layout === "list" ? (
					<div className="fs-card overflow-x-auto">
						<table className="fs-table min-w-[620px] table-fixed">
							<thead>
								<tr>
									<th className={`${th} w-[38%]`}>
										<button type="button" onClick={() => setSortAsc(!sortAsc)} className="inline-flex items-center gap-6 transition-colors hover:text-[#c6ff4d]" aria-label={t("sortByName")}>
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
															onClick={() => { setStatus(s); setStatusOpen(false); }}
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
											<button type="button" onClick={() => setCurrent(f.id)} className="flex w-full items-center gap-10 text-left transition-colors hover:text-[#c6ff4d]">
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
											<button type="button" onClick={() => openDoc(d)} className="flex w-full items-center gap-10 text-left transition-colors hover:text-[#c6ff4d]" title={d.url ? t("openInGoogle") : t("openFile")}>
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
						{state && empty && <p className="py-40 text-center text-13 text-[#8c948b]">{current === null ? t("docsEmpty") : t("folderEmpty")}</p>}
						{!state && <p className="py-40 text-center text-13 text-[#8c948b]">…</p>}
					</div>
				) : (
					<>
						<ul className={`grid gap-12 ${layout === "grid" ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
							{subfolders.map((f) => (
								<li key={f.id} className={`fs-card animate-fade-in transition-colors duration-150 hover:border-[rgba(198,255,77,0.28)] ${layout === "grid" ? "flex flex-col items-center gap-8 p-14 text-center" : "flex items-center gap-16 p-14"}`}>
									<button type="button" onClick={() => setCurrent(f.id)} className={`flex min-w-0 flex-1 gap-8 transition-colors hover:text-[#c6ff4d] ${layout === "grid" ? "flex-col items-center" : "items-center text-left"}`}>
										<EntryIcon folder size={layout === "grid" ? 36 : 30} />
										<span className="w-full truncate text-13 font-medium text-[#f1f4ee]">{f.name}</span>
									</button>
									<RowMenu actions={folderActions(f)} />
								</li>
							))}
							{docs.map((d) => (
								<li key={d.id} className={`fs-card animate-fade-in transition-colors duration-150 hover:border-[rgba(198,255,77,0.28)] ${layout === "grid" ? "flex flex-col items-center gap-8 p-14 text-center" : "flex items-center gap-16 p-14"}`}>
									<button type="button" onClick={() => openDoc(d)} className={`flex min-w-0 flex-1 gap-8 transition-colors hover:text-[#c6ff4d] ${layout === "grid" ? "flex-col items-center" : "items-center text-left"}`}>
										<EntryIcon doc={d} size={layout === "grid" ? 36 : 30} />
										<span className="w-full min-w-0">
											<span className="block truncate text-13 font-medium text-[#f1f4ee]">{d.name}</span>
											<span className="block truncate text-11 text-[#8c948b]">{kindLabel(d)}</span>
										</span>
									</button>
									<RowMenu actions={docActions(d)} />
								</li>
							))}
						</ul>
						{state && empty && <p className="py-40 text-center text-13 text-[#8c948b]">{current === null ? t("docsEmpty") : t("folderEmpty")}</p>}
						{!state && <p className="py-40 text-center text-13 text-[#8c948b]">…</p>}
					</>
				)}
			</div>

			<Modal open={nameMode !== null} onClose={() => setNameMode(null)} label={t("document")} className="w-full max-w-[440px]">
				<form onSubmit={submitName} className="fs-popover p-20">
					<h2 className="mb-16 flex items-center gap-12 text-16 font-semibold text-[#f1f4ee]">
						{nameMode?.kind === "doc" && <FileTypeIcon type={ICON_TYPE[nameMode.docKind]} size={20} withLabel={false} />}
						{(nameMode?.kind === "folder-new" || nameMode?.kind === "folder-rename") && <TbFolder size={20} className="text-[#FABF4D]" aria-hidden />}
						{nameMode?.kind === "doc" ? t("newDocument") : nameMode?.kind === "folder-new" ? t("folderNew") : t("rename")}
					</h2>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={100}
						autoFocus
						placeholder={nameMode?.kind === "folder-new" || nameMode?.kind === "folder-rename" ? t("folderName") : undefined}
						aria-label={t("fileName")}
						className="fs-field h-40 w-full px-12 text-13 outline-none transition-colors"
					/>
					{nameMode?.kind === "doc" && <p className="mt-8 text-12 text-[#8c948b]">{t("docOpenNote")}</p>}
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setNameMode(null)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">
							{busy ? "…" : nameMode?.kind === "doc" || nameMode?.kind === "folder-new" ? t("create") : t("save")}
						</button>
					</div>
				</form>
			</Modal>

			<Modal open={moving !== null} onClose={() => setMoving(null)} label={t("moveTo")} className="w-full max-w-[440px]">
				<form onSubmit={submitMove} className="fs-popover p-20">
					<h2 className="mb-6 text-16 font-semibold text-[#f1f4ee]">{t("moveTo")}</h2>
					<p className="mb-12 truncate text-12 text-[#8c948b]">{moving?.type === "folder" ? moving.folder.name : moving?.doc.name}</p>
					<select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label={t("moveTo")} className="fs-field h-40 w-full px-12 text-13 outline-none">
						{moveOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
					</select>
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setMoving(null)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : t("moveHere")}</button>
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
