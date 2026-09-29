"use client";
import "react";
import { useLocale } from "next-intl";
import type { IconType } from "react-icons";
import { MdCall, MdContactPage, MdEvent, MdForum, MdInventory2, MdMail, MdCampaign, MdBolt, MdViewKanban } from "react-icons/md";
import { tx } from "@/content/i18n";
import { FEATURES } from "@/content/footerPages";
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
						<li key={f.key} className="rounded-16 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-24">
							<div className="mb-16 flex h-[56px] w-[56px] items-center justify-center rounded-[50%] bg-[rgba(198,255,77,0.10)] text-[30px] text-[#c6ff4d]"><Icon aria-hidden /></div>
							<h2 className="mb-8 text-20 font-medium tracking-[0.4px] text-[#f1f4ee]">{tx(f.title, locale)}</h2>
							<p className="text-14 lg:text-16 leading-[1.6] tracking-[0.3px] text-[#8c948b]">{tx(f.text, locale)}</p>
						</li>
					);
				})}
			</ul>
		</PageShell>
	);
}
