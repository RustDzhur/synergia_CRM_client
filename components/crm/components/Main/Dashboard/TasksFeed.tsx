"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Task } from "@/store/useTaskStore";
import SearchBox from "../shared/SearchBox";
import TaskCard from "./TaskCard";

interface Props {
	tasks: Task[];
	selected: string; // "YYYY-MM-DD" — показываем задачи со сроком на этот день
	isLoading: boolean;
}

// Заголовок «Tasks», поле «Filter And Search» и карточки задач выбранного дня (закреплённые — выше).
export default function TasksFeed({ tasks, selected, isLoading }: Props) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const [query, setQuery] = useState("");

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		return tasks
			.filter((task) => task.deadline?.slice(0, 10) === selected)
			.filter((task) => !q || [task.title, task.responsible, task.createdBy].some((v) => v?.toLowerCase().includes(q)))
			.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.deadline ?? "").localeCompare(b.deadline ?? ""));
	}, [tasks, selected, query]);

	return (
		<section>
			<div className="mb-14 flex flex-wrap items-center justify-between gap-16">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("tasksTitle")}</h2>
				<SearchBox value={query} onChange={setQuery} placeholder={t("filterSearch")} className="w-full sm:w-300" />
			</div>

			{visible.length === 0 ? (
				<div className="rounded-14 border border-dashed border-[rgba(255,255,255,0.12)] p-30 text-center">
					<p className="text-13 text-[#8c948b]">{isLoading ? "…" : t("noTasks")}</p>
					{!isLoading && (
						<Link href={`/${locale}/crm/tasks`} className="mt-8 inline-block text-13 font-medium text-[#c6ff4d] hover:underline">
							{t("createTaskHint")}
						</Link>
					)}
				</div>
			) : (
				<div className="flex flex-col gap-12">
					{visible.map((task) => (
						<TaskCard key={task._id} task={task} />
					))}
				</div>
			)}
		</section>
	);
}
