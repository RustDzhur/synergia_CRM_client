"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import { useCurrentUserStore } from "@/store/useCurrentUserStore";
import { type FeatureKey, planFor } from "@/config/plans";
import PageHeader from "@/components/crm/shared/PageHeader";
import BlogAdmin from "./BlogAdmin";
import ErrorsCard from "./adminParts/ErrorsCard";
import FeaturesModal from "./adminParts/FeaturesModal";
import EnvModal from "./adminParts/EnvModal";
import MetaCard from "./adminParts/MetaCard";
import OrgsTable from "./adminParts/OrgsTable";
import RequestsList from "./adminParts/RequestsList";
import StatsGrid from "./adminParts/StatsGrid";
import SystemCheckCard from "./adminParts/SystemCheckCard";
import { addDays, OrgRow, Req, Summary } from "./adminParts/model";

// Админ-кабинет владельца платформы (/crm/admin): фирмы-клиенты, их тарифы и подписки, запросы счетов. Доступ — по ADMIN_EMAILS.
export default function AdminPanel() {
	const t = useTranslations("admin");
	const [denied, setDenied] = useState(false);
	// Права проверяем ещё до запросов: без них незачем дёргать админские маршруты,
	// а пользователь сразу видит, что кабинет ему недоступен. Сервер проверяет то же самое.
	const me = useCurrentUserStore((s) => s.user);
	const [summary, setSummary] = useState<Summary | null>(null);
	const [orgs, setOrgs] = useState<OrgRow[]>([]);
	const [reqs, setReqs] = useState<Req[]>([]);
	const [q, setQ] = useState("");
	const [envFor, setEnvFor] = useState<OrgRow | null>(null); // фирма, которой сейчас правим переменные окружения
	const [featuresFor, setFeaturesFor] = useState<OrgRow | null>(null); // фирма, которой сейчас правим разделы

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
	async function dismiss(r: Req) {
		await apiCall(`/api/admin/requests/${r.id}`, "PATCH", { status: "done" });
		load();
	}

	if (denied) return <p className="px-16 py-20 text-13 text-[#8c948b] md:px-24 md:py-24 lg:px-32">{t("denied")}</p>;
	const newRequests = reqs.filter((r) => r.status === "new");

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<h1 className="mb-16 text-20 font-semibold text-[#f1f4ee]">{t("title")}</h1>
			<SystemCheckCard />
			<MetaCard />
			<ErrorsCard />
			{summary && <StatsGrid summary={summary} />}
			{newRequests.length > 0 && <RequestsList requests={newRequests} onActivate={activate} onDismiss={dismiss} />}
			<OrgsTable orgs={orgs} query={q} onQuery={setQ} onPatch={patch} onFeatures={setFeaturesFor} onEnv={setEnvFor} onCancel={cancel} />
			<EnvModal org={envFor} onClose={() => setEnvFor(null)} />
			<FeaturesModal org={featuresFor} onClose={() => setFeaturesFor(null)} onToggle={(key, value) => featuresFor && toggleFeature(featuresFor, key, value)} />
			<BlogAdmin />
		</div>
	);
}
