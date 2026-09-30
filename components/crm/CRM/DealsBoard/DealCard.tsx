"use client";
import "react";
import { useLocale, useTranslations } from "next-intl";
import { TbMail, TbMessageCircle, TbPhone, TbTrophy } from "react-icons/tb";
import { Deal } from "@/store/useCrmStore";
import { relativeTime } from "@/utils/crmFormat";

interface Props {
	deal: Deal;
	isDragging: boolean;
}

const SYSTEM = ["stage", "created"];

// Названия площадок — бренды, их не переводят; для остальных источников показываем код как есть
const SOURCE_LABEL: Record<string, string> = { prom: "Prom.ua", rozetka: "Rozetka", horoshop: "Horoshop", olx: "OLX" };

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
			className={`cursor-pointer rounded-12 border bg-[rgba(255,255,255,0.02)] p-12 transition-[border-color,box-shadow] duration-200 hover:border-[rgba(255,255,255,0.16)] ${
				deal.wonAt ? "border-[rgba(198,255,77,0.4)]" : "border-inkLine"
			} ${isDragging ? "shadow-[0_18px_44px_rgba(0,0,0,0.55)]" : ""}`}>
			<div className="flex items-start justify-between gap-8">
				<div className="min-w-0">
					<p className="flex items-center gap-6 truncate text-13 font-semibold text-[#f1f4ee]">
						{/* выигранную сделку видно сразу: кубок и салатовая рамка */}
						{deal.wonAt && <TbTrophy size={14} className="shrink-0 text-[#c6ff4d]" aria-label={t("dealWon")} />}
						<span className="truncate">{deal.clientName}</span>
					</p>
					{(deal.contactName || deal.companyName) && (
						<p className="mt-2 truncate text-11 text-[#8c948b]">
							{[deal.contactName, deal.companyName].filter(Boolean).join(" · ")}
						</p>
					)}
					{/* Источник заявки: менеджер сразу видит, что это заказ с площадки, а не заведённый вручную */}
					{deal.source && (
						<p className="mt-2 truncate text-10 text-[#9AA396]">
							{SOURCE_LABEL[deal.source] ?? deal.source}{deal.externalId ? ` №${deal.externalId}` : ""}
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
