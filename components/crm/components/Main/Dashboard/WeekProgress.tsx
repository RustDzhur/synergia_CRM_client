"use client";
import React, { useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdCalendarMonth } from "react-icons/md";
import { Task } from "@/app/store/useTaskStore";
import { addDays, dayKey, localeTag, parseDayKey, startOfWeek } from "@/app/utils/dateHelpers";

interface Props {
	tasks: Task[];
	selected: string; // "YYYY-MM-DD"
	onSelect: (key: string) => void;
}

// Карточка «8 Tasks Completed Out Of 10»: прогресс за выбранный день, дата и полоска недели.
export default function WeekProgress({ tasks, selected, onSelect }: Props) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const tag = localeTag(locale);
	const dateInput = useRef<HTMLInputElement>(null);
	const day = parseDayKey(selected);

	const { done, total } = useMemo(() => {
		const ofDay = tasks.filter((task) => task.deadline?.slice(0, 10) === selected);
		return { done: ofDay.filter((task) => task.completed).length, total: ofDay.length };
	}, [tasks, selected]);
	const percent = total ? Math.round((done / total) * 100) : 0;

	const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i));
	const month = day.toLocaleDateString(tag, { month: "long" });

	return (
		<section className="md:rounded-16 md:border md:border-[#F0F0F0] md:bg-white md:p-30 md:shadow-[0_2px_8px_rgba(0,0,0,0.16)]">
			<div className="flex flex-wrap items-center justify-between gap-12 text-16 text-[#999999] md:text-18">
				<p>
					{t.rich("progress", {
						done,
						total,
						b: (chunks) => <span className="text-primaryColor">{chunks}</span>,
					})}
				</p>
				<div className="flex items-center gap-8">
					<span className="font-medium text-primaryColor">{t("date")}</span>
					<span className="text-[#666666]">
						{day.toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric" })}
					</span>
					<button
						type="button"
						aria-label={t("pickDate")}
						onClick={() => dateInput.current?.showPicker?.()}
						className="relative text-[#666666] transition-colors hover:text-primaryColor">
						<MdCalendarMonth size={24} />
						<input
							ref={dateInput}
							type="date"
							value={selected}
							onChange={(e) => e.target.value && onSelect(e.target.value)}
							className="pointer-events-none absolute inset-0 opacity-0"
							tabIndex={-1}
						/>
					</button>
				</div>
			</div>

			<div
				className="mt-16 h-[8px] w-full overflow-hidden rounded-50 bg-[#D9D9D9]"
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}>
				<div className="h-full rounded-50 bg-primaryColor transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
			</div>

			<p className="mt-20 text-16 text-[#4D4D4D] md:text-18">
				<span className="font-medium capitalize text-primaryColor">{month}</span>, {day.getFullYear()}
			</p>

			<div className="mt-16 flex gap-8 overflow-x-auto pb-6 [scrollbar-width:none] md:gap-10 [&::-webkit-scrollbar]:hidden">
				{week.map((d) => {
					const key = dayKey(d);
					const active = key === selected;
					return (
						<button
							key={key}
							type="button"
							aria-pressed={active}
							onClick={() => onSelect(key)}
							className={`flex h-[70px] min-w-[60px] flex-1 flex-col items-center justify-center rounded-4 text-18 font-medium leading-tight shadow-custom transition-colors duration-200 md:text-24 ${
								active ? "bg-primaryColor text-white" : "bg-white text-[#CCCCCC] hover:text-primaryColor"
							}`}>
							<span className="capitalize">{d.toLocaleDateString(tag, { weekday: "short" })}</span>
							<span>{d.getDate()}</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}
