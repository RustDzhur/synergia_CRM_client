"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbLayoutGrid, TbPlus, TbBuildingSkyscraper, TbDoor } from "react-icons/tb";
import { useOfficeStore } from "@/store/useOfficeStore";
import PageHeader from "../shared/PageHeader";
import BossCard from "./BossCard";
import { DragProvider, type DragPayload, type DropTarget } from "./dragKit";
import HireDialog from "./HireDialog";
import RoomsDialog from "./RoomsDialog";
import { trRooms } from "./roomsUi";
import OfficeFloor from "./OfficeFloor";
import RobotPanel from "./RobotPanel";
import OfficeScene from "./scene/OfficeScene";
import TaskBoard from "./TaskBoard";

const VIEW_KEY = "crm.office.view";

// Робот-офис (/crm/automation): изометрический план офиса с комнатами и рабочими местами роботов, во главе — Айрис.
// Прежние правила «событие → действие» из этого раздела убраны: работу делают роботы. «Список» — тот же офис карточками (удобно на телефоне).
export default function RobotOffice() {
	const t = useTranslations("office");
	const { robots, selected, select, load, loaded, canEdit, update, reassign, tasks } = useOfficeStore();
	const [view, setView] = useState<"scene" | "list">("scene");
	const [hireOpen, setHireOpen] = useState(false);
	const [roomsOpen, setRoomsOpen] = useState(false);
	const trR = trRooms(useLocale());
	const panelRef = useRef<HTMLDivElement>(null);
	const busy = tasks.some((x) => x.status === "running" || x.status === "queued");

	useEffect(() => {
		try {
			const saved = localStorage.getItem(VIEW_KEY);
			setView(saved === "list" || saved === "scene" ? saved : window.innerWidth < 768 ? "list" : "scene");
		} catch { /* приватный режим */ }
	}, []);
	const changeView = (v: "scene" | "list") => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* приватный режим */ } };

	// Опрос: пока кто-то работает — каждые 2,5 с, в покое — реже; в скрытой вкладке браузера не опрашиваем
	useEffect(() => {
		let stop = false, first = true;
		let timer: ReturnType<typeof setTimeout>;
		const tick = async () => {
			if (stop) return;
			if (first || !document.hidden) { first = false; await load(); } // первая загрузка — всегда, дальше скрытую вкладку не опрашиваем
			timer = setTimeout(tick, useOfficeStore.getState().tasks.some((x) => x.status === "running" || x.status === "queued") ? 2500 : 12000);
		};
		void tick();
		const onVisible = () => { if (!document.hidden) { clearTimeout(timer); void tick(); } };
		document.addEventListener("visibilitychange", onVisible);
		return () => { stop = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
	}, [load, busy]);

	const onDrop = useCallback((p: DragPayload, target: DropTarget) => {
		if (p.kind === "robot" && target.type === "zone") void update(p.id, { zone: target.id as never });
		if (p.kind === "task" && target.type === "robot") void reassign(p.id, target.id).then((ok) => ok && toast.success(t("taskAssigned", { name: target.id === "iris" ? "Ayris" : useOfficeStore.getState().robots.find((r) => r.id === target.id)?.name ?? "" })));
	}, [update, reassign, t]);

	const pick = (id: string) => {
		select(id);
		if (typeof window !== "undefined" && window.innerWidth < 900) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
	};
	const focusBoss = () => { const el = document.getElementById("boss-input") as HTMLTextAreaElement | null; el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus(); };
	const robot = robots.find((r) => r.id === selected) ?? null;
	const seg = (on: boolean) => `flex h-34 items-center gap-6 rounded-50 px-14 text-12 font-medium transition-colors ${on ? "bg-[#c6ff4d] text-[#0a0c0b]" : "text-[#8c948b] hover:text-[#f1f4ee]"}`;

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader subtitle={t("subtitle")} right={canEdit ? <button type="button" onClick={() => setHireOpen(true)} className="fs-btn fs-btn-primary h-40"><TbPlus size={16} aria-hidden />{t("hire")}</button> : undefined} />
			<DragProvider onDrop={onDrop}>
				<div className="grid min-w-0 items-start gap-12 min-[1240px]:grid-cols-[minmax(0,1fr)_340px]">
					<div className="flex min-w-0 flex-col gap-12">
						<div className="flex items-center justify-between gap-12">
							<p className="min-w-0 truncate px-4 text-12 text-[#8c948b]">{canEdit && robots.length > 0 ? t("dragHint") : ""}</p>
							<div className="flex shrink-0 items-center gap-8">
								{canEdit && <button type="button" onClick={() => setRoomsOpen(true)} className="fs-btn fs-btn-ghost h-38 px-14 text-12"><TbDoor size={15} aria-hidden />{trR("rooms")}</button>}
							<div className="flex shrink-0 rounded-50 border border-inkLine bg-[rgba(255,255,255,0.03)] p-2" role="tablist" aria-label={t("title")}>
								<button type="button" role="tab" aria-selected={view === "scene"} onClick={() => changeView("scene")} className={seg(view === "scene")}><TbBuildingSkyscraper size={15} aria-hidden />{t("viewScene")}</button>
								<button type="button" role="tab" aria-selected={view === "list"} onClick={() => changeView("list")} className={seg(view === "list")}><TbLayoutGrid size={15} aria-hidden />{t("viewList")}</button>
							</div>
							</div>
						</div>
						{!loaded ? <div className="fs-card h-[320px] animate-pulse" aria-hidden /> : robots.length === 0 ? <p className="fs-card p-24 text-center text-13 text-[#8c948b]">{t("emptyOffice")}</p> : view === "scene" ? <OfficeScene onSelect={pick} onBoss={focusBoss} /> : <OfficeFloor onSelect={pick} />}
					</div>
					{/* справа: поручение Айрис и доска поручений — карточку с доски можно перетащить на робота в офисе; выбранный робот открывается вместо доски */}
					<div ref={panelRef} className="flex min-w-0 scroll-mt-16 flex-col gap-12">
						<BossCard />
						{robot ? <RobotPanel key={robot.id} robot={robot} onClose={() => select(null)} /> : <TaskBoard />}
					</div>
				</div>
				<HireDialog open={hireOpen} onClose={() => setHireOpen(false)} />
				<RoomsDialog open={roomsOpen} onClose={() => setRoomsOpen(false)} />
			</DragProvider>
		</div>
	);
}
