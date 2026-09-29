"use client";
import { useLocale, useTranslations } from "next-intl";
import { TbLink, TbLinkOff, TbReceipt, TbTrash } from "react-icons/tb";
import { money } from "../format";
import { amountColor } from "./model";
import type { BankTx } from "./model";

interface Props {
	rows: BankTx[];
	linkedLabel: (tx: BankTx) => string;
	onMatch: (tx: BankTx) => void;
	onUnlink: (tx: BankTx) => void;
	onDelete: (tx: BankTx) => void;
}

// Движения выбранного счёта: у каждого — привязанный документ или кнопка «Сверить», и удаление
export default function TransactionsTable({ rows, linkedLabel, onMatch, onUnlink, onDelete }: Props) {
	const t = useTranslations("finance");
	const locale = useLocale();
	return (
		<section className="fs-card overflow-x-auto">
			<table className="fs-table min-w-[860px]">
				<thead>
					<tr>
						<th className="px-16">{t("colDate")}</th>
						<th className="px-10">{t("colCounterparty")}</th>
						<th className="px-10">{t("colReference")}</th>
						<th className="px-10 text-right">{t("colAmount")}</th>
						<th className="px-10">{t("bankColMatch")}</th>
						<th className="px-10" />
					</tr>
				</thead>
				<tbody>
					{rows.map((tx) => (
						<tr key={tx.id}>
							<td className="px-16 text-13 text-[#8c948b]">{tx.date}</td>
							<td className="px-10 text-13 font-medium text-[#f1f4ee]">{tx.counterparty || "—"}</td>
							<td className="px-10 text-13 text-[#8c948b]">
								<span className="block max-w-[280px] truncate" title={tx.reference}>{tx.reference || "—"}</span>
							</td>
							<td className="px-10 text-right text-13 font-medium" style={{ color: amountColor(tx.amount) }}>{money(tx.amount, tx.currency, locale)}</td>
							<td className="px-10">
								{tx.matchType ? (
									<span className="fs-chip border-[rgba(198,255,77,0.35)] text-[#c6ff4d]">
										<TbReceipt size={14} aria-hidden />
										<span className="block max-w-[220px] truncate">{linkedLabel(tx)}</span>
									</span>
								) : (
									<span className="fs-chip border-[rgba(244,161,0,0.35)] text-[#F4A100]">{t("bankMatchNone")}</span>
								)}
							</td>
							<td className="px-10 text-right">
								<div className="flex items-center justify-end gap-14">
									{tx.matchType ? (
										<button type="button" onClick={() => onUnlink(tx)} className="fs-link whitespace-nowrap text-12">
											<TbLinkOff size={15} aria-hidden /> {t("bankUnlink")}
										</button>
									) : (
										<button type="button" onClick={() => onMatch(tx)} className="fs-link whitespace-nowrap text-12">
											<TbLink size={15} aria-hidden /> {t("bankMatch")}
										</button>
									)}
									<button type="button" onClick={() => onDelete(tx)} aria-label={t("delete")} className="text-[#9AA396] transition-colors hover:text-danger">
										<TbTrash size={16} />
									</button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
