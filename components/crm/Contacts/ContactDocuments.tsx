"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbDownload, TbEye } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import { downloadDocumentPdf, viewDocumentPdf, type DocumentKind } from "../Finance/download";
import { money } from "../Finance/format";

// Документы клиента в его карточке: что ему выставили и подписали — одной лентой, как в карточке сделки.
// Владелец: «оформил заказ — в CRM подтягивается карточка клиента, что он заказал, пока клиент не
// свершится полностью». Документы привязывает API: счёт/заказ с новым именем заводит контакт сам.

interface DocRow {
	kind: string;
	id: string;
	number: string;
	status: string;
	total: number;
	currency: string;
	at: string;
}

const ROUTE_OF: Record<string, DocumentKind> = { quote: "quotes", invoice: "invoices", credit_note: "invoices", order: "orders", contract: "contracts" };
const LABEL_OF: Record<string, string> = { quote: "tab_quotes", invoice: "tab_invoices", credit_note: "creditNote", order: "tab_orders", contract: "tab_contracts" };

export default function ContactDocuments({ contactId, url }: { contactId: string; url?: string }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [rows, setRows] = useState<DocRow[] | null>(null);
	const [busy, setBusy] = useState("");

	useEffect(() => {
		let cancelled = false;
		void apiCall<DocRow[]>(url ?? `/api/contacts/${contactId}/documents`).then((r) => {
			if (!cancelled) setRows(r.ok && r.data ? r.data : []);
		});
		return () => { cancelled = true; };
	}, [contactId, url]);

	function open(row: DocRow, mode: "view" | "download") {
		const kind = ROUTE_OF[row.kind];
		if (!kind) return;
		setBusy(row.id + mode);
		const done = mode === "view" ? viewDocumentPdf(kind, row.id, row.number, locale) : downloadDocumentPdf(kind, row.id, row.number, locale);
		void done.finally(() => setBusy(""));
	}

	return (
		<div className="fs-card mb-20 p-16 md:p-20">
			<p className="mb-10 text-13 font-medium text-[#f1f4ee]">{t("contactDocuments")}</p>
			{rows === null ? (
				<p className="text-12 text-[#8c948b]">{t("loading")}</p>
			) : rows.length === 0 ? (
				<p className="text-12 text-[#8c948b]">{t("contactDocsEmpty")}</p>
			) : (
				<ul className="flex flex-col">
					{rows.map((row) => (
						<li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center gap-x-10 gap-y-6 border-t border-inkLineSoft py-8 text-12 first:border-t-0">
							<span className="fs-chip h-22 shrink-0 px-8 text-10 text-[#c6ff4d]">{t(LABEL_OF[row.kind] ?? "tab_invoices")}</span>
							<span className="text-[#f1f4ee]">{row.number || "—"}</span>
							<span className="text-[#8c948b]">{row.at ? new Date(row.at).toLocaleDateString(locale) : ""}</span>
							<span className="ml-auto text-[#cfd4cb]">{money(row.total, row.currency || "UAH", locale)}</span>
							<span className="flex items-center gap-6">
								<button type="button" disabled={busy === row.id + "view"} onClick={() => open(row, "view")} title={t("viewPdf")} aria-label={t("viewPdf")} className="fs-btn fs-btn-ghost h-28 w-28 justify-center p-0 disabled:opacity-50">
									<TbEye size={13} />
								</button>
								<button type="button" disabled={busy === row.id + "download"} onClick={() => open(row, "download")} title={t("downloadPdf")} aria-label={t("downloadPdf")} className="fs-btn fs-btn-ghost h-28 w-28 justify-center p-0 disabled:opacity-50">
									<TbDownload size={13} />
								</button>
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
