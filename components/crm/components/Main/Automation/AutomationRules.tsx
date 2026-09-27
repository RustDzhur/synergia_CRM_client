"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbBolt, TbPencil, TbPlayerPlay, TbTrash } from "react-icons/tb";
import { PLANS, PlanId, planFor } from "@/app/config/plans";
import { apiCall } from "@/app/store/crmApi";
import type { Stage } from "@/app/store/useCrmStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import type { CustomTabApi } from "../shared/records/RecordsPage";
import type { RecordItem } from "../shared/records/config";
import { useSectionRecords } from "../shared/records/useSectionRecords";
import { ACTIONS, AUTOMATION, EVENTS, TIMINGS } from "./config";
import VariableHints from "./VariableHints";

const EMPTY: Record<string, string> = { name: "", event: "deal_stage", stage: "", timing: "immediately", action: "notify", message: "", target: "client", moveTo: "", url: "", enabled: "1" };
const STAGE_EVENTS = ["deal_created", "deal_stage"];

// Automation Rules: «когда (событие) → через (время) → сделать (действие)». Правила настоящие: их выполняет сервер, когда в CRM
// происходит событие (новая сделка, перенос на этап, новый контакт, письмо-лид, сообщение, пропущенный звонок, задача, дедлайн).
export default function AutomationRules({ stages }: CustomTabApi & { stages: Stage[] }) {
	const t = useTranslations("automation");
	const tUpgrade = useTranslations("upgrade");
	const locale = useLocale();
	const { records, save, remove } = useSectionRecords(AUTOMATION, "rules");
	const [editing, setEditing] = useState<{ id?: string; values: Record<string, string> } | null>(null);
	const [toDelete, setToDelete] = useState<RecordItem | null>(null);
	const [busy, setBusy] = useState(false);
	// тариф фирмы: сколько правил он разрешает (лимит проверяет и сервер — POST /api/records).
	// planKnown — тариф действительно получен: до ответа лимит неизвестен, и показывать «0 правил» нельзя
	const [plan, setPlan] = useState<PlanId>("free");
	const [planKnown, setPlanKnown] = useState(false);
	useEffect(() => {
		void apiCall<{ plan: PlanId }>("/api/billing").then((r) => { if (r.ok && r.data?.plan) { setPlan(r.data.plan); setPlanKnown(true); } });
	}, []);
	const limit = planFor(plan).automationRules;
	const planName = PLANS.find((x) => x.id === plan)?.id ?? "free";
	const sorted = [...stages].sort((a, b) => a.order - b.order);
	const stageName = (id: string) => sorted.find((s) => s._id === id)?.name ?? t("anyStage");

	const set = (k: string, v: string) => setEditing((e) => (e ? { ...e, values: { ...e.values, [k]: v } } : e));

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!editing) return;
		const v = editing.values;
		if (!v.name.trim()) return void toast.error(t("r_nameRequired"));
		if (v.action === "move_stage" && !v.moveTo) return void toast.error(t("r_moveRequired"));
		if (v.action === "webhook" && !/^https:\/\//.test(v.url)) return void toast.error(t("r_urlRequired"));
		if (v.action === "ai_action" && !v.message.trim()) return void toast.error(t("r_instructionRequired"));
		setBusy(true);
		const res = await save({ id: editing.id, values: { ...v, name: v.name.trim() } });
		setBusy(false);
		// сервер не сохранил (например, тариф не разрешает ещё одно правило) — окно оставляем открытым, чтобы правило не потерялось
		if (!res.ok) return void toast.error(res.message || t("r_saveFailed"));
		setEditing(null);
		toast.success(t("r_saved"));
	}

	async function test(r: RecordItem) {
		const res = await apiCall<{ ok: boolean; message: string }>("/api/automation/test", "POST", { id: r.id });
		if (res.data) (res.data.ok ? toast.success : toast.error)(`${t("r_testResult")}: ${res.data.message}`);
		else toast.error(res.message);
	}

	const field = "fs-field h-40 w-full px-12 text-13 outline-none";
	const label = "mb-6 block text-12 text-[#8c948b]";
	const v = editing?.values ?? EMPTY;

	return (
		<div>
			<div className="mb-16 flex flex-wrap items-center justify-between gap-12">
				<div className="max-w-[640px]">
					<p className="text-12 text-[#8c948b]">{t("r_help")}</p>
					{/* Пока тариф не получен, лимит неизвестен: строка «0 правил» до ответа сервера читалась как «правил нет».
					    Тариф без автоматизации (Free) называем прямо и не показываем «0/0» — правил не будет вовсе. */}
					{planKnown && (
						<p className="mt-6 inline-flex flex-wrap items-center rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] px-12 py-6 text-12 text-[#cfd4cb]">
							<span>{limit > 0 ? t("planBanner", { count: limit }) : t("planNone")}</span>
							<span className="mx-6 text-[#8C948B]">·</span>
							<span>{tUpgrade(planName)}</span>
							<span className="mx-6 text-[#8C948B]">·</span>
							{limit > 0
								? <span aria-label="rules-used">{records.length}/{limit}</span>
								: <Link href={`/${locale}/crm/upgrade`} className="fs-link text-12">{tUpgrade("changePlan")}</Link>}
						</p>
					)}
				</div>
				<button type="button" onClick={() => setEditing({ values: { ...EMPTY, stage: sorted[0]?._id ?? "" } })} disabled={planKnown && limit === 0} className="fs-btn fs-btn-primary h-40 disabled:cursor-default disabled:opacity-60">+ {t("r_addRule")}</button>
			</div>

			{records.length === 0 ? (
				<p className="fs-card p-24 text-center text-13 text-[#8c948b]">{t("r_empty")}</p>
			) : (
				<ul className="grid gap-12 md:grid-cols-2">
					{records.map((r) => {
						const on = r.values.enabled !== "0";
						return (
							<li key={r.id} className={`fs-card animate-fade-in p-16 ${on ? "" : "opacity-60"}`}>
								<div className="flex items-start gap-10">
									<TbBolt size={18} className="mt-2 shrink-0 text-[#F4A100]" aria-hidden />
									<div className="min-w-0 flex-1">
										<p className="truncate text-13 font-semibold text-[#f1f4ee]">{r.values.name}</p>
										<p className="mt-4 text-12 text-[#8c948b]">
											{t(`ev_${r.values.event}`)}{STAGE_EVENTS.includes(r.values.event) ? ` · ${stageName(r.values.stage)}` : ""}
											{" → "}{t(`o_${r.values.timing}`)}{" → "}<span className="font-medium text-[#c6ff4d]">{t(`ac_${r.values.action}`)}</span>
										</p>
										{r.values.message && <p className="mt-4 truncate text-11 text-[#9AA396]">{r.values.message}</p>}
									</div>
									<label className="flex shrink-0 cursor-pointer items-center gap-6 text-12 text-[#8c948b]">
										<input type="checkbox" checked={on} onChange={async (e) => save({ id: r.id, values: { ...r.values, enabled: e.target.checked ? "1" : "0" } })} className="accent-[#c6ff4d]" />
										{t("r_enabled")}
									</label>
								</div>
								<div className="mt-12 flex items-center justify-end gap-16 text-12">
									<button type="button" onClick={() => test(r)} className="flex items-center gap-4 text-[#c6ff4d] transition-opacity hover:opacity-80"><TbPlayerPlay size={16} />{t("r_test")}</button>
									<button type="button" onClick={() => setEditing({ id: r.id, values: { ...EMPTY, ...r.values } })} className="flex items-center gap-4 text-[#8c948b] transition-colors hover:text-[#c6ff4d]"><TbPencil size={16} />{t("r_edit")}</button>
									<button type="button" onClick={() => setToDelete(r)} className="flex items-center gap-4 text-[#9AA396] transition-colors hover:text-danger"><TbTrash size={16} />{t("r_delete")}</button>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			<Modal open={editing !== null} onClose={() => setEditing(null)} label={t("r_addRule")} className="w-full max-w-[520px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[calc(100vh-32px)] overflow-y-auto p-20">
					<h2 className="mb-16 text-16 font-semibold text-[#f1f4ee]">{editing?.id ? t("r_edit") : t("r_addRule")}</h2>
					<div className="flex flex-col gap-14">
						<label><span className={label}>{t("r_name")}</span><input value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={100} className={field} autoFocus /></label>
						<label><span className={label}>{t("r_when")}</span>
							<select value={v.event} onChange={(e) => set("event", e.target.value)} className={field}>{EVENTS.map((x) => <option key={x} value={x}>{t(`ev_${x}`)}</option>)}</select>
						</label>
						{STAGE_EVENTS.includes(v.event) && (
							<label><span className={label}>{t("r_stage")}</span>
								<select value={v.stage} onChange={(e) => set("stage", e.target.value)} className={field}><option value="">{t("anyStage")}</option>{sorted.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
							</label>
						)}
						<label><span className={label}>{t("r_after")}</span>
							<select value={v.timing} onChange={(e) => set("timing", e.target.value)} className={field}>{TIMINGS.map((x) => <option key={x} value={x}>{t(`o_${x}`)}</option>)}</select>
						</label>
						<label><span className={label}>{t("r_do")}</span>
							<select value={v.action} onChange={(e) => set("action", e.target.value)} className={field}>{ACTIONS.map((x) => <option key={x} value={x}>{t(`ac_${x}`)}</option>)}</select>
						</label>
						{v.action === "move_stage" && (
							<label><span className={label}>{t("r_moveTo")}</span>
								<select value={v.moveTo} onChange={(e) => set("moveTo", e.target.value)} className={field}><option value="" />{sorted.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
							</label>
						)}
						{v.action === "webhook" && <label><span className={label}>{t("r_url")}</span><input value={v.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" className={field} /></label>}
						{v.action === "send_email" && (
							<label><span className={label}>{t("r_recipient")}</span>
								<select value={v.target} onChange={(e) => set("target", e.target.value)} className={field}><option value="client">{t("r_toClient")}</option><option value="owner">{t("r_toOwner")}</option></select>
							</label>
						)}
						{v.action === "create_task" && (
							<label><span className={label}>{t("r_assignee")}</span>
								<select value={v.target} onChange={(e) => set("target", e.target.value)} className={field}><option value="manager">{t("o_manager")}</option><option value="responsible">{t("o_responsible")}</option></select>
							</label>
						)}
						{v.action === "ai_action" && <p className="rounded-10 bg-[rgba(244,161,0,0.10)] p-10 text-12 text-[#F4A100]">{t("r_aiActionWarning")}</p>}
						{v.action !== "move_stage" && (
							<>
								<label><span className={label}>{v.action === "ai_action" ? t("r_instruction") : v.action === "add_note" || v.action === "notify" ? t("r_text") : t("r_message")}</span>
									<textarea value={v.message} onChange={(e) => set("message", e.target.value)} rows={3} maxLength={1000} placeholder={v.action === "ai_action" ? t("r_instructionPlaceholder") : undefined} className="fs-field fs-scroll w-full p-10 text-13 outline-none" />
									{v.action === "ai_action" && <span className="mt-4 block text-11 text-[#9AA396]">{t("r_aiActionHint")}</span>}
								</label>
								{/* подстановки — вне <label>: клик по токену копирует его, а не переводит курсор в поле текста */}
								{v.action !== "ai_action" && <VariableHints />}
							</>
						)}
					</div>
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setEditing(null)} className="fs-btn fs-btn-ghost h-40">{t("r_cancel")}</button>
						<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : t("r_save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={toDelete !== null} title={t("r_delete")} text={t("r_deleteText", { name: toDelete?.values.name ?? "" })} onCancel={() => setToDelete(null)} onConfirm={() => { const r = toDelete; setToDelete(null); if (r) void remove([r.id]); }} />
		</div>
	);
}
