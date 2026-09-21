"use client";
import React from "react";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { TEAM } from "@/app/content/footerPages";
import PageShell from "../PageShell";

const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");

export default function Team() {
	const locale = useLocale();
	return (
		<PageShell title={tx(TEAM.title, locale)} intro={tx(TEAM.intro, locale)}>
			<ul className="grid gap-20 md:grid-cols-2 lg:grid-cols-3">
				{TEAM.members.map((m) => (
					<li key={m.name} className="rounded-16 bg-white p-24 text-center shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
						<div className="mx-auto mb-16 flex h-[90px] w-[90px] items-center justify-center rounded-[50%] bg-[linear-gradient(to_top_right,#FF008A,#768FE5)] text-32 font-medium text-white">{initials(m.name)}</div>
						<h2 className="text-20 font-medium tracking-[0.4px] text-discover">{m.name}</h2>
						<p className="mb-12 text-16 font-medium text-authBtn">{tx(m.role, locale)}</p>
						<p className="text-14 lg:text-16 leading-[1.6] tracking-[0.3px] text-[#666666]">{tx(m.bio, locale)}</p>
					</li>
				))}
			</ul>
		</PageShell>
	);
}
