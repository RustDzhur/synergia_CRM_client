"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbMicrophone, TbPlus } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import type { RobotDraft } from "@/lib/office/hireVoice";
import { useVoiceInput } from "../AiAssistant/voice";
import { useOfficeStore } from "@/store/useOfficeStore";
import Modal from "../shared/Modal";
import RobotAvatar from "./RobotAvatar";
import RobotForm from "./RobotForm";

// Каталог ролей приходит с сервера (таблица robot_templates, фильтр по рынку фирмы). Название и описание — из записи на языке интерфейса, иначе из переводов.
// Найм голосом: диктовка → сервер разбирает её в черновик (POST /api/office/robots/parse) → предзаполненная форма, человек проверяет и нанимает.

type View = "catalog" | "custom" | "voice";

export default function HireDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const t = useTranslations("office");
	const ta = useTranslations("ai");
	const { robots, catalog, hire, maxRobots } = useOfficeStore();
	const locale = useLocale();
	const office = (useMessages() as { office?: Record<string, unknown> }).office ?? {};
	const label = (c: (typeof catalog)[number], kind: "title" | "desc") => c.texts?.[locale]?.[kind] || (typeof office[`tpl_${c.id}_${kind}`] === "string" ? t(`tpl_${c.id}_${kind}`) : kind === "title" ? c.name : "");
	const [view, setView] = useState<View>("catalog");
	const [busy, setBusy] = useState<string | null>(null);
	const [draft, setDraft] = useState<{ draft: RobotDraft; ads: { mentioned: boolean; connected: boolean } } | null>(null);
	// голос: текст диктовки, доступность серверного распознавания и разбор в черновик
	const [voiceText, setVoiceText] = useState("");
	const [stt, setStt] = useState(false);
	const [parsing, setParsing] = useState(false);
	const { state: micState, start, stop } = useVoiceInput({
		locale,
		serverStt: stt,
		onText: (full) => setVoiceText(full),
		onError: (code) => toast.error(ta(code)),
	});
	useEffect(() => {
		if (view !== "voice") return;
		setVoiceText("");
		void apiCall<{ stt?: boolean }>("/api/ai").then((r) => { if (r.ok && r.data) setStt(!!r.data.stt); });
	}, [view]);
	const full = robots.length >= maxRobots;

	async function hireTemplate(id: string) {
		setBusy(id);
		const r = await hire({ template: id });
		setBusy(null);
		if (r) { toast.success(t("hired", { name: r.name })); close(); }
	}
	async function parseVoice() {
		if (parsing) return;
		const text = voiceText.trim();
		if (!text) return void toast.error(t("voiceEmpty"));
		setParsing(true);
		const res = await apiCall<{ draft: RobotDraft; ads: { mentioned: boolean; connected: boolean } }>("/api/office/robots/parse", "POST", { text });
		setParsing(false);
		if (!res.ok || !res.data) return void toast.error(res.message || t("voiceFail"));
		setDraft(res.data);
		setView("custom");
	}
	const close = () => { setView("catalog"); setDraft(null); onClose(); };
	const toCatalog = () => { setView("catalog"); setDraft(null); };

	return (
		<Modal open={open} onClose={close} label={t("hireTitle")} align="top" className="w-full max-w-[860px]" flushOnMobile>
			<div className="fs-popover fs-scroll max-h-[92vh] overflow-y-auto p-18 md:p-24">
				<div className="mb-4 flex items-start justify-between gap-12">
					<div>
						<h2 className="text-18 font-semibold text-[#edf2ff]">{view === "custom" ? t("customTitle") : view === "voice" ? t("hireVoice") : t("hireTitle")}</h2>
						<p className="mt-4 text-13 text-[#9aa7c9]">{view === "custom" ? t("customHint") : view === "voice" ? t("voiceHint") : t("hireHint")}</p>
					</div>
					<button type="button" onClick={close} className="shrink-0 text-13 text-[#9aa7c9] hover:text-[#edf2ff]">{t("close")}</button>
				</div>

				{view === "custom" ? (
					<div className="mt-16">
						<RobotForm
							initial={draft ? { name: draft.draft.name, title: draft.draft.title, zone: draft.draft.zone, accent: draft.draft.accent, skills: draft.draft.skills, instructions: draft.draft.instructions, routines: draft.draft.routines } : undefined}
							adsWarn={draft && draft.ads.mentioned && !draft.ads.connected ? t("voiceAdsWarn") : undefined}
							submitLabel={t("create")}
							onCancel={toCatalog}
							onSubmit={async (input) => { const r = await hire(input); if (r) { toast.success(t("hired", { name: r.name })); close(); } }}
						/>
					</div>
				) : view === "voice" ? (
					<div className="mt-16 flex flex-col gap-14">
						<button
							type="button"
							disabled={full || parsing}
							onClick={() => (micState === "idle" ? void start(voiceText) : stop())}
							aria-pressed={micState !== "idle"}
							className={`fs-card flex w-full items-center justify-center gap-10 border-dashed p-14 text-14 font-medium transition-colors disabled:opacity-50 ${micState !== "idle" ? "border-[rgba(124,147,255,0.5)] bg-[rgba(124,147,255,0.08)] text-[#7c93ff]" : "text-[#cfd4cb] hover:text-[#7c93ff]"}`}>
							<TbMicrophone size={18} aria-hidden />
							{micState === "idle" ? ta("mic") : ta("micStop")}
						</button>
						<p className="text-12 text-[#9aa7c9]">{micState === "listening" ? ta("micListening") : micState === "transcribing" ? ta("micTranscribing") : ""}</p>
						<div>
							<label className="mb-6 block text-11 font-semibold uppercase tracking-[0.06em] text-[#9aa7c9]" htmlFor="rb-voice">{t("voiceText")}</label>
							<textarea id="rb-voice" value={voiceText} onChange={(e) => setVoiceText(e.target.value)} rows={4} placeholder={t("voiceHint")} className="fs-field fs-scroll w-full p-12 text-13 outline-none" />
						</div>
						<div className="flex justify-end gap-10">
							<button type="button" onClick={toCatalog} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
							<button type="button" disabled={parsing || full} onClick={() => void parseVoice()} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{parsing ? t("voiceParsing") : t("voiceParse")}</button>
						</div>
					</div>
				) : (
					<>
						<ul className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2">
							{catalog.map((c) => {
								const have = robots.filter((r) => r.template === c.id).length;
								return (
									<li key={c.id} className="fs-card flex gap-12 p-14">
										<RobotAvatar accent={c.accent} size={52} />
										<div className="min-w-0 flex-1">
											<p className="text-14 font-semibold text-[#edf2ff]">{label(c, "title")}</p>
											<p className="mt-2 text-12 text-[#9aa7c9]">{label(c, "desc")}</p>
											<div className="mt-8 flex flex-wrap gap-4">{c.skills.map((s) => <span key={s} className="rounded-[10px] border border-inkLine px-8 py-[2px] text-10 text-[#9aa7c9]">{t(`skill_${s}`)}</span>)}</div>
											<div className="mt-10 flex items-center justify-between gap-8">
												<span className="text-11 text-[#9aa7c9]">{have > 0 ? t("alreadyHired", { n: have }) : ""}</span>
												<button type="button" disabled={full || busy !== null} onClick={() => void hireTemplate(c.id)} className="fs-btn fs-btn-ghost h-32 px-14 text-12 disabled:opacity-50">{busy === c.id ? "…" : t("hireNow")}</button>
											</div>
										</div>
									</li>
								);
							})}
						</ul>
						<div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-2">
							<button type="button" disabled={full} onClick={() => setView("voice")} className="fs-card flex w-full items-center justify-center gap-8 border-dashed p-14 text-13 font-medium text-[#cfd4cb] transition-colors hover:text-[#7c93ff] disabled:opacity-50"><TbMicrophone size={16} aria-hidden />{t("hireVoice")}</button>
							<button type="button" disabled={full} onClick={() => setView("custom")} className="fs-card flex w-full items-center justify-center gap-8 border-dashed p-14 text-13 font-medium text-[#cfd4cb] transition-colors hover:text-[#7c93ff] disabled:opacity-50"><TbPlus size={16} aria-hidden />{t("customTitle")}</button>
						</div>
					</>
				)}
			</div>
		</Modal>
	);
}
