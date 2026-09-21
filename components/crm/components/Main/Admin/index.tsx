"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/app/store/crmApi";

interface Summary { orgs: number; users: number; byPlan: Record<string, number>; mrr: number; blocked: number; newRequests: number }
interface OrgRow { id: string; name: string; ownerEmail: string; ownerName: string; plan: string; stripePlan: string; override: string; overrideUntil: string; status: string; interval: string; periodEnd: string; cancelAtPeriodEnd: boolean; hasSubscription: boolean; members: number; blocked: boolean; createdAt: string }
interface Check { id: string; ok: boolean; message: string }
interface Req { id: string; orgId: string; orgName: string; email: string; plan: string; interval: string; company: string; vatId: string; note: string; status: "new" | "done"; createdAt: string }

const PLANS = ["free", "standard", "professional"];
const day = (iso: string) => (iso ? iso.slice(0, 10) : "");
const addDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

// Админ-кабинет владельца платформы (/crm/admin): фирмы-клиенты, их тарифы и подписки, запросы счетов. Доступ — по ADMIN_EMAILS.
export default function AdminPanel() {
	const t = useTranslations("admin");
	const locale = useLocale();
	const [denied, setDenied] = useState(false);
	const [summary, setSummary] = useState<Summary | null>(null);
	const [orgs, setOrgs] = useState<OrgRow[]>([]);
	const [reqs, setReqs] = useState<Req[]>([]);
	const [q, setQ] = useState("");
	const [checks, setChecks] = useState<Check[] | null>(null);
	const [checking, setChecking] = useState(false);
	async function runCheck() {
		setChecking(true);
		const res = await apiCall<Check[]>("/api/admin/system");
		setChecking(false);
		if (res.data) setChecks(res.data);
		else toast.error(res.message);
	}

	const load = useCallback(async () => {
		const [s, o, r] = await Promise.all([apiCall<Summary>("/api/admin/summary"), apiCall<OrgRow[]>(`/api/admin/orgs?q=${encodeURIComponent(q)}`), apiCall<Req[]>("/api/admin/requests")]);
		if (s.status === 403) return void setDenied(true);
		if (s.data) setSummary(s.data);
		if (o.data) setOrgs(o.data);
		if (r.data) setReqs(r.data);
	}, [q]);
	useEffect(() => { const id = setTimeout(load, q ? 300 : 0); return () => clearTimeout(id); }, [load, q]);

	async function patch(id: string, body: Record<string, unknown>) {
		const res = await apiCall(`/api/admin/orgs/${id}`, "PATCH", body);
		if (!res.ok) toast.error(res.message);
		else toast.success(t("saved"));
		load();
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

	if (denied) return <p className="p-30 text-16 text-[#666666]">{t("denied")}</p>;
	const card = "rounded-16 bg-white p-16 shadow-heroImage";
	const input = "h-[36px] rounded-8 border border-[#E6E6E6] bg-white px-8 text-14 text-[#666666] outline-none focus:border-[#5EA8F5]";

	return (
		<div className="p-16 md:p-30">
			<h1 className="mb-16 text-24 font-semibold text-[#333333]">{t("title")}</h1>
			<div className="mb-24 rounded-16 bg-white p-16 shadow-heroImage">
				<div className="flex flex-wrap items-center justify-between gap-12">
					<div><p className="text-16 font-medium text-[#333333]">{t("sysTitle")}</p><p className="text-14 text-[#999999]">{t("sysHelp")}</p></div>
					<button type="button" onClick={runCheck} disabled={checking} className="h-[40px] rounded-8 bg-primaryColor px-20 text-14 font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-60">{checking ? "…" : t("sysRun")}</button>
				</div>
				{checks && (
					<ul className="mt-12 flex flex-col gap-6">
						{checks.map((c) => (
							<li key={c.id} className="flex items-start gap-8 text-14">
								<span className={`mt-2 shrink-0 font-semibold ${c.ok ? "text-[#009A2B]" : "text-danger"}`}>{c.ok ? "✓" : "✗"}</span>
								<span><span className="font-medium text-[#333333]">{t(`sys_${c.id}`)}</span> <span className="text-[#666666]">{c.message}</span></span>
							</li>
						))}
					</ul>
				)}
			</div>
			{summary && (
				<div className="mb-24 grid grid-cols-2 gap-12 md:grid-cols-5">
					{[
						[t("firms"), summary.orgs], [t("users"), summary.users],
						[t("planFree"), summary.byPlan.free], [t("planStandard"), summary.byPlan.standard], [t("planProfessional"), summary.byPlan.professional],
					].map(([k, v]) => (
						<div key={String(k)} className={card}><p className="text-14 text-[#999999]">{k}</p><p className="text-24 font-semibold text-[#333333]">{v}</p></div>
					))}
					<div className={card}><p className="text-14 text-[#999999]">{t("mrr")}</p><p className="text-24 font-semibold text-[#333333]">{summary.mrr} €</p></div>
					<div className={card}><p className="text-14 text-[#999999]">{t("blocked")}</p><p className="text-24 font-semibold text-[#333333]">{summary.blocked}</p></div>
					<div className={card}><p className="text-14 text-[#999999]">{t("newRequests")}</p><p className="text-24 font-semibold text-[#333333]">{summary.newRequests}</p></div>
				</div>
			)}

			{reqs.some((r) => r.status === "new") && (
				<div className="mb-24">
					<h2 className="mb-8 text-18 font-medium text-[#333333]">{t("requests")}</h2>
					<ul className="flex flex-col gap-8">
						{reqs.filter((r) => r.status === "new").map((r) => (
							<li key={r.id} className={`${card} flex flex-wrap items-center gap-x-16 gap-y-8`}>
								<div className="min-w-0 flex-1 text-14 text-[#666666]">
									<p className="font-medium text-[#333333]">{r.orgName} · {r.plan} / {r.interval === "year" ? t("year") : t("month")}</p>
									<p>{r.company}{r.vatId ? ` · ${r.vatId}` : ""} · {r.email}</p>
									{r.note && <p className="text-[#999999]">{r.note}</p>}
								</div>
								<button type="button" onClick={() => activate(r)} className="h-[36px] rounded-8 bg-primaryColor px-16 text-14 font-medium text-white transition-opacity hover:opacity-80">{t("activate")}</button>
								<button type="button" onClick={async () => { await apiCall(`/api/admin/requests/${r.id}`, "PATCH", { status: "done" }); load(); }} className="text-14 text-[#999999] hover:text-danger">{t("dismiss")}</button>
							</li>
						))}
					</ul>
					<p className="mt-6 text-12 text-[#B3B3B3]">{t("requestsHelp")}</p>
				</div>
			)}

			<div className="mb-12 flex items-center gap-12">
				<h2 className="text-18 font-medium text-[#333333]">{t("firms")}</h2>
				<input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className={`${input} w-[240px]`} />
			</div>
			<div className="overflow-x-auto rounded-16 bg-white shadow-heroImage">
				<table className="w-full min-w-[900px] border-collapse text-left text-14">
					<thead>
						<tr className="border-b border-[#F0F0F0] bg-[#FAFCFF] text-[#999999]">
							{[t("colFirm"), t("colOwner"), t("colPlan"), t("colStripe"), t("colOverride"), t("colMembers"), t("colCreated"), ""].map((h, i) => <th key={i} className="px-12 py-12 font-medium">{h}</th>)}
						</tr>
					</thead>
					<tbody>
						{orgs.map((o) => (
							<tr key={o.id} className={`border-b border-[#F0F0F0] ${o.blocked ? "bg-[#FFF1F1]" : ""}`}>
								<td className="px-12 py-10 font-medium text-[#333333]">{o.name}{o.blocked && <span className="ml-6 text-12 text-danger">({t("blockedTag")})</span>}</td>
								<td className="px-12 py-10 text-[#666666]"><span className="block">{o.ownerName}</span><span className="text-12 text-[#999999]">{o.ownerEmail}</span></td>
								<td className="px-12 py-10"><span className="rounded-4 bg-[#EEF5FF] px-8 py-2 text-12 font-medium text-primaryColor">{o.plan}</span></td>
								<td className="px-12 py-10 text-[#666666]">
									{o.status ? `${o.stripePlan} · ${o.status}${o.interval ? ` · ${o.interval === "year" ? t("year") : t("month")}` : ""}` : "—"}
									{o.periodEnd && <span className="block text-12 text-[#999999]">{o.cancelAtPeriodEnd ? t("endsOn") : t("renewsOn")} {new Date(o.periodEnd).toLocaleDateString(locale === "ua" ? "uk" : locale)}</span>}
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
								<td className="px-12 py-10 text-[#666666]">{o.members}</td>
								<td className="px-12 py-10 text-[#999999]">{day(o.createdAt)}</td>
								<td className="px-12 py-10">
									<div className="flex flex-wrap gap-8">
										{o.hasSubscription && !o.cancelAtPeriodEnd && <button type="button" onClick={() => cancel(o)} className="text-14 text-primaryColor hover:underline">{t("cancelSub")}</button>}
										<button type="button" onClick={() => patch(o.id, { blocked: !o.blocked })} className={`text-14 hover:underline ${o.blocked ? "text-[#009A2B]" : "text-danger"}`}>{o.blocked ? t("unblock") : t("block")}</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{orgs.length === 0 && <p className="py-30 text-center text-14 text-[#999999]">{t("none")}</p>}
			</div>
		</div>
	);
}
