"use client";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdBolt, MdDelete, MdEdit, MdPlayArrow } from "react-icons/md";
import { apiCall } from "@/app/store/crmApi";
import type { Stage } from "@/app/store/useCrmStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import type { CustomTabApi } from "../shared/records/RecordsPage";
import type { RecordItem } from "../shared/records/config";
import { useSectionRecords } from "../shared/records/useSectionRecords";
import { ACTIONS, AUTOMATION, EVENTS, TIMINGS } from "./config";

const EMPTY: Record<string, string> = { name: "", event: "deal_stage", stage: "", timing: "immediately", action: "notify", message: "", target: "client", moveTo: "", url: "", enabled: "1" };
const STAGE_EVENTS = ["deal_created", "deal_stage"];
const VARS = "{{deal.name}} {{deal.stageName}} {{contact.name}} {{message.text}} {{task.title}} {{constants.NAME}} {{variables.name}}";

// Automation Rules: «когда (событие) → через (время) → сделать (действие)». Правила настоящие: их выполняет сервер, когда в CRM
// происходит событие (новая сделка, перенос на этап, новый контакт, письмо-лид, сообщение, пропущенный звонок, задача, дедлайн).
export default function AutomationRules({ stages }: CustomTabApi & { stages: Stage[] }) {
	const t = useTranslations("automation");
	const { records, save, remove } = useSectionRecords(AUTOMATION, "rules");
	const [editing, setEditing] = useState<{ id?: string; values: Record<string, string> } | null>(null);
	const [toDelete, setToDelete] = useState<RecordItem | null>(null);
	const [busy, setBusy] = useState(false);
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
		setBusy(true);
		await save({ id: editing.id, values: { ...v, name: v.name.trim() } });
		setBusy(false);
		setEditing(null);
		toast.success(t("r_saved"));
	}

	async function test(r: RecordItem) {
		const res = await apiCall<{ ok: boolean; message: string }>("/api/automation/test", "POST", { id: r.id });
		if (res.data) (res.data.ok ? toast.success : toast.error)(`${t("r_testResult")}: ${res.data.message}`);
		else toast.error(res.message);
	}

	const field = "h-[44px] w-full rounded-8 border border-[#E6E6E6] bg-white px-10 text-16 text-[#666666] outline-none focus:border-[#5EA8F5]";
	const label = "mb-4 block text-14 text-[#999999]";
	const v = editing?.values ?? EMPTY;

	return (
		<div>
			<div className="mb-16 flex flex-wrap items-center justify-between gap-12">
				<p className="max-w-[640px] text-14 text-[#999999]">{t("r_help", { examples: "{{deal.name}}, {{contact.name}}, {{constants.NAME}}" })}</p>
				<button type="button" onClick={() => setEditing({ values: { ...EMPTY, stage: sorted[0]?._id ?? "" } })} className="h-[44px] rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80">+ {t("r_addRule")}</button>
			</div>

			{records.length === 0 ? (
				<p className="rounded-16 bg-white p-30 text-center text-16 text-[#999999] shadow-heroImage">{t("r_empty")}</p>
			) : (
				<ul className="grid gap-16 md:grid-cols-2">
					{records.map((r) => {
						const on = r.values.enabled !== "0";
						return (
							<li key={r.id} className={`animate-fade-in rounded-16 bg-white p-16 shadow-heroImage ${on ? "" : "opacity-60"}`}>
								<div className="flex items-start gap-10">
									<MdBolt size={24} className="mt-2 shrink-0 text-[#F4A100]" aria-hidden />
									<div className="min-w-0 flex-1">
										<p className="truncate text-16 font-semibold text-[#333333]">{r.values.name}</p>
										<p className="mt-4 text-14 text-[#666666]">
											{t(`ev_${r.values.event}`)}{STAGE_EVENTS.includes(r.values.event) ? ` · ${stageName(r.values.stage)}` : ""}
											{" → "}{t(`o_${r.values.timing}`)}{" → "}<span className="font-medium text-primaryColor">{t(`ac_${r.values.action}`)}</span>
										</p>
										{r.values.message && <p className="mt-4 truncate text-12 text-[#B3B3B3]">{r.values.message}</p>}
									</div>
									<label className="flex shrink-0 cursor-pointer items-center gap-6 text-12 text-[#999999]">
										<input type="checkbox" checked={on} onChange={async (e) => save({ id: r.id, values: { ...r.values, enabled: e.target.checked ? "1" : "0" } })} className="accent-[#5EA8F5]" />
										{t("r_enabled")}
									</label>
								</div>
								<div className="mt-12 flex items-center justify-end gap-16 text-14">
									<button type="button" onClick={() => test(r)} className="flex items-center gap-4 text-primaryColor transition-opacity hover:opacity-80"><MdPlayArrow size={18} />{t("r_test")}</button>
									<button type="button" onClick={() => setEditing({ id: r.id, values: { ...EMPTY, ...r.values } })} className="flex items-center gap-4 text-[#666666] transition-colors hover:text-primaryColor"><MdEdit size={18} />{t("r_edit")}</button>
									<button type="button" onClick={() => setToDelete(r)} className="flex items-center gap-4 text-[#999999] transition-colors hover:text-danger"><MdDelete size={18} />{t("r_delete")}</button>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			<Modal open={editing !== null} onClose={() => setEditing(null)} label={t("r_addRule")} className="w-full max-w-[520px]">
				<form onSubmit={submit} className="max-h-[calc(100vh-32px)] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-24 font-medium text-black">{editing?.id ? t("r_edit") : t("r_addRule")}</h2>
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
						{v.action !== "move_stage" && (
							<label><span className={label}>{v.action === "add_note" || v.action === "notify" ? t("r_text") : t("r_message")}</span>
								<textarea value={v.message} onChange={(e) => set("message", e.target.value)} rows={3} maxLength={1000} className="w-full rounded-8 border border-[#E6E6E6] bg-white p-10 text-16 text-[#666666] outline-none focus:border-[#5EA8F5]" />
								<span className="mt-4 block text-12 text-[#B3B3B3]">{t("r_variables", { examples: VARS })}</span>
							</label>
						)}
					</div>
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setEditing(null)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("r_cancel")}</button>
						<button type="submit" disabled={busy} className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80 disabled:opacity-60">{busy ? "…" : t("r_save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={toDelete !== null} title={t("r_delete")} text={t("r_deleteText", { name: toDelete?.values.name ?? "" })} onCancel={() => setToDelete(null)} onConfirm={() => { const r = toDelete; setToDelete(null); if (r) void remove([r.id]); }} />
		</div>
	);
}
