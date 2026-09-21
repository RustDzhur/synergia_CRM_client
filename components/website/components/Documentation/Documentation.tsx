"use client";
import React from "react";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { DOCS } from "@/app/content/footerPages";
import PageShell from "../PageShell";

// Documentation: слева оглавление (ссылки-якоря), справа разделы с пронумерованными шагами
export default function Documentation() {
	const locale = useLocale();
	return (
		<PageShell title={tx(DOCS.title, locale)} intro={tx(DOCS.intro, locale)}>
			<div className="flex flex-col gap-30 lg:flex-row lg:gap-[60px]">
				<nav aria-label={tx(DOCS.title, locale)} className="lg:sticky lg:top-[20px] lg:w-[260px] lg:shrink-0 lg:self-start">
					<ul className="rounded-16 bg-gray p-16 space-y-4">
						{DOCS.sections.map((s) => (
							<li key={s.id}>
								<a href={`#${s.id}`} className="block rounded-8 px-12 py-8 text-16 tracking-[0.3px] text-discover transition-colors hover:bg-white hover:text-authBtn">{tx(s.title, locale)}</a>
							</li>
						))}
					</ul>
				</nav>
				<div className="min-w-0 flex-1">
					{DOCS.sections.map((s) => (
						<section key={s.id} id={s.id} className="mb-[50px] scroll-mt-[20px]">
							<h2 className="mb-16 text-24 font-medium text-discover">{tx(s.title, locale)}</h2>
							<ol className="space-y-12">
								{s.steps.map((step, i) => (
									<li key={i} className="flex gap-12 text-16 lg:text-18 leading-[1.7] tracking-[0.3px] text-discover">
										<span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[50%] bg-authBtn text-14 font-medium text-white">{i + 1}</span>
										<span>{tx(step, locale)}</span>
									</li>
								))}
							</ol>
						</section>
					))}
				</div>
			</div>
		</PageShell>
	);
}
