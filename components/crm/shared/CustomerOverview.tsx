"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { apiCall } from "@/store/crmApi";
import { money } from "../Finance/format";

// Сводка по клиенту или сделке: деньги (выставлено, оплачено, остаток, расходы, маржа), неоплаченные счета, последние
// оплаты, задачи, сделки, расходы. Данные приходят одним запросом (lib/sync/overview.ts) и перечитываются, когда
// что-то меняется в любом разделе (событие crm:changed из store/invalidate.ts).

interface Summary { currency: string; invoiced: number; paid: number; outstanding: number; expenses: number; margin: number }
interface Data {
	summary: Summary[];
	deals: { id: string; name: string; stageName: string; won: boolean; endDate: string; responsible: string }[];
	tasks: { id: string; title: string; deadline: string; completed: boolean; responsible: string }[];
	invoices: { id: string; number: string; status: string; total: number; paid: number; due: number; dueDate: string; currency: string; overdue: boolean }[];
	payments: { id: string; number: string; amount: number; currency: string; source: string; via: string; at: string }[];
	expenses: { id: string; vendor: string; amount: number; currency: string; date: string }[];
}

export default function CustomerOverview({ url, withDeals = true }: { url: string; withDeals?: boolean }) {
	const t = useTranslations("overview");
	const locale = useLocale();
	const [data, setData] = useState<Data | null>(null);

	const load = useCallback(async () => {
		const r = await apiCall<Data>(url, "GET", undefined, { cache: "no-store" });
		if (r.ok && r.data) setData(r.data);
	}, [url]);

	useEffect(() => {
		void load();
		const onChange = () => void load();
		window.addEventListener("crm:changed", onChange);
		return () => window.removeEventListener("crm:changed", onChange);
	}, [load]);

	if (!data) return <div className="fs-card mb-20 p-16 text-12 text-[#8c948b] md:p-20">{t("loading")}</div>;

	const open = data.invoices.filter((i) => i.due > 0);
	const openTasks = data.tasks.filter((x) => !x.completed);
	const nothing = !data.summary.length && !data.deals.length && !data.tasks.length && !data.payments.length && !data.expenses.length;
	const day = (d: string) => (d ? new Date(d.length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString(locale) : "");

	const block = (title: string, rows: React.ReactNode[], key: string) =>
		rows.length ? (
			<div key={key} className="mt-16">
				<p className="mb-6 text-12 font-medium uppercase tracking-wide text-[#8c948b]">{title}</p>
				<ul className="flex flex-col">{rows}</ul>
			</div>
		) : null;
	const row = "flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-inkLineSoft py-7 text-12 first:border-t-0";

	return (
		<div className="fs-card mb-20 p-16 md:p-20">
			<p className="mb-10 text-13 font-medium text-[#f1f4ee]">{t("title")}</p>
			{nothing && <p className="text-12 text-[#8c948b]">{t("empty")}</p>}

			{data.summary.map((s) => (
				<dl key={s.currency} className="mb-8 grid grid-cols-2 gap-x-16 gap-y-8 sm:grid-cols-5">
					{([["invoiced", s.invoiced], ["paid", s.paid], ["outstanding", s.outstanding], ["expenses", s.expenses], ["margin", s.margin]] as const).map(([k, v]) => (
						<div key={k}>
							<dt className="text-11 text-[#8c948b]">{t(k)}</dt>
							<dd className={`text-14 ${k === "outstanding" && v > 0 ? "text-[#F4A100]" : k === "margin" && v < 0 ? "text-[#ff7a70]" : "text-[#f1f4ee]"}`}>{money(v, s.currency, locale)}</dd>
						</div>
					))}
				</dl>
			))}

			{block(t("openInvoices"), open.map((i) => (
				<li key={i.id} className={row}>
					<span className="text-[#f1f4ee]">{i.number}</span>
					{i.overdue && <span className="fs-chip h-20 px-8 text-10 text-[#ff7a70]">{t("overdue")}</span>}
					{i.dueDate && <span className="text-[#8c948b]">{t("dueOn", { date: day(i.dueDate) })}</span>}
					<span className="ml-auto text-[#cfd4cb]">{money(i.due, i.currency, locale)}</span>
				</li>
			)), "inv")}

			{block(t("payments"), data.payments.slice(0, 8).map((p) => (
				<li key={p.id} className={row}>
					<span className="text-[#f1f4ee]">{p.number || "—"}</span>
					<span className="text-[#8c948b]">{day(p.at)}</span>
					<span className="text-[#8c948b]">{p.via || t(`source_${p.source}`)}</span>
					<span className={`ml-auto ${p.amount < 0 ? "text-[#ff7a70]" : "text-[#c6ff4d]"}`}>{money(p.amount, p.currency, locale)}</span>
				</li>
			)), "pay")}

			{block(t("tasks"), openTasks.slice(0, 8).map((x) => (
				<li key={x.id} className={row}>
					<Link href={`/${locale}/crm/tasks`} className="text-[#f1f4ee] hover:underline">{x.title}</Link>
					{x.deadline && <span className="text-[#8c948b]">{day(x.deadline)}</span>}
					{x.responsible && <span className="ml-auto text-[#8c948b]">{x.responsible}</span>}
				</li>
			)), "tasks")}

			{withDeals && block(t("deals"), data.deals.slice(0, 8).map((d) => (
				<li key={d.id} className={row}>
					<span className="text-[#f1f4ee]">{d.name}</span>
					<span className="text-[#8c948b]">{d.stageName}</span>
					{d.won && <span className="fs-chip h-20 px-8 text-10 text-[#c6ff4d]">{t("won")}</span>}
				</li>
			)), "deals")}

			{block(t("expensesList"), data.expenses.slice(0, 8).map((e) => (
				<li key={e.id} className={row}>
					<span className="text-[#f1f4ee]">{e.vendor}</span>
					<span className="text-[#8c948b]">{day(e.date)}</span>
					<span className="ml-auto text-[#cfd4cb]">{money(e.amount, e.currency, locale)}</span>
				</li>
			)), "exp")}
		</div>
	);
}
