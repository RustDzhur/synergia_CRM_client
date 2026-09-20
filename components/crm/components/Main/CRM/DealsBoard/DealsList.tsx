"use client";
import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Deal, Stage } from "@/app/store/useCrmStore";
import { formatDate, relativeTime } from "@/app/utils/crmFormat";
import { stageColor } from "@/app/utils/stageColors";

interface Props {
	deals: Deal[];
	stages: Stage[]; // отсортированные по порядку
	onOpen: (dealId: string) => void;
}

// Вид «List»: все сделки одной таблицей.
export default function DealsList({ deals, stages, onOpen }: Props) {
	const t = useTranslations("crm");
	const locale = useLocale();
	const th = "px-16 py-14 text-left text-16 font-medium text-[#999999]";

	if (deals.length === 0) return <p className="py-40 text-center text-16 text-[#999999]">{t("noDeals")}</p>;

	return (
		<div className="overflow-x-auto rounded-16 bg-white shadow-custom">
			<table className="w-full min-w-[720px] border-collapse">
				<thead>
					<tr className="border-b border-[#EFEFEF]">
						<th className={th}>{t("listName")}</th>
						<th className={th}>{t("client")}</th>
						<th className={th}>{t("company")}</th>
						<th className={th}>{t("listStage")}</th>
						<th className={th}>{t("startDate")}</th>
						<th className={th}>{t("lastSeen")}</th>
					</tr>
				</thead>
				<tbody>
					{deals.map((deal) => {
						const index = stages.findIndex((s) => s._id === deal.stage);
						const stage = stages[index];
						return (
							<tr
								key={deal._id}
								onClick={() => onOpen(deal._id)}
								className="cursor-pointer border-b border-[#F5F5F5] transition-colors duration-150 last:border-b-0 hover:bg-[#F5F7FC]">
								<td className="px-16 py-14 text-16 font-medium text-primaryColor">{deal.clientName}</td>
								<td className="px-16 py-14 text-16 text-[#666666]">{deal.contactName}</td>
								<td className="px-16 py-14 text-16 text-[#666666]">{deal.companyName}</td>
								<td className="px-16 py-14">
									{stage && (
										<span
											style={{ backgroundColor: stageColor(stage.color, index) }}
											className="inline-block rounded-50 px-12 py-4 text-14 font-medium text-white">
											{stage.name}
										</span>
									)}
								</td>
								<td className="px-16 py-14 text-16 text-[#666666]">{formatDate(deal.startDate)}</td>
								<td className="px-16 py-14 text-16 text-[#999999]">
									{relativeTime(deal.updatedAt ?? deal.createdAt, locale, t("justNow"))}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
