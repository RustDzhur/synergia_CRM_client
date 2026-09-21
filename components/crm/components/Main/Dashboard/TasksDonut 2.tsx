"use client";
import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Task, taskStatus } from "@/app/store/useTaskStore";
import PeriodSelect from "./PeriodSelect";

type Period = "month" | "week" | "year";

const COLORS = { active: "#FFB02E", completed: "#0BD065", ended: "#F04333" } as const;

function inPeriod(deadline: string | undefined, period: Period, now: Date): boolean {
	if (!deadline) return false;
	const d = new Date(deadline);
	if (Number.isNaN(d.getTime())) return false;
	if (period === "year") return d.getFullYear() === now.getFullYear();
	if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
	const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
	return d >= start && d < end;
}

// Кольцо «Tasks»: доли активных, выполненных и просроченных задач за период. В центре — процент выполненных.
export default function TasksDonut({ tasks }: { tasks: Task[] }) {
	const t = useTranslations("dashboard");
	const [period, setPeriod] = useState<Period>("month");

	const counts = useMemo(() => {
		const now = new Date();
		const acc = { active: 0, completed: 0, ended: 0 };
		tasks.filter((task) => inPeriod(task.deadline, period, now)).forEach((task) => {
			acc[taskStatus(task, now.getTime())] += 1;
		});
		return acc;
	}, [tasks, period]);

	const total = counts.active + counts.completed + counts.ended;
	const percent = total ? Math.round((counts.completed / total) * 100) : 0;

	const R = 130;
	const C = 2 * Math.PI * R;
	const GAP = total > 1 ? 3 : 0;
	// порядок по часовой стрелке от «10 часов»: Active, Ended, Completed (как в макете)
	const segments = (["active", "ended", "completed"] as const)
		.filter((k) => counts[k] > 0)
		.map((k) => ({ key: k, length: Math.max(0, (counts[k] / total) * C - GAP) }));
	let offset = 0;

	return (
		<section className="rounded-16 border border-[#F0F0F0] bg-white p-20 shadow-[0_2px_8px_rgba(0,0,0,0.16)] lg:p-25">
			<header className="flex items-center justify-between gap-12">
				<h2 className="shrink-0 text-20 font-medium text-[#4D4D4D] lg:text-24">{t("tasksTitle")}</h2>
				<PeriodSelect<Period>
					value={period}
					onChange={setPeriod}
					options={[
						{ value: "month", label: t("thisMonth") },
						{ value: "week", label: t("thisWeek") },
						{ value: "year", label: t("thisYear") },
					]}
				/>
			</header>

			<ul className="mt-8 flex flex-wrap items-center justify-center gap-16 text-14 text-[#999999] md:text-16">
				{(["active", "completed", "ended"] as const).map((k) => (
					<li key={k} className="flex items-center gap-6">
						{t(k)}
						<span className="inline-block h-[10px] w-[10px] rounded-50" style={{ backgroundColor: COLORS[k] }} />
					</li>
				))}
			</ul>

			<div className="relative mx-auto mt-16 w-full max-w-[340px]">
				<svg viewBox="0 0 320 320" className="w-full" role="img" aria-label={`${percent}%`}>
					<g transform="rotate(-110 160 160)">
						<circle cx="160" cy="160" r={R} fill="none" stroke="#EDEDED" strokeWidth="22" />
						{segments.map((s) => {
							const dashOffset = -offset;
							offset += s.length + GAP;
							return (
								<circle
									key={s.key}
									cx="160"
									cy="160"
									r={R}
									fill="none"
									stroke={COLORS[s.key]}
									strokeWidth="22"
									strokeDasharray={`${s.length} ${C - s.length}`}
									strokeDashoffset={dashOffset}
									className="transition-[stroke-dasharray] duration-500"
								/>
							);
						})}
					</g>
				</svg>
				<p
					className="absolute inset-0 flex items-center justify-center text-[56px] font-bold leading-none md:text-[64px]"
					style={{ color: total ? COLORS.completed : "#B3B3B3" }}>
					{percent} %
				</p>
			</div>
		</section>
	);
}
