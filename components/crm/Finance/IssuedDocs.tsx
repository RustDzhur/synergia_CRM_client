"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbDownload } from "react-icons/tb";
import SearchBox from "../shared/SearchBox";
import { apiCall } from "@/store/crmApi";
import { downloadAct, downloadDeliveryNote } from "./download";
import { money } from "./format";

// Реестр выписанных документов (ТЗ §4): «Акти» и «Накладні» — по одной вкладке на вид.
// Акт виконаних робіт и видаткова накладна принадлежат заказу и получают номер при первой
// выписке; здесь они собраны одной лентой, чтобы повторная печать не требовала искать заказ.

interface Row {
	id: string;
	docNumber: string;
	date: string;
	orderNumber: string;
	customerName: string;
	total: number;
	currency: string;
}

export default function IssuedDocs({ kind }: { kind: "act" | "delivery_note" }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [rows, setRows] = useState<Row[]>([]);
	const [q, setQ] = useState("");
	const [busy, setBusy] = useState("");

	const load = useCallback(async (query: string) => {
		const res = await apiCall<Row[]>(`/api/issued-docs?kind=${kind}${query ? `&q=${encodeURIComponent(query)}` : ""}`);
		if (res.ok && res.data) setRows(res.data);
	}, [kind]);
	useEffect(() => { void load(""); }, [load]);

	function download(row: Row) {
		setBusy(row.id);
		const done = kind === "act" ? downloadAct(row.id, row.docNumber, locale) : downloadDeliveryNote(row.id, row.docNumber, locale);
		void done.finally(() => setBusy(""));
	}

	return (
		<div className="flex flex-col gap-16">
			<div className="flex flex-wrap items-center justify-between gap-12">
				<SearchBox
					value={q}
					onChange={(v) => { setQ(v); void load(v); }}
					placeholder={t(kind === "act" ? "issuedSearchAct" : "issuedSearchDelivery")}
					className="w-full md:w-[320px]"
				/>
			</div>
			{rows.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t(kind === "act" ? "issuedEmptyAct" : "issuedEmptyDelivery")}</p>
			) : (
				<div className="fs-card overflow-x-auto">
					<table className="fs-table min-w-[640px] text-left">
						<thead>
							<tr>
								<th className="px-16">{t("stockColNumber")}</th>
								<th className="px-10">{t("stockColDate")}</th>
								<th className="px-10">{t("colCustomer")}</th>
								<th className="px-10">{t("colInvoice")}</th>
								<th className="px-10 text-right">{t("total")}</th>
								<th className="px-10" />
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.id}>
									<td className="px-16 text-13 font-medium text-[#f1f4ee]">{r.docNumber}</td>
									<td className="px-10 text-13 text-[#8c948b]">{r.date}</td>
									<td className="px-10 text-13 text-[#cfd4cb]">{r.customerName}</td>
									<td className="px-10 text-13 text-[#8c948b]">{r.orderNumber}</td>
									<td className="px-10 text-right text-13">{money(r.total, r.currency, locale)}</td>
									<td className="px-10 text-right">
										<button type="button" disabled={busy === r.id} onClick={() => download(r)} className="fs-btn fs-btn-ghost h-30 text-12 disabled:opacity-50">
											<TbDownload size={13} /> {t("downloadPdf")}
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
