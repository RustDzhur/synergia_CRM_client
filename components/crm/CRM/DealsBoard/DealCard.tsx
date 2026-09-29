"use client";
import "react";
import { useLocale, useTranslations } from "next-intl";
import { TbMail, TbMessageCircle, TbPhone } from "react-icons/tb";
import { Deal } from "@/store/useCrmStore";
import { relativeTime } from "@/utils/crmFormat";

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
	const icon = (active: boolean) => (active ? "text-[#c6ff4d]" : "text-[#7E867C]");

	return (
		<div
			className={`cursor-pointer rounded-12 border border-inkLine bg-[rgba(255,255,255,0.02)] p-12 transition-[border-color,box-shadow] duration-200 hover:border-[rgba(255,255,255,0.16)] ${
				isDragging ? "shadow-[0_18px_44px_rgba(0,0,0,0.55)]" : ""
			}`}>
			<div className="flex items-start justify-between gap-8">
				<div className="min-w-0">
					<p className="truncate text-13 font-semibold text-[#f1f4ee]">{deal.clientName}</p>
					{(deal.contactName || deal.companyName) && (
						<p className="mt-2 truncate text-11 text-[#8c948b]">
							{[deal.contactName, deal.companyName].filter(Boolean).join(" · ")}
						</p>
					)}
				</div>
				<div className="flex shrink-0 flex-col items-end gap-6">
					<span className="rounded-4 bg-[rgba(255,255,255,0.08)] px-6 text-10 font-medium leading-[16px] text-[#cfd4cb]">{userActivities.length}</span>
					<TbMessageCircle size={15} className={icon(has("comment", "note", "sms", "whatsapp", "telegram"))} />
					<TbMail size={15} className={icon(has("email"))} />
					<TbPhone size={15} className={icon(has("call"))} />
				</div>
			</div>
			<div className="mt-8 flex items-center justify-between text-11">
				<span className="font-medium text-[#9AA396]">{t("activity")}</span>
				<span className="text-[#8c948b]">{relativeTime(last ?? deal.createdAt, locale, t("justNow"))}</span>
			</div>
		</div>
	);
}
