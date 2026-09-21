"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAdsStore } from "@/app/store/useAdsStore";
import { ItemStats } from "../Ads/AdsPanel";

// Карточка «Advertising» на Dashboard: расход, клики и конверсии по подключённой рекламной платформе за 30 дней.
// Пока ничего не подключено — приглашение подключить Google Ads или Meta Ads (Marketing → Ad performance).
export default function AdsCard() {
	const t = useTranslations("ads");
	const locale = useLocale();
	const { items, loadInsights } = useAdsStore();
	const [index, setIndex] = useState(0);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		loadInsights(30).then(() => setReady(true));
	}, [loadInsights]);

	if (!ready) return null;
	const item = items[Math.min(index, items.length - 1)];

	return (
		<section className="rounded-16 border border-[#F0F0F0] bg-white p-20 shadow-[0_2px_8px_rgba(0,0,0,0.16)] lg:p-25">
			<header className="flex flex-wrap items-center justify-between gap-12">
				<h2 className="shrink-0 text-20 font-medium text-[#4D4D4D] lg:text-24">{t("title")}</h2>
				<Link href={`/${locale}/crm/marketing`} className="text-16 font-medium text-primaryColor transition-opacity hover:opacity-80">{item ? t("details") : t("connectCta")}</Link>
			</header>
			{!item ? (
				<p className="mt-16 text-16 text-[#999999]">{t("none")}</p>
			) : (
				<>
					{items.length > 1 && (
						<div className="mt-12 flex gap-8">
							{items.map((it, i) => (
								<button key={it.connection.id} type="button" onClick={() => setIndex(i)} aria-pressed={i === index} className={`rounded-8 px-12 py-[4px] text-14 transition-colors ${i === index ? "bg-primaryColor text-white" : "bg-[#F5F7FC] text-[#666666] hover:bg-gray"}`}>
									{t(it.connection.platform)}
								</button>
							))}
						</div>
					)}
					<p className="mb-12 mt-12 text-14 text-[#999999]">{t("lastDays", { n: 30 })}</p>
					<ItemStats item={item} locale={locale} compact />
				</>
			)}
		</section>
	);
}
