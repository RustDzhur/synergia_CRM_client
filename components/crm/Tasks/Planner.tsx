"use client";
import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Task, taskStatus } from "@/store/useTaskStore";
import { addDays, localeTag } from "@/utils/dateHelpers";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Планировщик: две недели по дням с загрузкой. Показывает, что и когда нужно сделать,
// чтобы сроки не сбивались в один день. Календарная сетка здесь не нужна — задачи
// привязаны к сроку, а не к интервалу, поэтому вместо диаграммы Ганта честнее показать повестку.
export default function Planner({ tasks, start, onShift, onToday, onOpen }: {
	tasks: Task[];
	start: Date;
	onShift: (weeks: number) => void;
	onToday: () => void;
	onOpen: (task: Task) => void;
}) {
	const t = useTranslations("tasks");
	const locale = useLocale();
	const tag = localeTag(locale);
	const today = startOfDay(new Date());

	const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
	const byDay = days.map((day) => {
		const key = day.toDateString();
		return {
			day,
			items: tasks
				.filter((task) => task.deadline && new Date(task.deadline).toDateString() === key)
				.sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? "")),
		};
	});
	// Просроченное выносим наверх отдельным блоком: оно не попадает ни в один будущий день,
	// а забыть про него нельзя
	const overdue = tasks.filter((task) => task.deadline && new Date(task.deadline) < today);
	const peak = Math.max(1, ...byDay.map((d) => d.items.length));
	const total = byDay.reduce((sum, d) => sum + d.items.length, 0);

	const head = "px-12 py-8 text-11 uppercase tracking-[0.12em] text-[#9AA396]";

	return (
		<div className="flex flex-col gap-16">
			<div className="flex flex-wrap items-center justify-between gap-12">
				<p className="text-13 text-[#8c948b]">
					{days[0].toLocaleDateString(tag, { day: "numeric", month: "short" })} — {days[days.length - 1].toLocaleDateString(tag, { day: "numeric", month: "short" })}
					<span className="ml-10 text-[#9AA396]">{t("plannerTotal", { count: total })}</span>
				</p>
				<div className="flex items-center gap-6">
					<button type="button" onClick={() => onShift(-1)} className="fs-btn fs-btn-ghost h-32 px-12 text-12">←</button>
					<button type="button" onClick={onToday} className="fs-btn fs-btn-ghost h-32 px-12 text-12">{t("plannerToday")}</button>
					<button type="button" onClick={() => onShift(1)} className="fs-btn fs-btn-ghost h-32 px-12 text-12">→</button>
				</div>
			</div>

			{overdue.length > 0 && (
				<section className="fs-card p-16">
					<p className={head}>{t("overdue")} · {overdue.length}</p>
					<ul className="mt-6 flex flex-col gap-4">
						{overdue.slice(0, 12).map((task) => (
							<li key={task._id}>
								<button type="button" onClick={() => onOpen(task)} className="flex w-full items-center gap-10 rounded-8 px-8 py-6 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]">
									<span className="h-8 w-8 shrink-0 rounded-50 bg-[#EB5757]" aria-hidden />
									<span className="min-w-0 flex-1 truncate text-13 text-[#f1f4ee]">{task.title}</span>
									<span className="shrink-0 text-12 text-[#9AA396]">
										{new Date(task.deadline!).toLocaleDateString(tag, { day: "numeric", month: "short" })}
									</span>
								</button>
							</li>
						))}
					</ul>
				</section>
			)}

			<div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
				{byDay.map(({ day, items }) => {
					const isToday = day.toDateString() === today.toDateString();
					const weekend = day.getDay() === 0 || day.getDay() === 6;
					return (
						<section key={day.toISOString()} className={`fs-card p-14 ${isToday ? "border-[rgba(198,255,77,0.45)]" : ""} ${weekend ? "bg-[rgba(255,255,255,0.015)]" : ""}`}>
							<header className="mb-8 flex items-center justify-between gap-8">
								<span className={`text-13 font-medium capitalize ${isToday ? "text-[#c6ff4d]" : "text-[#f1f4ee]"}`}>
									{day.toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short" })}
								</span>
								{items.length > 0 && <span className="fs-chip h-22 px-8 text-10">{items.length}</span>}
							</header>
							{/* полоска загрузки: видно, в какие дни сроков сходится слишком много */}
							<div className="h-4 overflow-hidden rounded-50 bg-[rgba(255,255,255,0.06)]" title={t("plannerLoad", { count: items.length })}>
								<div className="h-full rounded-50 bg-[#c6ff4d]" style={{ width: `${(items.length / peak) * 100}%` }} />
							</div>
							{items.length === 0 ? (
								<p className="mt-10 text-12 text-[#9AA396]">{t("plannerFree")}</p>
							) : (
								<ul className="mt-10 flex flex-col gap-4">
									{items.map((task) => (
										<li key={task._id}>
											<button type="button" onClick={() => onOpen(task)} className="flex w-full items-center gap-8 rounded-8 px-8 py-6 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]">
												<span className={`h-8 w-8 shrink-0 rounded-50 ${taskStatus(task, Date.now()) === "ended" ? "bg-[#EB5757]" : task.completed ? "bg-[#2DDEB6]" : "bg-[#F4A100]"}`} aria-hidden />
												<span className={`min-w-0 flex-1 truncate text-13 ${task.completed ? "text-[#9AA396] line-through" : "text-[#f1f4ee]"}`}>{task.title}</span>
												{task.deadline && <span className="shrink-0 text-11 text-[#9AA396]">{new Date(task.deadline).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" })}</span>}
											</button>
										</li>
									))}
								</ul>
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
}
