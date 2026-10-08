"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { PRACTICE_GRANTABLE } from "@/lib/access";
import { apiCall } from "@/store/crmApi";
import PageHeader from "@/components/crm/shared/PageHeader";
import SettingsTabs from "./SettingsTabs";

// Settings → Practice (/crm/settings/practice). Две стороны одной функции:
//  • «Специалисты с доступом к этой фирме» — клиент (владелец/администратор): пригласить своего бухгалтера или юриста, принять приглашение
//    по токену, отозвать доступ (немедленно) и видеть журнал доступа;
//  • «Моя практика» — специалист: открыть практику (с акцептом договора обработки данных и обязательства о тайне), добавить коллег,
//    пригласить клиента, подтвердить приглашения клиентов.
// Доступ специалиста существует только через действующую связь и согласие клиента (docs/TZ_MASTER.md §5).

interface Link { id: string; status: string; initiatedBy: string; practice: { id: string; name: string; kind: string }; access: string; modules: string[]; expiresAt: string | null; confirmedAt: string | null; endReason: string; members: { userId: string; name: string }[] }
interface LogEntry { id: string; userName: string; action: string; module: string; method: string; path: string; at: string }
interface PracticeInfo { id: string; name: string; kind: string; code: string; myRole: string; aiMode: string }
interface PracticeDetail {
	practice: PracticeInfo; myRole: string;
	members: { userId: string; name: string; email: string; role: string }[];
	links: { id: string; status: string; initiatedBy: string; org: string | null; orgName: string; access: string; modules: string[]; expiresAt: string | null; token?: string }[];
}

const field = "fs-field h-40 w-full px-12 text-13 outline-none";
const label = "mb-6 block text-12 text-[#8c948b]";

function ModulePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
	const t = useTranslations("settings");
	return (
		<div className="flex flex-wrap gap-x-16 gap-y-6">
			{PRACTICE_GRANTABLE.map((m) => (
				<label key={m} className="flex cursor-pointer items-center gap-6 text-12 text-[#cfd4cb]">
					<input type="checkbox" className="accent-[#c6ff4d]" checked={value.includes(m)} onChange={() => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m])} />
					{t(`module_${m}`)}
				</label>
			))}
		</div>
	);
}

function ClientSide() {
	const t = useTranslations("settings");
	const locale = useLocale();
	const [links, setLinks] = useState<Link[] | null>(null);
	const [denied, setDenied] = useState(false);
	const [log, setLog] = useState<LogEntry[]>([]);
	const [code, setCode] = useState("");
	const [access, setAccess] = useState("read");
	const [modules, setModules] = useState<string[]>(["inventory"]);
	const [days, setDays] = useState("365");
	const [token, setToken] = useState("");
	const [busy, setBusy] = useState(false);
	const load = useCallback(async () => {
		const r = await apiCall<{ links: Link[] }>("/api/practice/links");
		if (r.status === 403) return void setDenied(true);
		if (r.ok && r.data) { setDenied(false); setLinks(r.data.links); }
		const l = await apiCall<{ entries: LogEntry[] }>("/api/practice/access-log?limit=30");
		if (l.ok && l.data) setLog(l.data.entries);
	}, []);
	useEffect(() => { void load(); }, [load]);
	const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === "ua" ? "uk" : locale) : "—");

	async function run(fn: () => Promise<{ ok: boolean; message: string }>, done: string) {
		if (busy) return;
		setBusy(true);
		const r = await fn();
		setBusy(false);
		if (!r.ok) return void toast.error(r.message);
		toast.success(done);
		void load();
	}
	if (denied) return <p className="fs-card p-16 text-13 text-[#8c948b]">{t("prClientDenied")}</p>;
	return (
		<section className="mb-28">
			<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("prClientTitle")}</h2>
			<p className="mt-6 max-w-[640px] text-12 leading-[1.5] text-[#8c948b]">{t("prClientHint")}</p>

			<div className="fs-card mt-14 p-16 md:p-20">
				<h3 className="text-13 font-semibold text-[#f1f4ee]">{t("prInviteMine")}</h3>
				<div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-3">
					<div><span className={label}>{t("prPracticeCode")}</span><input className={field} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} placeholder="ABCD2345" /></div>
					<div><span className={label}>{t("prAccess")}</span>
						<select className={field} value={access} onChange={(e) => setAccess(e.target.value)}>
							{["read", "review", "edit"].map((a) => <option key={a} value={a}>{t(`prAccess_${a}`)}</option>)}
						</select></div>
					<div><span className={label}>{t("prDays")}</span><input className={field} type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} /></div>
				</div>
				<div className="mt-12"><span className={label}>{t("prModules")}</span><ModulePicker value={modules} onChange={setModules} /></div>
				<p className="mt-10 text-11 text-[#9AA396]">{t("prNeverGiven")}</p>
				<button type="button" disabled={busy || !code} onClick={() => void run(() => apiCall("/api/practice/links", "POST", { practiceCode: code, access, modules, expiresInDays: Number(days) || 365 }), t("prInviteSent"))} className="fs-btn fs-btn-primary mt-12 h-38 disabled:opacity-50">{t("prSendInvite")}</button>
			</div>

			<div className="fs-card mt-14 p-16 md:p-20">
				<h3 className="text-13 font-semibold text-[#f1f4ee]">{t("prHaveToken")}</h3>
				<div className="mt-10 flex flex-wrap gap-10">
					<input className={`${field} max-w-[420px]`} value={token} onChange={(e) => setToken(e.target.value.trim())} placeholder={t("prToken")} />
					<button type="button" disabled={busy || !token} onClick={() => void run(() => apiCall("/api/practice/accept", "POST", { token }), t("prAccepted"))} className="fs-btn fs-btn-primary h-40 disabled:opacity-50">{t("prAccept")}</button>
				</div>
			</div>

			<ul className="mt-14 flex flex-col gap-10">
				{(links ?? []).map((l) => (
					<li key={l.id} className="fs-card p-16">
						<div className="flex flex-wrap items-center gap-x-16 gap-y-6">
							<div className="min-w-0 flex-1">
								<p className="truncate text-13 font-medium text-[#f1f4ee]">{l.practice.name} <span className="text-11 font-normal text-[#9AA396]">({t(`prKind_${l.practice.kind || "accountant"}` as never)})</span></p>
								<p className="text-12 text-[#8c948b]">{t(`prAccess_${l.access}` as never)} · {l.modules.map((m) => t(`module_${m}` as never)).join(", ")} · {t("prUntil")} {date(l.expiresAt)}</p>
								{l.members.length > 0 && <p className="text-12 text-[#8c948b]">{l.members.map((m) => m.name).join(", ")}</p>}
							</div>
							<span className={`fs-chip h-24 px-10 text-11 ${l.status === "active" ? "text-[#c6ff4d]" : "text-[#cfd4cb]"}`}>{t(`prStatus_${l.status}` as never)}</span>
							{l.status !== "ended" && <button type="button" disabled={busy} onClick={() => void run(() => apiCall(`/api/practice/links/${l.id}`, "POST", { action: "end" }), t("prEnded"))} className="text-12 text-[#ff9f9f] hover:underline">{l.status === "active" ? t("prRevoke") : t("prCancel")}</button>}
						</div>
					</li>
				))}
			</ul>

			{log.length > 0 && (
				<div className="mt-18">
					<h3 className="mb-8 text-13 font-semibold text-[#f1f4ee]">{t("prLogTitle")}</h3>
					<ul className="flex flex-col gap-4 text-12 text-[#cfd4cb]">
						{log.map((e) => <li key={e.id}>{new Date(e.at).toLocaleString(locale === "ua" ? "uk" : locale)} · {e.userName} · {t(`prLog_${e.action}` as never)} · {e.method} {e.path}</li>)}
					</ul>
				</div>
			)}
		</section>
	);
}

function PracticeSide() {
	const t = useTranslations("settings");
	const [list, setList] = useState<PracticeInfo[] | null>(null);
	const [detail, setDetail] = useState<PracticeDetail | null>(null);
	const [name, setName] = useState("");
	const [kind, setKind] = useState("accountant");
	const [terms, setTerms] = useState(false);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState("junior");
	const [access, setAccess] = useState("read");
	const [modules, setModules] = useState<string[]>(["inventory"]);
	const [newToken, setNewToken] = useState("");
	const [busy, setBusy] = useState(false);

	const loadList = useCallback(async () => {
		const r = await apiCall<{ practices: PracticeInfo[] }>("/api/practice");
		if (r.ok && r.data) {
			setList(r.data.practices);
			if (r.data.practices[0]) { const d = await apiCall<PracticeDetail>(`/api/practice/${r.data.practices[0].id}`); if (d.ok && d.data) setDetail(d.data); }
		}
	}, []);
	useEffect(() => { void loadList(); }, [loadList]);

	async function run(fn: () => Promise<{ ok: boolean; message: string; data?: unknown }>, done: string, after?: (d: unknown) => void) {
		if (busy) return;
		setBusy(true);
		const r = await fn();
		setBusy(false);
		if (!r.ok) return void toast.error(r.message);
		toast.success(done);
		after?.(r.data);
		void loadList();
	}
	const p = detail?.practice;
	const partner = detail?.myRole === "partner";
	return (
		<section>
			<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("prMineTitle")}</h2>
			<p className="mt-6 max-w-[640px] text-12 leading-[1.5] text-[#8c948b]">{t("prMineHint")}</p>
			{list && list.length === 0 && (
				<div className="fs-card mt-14 p-16 md:p-20">
					<h3 className="text-13 font-semibold text-[#f1f4ee]">{t("prCreate")}</h3>
					<div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2">
						<div><span className={label}>{t("prName")}</span><input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
						<div><span className={label}>{t("prKind")}</span>
							<select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>{["accountant", "lawyer"].map((k) => <option key={k} value={k}>{t(`prKind_${k}` as never)}</option>)}</select></div>
					</div>
					<label className="mt-12 flex items-start gap-10 text-12 leading-[1.5] text-[#cfd4cb]">
						<input type="checkbox" className="mt-[3px] accent-[#c6ff4d]" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
						<span>{t("prTerms")}</span>
					</label>
					<button type="button" disabled={busy || !terms || name.trim().length < 2} onClick={() => void run(() => apiCall("/api/practice", "POST", { name, kind, acceptTerms: terms }), t("prCreated"))} className="fs-btn fs-btn-primary mt-12 h-38 disabled:opacity-50">{t("prCreateBtn")}</button>
				</div>
			)}
			{p && (
				<>
					<div className="fs-card mt-14 p-16 md:p-20">
						<p className="text-14 font-semibold text-[#f1f4ee]">{p.name} <span className="text-12 font-normal text-[#9AA396]">({t(`prKind_${p.kind}` as never)} · {t(`prRole_${detail!.myRole}` as never)})</span></p>
						<p className="mt-6 text-12 text-[#8c948b]">{t("prCodeIs")} <b className="text-[#c6ff4d]">{p.code}</b> — {t("prCodeHint")}</p>
						<p className="mt-4 text-11 text-[#9AA396]">{t("prAiNone")}</p>
					</div>

					<div className="fs-card mt-14 p-16 md:p-20">
						<h3 className="text-13 font-semibold text-[#f1f4ee]">{t("prTeam")}</h3>
						<ul className="mt-10 flex flex-col gap-6 text-13 text-[#cfd4cb]">
							{detail!.members.map((m) => (
								<li key={m.userId} className="flex items-center gap-10"><span className="min-w-0 flex-1 truncate">{m.name} · {m.email}</span><span className="fs-chip h-22 px-8 text-10">{t(`prRole_${m.role}` as never)}</span>
									{partner && <button type="button" className="text-12 text-[#ff9f9f] hover:underline" onClick={() => void run(() => apiCall(`/api/practice/${p.id}/members?user=${m.userId}`, "DELETE"), t("prRemoved"))}>{t("teamRemove")}</button>}</li>
							))}
						</ul>
						{partner && (
							<div className="mt-12 flex flex-wrap gap-10">
								<input className={`${field} max-w-[300px]`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
								<select className={`${field} max-w-[160px]`} value={role} onChange={(e) => setRole(e.target.value)}>{["senior", "junior", "assistant", "partner"].map((r) => <option key={r} value={r}>{t(`prRole_${r}` as never)}</option>)}</select>
								<button type="button" disabled={busy || !email} onClick={() => void run(() => apiCall(`/api/practice/${p.id}/members`, "POST", { email, role }), t("prAdded"), () => setEmail(""))} className="fs-btn fs-btn-ghost h-40 disabled:opacity-50">{t("prAddMember")}</button>
							</div>
						)}
					</div>

					{partner && (
						<div className="fs-card mt-14 p-16 md:p-20">
							<h3 className="text-13 font-semibold text-[#f1f4ee]">{t("prInviteClient")}</h3>
							<div className="mt-10 grid grid-cols-1 gap-12 md:grid-cols-2">
								<div><span className={label}>{t("prAccess")}</span><select className={field} value={access} onChange={(e) => setAccess(e.target.value)}>{["read", "review", "edit"].map((a) => <option key={a} value={a}>{t(`prAccess_${a}` as never)}</option>)}</select></div>
								<div><span className={label}>{t("prModules")}</span><ModulePicker value={modules} onChange={setModules} /></div>
							</div>
							<button type="button" disabled={busy} onClick={() => void run(() => apiCall<{ token: string }>(`/api/practice/${p.id}/invites`, "POST", { access, modules }), t("prInviteCreated"), (d) => setNewToken((d as { token: string }).token))} className="fs-btn fs-btn-primary mt-12 h-38 disabled:opacity-50">{t("prCreateInvite")}</button>
							{newToken && <p className="mt-10 break-all rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] p-10 text-12 text-[#c6ff4d]">{newToken}<span className="mt-4 block text-11 text-[#9AA396]">{t("prTokenHint")}</span></p>}
						</div>
					)}

					<h3 className="mb-8 mt-18 text-13 font-semibold text-[#f1f4ee]">{t("prClients")}</h3>
					<ul className="flex flex-col gap-8">
						{detail!.links.length === 0 && <li className="text-12 text-[#8c948b]">{t("prNoClients")}</li>}
						{detail!.links.map((l) => (
							<li key={l.id} className="fs-card flex flex-wrap items-center gap-x-14 gap-y-6 p-14">
								<span className="min-w-0 flex-1 truncate text-13 text-[#f1f4ee]">{l.orgName || t("prWaitingClient")}</span>
								<span className="text-12 text-[#8c948b]">{t(`prAccess_${l.access}` as never)}</span>
								<span className="fs-chip h-22 px-8 text-10">{t(`prStatus_${l.status}` as never)}</span>
								{partner && l.status === "invited" && l.initiatedBy === "client" && <button type="button" className="text-12 text-[#c6ff4d] hover:underline" onClick={() => void run(() => apiCall(`/api/practice/${p.id}/links/${l.id}`, "POST", { action: "accept", members: detail!.members.filter((m) => m.role !== "assistant").map((m) => m.userId) }), t("prAccepted"))}>{t("prAcceptClient")}</button>}
								{partner && l.status !== "ended" && <button type="button" className="text-12 text-[#ff9f9f] hover:underline" onClick={() => void run(() => apiCall(`/api/practice/${p.id}/links/${l.id}`, "POST", { action: "end" }), t("prEnded"))}>{t("prEnd")}</button>}
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
}

export default function PracticeSettings() {
	const t = useTranslations("settings");
	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="flex flex-col gap-20 md:flex-row md:items-start">
				<SettingsTabs />
				<div className="min-w-0 flex-1">
					<h1 className="mb-16 text-18 font-semibold text-[#f1f4ee]">{t("tabPractice")}</h1>
					<ClientSide />
					<PracticeSide />
				</div>
			</div>
		</div>
	);
}
