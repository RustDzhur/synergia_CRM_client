"use client";
import React, { useState } from "react";
import { useLocale } from "next-intl";
import { MdContentCopy } from "react-icons/md";
import { tx } from "@/app/content/i18n";
import { REFERRAL } from "@/app/content/footerPages";
import PageShell from "../PageShell";

// Referral program: как это работает и ссылка для копирования (ссылка на сайт с языком посетителя)
export default function Referral() {
	const locale = useLocale();
	const [copied, setCopied] = useState(false);
	const link = typeof window === "undefined" ? "" : `${window.location.origin}/${locale}?ref=friend`;

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch { /* буфер обмена недоступен — ссылку можно выделить вручную */ }
	}

	return (
		<PageShell title={tx(REFERRAL.title, locale)} intro={tx(REFERRAL.intro, locale)}>
			<h2 className="mb-20 text-24 font-medium text-discover">{tx(REFERRAL.stepsTitle, locale)}</h2>
			<ol className="mb-[50px] grid gap-20 md:grid-cols-3">
				{REFERRAL.steps.map((s, i) => (
					<li key={i} className="rounded-16 bg-gray p-24 shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
						<span className="mb-12 flex h-[44px] w-[44px] items-center justify-center rounded-[50%] bg-authBtn text-20 font-medium text-white">{i + 1}</span>
						<h3 className="mb-8 text-20 font-medium tracking-[0.4px] text-discover">{tx(s.title, locale)}</h3>
						<p className="text-14 lg:text-16 leading-[1.6] text-[#666666]">{tx(s.text, locale)}</p>
					</li>
				))}
			</ol>
			<label className="mb-8 block text-16 font-medium text-discover">{tx(REFERRAL.linkLabel, locale)}</label>
			<div className="flex max-w-[640px] gap-8">
				<input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={tx(REFERRAL.linkLabel, locale)} className="h-[50px] min-w-0 flex-1 rounded-4 border-2 border-[#999999] bg-white px-12 text-16 text-[#4D4D4D] outline-none" />
				<button type="button" onClick={copy} className="flex h-[50px] items-center gap-8 rounded-4 bg-authBtn px-20 text-16 font-medium text-white transition-opacity hover:opacity-80">
					<MdContentCopy size={20} />
					{tx(copied ? REFERRAL.copied : REFERRAL.copy, locale)}
				</button>
			</div>
			<p className="mt-16 max-w-[640px] text-14 text-[#999999]">{tx(REFERRAL.note, locale)}</p>
		</PageShell>
	);
}
