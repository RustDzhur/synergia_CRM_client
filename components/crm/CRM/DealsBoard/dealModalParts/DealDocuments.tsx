"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { apiCall } from "@/store/crmApi";
import { STATUS_COLORS } from "@/utils/statusColors";
import { localeTag } from "@/utils/dateHelpers";

interface DocRow {
	id: string;
	kind: "quote" | "invoice" | "credit_note" | "order" | "contract";
	number: string;
	status: string;
	total: number;
	currency: string;
	at: string;
}

const STATUS_COLOR: Record<string, string> = {
	draft: STATUS_COLORS.neutral, sent: STATUS_COLORS.info, accepted: STATUS_COLORS.success,
	declined: STATUS_COLORS.danger, expired: STATUS_COLORS.stale,
	paid: STATUS_COLORS.success, overdue: STATUS_COLORS.danger, cancelled: STATUS_COLORS.stale,
	active: STATUS_COLORS.success, completed: STATUS_COLORS.info,
};

// Документы сделки в одном месте: предложения, счета, заказы и договоры. В Finance документ попадает
// в карточку сам — по контакту, фирме или имени клиента (см. dealForCustomer в lib/deals.ts), а эта
// кнопка ведёт туда же с уже подставленным клиентом.
export default function DealDocuments({ dealId, customerName, contact, company }: { dealId: string; customerName: string; contact?: string; company?: string }) {
	const t = useTranslations("crm");
	const router = useRouter();
	const locale = useLocale();
	const [docs, setDocs] = useState<DocRow[] | null>(null);

	useEffect(() => {
		apiCall<DocRow[]>(`/api/deals/${dealId}/documents`).then((r) => r.ok && r.data && setDocs(r.data));
	}, [dealId]);

	function openInFinance(doc: DocRow) {
		const tab = doc.kind === "quote" ? "quotes" : doc.kind === "order" ? "orders" : doc.kind === "contract" ? "contracts" : "invoices";
		router.push(`/${locale}/crm/finance?tab=${tab}&open=${doc.id}`);
	}

	function create(kind: "quote" | "invoice") {
		const params = new URLSearchParams({ tab: kind === "quote" ? "quotes" : "invoices", customerName: customerName || "" });
		params.set(kind === "quote" ? "newFromDeal" : "newInvoiceFor", dealId);
		if (contact) params.set("contact", contact);
		if (company) params.set("company", company);
		router.push(`/${locale}/crm/finance?${params.toString()}`);
	}

	return (
		<section className="fs-card overflow-hidden">
			<header className="flex flex-wrap items-center justify-between gap-8 border-b border-inkLine px-16 py-12">
				<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("dealDocuments")}</h3>
				<div className="flex items-center gap-16">
					<button type="button" onClick={() => create("quote")} className="fs-link">{t("dealCreateQuote")}</button>
					<button type="button" onClick={() => create("invoice")} className="fs-link">{t("dealCreateInvoice")}</button>
				</div>
			</header>
			<div className="p-16">
				{!docs || docs.length === 0 ? (
					<p className="text-13 text-[#8c948b]">{t("dealNoDocuments")}</p>
				) : (
					<ul className="flex flex-col gap-8">
						{docs.map((d) => (
							<li key={`${d.kind}-${d.id}`}>
								<button type="button" onClick={() => openInFinance(d)} className="flex w-full items-center justify-between gap-10 text-left text-13 transition-colors hover:text-[#c6ff4d]">
									<span className="flex min-w-0 items-center gap-8 text-[#f1f4ee]">
										<span className="shrink-0 text-12 text-[#8c948b]">{t(`doc_${d.kind}`)}</span>
										<span className="truncate">{d.number}</span>
										<span className="fs-chip h-22 shrink-0 gap-6 px-8 text-10">
											<span className="h-6 w-6 rounded-50" style={{ background: STATUS_COLOR[d.status] ?? STATUS_COLORS.neutral }} />
											{d.status}
										</span>
									</span>
									<span className="flex shrink-0 items-center gap-10">
										<span className="text-12 text-[#8c948b]">{new Date(d.at).toLocaleDateString(localeTag(locale))}</span>
										<span className="font-medium text-[#cfd4cb]">{d.total.toFixed(2)} {d.currency}</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
