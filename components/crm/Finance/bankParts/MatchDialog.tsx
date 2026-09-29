"use client";
import { useLocale, useTranslations } from "next-intl";
import type { MatchCandidate, MatchSuggestion } from "@/lib/finance/bank";
import Modal from "../../shared/Modal";
import { money } from "../format";
import { MATCH_WINDOW_DAYS, amountColor } from "./model";
import type { BankTx } from "./model";

interface Props {
	open: boolean;
	onClose: () => void;
	tx: BankTx | null;
	candidates: { list: MatchCandidate[]; hint: MatchSuggestion | null };
	notice: string;
	busy: boolean;
	onPick: (tx: BankTx, candidateId: string) => void;
}

// Сверка: приход сверяется со счетами клиентам, расход — с расходами. Кандидаты уже
// отфильтрованы по окну вокруг даты и отсортированы так, что подсказка стоит первой.
export default function MatchDialog({ open, onClose, tx, candidates, notice, busy, onPick }: Props) {
	const t = useTranslations("finance");
	const locale = useLocale();
	return (
		<Modal open={open} onClose={onClose} label={t("bankMatchTitle")} className="w-full max-w-[480px]">
			{tx && (
				<div className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("bankMatchTitle")}</h2>
					<p className="mt-6 text-12 leading-[1.5] text-[#8c948b]">{t("bankMatchHint", { days: MATCH_WINDOW_DAYS })}</p>
					<div className="mt-12 flex items-center justify-between gap-16 rounded-10 border border-inkLine px-12 py-9 text-13">
						<span className="min-w-0 truncate text-[#8c948b]">{tx.date} · {tx.counterparty || "—"}</span>
						<span className="shrink-0 font-medium" style={{ color: amountColor(tx.amount) }}>{money(tx.amount, tx.currency, locale)}</span>
					</div>
					{tx.reference && <p className="mt-8 text-12 leading-[1.5] text-[#9AA396]">{tx.reference}</p>}

					{candidates.list.length === 0 ? (
						<p className="mt-14 text-13 leading-[1.5] text-[#8c948b]">{t("bankNoCandidates")}</p>
					) : (
						<ul className="mt-10 flex flex-col">
							{candidates.list.map((c) => {
								const suggested = candidates.hint?.candidateId === c.id;
								return (
									<li key={c.id}>
										<button
											type="button"
											disabled={busy}
											onClick={() => onPick(tx, c.id)}
											className="flex w-full items-center justify-between gap-14 rounded-10 border border-transparent px-12 py-10 text-left transition-colors hover:border-[rgba(198,255,77,0.35)] hover:bg-[rgba(198,255,77,0.06)] disabled:opacity-[0.5]">
											<span className="min-w-0">
												<span className="block truncate text-13 font-medium text-[#f1f4ee]">{c.label}</span>
												<span className="mt-4 flex flex-wrap items-center gap-8 text-12 text-[#8c948b]">
													{c.date}
													{suggested && (
														<span className="fs-chip h-22 border-[rgba(198,255,77,0.35)] px-8 text-10 text-[#c6ff4d]">
															{t("bankMatchSuggestion")}
															{candidates.hint?.reason ? ` · ${t(`bankReason_${candidates.hint.reason}`)}` : ""}
														</span>
													)}
													{!suggested && Math.abs(c.amount - tx.amount) < 0.01 && (
														<span className="fs-chip h-22 border-[rgba(244,161,0,0.35)] px-8 text-10 text-[#F4A100]">{t("bankMatchAmount")}</span>
													)}
												</span>
											</span>
											<span className="shrink-0 text-13 font-medium" style={{ color: amountColor(c.amount) }}>{money(c.amount, tx.currency, locale)}</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
					{notice && <p className="mt-12 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
					<div className="mt-20 flex justify-end">
						<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
					</div>
				</div>
			)}
		</Modal>
	);
}
