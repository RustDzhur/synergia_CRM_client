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
						className="fs-btn fs-btn-primary h-34">
						{todayOnly ? t("today") : t("allTime")}
					</button>
					<MdTune size={18} className="text-[#8c948b]" />
				</div>
			)}

			{sorted.length === 0 ? (
				<p className="py-24 text-center text-13 text-[#8c948b]">{t("notesEmpty")}</p>
			) : (
				<ul className="flex flex-col gap-10">
					{sorted.map((a) => (
						<li key={a._id} className="group animate-fade-in-up fs-card p-14">
							<div className="flex items-start justify-between gap-12">
								<div className="flex flex-wrap items-baseline gap-10">
									<h3 className="text-13 font-semibold text-[#f1f4ee]">{t(TITLE_KEY[a.type] ?? "typeNote")}</h3>
									<span className="text-11 text-[#9AA396]">{formatTime(a.createdAt, locale)}</span>
								</div>
								{onDelete && a.type !== "stage" && a.type !== "created" && (
									<button
										type="button"
										onClick={() => onDelete(a._id)}
										aria-label={t("deleteActivity")}
										className="text-[#9AA396] opacity-0 transition-[opacity,color] duration-150 hover:text-[#f1f4ee] focus:opacity-100 group-hover:opacity-100">
										<MdClose size={18} />
									</button>
								)}
							</div>

							{a.type === "activity" && a.meta && (
								<p className="mt-8 flex items-center gap-8 text-12 text-[#8c948b]">
									<MdAccessTimeFilled size={14} className="text-[#9AA396]" />
									{formatDateTime(a.meta, locale)}
								</p>
							)}

							{a.type === "stage" ? (
								<span className="mt-10 inline-block rounded-50 border border-inkLine px-14 py-5 text-12 text-[#cfd4cb]">{a.text}</span>
							) : a.type === "created" ? (
								<p className="mt-10 px-16 text-13 text-[#cfd4cb]">{a.text}</p>
							) : a.type === "activity" || a.type === "task" ? (
								<p className="mt-10 rounded-10 border border-inkLine px-14 py-10 text-13 text-[#cfd4cb]">{a.text}</p>
							) : (
								<p className="mt-10 whitespace-pre-wrap break-words text-13 text-[#cfd4cb]">{a.text}</p>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
