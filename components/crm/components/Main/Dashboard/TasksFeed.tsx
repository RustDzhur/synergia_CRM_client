"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MdSearch, MdTune } from "react-icons/md";
import { Task } from "@/app/store/useTaskStore";
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
			<div className="mb-16 flex flex-wrap items-center justify-between gap-16">
				<h2 className="text-32 font-medium text-[#666666] md:text-40">{t("tasksTitle")}</h2>
				<div className="flex h-[50px] w-full items-center justify-between rounded-8 border-2 border-[#E6E6E6] bg-white px-16 shadow-custom transition-colors focus-within:border-[#5EA8F5] sm:w-[350px]">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t("filterSearch")}
						className="w-full text-16 outline-none placeholder:text-[#CCCCCC] md:text-18"
					/>
					<div className="flex shrink-0 items-center gap-10 text-[#CCCCCC]">
						<MdSearch size={20} />
						<MdTune size={20} />
					</div>
				</div>
			</div>

			{visible.length === 0 ? (
				<div className="rounded-16 border border-dashed border-[#CCCCCC] p-30 text-center">
					<p className="text-16 text-[#999999]">{isLoading ? "…" : t("noTasks")}</p>
					{!isLoading && (
						<Link href={`/${locale}/crm/tasks`} className="mt-8 inline-block text-16 font-medium text-primaryColor hover:underline">
							{t("createTaskHint")}
						</Link>
					)}
				</div>
			) : (
				<div className="flex flex-col gap-24">
					{visible.map((task) => (
						<TaskCard key={task._id} task={task} />
					))}
				</div>
			)}
		</section>
	);
}
