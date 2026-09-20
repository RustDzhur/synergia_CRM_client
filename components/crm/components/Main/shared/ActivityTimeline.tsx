"use client";
import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdAccessTimeFilled, MdClose, MdTune } from "react-icons/md";
import type { Activity } from "@/app/types/crm";
import { formatDateTime, formatTime } from "@/app/utils/crmFormat";

interface Props {
	activities: Activity[];
	onDelete?: (activityId: string) => void;
	// показывать переключатель «Today / All time» (в макете сделки он есть)
	withFilter?: boolean;
}

const TITLE_KEY: Record<string, string> = {
	activity: "activityPlanned", stage: "stageChanged", created: "dealCreated",
	comment: "typeComment", task: "typeTask", sms: "typeSms", whatsapp: "typeWhatsapp", telegram: "typeTelegram",
	email: "typeEmail", note: "typeNote", call: "typeCall", schedule: "typeSchedule",
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

// Лента записей (новые сверху): «Activity Planned», «Stage Changed», «Deal Created», заметки, комментарии...
export default function ActivityTimeline({ activities, onDelete, withFilter = false }: Props) {
	const t = useTranslations("crm");
	const locale = useLocale();
	const [todayOnly, setTodayOnly] = useState(false);

	const sorted = [...activities]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.filter((a) => !todayOnly || isToday(a.createdAt));

	return (
		<div>
			{withFilter && (
				<div className="my-24 flex items-center justify-center gap-12">
					<button
						type="button"
						onClick={() => setTodayOnly(!todayOnly)}
						className="rounded-50 bg-primaryColor px-24 py-4 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80">
						{todayOnly ? t("today") : t("allTime")}
					</button>
					<MdTune size={20} className="text-[#999999]" />
				</div>
			)}

			{sorted.length === 0 ? (
				<p className="py-24 text-center text-14 text-[#999999]">{t("notesEmpty")}</p>
			) : (
				<ul className="flex flex-col gap-16">
					{sorted.map((a) => (
						<li key={a._id} className="group animate-fade-in-up rounded-16 bg-white p-16 shadow-custom">
							<div className="flex items-start justify-between gap-12">
								<div className="flex flex-wrap items-baseline gap-10">
									<h3 className="text-16 font-medium text-[#666666]">{t(TITLE_KEY[a.type] ?? "typeNote")}</h3>
									<span className="text-14 text-[#B3B3B3]">{formatTime(a.createdAt, locale)}</span>
								</div>
								{onDelete && a.type !== "stage" && a.type !== "created" && (
									<button
										type="button"
										onClick={() => onDelete(a._id)}
										aria-label={t("deleteActivity")}
										className="text-[#B3B3B3] opacity-0 transition-[opacity,color] duration-150 hover:text-black focus:opacity-100 group-hover:opacity-100">
										<MdClose size={18} />
									</button>
								)}
							</div>

							{a.type === "activity" && a.meta && (
								<p className="mt-8 flex items-center gap-8 text-14 text-[#666666]">
									<MdAccessTimeFilled size={16} className="text-[#999999]" />
									{formatDateTime(a.meta, locale)}
								</p>
							)}

							{a.type === "stage" ? (
								<span className="mt-10 inline-block rounded-50 bg-[#F0F0F0] px-16 py-6 text-14 text-[#666666]">{a.text}</span>
							) : a.type === "created" ? (
								<p className="mt-10 px-16 text-16 text-[#666666]">{a.text}</p>
							) : a.type === "activity" || a.type === "task" ? (
								<p className="mt-10 rounded-8 border border-[#E6E6E6] px-16 py-12 text-16 text-[#666666]">{a.text}</p>
							) : (
								<p className="mt-10 whitespace-pre-wrap break-words text-16 text-[#666666]">{a.text}</p>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
