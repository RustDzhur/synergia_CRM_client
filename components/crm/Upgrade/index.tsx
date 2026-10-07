"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import { TbChartBar, TbCircle, TbCircleCheck, TbFileText, TbInfoCircle, TbLock } from "react-icons/tb";
import { FEATURE_KEYS, FeatureKey, PLANS, PlanId, YEAR_MONTHS, limitsLine } from "@/config/plans";
import { apiCall } from "@/store/crmApi";
import PageHeader from "@/components/crm/shared/PageHeader";
import PromoBanner from "@/components/shared/PromoBanner";
import { localeTag } from "@/utils/dateHelpers";
import PayModal from "./PayModal";

const ICONS: Record<PlanId, IconType> = { free: TbChartBar, standard: TbInfoCircle, professional: TbFileText };

interface Billing {
	plan: PlanId;
	paidUntil: string;
	market: "DE" | "UA";
	currency: "EUR" | "UAH";
	methods: { bank: boolean; usdt: boolean };
	prices: Record<"standard" | "professional", { month: number; year: number }>;
	open: { id: string; number: string; plan: "standard" | "professional"; interval: "month" | "year"; method: "bank" | "usdt"; status: string }[];
}

// Раздел Upgrade Your Plan (/crm/upgrade): три тарифа из app/config/plans.ts (те же, что на лендинге) — в ряд на десктопе
// и планшете, в столбец на телефоне. Оплата — переводом без посредников: кнопка «Оплатить» открывает выбор «банк / USDT»
// и выписывает счёт с реквизитами платформы и QR-кодом (Германия — евро, Украина — гривна, подставляется по стране фирмы);
// администратор подтверждает поступление, и тариф включается на месяц или год. Функции, которых в тарифе нет, показаны серыми.
export default function Upgrade() {
	const t = useTranslations("upgrade");
	const locale = useLocale();
	const [billing, setBilling] = useState<Billing | null>(null);
	const [interval, setInterval] = useState<"month" | "year">("month");
	const [pay, setPay] = useState<{ plan: "standard" | "professional" | null; orderId: string | null } | null>(null);
	const [pendingAutoPlan, setPendingAutoPlan] = useState<"standard" | "professional" | null>(null);
	// раздел, в который пытались зайти по прямой ссылке, но которого нет в тарифе (?locked=… ставит layout CRM)
	const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null);

	const load = useCallback(async () => {
		const res = await apiCall<Billing>(`/api/billing?locale=${locale}`);
		if (res.ok && res.data) setBilling(res.data);
	}, [locale]);

	useEffect(() => {
		// пришли сюда сразу после регистрации/входа с лендинга, где выбрали платный тариф ("Choose Plan"): открываем
		// оформление счёта для него автоматически, не заставляя нажимать "Оплатить" второй раз
		const q = new URLSearchParams(window.location.search);
		const startPlan = q.get("startPlan");
		const startInterval = q.get("interval");
		const locked = q.get("locked");
		if (locked && (FEATURE_KEYS as readonly string[]).includes(locked)) setLockedFeature(locked as FeatureKey);
		if (startPlan || locked) window.history.replaceState(null, "", window.location.pathname);
		if (startPlan === "standard" || startPlan === "professional") {
			if (startInterval === "year") setInterval("year");
			setPendingAutoPlan(startPlan);
		}
		load();
	}, [load]);

	// автозапуск после прихода с лендинга — ждём загрузки способов оплаты, чтобы не открывать пустую форму
	useEffect(() => {
		if (!pendingAutoPlan || !billing) return;
		setPendingAutoPlan(null);
		if (billing.plan === pendingAutoPlan && billing.paidUntil) return; // уже на этом тарифе
		if (billing.methods.bank || billing.methods.usdt) setPay({ plan: pendingAutoPlan, orderId: null });
	}, [pendingAutoPlan, billing]);

	const current = billing?.plan ?? "free";
	const noMethods = !!billing && !billing.methods.bank && !billing.methods.usdt;
	const cur = billing?.currency === "UAH" ? "₴" : "€";
	const seg = (on: boolean) => `h-34 rounded-50 px-16 text-13 font-medium transition-colors ${on ? "bg-[#c6ff4d] text-[#0a0c0b]" : "text-[#8c948b] hover:text-[#f1f4ee]"}`;

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="mx-auto max-w-[1140px]"><PromoBanner compact /></div>
			<div className="mx-auto mb-20 flex max-w-[1140px] flex-col items-center gap-12">
				<div className="flex rounded-50 border border-inkLine bg-[rgba(255,255,255,0.03)] p-2" role="tablist" aria-label={t("billingPeriod")}>
					<button type="button" role="tab" aria-selected={interval === "month"} onClick={() => setInterval("month")} className={seg(interval === "month")}>{t("monthly")}</button>
					<button type="button" role="tab" aria-selected={interval === "year"} onClick={() => setInterval("year")} className={seg(interval === "year")}>
						{t("yearly")} <span className="ml-6 text-11 opacity-80">{t("twoMonthsFree", { count: 12 - YEAR_MONTHS })}</span>
					</button>
				</div>
				{lockedFeature && <p role="alert" className="rounded-10 bg-[rgba(244,161,0,0.10)] px-16 py-10 text-center text-13 text-[#F4A100]">{t("lockedNotice", { feature: t(lockedFeature) })}</p>}
				{noMethods && <p className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] px-16 py-10 text-12 text-[#8c948b]">{t("paymentsNotConfigured")}</p>}
				{billing && billing.open.length > 0 && (
					<ul className="flex w-full max-w-[560px] flex-col gap-6" aria-label={t("openInvoices")}>
						{billing.open.map((o) => (
							<li key={o.id} className="fs-card flex items-center justify-between gap-12 px-14 py-10 text-12">
								<span className="text-[#f1f4ee]">{t("invoiceNo")} {o.number} · {t(o.plan)} · {o.status === "claimed" ? t("statusClaimed") : t("statusNew")}</span>
								<button type="button" onClick={() => setPay({ plan: o.plan, orderId: o.id })} className="font-semibold text-[#c6ff4d] hover:opacity-80">{t("openInvoice")}</button>
							</li>
						))}
					</ul>
				)}
			</div>

			<ul className="mx-auto grid max-w-[1140px] grid-cols-1 gap-16 md:grid-cols-3 lg:gap-20">
				{PLANS.map((plan) => {
					const Icon = ICONS[plan.id];
					const isCurrent = current === plan.id;
					const paidPlan = plan.id === "standard" || plan.id === "professional" ? plan.id : null;
					// цена в валюте рынка фирмы: евро из тарифа или гривна, заданная администратором (пока не задана — евро)
					const local = paidPlan && billing ? billing.prices[paidPlan][interval] : 0;
					const shown = local > 0 ? `${local}${cur}` : `${interval === "year" ? plan.priceMonth * YEAR_MONTHS : plan.priceMonth}€`;
					return (
						<li
							key={plan.id}
							className={`fs-card mx-auto flex w-full max-w-[340px] flex-col items-center px-24 pb-30 pt-24 md:max-w-none ${
								plan.highlighted ? "border-[rgba(198,255,77,0.35)] bg-[rgba(198,255,77,0.04)]" : ""
							} ${isCurrent ? "border-[#c6ff4d]" : ""}`}>
							<Icon size={32} className="text-[#c6ff4d]" aria-hidden />
							<h2 className="mt-4 text-17 font-semibold text-[#f1f4ee]">{t(plan.id)}</h2>
							<div className="mt-6 flex h-[22px] items-center">
								{isCurrent && <span className="fs-chip h-24 border-[rgba(198,255,77,0.40)] px-10 text-10 text-[#c6ff4d]">{t("currentPlan")}</span>}
							</div>

							<p className="mt-24 text-30 font-bold leading-[1.1] text-[#f1f4ee] lg:text-34">
								{plan.priceMonth === 0 ? (
									t("freePrice")
								) : (
									<>
										{shown}/<span className="text-14">{interval === "year" ? t("perYear") : t("perMonth")}</span>
									</>
								)}
							</p>
							<p className="mt-6 text-center text-13 text-[#8c948b]">
								{plan.users === null ? t("unlimitedUsers") : t("users", { count: plan.users })}
							</p>
							{limitsLine(plan, t) && <p className="mt-2 text-center text-11 text-[#9AA396]">{limitsLine(plan, t)}</p>}

							<ul className="mb-30 mt-30 flex w-full flex-col gap-8 text-13">
								{FEATURE_KEYS.map((f) => {
									const included = plan.features[f];
									return (
										<li key={f} className={`flex items-start gap-8 ${included ? "text-[#c6ff4d]" : "text-[#8C948B] line-through"}`}>
											{included ? <TbCircleCheck size={16} className="mt-2 shrink-0" aria-hidden /> : <TbCircle size={16} className="mt-2 shrink-0" aria-hidden />}
											{t(f)}
										</li>
									);
								})}
							</ul>
							{plan.id === "professional" && <p className="mb-16 text-12 font-medium text-[#2DDEB6]">{t("fullAccess")}</p>}

							{isCurrent && billing?.paidUntil && plan.priceMonth > 0 && (
								<p className="mb-12 text-center text-12 text-[#8c948b]">{t("paidUntil", { date: new Date(billing.paidUntil).toLocaleDateString(localeTag(locale)) })}</p>
							)}

							{plan.priceMonth === 0 ? (
								isCurrent ? <button type="button" disabled className="fs-btn mt-auto h-40 w-[165px] bg-[rgba(255,255,255,0.05)] text-13 font-semibold text-[#8C948B]">{t("currentPlan")}</button> : <span className="mt-auto h-40" aria-hidden />
							) : (
								<button
									type="button"
									onClick={() => paidPlan && setPay({ plan: paidPlan, orderId: null })}
									disabled={!billing || noMethods}
									className="fs-btn fs-btn-primary mt-auto h-40 w-[165px] text-13 disabled:opacity-60">
									{isCurrent && billing?.paidUntil ? t("renew") : t("buy")}
								</button>
							)}
						</li>
					);
				})}
			</ul>

			<div className="mx-auto mt-30 flex max-w-[1140px] flex-col items-center gap-10">
				<p className="max-w-[640px] text-center text-12 font-medium text-[#8c948b]">{t("methodsLine")}</p>
				<p className="max-w-[640px] text-center text-11 text-[#9AA396]">{t("methodsNote")}</p>
				<p className="flex items-center justify-center gap-6 text-center text-12 text-[#8c948b]">
					<TbLock size={14} aria-hidden /> {t("securePayment")}
				</p>
			</div>

			<PayModal
				open={!!pay}
				onClose={() => setPay(null)}
				plan={pay?.plan ?? null}
				interval={interval}
				methods={billing?.methods ?? { bank: false, usdt: false }}
				orderId={pay?.orderId}
				onChanged={load}
			/>
		</div>
	);
}
