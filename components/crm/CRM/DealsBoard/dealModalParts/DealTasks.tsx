"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { useTaskStore } from "@/store/useTaskStore";
import { localeTag } from "@/utils/dateHelpers";
import { useLocale } from "next-intl";

// Задачи, поставленные из карточки сделки (вкладка «Задача» в ленте). Показываются здесь же, чтобы
// по сделке было видно не только документы, но и что по ней ещё нужно сделать.
export default function DealTasks({ dealId }: { dealId: string }) {
	const t = useTranslations("crm");
	const locale = useLocale();
	const tasks = useTaskStore((s) => s.tasks);
	const fetchTasks = useTaskStore((s) => s.fetchTasks);
	const updateTask = useTaskStore((s) => s.updateTask);

	useEffect(() => { void fetchTasks(); }, [fetchTasks]);

	const mine = tasks.filter((x) => x.deal === dealId);

	async function toggle(id: string, completed: boolean) {
		const task = await updateTask(id, { completed });
		if (!task) toast.error(t("error"));
	}

	return (
		<section className="fs-card overflow-hidden">
			<header className="flex items-center justify-between border-b border-inkLine px-16 py-12">
				<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("dealTasks")}</h3>
			</header>
			<div className="p-16">
				{mine.length === 0 ? (
					<p className="text-13 text-[#8c948b]">{t("dealNoTasks")}</p>
				) : (
					<ul className="flex flex-col gap-8">
						{mine.map((task) => (
							<li key={task._id} className="flex items-center justify-between gap-10 text-13">
								<label className="flex min-w-0 cursor-pointer items-center gap-8">
									<input
										type="checkbox"
										checked={task.completed}
										onChange={(e) => void toggle(task._id, e.target.checked)}
										className="h-[15px] w-[15px] shrink-0 cursor-pointer accent-[#c6ff4d]"
									/>
									<span className={`truncate ${task.completed ? "text-[#8c948b] line-through" : "text-[#f1f4ee]"}`}>{task.title}</span>
								</label>
								{task.deadline && (
									<span className="shrink-0 text-12 text-[#8c948b]">
										{new Date(task.deadline).toLocaleString(localeTag(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
									</span>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
