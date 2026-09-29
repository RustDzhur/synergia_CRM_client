"use client";
import { useLocale, useTranslations } from "next-intl";
import { Task, taskStatus } from "@/store/useTaskStore";
import { localeTag } from "@/utils/dateHelpers";
import { dateText, overdueLabel } from "./model";

export default function DeadlineBadge({ task }: { task: Task }) {
	const t = useTranslations("tasks");
	const locale = useLocale();
	const status = taskStatus(task, Date.now());
	if (status === "completed") return <span className="rounded-6 bg-[rgba(11,208,101,0.16)] px-8 py-4 text-11 font-semibold capitalize text-[#0BD065]">{t("statusCompleted")}</span>;
	if (status === "ended" && task.deadline) return <span className="rounded-6 bg-[rgba(200,16,46,0.18)] px-8 py-4 text-11 font-semibold capitalize text-[#ff7b8a]">{overdueLabel(task.deadline, locale)}</span>;
	return <span>{task.deadline ? dateText(localeTag(locale), task.deadline) : t("noDeadline")}</span>;
}
