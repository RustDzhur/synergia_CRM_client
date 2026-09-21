"use client";
import React from "react";
import { useLocale } from "next-intl";
import type { IconType } from "react-icons";
import { MdCall, MdContactPage, MdEvent, MdForum, MdInventory2, MdMail, MdCampaign, MdBolt, MdViewKanban } from "react-icons/md";
import { tx } from "@/app/content/i18n";
import { FEATURES } from "@/app/content/footerPages";
import PageShell from "../PageShell";

const ICONS: Record<string, IconType> = { deals: MdViewKanban, contacts: MdContactPage, tasks: MdEvent, inbox: MdForum, calls: MdCall, mail: MdMail, auto: MdBolt, marketing: MdCampaign, inventory: MdInventory2 };

export default function Features() {
	const locale = useLocale();
	return (
		<PageShell title={tx(FEATURES.title, locale)} intro={tx(FEATURES.intro, locale)}>
			<ul className="grid gap-20 md:grid-cols-2 lg:grid-cols-3">
				{FEATURES.items.map((f) => {
					const Icon = ICONS[f.key];
					return (
						<li key={f.key} className="rounded-16 bg-gray p-24 shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
							<div className="mb-16 flex h-[56px] w-[56px] items-center justify-center rounded-[50%] bg-white text-[30px] text-authBtn shadow-[0_2px_4px_rgba(0,0,0,0.12)]"><Icon aria-hidden /></div>
							<h2 className="mb-8 text-20 font-medium tracking-[0.4px] text-discover">{tx(f.title, locale)}</h2>
							<p className="text-14 lg:text-16 leading-[1.6] tracking-[0.3px] text-[#666666]">{tx(f.text, locale)}</p>
						</li>
					);
				})}
			</ul>
		</PageShell>
	);
}
