"use client";
import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPlus, TbSettings, TbTrash, TbX } from "react-icons/tb";
import { useOfficeStore, type Robot, type Routine } from "@/store/useOfficeStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import RobotAvatar from "./RobotAvatar";
import RobotForm from "./RobotForm";
import TaskItem from "./TaskItem";
import { titleOf, viewOf } from "./theme";

const KINDS: Routine["kind"][] = ["daily", "weekdays", "weekly", "monthly"];

// Карточка выбранного робота: что он делает, новое поручение (со «шпаргалками»), режим работы, регулярные задачи, история.
export default function RobotPanel({ robot, onClose }: { robot: Robot; onClose: () => void }) {
	const t = useTranslations("office");
	const locale = useLocale();
	const { tasks, canEdit, ai, assign, update, dismiss } = useOfficeStore();
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [editing, setEditing] = useState(false);
	const [confirmDismiss, setConfirmDismiss] = useState(false);
	const [adding, setAdding] = useState(false);
	const [rt, setRt] = useState({ text: "", kind: "daily" as Routine["kind"], time: "09:00", day: 1 });
	const view = viewOf(robot, tasks);
	const mine = tasks.filter((x) => x.robot === robot.id).slice(0, 6);
	const title = titleOf(t, robot);
	const quick = robot.template !== "custom" ? [1, 2, 3].map((n) => t(`tpl_${robot.template}_s${n}`)) : [];

	async function send(value = text) {
		const v = value.trim();
		if (!v || busy) return;
		setBusy(true);
		const task = await assign(robot.id, v, locale);
		setBusy(false);
		if (task) { setText(""); toast.success(t("taskAssigned", { name: robot.name })); }
	}

	async function addRoutine() {
		if (!rt.text.trim()) return;
		const cur = robot.routines.map((r) => ({ id: r.id, text: r.text, kind: r.kind, time: r.time, ...(r.day !== undefined ? { day: r.day } : {}) }));
		const ok = await update(robot.id, { routines: [...cur, { text: rt.text, kind: rt.kind, time: rt.time, ...(rt.kind === "weekly" || rt.kind === "monthly" ? { day: rt.day } : {}) }] as never });
		if (ok) { setAdding(false); setRt({ text: "", kind: "daily", time: "09:00", day: 1 }); }
	}
	const removeRoutine = (id: string) => void update(robot.id, { routines: robot.routines.filter((r) => r.id !== id).map((r) => ({ id: r.id, text: r.text, kind: r.kind, time: r.time, ...(r.day !== undefined ? { day: r.day } : {}) })) as never });
	const routineLabel = (r: Routine) => `${t(`k_${r.kind}`)}${r.kind === "weekly" ? ` · ${t(`wd${r.day ?? 1}`)}` : r.kind === "monthly" ? ` · ${r.day ?? 1}` : ""} · ${r.time}`;

	const head = "mb-8 text-11 font-semibold uppercase tracking-[0.06em] text-[#8c948b]";
	const seg = (on: boolean) => `flex-1 rounded-8 border px-10 py-8 text-12 font-medium transition-colors disabled:opacity-60 ${on ? "border-[#c6ff4d] bg-[rgba(198,255,77,0.08)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`;

	return (
		<div className="fs-card p-16">
			<div className="flex items-start gap-12">
				<RobotAvatar accent={robot.accent} size={60} state={view.state} />
				<div className="min-w-0 flex-1">
					<p className="truncate text-16 font-semibold text-[#f1f4ee]">{robot.name}</p>
					<p className="truncate text-12 text-[#8c948b]">{title || "—"}</p>
					<p className="mt-4 text-12 font-medium" style={{ color: view.state === "working" ? "#c6ff4d" : view.state === "waiting" ? "#F4A100" : view.state === "failed" ? "#EB5757" : "#8c948b" }}>
						{view.state === "off" ? t("off") : view.state === "working" ? t("st_running") : view.state === "waiting" ? t("st_waiting") : view.state === "failed" ? t("st_failed") : t("st_idle")}
					</p>
				</div>
				<button type="button" onClick={onClose} aria-label={t("close")} className="text-[#8c948b] hover:text-[#f1f4ee]"><TbX size={18} /></button>
			</div>

			{canEdit && (
				<div className="mt-12 flex flex-wrap gap-8">
					<button type="button" onClick={() => setEditing(true)} className="fs-btn fs-btn-ghost h-32 px-12 text-12"><TbSettings size={14} aria-hidden />{t("edit")}</button>
					<button type="button" onClick={() => void update(robot.id, { enabled: !robot.enabled })} className="fs-btn fs-btn-ghost h-32 px-12 text-12">{robot.enabled ? t("switchOff") : t("switchOn")}</button>
					<button type="button" onClick={() => setConfirmDismiss(true)} className="fs-btn fs-btn-ghost h-32 px-12 text-12 text-[#EB5757]"><TbTrash size={14} aria-hidden />{t("dismiss")}</button>
				</div>
			)}

			{canEdit && robot.enabled && (
				<div className="mt-18">
					<p className={head}>{t("assignTitle")}</p>
					<textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }} rows={3} maxLength={4000} placeholder={t("assignPlaceholder")} className="fs-field fs-scroll w-full p-10 text-13 outline-none" disabled={!ai} />
					<div className="mt-8 flex justify-end"><button type="button" disabled={busy || !text.trim() || !ai} onClick={() => void send()} className="fs-btn fs-btn-primary h-36 px-16 text-12 disabled:opacity-50">{busy ? "…" : t("assign")}</button></div>
					{quick.length > 0 && (
						<div className="mt-10">
							<p className={head}>{t("tryTitle")}</p>
							<div className="flex flex-col gap-6">
								{quick.map((q) => <button key={q} type="button" disabled={busy || !ai} onClick={() => void send(q)} className="rounded-8 border border-inkLine px-10 py-7 text-left text-12 text-[#cfd4cb] transition-colors hover:border-[rgba(198,255,77,0.45)] hover:text-[#f1f4ee] disabled:opacity-50">{q}</button>)}
							</div>
						</div>
					)}
				</div>
			)}

			<div className="mt-18">
				<p className={head}>{t("autonomy")}</p>
				<div className="flex gap-8" role="radiogroup" aria-label={t("autonomy")}>
					<button type="button" role="radio" aria-checked={robot.autonomy === "ask"} disabled={!canEdit} onClick={() => void update(robot.id, { autonomy: "ask" })} className={seg(robot.autonomy === "ask")}>{t("autonomyAsk")}</button>
					<button type="button" role="radio" aria-checked={robot.autonomy === "auto"} disabled={!canEdit} onClick={() => void update(robot.id, { autonomy: "auto" })} className={seg(robot.autonomy === "auto")}>{t("autonomyAuto")}</button>
				</div>
				<p className="mt-6 text-11 text-[#8c948b]">{t("autonomyHint")}</p>
			</div>

			<div className="mt-18">
				<p className={head}>{t("skillsTitle")}</p>
				<div className="flex flex-wrap gap-6">{robot.skills.map((s) => <span key={s} className="rounded-[10px] border border-inkLine px-8 py-[2px] text-11 text-[#cfd4cb]">{t(`skill_${s}`)}</span>)}</div>
			</div>

			<div className="mt-18">
				<div className="mb-8 flex items-center justify-between">
					<p className="text-11 font-semibold uppercase tracking-[0.06em] text-[#8c948b]">{t("routinesTitle")}</p>
					{canEdit && !adding && <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-4 text-12 text-[#c6ff4d] hover:opacity-80"><TbPlus size={13} aria-hidden />{t("addRoutine")}</button>}
				</div>
				{robot.routines.length === 0 && !adding && <p className="text-12 text-[#8c948b]">{t("routinesEmpty")}</p>}
				<ul className="flex flex-col gap-6">
					{robot.routines.map((r) => (
						<li key={r.id} className="flex items-start gap-8 rounded-8 border border-inkLine px-10 py-8">
							<div className="min-w-0 flex-1"><p className="text-12 text-[#f1f4ee]">{r.text}</p><p className="mt-2 text-11 text-[#8c948b]">{routineLabel(r)}</p></div>
							{canEdit && <button type="button" onClick={() => removeRoutine(r.id)} aria-label={t("dismiss")} className="text-[#8c948b] hover:text-[#EB5757]"><TbX size={14} /></button>}
						</li>
					))}
				</ul>
				{adding && (
					<div className="mt-8 flex flex-col gap-8 rounded-8 border border-inkLine p-10">
						<textarea value={rt.text} onChange={(e) => setRt({ ...rt, text: e.target.value })} rows={2} maxLength={600} placeholder={t("routineText")} className="fs-field fs-scroll w-full p-8 text-12 outline-none" />
						<div className="flex flex-wrap items-center gap-8">
							<select value={rt.kind} onChange={(e) => setRt({ ...rt, kind: e.target.value as Routine["kind"] })} aria-label={t("routineKind")} className="fs-field h-34 px-8 text-12 outline-none">{KINDS.map((k) => <option key={k} value={k}>{t(`k_${k}`)}</option>)}</select>
							{rt.kind === "weekly" && <select value={rt.day} onChange={(e) => setRt({ ...rt, day: Number(e.target.value) })} aria-label={t("routineDay")} className="fs-field h-34 px-8 text-12 outline-none">{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{t(`wd${d}`)}</option>)}</select>}
							{rt.kind === "monthly" && <select value={rt.day} onChange={(e) => setRt({ ...rt, day: Number(e.target.value) })} aria-label={t("routineDay")} className="fs-field h-34 px-8 text-12 outline-none">{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select>}
							<span className="text-12 text-[#8c948b]">{t("routineTime")}</span>
							<input type="time" value={rt.time} onChange={(e) => setRt({ ...rt, time: e.target.value })} className="fs-field h-34 px-8 text-12 outline-none" />
						</div>
						<div className="flex justify-end gap-8">
							<button type="button" onClick={() => setAdding(false)} className="fs-btn fs-btn-ghost h-32 px-12 text-12">{t("cancel")}</button>
							<button type="button" disabled={!rt.text.trim() || !/^\d{2}:\d{2}$/.test(rt.time)} onClick={() => void addRoutine()} className="fs-btn fs-btn-primary h-32 px-12 text-12 disabled:opacity-50">{t("save")}</button>
						</div>
					</div>
				)}
			</div>

			<div className="mt-18">
				<p className={head}>{t("history")}</p>
				{mine.length === 0 ? <p className="text-12 text-[#8c948b]">{t("noHistory")}</p> : <ul className="flex flex-col gap-8">{mine.map((x) => <TaskItem key={x.id} task={x} compact />)}</ul>}
			</div>

			<Modal open={editing} onClose={() => setEditing(false)} label={t("edit")} align="top" className="w-full max-w-[640px]" flushOnMobile>
				<div className="fs-popover fs-scroll max-h-[92vh] overflow-y-auto p-18 md:p-24">
					<h2 className="mb-14 text-18 font-semibold text-[#f1f4ee]">{t("edit")}</h2>
					<RobotForm robot={robot} submitLabel={t("save")} onCancel={() => setEditing(false)} onSubmit={async (input) => { if (await update(robot.id, input)) setEditing(false); }} />
				</div>
			</Modal>
			<ConfirmDialog open={confirmDismiss} title={t("dismissTitle")} text={t("dismissText")} confirmLabel={t("dismiss")} onCancel={() => setConfirmDismiss(false)} onConfirm={() => { setConfirmDismiss(false); void dismiss(robot.id).then((ok) => ok && toast.success(t("dismissed"))); }} />
		</div>
	);
}
