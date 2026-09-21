"use client";
import React from "react";
import { useLocale } from "next-intl";
import { AiFillCheckCircle } from "react-icons/ai";
import { MdWorkOutline } from "react-icons/md";
import { tx } from "@/app/content/i18n";
import { CAREERS } from "@/app/content/footerPages";
import PageShell from "../PageShell";

export default function Careers() {
	const locale = useLocale();
	return (
		<PageShell title={tx(CAREERS.title, locale)} intro={tx(CAREERS.intro, locale)}>
			<h2 className="mb-16 text-24 font-medium text-discover">{tx(CAREERS.perksTitle, locale)}</h2>
			<ul className="mb-[50px] grid gap-12 md:grid-cols-2">
				{CAREERS.perks.map((p, i) => (
					<li key={i} className="flex items-center gap-10 text-16 lg:text-18 tracking-[0.4px] text-discover">
						<AiFillCheckCircle size={22} className="shrink-0 text-discover" />
						{tx(p, locale)}
					</li>
				))}
			</ul>
			<h2 className="mb-16 text-24 font-medium text-discover">{tx(CAREERS.openTitle, locale)}</h2>
			<ul className="space-y-12">
				{CAREERS.positions.map((p, i) => (
					<li key={i} className="flex flex-col gap-12 rounded-16 bg-gray p-20 md:flex-row md:items-center md:justify-between">
						<div className="flex items-center gap-12">
							<MdWorkOutline size={26} className="shrink-0 text-authBtn" />
							<div>
								<p className="text-18 font-medium tracking-[0.4px] text-discover">{tx(p.title, locale)}</p>
								<p className="text-14 text-[#999999]">{tx(p.meta, locale)}</p>
							</div>
						</div>
						<a href={`mailto:hello@firmspace.example?subject=${encodeURIComponent(tx(p.title, "en"))}`} className="self-start rounded-4 bg-authBtn px-24 py-10 text-16 font-medium text-white transition-opacity hover:opacity-80 md:self-auto">
							{tx(CAREERS.apply, locale)}
						</a>
					</li>
				))}
			</ul>
		</PageShell>
	);
}
