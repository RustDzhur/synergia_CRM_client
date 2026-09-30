"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbExternalLink, TbFileText, TbRefresh, TbUpload } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import { openAuthedPreview } from "../download";
import { useFinanceStore } from "@/store/useFinanceStore";
import Modal from "../../shared/Modal";
import FormField from "../../shared/FormField";

// «Налаштування → Документи» (ТЗ §7): выбор бланка, правка текстов, блоков, подписи и печати,
// предпросмотр на тестовых данных тем же рендерером, что и настоящие документы.
// Пресеты («UA-рахунок», «UA-акт»…) копируются в базу фирмы при первом открытии и дальше правятся.

interface TemplateDTO {
	id: string;
	market: string;
	kind: string;
	name: string;
	blocks: string[];
	texts: { ua: string; en: string; de: string; notes: string };
	prefix: string;
	showSignature: boolean;
	showStamp: boolean;
	footer: string;
	paymentTerms: string;
	language: "ua" | "en" | "de";
	currency: string;
	presetKey: string;
}

const BLOCKS = ["logo", "qr", "notes", "footer", "signature", "seal", "rate"] as const;

export default function DocumentsCard() {
	const t = useTranslations("finance");
	const settings = useFinanceStore((s) => s.settings);
	const [open, setOpen] = useState(false);
	const [list, setList] = useState<TemplateDTO[]>([]);
	const [current, setCurrent] = useState<TemplateDTO | null>(null);
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		const res = await apiCall<{ templates: TemplateDTO[] }>("/api/finance/document-templates");
		if (res.ok && res.data) {
			setList(res.data.templates);
			setCurrent((prev) => res.data!.templates.find((x) => x.id === prev?.id) ?? res.data!.templates[0] ?? null);
		}
	}, []);

	useEffect(() => {
		if (open) void load();
	}, [open, load]);

	async function save() {
		if (!current || saving) return;
		setSaving(true);
		// Тексты правятся на языке документа: условия оплаты и примечания — это тексты бланка на нём
		const texts = { ...current.texts, [current.language]: current.paymentTerms, notes: current.texts.notes };
		const res = await apiCall<TemplateDTO>(`/api/finance/document-templates/${current.id}`, "PATCH", {
			name: current.name,
			blocks: current.blocks,
			texts: { ...texts, [current.language]: current.paymentTerms },
			prefix: current.prefix,
			showSignature: current.showSignature,
			showStamp: current.showStamp,
			footer: current.footer,
			paymentTerms: current.paymentTerms,
			language: current.language,
			currency: current.currency,
		});
		setSaving(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setCurrent(res.data);
		setList((l) => l.map((x) => (x.id === res.data!.id ? res.data! : x)));
		toast.success(t("saved"));
	}

	async function resetPreset() {
		if (!current?.presetKey) return;
		const res = await apiCall<TemplateDTO>("/api/finance/document-templates", "POST", { key: current.presetKey });
		if (!res.ok || !res.data) return void toast.error(res.message);
		setCurrent(res.data);
		setList((l) => l.map((x) => (x.id === res.data!.id ? res.data! : x)));
		toast.success(t("uaDocsPresetRestored"));
	}

	function preview() {
		if (!current) return;
		// Предпросмотр требует токена: открываем blob-адресом, иначе сервер отвечает «Unauthorized»
		void openAuthedPreview(`/api/finance/document-templates/preview?kind=${encodeURIComponent(current.kind)}&id=${current.id}&locale=${current.language}`, t("pdfFailed"));
	}

	const label = "mb-6 block text-12 text-[#8c948b]";
	const field = "fs-field h-40 w-full px-12 text-13 outline-none";

	return (
		<div className="mb-16 fs-card p-16 md:p-20">
			<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("uaDocsSection")}</h3>
			<p className="mb-14 text-12 leading-[1.5] text-[#8c948b]">{t("uaDocsHint")}</p>
			<p className="mb-14 text-11 text-[#9AA396]">{t("uaDocsCurrencyNote", { currency: settings?.currency ?? "" })}</p>
			<button type="button" onClick={() => setOpen(true)} className="fs-btn fs-btn-ghost h-38">
				<TbFileText size={15} />
				{t("uaDocsOpen")}
			</button>

			<Modal open={open} onClose={() => setOpen(false)} label={t("uaDocsSection")} className="w-full max-w-[880px]">
				<div className="fs-popover fs-scroll max-h-[calc(100vh-32px)] overflow-y-auto">
					<div className="flex items-center justify-between border-b border-inkLine bg-[rgba(198,255,77,0.06)] px-20 py-12">
						<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("uaDocsSection")}</h2>
						<button type="button" onClick={() => setOpen(false)} className="fs-link">{t("market_change_cancel")}</button>
					</div>
					<div className="flex flex-col gap-16 p-20 md:flex-row">
						{/* Список бланков режима: счёт, акт, видаткова, КП… */}
						<ul className="flex w-full shrink-0 flex-col gap-4 md:w-[220px]">
							{list.map((item) => (
								<li key={item.id}>
									<button
										type="button"
										onClick={() => setCurrent(item)}
										className={`w-full rounded-10 border px-10 py-8 text-left text-13 transition-colors ${
											current?.id === item.id
												? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]"
												: "border-transparent text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.04)]"
										}`}>
										{item.name}
									</button>
								</li>
							))}
						</ul>

						{current && (
							<div className="min-w-0 flex-1">
								<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
									<FormField label={t("uaDocsName")} value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} maxLength={100} />
									<FormField label={t("uaDocsPrefix")} value={current.prefix} onChange={(e) => setCurrent({ ...current, prefix: e.target.value.toUpperCase() })} maxLength={10} />
									<label className="block">
										<span className={label}>{t("uaDocsLanguage")}</span>
										<select value={current.language} onChange={(e) => setCurrent({ ...current, language: e.target.value as TemplateDTO["language"] })} className={field}>
											<option value="ua">Українська</option>
											<option value="en">English</option>
											<option value="de">Deutsch</option>
										</select>
									</label>
									<label className="block">
										<span className={label}>{t("uaDocsCurrency")}</span>
										<input value={current.currency} onChange={(e) => setCurrent({ ...current, currency: e.target.value.toUpperCase().slice(0, 6) })} className={field} placeholder={settings?.currency ?? ""} />
									</label>
								</div>

								{/* Блоки бланка: что печатается в документе */}
								<div className="mt-14">
									<span className={label}>{t("uaDocsBlocks")}</span>
									<div className="flex flex-wrap gap-14">
										{BLOCKS.map((b) => (
											<label key={b} className="flex items-center gap-8 text-12 text-[#cfd4cb]">
												<input
													type="checkbox"
													checked={current.blocks.includes(b)}
													onChange={(e) => setCurrent({ ...current, blocks: e.target.checked ? [...current.blocks, b] : current.blocks.filter((x) => x !== b) })}
													className="h-16 w-16 accent-[#c6ff4d]"
												/>
												{t(`uaBlock_${b}`)}
											</label>
										))}
									</div>
									<label className="mt-12 flex items-center gap-10 text-13 text-[#cfd4cb]">
										<input type="checkbox" checked={current.showSignature} onChange={(e) => setCurrent({ ...current, showSignature: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
										{t("uaDocsShowSignature")}
									</label>
									<label className="mt-8 flex items-center gap-10 text-13 text-[#cfd4cb]">
										<input type="checkbox" checked={current.showStamp} onChange={(e) => setCurrent({ ...current, showStamp: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
										{t("uaDocsShowStamp")}
									</label>
								</div>

								<label className="mt-14 block">
									<span className={label}>{t("uaDocsPaymentTerms")}</span>
									<textarea value={current.paymentTerms} onChange={(e) => setCurrent({ ...current, paymentTerms: e.target.value })} rows={2} maxLength={600} className="fs-field fs-scroll w-full resize-none p-10 text-13 outline-none" />
								</label>
								<label className="mt-12 block">
									<span className={label}>{t("uaDocsNotes")}</span>
									<textarea value={current.texts.notes} onChange={(e) => setCurrent({ ...current, texts: { ...current.texts, notes: e.target.value } })} rows={2} maxLength={600} className="fs-field fs-scroll w-full resize-none p-10 text-13 outline-none" />
								</label>
								<label className="mt-12 block">
									<span className={label}>{t("uaDocsFooter")}</span>
									<textarea value={current.footer} onChange={(e) => setCurrent({ ...current, footer: e.target.value })} rows={2} maxLength={600} className="fs-field fs-scroll w-full resize-none p-10 text-13 outline-none" />
								</label>

								<div className="mt-16 flex flex-wrap items-center gap-10">
									<button type="button" onClick={save} disabled={saving} className="fs-btn fs-btn-primary h-38 disabled:opacity-60">
										<TbUpload size={14} />
										{saving ? t("market_choosing") : t("save")}
									</button>
									<button type="button" onClick={preview} className="fs-btn fs-btn-ghost h-38">
										<TbExternalLink size={14} />
										{t("uaDocsPreview")}
									</button>
									{current.presetKey && (
										<button type="button" onClick={resetPreset} className="fs-btn fs-btn-ghost h-38">
											<TbRefresh size={14} />
											{t("uaDocsPreset")}
										</button>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</Modal>
		</div>
	);
}
