"use client";
import React from "react";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { TERMS } from "@/app/content/footerPages";
import PageShell from "../PageShell";

// Шаблон AGB/условий обслуживания с плейсхолдерами — разделы про оплату/отмену/ответственность нарочно помечены
// как требующие юридической проверки для конкретной страны, а не выдуманы как готовый юридический текст.
export default function Terms() {
	const locale = useLocale();
	return (
		<PageShell title={tx(TERMS.title, locale)}>
			<div className="-mt-10 mb-20 max-w-[820px] rounded-8 border border-[#F4A100] bg-[#FFF6EA] p-16 text-14 leading-[1.6] text-[#8A5A1F]">
				{tx(TERMS.placeholderNote, locale)}
			</div>
			<p className="mb-30 text-14 text-[#999999]">{tx(TERMS.updated, locale)}</p>
			<div className="max-w-[820px]">
				{TERMS.sections.map((s, i) => (
					<section key={i} className="mb-30">
						<h2 className="mb-8 text-20 lg:text-24 font-medium text-discover">{tx(s.title, locale)}</h2>
						<p className="whitespace-pre-line text-16 lg:text-18 leading-[1.7] tracking-[0.3px] text-[#4D4D4D]">{tx(s.text, locale)}</p>
					</section>
				))}
			</div>
		</PageShell>
	);
}
