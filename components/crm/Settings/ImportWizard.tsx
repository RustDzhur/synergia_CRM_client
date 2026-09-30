"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbAlertTriangle, TbArrowBackUp, TbDownload, TbFileImport, TbUpload } from "react-icons/tb";
import PageHeader from "@/components/crm/shared/PageHeader";
import { apiCall } from "@/store/crmApi";
import { downloadAuthed } from "@/components/crm/Finance/download";
import SettingsTabs from "./SettingsTabs";

// Мастер импорта и экспорта (ТЗ §17): загрузить файл → проверить сопоставление колонок → увидеть
// предпросмотр с ошибками → импортировать → получить отчёт → при необходимости откатить по номеру
// пакета. Обновление идёт по ключам (SKU, почта, код фирмы), поэтому повторный импорт не плодит дубли.

interface FieldDef { key: string; label: string; required: boolean; code: string }
interface KindDef { kind: string; label: string; fields: FieldDef[] }
interface BatchRow {
	id: string; kind: string; fileName: string; by: string; at: string; rolledBackAt: string | null;
	summary: { total: number; created: number; updated: number; skipped: number; failed: number };
	failedRows: Array<{ row: number; message: string }>;
}
interface MappingRow { id: string; kind: string; name: string; mapping: Record<string, string> }
interface Preview {
	columns: string[]; mapping: Record<string, string>; unknownColumns: string[]; missingRequired: string[];
	rows: Array<{ line: number; values: Record<string, string>; errors: Array<{ field: string; code: string }>; empty: boolean }>;
	summary: { total: number; valid: number; invalid: number };
	truncated?: boolean;
}

export default function ImportWizard() {
	const t = useTranslations("settings");
	const [kinds, setKinds] = useState<KindDef[]>([]);
	const [batches, setBatches] = useState<BatchRow[]>([]);
	const [templates, setTemplates] = useState<MappingRow[]>([]);
	const [kind, setKind] = useState("products");
	const [fileName, setFileName] = useState("");
	const [text, setText] = useState("");
	const [mapping, setMapping] = useState<Record<string, string>>({});
	const [preview, setPreview] = useState<Preview | null>(null);
	const [busy, setBusy] = useState(false);
	const [report, setReport] = useState<BatchRow["summary"] | null>(null);
	const [templateName, setTemplateName] = useState("");

	const load = useCallback(async () => {
		const res = await apiCall<{ kinds: KindDef[]; batches: BatchRow[]; mappings: MappingRow[] }>("/api/import");
		if (res.ok && res.data) {
			setKinds(res.data.kinds);
			setBatches(res.data.batches);
			setTemplates(res.data.mappings);
		}
	}, []);
	useEffect(() => { void load(); }, [load]);

	const def = useMemo(() => kinds.find((k) => k.kind === kind), [kinds, kind]);
	const missingRequired = useMemo(() => (def ? def.fields.filter((f) => f.required && !Object.values(mapping).includes(f.key)) : []), [def, mapping]);

	async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (/\.(xlsx|xls)$/i.test(file.name)) {
			toast.error(t("importXlsxHint"));
			return;
		}
		const body = await file.text();
		setFileName(file.name);
		setText(body);
		setPreview(null);
		setReport(null);
		void runPreview(body, {});
	}

	async function runPreview(body: string, map: Record<string, string>) {
		setBusy(true);
		const res = await apiCall<Preview>("/api/import/preview", "POST", { kind, text: body, mapping: map });
		setBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setPreview(res.data);
		setMapping(res.data.mapping);
	}

	async function runImport() {
		if (!preview) return;
		setBusy(true);
		const res = await apiCall<{ summary: BatchRow["summary"] }>("/api/import/run", "POST", { kind, text, mapping, fileName });
		setBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setReport(res.data.summary);
		toast.success(t("importDone", { created: res.data.summary.created, updated: res.data.summary.updated, failed: res.data.summary.failed }));
		setPreview(null);
		setText("");
		void load();
	}

	async function rollback(batchId: string) {
		setBusy(true);
		const res = await apiCall("/api/import/rollback", "POST", { batchId });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("importRolledBack"));
		void load();
	}

	async function saveTemplate() {
		if (!templateName.trim()) return void toast.error(t("importTemplateName"));
		const res = await apiCall("/api/import", "POST", { action: "save-mapping", kind, name: templateName.trim(), mapping });
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("saved"));
		setTemplateName("");
		void load();
	}

	const field = "fs-field h-36 w-full px-10 text-12 outline-none";
	const card = "fs-card p-16 md:p-20";

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="flex flex-col gap-20 lg:flex-row">
				<SettingsTabs className="shrink-0 md:self-start" />
				<div className="flex min-w-0 flex-1 flex-col gap-16">
					{/* Шаг 1–2: файл и вид данных */}
					<section className={card}>
						<h2 className="mb-8 text-15 font-semibold text-[#f1f4ee]">{t("importTitle")}</h2>
						<p className="mb-14 text-12 leading-[1.6] text-[#8c948b]">{t("importHint")}</p>
						<div className="mb-14 flex flex-wrap gap-8">
							{kinds.map((k) => (
								<button
									key={k.kind}
									type="button"
									onClick={() => { setKind(k.kind); setPreview(null); setReport(null); }}
									className={`rounded-10 border px-12 py-7 text-12 font-medium transition-colors ${kind === k.kind ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
									{k.label}
								</button>
							))}
						</div>
						<div className="flex flex-wrap items-center gap-10">
							<label className="fs-btn fs-btn-ghost h-38 cursor-pointer">
								<TbUpload size={15} />
								{t("importChooseFile")}
								<input type="file" accept=".csv,.txt,.tsv" onChange={pickFile} className="hidden" />
							</label>
							{fileName && <span className="text-12 text-[#8c948b]">{fileName}</span>}
							{def && (
								<button type="button" disabled={busy} onClick={() => templates.filter((x) => x.kind === kind).length ? undefined : toast(t("importNoTemplates"))} className="hidden" aria-hidden />
							)}
							{templates.filter((x) => x.kind === kind).length > 0 && (
								<select
									value=""
									onChange={(e) => {
										const tpl = templates.find((x) => x.id === e.target.value);
										if (tpl) { setMapping(tpl.mapping); if (text) void runPreview(text, tpl.mapping); }
									}}
									className="fs-field h-38 w-200 px-10 text-12 outline-none">
									<option value="">{t("importLoadTemplate")}</option>
									{templates.filter((x) => x.kind === kind).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
								</select>
							)}
						</div>
						{!fileName && (
							<label className="mt-12 block">
								<span className="mb-6 block text-12 text-[#8c948b]">{t("importPaste")}</span>
								<textarea
									value={text}
									onChange={(e) => { setText(e.target.value); setPreview(null); }}
									rows={3}
									placeholder="name;sku;price&#10;Товар;SKU-1;199"
									className="fs-field fs-scroll w-full resize-none p-10 font-mono text-12 outline-none"
								/>
								<button type="button" disabled={!text.trim() || busy} onClick={() => void runPreview(text, {})} className="fs-btn fs-btn-ghost mt-8 h-34 disabled:opacity-50">
									{t("importPreviewBtn")}
								</button>
							</label>
						)}
					</section>

					{/* Шаг 3: сопоставление колонок и предпросмотр с ошибками */}
					{preview && def && (
						<section className={card}>
							<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("importMappingTitle")}</h3>
							<div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
								{preview.columns.map((col) => (
									<label key={col} className="block">
										<span className={`mb-4 block text-11 ${mapping[col] ? "text-[#8c948b]" : "text-[#F4A100]"}`}>{col || "—"}</span>
										<select value={mapping[col] ?? ""} onChange={(e) => setMapping({ ...mapping, [col]: e.target.value })} className={field}>
											<option value="">{t("importSkipColumn")}</option>
											{def.fields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
										</select>
									</label>
								))}
							</div>
							{missingRequired.length > 0 && (
								<p className="mt-10 flex items-center gap-8 text-12 text-[#F4A100]">
									<TbAlertTriangle size={14} />
									{t("importMissingRequired", { fields: missingRequired.map((f) => f.label).join(", ") })}
								</p>
							)}
							{preview.unknownColumns.length > 0 && (
								<p className="mt-6 text-11 text-[#9AA396]">{t("importUnknownColumns", { count: preview.unknownColumns.length })}</p>
							)}

							<div className="mt-14 flex flex-wrap items-center gap-14">
								<span className="text-13 text-[#cfd4cb]">{t("importSummary", { total: preview.summary.total, valid: preview.summary.valid, invalid: preview.summary.invalid })}</span>
								<div className="flex gap-10">
									<button type="button" disabled={busy} onClick={() => void runPreview(text, mapping)} className="fs-btn fs-btn-ghost h-36 disabled:opacity-50">
										{t("importPreviewAgain")}
									</button>
									<button type="button" disabled={busy || missingRequired.length > 0 || preview.summary.valid === 0} onClick={() => void runImport()} className="fs-btn fs-btn-primary h-36 disabled:opacity-50">
										<TbFileImport size={15} />
										{t("importRun", { count: preview.summary.valid })}
									</button>
								</div>
								<div className="flex items-center gap-8">
									<input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder={t("importTemplatePlaceholder")} className="fs-field h-36 w-180 px-10 text-12 outline-none" />
									<button type="button" onClick={() => void saveTemplate()} className="fs-btn fs-btn-ghost h-36">{t("importSaveTemplate")}</button>
								</div>
							</div>

							<div className="mt-12 overflow-x-auto">
								<table className="w-full min-w-[560px] text-12">
									<thead>
										<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
											<th className="pb-6 font-medium">#</th>
											<th className="pb-6 font-medium">{t("importColValues")}</th>
											<th className="pb-6 font-medium">{t("importColErrors")}</th>
										</tr>
									</thead>
									<tbody>
										{preview.rows.slice(0, 30).map((r) => (
											<tr key={r.line} className={`border-t border-inkLine ${r.empty ? "opacity-50" : ""}`}>
												<td className="py-6 pr-8 text-[#8c948b]">{r.empty ? "—" : r.line}</td>
												<td className="py-6 pr-8 text-[#cfd4cb]">{Object.values(r.values).filter(Boolean).slice(0, 4).join(" · ")}</td>
												<td className="py-6 text-[#F4A100]">{r.errors.map((e) => `${e.field}:${e.code}`).join(", ")}</td>
											</tr>
										))}
									</tbody>
								</table>
								{preview.truncated && <p className="mt-6 text-11 text-[#9AA396]">{t("importTruncated")}</p>}
							</div>
						</section>
					)}

					{/* Отчёт последнего импорта */}
					{report && (
						<section className={card}>
							<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("importReportTitle")}</h3>
							<p className="text-13 text-[#cfd4cb]">
								{t("importReportLine", { created: report.created, updated: report.updated, skipped: report.skipped, failed: report.failed })}
							</p>
						</section>
					)}

					{/* История пакетов: видно, что приехало файлом, и можно откатить */}
					<section className={card}>
						<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("importHistory")}</h3>
						{batches.length === 0 ? (
							<p className="text-12 text-[#8c948b]">{t("importNoBatches")}</p>
						) : (
							<ul className="flex flex-col gap-8">
								{batches.map((b) => (
									<li key={b.id} className="flex flex-wrap items-center justify-between gap-10 border-t border-inkLine pt-8 text-12">
										<span className="text-[#cfd4cb]">
											<b className="text-[#f1f4ee]">{b.fileName || b.kind}</b> · {new Date(b.at).toLocaleString()} · {b.by || "—"}
										</span>
										<span className="text-[#8c948b]">{t("importBatchLine", { created: b.summary.created, updated: b.summary.updated, failed: b.summary.failed })}</span>
										{b.rolledBackAt ? (
											<span className="text-[#9AA396]">{t("importRolledBackAt", { at: new Date(b.rolledBackAt).toLocaleString() })}</span>
										) : (
											<button type="button" disabled={busy} onClick={() => void rollback(b.id)} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
												<TbArrowBackUp size={13} /> {t("importRollback")}
											</button>
										)}
										{b.failedRows.length > 0 && (
											<span className="w-full text-11 text-[#F4A100]">
												{b.failedRows.slice(0, 3).map((f) => `#${f.row}: ${f.message}`).join(" · ")}
											</span>
										)}
									</li>
								))}
							</ul>
						)}
					</section>

					{/* Экспорт: те же списки файлом — CSV, JSON, а каталог ещё и прайсом YML для площадок */}
					<section className={card}>
						<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("exportTitle")}</h3>
						<p className="mb-12 text-12 text-[#8c948b]">{t("exportHint")}</p>
						<div className="flex flex-wrap gap-8">
							{["products", "contacts", "companies", "invoices", "orders", "quotes", "expenses"].map((k) => (
								<button key={k} type="button" onClick={() => void downloadAuthed(`/api/export?kind=${k}&format=csv`, `${k}.csv`, t("importFailed"))} className="fs-btn fs-btn-ghost h-32 text-12">
									<TbDownload size={13} /> {t(`exportKind_${k}`)}
								</button>
							))}
							<button type="button" onClick={() => void downloadAuthed("/api/export?kind=products&format=yml", "products.yml", t("importFailed"))} className="fs-btn fs-btn-ghost h-32 text-12">
								<TbDownload size={13} /> {t("exportYml")}
							</button>
							{/* DATEV: проводки для бухгалтера (EXTF, SKR03 по умолчанию) — формат подтверждает бухгалтер */}
							<button type="button" onClick={() => void downloadAuthed(`/api/export?kind=datev&year=${new Date().getFullYear()}`, `EXTF_Buchungsstapel_${new Date().getFullYear()}.csv`, t("importFailed"))} className="fs-btn fs-btn-ghost h-32 text-12">
								<TbDownload size={13} /> {t("exportDatev")}
							</button>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
