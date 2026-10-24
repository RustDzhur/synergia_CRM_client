"use client";
import { useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbCalendarEvent } from "react-icons/tb";
import { Task } from "@/store/useTaskStore";
import { addDays, dayKey, localeTag, parseDayKey, startOfWeek } from "@/utils/dateHelpers";

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
		<section className="fs-card p-16 md:p-20">
			<div className="flex flex-wrap items-center justify-between gap-12 text-13 text-[#9aa7c9]">
				<p>
					{t.rich("progress", {
						done,
						total,
						b: (chunks) => <span className="font-medium text-[#7c93ff]">{chunks}</span>,
					})}
				</p>
				<div className="flex items-center gap-8">
					<span className="font-medium text-[#7c93ff]">{t("date")}</span>
					<span className="text-[#cfd4cb]">
						{day.toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric" })}
					</span>
					<button
						type="button"
						aria-label={t("pickDate")}
						onClick={() => dateInput.current?.showPicker?.()}
						className="relative text-[#9aa7c9] transition-colors hover:text-[#7c93ff]">
						<TbCalendarEvent size={17} />
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
				className="mt-14 h-6 w-full overflow-hidden rounded-50 bg-[rgba(255,255,255,0.10)]"
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}>
				<div className="h-full rounded-50 bg-[#7c93ff] transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
			</div>

			<p className="mt-18 text-13 text-[#9aa7c9]">
				<span className="font-medium capitalize text-[#7c93ff]">{month}</span>, {day.getFullYear()}
			</p>

			{/* Полоска недели: выбранный день залит акцентом, остальные — контурные плитки */}
			<div className="mt-12 flex gap-8 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{week.map((d) => {
					const key = dayKey(d);
					const active = key === selected;
					return (
						<button
							key={key}
							type="button"
							aria-pressed={active}
							onClick={() => onSelect(key)}
							className={`flex h-64 min-w-56 flex-1 flex-col items-center justify-center gap-2 rounded-12 border text-14 font-medium leading-tight transition-colors duration-200 ${
								active
									? "border-[#7c93ff] bg-[#7c93ff] text-[#0b1120]"
									: "border-inkLine bg-[rgba(255,255,255,0.02)] text-[#9aa7c9] hover:border-[rgba(255,255,255,0.18)] hover:text-[#edf2ff]"
							}`}>
							<span className="capitalize text-11">{d.toLocaleDateString(tag, { weekday: "short" })}</span>
							<span className="text-18">{d.getDate()}</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}
