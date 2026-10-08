"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import PageHeader from "@/components/crm/shared/PageHeader";

interface Stats { bank: string; funnel: { visits: number; registered: number; activated: number; connected: number }; connectedAccounts: number; volumeLast30d: number | null; codes: { id: string; code: string; label: string; active: boolean; visits: number }[] }
interface Lead { id: string; createdAt: string; expiresAt: string; data: Record<string, string> }

// Кабинет банка-партнёра: только агрегаты, коды и заявки, которые клиенты сами решили передать. Данных фирм здесь нет.
export default function BankPartnerCabinet() {
	const t = useTranslations("partner");
	const [st, setSt] = useState<Stats | null | false>(null);
	const [leads, setLeads] = useState<Lead[]>([]);
	const [label, setLabel] = useState("");

	const load = useCallback(async () => {
		const s = await apiCall<Stats>("/api/bank-partner/stats", "GET", undefined, { cache: "no-store" });
		if (!s.ok || !s.data) return setSt(false);
		setSt(s.data);
		const l = await apiCall<{ leads: Lead[] }>("/api/bank-partner/leads", "GET", undefined, { cache: "no-store" });
		if (l.ok && l.data) setLeads(l.data.leads);
	}, []);
	useEffect(() => { void load(); }, [load]);

	if (st === null) return null;
	if (st === false) return <div className="px-16 py-24 text-13 text-[#8c948b]">{t("noAccess")}</div>;
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const f = st.funnel;
	return (
		<div className="px-16 py-20 md:px-24 lg:px-32">
			<PageHeader />
			<h1 className="text-18 font-semibold text-[#f1f4ee]">{t("cabinetTitle", { bank: st.bank })}</h1>
			<p className="mt-6 max-w-[640px] text-12 leading-[1.5] text-[#8c948b]">{t("cabinetHint")}</p>
			<div className="mt-16 grid grid-cols-2 gap-12 md:grid-cols-5">
				{([["visits", f.visits], ["registered", f.registered], ["activated", f.activated], ["connected", f.connected], ["accounts", st.connectedAccounts]] as const).map(([k, v]) => (
					<div key={k} className="fs-card p-14"><div className="text-12 text-[#8c948b]">{t(`funnel_${k}` as never)}</div><div className="mt-4 text-20 font-semibold text-[#f1f4ee]">{v}</div></div>
				))}
			</div>
			<p className="mt-10 text-13 text-[#cfd4cb]">{t("volume")}: {st.volumeLast30d === null ? t("volumeHidden") : st.volumeLast30d}</p>

			<h3 className="mb-8 mt-20 text-14 font-semibold text-[#f1f4ee]">{t("codes")}</h3>
			<ul className="flex flex-col gap-6">
				{st.codes.map((c) => (
					<li key={c.id} className="fs-card flex flex-wrap items-center gap-x-12 gap-y-4 p-12 text-13 text-[#f1f4ee]">
						<span className="break-all">{origin}/partner/{c.code}</span><span className="text-[#8c948b]">{c.label}</span><span className="text-12 text-[#8c948b]">{t("funnel_visits")}: {c.visits}</span>
						<button type="button" className="ml-auto text-12 text-[#c6ff4d] hover:underline" onClick={() => void apiCall(`/api/bank-partner/codes/${c.id}`, "PATCH", { active: !c.active }).then(() => load())}>{c.active ? t("codeDisable") : t("codeEnable")}</button>
					</li>
				))}
			</ul>
			<div className="mt-10 flex gap-8">
				<input className="fs-field h-38 min-w-[200px] px-12 text-13 outline-none" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("codeLabel")} maxLength={60} />
				<button type="button" className="fs-btn fs-btn-ghost h-38" onClick={() => void apiCall("/api/bank-partner/codes", "POST", { label }).then((r) => { if (!r.ok) toast.error(r.message); else { setLabel(""); void load(); } })}>{t("codeNew")}</button>
			</div>

			<h3 className="mb-8 mt-20 text-14 font-semibold text-[#f1f4ee]">{t("leads")}</h3>
			<ul className="flex flex-col gap-6">
				{leads.length === 0 && <li className="text-12 text-[#8c948b]">{t("leadsEmpty")}</li>}
				{leads.map((l) => (
					<li key={l.id} className="fs-card p-12 text-13 text-[#f1f4ee]">
						{Object.entries(l.data).map(([k, v]) => <span key={k} className="mr-14"><span className="text-[#8c948b]">{t(`field_${k}` as never)}: </span>{v}</span>)}
						<span className="text-12 text-[#8c948b]">· {t("until", { date: new Date(l.expiresAt).toLocaleDateString() })}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
