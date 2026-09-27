"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { TbChartBar, TbCircle, TbCircleCheck, TbFileText, TbInfoCircle, TbLock } from "react-icons/tb";
import { SiApplepay, SiGooglepay, SiKlarna, SiMastercard, SiPaypal, SiVisa } from "react-icons/si";
import { FEATURE_KEYS, PLANS, PlanId, YEAR_MONTHS } from "@/app/config/plans";
import { apiCall } from "@/app/store/crmApi";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import Modal from "../shared/Modal";

const ICONS: Record<PlanId, IconType> = { free: TbChartBar, standard: TbInfoCircle, professional: TbFileText };

interface Billing {
	configured: boolean;
	crypto?: boolean;
	prepaidUntil?: string;
	plan: PlanId;
	status: string;
	interval: "month" | "year" | "";
	currentPeriodEnd: string;
	cancelAtPeriodEnd: boolean;
	hasCustomer: boolean;
}

// Раздел Upgrade Your Plan (/crm/upgrade): три тарифа из app/config/plans.ts (те же, что на лендинге) — в ряд на десктопе
// и планшете, в столбец на телефоне. Оплата — Stripe Checkout (подписка, помесячно или за год); смена тарифа, способ оплаты,
// счета и отмена — в кабинете оплаты Stripe («Manage billing»). Функции, которых в тарифе нет, показаны серыми.
export default function Upgrade() {
	const t = useTranslations("upgrade");
	const locale = useLocale();
	const [billing, setBilling] = useState<Billing | null>(null);
	const [interval, setInterval] = useState<"month" | "year">("month");
	const [busy, setBusy] = useState<string | null>(null);
	const [invoiceOpen, setInvoiceOpen] = useState(false);
	const [inv, setInv] = useState({ plan: "standard", company: "", vatId: "", note: "" });
	const [pendingAutoPlan, setPendingAutoPlan] = useState<PlanId | null>(null);

	const load = useCallback(async () => {
		const res = await apiCall<Billing>("/api/billing");
		if (res.ok && res.data) setBilling(res.data);
	}, []);

	useEffect(() => {
		// возврат со Stripe Checkout: ?checkout=success&session_id=… или ?checkout=cancel
		const q = new URLSearchParams(window.location.search);
		const result = q.get("checkout");
		const sessionId = q.get("session_id");
		// пришли сюда сразу после регистрации/входа с лендинга, где выбрали платный тариф ("Choose Plan"): запускаем
		// Stripe Checkout для него автоматически, не заставляя нажимать "Buy" второй раз
		const startPlan = q.get("startPlan");
		const startInterval = q.get("interval");
		if (result || q.get("crypto") || startPlan) window.history.replaceState(null, "", window.location.pathname);
		if (startPlan === "standard" || startPlan === "professional") {
			if (startInterval === "year") setInterval("year");
			setPendingAutoPlan(startPlan);
		}
		(async () => {
			if (result === "success" && sessionId) {
				const res = await apiCall<{ confirmed: boolean }>("/api/billing/confirm", "POST", { sessionId });
				if (res.ok && res.data?.confirmed) toast.success(t("checkoutSuccess"));
				else toast(t("checkoutPending"), { duration: 7000 });
			} else if (result === "cancel") toast(t("checkoutCancel"));
			else if (q.get("crypto") === "success") toast.success(t("cryptoPending"), { duration: 9000 });
			else if (q.get("crypto") === "cancel") toast(t("checkoutCancel"));
			await load();
		})();
	}, [load, t]);

	async function subscribe(plan: PlanId) {
		if (busy) return;
		setBusy(plan);
		const res = await apiCall<{ url: string }>("/api/billing/checkout", "POST", { plan, interval, locale });
		if (res.ok && res.data?.url) return void (window.location.href = res.data.url);
		setBusy(null);
		toast.error(res.status === 503 ? t("paymentsNotConfigured") : res.status === 409 ? t("alreadySubscribed") : res.message || t("checkoutFailed"));
	}

	// автозапуск оплаты после прихода с лендинга (см. ?startPlan= выше) — ждём загрузки billing, чтобы не предлагать
	// оплату тарифа, который уже активен, и не пытаться уйти на Checkout, пока платежи не настроены
	useEffect(() => {
		if (!pendingAutoPlan || !billing) return;
		setPendingAutoPlan(null);
		const subscribed = billing.hasCustomer && ["active", "trialing", "past_due"].includes(billing.status);
		if (billing.plan === pendingAutoPlan && subscribed) return; // уже на этом тарифе
		if (!billing.configured) return; // тост "оплата не настроена" и так покажет карточка
		subscribe(pendingAutoPlan);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pendingAutoPlan, billing]);

	async function payCrypto(plan: PlanId) {
		if (busy) return;
		setBusy(`crypto-${plan}`);
		const res = await apiCall<{ url: string }>("/api/billing/crypto", "POST", { plan, interval, locale });
		if (res.ok && res.data?.url) return void (window.location.href = res.data.url);
		setBusy(null);
		toast.error(res.status === 503 ? t("cryptoNotConfigured") : res.status === 409 ? t("alreadySubscribed") : res.message || t("checkoutFailed"));
	}

	async function portal() {
		if (busy) return;
		setBusy("portal");
		const res = await apiCall<{ url: string }>("/api/billing/portal", "POST", { locale });
		if (res.ok && res.data?.url) return void (window.location.href = res.data.url);
		setBusy(null);
		toast.error(res.status === 503 ? t("paymentsNotConfigured") : res.message || t("checkoutFailed"));
	}

	async function sendInvoice(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy("invoice");
		const res = await apiCall("/api/billing/invoice-request", "POST", { ...inv, interval });
		setBusy(null);
		if (!res.ok) return void toast.error(res.status === 409 ? t("invoiceOpen") : res.message);
		setInvoiceOpen(false);
		toast.success(t("invoiceSent"));
	}

	const current = billing?.plan ?? "free";
	const subscribed = billing?.hasCustomer && ["active", "trialing", "past_due"].includes(billing.status);
	const date = billing?.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toLocaleDateString(locale === "ua" ? "uk" : locale) : "";
	const seg = (on: boolean) => `h-34 rounded-50 px-16 text-13 font-medium transition-colors ${on ? "bg-[#c6ff4d] text-[#0a0c0b]" : "text-[#8c948b] hover:text-[#f1f4ee]"}`;

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="mx-auto mb-20 flex max-w-[1140px] flex-col items-center gap-12">
				<div className="flex rounded-50 border border-inkLine bg-[rgba(255,255,255,0.03)] p-2" role="tablist" aria-label={t("billingPeriod")}>
					<button type="button" role="tab" aria-selected={interval === "month"} onClick={() => setInterval("month")} className={seg(interval === "month")}>{t("monthly")}</button>
					<button type="button" role="tab" aria-selected={interval === "year"} onClick={() => setInterval("year")} className={seg(interval === "year")}>
						{t("yearly")} <span className="ml-6 text-11 opacity-80">{t("twoMonthsFree", { count: 12 - YEAR_MONTHS })}</span>
					</button>
				</div>
				{billing && billing.status === "past_due" && <p role="alert" className="rounded-10 bg-[rgba(244,161,0,0.10)] px-16 py-10 text-12 text-[#F4A100]">{t("pastDue")}</p>}
				{billing && !billing.configured && <p className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] px-16 py-10 text-12 text-[#8c948b]">{t("paymentsNotConfigured")}</p>}
			</div>

			<ul className="mx-auto grid max-w-[1140px] grid-cols-1 gap-16 md:grid-cols-3 lg:gap-20">
				{PLANS.map((plan) => {
					const Icon = ICONS[plan.id];
					const isCurrent = current === plan.id;
					const price = interval === "year" ? plan.priceMonth * YEAR_MONTHS : plan.priceMonth;
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
										{price}€/<span className="text-14">{interval === "year" ? t("perYear") : t("perMonth")}</span>
									</>
								)}
							</p>
							<p className="mt-6 text-center text-13 text-[#8c948b]">
								{plan.users === null ? t("unlimitedUsers") : t("users", { count: plan.users })}
							</p>
							<p className="mt-2 text-center text-11 text-[#9AA396]">
								{t("limitsLine", { rules: plan.automationRules, ai: plan.aiDailyRequests, storage: plan.storageMb >= 1000 ? `${plan.storageMb / 1000} GB` : `${plan.storageMb} MB` })}
							</p>

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

							{isCurrent && !subscribed && billing?.prepaidUntil && plan.priceMonth > 0 && (
								<p className="mb-12 text-center text-12 text-[#8c948b]">{t("paidUntil", { date: new Date(billing.prepaidUntil).toLocaleDateString(locale === "ua" ? "uk" : locale) })}</p>
							)}
							{isCurrent && subscribed && billing?.currentPeriodEnd && plan.priceMonth > 0 && (
								<p className="mb-12 text-center text-12 text-[#8c948b]">{billing.cancelAtPeriodEnd ? t("endsOn", { date }) : t("renewsOn", { date })}</p>
							)}

							{plan.priceMonth === 0 ? (
								isCurrent ? (
									<button type="button" disabled className="fs-btn mt-auto h-40 w-[165px] bg-[rgba(255,255,255,0.05)] text-13 font-semibold text-[#8C948B]">{t("currentPlan")}</button>
								) : (
									<button type="button" onClick={portal} disabled={busy !== null} className="fs-btn fs-btn-ghost mt-auto h-40 w-[165px] text-[#c6ff4d] disabled:opacity-60">
										{t("manageBilling")}
									</button>
								)
							) : isCurrent && subscribed ? (
								<button type="button" onClick={portal} disabled={busy !== null} className="fs-btn fs-btn-ghost mt-auto h-40 w-[165px] text-[#c6ff4d] disabled:opacity-60">
									{busy === "portal" ? "…" : t("manageBilling")}
								</button>
							) : subscribed ? (
								<button type="button" onClick={portal} disabled={busy !== null} className="fs-btn fs-btn-primary mt-auto h-40 w-[165px] text-13 disabled:opacity-60">
									{busy === "portal" ? "…" : t("changePlan")}
								</button>
							) : (
								<button
									type="button"
									onClick={() => subscribe(plan.id)}
									disabled={busy !== null || !billing || !billing.configured}
									className="fs-btn fs-btn-primary mt-auto h-40 w-[165px] text-13 disabled:opacity-60">
									{busy === plan.id ? "…" : t("buy")}
								</button>
							)}
							{plan.priceMonth > 0 && !subscribed && billing?.crypto && (
								<button type="button" onClick={() => payCrypto(plan.id)} disabled={busy !== null} className="mt-10 text-12 font-medium text-[#c6ff4d] transition-opacity hover:opacity-80 disabled:opacity-60">
									{busy === `crypto-${plan.id}` ? "…" : t("payCrypto")}
								</button>
							)}
						</li>
					);
				})}
			</ul>

			<div className="mx-auto mt-30 flex max-w-[1140px] flex-col items-center gap-10">
				<div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8 text-[#8c948b]" aria-label={t("methods")}>
					<SiVisa size={30} aria-label="Visa" /><SiMastercard size={24} aria-label="Mastercard" /><SiApplepay size={32} aria-label="Apple Pay" /><SiGooglepay size={32} aria-label="Google Pay" />
					<SiPaypal size={20} aria-label="PayPal" /><SiKlarna size={34} aria-label="Klarna" />
					<span className="text-12 font-medium">SEPA</span>
				</div>
				<p className="max-w-[640px] text-center text-11 text-[#9AA396]">{t("methodsNote")}</p>
				<button type="button" onClick={() => setInvoiceOpen(true)} className="text-12 font-semibold text-[#c6ff4d] transition-opacity hover:opacity-80">{t("invoiceButton")}</button>
				<p className="flex items-center justify-center gap-6 text-center text-12 text-[#8c948b]">
					<TbLock size={14} aria-hidden /> {t("securePayment")}
				</p>
			</div>

			<Modal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} label={t("invoiceButton")} className="w-full max-w-[460px]">
				<form onSubmit={sendInvoice} className="fs-popover p-20">
					<h2 className="mb-6 text-16 font-semibold text-[#f1f4ee]">{t("invoiceButton")}</h2>
					<p className="mb-16 text-13 text-[#8c948b]">{t("invoiceText")}</p>
					<div className="flex flex-col gap-12">
						<select value={inv.plan} onChange={(e) => setInv({ ...inv, plan: e.target.value })} aria-label={t("planLabel")} className="fs-field h-40 px-12 text-13 outline-none">
							{PLANS.filter((p) => p.priceMonth > 0).map((p) => <option key={p.id} value={p.id}>{t(p.id)} · {interval === "year" ? p.priceMonth * YEAR_MONTHS : p.priceMonth}€/{interval === "year" ? t("perYear") : t("perMonth")}</option>)}
						</select>
						<textarea required value={inv.company} onChange={(e) => setInv({ ...inv, company: e.target.value })} maxLength={200} rows={3} placeholder={t("invoiceCompany")} aria-label={t("invoiceCompany")} className="fs-field fs-scroll w-full p-10 text-13 outline-none" />
						<input value={inv.vatId} onChange={(e) => setInv({ ...inv, vatId: e.target.value })} maxLength={40} placeholder={t("invoiceVat")} aria-label={t("invoiceVat")} className="fs-field h-40 px-12 text-13 outline-none" />
					</div>
					<div className="mt-20 flex justify-end gap-12">
						<button type="button" onClick={() => setInvoiceOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" disabled={busy === "invoice"} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy === "invoice" ? "…" : t("invoiceSend")}</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
