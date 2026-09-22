"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { FaFacebook } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import type { AdsConnectionDTO, AdsPlatform } from "@/lib/ads/types";
import { AdsItem, useAdsStore } from "@/app/store/useAdsStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import SpendChart from "./SpendChart";
import { count, money, totals } from "./adsFormat";

const PLATFORMS: { id: AdsPlatform; icon: React.ReactNode }[] = [
	{ id: "google", icon: <FcGoogle size={34} /> },
	{ id: "meta", icon: <FaFacebook size={34} color="#1877F2" /> },
];

export function Kpi({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-8 bg-[#F5F7FC] px-16 py-10">
			<p className="truncate text-14 text-[#999999]">{label}</p>
			<p className="truncate text-20 font-medium text-[#4D4D4D]">{value}</p>
		</div>
	);
}

function Connection({ c, available, planOk, onChoose, onDisconnect, onConnect }: { c: AdsConnectionDTO | undefined; available: boolean; planOk: boolean; platform: AdsPlatform; onChoose: (id: string, account: string) => void; onDisconnect: (c: AdsConnectionDTO) => void; onConnect: () => void }) {
	const t = useTranslations("ads");
	const locale = useLocale();
	const expired = !!c && c.expiresAt > 0 && c.expiresAt < Date.now();
	return (
		<div className="flex flex-col gap-10 rounded-16 border border-[#F0F0F0] bg-white p-20 shadow-[0_2px_8px_rgba(0,0,0,0.16)]">
			{c && (
				<>
					<p className={`text-14 ${c.status === "error" || expired ? "text-danger" : "text-[#009A2B]"}`}>
						{c.status === "error" ? c.error : expired ? t("expired") : c.expiresAt > 0 ? t("validUntil", { date: new Date(c.expiresAt).toLocaleDateString(locale) }) : t("connected")}
					</p>
					<label className="flex flex-col gap-[4px] text-14 text-[#999999]">
						{t("account")}
						<select
							value={c.accountId}
							onChange={(e) => onChoose(c.id, e.target.value)}
							className="h-[42px] rounded-8 border border-[#E6E6E6] bg-white px-10 text-16 text-[#4D4D4D] outline-none focus:border-[#5EA8F5]">
							{!c.accountId && <option value="">{t("chooseAccount")}</option>}
							{c.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {a.currency && `(${a.currency})`}</option>)}
						</select>
					</label>
				</>
			)}
			{!c && !planOk && <p className="text-14 text-[#F4A100]">{t("needsUpgrade")}</p>}
			{!c && planOk && !available && <p className="text-14 text-[#999999]">{t("notConfigured")}</p>}
			<div className="flex gap-10">
				<button type="button" disabled={!available || !planOk} onClick={onConnect} className="rounded-8 bg-primaryColor px-16 py-8 text-16 font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-[0.4]">
					{c ? t("reconnect") : t("connect")}
				</button>
				{c && <button type="button" onClick={() => onDisconnect(c)} className="rounded-8 border border-[#E6E6E6] px-16 py-8 text-16 text-[#666666] transition-colors hover:bg-gray">{t("disconnect")}</button>}
			</div>
		</div>
	);
}

export function ItemStats({ item, locale, compact = false }: { item: AdsItem; locale: string; compact?: boolean }) {
	const t = useTranslations("ads");
	if (item.error) return <p className="rounded-8 bg-[#FFF3F3] p-16 text-16 text-danger">{item.error}</p>;
	if (!item.data) return null;
	const sum = totals(item.data.days);
	const cur = item.data.currency;
	return (
		<>
			<div className={`grid gap-10 ${compact ? "grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"}`}>
				<Kpi label={t("spend")} value={money(sum.spend, cur, locale)} />
				<Kpi label={t("clicks")} value={count(sum.clicks, locale)} />
				<Kpi label={t("impressions")} value={count(sum.impressions, locale)} />
				<Kpi label={t("conversions")} value={count(sum.conversions, locale)} />
				<Kpi label={t("ctr")} value={`${count(sum.ctr, locale)}%`} />
				<Kpi label={t("cpc")} value={money(sum.cpc, cur, locale)} />
			</div>
			<div className="mt-16">
				<SpendChart days={item.data.days} currency={cur} label={t("spend")} />
			</div>
		</>
	);
}

// Вкладка Marketing → Ad performance: подключение Google Ads / Meta Ads, выбор рекламного аккаунта, статистика и кампании
export default function AdsPanel() {
	const t = useTranslations("ads");
	const locale = useLocale();
	const { status, items, days, loading, loadStatus, loadInsights, connect, choose, disconnect } = useAdsStore();
	const [toRemove, setToRemove] = useState<AdsConnectionDTO | null>(null);

	useEffect(() => {
		loadStatus();
		loadInsights();
		// возврат со страницы входа: ?ads=connected|denied|error
		const q = new URLSearchParams(window.location.search);
		const result = q.get("ads");
		if (result) {
			if (result === "connected") toast.success(t("connectedOk"));
			else toast.error(result === "denied" ? t("denied") : q.get("message") || t("failed"));
			window.history.replaceState(null, "", window.location.pathname);
		}
	}, [loadStatus, loadInsights, t]);

	async function onConnect(platform: AdsPlatform) {
		const error = await connect(platform, locale);
		if (error) toast.error(error);
	}
	async function onChoose(id: string, accountId: string) {
		const error = await choose(id, accountId);
		if (error) toast.error(error);
	}

	return (
		<section className="flex flex-col gap-30">
			<div>
				<h1 className="mb-20 text-24 font-normal text-[#666666] lg:text-32">{t("platforms")}</h1>
				<div className="grid gap-20 md:grid-cols-2">
					{PLATFORMS.map((p) => {
						const c = status?.connections.find((x) => x.platform === p.id);
						return (
							<div key={p.id}>
								<p className="mb-10 flex items-center gap-12 text-18 font-medium text-[#4D4D4D]">{p.icon}{t(p.id)}</p>
								<Connection c={c} platform={p.id} available={!!status?.available[p.id]} planOk={status ? status.planOk : true} onChoose={onChoose} onDisconnect={setToRemove} onConnect={() => onConnect(p.id)} />
							</div>
						);
					})}
				</div>
			</div>

			{items.length > 0 && (
				<div>
					<div className="mb-20 flex flex-wrap items-center justify-between gap-12">
						<h2 className="text-24 font-normal text-[#666666] lg:text-32">{t("performance")}</h2>
						<select value={days} onChange={(e) => loadInsights(Number(e.target.value))} aria-label={t("period")} className="h-[42px] rounded-8 border border-[#E6E6E6] bg-white px-10 text-16 text-[#4D4D4D] outline-none focus:border-[#5EA8F5]">
							{[7, 30, 90].map((d) => <option key={d} value={d}>{t("lastDays", { n: d })}</option>)}
						</select>
					</div>
					<div className={`flex flex-col gap-30 ${loading ? "opacity-[0.6]" : ""}`}>
						{items.map((it) => (
							<div key={it.connection.id} className="rounded-16 border border-[#F0F0F0] bg-white p-20 shadow-[0_2px_8px_rgba(0,0,0,0.16)]">
								<h3 className="mb-16 text-20 font-medium text-[#4D4D4D]">{t(it.connection.platform)} · {it.connection.accounts.find((a) => a.id === it.connection.accountId)?.name}</h3>
								<ItemStats item={it} locale={locale} />
								{it.data && (
									<div className="mt-20 overflow-x-auto">
										<table className="w-full min-w-[520px] text-left text-16">
											<thead>
												<tr className="text-14 text-[#999999]">
													<th className="py-8 pr-12 font-normal">{t("campaign")}</th>
													<th className="py-8 pr-12 font-normal">{t("status")}</th>
													<th className="py-8 pr-12 text-right font-normal">{t("spend")}</th>
													<th className="py-8 pr-12 text-right font-normal">{t("clicks")}</th>
													<th className="py-8 text-right font-normal">{t("conversions")}</th>
												</tr>
											</thead>
											<tbody>
												{it.data.campaigns.map((c) => (
													<tr key={c.id} className="border-t border-[#F0F0F0] text-[#4D4D4D]">
														<td className="max-w-[240px] truncate py-10 pr-12">{c.name}</td>
														<td className="py-10 pr-12 text-[#999999]">{c.status}</td>
														<td className="py-10 pr-12 text-right">{money(c.spend, it.data!.currency, locale)}</td>
														<td className="py-10 pr-12 text-right">{count(c.clicks, locale)}</td>
														<td className="py-10 text-right">{count(c.conversions, locale)}</td>
													</tr>
												))}
												{it.data.campaigns.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-[#999999]">{t("noData")}</td></tr>}
											</tbody>
										</table>
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			<ConfirmDialog
				open={!!toRemove}
				title={t("disconnect")}
				text={t("confirmDisconnect", { name: toRemove ? t(toRemove.platform) : "" })}
				onCancel={() => setToRemove(null)}
				onConfirm={() => { if (toRemove) disconnect(toRemove.id); setToRemove(null); }}
			/>
		</section>
	);
}
