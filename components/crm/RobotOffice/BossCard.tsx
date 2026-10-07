"use client";
import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { useOfficeStore } from "@/store/useOfficeStore";
import RobotAvatar from "./RobotAvatar";

// Начальник офиса — Айрис. Человек даёт ей поручение обычными словами, она сама делит его и раздаёт роботам (см. lib/office/templates.ts, bossPersona).
export default function BossCard() {
	const t = useTranslations("office");
	const tn = useTranslations("navigation");
	const locale = useLocale();
	const { tasks, robots, canEdit, ai, assign } = useOfficeStore();
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const working = tasks.some((x) => x.robot === "iris" && (x.status === "running" || x.status === "queued"));
	const n = (s: string) => tasks.filter((x) => (s === "work" ? x.status === "running" || x.status === "queued" : x.status === s)).length;

	async function send() {
		const v = text.trim();
		if (!v || busy) return;
		setBusy(true);
		const task = await assign("iris", v, locale);
		setBusy(false);
		if (task) { setText(""); toast.success(t("taskAssigned", { name: "Iris" })); }
	}

	return (
		<div className="fs-card p-16 md:p-18">
			<div className="flex flex-col gap-14">
				<div className="flex items-center gap-14">
					<RobotAvatar accent="lime" size={72} boss state={working ? "working" : "idle"} />
					<div className="min-w-0">
						<p className="text-16 font-semibold text-[#f1f4ee]">{locale === "ua" ? "Айріс" : "Iris"}</p>
						<p className="text-12 text-[#8c948b]">{t("bossRole")}</p>
						<p className="mt-4 text-11 font-medium" style={{ color: working ? "#c6ff4d" : "#8c948b" }}>{working ? t("st_running") : t("st_idle")}</p>
					</div>
				</div>
				<div className="min-w-0 flex-1">
					<p className="mb-6 text-12 text-[#8c948b]">{t("bossHint")}</p>
					{canEdit ? (
						<div className="flex flex-col gap-8">
							<textarea id="boss-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} rows={2} maxLength={4000} disabled={!ai || robots.length === 0} placeholder={t("bossPlaceholder")} aria-label={tn("automation")} className="fs-field fs-scroll min-h-[56px] flex-1 resize-none p-10 text-13 outline-none disabled:opacity-60" />
							<button type="button" onClick={() => void send()} disabled={busy || !text.trim() || !ai || robots.length === 0} className="fs-btn fs-btn-primary h-40 w-full shrink-0 px-18 disabled:opacity-50">{busy ? "…" : t("send")}</button>
						</div>
					) : <p className="text-12 text-[#8c948b]">{t("readOnly")}</p>}
					{!ai && <p className="mt-8 text-12 text-[#F4A100]">{t("notConfigured")}</p>}
				</div>
			</div>
			<div className="mt-14 flex flex-wrap gap-8 border-t border-inkLine pt-12">
				<span className="fs-chip" style={{ color: n("work") ? "#c6ff4d" : undefined }}>{t("statWorking", { n: n("work") })}</span>
				<span className="fs-chip" style={{ color: n("waiting") ? "#F4A100" : undefined }}>{t("statWaiting", { n: n("waiting") })}</span>
				<span className="fs-chip">{t("statDone", { n: n("done") })}</span>
			</div>
		</div>
	);
}
