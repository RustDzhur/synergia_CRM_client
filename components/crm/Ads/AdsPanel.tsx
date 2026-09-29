"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { FaFacebook } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import type { AdsConnectionDTO, AdsPlatform } from "@/lib/ads/types";
import { AdsItem, useAdsStore } from "@/store/useAdsStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import SpendChart from "./SpendChart";
import { count, money, totals } from "./adsFormat";

const PLATFORMS: { id: AdsPlatform; icon: React.ReactNode }[] = [
	{ id: "google", icon: <FcGoogle size={34} /> },
	{ id: "meta", icon: <FaFacebook size={34} color="#1877F2" /> },
];

export function Kpi({ label, value }: { label: string; value: string }) {
	return (
		<div className="fs-card min-w-0 px-14 py-10">
			<p className="truncate text-11 text-[#8c948b]">{label}</p>
			<p className="truncate text-16 font-semibold text-[#f1f4ee]">{value}</p>
		</div>
	);
}

function Connection({ c, available, planOk, onChoose, onDisconnect, onConnect }: { c: AdsConnectionDTO | undefined; available: boolean; planOk: boolean; platform: AdsPlatform; onChoose: (id: string, account: string) => void; onDisconnect: (c: AdsConnectionDTO) => void; onConnect: () => void }) {
	const t = useTranslations("ads");
	const locale = useLocale();
	const expired = !!c && c.expiresAt > 0 && c.expiresAt < Date.now();
	return (
		<div className="fs-card flex flex-col gap-10 p-16">
			{c && (
				<>
					<p className={`text-12 ${c.status === "error" || expired ? "text-danger" : "text-[#2DDEB6]"}`}>
						{c.status === "error" ? c.error : expired ? t("expired") : c.expiresAt > 0 ? t("validUntil", { date: new Date(c.expiresAt).toLocaleDateString(locale) }) : t("connected")}
					</p>
					<label className="flex flex-col gap-[4px] text-12 text-[#8c948b]">
						{t("account")}
						<select
							value={c.accountId}
							onChange={(e) => onChoose(c.id, e.target.value)}
							className="fs-field h-40 px-12 text-13 outline-none">
							{!c.accountId && <option value="">{t("chooseAccount")}</option>}
							{c.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {a.currency && `(${a.currency})`}</option>)}
						</select>
					</label>
				</>
			)}
			{!c && !planOk && <p className="text-12 text-[#F4A100]">{t("needsUpgrade")}</p>}
			{!c && planOk && !available && <p className="text-12 text-[#8c948b]">{t("notConfigured")}</p>}
			<div className="flex gap-10">
				<button type="button" disabled={!available || !planOk} onClick={onConnect} className="fs-btn fs-btn-primary h-36 disabled:cursor-default disabled:opacity-40">
					{c ? t("reconnect") : t("connect")}
				</button>
				{c && <button type="button" onClick={() => onDisconnect(c)} className="fs-btn fs-btn-ghost h-36">{t("disconnect")}</button>}
			</div>
		</div>
	);
}

export function ItemStats({ item, locale, compact = false }: { item: AdsItem; locale: string; compact?: boolean }) {
	const t = useTranslations("ads");
	if (item.error) return <p className="rounded-10 bg-[rgba(235,87,87,0.08)] p-14 text-13 text-danger">{item.error}</p>;
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
		if (!error) return;
		// «Не на вашем тарифе» — свой текст: сервер не знает языка интерфейса
		toast.error(error.code === "plan_limit" ? t("needsUpgrade") : error.message);
	}
	async function onChoose(id: string, accountId: string) {
		const error = await choose(id, accountId);
		if (error) toast.error(error);
	}

	return (
		<section className="flex flex-col gap-24">
			<div>
				<h1 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("platforms")}</h1>
				<div className="grid gap-16 md:grid-cols-2">
					{PLATFORMS.map((p) => {
						const c = status?.connections.find((x) => x.platform === p.id);
						return (
							<div key={p.id}>
								<p className="mb-10 flex items-center gap-10 text-14 font-medium text-[#f1f4ee]">{p.icon}{t(p.id)}</p>
								<Connection c={c} platform={p.id} available={!!status?.available[p.id]} planOk={status ? status.planOk : true} onChoose={onChoose} onDisconnect={setToRemove} onConnect={() => onConnect(p.id)} />
							</div>
						);
					})}
				</div>
			</div>

			{items.length > 0 && (
				<div>
					<div className="mb-14 flex flex-wrap items-center justify-between gap-12">
						<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("performance")}</h2>
						<select value={days} onChange={(e) => loadInsights(Number(e.target.value))} aria-label={t("period")} className="fs-field h-40 px-12 text-13 outline-none">
							{[7, 30, 90].map((d) => <option key={d} value={d}>{t("lastDays", { n: d })}</option>)}
						</select>
					</div>
					<div className={`flex flex-col gap-16 ${loading ? "opacity-60" : ""}`}>
						{items.map((it) => (
							<div key={it.connection.id} className="fs-card p-16">
								<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t(it.connection.platform)} · {it.connection.accounts.find((a) => a.id === it.connection.accountId)?.name}</h3>
								<ItemStats item={it} locale={locale} />
								{it.data && (
									<div className="mt-16 overflow-x-auto">
										<table className="fs-table min-w-[520px]">
											<thead>
												<tr>
													<th className="py-8 pr-12">{t("campaign")}</th>
													<th className="py-8 pr-12">{t("status")}</th>
													<th className="py-8 pr-12 text-right">{t("spend")}</th>
													<th className="py-8 pr-12 text-right">{t("clicks")}</th>
													<th className="py-8 text-right">{t("conversions")}</th>
												</tr>
											</thead>
											<tbody>
												{it.data.campaigns.map((c) => (
													<tr key={c.id}>
														<td className="max-w-[240px] truncate py-10 pr-12 text-13">{c.name}</td>
														<td className="py-10 pr-12 text-13 text-[#8c948b]">{c.status}</td>
														<td className="py-10 pr-12 text-right text-13">{money(c.spend, it.data!.currency, locale)}</td>
														<td className="py-10 pr-12 text-right text-13">{count(c.clicks, locale)}</td>
														<td className="py-10 text-right text-13">{count(c.conversions, locale)}</td>
													</tr>
												))}
												{it.data.campaigns.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-13 text-[#8c948b]">{t("noData")}</td></tr>}
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
