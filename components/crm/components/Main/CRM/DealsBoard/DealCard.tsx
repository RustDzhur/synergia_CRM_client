"use client";
import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdChatBubbleOutline, MdMail, MdPhone } from "react-icons/md";
import { Deal } from "@/app/store/useCrmStore";
import { relativeTime } from "@/app/utils/crmFormat";

interface Props {
	deal: Deal;
	isDragging: boolean;
}

const SYSTEM = ["stage", "created"];

// Карточка сделки в колонке: название (синее), счётчик записей, значки комментариев/писем/звонков,
// снизу «Activity» и время последней записи.
export default function DealCard({ deal, isDragging }: Props) {
	const t = useTranslations("crm");
	const locale = useLocale();
	const activities = deal.activities ?? [];
	const userActivities = activities.filter((a) => !SYSTEM.includes(a.type));
	const has = (...types: string[]) => activities.some((a) => types.includes(a.type));
	const last = activities.reduce<string | undefined>(
		(acc, a) => (!acc || new Date(a.createdAt) > new Date(acc) ? a.createdAt : acc),
		undefined
	);
	const icon = (active: boolean) => (active ? "text-primaryColor" : "text-[#CCCCCC]");

	return (
		<div
			className={`cursor-pointer rounded-8 bg-white p-12 shadow-custom transition-shadow duration-200 hover:shadow-md ${
				isDragging ? "shadow-lg" : ""
			}`}>
			<div className="flex items-start justify-between gap-8">
				<div className="min-w-0">
					<p className="truncate text-14 font-semibold text-primaryColor">{deal.clientName}</p>
					{(deal.contactName || deal.companyName) && (
						<p className="mt-2 truncate text-12 text-[#999999]">
							{[deal.contactName, deal.companyName].filter(Boolean).join(" · ")}
						</p>
					)}
				</div>
				<div className="flex shrink-0 flex-col items-end gap-4">
					<span className="rounded-4 bg-[#999999] px-6 text-12 font-medium leading-[18px] text-white">{userActivities.length}</span>
					<MdChatBubbleOutline size={16} className={icon(has("comment", "note", "sms", "whatsapp", "telegram"))} />
					<MdMail size={16} className={icon(has("email"))} />
					<MdPhone size={16} className={icon(has("call"))} />
				</div>
			</div>
			<div className="mt-8 flex items-center justify-between text-12">
				<span className="font-medium text-[#999999]">{t("activity")}</span>
				<span className="text-[#B3B3B3]">{relativeTime(last ?? deal.createdAt, locale, t("justNow"))}</span>
			</div>
		</div>
	);
}
