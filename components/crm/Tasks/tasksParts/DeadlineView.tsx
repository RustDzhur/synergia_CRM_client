"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Task, taskStatus } from "@/store/useTaskStore";
import DeadlineBadge from "./DeadlineBadge";

interface Props { rows: Task[]; isLoading: boolean; onOpen: (task: Task) => void }

// Задачи, сгруппированные по срокам: просрочено / сегодня / позже / без срока
export default function DeadlineView({ rows, isLoading, onOpen }: Props) {
	const t = useTranslations("tasks");
	const groups = useMemo(() => {
		const todayKey = new Date().toDateString();
		const result: Record<"overdue" | "today" | "upcoming" | "none", Task[]> = { overdue: [], today: [], upcoming: [], none: [] };
		rows.forEach((task) => {
			if (!task.deadline) return result.none.push(task);
			const status = taskStatus(task);
			if (status === "ended") return result.overdue.push(task);
			if (new Date(task.deadline).toDateString() === todayKey) return result.today.push(task);
			result.upcoming.push(task);
		});
		return result;
	}, [rows]);

	return (
		<div className="flex flex-col gap-24">
			{(["overdue", "today", "upcoming", "none"] as const).map((g) =>
				groups[g].length === 0 ? null : (
					<section key={g} className="animate-fade-in">
						<h3 className={`mb-10 text-13 font-semibold ${g === "overdue" ? "text-danger" : "text-[#8c948b]"}`}>
							{g === "overdue" ? t("overdue") : g === "today" ? t("today") : g === "upcoming" ? t("upcoming") : t("noDeadline")} ({groups[g].length})
						</h3>
						<ul className="fs-card overflow-hidden">
							{groups[g].map((task) => (
								<li key={task._id} className="flex flex-wrap items-center justify-between gap-12 border-b border-inkLineSoft px-20 py-14 last:border-b-0 hover:bg-[rgba(255,255,255,0.025)]">
									<button type="button" onClick={() => onOpen(task)} className={`text-left text-13 text-[#f1f4ee] transition-colors hover:text-[#c6ff4d] ${task.completed ? "line-through" : ""}`}>{task.title}</button>
									<span className="text-12 text-[#8c948b]"><DeadlineBadge task={task} /></span>
								</li>
							))}
						</ul>
					</section>
				)
			)}
			{rows.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">{isLoading ? "…" : t("empty")}</p>}
		</div>
	);
}
