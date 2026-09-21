"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { MdCheckBox, MdCheckBoxOutlineBlank, MdInfo, MdArticle, MdLock, MdSignalCellularAlt } from "react-icons/md";
import { SiApplepay, SiGooglepay, SiKlarna, SiMastercard, SiPaypal, SiVisa } from "react-icons/si";
import { FEATURE_KEYS, PLANS, PlanId, YEAR_MONTHS } from "@/app/config/plans";
import { apiCall } from "@/app/store/crmApi";
import Modal from "../shared/Modal";

const ICONS: Record<PlanId, IconType> = { free: MdSignalCellularAlt, standard: MdInfo, professional: MdArticle };
// ключи функций в namespace "upgrade"
const FEATURE_LABEL = { chat: "chat", calls: "hdCalls", calendar: "calendar", workspace: "workspace", feed: "feed", knowledge: "knowledgeBase" } as const;

interface Billing {
	configured: boolean;
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

	const load = useCallback(async () => {
		const res = await apiCall<Billing>("/api/billing");
		if (res.ok && res.data) setBilling(res.data);
	}, []);

	useEffect(() => {
		// возврат со Stripe Checkout: ?checkout=success&session_id=… или ?checkout=cancel
		const q = new URLSearchParams(window.location.search);
		const result = q.get("checkout");
		const sessionId = q.get("session_id");
		if (result) window.history.replaceState(null, "", window.location.pathname);
		(async () => {
			if (result === "success" && sessionId) {
				const res = await apiCall<{ confirmed: boolean }>("/api/billing/confirm", "POST", { sessionId });
				if (res.ok && res.data?.confirmed) toast.success(t("checkoutSuccess"));
				else toast(t("checkoutPending"), { duration: 7000 });
			} else if (result === "cancel") toast(t("checkoutCancel"));
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
	const seg = (on: boolean) => `h-[36px] rounded-6 px-16 text-14 font-medium transition-colors ${on ? "bg-white text-primaryColor shadow-custom" : "text-[#999999]"}`;

	return (
		<div className="p-16 md:p-30">
			<div className="mx-auto mb-20 flex max-w-[1140px] flex-col items-center gap-12">
				<div className="flex rounded-8 bg-[#F5F8FA] p-2" role="tablist" aria-label={t("billingPeriod")}>
					<button type="button" role="tab" aria-selected={interval === "month"} onClick={() => setInterval("month")} className={seg(interval === "month")}>{t("monthly")}</button>
					<button type="button" role="tab" aria-selected={interval === "year"} onClick={() => setInterval("year")} className={seg(interval === "year")}>
						{t("yearly")} <span className="ml-6 text-12 text-[#009A2B]">{t("twoMonthsFree", { count: 12 - YEAR_MONTHS })}</span>
					</button>
				</div>
				{billing && billing.status === "past_due" && <p role="alert" className="rounded-8 bg-[#FFF6EA] px-16 py-10 text-14 text-[#8A5A1F]">{t("pastDue")}</p>}
				{billing && !billing.configured && <p className="rounded-8 bg-[#F5F8FA] px-16 py-10 text-14 text-[#666666]">{t("paymentsNotConfigured")}</p>}
			</div>

			<ul className="mx-auto grid max-w-[1140px] grid-cols-1 gap-20 md:grid-cols-3 md:gap-20 lg:gap-30">
				{PLANS.map((plan) => {
					const Icon = ICONS[plan.id];
					const isCurrent = current === plan.id;
					const price = interval === "year" ? plan.priceMonth * YEAR_MONTHS : plan.priceMonth;
					return (
						<li
							key={plan.id}
							className={`mx-auto flex w-full max-w-[340px] flex-col items-center rounded-24 px-24 pb-30 pt-24 shadow-heroImage md:max-w-none ${
								plan.highlighted ? "bg-[#EEF5FF]" : "bg-[#FAFCFF]"
							} ${isCurrent ? "border-2 border-[#5EA8F5]" : ""}`}>
							<Icon size={46} className="text-[#FABFAD]" aria-hidden />
							<h2 className="mt-[4px] text-20 font-semibold text-[#999999]">{t(plan.id)}</h2>
							<div className="mt-6 flex h-[22px] items-center">
								{isCurrent && <span className="rounded-4 bg-primaryColor px-10 py-2 text-12 font-medium text-white">{t("currentPlan")}</span>}
							</div>

							<p className="mt-30 text-36 font-bold leading-[1.1] text-[#666666] lg:text-40">
								{plan.priceMonth === 0 ? (
									t("freePrice")
								) : (
									<>
										{price}€/<span className="text-20">{interval === "year" ? t("perYear") : t("perMonth")}</span>
									</>
								)}
							</p>
							<p className="mt-6 text-center text-16 text-[#999999]">
								{plan.users === null ? t("unlimitedUsers") : t("users", { count: plan.users })}
							</p>

							<ul className="mb-40 mt-40 flex w-full flex-col gap-10 text-16">
								{FEATURE_KEYS.map((f) => {
									const included = plan.features[f];
									return (
										<li key={f} className={`flex items-center gap-8 ${included ? "text-primaryColor" : "text-[#CCCCCC] line-through"}`}>
											{included ? <MdCheckBox size={20} className="shrink-0" aria-hidden /> : <MdCheckBoxOutlineBlank size={20} className="shrink-0" aria-hidden />}
											{t(FEATURE_LABEL[f])}
										</li>
									);
								})}
							</ul>
							{plan.id === "professional" && <p className="mb-16 text-14 font-medium text-[#009A2B]">{t("fullAccess")}</p>}

							{isCurrent && subscribed && billing?.currentPeriodEnd && plan.priceMonth > 0 && (
								<p className="mb-12 text-center text-14 text-[#999999]">{billing.cancelAtPeriodEnd ? t("endsOn", { date }) : t("renewsOn", { date })}</p>
							)}

							{plan.priceMonth === 0 ? (
								isCurrent ? (
									<button type="button" disabled className="mt-auto h-[50px] w-[165px] rounded-4 bg-[#EBEEF8] text-18 font-semibold text-[#999999]">{t("currentPlan")}</button>
								) : (
									<button type="button" onClick={portal} disabled={busy !== null} className="mt-auto h-[50px] w-[165px] rounded-4 border border-[#5EA8F5] text-16 font-semibold text-primaryColor transition-opacity hover:opacity-80 disabled:opacity-60">
										{t("manageBilling")}
									</button>
								)
							) : isCurrent && subscribed ? (
								<button type="button" onClick={portal} disabled={busy !== null} className="mt-auto h-[50px] w-[165px] rounded-4 border border-[#5EA8F5] text-16 font-semibold text-primaryColor transition-opacity hover:opacity-80 disabled:opacity-60">
									{busy === "portal" ? "…" : t("manageBilling")}
								</button>
							) : subscribed ? (
								<button type="button" onClick={portal} disabled={busy !== null} className="mt-auto h-[50px] w-[165px] rounded-4 bg-primaryColor text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">
									{busy === "portal" ? "…" : t("changePlan")}
								</button>
							) : (
								<button
									type="button"
									onClick={() => subscribe(plan.id)}
									disabled={busy !== null || !billing || !billing.configured}
									className="mt-auto h-[50px] w-[165px] rounded-4 bg-primaryColor text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">
									{busy === plan.id ? "…" : t("buy")}
								</button>
							)}
						</li>
					);
				})}
			</ul>

			<div className="mx-auto mt-30 flex max-w-[1140px] flex-col items-center gap-10">
				<div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8 text-[#999999]" aria-label={t("methods")}>
					<SiVisa size={34} aria-label="Visa" /><SiMastercard size={28} aria-label="Mastercard" /><SiApplepay size={38} aria-label="Apple Pay" /><SiGooglepay size={38} aria-label="Google Pay" />
					<SiPaypal size={22} aria-label="PayPal" /><SiKlarna size={40} aria-label="Klarna" />
					<span className="text-14 font-medium">SEPA</span>
				</div>
				<p className="max-w-[640px] text-center text-12 text-[#B3B3B3]">{t("methodsNote")}</p>
				<button type="button" onClick={() => setInvoiceOpen(true)} className="text-14 font-medium text-primaryColor transition-opacity hover:opacity-80">{t("invoiceButton")}</button>
				<p className="flex items-center justify-center gap-6 text-center text-14 text-[#999999]">
					<MdLock size={16} aria-hidden /> {t("securePayment")}
				</p>
			</div>

			<Modal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} label={t("invoiceButton")} className="w-full max-w-[460px]">
				<form onSubmit={sendInvoice} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-6 text-24 font-medium text-black">{t("invoiceButton")}</h2>
					<p className="mb-16 text-14 text-[#666666]">{t("invoiceText")}</p>
					<div className="flex flex-col gap-12">
						<select value={inv.plan} onChange={(e) => setInv({ ...inv, plan: e.target.value })} aria-label={t("planLabel")} className="h-[44px] rounded-8 border border-[#E6E6E6] bg-white px-10 text-16 text-[#666666]">
							{PLANS.filter((p) => p.priceMonth > 0).map((p) => <option key={p.id} value={p.id}>{t(p.id)} · {interval === "year" ? p.priceMonth * YEAR_MONTHS : p.priceMonth}€/{interval === "year" ? t("perYear") : t("perMonth")}</option>)}
						</select>
						<textarea required value={inv.company} onChange={(e) => setInv({ ...inv, company: e.target.value })} maxLength={200} rows={3} placeholder={t("invoiceCompany")} aria-label={t("invoiceCompany")} className="rounded-8 border border-[#E6E6E6] p-10 text-16 outline-none focus:border-[#5EA8F5]" />
						<input value={inv.vatId} onChange={(e) => setInv({ ...inv, vatId: e.target.value })} maxLength={40} placeholder={t("invoiceVat")} aria-label={t("invoiceVat")} className="h-[44px] rounded-8 border border-[#E6E6E6] px-10 text-16 outline-none focus:border-[#5EA8F5]" />
					</div>
					<div className="mt-20 flex justify-end gap-12">
						<button type="button" onClick={() => setInvoiceOpen(false)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" disabled={busy === "invoice"} className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80 disabled:opacity-60">{busy === "invoice" ? "…" : t("invoiceSend")}</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
