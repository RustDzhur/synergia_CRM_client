"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPlus, TbRotateClockwise, TbX } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import { marketOf } from "@/lib/finance/market";
import { DEFAULT_EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LIMIT, categoriesFor, hasCategory, parseCategories } from "@/lib/finance/expenseCategories";

// «Налаштування → Категорії витрат»: список, из которого форма расхода предлагает подсказки.
// Пока список не сохранён, показываются типовые категории страны — их можно поправить и сохранить.
// Отчёты (BWA/EÜR, книга доходов) группируют траты по этой строке, поэтому список и существует:
// без него «Материалы» и «материалы» распадаются на две строки отчёта.
export default function ExpenseCategoriesCard() {
	const t = useTranslations("finance");
	const settings = useFinanceStore((s) => s.settings);
	const saveSettings = useFinanceStore((s) => s.saveSettings);
	const market = marketOf(settings?.country) ?? "DE";
	const [list, setList] = useState<string[]>([]);
	const [name, setName] = useState("");
	const [chart, setChart] = useState<"SKR03" | "SKR04">("SKR03");
	const [saving, setSaving] = useState(false);

	// Список фирмы, а пока он пуст — типовой набор страны: с него удобнее начать, чем с пустого поля
	useEffect(() => {
		setList(categoriesFor(marketOf(settings?.country) ?? null, settings?.expenseCategories));
	}, [settings?.country, settings?.expenseCategories]);
	useEffect(() => {
		setChart(settings?.datevChart === "SKR04" ? "SKR04" : "SKR03");
	}, [settings?.datevChart]);

	function add() {
		const value = name.trim();
		if (!value) return;
		if (hasCategory(list, value)) return void toast.error(t("catDup"));
		if (list.length >= EXPENSE_CATEGORY_LIMIT) return void toast.error(t("catLimit", { n: EXPENSE_CATEGORY_LIMIT }));
		setList([...list, value]);
		setName("");
	}

	async function save() {
		if (saving) return;
		setSaving(true);
		const err = await saveSettings({ expenseCategories: parseCategories(list), datevChart: chart } as never);
		setSaving(false);
		if (err) return void toast.error(err);
		toast.success(t("saved"));
	}

	return (
		<div className="mb-16 fs-card p-16 md:p-20">
			<h3 className="mb-8 text-14 font-semibold text-[#edf2ff]">{t("catSection")}</h3>
			<p className="mb-4 text-12 leading-[1.5] text-[#9aa7c9]">{t("catSectionHint")}</p>
			<p className="mb-14 text-12 leading-[1.5] text-[#9aa7c9]">{t("expTaxSettingsCatalogHint")}</p>
			{/* План счетов фирмы: от него зависит счёт, который форма и автоопределение подставляют в расход */}
			<div className="mb-16 max-w-[360px]">
				<span className="mb-6 block text-12 text-[#9aa7c9]">{t("expTaxSettingsChart")}</span>
				<select value={chart} onChange={(e) => setChart(e.target.value === "SKR04" ? "SKR04" : "SKR03")} className="fs-field h-40 w-full px-12 text-13 outline-none">
					<option value="SKR03">SKR03</option>
					<option value="SKR04">SKR04</option>
				</select>
				<span className="mt-6 block text-11 leading-[1.5] text-[#9aa7c9]">{t("expTaxSettingsChartHint")}</span>
			</div>
			{list.length === 0 && <p className="mb-10 text-12 text-[#9AA7C9]">{t("catEmpty")}</p>}
			<div className="mb-12 flex flex-wrap gap-8">
				{list.map((c) => (
					<span key={c} className="flex items-center gap-6 rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] px-10 py-6 text-12 text-[#cfd4cb]">
						{c}
						<button type="button" onClick={() => setList(list.filter((x) => x !== c))} aria-label={t("catRemove")} className="text-[#9AA7C9] transition-colors hover:text-danger">
							<TbX size={13} />
						</button>
					</span>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-10">
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
					maxLength={60}
					placeholder={t("catPlaceholder")}
					className="fs-field h-38 w-240 px-12 text-13 outline-none"
				/>
				<button type="button" onClick={add} disabled={!name.trim()} className="fs-btn fs-btn-ghost h-38 disabled:opacity-[0.5]">
					<TbPlus size={14} /> {t("catAdd")}
				</button>
				<button type="button" onClick={() => setList([...DEFAULT_EXPENSE_CATEGORIES[market]])} className="fs-btn fs-btn-ghost h-38">
					<TbRotateClockwise size={14} /> {t("catDefaults")}
				</button>
				<button type="button" onClick={() => void save()} disabled={saving} className="fs-btn fs-btn-primary h-38 disabled:opacity-[0.5]">
					{t("save")}
				</button>
			</div>
		</div>
	);
}
