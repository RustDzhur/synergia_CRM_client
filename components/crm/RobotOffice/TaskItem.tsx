"use client";
import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbAlertTriangle, TbCheck, TbChevronDown, TbLoader2 } from "react-icons/tb";
import { useOfficeStore, type OfficeTask } from "@/store/useOfficeStore";
import { localeTag } from "@/utils/dateHelpers";
import { useDragKit } from "./dragKit";
import { STATUS_COLOR } from "./theme";
import { useActionLabel } from "./useActionLabel";

// Одно поручение: кто делает, что, на каком этапе. Нажатие раскрывает отчёт робота; если он ждёт «да» — кнопки решения прямо в карточке.
// Не начатое, ждущее и неудавшееся поручение можно перетащить на другого робота.
export default function TaskItem({ task, compact = false }: { task: OfficeTask; compact?: boolean }) {
	const t = useTranslations("office");
	const locale = useLocale();
	const label = useActionLabel();
	const { decide, assign, canEdit } = useOfficeStore();
	const drag = useDragKit();
	const [open, setOpen] = useState(task.status === "waiting");
	const [busy, setBusy] = useState(false);
	const time = new Date(task.createdAt).toLocaleTimeString(localeTag(locale), { hour: "2-digit", minute: "2-digit" });
	const color = STATUS_COLOR[task.status];
	const movable = canEdit && task.status !== "running";

	const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
	const Icon = task.status === "running" || task.status === "queued" ? TbLoader2 : task.status === "done" ? TbCheck : task.status === "waiting" || task.status === "failed" ? TbAlertTriangle : null;

	return (
		<li
			className={`fs-card ${compact ? "p-10" : "p-12"} ${movable ? "touch-pan-y" : ""}`}
			onPointerDown={movable ? (e) => { if ((e.target as HTMLElement).closest("[data-nodrag]")) return; drag.start(e, { kind: "task", id: task.id, label: `${task.robotName}: ${task.text.slice(0, 60)}` }); } : undefined}>
			<button type="button" onClick={() => { if (!drag.justDragged()) setOpen(!open); }} className="flex w-full select-none items-start gap-10 text-left" aria-expanded={open}>
				<span className="mt-[3px] flex h-[16px] w-[16px] shrink-0 items-center justify-center" style={{ color }}>
					{Icon ? <Icon size={15} className={task.status === "running" ? "animate-spin" : ""} aria-hidden /> : <span className="h-[8px] w-[8px] rounded-full" style={{ background: color }} />}
				</span>
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-8 text-12 text-[#8c948b]">
						<span className="font-semibold text-[#f1f4ee]">{task.robotName}</span>
						{task.source === "iris" && <span>· {t("sourceIris")}</span>}
						{task.source === "routine" && <span>· {t("sourceRoutine")}</span>}
						<span className="ml-auto shrink-0">{time}</span>
					</span>
					<span className="mt-[3px] line-clamp-2 block text-13 text-[#cfd4cb]">{task.text}</span>
					<span className="mt-[4px] block text-11 font-medium" style={{ color }}>{t(`st_${task.status}`)}</span>
				</span>
				<TbChevronDown size={14} className={`mt-[3px] shrink-0 text-[#8c948b] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
			</button>

			{open && (
				<div className="mt-10 border-t border-inkLine pt-10 text-12">
					{task.error && <p className="mb-8 text-[#EB5757]">{task.error}</p>}
					{task.reply ? <p className="whitespace-pre-wrap text-[#cfd4cb]">{task.reply}</p> : !task.error && task.status !== "running" && task.status !== "queued" && <p className="text-[#8c948b]">{t("noReply")}</p>}

					{task.pending.length > 0 && (
						<div className="mt-10">
							<p className="mb-6 font-medium text-[#F4A100]">{t("proposed")}</p>
							<ul className="flex flex-col gap-4">
								{task.pending.map((a) => <li key={a.id} className="rounded-8 bg-[rgba(244,161,0,0.08)] px-10 py-6 text-[#f1f4ee]">{label(a)}</li>)}
							</ul>
						</div>
					)}
					{task.executed.length > 0 && (
						<div className="mt-10">
							<p className="mb-6 font-medium text-[#8c948b]">{t("didIt")}</p>
							<ul className="flex flex-col gap-4">
								{task.executed.map((a) => <li key={a.id} className={`rounded-8 px-10 py-6 ${a.state === "failed" ? "bg-[rgba(235,87,87,0.10)] text-[#EB5757]" : "bg-[rgba(45,222,182,0.08)] text-[#cfd4cb]"}`}>{a.state === "failed" ? `${label(a)} — ${a.message ?? ""}` : label(a)}</li>)}
							</ul>
						</div>
					)}

					{canEdit && (
						<div data-nodrag className="mt-12 flex flex-wrap gap-8">
							{task.status === "waiting" && (
								<>
									<button type="button" disabled={busy} onClick={() => run(() => decide(task.id, "confirm"))} className="fs-btn fs-btn-primary h-34 px-14 text-12 disabled:opacity-60">{t("confirmAll")}</button>
									<button type="button" disabled={busy} onClick={() => run(() => decide(task.id, "reject"))} className="fs-btn fs-btn-ghost h-34 px-14 text-12 disabled:opacity-60">{t("reject")}</button>
								</>
							)}
							{task.status === "queued" && <button type="button" disabled={busy} onClick={() => run(() => decide(task.id, "cancel"))} className="fs-btn fs-btn-ghost h-34 px-14 text-12 disabled:opacity-60">{t("cancelTask")}</button>}
							{(task.status === "failed" || task.status === "cancelled") && task.robot !== "iris" && (
								<button type="button" disabled={busy} onClick={() => run(() => assign(task.robot, task.text, locale))} className="fs-btn fs-btn-ghost h-34 px-14 text-12 disabled:opacity-60">{t("retry")}</button>
							)}
						</div>
					)}
				</div>
			)}
		</li>
	);
}
