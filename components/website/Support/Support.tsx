"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { MdExpandMore } from "react-icons/md";
import { tx } from "@/content/i18n";
import { SUPPORT } from "@/content/footerPages";
import { applyPrices } from "@/lib/currency";
import { withLocale } from "@/utils/locale";
import Collapse from "@/utils/Collapse";
import PageShell from "../PageShell";

// Support / FAQ: вопросы раскрываются по нажатию (плавно, по одному).
// Цены в ответах приходят картой с сервера ([[price.standard]] → «900 ₴ (≈ €20)»): числа зависят
// от локали и курса, поэтому в текстах их держать нельзя.
export default function Support({ prices }: { prices?: Record<string, string> }) {
	const locale = useLocale();
	const [open, setOpen] = useState<number | null>(0);
	return (
		<PageShell title={tx(SUPPORT.title, locale)} intro={tx(SUPPORT.intro, locale)}>
			<ul className="mb-30 max-w-[900px] space-y-12">
				{SUPPORT.faq.map((item, i) => (
					<li key={i} className="overflow-hidden rounded-16 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)]">
						<button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-16 px-20 py-16 text-left text-16 lg:text-18 font-medium tracking-[0.3px] text-[#f1f4ee]">
							{tx(item.q, locale)}
							<MdExpandMore size={26} className={`shrink-0 text-authBtn transition-transform duration-300 ${open === i ? "rotate-180" : ""}`} />
						</button>
						<Collapse open={open === i}>
							<p className="px-20 pb-20 text-16 leading-[1.7] tracking-[0.3px] text-[#8c948b]">{applyPrices(tx(item.a, locale), prices)}</p>
						</Collapse>
					</li>
				))}
			</ul>
			<Link href={withLocale(locale, "/contacts")} className="inline-block rounded-4 bg-authBtn px-[30px] py-[12px] text-18 font-medium text-[#0A0A0A] transition-opacity hover:opacity-80">{tx(SUPPORT.contactCta, locale)}</Link>
		</PageShell>
	);
}
