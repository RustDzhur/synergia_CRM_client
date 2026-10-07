"use client";
import React from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbBriefcase, TbBuildingWarehouse, TbBuildingSkyscraper, TbHeadset, TbReceipt2, TbSpeakerphone } from "react-icons/tb";
import type { IconType } from "react-icons";
import { ZONES } from "@/lib/office/templates";
import { useOfficeStore, type Robot, type Zone } from "@/store/useOfficeStore";
import { useDragKit } from "./dragKit";
import RobotAvatar from "./RobotAvatar";
import { type RobotView, titleOf, viewOf } from "./theme";

const ZONE_ICON: Record<Zone, IconType> = { sales: TbBriefcase, finance: TbReceipt2, warehouse: TbBuildingWarehouse, office: TbBuildingSkyscraper, marketing: TbSpeakerphone, service: TbHeadset };
const MAX_FILE = 40 * 1024;
const TEXT_FILE = /\.(txt|csv|tsv|md|json|xml|log)$/i;

const STATE_COLOR: Record<RobotView["state"], string> = { idle: "#8c948b", working: "#c6ff4d", waiting: "#F4A100", failed: "#EB5757", off: "#8c948b" };

// Один робот на «этаже»: фигурка, имя, должность и короткий статус. Нажатие выбирает, перетаскивание переносит в другую комнату,
// на него можно бросить поручение с доски или текстовый файл — робот начнёт работу.
function RobotTile({ robot, view, selected, onSelect }: { robot: Robot; view: RobotView; selected: boolean; onSelect: () => void }) {
	const t = useTranslations("office");
	const locale = useLocale();
	const drag = useDragKit();
	const { canEdit, assign, ai } = useOfficeStore();
	const over = drag.over?.type === "robot" && drag.over.id === robot.id;
	const status = view.state === "off" ? t("off") : view.state === "working" ? t("st_running") : view.state === "waiting" ? t("st_waiting_short") : view.state === "failed" ? t("st_failed") : t("st_idle");

	async function onFile(file: File) {
		if (file.size > MAX_FILE) return void toast.error(t("fileTooBig"));
		if (!(TEXT_FILE.test(file.name) || file.type.startsWith("text/"))) return void toast.error(t("fileNotText"));
		const body = (await file.text()).slice(0, MAX_FILE);
		const task = await assign(robot.id, `${t("fileTask", { name: file.name })}\n\n${body}`, locale, "drop");
		if (task) toast.success(t("taskAssigned", { name: robot.name }));
	}

	return (
		<div
			role="button" tabIndex={0} aria-pressed={selected} aria-label={`${robot.name}, ${status}`}
			data-drop-robot={robot.id}
			onClick={() => { if (!drag.justDragged()) onSelect(); }}
			onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
			onPointerDown={canEdit ? (e) => drag.start(e, { kind: "robot", id: robot.id, label: robot.name }) : undefined}
			onDragOver={(e) => { if (canEdit && ai && e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
			onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f && canEdit && ai) { e.preventDefault(); void onFile(f); } }}
			className={`relative flex w-[104px] cursor-pointer select-none touch-pan-y flex-col items-center rounded-[12px] border px-6 py-10 text-center outline-none transition-colors focus-visible:border-[#c6ff4d] ${selected ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.05)]" : over ? "border-[#c6ff4d] bg-[rgba(198,255,77,0.10)]" : "border-transparent hover:bg-[rgba(255,255,255,0.04)]"}`}>
			<div className="relative">
				<RobotAvatar accent={robot.accent} size={54} state={view.state} />
				{(view.waiting > 0 || view.queued > 0) && (
					<span className="absolute -right-6 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] px-4 text-10 font-bold text-[#0a0c0b]" style={{ background: view.waiting > 0 ? "#F4A100" : "#c6ff4d" }}>{view.waiting > 0 ? view.waiting : view.queued}</span>
				)}
			</div>
			<p className="mt-6 w-full truncate text-13 font-semibold text-[#f1f4ee]">{robot.name}</p>
			<p className="line-clamp-2 w-full break-words text-11 leading-[1.25] text-[#8c948b]">{titleOf(t, robot) || "—"}</p>
			<p className="mt-4 w-full truncate text-11 font-medium" style={{ color: STATE_COLOR[view.state] }}>{status}</p>
		</div>
	);
}

export default function OfficeFloor({ onSelect }: { onSelect: (id: string) => void }) {
	const t = useTranslations("office");
	const { robots, tasks, selected } = useOfficeStore();
	const drag = useDragKit();
	const now = Date.now();

	return (
		<div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-12">
			{ZONES.map((z) => {
				const Icon = ZONE_ICON[z];
				const here = robots.filter((r) => r.zone === z);
				const overZone = drag.payload?.kind === "robot" && drag.over?.type === "zone" && drag.over.id === z;
				return (
					<section key={z} data-drop-zone={z} aria-label={t(`zone_${z}`)}
						className={`fs-card p-12 transition-colors ${overZone ? "!border-[rgba(198,255,77,0.6)] bg-[rgba(198,255,77,0.04)]" : ""} ${here.length === 0 ? "min-h-[92px]" : ""}`}>
						<header className="mb-6 flex items-center gap-8 px-4 text-12 font-semibold text-[#cfd4cb]">
							<Icon size={15} className="text-[#8c948b]" aria-hidden />
							{t(`zone_${z}`)}
							<span className="ml-auto text-11 font-normal text-[#8c948b]">{here.length}</span>
						</header>
						{here.length === 0 ? <p className="px-4 text-12 text-[#6b736a]">{t("emptyZone")}</p> : (
							<div className="flex flex-wrap gap-4">
								{here.map((r) => <RobotTile key={r.id} robot={r} view={viewOf(r, tasks, now)} selected={selected === r.id} onSelect={() => onSelect(r.id)} />)}
							</div>
						)}
					</section>
				);
			})}
		</div>
	);
}
