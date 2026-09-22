"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { apiCall } from "@/app/store/crmApi";

interface QuoteRow { id: string; number: string; status: string; customerName: string; currency: string; totals: { gross: number } }

const STATUS_COLOR: Record<string, string> = { draft: "#B3B3B3", sent: "#5EA8F5", accepted: "#0A8A2E", declined: "#EB5757", expired: "#999999" };

// Предложения (Quotes), связанные с этой сделкой (Opportunity → Quote, ТЗ Phase 2) — показываются прямо на карточке
// сделки, а не только в разделе Finance. "Create Quote" переносит клиента/контакт/компанию сделки в новое предложение.
export default function DealQuotes({ dealId, customerName, contact, company }: { dealId: string; customerName: string; contact?: string; company?: string }) {
	const t = useTranslations("crm");
	const router = useRouter();
	const locale = useLocale();
	const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);

	useEffect(() => {
		apiCall<QuoteRow[]>(`/api/quotes?deal=${dealId}`).then((r) => r.ok && r.data && setQuotes(r.data));
	}, [dealId]);

	function createQuote() {
		const params = new URLSearchParams({ tab: "quotes", newFromDeal: dealId, customerName: customerName || "" });
		if (contact) params.set("contact", contact);
		if (company) params.set("company", company);
		router.push(`/${locale}/crm/inventory?${params.toString()}`);
	}

	return (
		<section className="overflow-hidden rounded-16 bg-white shadow-custom">
			<header className="flex items-center justify-between border-b border-[#EFEFEF] px-20 py-16">
				<h3 className="text-16 font-semibold text-black">{t("dealQuotes")}</h3>
				<button type="button" onClick={createQuote} className="text-16 text-primaryColor transition-colors hover:opacity-80">
					{t("dealCreateQuote")}
				</button>
			</header>
			<div className="p-20">
				{!quotes || quotes.length === 0 ? (
					<p className="text-16 text-[#999999]">{t("dealNoQuotes")}</p>
				) : (
					<ul className="flex flex-col gap-10">
						{quotes.map((q) => (
							<li key={q.id} className="flex items-center justify-between gap-10 text-16">
								<span className="flex items-center gap-8 text-[#333333]">
									{q.number}
									<span className="rounded-4 px-6 py-2 text-12 font-medium text-white" style={{ background: STATUS_COLOR[q.status] }}>{q.status}</span>
								</span>
								<span className="font-medium text-[#4D4D4D]">{q.totals.gross.toFixed(2)} {q.currency}</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
