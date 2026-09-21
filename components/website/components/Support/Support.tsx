"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { MdExpandMore } from "react-icons/md";
import { tx } from "@/app/content/i18n";
import { SUPPORT } from "@/app/content/footerPages";
import { withLocale } from "@/app/utils/locale";
import Collapse from "@/app/utils/Collapse";
import PageShell from "../PageShell";

// Support / FAQ: вопросы раскрываются по нажатию (плавно, по одному)
export default function Support() {
	const locale = useLocale();
	const [open, setOpen] = useState<number | null>(0);
	return (
		<PageShell title={tx(SUPPORT.title, locale)} intro={tx(SUPPORT.intro, locale)}>
			<ul className="mb-30 max-w-[900px] space-y-12">
				{SUPPORT.faq.map((item, i) => (
					<li key={i} className="overflow-hidden rounded-16 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.12)]">
						<button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-16 px-20 py-16 text-left text-16 lg:text-18 font-medium tracking-[0.3px] text-discover">
							{tx(item.q, locale)}
							<MdExpandMore size={26} className={`shrink-0 text-authBtn transition-transform duration-300 ${open === i ? "rotate-180" : ""}`} />
						</button>
						<Collapse open={open === i}>
							<p className="px-20 pb-20 text-16 leading-[1.7] tracking-[0.3px] text-[#666666]">{tx(item.a, locale)}</p>
						</Collapse>
					</li>
				))}
			</ul>
			<Link href={withLocale(locale, "/contacts")} className="inline-block rounded-4 bg-authBtn px-[30px] py-[12px] text-18 font-medium text-white transition-opacity hover:opacity-80">{tx(SUPPORT.contactCta, locale)}</Link>
		</PageShell>
	);
}
