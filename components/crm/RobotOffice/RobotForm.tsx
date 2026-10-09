"use client";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { PICK_SKILLS, PICK_ZONES } from "@/lib/office/templates";
import { useOfficeStore, type Accent, type Robot, type RobotInput, type Skill, type Zone } from "@/store/useOfficeStore";
import RobotAvatar from "./RobotAvatar";
import { ACCENTS, ACCENT_HEX } from "./theme";

const ZONE_IDS: Zone[] = PICK_ZONES;

// Форма робота: и для найма своего, и для настройки готового. Для готового пустые должность и инструкция означают «как в каталоге».
export default function RobotForm({ robot, onSubmit, onCancel, submitLabel }: { robot?: Robot; onSubmit: (input: RobotInput) => Promise<void>; onCancel: () => void; submitLabel: string }) {
	const t = useTranslations("office");
	const [name, setName] = useState(robot?.name ?? "");
	const [title, setTitle] = useState(robot?.title ?? "");
	const rooms = useOfficeStore((s) => s.rooms);
	const [zone, setZone] = useState<Zone>(robot?.zone ?? "office");
	const [accent, setAccent] = useState<Accent>(robot?.accent ?? "lime");
	const [skills, setSkills] = useState<Skill[]>(robot?.skills ?? []);
	const [instructions, setInstructions] = useState(robot?.instructions ?? "");
	const [autonomy, setAutonomy] = useState<"ask" | "auto">(robot?.autonomy ?? "ask");
	const [busy, setBusy] = useState(false);
	const custom = !robot || robot.template === "custom";

	const toggle = (s: Skill) => setSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		if (!skills.length) return void toast.error(t("needSkill"));
		if (custom && !title.trim() && !instructions.trim()) return void toast.error(t("needTitle"));
		setBusy(true);
		try { await onSubmit({ name, title, zone, accent, skills, instructions, autonomy, ...(robot ? {} : { template: "custom" }) }); } finally { setBusy(false); }
	}
	const seg = (on: boolean) => `flex-1 rounded-8 border px-10 py-8 text-12 font-medium transition-colors ${on ? "border-[#c6ff4d] bg-[rgba(198,255,77,0.08)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`;
	const label = "mb-6 block text-11 font-semibold uppercase tracking-[0.06em] text-[#8c948b]";

	return (
		<form onSubmit={submit} className="flex flex-col gap-16">
			<div className="flex items-center gap-14">
				<RobotAvatar accent={accent} size={64} />
				<div className="grid flex-1 grid-cols-1 gap-10 sm:grid-cols-2">
					<div><label className={label} htmlFor="rb-name">{t("fName")}</label><input id="rb-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className="fs-field h-40 w-full px-12 text-13 outline-none" /></div>
					<div><label className={label} htmlFor="rb-title">{t("fTitle")}</label><input id="rb-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className="fs-field h-40 w-full px-12 text-13 outline-none" /></div>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-12 sm:grid-cols-2">
				<div>
					<label className={label} htmlFor="rb-zone">{t("fZone")}</label>
					<select id="rb-zone" value={zone} onChange={(e) => setZone(e.target.value as Zone)} className="fs-field h-40 w-full px-12 text-13 outline-none">
						{ZONE_IDS.map((z) => <option key={z} value={z}>{t(`zone_${z}` as never)}</option>)}
						{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
					</select>
				</div>
				<div>
					<span className={label}>{t("fColor")}</span>
					<div className="flex h-40 items-center gap-8">
						{ACCENTS.map((a) => (
							<button key={a} type="button" onClick={() => setAccent(a)} aria-label={t(`c_${a}`)} aria-pressed={accent === a} title={t(`c_${a}`)}
								className={`h-[22px] w-[22px] rounded-[7px] border-2 transition-transform ${accent === a ? "scale-110 border-[#f1f4ee]" : "border-transparent"}`} style={{ background: ACCENT_HEX[a] }} />
						))}
					</div>
				</div>
			</div>
			<div>
				<span className={label}>{t("fSkills")}</span>
				<div className="flex flex-wrap gap-8">
					{PICK_SKILLS.map((s) => (
						<button key={s} type="button" onClick={() => toggle(s)} aria-pressed={skills.includes(s)}
							className={`h-[30px] rounded-[15px] border px-12 text-12 transition-colors ${skills.includes(s) ? "border-[#c6ff4d] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>{t(`skill_${s}`)}</button>
					))}
				</div>
			</div>
			<div>
				<label className={label} htmlFor="rb-ins">{t("fInstructions")}</label>
				<textarea id="rb-ins" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1500} rows={3} placeholder={t("fInstructionsPh")} className="fs-field fs-scroll w-full p-12 text-13 outline-none" />
				{!custom && <p className="mt-6 text-11 text-[#8c948b]">{t("fInstructionsDefault")}</p>}
			</div>
			<div>
				<span className={label}>{t("autonomy")}</span>
				<div className="flex gap-8" role="radiogroup" aria-label={t("autonomy")}>
					<button type="button" role="radio" aria-checked={autonomy === "ask"} onClick={() => setAutonomy("ask")} className={seg(autonomy === "ask")}>{t("autonomyAsk")}</button>
					<button type="button" role="radio" aria-checked={autonomy === "auto"} onClick={() => setAutonomy("auto")} className={seg(autonomy === "auto")}>{t("autonomyAuto")}</button>
				</div>
				<p className="mt-6 text-11 text-[#8c948b]">{t("autonomyHint")}</p>
			</div>
			<div className="flex justify-end gap-10">
				<button type="button" onClick={onCancel} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
				<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : submitLabel}</button>
			</div>
		</form>
	);
}
