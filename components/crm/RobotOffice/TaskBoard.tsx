"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { useOfficeStore } from "@/store/useOfficeStore";
import TaskItem from "./TaskItem";

// Доска поручений: сверху то, что ждёт решения и что в работе, ниже — завершённое. Для спокойного вида — один столбец, а не канбан.
export default function TaskBoard() {
	const t = useTranslations("office");
	const { tasks, canEdit, clearDone } = useOfficeStore();
	const waiting = tasks.filter((x) => x.status === "waiting");
	const working = tasks.filter((x) => x.status === "running" || x.status === "queued");
	const finished = tasks.filter((x) => x.status === "done" || x.status === "failed" || x.status === "cancelled").slice(0, 20);

	const Section = ({ title, items }: { title: string; items: typeof tasks }) => items.length === 0 ? null : (
		<section>
			<h3 className="mb-8 text-11 font-semibold uppercase tracking-[0.06em] text-[#8c948b]">{title} · {items.length}</h3>
			<ul className="flex flex-col gap-8">{items.map((x) => <TaskItem key={x.id} task={x} />)}</ul>
		</section>
	);

	return (
		<div className="fs-card p-16">
			<div className="mb-14 flex items-center justify-between gap-12">
				<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("boardTitle")}</h2>
				{canEdit && finished.length > 0 && <button type="button" onClick={() => void clearDone()} className="text-12 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">{t("clearDone")}</button>}
			</div>
			{tasks.length === 0 ? <p className="text-13 text-[#8c948b]">{t("boardEmpty")}</p> : (
				<div className="flex flex-col gap-18">
					<Section title={t("colWaiting")} items={waiting} />
					<Section title={t("colWorking")} items={working} />
					<Section title={t("colDone")} items={finished} />
				</div>
			)}
		</div>
	);
}
