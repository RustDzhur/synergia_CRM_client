"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MdCheckCircle, MdErrorOutline } from "react-icons/md";
import { TbMessageCircle, TbPower, TbSettings } from "react-icons/tb";
import { useAiStore } from "@/store/useAiStore";
import VoiceOrb, { type OrbState } from "./VoiceOrb";
import { VOICE_LANGS, stopSpeech } from "./speech";
import type { useVoiceAgent } from "./useVoiceAgent";

type Agent = ReturnType<typeof useVoiceAgent>;

/** Значение аргумента действия для карточки: строки счёта читаются как «2 × Услуга — 100», а не «[object Object]». */
export function formatActionValue(v: unknown): string {
	if (Array.isArray(v)) {
		return v.map((x) => {
			if (x && typeof x === "object") {
				const o = x as { description?: unknown; product?: unknown; qty?: unknown; unitPrice?: unknown; price?: unknown };
				const price = Number(o.unitPrice ?? o.price);
				return `${Number(o.qty) || 1} × ${String(o.description ?? o.product ?? "")}${price ? ` — ${price}` : ""}`;
			}
			return String(x);
		}).join("; ");
	}
	return String(v).replace("T", " ");
}

export const ORB_BY_PHASE: Record<Agent["phase"], OrbState> = { off: "idle", sleeping: "idle", listening: "listening", thinking: "thinking", speaking: "speaking" };

// Панель голосового управления: живёт внизу экрана на любой странице кабинета, пока Айрис включена.
// Показывает, что она сейчас делает (ждёт имя / слушает / думает / говорит), что услышала, её ответ и
// подготовленное действие с кнопками — те же «да»/«нет» можно сказать голосом.
export default function VoiceHud({ agent, onOpenChat }: { agent: Agent; onOpenChat: () => void }) {
	const t = useTranslations("ai");
	const router = useRouter();
	const locale = useLocale();
	const { confirm, cancel, hide } = useAiStore();
	const [settings, setSettings] = useState(false);
	const { phase, lastAssistant, pending } = agent;
	if (!agent.enabled) return null;

	const status = phase === "sleeping" ? t("agentSleeping") : t(`voice_${phase === "off" ? "listening" : phase}`);
	const reply = lastAssistant?.voice && !lastAssistant.error && phase !== "sleeping" ? lastAssistant.text : "";
	const results = lastAssistant?.voice ? (lastAssistant.actions ?? []).filter((a) => a.state === "done" || a.state === "failed") : [];

	return (
		<div className="pointer-events-none fixed inset-x-16 bottom-16 z-[85] flex justify-center">
			<div className="fs-popover pointer-events-auto w-full max-w-[480px] p-12" role="region" aria-label={t("agentTitle")}>
				<div className="flex items-center gap-12">
					<button type="button" onClick={() => stopSpeech()} aria-label={status} title={status} className="shrink-0 rounded-full">
						<VoiceOrb size={44} state={ORB_BY_PHASE[phase]} />
					</button>
					<div className="min-w-0 flex-1">
						<p className="text-13 text-[#f1f4ee]">{status}</p>
						<p className="truncate text-12 text-[#8c948b]">
							{agent.caption || (pending.length ? t("agentSay") : phase === "sleeping" ? t("agentTry") : " ")}
						</p>
					</div>
					<button type="button" onClick={() => setSettings((v) => !v)} aria-pressed={settings} aria-label={t("agentSettings")} title={t("agentSettings")} className="flex h-30 w-30 items-center justify-center rounded-8 text-[#8c948b] transition-colors hover:text-[#f1f4ee]"><TbSettings size={16} aria-hidden /></button>
					<button type="button" onClick={onOpenChat} aria-label={t("agentChat")} title={t("agentChat")} className="flex h-30 w-30 items-center justify-center rounded-8 text-[#8c948b] transition-colors hover:text-[#f1f4ee]"><TbMessageCircle size={16} aria-hidden /></button>
					<button type="button" onClick={() => agent.setEnabled(false, false)} aria-label={t("agentOffBtn")} title={t("agentOffBtn")} className="flex h-30 w-30 items-center justify-center rounded-8 text-[#8c948b] transition-colors hover:text-danger"><TbPower size={16} aria-hidden /></button>
				</div>

				{agent.audioBlocked && <p className="mt-8 text-12 text-[#f4a100]">{t("agentUnlock")}</p>}
				{reply && <p className="mt-10 max-h-[4.6em] overflow-hidden text-13 text-[#cfd4cb]">{reply}</p>}

				{pending.map((a) => (
					<div key={a.id} className="mt-10 rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-10">
						<p className="text-13 font-medium text-[#f1f4ee]">{t(`act_${a.tool}`)}{a.target ? `: ${a.target}` : ""}</p>
						<dl className="mt-6 grid gap-x-10 gap-y-[2px] text-12 grid-cols-[auto_minmax(0,1fr)]">
							{Object.entries(a.args).filter(([k, v]) => k !== "id" && !k.endsWith("_id") && v !== "" && v !== undefined).map(([k, v]) => (
								<React.Fragment key={k}>
									<dt className="text-[#8c948b]">{t(`f_${k}`)}</dt>
									<dd className="min-w-0 break-words text-[#cfd4cb]">{formatActionValue(v)}</dd>
								</React.Fragment>
							))}
						</dl>
						<div className="mt-10 flex gap-8">
							<button type="button" onClick={() => lastAssistant && void confirm(lastAssistant.id, a.id)} className="fs-btn fs-btn-primary h-30 px-12 text-12">{t(a.tool === "send_email" ? "send" : "confirm")}</button>
							<button type="button" onClick={() => lastAssistant && cancel(lastAssistant.id, a.id)} className="fs-btn fs-btn-ghost h-30 px-12 text-12">{t("cancel")}</button>
						</div>
					</div>
				))}

				{results.map((a) => (
					<p key={a.id} className={`mt-10 flex flex-wrap items-center gap-8 text-13 ${a.state === "done" ? "text-[#c6ff4d]" : "text-danger"}`}>
						{a.state === "done" ? <MdCheckCircle size={16} aria-hidden /> : <MdErrorOutline size={16} aria-hidden />}
						{a.state === "done" ? t(`done_${a.tool}`, a.params ?? {}) : a.message}
						{a.state === "done" && a.link && <button type="button" onClick={() => { hide(); router.push(`/${locale}${a.link}`); }} className="font-medium text-primaryColor hover:underline">{t("open")}</button>}
					</p>
				))}

				{settings && (
					<div className="mt-12 grid gap-10 border-t border-inkLine pt-12 text-12 text-[#cfd4cb]">
						<label className="flex items-center justify-between gap-12">
							<span>{t("agentLang")}</span>
							<select value={agent.lang} onChange={(e) => agent.setLang(e.target.value as (typeof VOICE_LANGS)[number])} className="fs-field h-30 px-8 text-12 outline-none">
								{VOICE_LANGS.map((l) => <option key={l} value={l}>{t(`agentLang_${l}`)}</option>)}
							</select>
						</label>
						<label className="flex items-center justify-between gap-12">
							<span>{t("agentVoice")}</span>
							<select value={agent.gender} onChange={(e) => agent.setGender(e.target.value === "m" ? "m" : "f")} className="fs-field h-30 px-8 text-12 outline-none">
								<option value="f">{t("agentFemale")}</option>
								<option value="m">{t("agentMale")}</option>
							</select>
						</label>
						<label className="flex items-center justify-between gap-12">
							<span>{t("agentWakeOnly")}</span>
							<input type="checkbox" checked={agent.requireWake} onChange={(e) => agent.setRequireWake(e.target.checked)} className="h-16 w-16 accent-[#c6ff4d]" />
						</label>
					</div>
				)}
			</div>
		</div>
	);
}
