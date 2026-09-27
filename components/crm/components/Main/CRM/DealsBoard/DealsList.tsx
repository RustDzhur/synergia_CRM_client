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

	if (deals.length === 0) return <p className="py-40 text-center text-13 text-[#8c948b]">{t("noDeals")}</p>;

	return (
		<div className="fs-card fs-scroll overflow-x-auto">
			<table className="fs-table min-w-[720px]">
				<thead>
					<tr>
						<th>{t("listName")}</th>
						<th>{t("client")}</th>
						<th>{t("company")}</th>
						<th>{t("listStage")}</th>
						<th>{t("startDate")}</th>
						<th>{t("lastSeen")}</th>
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
								className="cursor-pointer">
								<td className="font-medium text-[#f1f4ee]">{deal.clientName}</td>
								<td className="text-[#8c948b]">{deal.contactName}</td>
								<td className="text-[#8c948b]">{deal.companyName}</td>
								<td>
									{stage && (
										<span
											style={{ backgroundColor: stageColor(stage.color, index) }}
											className="inline-block rounded-50 px-10 py-2 text-11 font-medium text-white">
											{stage.name}
										</span>
									)}
								</td>
								<td className="text-[#8c948b]">{formatDate(deal.startDate)}</td>
								<td className="text-[#9AA396]">
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
