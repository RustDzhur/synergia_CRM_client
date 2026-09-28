"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/app/store/crmApi";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import { FEATURE_KEYS, planFor, type FeatureKey } from "@/app/config/plans";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import Modal from "../shared/Modal";
import BlogAdmin from "./BlogAdmin";

interface Summary { orgs: number; users: number; byPlan: Record<string, number>; mrr: number; blocked: number; newRequests: number }
interface OrgRow { id: string; name: string; ownerEmail: string; ownerName: string; plan: string; stripePlan: string; override: string; overrideUntil: string; status: string; interval: string; periodEnd: string; cancelAtPeriodEnd: boolean; hasSubscription: boolean; members: number; blocked: boolean; createdAt: string; features: Record<string, boolean>; featureOverrides: Record<string, boolean> }
interface Check { id: string; ok: boolean; message: string }
interface Req { id: string; orgId: string; orgName: string; email: string; plan: string; interval: string; company: string; vatId: string; note: string; status: "new" | "done"; createdAt: string }

const PLANS = ["free", "standard", "professional"];
const day = (iso: string) => (iso ? iso.slice(0, 10) : "");
const addDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

// Админ-кабинет владельца платформы (/crm/admin): фирмы-клиенты, их тарифы и подписки, запросы счетов. Доступ — по ADMIN_EMAILS.
export default function AdminPanel() {
	const t = useTranslations("admin");
	const tf = useTranslations("upgrade");
	const locale = useLocale();
	const [denied, setDenied] = useState(false);
	// Права проверяем ещё до запросов: без них незачем дёргать админские маршруты,
	// а пользователь сразу видит, что кабинет ему недоступен. Сервер проверяет то же самое.
	const me = useCurrentUserStore((s) => s.user);
	const [summary, setSummary] = useState<Summary | null>(null);
	const [orgs, setOrgs] = useState<OrgRow[]>([]);
	const [reqs, setReqs] = useState<Req[]>([]);
	const [q, setQ] = useState("");
	const [featuresFor, setFeaturesFor] = useState<OrgRow | null>(null); // фирма, которой сейчас правим разделы
	const [checks, setChecks] = useState<Check[] | null>(null);
	const [checking, setChecking] = useState(false);
	// приложение Meta платформы: одно на всех, поэтому задаётся здесь, а не в кабинете каждой фирмы
	const [metaId, setMetaId] = useState("");
	const [metaSecret, setMetaSecret] = useState("");
	const [metaHasSecret, setMetaHasSecret] = useState(false);
	const [metaFromEnv, setMetaFromEnv] = useState(false);
	const [metaBusy, setMetaBusy] = useState(false);

	const loadMeta = useCallback(async () => {
		const res = await apiCall<{ appId: string; hasSecret: boolean; fromEnv: boolean }>("/api/admin/settings/meta");
		if (!res.data) return;
		setMetaId(res.data.appId);
		setMetaHasSecret(res.data.hasSecret);
		setMetaFromEnv(res.data.fromEnv);
	}, []);
	useEffect(() => { void loadMeta(); }, [loadMeta]);

	async function saveMeta() {
		setMetaBusy(true);
		const res = await apiCall("/api/admin/settings/meta", "POST", { appId: metaId.trim(), appSecret: metaSecret.trim() });
		setMetaBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setMetaSecret("");
		toast.success(t("saved"));
		loadMeta();
	}

	// Бот для отчётов об ошибках: свой бот платформы, чат которого находится сам — писать ему нужно,
	// а числовой id искать не надо
	const [errToken, setErrToken] = useState("");
	const [errChat, setErrChat] = useState("");
	const [errName, setErrName] = useState("");
	const [errHasToken, setErrHasToken] = useState(false);
	const [errFromEnv, setErrFromEnv] = useState(false);
	const [errBusy, setErrBusy] = useState(false);

	const loadErrors = useCallback(async () => {
		const res = await apiCall<{ hasToken: boolean; chatId: string; fromEnv: boolean }>("/api/admin/settings/errors");
		if (!res.data) return;
		setErrHasToken(res.data.hasToken);
		setErrChat(res.data.chatId);
		setErrFromEnv(res.data.fromEnv);
	}, []);
	useEffect(() => { void loadErrors(); }, [loadErrors]);

	async function findErrorChat() {
		setErrBusy(true);
		const res = await apiCall<{ chatId: string; name: string }>("/api/admin/settings/errors", "POST", { action: "find-chat", botToken: errToken.trim() });
		setErrBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setErrChat(res.data.chatId);
		setErrName(res.data.name);
		toast.success(`${t("errFound")}: ${res.data.name}`);
	}

	async function saveErrors() {
		setErrBusy(true);
		const res = await apiCall("/api/admin/settings/errors", "POST", { action: "save", botToken: errToken.trim(), chatId: errChat });
		setErrBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setErrToken("");
		toast.success(t("saved"));
		loadErrors();
	}

	// Проверка отчётов: сообщение уходит тем же путём, что и настоящие — иначе непонятно, работает ли настройка
	async function testErrors() {
		setErrBusy(true);
		const res = await apiCall("/api/admin/settings/errors", "POST", { action: "test" });
		setErrBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("errSent"));
	}
	async function runCheck() {
		setChecking(true);
		const res = await apiCall<Check[]>("/api/admin/system");
		setChecking(false);
		if (res.data) setChecks(res.data);
		else toast.error(res.message);
	}

	const load = useCallback(async () => {
		if (me && !me.isAdmin) return void setDenied(true);
		const [s, o, r] = await Promise.all([apiCall<Summary>("/api/admin/summary"), apiCall<OrgRow[]>(`/api/admin/orgs?q=${encodeURIComponent(q)}`), apiCall<Req[]>("/api/admin/requests")]);
		if (s.status === 403) return void setDenied(true);
		if (s.data) setSummary(s.data);
		if (o.data) setOrgs(o.data);
		if (r.data) setReqs(r.data);
	}, [q, me]);
	useEffect(() => { const id = setTimeout(load, q ? 300 : 0); return () => clearTimeout(id); }, [load, q]);

	async function patch(id: string, body: Record<string, unknown>) {
		const res = await apiCall(`/api/admin/orgs/${id}`, "PATCH", body);
		if (!res.ok) toast.error(res.message);
		else toast.success(t("saved"));
		load();
	}
	// переключатель раздела: undefined — вернуть как в тарифе, true — выдать сверх тарифа, false — отключить вопреки тарифу
	function toggleFeature(o: OrgRow, key: FeatureKey, value: boolean | undefined) {
		const next = { ...(o.featureOverrides ?? {}) };
		if (value === undefined) delete next[key];
		else next[key] = value;
		setFeaturesFor({ ...o, featureOverrides: next, features: { ...o.features, [key]: value ?? !!planFor(o.plan).features[key] } });
		patch(o.id, { featureOverrides: next });
	}

	async function cancel(o: OrgRow) {
		if (!window.confirm(t("cancelConfirm", { name: o.name }))) return;
		const res = await apiCall(`/api/admin/orgs/${o.id}/cancel`, "POST");
		if (!res.ok) toast.error(res.message);
		load();
	}
	// заявка на счёт оплачена: включаем тариф на месяц/год и закрываем заявку
	async function activate(r: Req) {
		await patch(r.orgId, { planOverride: r.plan, planOverrideUntil: addDays(r.interval === "year" ? 366 : 31) });
		await apiCall(`/api/admin/requests/${r.id}`, "PATCH", { status: "done" });
		load();
	}

	if (denied) return <p className="px-16 py-20 text-13 text-[#8c948b] md:px-24 md:py-24 lg:px-32">{t("denied")}</p>;
	const card = "fs-card p-16";
	const input = "fs-field h-34 px-10 text-12 outline-none";

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<h1 className="mb-16 text-20 font-semibold text-[#f1f4ee]">{t("title")}</h1>
			<div className="fs-card mb-24 p-16">
				<div className="flex flex-wrap items-center justify-between gap-12">
					<div><p className="text-14 font-medium text-[#f1f4ee]">{t("sysTitle")}</p><p className="text-12 text-[#8c948b]">{t("sysHelp")}</p></div>
					<button type="button" onClick={runCheck} disabled={checking} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{checking ? "…" : t("sysRun")}</button>
				</div>
				{checks && (
					<ul className="mt-12 flex flex-col gap-6">
						{checks.map((c) => (
							<li key={c.id} className="flex items-start gap-8 text-13">
								<span className={`mt-2 shrink-0 font-semibold ${c.ok ? "text-[#2DDEB6]" : "text-danger"}`}>{c.ok ? "✓" : "✗"}</span>
								<span><span className="font-medium text-[#f1f4ee]">{t(`sys_${c.id}`)}</span> <span className="text-[#8c948b]">{c.message}</span></span>
							</li>
						))}
					</ul>
				)}
			</div>
			{/* Приложение Meta для всей платформы: через него фирмы подключают свои страницы Facebook и номера
			    WhatsApp. Задаётся один раз здесь — тогда в кабинете фирмы достаточно одной кнопки. */}
			<div className="fs-card mb-24 p-16">
				<div className="flex flex-wrap items-center justify-between gap-12">
					<div><p className="text-14 font-medium text-[#f1f4ee]">{t("metaTitle")}</p><p className="text-12 text-[#8c948b]">{t("metaHelp")}</p></div>
					{metaFromEnv ? (
						<span className="fs-chip h-24 px-10 text-10">{t("metaFromEnv")}</span>
					) : (
						<button type="button" onClick={saveMeta} disabled={metaBusy || !metaId.trim()} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{metaBusy ? "…" : t("metaSave")}</button>
					)}
				</div>
				{!metaFromEnv && (
					<div className="mt-12 flex flex-wrap items-end gap-12">
						<label className="flex flex-col gap-6">
							<span className="text-11 text-[#8c948b]">{t("metaAppId")}</span>
							<input value={metaId} onChange={(e) => setMetaId(e.target.value)} placeholder="1098409499579046" maxLength={40} className={input} />
						</label>
						<label className="flex flex-col gap-6">
							<span className="text-11 text-[#8c948b]">{t("metaSecret")}</span>
							<input value={metaSecret} onChange={(e) => setMetaSecret(e.target.value)} type="password" autoComplete="off" maxLength={80} placeholder={metaHasSecret ? t("metaKeepSecret") : ""} className={input} />
						</label>
					</div>
				)}
				{metaFromEnv && <p className="mt-8 text-11 text-[#8c948b]">{t("metaFromEnvHelp")}</p>}
			</div>
			{/* Отчёты об ошибках: свой бот платформы. Пишем боту любое сообщение, нажимаем «Найти чат» —
			    числовой id искать не нужно, а после сохранения уходит проверочное сообщение. */}
			<div className="fs-card mb-24 p-16">
				<div className="flex flex-wrap items-center justify-between gap-12">
					<div><p className="text-14 font-medium text-[#f1f4ee]">{t("errTitle")}</p><p className="text-12 text-[#8c948b]">{t("errHelp")}</p></div>
					<div className="flex items-center gap-10">
						{errFromEnv && <span className="fs-chip h-24 px-10 text-10">{t("metaFromEnv")}</span>}
						{/* Проверка нужна в обоих случаях: значения могли задать давно, и надо видеть, что они рабочие */}
						<button type="button" onClick={testErrors} disabled={errBusy} className="fs-btn fs-btn-ghost h-34 disabled:opacity-60">{t("errTest")}</button>
						{!errFromEnv && (
							<button type="button" onClick={saveErrors} disabled={errBusy || !errChat} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{errBusy ? "…" : t("errSave")}</button>
						)}
					</div>
				</div>
				{/* Поля показываем всегда: настройка из кабинета важнее переменных окружения, а в переменных
				    легко ошибиться — например, вписать id бота, которому Telegram писать не разрешает */}
				<div className="mt-12 flex flex-wrap items-end gap-12">
					<label className="flex flex-col gap-6">
						<span className="text-11 text-[#8c948b]">{t("errToken")}</span>
						<input value={errToken} onChange={(e) => setErrToken(e.target.value)} type="password" autoComplete="off" maxLength={120} placeholder={errHasToken ? t("metaKeepSecret") : "123456:ABC…"} className={input} />
					</label>
					<button type="button" onClick={findErrorChat} disabled={errBusy} className="fs-btn fs-btn-ghost h-34 disabled:opacity-60">{t("errFindChat")}</button>
					{errChat && (
						<span className="text-12 text-[#8c948b]">
							{t("errChat")}: <span className="text-[#f1f4ee]">{errName || errChat}</span>
						</span>
					)}
				</div>
				{errFromEnv && <p className="mt-8 text-11 text-[#8c948b]">{t("errFromEnvHelp")}</p>}
			</div>
			{summary && (
				<div className="mb-24 grid grid-cols-2 gap-12 md:grid-cols-5">
					{[
						[t("firms"), summary.orgs], [t("users"), summary.users],
						[t("planFree"), summary.byPlan.free], [t("planStandard"), summary.byPlan.standard], [t("planProfessional"), summary.byPlan.professional],
					].map(([k, v]) => (
						<div key={String(k)} className={card}><p className="text-11 text-[#8c948b]">{k}</p><p className="text-18 font-semibold text-[#f1f4ee]">{v}</p></div>
					))}
					<div className={card}><p className="text-11 text-[#8c948b]">{t("mrr")}</p><p className="text-18 font-semibold text-[#f1f4ee]">{summary.mrr} €</p></div>
					<div className={card}><p className="text-11 text-[#8c948b]">{t("blocked")}</p><p className="text-18 font-semibold text-[#f1f4ee]">{summary.blocked}</p></div>
					<div className={card}><p className="text-11 text-[#8c948b]">{t("newRequests")}</p><p className="text-18 font-semibold text-[#f1f4ee]">{summary.newRequests}</p></div>
				</div>
			)}

			{reqs.some((r) => r.status === "new") && (
				<div className="mb-24">
					<h2 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("requests")}</h2>
					<ul className="flex flex-col gap-8">
						{reqs.filter((r) => r.status === "new").map((r) => (
							<li key={r.id} className={`${card} flex flex-wrap items-center gap-x-16 gap-y-8`}>
								<div className="min-w-0 flex-1 text-12 text-[#8c948b]">
									<p className="font-medium text-[#f1f4ee]">{r.orgName} · {r.plan} / {r.interval === "year" ? t("year") : t("month")}</p>
									<p>{r.company}{r.vatId ? ` · ${r.vatId}` : ""} · {r.email}</p>
									{r.note && <p className="text-[#8c948b]">{r.note}</p>}
								</div>
								<button type="button" onClick={() => activate(r)} className="fs-btn fs-btn-primary h-34">{t("activate")}</button>
								<button type="button" onClick={async () => { await apiCall(`/api/admin/requests/${r.id}`, "PATCH", { status: "done" }); load(); }} className="text-12 text-[#9AA396] hover:text-danger">{t("dismiss")}</button>
							</li>
						))}
					</ul>
					<p className="mt-6 text-11 text-[#9AA396]">{t("requestsHelp")}</p>
				</div>
			)}

			<div className="mb-12 flex items-center gap-12">
				<h2 className="text-14 font-semibold text-[#f1f4ee]">{t("firms")}</h2>
				<input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className={`${input} w-[240px]`} />
			</div>
			<div className="fs-card overflow-x-auto">
				<table className="fs-table min-w-[900px]">
					<thead>
						<tr>
							{[t("colFirm"), t("colOwner"), t("colPlan"), t("colStripe"), t("colOverride"), t("colMembers"), t("colCreated"), ""].map((h, i) => <th key={i} className="px-12 py-12">{h}</th>)}
						</tr>
					</thead>
					<tbody>
						{orgs.map((o) => (
							<tr key={o.id} className={o.blocked ? "bg-[rgba(235,87,87,0.06)]" : ""}>
								<td className="px-12 py-10 text-13 font-medium text-[#f1f4ee]">{o.name}{o.blocked && <span className="ml-6 text-12 text-danger">({t("blockedTag")})</span>}</td>
								<td className="px-12 py-10 text-13 text-[#8c948b]"><span className="block">{o.ownerName}</span><span className="text-12 text-[#9AA396]">{o.ownerEmail}</span></td>
								<td className="px-12 py-10"><span className="fs-chip h-24 border-[rgba(198,255,77,0.30)] px-8 text-10 text-[#c6ff4d]">{o.plan}</span></td>
								<td className="px-12 py-10 text-13 text-[#8c948b]">
									{o.status ? `${o.stripePlan} · ${o.status}${o.interval ? ` · ${o.interval === "year" ? t("year") : t("month")}` : ""}` : "—"}
									{o.periodEnd && <span className="block text-12 text-[#9AA396]">{o.cancelAtPeriodEnd ? t("endsOn") : t("renewsOn")} {new Date(o.periodEnd).toLocaleDateString(locale === "ua" ? "uk" : locale)}</span>}
								</td>
								<td className="px-12 py-10">
									<div className="flex flex-wrap items-center gap-6">
										<select value={o.override} onChange={(e) => patch(o.id, { planOverride: e.target.value, planOverrideUntil: e.target.value ? addDays(31) : null })} aria-label={t("colOverride")} className={input}>
											<option value="">{t("noOverride")}</option>
											{PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
										</select>
										{o.override && <input type="date" value={day(o.overrideUntil)} onChange={(e) => patch(o.id, { planOverrideUntil: e.target.value ? new Date(`${e.target.value}T23:59:00`).toISOString() : null })} aria-label={t("until")} className={input} />}
									</div>
								</td>
								<td className="px-12 py-10 text-13 text-[#8c948b]">{o.members}</td>
								<td className="px-12 py-10 text-13 text-[#9AA396]">{day(o.createdAt)}</td>
								<td className="px-12 py-10">
									<div className="flex flex-wrap gap-8">
										<button type="button" onClick={() => setFeaturesFor(o)} className="text-12 text-[#c6ff4d] hover:underline">{t("features")}</button>
										{o.hasSubscription && !o.cancelAtPeriodEnd && <button type="button" onClick={() => cancel(o)} className="text-12 text-[#c6ff4d] hover:underline">{t("cancelSub")}</button>}
										<button type="button" onClick={() => patch(o.id, { blocked: !o.blocked })} className={`text-12 hover:underline ${o.blocked ? "text-[#2DDEB6]" : "text-danger"}`}>{o.blocked ? t("unblock") : t("block")}</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{orgs.length === 0 && <p className="py-30 text-center text-13 text-[#8c948b]">{t("none")}</p>}
			</div>

			{/* Разделы фирмы: что открыто по тарифу и что администратор включил или выключил вручную */}
			<Modal open={!!featuresFor} onClose={() => setFeaturesFor(null)} label={t("features")} align="top" className="fs-popover w-full max-w-[560px] p-20">
				{featuresFor && (
					<>
						<h2 className="mb-6 text-15 font-semibold text-[#f1f4ee]">{t("featuresTitle", { name: featuresFor.name })}</h2>
						<p className="mb-16 text-12 text-[#8c948b]">{t("featuresHelp")}</p>
						<div className="mb-16 flex flex-wrap items-center gap-8 text-12 text-[#8c948b]">
							<span className="fs-chip h-24 border-[rgba(198,255,77,0.30)] px-8 text-10 text-[#c6ff4d]">{featuresFor.plan}</span>
							<span>{tf("limitsLine", { rules: planFor(featuresFor.plan).automationRules, ai: planFor(featuresFor.plan).aiDailyRequests, storage: planFor(featuresFor.plan).storageMb >= 1000 ? `${planFor(featuresFor.plan).storageMb / 1000} GB` : `${planFor(featuresFor.plan).storageMb} MB` })}</span>
						</div>
						<ul className="mb-20 flex flex-col gap-8">
							{FEATURE_KEYS.map((key) => {
								const byPlan = !!planFor(featuresFor.plan).features[key];
								const override = featuresFor.featureOverrides?.[key];
								const on = override ?? byPlan;
								return (
									<li key={key} className="flex items-center gap-12 rounded-10 border border-inkLine p-10">
										<span className="flex-1 text-13 text-[#f1f4ee]">{tf(key)}</span>
										<span className={`rounded-50 px-10 py-2 text-10 ${on ? "bg-[rgba(45,222,182,0.12)] text-[#2DDEB6]" : "bg-[rgba(255,255,255,0.05)] text-[#8c948b]"}`}>
											{override === undefined ? (byPlan ? t("featByPlan") : t("featOff")) : override ? t("featExtra") : t("featOff")}
										</span>
										<select
											value={override === undefined ? "" : override ? "on" : "off"}
											onChange={(e) => toggleFeature(featuresFor, key, e.target.value === "" ? undefined : e.target.value === "on")}
											aria-label={tf(key)}
											className={input}>
											<option value="">{t("featByPlan")}</option>
											<option value="on">{t("featExtra")}</option>
											<option value="off">{t("featOff")}</option>
										</select>
									</li>
								);
							})}
						</ul>
						<button type="button" onClick={() => setFeaturesFor(null)} className="fs-btn fs-btn-primary h-36">{t("cancel")}</button>
					</>
				)}
			</Modal>

			<BlogAdmin />
		</div>
	);
}
