"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPlus } from "react-icons/tb";
import { useOfficeStore } from "@/store/useOfficeStore";
import Automation from "../Automation";
import PageHeader from "../shared/PageHeader";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import BossCard from "./BossCard";
import { DragProvider, type DragPayload, type DropTarget } from "./dragKit";
import HireDialog from "./HireDialog";
import OfficeFloor from "./OfficeFloor";
import RobotPanel from "./RobotPanel";
import TaskBoard from "./TaskBoard";

// Робот-офис (/crm/automation): команда роботов-сотрудников, во главе — Айрис. Вкладка «Правила» — прежний раздел автоматизации
// (триггеры «событие → действие», переменные, константы, журнал): он никуда не делся.
export default function RobotOffice() {
	const t = useTranslations("office");
	const { robots, selected, select, load, loaded, canEdit, update, reassign, tasks } = useOfficeStore();
	const [tab, setTab] = useState<"office" | "rules">(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "rules" ? "rules" : "office"));
	const [hireOpen, setHireOpen] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
	const busy = tasks.some((x) => x.status === "running" || x.status === "queued");

	// Опрос: пока кто-то работает — каждые 2,5 с, в покое — реже; в скрытой вкладке браузера не опрашиваем
	useEffect(() => {
		let stop = false;
		let timer: ReturnType<typeof setTimeout>;
		const tick = async () => {
			if (stop) return;
			if (!document.hidden) await load();
			timer = setTimeout(tick, useOfficeStore.getState().tasks.some((x) => x.status === "running" || x.status === "queued") ? 2500 : 12000);
		};
		void tick();
		const onVisible = () => { if (!document.hidden) { clearTimeout(timer); void tick(); } };
		document.addEventListener("visibilitychange", onVisible);
		return () => { stop = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
	}, [load, busy]);

	const onDrop = useCallback((p: DragPayload, target: DropTarget) => {
		if (p.kind === "robot" && target.type === "zone") void update(p.id, { zone: target.id as never });
		if (p.kind === "task" && target.type === "robot") void reassign(p.id, target.id).then((ok) => ok && toast.success(t("taskAssigned", { name: useOfficeStore.getState().robots.find((r) => r.id === target.id)?.name ?? "" })));
	}, [update, reassign, t]);

	const pick = (id: string) => {
		select(id);
		if (typeof window !== "undefined" && window.innerWidth < 900) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
	};
	const robot = robots.find((r) => r.id === selected) ?? null;

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader subtitle={tab === "office" ? t("subtitle") : undefined} right={canEdit && tab === "office" ? <button type="button" onClick={() => setHireOpen(true)} className="fs-btn fs-btn-primary h-40"><TbPlus size={16} aria-hidden />{t("hire")}</button> : undefined}>
				<div className={TAB_BAR} role="tablist">
					{(["office", "rules"] as const).map((k) => (
						<button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`${TAB_ITEM} ${tab === k ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}>{k === "office" ? t("tabOffice") : t("tabRules")}</button>
					))}
				</div>
			</PageHeader>

			{tab === "rules" ? <Automation embedded /> : (
				<DragProvider onDrop={onDrop}>
					<div className="grid grid-cols-1 gap-16 mp:grid-cols-[minmax(0,1fr)_380px]">
						<div className="flex min-w-0 flex-col gap-12">
							<BossCard />
							{!loaded ? <div className="fs-card h-[220px] animate-pulse" aria-hidden /> : robots.length === 0 ? <p className="fs-card p-24 text-center text-13 text-[#8c948b]">{t("emptyOffice")}</p> : <OfficeFloor onSelect={pick} />}
							{canEdit && robots.length > 0 && <p className="px-4 text-11 text-[#6b736a]">{t("dragHint")}</p>}
						</div>
						<div ref={panelRef} className="fs-scroll min-w-0 scroll-mt-16 mp:sticky mp:top-16 mp:max-h-[calc(100vh-32px)] mp:self-start mp:overflow-y-auto">
							{robot ? <RobotPanel key={robot.id} robot={robot} onClose={() => select(null)} /> : <TaskBoard />}
						</div>
					</div>
					<HireDialog open={hireOpen} onClose={() => setHireOpen(false)} />
				</DragProvider>
			)}
		</div>
	);
}
