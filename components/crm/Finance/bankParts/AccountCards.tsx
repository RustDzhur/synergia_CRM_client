"use client";
import { useLocale, useTranslations } from "next-intl";
import { TbBuildingBank, TbCash } from "react-icons/tb";
import { money } from "../format";
import { amountColor } from "./model";
import type { BankAccountRow } from "./model";

// Обзор счетов: карточка на счёт или кассу — сальдо и число несверенных движений
export default function AccountCards({ accounts, onOpen }: { accounts: BankAccountRow[]; onOpen: (id: string) => void }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	return (
		<div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
			{accounts.map((a) => (
				<button
					key={a.id}
					type="button"
					onClick={() => onOpen(a.id)}
					className="fs-card flex flex-col p-16 text-left transition-colors hover:border-[rgba(198,255,77,0.35)]">
					<span className="flex items-start justify-between gap-10">
						<span className="min-w-0">
							<span className="block truncate text-14 font-medium text-[#f1f4ee]">{a.name}</span>
							<span className="mt-4 block truncate text-12 text-[#8c948b]">{a.iban || "—"}</span>
						</span>
						<span className={`fs-chip shrink-0 ${a.kind === "cash" ? "border-[rgba(244,161,0,0.35)] text-[#F4A100]" : ""}`}>
							{a.kind === "cash" ? <TbCash size={14} aria-hidden /> : <TbBuildingBank size={14} aria-hidden />}
							{a.kind === "cash" ? t("bankKindCash") : t("bankKindBank")}
						</span>
					</span>
					<span className="mt-14 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
						<span className="text-20 font-semibold text-[#f1f4ee]" style={{ color: amountColor(a.balance) }}>{money(a.balance, a.currency, locale)}</span>
						{/* Несверенные движения — то, ради чего экран существует; когда их нет, чип спокойный */}
						<span className={`fs-chip ${a.unmatched > 0 ? "border-[rgba(244,161,0,0.35)] text-[#F4A100]" : "text-[#8c948b]"}`}>
							{a.unmatched > 0 ? t("bankUnmatchedCount", { count: a.unmatched }) : t("bankAllMatched")}
						</span>
					</span>
					<span className="mt-10 block text-12 text-[#9AA396]">{t("bankShownCount", { count: a.transactionCount })}</span>
				</button>
			))}
		</div>
	);
}
