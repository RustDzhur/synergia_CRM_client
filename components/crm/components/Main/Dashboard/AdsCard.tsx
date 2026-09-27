"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAdsStore } from "@/app/store/useAdsStore";
import { useFeature, useOrgStore } from "@/app/store/useOrgStore";
import { ItemStats } from "../Ads/AdsPanel";

// Карточка «Advertising» на Dashboard: расход, клики и конверсии по подключённой рекламной платформе за 30 дней.
// Пока ничего не подключено — приглашение подключить Google Ads или Meta Ads (Marketing → Ad performance).
export default function AdsCard() {
	const t = useTranslations("ads");
	const locale = useLocale();
	const enabled = useFeature("ads");
	// пока список фирм не загружен, неизвестно, входит ли реклама в тариф — запрос не отправляем
	const planLoaded = useOrgStore((s) => s.loaded);
	const { items, loadInsights } = useAdsStore();
	const [index, setIndex] = useState(0);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (planLoaded && enabled) loadInsights(30).then(() => setReady(true));
	}, [planLoaded, enabled, loadInsights]);
	// реклама не входит в тариф фирмы — карточки на дашборде нет (раздела всё равно нет в меню)
	if (!planLoaded || !enabled) return null;

	if (!ready) return null;
	const item = items[Math.min(index, items.length - 1)];

	return (
		<section className="fs-card p-16 md:p-20">
			<header className="flex flex-wrap items-center justify-between gap-12">
				<h2 className="shrink-0 text-14 font-semibold text-[#f1f4ee]">{t("title")}</h2>
				<Link href={`/${locale}/crm/marketing`} className="text-12 font-semibold text-[#c6ff4d] transition-opacity hover:opacity-80">{item ? t("details") : t("connectCta")}</Link>
			</header>
			{!item ? (
				<p className="mt-14 text-13 text-[#8c948b]">{t("none")}</p>
			) : (
				<>
					{items.length > 1 && (
						<div className="mt-12 flex gap-8">
							{items.map((it, i) => (
								<button key={it.connection.id} type="button" onClick={() => setIndex(i)} aria-pressed={i === index} className={`rounded-50 border px-12 py-[4px] text-12 transition-colors ${i === index ? "border-[#c6ff4d] bg-[#c6ff4d] text-[#0a0c0b]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
									{t(it.connection.platform)}
								</button>
							))}
						</div>
					)}
					<p className="mb-10 mt-10 text-12 text-[#8c948b]">{t("lastDays", { n: 30 })}</p>
					<ItemStats item={item} locale={locale} compact />
				</>
			)}
		</section>
	);
}
