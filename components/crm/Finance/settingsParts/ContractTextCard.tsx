"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbRotateClockwise } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import { marketOf } from "@/lib/finance/market";
import { defaultContractText } from "@/lib/finance/contractText";

// «Налаштування → Текст договору»: типовый текст фирмы, с которого начинается каждый новый договор.
// Поля договора подставляются на месте подстановок {{number}}, {{customer}}, {{value}}… — их список
// показан под полем. Если текст не задан, в договоры попадает встроенный типовой (правьте его здесь,
// чтобы договор выглядел как документ вашей фирмы).
export default function ContractTextCard() {
	const t = useTranslations("finance");
	const settings = useFinanceStore((s) => s.settings);
	const saveSettings = useFinanceStore((s) => s.saveSettings);
	const [text, setText] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => { setText(settings?.contractTemplate ?? ""); }, [settings?.contractTemplate]);

	async function save() {
		if (saving) return;
		setSaving(true);
		const err = await saveSettings({ contractTemplate: text } as never);
		setSaving(false);
		if (err) return void toast.error(err);
		toast.success(t("saved"));
	}

	const vars = "{{number}} {{date}} {{firm}} {{signer}} {{customer}} {{value}} {{start}} {{end}} {{firmTaxId}} {{customerTaxId}}";

	return (
		<div className="mb-16 fs-card p-16 md:p-20">
			<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("contractSection")}</h3>
			<p className="mb-12 text-12 leading-[1.5] text-[#8c948b]">{t("contractSectionHint")}</p>
			<textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				rows={10}
				placeholder={t("contractSectionPlaceholder")}
				className="fs-field fs-scroll w-full resize-y p-10 text-12 leading-[1.5] outline-none"
			/>
			<p className="mt-[4px] text-11 text-[#9AA396]">{t("contractVarsHint", { vars })}</p>
			<div className="mt-12 flex flex-wrap items-center gap-8">
				<button type="button" onClick={() => setText(defaultContractText(marketOf(settings?.country) ?? null))} className="fs-btn fs-btn-ghost h-38">
					<TbRotateClockwise size={14} /> {t("contractInsertDefault")}
				</button>
				<button type="button" onClick={() => void save()} disabled={saving} className="fs-btn fs-btn-primary h-38 disabled:opacity-[0.5]">{t("save")}</button>
				<p className="text-11 text-[#9AA396]">{t("contractSectionHint2")}</p>
			</div>
		</div>
	);
}
