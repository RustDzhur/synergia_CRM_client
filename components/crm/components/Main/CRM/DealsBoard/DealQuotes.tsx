"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { apiCall } from "@/app/store/crmApi";

interface QuoteRow { id: string; number: string; status: string; customerName: string; currency: string; totals: { gross: number } }

const STATUS_COLOR: Record<string, string> = { draft: "#8c948b", sent: "#5EA8F5", accepted: "#c6ff4d", declined: "#eb5757", expired: "#9AA396" };

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
		<section className="fs-card overflow-hidden">
			<header className="flex items-center justify-between border-b border-inkLine px-16 py-12">
				<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("dealQuotes")}</h3>
				<button type="button" onClick={createQuote} className="fs-link">
					{t("dealCreateQuote")}
				</button>
			</header>
			<div className="p-16">
				{!quotes || quotes.length === 0 ? (
					<p className="text-13 text-[#8c948b]">{t("dealNoQuotes")}</p>
				) : (
					<ul className="flex flex-col gap-8">
						{quotes.map((q) => (
							<li key={q.id} className="flex items-center justify-between gap-10 text-13">
								<span className="flex min-w-0 items-center gap-8 text-[#f1f4ee]">
									<span className="truncate">{q.number}</span>
									<span className="fs-chip h-22 shrink-0 gap-6 px-8 text-10">
										<span className="h-6 w-6 rounded-50" style={{ background: STATUS_COLOR[q.status] }} />
										{q.status}
									</span>
								</span>
								<span className="shrink-0 font-medium text-[#cfd4cb]">{q.totals.gross.toFixed(2)} {q.currency}</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
