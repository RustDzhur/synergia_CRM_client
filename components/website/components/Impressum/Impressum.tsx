"use client";
import React from "react";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { IMPRESSUM } from "@/app/content/footerPages";
import PageShell from "../PageShell";

// Шаблон Impressum (§5 TMG) с плейсхолдерами в квадратных скобках — реальные регистрационные данные компании
// нужно подставить перед реальным запуском на немецком рынке. Баннер сверху не даёт забыть об этом.
export default function Impressum() {
	const locale = useLocale();
	return (
		<PageShell title={tx(IMPRESSUM.title, locale)}>
			<div className="-mt-10 mb-30 max-w-[820px] rounded-8 border border-[#F4A100] bg-[#FFF6EA] p-16 text-14 leading-[1.6] text-[#8A5A1F]">
				{tx(IMPRESSUM.placeholderNote, locale)}
			</div>
			<div className="max-w-[820px]">
				{IMPRESSUM.sections.map((s, i) => (
					<section key={i} className="mb-30">
						<h2 className="mb-8 text-20 lg:text-24 font-medium text-discover">{tx(s.title, locale)}</h2>
						<p className="whitespace-pre-line text-16 lg:text-18 leading-[1.7] tracking-[0.3px] text-[#4D4D4D]">{tx(s.text, locale)}</p>
					</section>
				))}
			</div>
		</PageShell>
	);
}
