"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { TbBuildingBank, TbReceipt, TbSettings, TbTruckDelivery } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import { MARKET_DEFAULTS, profile, type Market } from "@/lib/finance/market";
import FinanceSettingsTab from "./Settings";

// Экран «Выберите страну»: пока страна фирмы не выбрана, режим рынка неизвестен, поэтому раздел не
// показывает ни одной вкладки (ни немецкой, ни украинской) — только этот выбор и настройки (ТЗ §1.3).
// Выбор сразу применяет набор по умолчанию: валюта, префиксы, срок оплаты, шаблон (MERKET_DEFAULTS).

const CARDS: Array<{ market: Market; icon: typeof TbBuildingBank; bulletKeys: string[] }> = [
	{ market: "DE", icon: TbBuildingBank, bulletKeys: ["market_de_1", "market_de_2", "market_de_3"] },
	{ market: "UA", icon: TbTruckDelivery, bulletKeys: ["market_ua_1", "market_ua_2", "market_ua_3"] },
];

export default function CountryPicker({ onOpenSettings, settingsOpen }: { onOpenSettings: () => void; settingsOpen: boolean }) {
	const t = useTranslations("finance");
	const saveSettings = useFinanceStore((s) => s.saveSettings);
	const [busy, setBusy] = useState<Market | null>(null);
	const [error, setError] = useState("");

	async function choose(market: Market) {
		setBusy(market);
		setError("");
		const d = MARKET_DEFAULTS[market];
		const err = await saveSettings({
			country: market,
			currency: d.currency,
			invoicePrefix: d.invoicePrefix,
			quotePrefix: d.quotePrefix,
			creditNotePrefix: d.creditNotePrefix,
			deliveryNotePrefix: d.deliveryNotePrefix,
			actPrefix: d.actPrefix,
			paymentTermsDays: d.paymentTermsDays,
			smallBusiness: d.smallBusiness,
			uaVatPayer: d.uaVatPayer,
		} as never);
		setBusy(null);
		if (err) setError(err);
	}

	if (settingsOpen) {
		return (
			<div className="max-w-[720px]">
				<button type="button" onClick={() => window.location.reload()} className="fs-btn fs-btn-ghost mb-12">
					{t("market_back")}
				</button>
				<FinanceSettingsTab />
			</div>
		);
	}

	return (
		<div className="max-w-[720px]">
			<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("market_title")}</h2>
			<p className="mt-6 max-w-[560px] text-13 text-[#8c948b]">{t("market_hint")}</p>
			{error && <p className="mt-10 text-13 text-[#ff9f9f]">{error}</p>}

			<div className="mt-18 grid gap-12 md:grid-cols-2">
				{CARDS.map(({ market, icon: Icon, bulletKeys }) => {
					const p = profile(market);
					return (
						<div key={market} className="rounded-14 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-16">
							<div className="flex items-center gap-10">
								<Icon size={20} className="text-[#c6ff4d]" />
								<p className="text-15 font-semibold text-[#f1f4ee]">{t(`market_${market.toLowerCase()}`)}</p>
							</div>
							<ul className="mt-10 space-y-6 text-13 text-[#cfd4cb]">
								{bulletKeys.map((k) => (
									<li key={k} className="flex gap-8">
										<span className="text-[#c6ff4d]">·</span>
										<span>{t(k)}</span>
									</li>
								))}
								<li className="flex gap-8">
									<span className="text-[#c6ff4d]">·</span>
									<span>{t("market_defaults", { currency: p.currencyDefault, days: p.features.dunning ? 14 : 5 })}</span>
								</li>
							</ul>
							<button type="button" disabled={busy !== null} onClick={() => void choose(market)} className="fs-btn fs-btn-primary mt-14 w-full">
								{busy === market ? t("market_choosing") : t("market_choose")}
							</button>
						</div>
					);
				})}
			</div>

			<button type="button" onClick={onOpenSettings} className="fs-btn fs-btn-ghost mt-16">
				<TbSettings size={15} />
				{t("market_settings_first")}
			</button>
			<p className="mt-8 inline-flex items-center gap-6 text-12 text-[#8c948b]">
				<TbReceipt size={14} />
				{t("market_later_hint")}
			</p>
		</div>
	);
}
