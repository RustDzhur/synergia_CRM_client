"use client";
import React from "react";
import { useLocale } from "next-intl";
import type { IconType } from "react-icons";
import { MdCampaign, MdOutlineIntegrationInstructions, MdSupportAgent, MdTimeline } from "react-icons/md";
import { TbChartHistogram, TbDatabaseCog } from "react-icons/tb";
import { tx } from "@/app/content/i18n";
import { SERVICES } from "@/app/content/sitePages";
import PageShell from "../PageShell";

const ICONS: Record<string, IconType> = {
	data: TbDatabaseCog,
	sales: TbChartHistogram,
	support: MdSupportAgent,
	marketing: MdCampaign,
	analytics: MdTimeline,
	integration: MdOutlineIntegrationInstructions,
};

// Our Services: шесть карточек 400×349 (десктоп), две колонки на планшете, одна на телефоне
export default function ServicesPage() {
	const locale = useLocale();
	return (
		<PageShell title={tx(SERVICES.title, locale)}>
			<ul className="grid gap-20 md:grid-cols-2 lg:grid-cols-3">
				{SERVICES.items.map((item) => {
					const Icon = ICONS[item.key];
					return (
						<li key={item.key} className="flex sm:min-h-[242px] lg:min-h-[349px] flex-col items-center justify-center rounded-16 bg-gray px-24 py-30 text-center shadow-[0_2px_4px_rgba(0,0,0,0.12)] transition-transform duration-200 hover:-translate-y-[4px]">
							<Icon className="mb-16 text-[64px] lg:text-[80px] text-authBtn" aria-hidden />
							<h2 className="text-18 lg:text-20 font-medium tracking-[0.4px] text-[#8E939C] mb-8">{tx(item.title, locale)}</h2>
							<p className="text-14 lg:text-16 leading-[1.6] tracking-[0.3px] text-[#999999] max-w-[300px]">{tx(item.text, locale)}</p>
						</li>
					);
				})}
			</ul>
		</PageShell>
	);
}
