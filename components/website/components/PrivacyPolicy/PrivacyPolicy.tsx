"use client";
import "react";
import { useLocale } from "next-intl";
import { tx } from "@/content/i18n";
import { PRIVACY } from "@/content/footerPages";
import PageShell from "../PageShell";

export default function PrivacyPolicy() {
	const locale = useLocale();
	return (
		<PageShell title={tx(PRIVACY.title, locale)}>
			<p className="-mt-10 mb-30 text-14 text-[#999999]">{tx(PRIVACY.updated, locale)}</p>
			<div className="max-w-[820px]">
				{PRIVACY.sections.map((s, i) => (
					<section key={i} className="mb-30">
						<h2 className="mb-8 text-20 lg:text-24 font-medium text-[#f1f4ee]">{tx(s.title, locale)}</h2>
						<p className="text-16 lg:text-18 leading-[1.7] tracking-[0.3px] text-[#8c948b]">{tx(s.text, locale)}</p>
					</section>
				))}
			</div>
		</PageShell>
	);
}
