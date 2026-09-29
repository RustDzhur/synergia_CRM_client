"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbRefresh } from "react-icons/tb";
import type { DocItemDTO, FolderDTO } from "@/types/documents";
import { useAiStore } from "@/store/useAiStore";
import { useDocsStore } from "@/store/useDocsStore";
import { apiCall, authHeaders } from "@/store/crmApi";
import { shrinkImage } from "@/utils/imageResize";
import { stripLocale } from "@/utils/locale";
import PageHeader from "@/components/crm/shared/PageHeader";
import { localeTag } from "@/utils/dateHelpers";
import ConfirmDialog from "../shared/ConfirmDialog";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import SearchBox from "../shared/SearchBox";
import CreateTiles from "./documentsParts/CreateTiles";
import CloudBanner from "./documentsParts/CloudBanner";
import OnedrivePicker from "./documentsParts/OnedrivePicker";
import VolumeLine from "./documentsParts/VolumeLine";
import EntriesGrid from "./documentsParts/EntriesGrid";
import EntriesTable from "./documentsParts/EntriesTable";
import MoveDialog from "./documentsParts/MoveDialog";
import NameDialog from "./documentsParts/NameDialog";
import { INLINE_TYPES, fmtSize } from "./documentsParts/model";
import type { Action, GoogleKind, Layout, NameMode, StatusFilter, Target } from "./documentsParts/model";

// Вкладки раздела: своё хранилище и подключённые. В каждой — только свои документы и свой объём.
type CloudTab = "crm" | "google" | "onedrive";
const TABS: CloudTab[] = ["crm", "google", "onedrive"];

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
	const { state, loading, load, createFolder, patchFolder, deleteFolder, createDoc, patchDoc, deleteDoc, upload, connectDrive, importDrive, disconnectDrive, connectOnedrive, disconnectOnedrive } = useDocsStore();

	// Вкладки раздела: своё хранилище CRM (загруженные файлы) и каждое подключённое — Google Диск, OneDrive.
	// Файлы подключённых хранилищ лежат не у нас, поэтому и объём у них свой
	const [tab, setTab] = useState<CloudTab>("crm");
	const [driveQuota, setDriveQuota] = useState<{ usedBytes: number; limitBytes: number } | null>(null);
	const [odQuota, setOdQuota] = useState<{ usedBytes: number; limitBytes: number } | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [layout, setLayout] = useState<Layout>("list");
	const [status, setStatus] = useState<StatusFilter>("active");
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
	const fileRef = useRef<HTMLInputElement>(null);

	// возврат с Google после подключения Диска: ?drive=connected|denied|error
	useEffect(() => {
		const q = new URLSearchParams(window.location.search);
		const google = q.get("drive");
		const od = q.get("onedrive");
		if (google || od) {
			window.history.replaceState(null, "", window.location.pathname);
			const name = od ? "OneDrive" : "Google Drive";
			if (google === "connected" || od === "connected") toast.success(t("cloudConnectedToast", { name }));
			else if (google === "denied" || od === "denied") toast(t("driveDenied"));
			else toast.error(t("cloudConnectError", { name, message: q.get("message") ?? "" }));
		}
		load(true);
	}, [load, t]);

	const folders = useMemo(() => state?.folders ?? [], [state]);
	const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
	const collator = useMemo(() => new Intl.Collator(localeTag(locale)), [locale]);

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
	// Папку показываем, только если на этой вкладке в ней (или ниже) что-то лежит: папка без файлов
	// своего хранилища выглядела бы как пустая, хотя в ней документы Google
	const subfolders = useMemo(() => {
		const mine = new Map<string, boolean>(); // в папке (или ниже) есть файлы этой вкладки
		const any = new Map<string, boolean>(); // в папке (или ниже) есть хоть что-нибудь
		for (const d of state?.docs ?? []) {
			const isMine = tab === "crm" ? d.cloud === "" : d.cloud === tab;
			let id: string | null = d.folder;
			for (let depth = 0; id && depth < 20; depth += 1) {
				any.set(id, true);
				if (isMine) mine.set(id, true);
				id = byId.get(id)?.parent ?? null;
			}
		}
		// Пустую папку показываем всегда — её только что создали, и в неё положат файлы;
		// папку с файлами другой вкладки скрываем, иначе она ведёт в пустоту
		return folders
			.filter((f) => f.parent === current && (mine.has(f.id) || !any.has(f.id)) && (!q || f.name.toLowerCase().includes(q)))
			.sort((a, b) => (sortAsc ? 1 : -1) * collator.compare(a.name, b.name));
	}, [folders, state, tab, current, byId, sortAsc, collator, q]);
	// Файлы текущей вкладки: «своё хранилище» — загруженные в CRM, «Google Диск» — те, что живут в Google
	const docs = useMemo(
		() =>
			(state?.docs ?? [])
				.filter((d) => (tab === "crm" ? d.cloud === "" : d.cloud === tab))
				.filter((d) => d.folder === current && (status === "all" || (status === "archived") === d.archived))
				.filter((d) => !q || d.name.toLowerCase().includes(q))
				.filter((d) => !filters.kind || d.kind === filters.kind)
				.filter((d) => !filters.source || (filters.source === "drive" ? !!d.imported : !d.imported))
				.filter((d) => !filters.createdBy || d.createdBy === filters.createdBy)
				.sort((a, b) => (sortAsc ? 1 : -1) * collator.compare(a.name, b.name)),
		[state, tab, current, status, sortAsc, collator, q, filters]
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
	const onedrive = state?.onedrive;
	const storage = state?.storage;

	// Объём подключённого хранилища спрашиваем у провайдера один раз на вкладку и при смене аккаунта
	// (подключили другой — объём другого аккаунта, а не прежний)
	useEffect(() => {
		if (tab !== "google" || !drive?.connected) return;
		let alive = true;
		setDriveQuota(null);
		void apiCall<{ connected: boolean; usedBytes?: number; limitBytes?: number }>("/api/drive/quota").then((res) => {
			if (alive && res.ok && res.data?.connected) setDriveQuota({ usedBytes: res.data.usedBytes ?? 0, limitBytes: res.data.limitBytes ?? 0 });
		});
		return () => { alive = false; };
	}, [tab, drive?.connected, drive?.email]);

	useEffect(() => {
		if (tab !== "onedrive" || !onedrive?.connected) return;
		let alive = true;
		setOdQuota(null);
		void apiCall<{ connected: boolean; usedBytes?: number; limitBytes?: number }>("/api/onedrive/quota").then((res) => {
			if (alive && res.ok && res.data?.connected) setOdQuota({ usedBytes: res.data.usedBytes ?? 0, limitBytes: res.data.limitBytes ?? 0 });
		});
		return () => { alive = false; };
	}, [tab, onedrive?.connected, onedrive?.email]);

	// Кнопка подключения Диска: ошибку (например, не настроены ключи Google) показываем, а не молчим
	async function connect() {
		const res = await connectDrive(locale);
		if (!res.ok) toast.error(res.message);
	}

	// OneDrive: подключение, отключение и перенос выбранных файлов (выбор — в отдельном окне)
	async function connectOd() {
		const res = await connectOnedrive(locale);
		if (!res.ok) toast.error(res.message);
	}
	async function disconnectOd() {
		await disconnectOnedrive();
		toast.success(t("onedriveDisconnectedToast"));
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
	const kindLabel = (d: DocItemDTO): string =>
		d.kind === "file" ? (d.imported ? t(d.cloud === "onedrive" ? "fileFromOneDrive" : "fileFromDrive") : fmtSize(d.size)) : t(`kind_${d.kind}`);
	const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(localeTag(locale));
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

	const empty = subfolders.length === 0 && docs.length === 0;
	const notice = !state ? "…" : empty ? (current === null ? t("docsEmpty") : t("folderEmpty")) : null;

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

			{/* Вкладки: что лежит у нас и что лежит в каждом подключённом хранилище. Объём у них разный,
			    и путать их нельзя: файлы Google и OneDrive занимают место у своих сервисов, а не в тарифе CRM */}
			<div className="mb-16 flex flex-wrap items-center justify-between gap-12">
				<div className="flex items-center gap-6" role="tablist" aria-label={t("document")}>
					{TABS.map((key) => (
						<button
							key={key}
							type="button"
							role="tab"
							aria-selected={tab === key}
							onClick={() => setTab(key)}
							className={`fs-btn h-34 px-16 text-13 ${tab === key ? "fs-btn-primary" : "fs-btn-ghost"}`}>
							{key === "crm" ? t("tabCrmStorage") : key === "google" ? t("tabDriveStorage") : t("tabOnedriveStorage")}
						</button>
					))}
				</div>
				<VolumeLine
					label={tab === "crm" ? t("storageOwn") : tab === "google" ? t("storageDrive") : t("storageOnedrive")}
					used={tab === "crm" ? (storage?.usedMb ?? 0) : tab === "google" ? (driveQuota ? Math.round(driveQuota.usedBytes / 1024 / 1024) : null) : odQuota ? Math.round(odQuota.usedBytes / 1024 / 1024) : null}
					limit={tab === "crm" ? (storage?.quotaMb ?? 0) : tab === "google" ? Math.round((driveQuota?.limitBytes ?? 0) / 1024 / 1024) : Math.round((odQuota?.limitBytes ?? 0) / 1024 / 1024)}
					hint={
						tab === "crm" && !storage?.configured ? t("storageNotConfigured")
						: (tab === "google" && !drive?.connected) || (tab === "onedrive" && !onedrive?.connected) ? t("cloudNotConnected", { name: tab === "google" ? "Google Drive" : "OneDrive" })
						: ""
					}
				/>
			</div>
			{tab === "google" && drive && <CloudBanner provider="google" cloud={drive} busy={importing} docs={drive.googleDocs ?? 0} onConnect={connect} onImport={startImport} onDisconnect={() => disconnectDrive()} />}
			{tab === "onedrive" && onedrive && (
				<CloudBanner provider="onedrive" cloud={onedrive} busy={false} docs={onedrive.docs ?? 0} onConnect={connectOd} onImport={() => (onedrive.connected ? setPickerOpen(true) : connectOd())} onDisconnect={disconnectOd} />
			)}

			{/* Плитки создания: документы Google — на вкладке Диска, загрузка файла — на вкладке хранилища.
			    На вкладке OneDrive создавать нечего: файлы туда попадают только переносом */}
			{tab !== "onedrive" && (
				<CreateTiles
					tab={tab === "crm" ? "crm" : "drive"}
					driveConnected={!!drive?.connected}
					storageConfigured={!!storage?.configured}
					fileRef={fileRef}
					onCreate={startCreate}
					onUpload={startUpload}
					onFiles={onFiles}
				/>
			)}

			<OnedrivePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onImported={() => void load()} />

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
					<EntriesTable
						subfolders={subfolders}
						docs={docs}
						sortAsc={sortAsc}
						onSort={() => setSortAsc(!sortAsc)}
						status={status}
						onStatus={setStatus}
						onOpenFolder={setCurrent}
						onOpenDoc={openDoc}
						folderActions={folderActions}
						docActions={docActions}
						kindLabel={kindLabel}
						dateLabel={dateLabel}
						notice={notice}
					/>
				) : (
					<EntriesGrid layout={layout} subfolders={subfolders} docs={docs} onOpenFolder={setCurrent} onOpenDoc={openDoc} folderActions={folderActions} docActions={docActions} kindLabel={kindLabel} notice={notice} />
				)}
			</div>

			<NameDialog mode={nameMode} name={name} onName={setName} busy={busy} onClose={() => setNameMode(null)} onSubmit={submitName} />
			<MoveDialog target={moving} options={moveOptions} value={moveTo} onValue={setMoveTo} busy={busy} onClose={() => setMoving(null)} onSubmit={submitMove} />

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
