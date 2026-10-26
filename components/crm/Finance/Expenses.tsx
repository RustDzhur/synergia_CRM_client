"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbDownload, TbEdit, TbPlus, TbScan, TbSparkles, TbTrash } from "react-icons/tb";
import { useFinanceStore, type Expense, type ExpenseAutofillResult, type FinanceSettings } from "@/store/useFinanceStore";
import { authHeaders } from "@/store/crmApi";
import { marketOf } from "@/lib/finance/market";
import { categoriesFor, hasCategory } from "@/lib/finance/expenseCategories";
import { defaultRateFor } from "@/lib/finance/tax";
import { normalizeAmounts } from "@/lib/finance/expenseTax";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import SuggestInput from "../shared/SuggestInput";
import Checkbox from "../shared/Checkbox";
import { downloadAuthed } from "./download";
import { money } from "./format";

const today = () => new Date().toISOString().slice(0, 10);
const num = (value: string): number => Number(String(value).replace(",", ".")) || 0;
const amountText = (value: number): string => (Math.round(value * 100) / 100).toFixed(2);

type BookingKind = Expense["bookingKind"];
type ReviewStatus = Expense["reviewStatus"];

interface ExpenseForm {
	vendor: string; category: string; categoryCode: string; subcategory: string;
	netAmount: string; grossAmount: string; vatAmount: string; taxRate: string; inputVatDeductible: boolean;
	documentDate: string; paidDate: string; documentNumber: string; vendorVatId: string; vendorIban: string;
	datevChart: "SKR03" | "SKR04"; datevAccount: string; bookingKind: BookingKind;
	afaYears: string; afaResidualValue: string; folder: string; reviewStatus: ReviewStatus;
	currency: string; recurring: "" | "monthly" | "yearly"; notes: string; receipt: string;
}

function emptyForm(settings: FinanceSettings | null): ExpenseForm {
	return {
		vendor: "", category: "", categoryCode: "", subcategory: "",
		netAmount: "", grossAmount: "", vatAmount: "",
		taxRate: String(defaultRateFor(settings ?? {})), inputVatDeductible: true,
		documentDate: today(), paidDate: "", documentNumber: "", vendorVatId: "", vendorIban: "",
		datevChart: settings?.datevChart === "SKR04" ? "SKR04" : "SKR03",
		datevAccount: "", bookingKind: "Betriebsausgabe", afaYears: "", afaResidualValue: "",
		folder: "", reviewStatus: "REVIEW", currency: "", recurring: "", notes: "", receipt: "",
	};
}

function formFromExpense(e: Expense): ExpenseForm {
	return {
		vendor: e.vendor ?? "", category: e.category ?? "", categoryCode: e.categoryCode ?? "", subcategory: e.subcategory ?? "",
		netAmount: e.netAmount ? String(e.netAmount) : e.amount ? String(e.amount) : "",
		grossAmount: e.grossAmount ? String(e.grossAmount) : "", vatAmount: e.vatAmount ? String(e.vatAmount) : "",
		taxRate: String(e.taxRate ?? 0), inputVatDeductible: e.inputVatDeductible !== false,
		documentDate: e.documentDate || e.date || today(), paidDate: e.paidDate ?? "",
		documentNumber: e.documentNumber ?? "", vendorVatId: e.vendorVatId ?? "", vendorIban: e.vendorIban ?? "",
		datevChart: e.datevChart === "SKR04" ? "SKR04" : "SKR03", datevAccount: e.datevAccount ?? "",
		bookingKind: e.bookingKind ?? "Betriebsausgabe", afaYears: e.afaYears == null ? "" : String(e.afaYears),
		afaResidualValue: e.afaResidualValue == null ? "" : String(e.afaResidualValue),
		folder: e.folder ?? "", reviewStatus: e.reviewStatus ?? "REVIEW", currency: e.currency ?? "",
		recurring: (e.recurring === "monthly" || e.recurring === "yearly" ? e.recurring : "") as "" | "monthly" | "yearly",
		notes: e.notes ?? "", receipt: e.receipt ?? "",
	};
}

const statusClass = (status: ReviewStatus) =>
	status === "OK"
		? "border-[rgba(45,222,182,0.35)] text-[#2DDEB6]"
		: status === "AUTO"
			? "border-[rgba(124,147,255,0.35)] text-[#7c93ff]"
			: "border-[rgba(244,161,0,0.35)] text-[#F4A100]";

const statusKey = (status: ReviewStatus) => (status === "OK" ? "expTaxReviewOk" : status === "AUTO" ? "expTaxReviewAuto" : "expTaxReviewReview");

// Расходы (Beleg): закупки, аренда, подписки. Вторая половина отчёта о прибыли на дашборде вместе со счетами.
// Справочник категорий и налоговые поля — в блоке «Steuerliche Angaben»: они уходят бухгалтеру
// (DATEV-выгрузка) и в налоговую отчётность, поэтому категория и счёт берутся из справочника, а не
// вводятся свободным текстом.
export default function Expenses() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const {
		expenses, expenseCategories, loadExpenses, loadExpenseCategories,
		createExpense, updateExpense, autofillExpense, deleteExpense, settings, saveSettings,
	} = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<Expense | null>(null);
	const [form, setForm] = useState<ExpenseForm>(() => emptyForm(settings));
	const [toDelete, setToDelete] = useState<string | null>(null);
	const [scanning, setScanning] = useState(false);
	const [saving, setSaving] = useState(false);
	const fileRef = useRef<HTMLInputElement | null>(null);

	// Автоопределение: текст вставляют вручную или читают из прикреплённого PDF/текстового файла
	const [docText, setDocText] = useState("");
	const [autofillBusy, setAutofillBusy] = useState(false);
	const [evidence, setEvidence] = useState<string[]>([]);
	const [warnings, setWarnings] = useState<ExpenseAutofillResult["warnings"]>([]);
	const [applied, setApplied] = useState<string[]>([]);
	const [skipped, setSkipped] = useState<string[]>([]);

	// Фильтры списка: категория, статус проверки и Vorsteuer
	const [filterCategory, setFilterCategory] = useState("");
	const [filterStatus, setFilterStatus] = useState<"all" | ReviewStatus>("all");
	const [filterVat, setFilterVat] = useState<"all" | "yes" | "no">("all");

	useEffect(() => { void loadExpenses(); void loadExpenseCategories(); }, [loadExpenses, loadExpenseCategories]);

	// Справочник фирмы для свободной категории (старое поле) — налоговые категории берутся из справочника
	const categories = useMemo(() => categoriesFor(marketOf(settings?.country) ?? null, settings?.expenseCategories), [settings]);
	const categoryOptions = useMemo(() => {
		const needle = form.category.trim().toLowerCase();
		return categories
			.filter((c) => !needle || c.toLowerCase().includes(needle))
			.map((c) => ({ key: c, title: c }));
	}, [categories, form.category]);
	const canAddCategory = !!form.category.trim() && !hasCategory(categories, form.category);

	const localeKey = locale === "de" ? "de" : locale === "ua" ? "ua" : locale === "ru" ? "ru" : "en";
	const catName = (e: { name: { de: string; en: string; ru: string; ua: string }; label?: string }) => e.name[localeKey] || e.label || e.name.de;
	const groups = useMemo(() => expenseCategories.filter((c) => c.isGroup), [expenseCategories]);
	const leaves = useMemo(() => expenseCategories.filter((c) => !c.isGroup), [expenseCategories]);
	const leafByCode = useMemo(() => new Map(leaves.map((c) => [c.code, c])), [leaves]);
	const groupByCode = useMemo(() => new Map(groups.map((c) => [c.code, c])), [groups]);
	const subOptions = useMemo(() => leaves.filter((c) => c.parentCode === form.categoryCode), [leaves, form.categoryCode]);
	const currentLeaf = leafByCode.get(form.subcategory) ?? null;

	const shownExpenses = useMemo(
		() =>
			expenses.filter((e) => {
				if (filterCategory && e.categoryCode !== filterCategory) return false;
				if (filterStatus !== "all" && e.reviewStatus !== filterStatus) return false;
				if (filterVat === "yes" && e.inputVatDeductible === false) return false;
				if (filterVat === "no" && e.inputVatDeductible !== false) return false;
				return true;
			}),
		[expenses, filterCategory, filterStatus, filterVat]
	);

	function openNew() {
		setEditing(null);
		setForm(emptyForm(settings));
		setDocText("");
		setEvidence([]);
		setWarnings([]);
		setApplied([]);
		setSkipped([]);
		setOpen(true);
	}

	function openEdit(ex: Expense) {
		setEditing(ex);
		setForm(formFromExpense(ex));
		setDocText("");
		const auto = ex.autoFields && typeof ex.autoFields === "object" ? (ex.autoFields as { evidence?: unknown; warnings?: unknown }) : null;
		setEvidence(Array.isArray(auto?.evidence) ? auto!.evidence!.filter((x): x is string => typeof x === "string") : []);
		setWarnings(
			Array.isArray(auto?.warnings)
				? (auto!.warnings as unknown[])
						.map((w) => (typeof w === "string" ? { code: w, message: w } : w && typeof w === "object" && "code" in w ? (w as { code: string; message?: string }) : null))
						.filter((w): w is { code: string; message: string } => !!w)
						.map((w) => ({ code: w.code, message: w.message ?? w.code }))
				: []
		);
		setApplied([]);
		setSkipped([]);
		setOpen(true);
	}

	// Суммы: меняется одна — две остальные считаются по ставке. Та же арифметика на сервере.
	function setNet(value: string) {
		if (!value.trim()) return setForm({ ...form, netAmount: value });
		const a = normalizeAmounts({ net: num(value), rate: num(form.taxRate) });
		setForm({ ...form, netAmount: value, vatAmount: amountText(a.vatAmount), grossAmount: amountText(a.grossAmount) });
	}
	function setGross(value: string) {
		if (!value.trim()) return setForm({ ...form, grossAmount: value });
		const a = normalizeAmounts({ gross: num(value), rate: num(form.taxRate) });
		setForm({ ...form, grossAmount: value, netAmount: amountText(a.netAmount), vatAmount: amountText(a.vatAmount) });
	}
	function setVat(value: string) {
		if (!value.trim()) return setForm({ ...form, vatAmount: value });
		const a = normalizeAmounts({ net: form.netAmount.trim() ? num(form.netAmount) : null, vat: num(value), rate: num(form.taxRate) });
		setForm({ ...form, vatAmount: value, netAmount: form.netAmount.trim() ? form.netAmount : amountText(a.netAmount), grossAmount: amountText(a.grossAmount) });
	}
	function setRate(value: string) {
		// Ставку меняют, чтобы пересчитать налог от базы: если есть Netto — ведём расчёт от него,
		// иначе от Brutto. Обе суммы, введённые вручную, не перетираем без нужды.
		const next = num(value);
		if (form.netAmount.trim()) {
			const a = normalizeAmounts({ net: num(form.netAmount), rate: next });
			setForm({ ...form, taxRate: value, vatAmount: amountText(a.vatAmount), grossAmount: amountText(a.grossAmount) });
		} else if (form.grossAmount.trim()) {
			const a = normalizeAmounts({ gross: num(form.grossAmount), rate: next });
			setForm({ ...form, taxRate: value, vatAmount: amountText(a.vatAmount), netAmount: amountText(a.netAmount) });
		} else {
			setForm({ ...form, taxRate: value });
		}
	}

	function pickGroup(code: string) {
		// Смена группы сбрасывает подкатегорию и её производные: старый счёт/папка к новой группе не относятся
		setForm({ ...form, categoryCode: code, subcategory: "", category: "", datevAccount: "", folder: "", afaYears: "", bookingKind: "Betriebsausgabe" });
	}
	function pickLeaf(code: string) {
		const leaf = leafByCode.get(code);
		if (!leaf) return setForm({ ...form, subcategory: "", datevAccount: "", folder: "", afaYears: "" });
		// Категория выбранная человеком: счёт, папка и вид записи приходят из справочника;
		// ставку меняем, если она пустая или осталась от предыдущей подкатегории, — ручную не перетираем
		const previous = leafByCode.get(form.subcategory);
		const rateWasAutomatic = !previous || Math.abs(num(form.taxRate) - previous.vatRate) < 0.01;
		const nextRate = rateWasAutomatic ? leaf.vatRate : num(form.taxRate);
		const amounts = normalizeAmounts({
			net: form.netAmount.trim() ? num(form.netAmount) : null,
			gross: form.grossAmount.trim() ? num(form.grossAmount) : null,
			rate: nextRate,
		});
		setForm({
			...form,
			categoryCode: leaf.parentCode,
			subcategory: leaf.code,
			category: catName(leaf),
			datevAccount: form.datevChart === "SKR04" ? leaf.datev.skr04 : leaf.datev.skr03,
			folder: leaf.folder || form.folder,
			bookingKind: leaf.bookingKind,
			afaYears: leaf.afaYears != null ? String(leaf.afaYears) : "",
			taxRate: String(nextRate),
			inputVatDeductible: leaf.deductible,
			vatAmount: form.netAmount.trim() || form.grossAmount.trim() ? amountText(amounts.vatAmount) : form.vatAmount,
			grossAmount: form.netAmount.trim() ? amountText(amounts.grossAmount) : form.grossAmount,
			netAmount: form.grossAmount.trim() ? amountText(amounts.netAmount) : form.netAmount,
		});
	}
	function pickChart(chart: "SKR03" | "SKR04") {
		const leaf = leafByCode.get(form.subcategory);
		const account = leaf ? (chart === "SKR04" ? leaf.datev.skr04 : leaf.datev.skr03) : form.datevAccount;
		setForm({ ...form, datevChart: chart, datevAccount: account });
	}

	async function addCategory() {
		const name = form.category.trim();
		if (!name) return;
		const err = await saveSettings({ expenseCategories: [...categories, name] } as never);
		if (err) return toast.error(err);
		toast.success(t("catAdded"));
	}

	function payload(status?: ReviewStatus) {
		return {
			vendor: form.vendor.trim(),
			category: form.category.trim(),
			categoryCode: form.categoryCode || "",
			subcategory: form.subcategory || "",
			netAmount: num(form.netAmount),
			grossAmount: num(form.grossAmount),
			vatAmount: num(form.vatAmount),
			taxRate: num(form.taxRate),
			inputVatDeductible: form.inputVatDeductible,
			date: form.documentDate,
			documentDate: form.documentDate,
			paidDate: form.paidDate || "",
			documentNumber: form.documentNumber.trim(),
			vendorVatId: form.vendorVatId.trim(),
			vendorIban: form.vendorIban.trim(),
			datevAccount: form.datevAccount.trim(),
			datevChart: form.datevChart,
			bookingKind: form.bookingKind,
			afaYears: form.bookingKind === "Investition" && form.afaYears.trim() ? Number(form.afaYears) : null,
			afaResidualValue: form.bookingKind === "Investition" && form.afaResidualValue.trim() ? num(form.afaResidualValue) : null,
			folder: form.folder.trim(),
			reviewStatus: status ?? form.reviewStatus,
			currency: form.currency.trim() || undefined,
			recurring: form.recurring,
			notes: form.notes.trim(),
			receipt: form.receipt || undefined,
		} as Partial<Expense>;
	}

	async function save(status?: ReviewStatus) {
		if (saving) return;
		if (!form.vendor.trim()) return toast.error(t("vendorRequired"));
		if (!form.netAmount.trim() && !form.grossAmount.trim()) return toast.error(t("expTaxAmountRequired"));
		setSaving(true);
		const body = payload(status);
		const err = editing ? await updateExpense(editing.id, body) : await createExpense(body);
		setSaving(false);
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false);
		setEditing(null);
	}

	async function scanReceipt(file: File) {
		setScanning(true);
		const id = toast.loading(t("scanning"));
		try {
			const body = new FormData();
			body.append("file", file);
			const upRes = await fetch("/api/documents/upload", { method: "POST", headers: authHeaders(false), body });
			const upJson = await upRes.json().catch(() => null);
			if (!upRes.ok) throw new Error(upJson?.message || `Error ${upRes.status}`);
			const exRes = await fetch("/api/expenses/extract", { method: "POST", headers: authHeaders(), body: JSON.stringify({ documentId: upJson.id }) });
			const exJson = await exRes.json().catch(() => null);
			if (!exRes.ok) throw new Error(exJson?.message || `Error ${exRes.status}`);
			const draft = emptyForm(settings);
			const net = Number(exJson.amount) || 0;
			const rate = Number(exJson.taxRate) || 0;
			const amounts = normalizeAmounts({ net, rate });
			setEditing(null);
			setForm({
				...draft,
				vendor: exJson.vendor || "", category: exJson.category || "",
				netAmount: net ? amountText(amounts.netAmount) : "", grossAmount: net ? amountText(amounts.grossAmount) : "", vatAmount: net ? amountText(amounts.vatAmount) : "",
				taxRate: String(rate),
				currency: exJson.currency && exJson.currency !== (settings?.currency ?? "EUR") ? exJson.currency : "",
				documentDate: exJson.date || today(), receipt: exJson.documentId || "",
			});
			setDocText("");
			setEvidence([]); setWarnings([]); setApplied([]); setSkipped([]);
			toast.dismiss(id);
			toast.success(t("scanDone"));
			setOpen(true);
		} catch (e) {
			toast.dismiss(id);
			toast.error(e instanceof Error ? e.message : t("scanFailed"));
		} finally {
			setScanning(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	async function runAutofill() {
		if (!editing) return toast.error(t("expTaxAutofillSaveFirst"));
		if (!docText.trim() && !editing.receipt) return toast.error(t("expTaxAutofillNeedText"));
		setAutofillBusy(true);
		// Сохраняем правки перед автоопределением: иначе сервер не знает, что человек уже
		// поправил вручную, и мог бы перезаписать эти поля.
		const saveError = await updateExpense(editing.id, payload());
		if (saveError) {
			setAutofillBusy(false);
			return toast.error(saveError);
		}
		const res = await autofillExpense(editing.id, { documentText: docText.trim() || undefined });
		setAutofillBusy(false);
		if (!res.ok || !res.data) return toast.error(res.message || t("scanFailed"));
		const data = res.data;
		// Сервер уже записал поля; форма показывает актуальные значения и что именно было найдено
		setEditing(data.expense);
		setForm(formFromExpense(data.expense));
		setEvidence(data.evidence);
		setWarnings(data.warnings);
		setApplied(data.applied);
		setSkipped(data.skipped);
		if (data.applied.length) toast.success(t("expTaxAutofillApplied", { n: data.applied.length }));
		else toast(t("expTaxAutofillNone"));
		if (data.skipped.length) toast(t("expTaxAutofillSkipped", { n: data.skipped.length }));
	}

	const confPercent = editing ? Math.round((Number(editing.confidence) || 0) * 100) : 0;
	// Известные коды предупреждений переводим; неизвестный серверный текст показываем как есть
	const KNOWN_WARNINGS = new Set(["no_amount", "no_category", "mixed_rates", "rate_mismatch", "reverse_charge", "kleinunternehmer", "iban_checksum", "afa_missing_years", "no_date"]);
	const warningText = (w: { code: string; message: string }) => (KNOWN_WARNINGS.has(w.code) ? t(`expTaxWarn_${w.code}` as never) : w.message || w.code);
	const rateOptions = Array.from(new Set([0, 7, 19, num(form.taxRate)])).sort((a, b) => a - b);
	const selectClass = "fs-field h-40 w-full px-10 text-13 outline-none";
	const labelClass = "mb-6 block text-12 text-[#9aa7c9]";
	const sectionTitle = "mb-10 text-13 font-semibold uppercase tracking-wide text-[#9aa7c9]";
	const exportError = t("pdfFailed");

	return (
		<div>
			<div className="mb-16 flex flex-wrap justify-end gap-10">
				<button type="button" onClick={() => void downloadAuthed("/api/export?kind=expenses&format=csv", "expenses-datev.csv", exportError)} className="fs-btn fs-btn-ghost h-40">
					<TbDownload size={16} /> {t("expTaxExportCsv")}
				</button>
				<button type="button" onClick={() => void downloadAuthed("/api/export?kind=expenses&format=json", "expenses.json", exportError)} className="fs-btn fs-btn-ghost h-40">
					<TbDownload size={16} /> {t("expTaxExportJson")}
				</button>
				<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void scanReceipt(f); }} aria-label={t("scanReceipt")} />
				<button type="button" disabled={scanning} onClick={() => fileRef.current?.click()} className="fs-btn fs-btn-ghost h-40 disabled:opacity-[0.5]">
					<TbScan size={16} /> {t("scanReceipt")}
				</button>
				<button type="button" onClick={openNew} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newExpense")}
				</button>
			</div>

			{/* Фильтры: категория (верхний уровень справочника), статус проверки и Vorsteuer */}
			<div className="mb-12 flex flex-wrap items-center gap-8">
				<select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} aria-label={t("expTaxFilterCategory")} className="fs-field h-34 max-w-[260px] px-10 text-12">
					<option value="">{t("expTaxFilterCategory")}: {t("expTaxFilterAll")}</option>
					{groups.map((g) => <option key={g.code} value={g.code}>{catName(g)}</option>)}
				</select>
				<div className="flex flex-wrap gap-6" role="group" aria-label={t("expTaxStatus")}>
					{(["all", "AUTO", "REVIEW", "OK"] as const).map((s) => (
						<button key={s} type="button" onClick={() => setFilterStatus(s)} aria-pressed={filterStatus === s}
							className={`fs-chip h-30 cursor-pointer px-10 text-11 transition-colors ${filterStatus === s ? "border-[rgba(124,147,255,0.55)] bg-[rgba(124,147,255,0.10)] text-[#edf2ff]" : "text-[#cfd4cb] hover:text-[#edf2ff]"}`}>
							{s === "all" ? t("expTaxFilterAll") : t(statusKey(s))}
						</button>
					))}
				</div>
				<div className="flex flex-wrap gap-6" role="group" aria-label={t("expTaxFilterVat")}>
					{(["all", "yes", "no"] as const).map((v) => (
						<button key={v} type="button" onClick={() => setFilterVat(v)} aria-pressed={filterVat === v}
							className={`fs-chip h-30 cursor-pointer px-10 text-11 transition-colors ${filterVat === v ? "border-[rgba(124,147,255,0.55)] bg-[rgba(124,147,255,0.10)] text-[#edf2ff]" : "text-[#cfd4cb] hover:text-[#edf2ff]"}`}>
							{v === "all" ? t("expTaxFilterVat") : v === "yes" ? t("expTaxFilterVatYes") : t("expTaxFilterVatNo")}
						</button>
					))}
				</div>
			</div>

			{expenses.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#9aa7c9]">{t("empty")}</p>
			) : shownExpenses.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#9aa7c9]">{t("expTaxFilterEmpty")}</p>
			) : (
				<div className="fs-card overflow-x-auto">
					<table className="fs-table min-w-[920px] text-left">
						<thead>
							<tr>
								<th className="px-16">{t("colDate")}</th>
								<th className="px-10">{t("colVendor")}</th>
								<th className="px-10">{t("colCategory")}</th>
								<th className="px-10 text-right">{t("expTaxNet")}</th>
								<th className="px-10 text-right">{t("expTaxVatAmount")}</th>
								<th className="px-10 text-right">{t("expTaxGross")}</th>
								<th className="px-10">{t("expTaxStatus")}</th>
								<th className="px-10" />
							</tr>
						</thead>
						<tbody>
							{shownExpenses.map((ex) => {
								const leaf = leafByCode.get(ex.subcategory);
								const group = groupByCode.get(ex.categoryCode);
								const confidence = Math.round((Number(ex.confidence) || 0) * 100);
								return (
									<tr key={ex.id}>
										<td className="px-16 text-13 text-[#9aa7c9]">{ex.date}</td>
										<td className="px-10 text-13 font-medium text-[#edf2ff] fs-wrap">
											{ex.vendor}
											{ex.documentNumber && <span className="block text-11 font-normal text-[#9aa7c9]">{ex.documentNumber}</span>}
										</td>
										<td className="px-10 text-13 text-[#9aa7c9] fs-wrap">
											{leaf ? catName(leaf) : group ? catName(group) : ex.category || "—"}
											{ex.datevAccount && <span className="ml-6 inline-block rounded-6 border border-inkLine px-6 text-10 text-[#9aa7c9]">SKR {ex.datevAccount}</span>}
										</td>
										<td className="px-10 text-right text-13">{money(ex.netAmount || ex.amount, ex.currency || settings?.currency || "EUR", locale)}</td>
										<td className="px-10 text-right text-13 text-[#9aa7c9]">
											{ex.vatAmount ? money(ex.vatAmount, ex.currency || settings?.currency || "EUR", locale) : "—"}
											<span className="block text-11">{Number(ex.taxRate) || 0} %</span>
										</td>
										<td className="px-10 text-right text-13">{money(ex.grossAmount || ex.amount, ex.currency || settings?.currency || "EUR", locale)}</td>
										<td className="px-10">
											<span className={`fs-chip h-22 px-8 text-10 ${statusClass(ex.reviewStatus)}`}>
												{t(statusKey(ex.reviewStatus))}
												{confidence > 0 ? ` · ${confidence} %` : ""}
											</span>
											{ex.inputVatDeductible === false && <span className="mt-4 block text-10 text-[#F4A100]">{t("expTaxFilterVatNo")}</span>}
										</td>
										<td className="px-10 text-right">
											<div className="flex justify-end gap-8">
												<button type="button" onClick={() => openEdit(ex)} aria-label={t("expTaxEdit")} className="text-[#9AA7C9] transition-colors hover:text-[#7c93ff]"><TbEdit size={16} /></button>
												<button type="button" onClick={() => setToDelete(ex.id)} aria-label={t("delete")} className="text-[#9AA7C9] transition-colors hover:text-danger"><TbTrash size={16} /></button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={editing ? t("expTaxEditTitle") : t("newExpense")} className="w-full max-w-[760px]">
				<form onSubmit={(e) => { e.preventDefault(); void save(); }} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<div className="mb-14 flex flex-wrap items-center justify-between gap-10">
						<h2 className="text-16 font-semibold text-[#edf2ff]">{editing ? t("expTaxEditTitle") : t("newExpense")}</h2>
						{editing && (
							<span className={`fs-chip h-24 px-10 text-11 ${statusClass(form.reviewStatus)}`}>
								{t(statusKey(form.reviewStatus))}{confPercent > 0 ? ` · ${t("expTaxConfidence", { percent: confPercent })}` : ""}
							</span>
						)}
					</div>
					{form.receipt && <p className="mb-14 rounded-10 border border-[rgba(124,147,255,0.22)] bg-[rgba(124,147,255,0.06)] px-12 py-8 text-12 text-[#cfd4cb]">{t("scannedFromReceipt")}</p>}

					{/* Beleg: реквизиты документа */}
					<p className={sectionTitle}>{t("expTaxSectionBeleg")}</p>
					<div className="mb-16 flex flex-col gap-12">
						<FormField label={t("colVendor")} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} maxLength={200} autoFocus />
						<div>
							<span className={labelClass}>{t("colCategory")}</span>
							<SuggestInput
								value={form.category}
								onChange={(v) => setForm({ ...form, category: v })}
								onPick={(o) => setForm({ ...form, category: o.title })}
								options={categoryOptions}
								placeholder={t("catPlaceholder")}
							/>
							{canAddCategory && (
								<button type="button" onClick={() => void addCategory()} className="fs-link mt-6 text-12">{t("catAddQuick", { name: form.category.trim() })}</button>
							)}
						</div>
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("expTaxDocumentNumber")} value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} maxLength={80} />
							<FormField label={t("expTaxDocumentDate")} type="date" value={form.documentDate} onChange={(e) => setForm({ ...form, documentDate: e.target.value })} />
							<FormField label={t("expTaxPaidDate")} type="date" value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} />
							<FormField label={t("expTaxVendorVatId")} value={form.vendorVatId} onChange={(e) => setForm({ ...form, vendorVatId: e.target.value.toUpperCase() })} maxLength={20} placeholder="DE123456789" />
							<FormField label={t("expTaxVendorIban")} value={form.vendorIban} onChange={(e) => setForm({ ...form, vendorIban: e.target.value })} maxLength={40} placeholder="DE89 3704 0044 0532 0130 00" />
							<FormField label={t("currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={6} placeholder={settings?.currency ?? "EUR"} />
						</div>
					</div>

					{/* Beträge: netto/brutto/USt — любая пара пересчитывается */}
					<p className={sectionTitle}>{t("expTaxSectionAmounts")}</p>
					<div className="mb-16 grid grid-cols-2 gap-12">
						<FormField label={t("expTaxNet")} type="number" step="0.01" value={form.netAmount} onChange={(e) => setNet(e.target.value)} />
						<FormField label={t("expTaxGross")} type="number" step="0.01" value={form.grossAmount} onChange={(e) => setGross(e.target.value)} />
						<div>
							<span className={labelClass}>{t("expTaxVatRate")}</span>
							<select value={form.taxRate} onChange={(e) => setRate(e.target.value)} className={selectClass}>
								{rateOptions.map((r) => <option key={r} value={String(r)}>{r} %</option>)}
							</select>
						</div>
						<FormField label={t("expTaxVatAmount")} type="number" step="0.01" value={form.vatAmount} onChange={(e) => setVat(e.target.value)} />
						<div className="col-span-2 flex flex-col gap-6 rounded-10 border border-inkLine px-12 py-10">
							<label className="flex items-center gap-10 text-13 text-[#edf2ff]">
								<Checkbox checked={form.inputVatDeductible} onChange={(v) => setForm({ ...form, inputVatDeductible: v })} label={t("expTaxDeductible")} />
								<span>{t("expTaxDeductible")}</span>
							</label>
							<span className="text-11 leading-[1.5] text-[#9aa7c9]">{t("expTaxDeductibleHint")}</span>
						</div>
					</div>

					{/* Steuerliche Angaben: справочник DATEV, счёт, вид записи, AfA и папка */}
					<p className={sectionTitle}>{t("expTaxTitle")}</p>
					<p className="mb-10 text-11 leading-[1.5] text-[#9aa7c9]">{t("expTaxHint")}</p>
					<div className="mb-16 grid grid-cols-2 gap-12">
						<div>
							<span className={labelClass}>{t("expTaxCategory")}</span>
							<select value={form.categoryCode} onChange={(e) => pickGroup(e.target.value)} className={selectClass}>
								<option value="">{t("expTaxCategoryPlaceholder")}</option>
								{groups.map((g) => <option key={g.code} value={g.code}>{catName(g)}</option>)}
							</select>
						</div>
						<div>
							<span className={labelClass}>{t("expTaxSubcategory")}</span>
							<select value={form.subcategory} onChange={(e) => pickLeaf(e.target.value)} className={selectClass} disabled={!form.categoryCode}>
								<option value="">{form.categoryCode ? t("expTaxSubPlaceholder") : t("expTaxCategoryPlaceholder")}</option>
								{subOptions.map((c) => <option key={c.code} value={c.code}>{catName(c)}</option>)}
							</select>
						</div>
						<div>
							<span className={labelClass}>{t("expTaxBookingKind")}</span>
							<select value={form.bookingKind} onChange={(e) => setForm({ ...form, bookingKind: e.target.value as BookingKind })} className={selectClass}>
								<option value="Betriebsausgabe">{t("expTaxKindOperating")}</option>
								<option value="Investition">{t("expTaxKindInvestment")}</option>
								<option value="Privatentnahme">{t("expTaxKindPrivate")}</option>
							</select>
						</div>
						<div>
							<span className={labelClass}>{t("expTaxDatevChart")}</span>
							<select value={form.datevChart} onChange={(e) => pickChart(e.target.value === "SKR04" ? "SKR04" : "SKR03")} className={selectClass}>
								<option value="SKR03">SKR03</option>
								<option value="SKR04">SKR04</option>
							</select>
						</div>
						<div>
							<span className={labelClass}>{t("expTaxDatevAccount")}</span>
							<input value={form.datevAccount} onChange={(e) => setForm({ ...form, datevAccount: e.target.value })} maxLength={8} placeholder="4930" aria-label={t("expTaxDatevAccount")} className="fs-field h-40 w-full px-12 text-13 outline-none" />
							<span className="mt-4 block text-10 text-[#9aa7c9]">{t("expTaxDatevHint", { account: (currentLeaf ? (form.datevChart === "SKR04" ? currentLeaf.datev.skr04 : currentLeaf.datev.skr03) : "") || "—" })}</span>
						</div>
						<FormField label={t("expTaxFolder")} value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} maxLength={200} placeholder="Belege/Buero" />
						{form.bookingKind === "Investition" && (
							<>
								<FormField label={t("expTaxAfaYears")} type="number" min="1" max="100" step="1" value={form.afaYears} onChange={(e) => setForm({ ...form, afaYears: e.target.value })} />
								<FormField label={t("expTaxAfaResidual")} type="number" min="0" step="0.01" value={form.afaResidualValue} onChange={(e) => setForm({ ...form, afaResidualValue: e.target.value })} />
							</>
						)}
						<div className="col-span-2">
							<span className={labelClass}>{t("expTaxStatus")}</span>
							<select value={form.reviewStatus} onChange={(e) => setForm({ ...form, reviewStatus: e.target.value as ReviewStatus })} className={selectClass}>
								<option value="AUTO">{t("expTaxReviewAuto")}</option>
								<option value="REVIEW">{t("expTaxReviewReview")}</option>
								<option value="OK">{t("expTaxReviewOk")}</option>
							</select>
						</div>
					</div>

					{/* Автоопределение: по кнопке, только для сохранённого расхода */}
					<div className="mb-16 rounded-10 border border-[rgba(124,147,255,0.22)] bg-[rgba(124,147,255,0.05)] p-14">
						<p className="mb-6 flex items-center gap-6 text-13 font-semibold text-[#edf2ff]"><TbSparkles size={15} /> {t("expTaxAutofill")}</p>
						<p className="mb-10 text-11 leading-[1.5] text-[#9aa7c9]">{t("expTaxAutofillHint")}</p>
						<textarea
							value={docText}
							onChange={(e) => setDocText(e.target.value)}
							rows={3}
							maxLength={20000}
							placeholder={t("expTaxAutofillPlaceholder")}
							aria-label={t("expTaxAutofillText")}
							className="fs-field w-full px-12 py-8 text-12 outline-none"
						/>
						<div className="mt-10 flex flex-wrap items-center gap-10">
							<button type="button" disabled={autofillBusy || !editing} onClick={() => void runAutofill()} className="fs-btn fs-btn-ghost h-34 text-12 disabled:opacity-[0.5]">
								<TbSparkles size={14} /> {autofillBusy ? t("scanning") : t("expTaxAutofill")}
							</button>
							{!editing && <span className="text-11 text-[#9aa7c9]">{t("expTaxAutofillSaveFirst")}</span>}
							{editing && !editing.receipt && <span className="text-11 text-[#9aa7c9]">{t("expTaxAutofillNeedText")}</span>}
						</div>
						{(evidence.length > 0 || warnings.length > 0 || applied.length > 0 || skipped.length > 0) && (
							<div className="mt-12 flex flex-col gap-6 text-11 text-[#cfd4cb]">
								{applied.length > 0 && <span className="text-[#2DDEB6]">{t("expTaxAutofillApplied", { n: applied.length })}</span>}
								{skipped.length > 0 && <span className="text-[#F4A100]">{t("expTaxAutofillSkipped", { n: skipped.length })}</span>}
								{evidence.length > 0 && (
									<span>
										<b className="text-[#9aa7c9]">{t("expTaxEvidence")}:</b> {evidence.slice(0, 6).join(" · ")}
									</span>
								)}
								{warnings.length > 0 && (
									<span>
										<b className="text-[#F4A100]">{t("expTaxWarnings")}:</b> {warnings.map((w) => warningText(w)).join(" · ")}
									</span>
								)}
							</div>
						)}
					</div>

					<FormField label={t("notes")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />

					<div className="mt-20 flex flex-wrap justify-end gap-10">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						{editing && (
							<button type="button" disabled={saving} onClick={() => void save("OK")} className="fs-btn fs-btn-ghost h-40 disabled:opacity-[0.5]">
								{t("expTaxMarkOk")}
							</button>
						)}
						<button type="submit" disabled={saving} className="fs-btn fs-btn-primary h-40 disabled:opacity-[0.5]">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("delete")} text={t("confirmDeleteExpense")} onCancel={() => setToDelete(null)} onConfirm={() => { if (toDelete) void deleteExpense(toDelete); setToDelete(null); }} />
		</div>
	);
}
