"use client";
import "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

// Моноширинного семейства в tailwind.config.ts нет (там только Inter), поэтому стек задаём на месте —
// токен должен читаться как код, а не как обычный текст в подсказке.
const MONO = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" };

// Что сервер понимает в тексте правила (см. lib/automation: render + eventView): поля события — коротким именем и как
// «сущность.поле» — плюс значения из соседних вкладок Constants и Variables. NAME и name в примерах — это имя, которое
// пользователь задал своей константе или переменной.
const GROUPS: { group: string; rows: { label: string; token: string }[] }[] = [
	{
		group: "vh_grp_deal",
		rows: [
			{ label: "vh_deal_name", token: "{{deal.name}}" },
			{ label: "vh_deal_stage", token: "{{deal.stageName}}" },
			{ label: "vh_deal_contact", token: "{{deal.contactName}}" },
		],
	},
	{
		group: "vh_grp_contact",
		rows: [
			{ label: "vh_contact_name", token: "{{contact.name}}" },
			{ label: "vh_contact_email", token: "{{contact.email}}" },
		],
	},
	{
		group: "vh_grp_message",
		rows: [
			{ label: "vh_message_text", token: "{{message.text}}" },
			{ label: "vh_message_from", token: "{{message.from}}" },
		],
	},
	{ group: "vh_grp_task", rows: [{ label: "vh_task_title", token: "{{task.title}}" }] },
	{ group: "vh_grp_constants", rows: [{ label: "vh_constant", token: "{{constants.NAME}}" }] },
	{ group: "vh_grp_variables", rows: [{ label: "vh_variable", token: "{{variables.name}}" }] },
];

// Подсказка к полям «Text» и «Message / title»: какие подстановки доступны и откуда берутся значения.
// Раньше здесь шла одна строка с сырыми {{deal.name}} {{contact.name}} … — читалась как вылезший наружу код.
export default function VariableHints() {
	const t = useTranslations("automation");

	async function copy(token: string) {
		try {
			await navigator.clipboard.writeText(token);
			toast.success(t("copied"));
		} catch {
			toast.error(t("vh_copyFailed"));
		}
	}

	return (
		<div className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] p-12">
			<p className="text-12 font-medium text-[#cfd4cb]">{t("r_variables")}</p>
			<p className="mt-4 text-11 text-[#9AA396]">{t("vh_note")}</p>
			<div className="mt-10 flex flex-col gap-10">
				{GROUPS.map((g) => (
					<div key={g.group}>
						<p className="mb-4 text-11 font-semibold text-[#8c948b]">{t(g.group)}</p>
						<ul className="flex flex-col gap-4">
							{g.rows.map((r) => (
								<li key={r.token} className="flex items-center justify-between gap-10">
									<span className="min-w-0 text-11 text-[#9AA396]">{t(r.label)}</span>
									<button type="button" onClick={() => void copy(r.token)} aria-label={`${t("copy")}: ${r.token}`} className="fs-chip h-22 shrink-0 gap-6 px-8 text-11 transition-colors hover:border-[rgba(198,255,77,0.35)] hover:text-[#c6ff4d]" style={MONO}>
										{r.token}
									</button>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</div>
	);
}
