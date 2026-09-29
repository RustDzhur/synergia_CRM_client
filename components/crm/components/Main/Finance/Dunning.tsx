"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import { FinanceSettings, Invoice, useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";
import { ReportLoading } from "./reportParts";

// Mahnwesen: список просроченных счетов фирмы и ручная отправка напоминаний. Ступень и сбор считает сервер
// (POST /api/invoices/:id/remind → lib/finance/dunning.ts); клиент только показывает состояние и перечитывает
// список после отправки. Проценты за просрочку — справочная цифра: ставка приходит из настроек бухгалтерии
// (dunningInterestRate), и пока она не заполнена, колонка остаётся пустой.

// Поля манаведения появились в настройках позже, чем тип FinanceSettings в сторе (app/store/useFinanceStore.ts);
// читаем их через локальный тип, чтобы не менять общий стор ради трёх полей.
type DunningFields = { dunningFees?: number[]; dunningInterestRate?: number; dunningPaymentDays?: number };

const DAY = 86400000;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Те же формулы, что в lib/finance/dunning.ts (импортировать его нельзя — он тянет mongoose): дни просрочки
// считаются по календарным суткам (UTC-полночь даты), чтобы цифра не «дрожала» в течение дня.
function daysOverdue(dueDate: string, today = new Date()): number {
	if (!dueDate) return 0;
	const due = new Date(`${dueDate}T00:00:00.000Z`);
	if (Number.isNaN(due.getTime())) return 0;
	return Math.max(0, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - due.getTime()) / DAY));
}

// Проценты за просрочку: (сумма счёта + сборы) × ставка × дни / 365 — только если ставка задана в настройках
function interestFor(gross: number, rate: number, days: number): number {
	if (!rate || !days) return 0;
	return round2(gross * (rate / 100) * (days / 365));
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
	return (
		<div className="fs-card p-16">
			<p className="text-12 text-[#8c948b]">{label}</p>
			<p className="mt-6 text-20 font-semibold" style={{ color: color ?? "#f1f4ee" }}>{value}</p>
		</div>
	);
}

// Экран вкладки «Mahnungen» раздела Finance — открывается и по ссылке ?tab=dunning (см. index.tsx)
export default function Dunning() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const invoices = useFinanceStore((s) => s.invoices);
	const settings = useFinanceStore((s) => s.settings) as (FinanceSettings & DunningFields) | null;
	const loadInvoices = useFinanceStore((s) => s.loadInvoices);
	// список уже мог быть загружен другой вкладкой — тогда повторный заход не мигает загрузкой
	const [loading, setLoading] = useState(() => invoices.length === 0);
	const [busy, setBusy] = useState<string | null>(null);
	const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);

	useEffect(() => { loadInvoices().then(() => setLoading(false)); }, [loadInvoices]);

	// Просроченные счета: статус overdue или отправленный счёт, срок оплаты которого уже прошёл. Кредит-ноты
	// пропускаем: напоминания по ним сервер не принимает («Only invoices can be reminded»).
	const rows = invoices
		.filter((i) => i.kind === "invoice")
		.map((inv) => ({ inv, days: daysOverdue(inv.dueDate) }))
		.filter((r) => r.inv.status === "overdue" || (r.inv.status === "sent" && r.days > 0))
		.sort((a, b) => b.days - a.days);

	const rate = Number(settings?.dunningInterestRate) || 0;
	const currency = settings?.currency ?? "EUR";
	const prepared = rows.map(({ inv, days }) => {
		const fee = Number(inv.dunningFee) || 0;
		const level = Math.min(4, Number(inv.dunningLevel) || 0);
		return { inv, days, fee, level, open: inv.totals.gross, interest: interestFor(inv.totals.gross + fee, rate, days) };
	});
	const dueCount = prepared.filter((r) => r.level < 4).length;
	const openTotal = prepared.reduce((s, r) => s + r.open, 0);
	const feeTotal = round2(prepared.reduce((s, r) => s + r.fee, 0));

	async function remind(inv: Invoice) {
		setBusy(inv.id);
		setNotice(null);
		const r = await apiCall<{ ok: boolean; level: number; fee: number }>(`/api/invoices/${inv.id}/remind`, "POST", {});
		setBusy(null);
		if (r.ok && r.data) {
			await loadInvoices(); // ступень и сбор уже в базе — список перечитываем, а не правим на месте
			toast.success(t("dunningSent", { level: t(`level_${Math.min(4, r.data.level)}`) }));
			return;
		}
		// Отказ сервера (400) — это объяснение, а не поломка: показываем спокойной строкой под строкой счёта,
		// без красного тоста. Известные причины переводим, остальное отдаём как пришло.
		const message = (r.message || "").toLowerCase();
		const text =
			message.includes("already paid") ? t("dunningNoticePaid") :
			message.includes("cancelled") ? t("dunningNoticeCancelled") :
			message.includes("no due date") ? t("dunningNoticeNoDueDate") :
			message.includes("highest reminder level") ? t("dunningNoticeMaxLevel") :
			message.includes("only invoices") ? t("dunningNoticeOnlyInvoices") :
			message.includes("not found") ? t("dunningNoticeNotFound") :
			r.message || t("dunningRemindFailed");
		setNotice({ id: inv.id, text });
	}

	if (loading) return <ReportLoading />;

	return (
		<div>
			<div className="mb-16">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("dunningTitle")}</h2>
				<p className="mt-6 text-12 leading-[1.5] text-[#8c948b]">{t("dunningHint")}</p>
			</div>

			<div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-3">
				<Stat label={t("dunningSummaryDue")} value={String(dueCount)} color={dueCount > 0 ? "#F4A100" : undefined} />
				<Stat label={t("dunningSummaryOpen")} value={money(openTotal, currency, locale)} />
				<Stat label={t("dunningSummaryFees")} value={money(feeTotal, currency, locale)} color={feeTotal > 0 ? "#F4A100" : undefined} />
			</div>

			{prepared.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("dunningEmpty")}</p>
			) : (
				<section className="fs-card overflow-x-auto">
					<table className="fs-table min-w-[880px]">
						<thead>
							<tr>
								<th className="px-16">{t("dunningColInvoice")}</th>
								<th className="px-10">{t("customer")}</th>
								<th className="px-10">{t("dueDate")}</th>
								<th className="px-10 text-right">{t("dunningColDays")}</th>
								<th className="px-10">{t("dunningColLevel")}</th>
								<th className="px-10 text-right">{t("dunningColFee")}</th>
								<th className="px-10 text-right">{t("dunningColOpen")}</th>
								<th className="px-10 text-right">{t("dunningColInterest")}</th>
								<th className="px-10 text-right">{t("dunningColAction")}</th>
							</tr>
						</thead>
						<tbody>
							{prepared.map(({ inv, days, fee, level, open, interest }) => (
								<React.Fragment key={inv.id}>
									<tr>
										<td className="px-16 text-13 font-medium">{inv.number}</td>
										<td className="px-10 text-13">{inv.customerName}</td>
										<td className="px-10 text-13">{inv.dueDate || "—"}</td>
										<td className="px-10 text-right text-13" style={{ color: days > 0 ? "#EB5757" : undefined }}>{days}</td>
										<td className="px-10 text-13">
											{level > 0 ? (
												// ступень 4 (letzte Mahnung) — красная: дальше только правовая стадия, автоматика её не поднимает
												<span className={`fs-chip h-22 px-8 text-10 ${level >= 4 ? "border-[rgba(235,87,87,0.35)] text-[#EB5757]" : "border-[rgba(244,161,0,0.35)] text-[#F4A100]"}`}>
													{t(`level_${level}`)}
												</span>
											) : (
												<span className="text-12 text-[#9AA396]">{t("dunningNone")}</span>
											)}
										</td>
										<td className="px-10 text-right text-13">{fee > 0 ? money(fee, inv.currency, locale) : "—"}</td>
										<td className="px-10 text-right text-13 font-medium">{money(open, inv.currency, locale)}</td>
										<td className="px-10 text-right text-13">{interest > 0 ? money(interest, inv.currency, locale) : "—"}</td>
										<td className="px-10 text-right">
											{/* выше 4 ступени не бывает — у последней махнунг кнопки нет, показана только ступень */}
											{level < 4 && (
												<button
													type="button"
													disabled={busy === inv.id}
													onClick={() => remind(inv)}
													className="fs-btn fs-btn-primary h-34 disabled:opacity-[0.5]">
													{busy === inv.id ? t("dunningSending") : t("dunningSend")}
												</button>
											)}
										</td>
									</tr>
									{notice?.id === inv.id && (
										<tr>
											<td colSpan={9} className="pt-0 text-12 leading-[1.5] text-[#9AA396]">{notice.text}</td>
										</tr>
									)}
								</React.Fragment>
							))}
						</tbody>
					</table>
				</section>
			)}
		</div>
	);
}
