"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

interface Key { id: string; name: string; level: "read" | "work"; modules: string[]; envNames?: string[]; approval: boolean; createdAt: string; lastUsedAt: string; calls: number }
interface Req { id: string; tool: string; args: Record<string, unknown>; target: string; agent: string; at: string }

// «Подключить агента»: клиент сам заводит ключ для своего ИИ-агента или бота (Claude, ChatGPT, Cursor, n8n, Zapier, Harness, свой
// скрипт), выбирает, что ему можно, и получает готовые строки подключения. Изменения от агента по умолчанию ждут одобрения здесь же.
export default function ConnectCard() {
	const t = useTranslations("settings");
	const [keys, setKeys] = useState<Key[]>([]);
	const [reqs, setReqs] = useState<Req[]>([]);
	const [modules, setModules] = useState<string[]>([]);
	const [allowed, setAllowed] = useState(true);
	const [base, setBase] = useState("https://www.firmspace.de");
	const [name, setName] = useState("");
	const [level, setLevel] = useState<"read" | "work">("read");
	const [picked, setPicked] = useState<string[]>(["crm", "tasks"]);
	const [approval, setApproval] = useState(true);
	const [envNames, setEnvNames] = useState("");
	const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [visible, setVisible] = useState(false); // карточка видна владельцу и администратору фирмы

	const load = useCallback(async () => {
		const res = await apiCall<{ keys: Key[]; requests: Req[]; modules: string[]; allowed: boolean; base: string }>("/api/connect/keys");
		if (!res.ok || !res.data) return setVisible(false);
		setVisible(true);
		setKeys(res.data.keys); setReqs(res.data.requests); setModules(res.data.modules); setAllowed(res.data.allowed); setBase(res.data.base);
	}, []);
	useEffect(() => { void load(); }, [load]);
	// запросы агентов приходят в любой момент — обновляем список раз в полминуты, пока страница открыта
	useEffect(() => { const id = setInterval(() => { void load(); }, 30_000); return () => clearInterval(id); }, [load]);

	async function create() {
		setBusy(true);
		const res = await apiCall<{ token: string }>("/api/connect/keys", "POST", { action: "create", name, level, modules: picked, approval, envNames });
		setBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setFresh({ name, token: res.data.token });
		setName(""); setEnvNames("");
		void load();
	}
	async function act(action: "revoke" | "approve" | "reject", id: string) {
		const res = await apiCall("/api/connect/keys", "POST", { action, id });
		if (!res.ok) return void toast.error(res.message);
		toast.success(t(action === "revoke" ? "connectRevoked" : action === "approve" ? "connectApproved" : "connectRejected"));
		void load();
	}

	if (!visible) return null;
	const mcp = `${base}/api/connect/mcp`;
	const mcpJson = (token: string) => JSON.stringify({ mcpServers: { firmspace: { url: mcp, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
	const curl = (token: string) => `curl -H "Authorization: Bearer ${token}" ${base}/api/connect/tools\ncurl -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"query":"Müller"}' ${base}/api/connect/tools/search_contacts`;
	const copy = (text: string) => { void navigator.clipboard?.writeText(text); toast.success(t("connectCopied")); };
	const box = "mt-6 block max-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-8 bg-[rgba(0,0,0,0.35)] p-8 text-11 text-[#c6ff4d]";

	return (
		<div className="fs-card mb-20 p-16">
			<p className="text-14 font-medium text-[#f1f4ee]">{t("connectTitle")}</p>
			<p className="mt-4 max-w-[760px] text-12 leading-[1.5] text-[#8c948b]">{t("connectHelp")}</p>
			{!allowed && <p className="mt-8 text-12 text-[#F4A100]">{t("connectPlan")}</p>}

			{reqs.length > 0 && (
				<div className="mt-12 rounded-10 border border-[rgba(244,161,0,0.4)] bg-[rgba(244,161,0,0.06)] p-12">
					<p className="text-12 font-medium text-[#f1f4ee]">{t("connectRequests", { count: reqs.length })}</p>
					<ul className="mt-8 flex flex-col gap-8">
						{reqs.map((r) => (
							<li key={r.id} className="flex flex-wrap items-center justify-between gap-10">
								<div className="min-w-0 text-12 text-[#cfd4cb]"><b>{r.agent}</b>: {r.tool}{r.target ? ` — ${r.target}` : ""}<span className="ml-6 text-11 text-[#8c948b]">{r.at.slice(0, 16).replace("T", " ")}</span></div>
								<div className="flex gap-8">
									<button type="button" onClick={() => act("approve", r.id)} className="fs-btn fs-btn-primary h-30 px-12 text-12">{t("connectApprove")}</button>
									<button type="button" onClick={() => act("reject", r.id)} className="fs-btn fs-btn-ghost h-30 px-12 text-12">{t("connectReject")}</button>
								</div>
							</li>
						))}
					</ul>
				</div>
			)}

			{keys.length > 0 && (
				<ul className="mt-12 flex flex-col gap-8">
					{keys.map((k) => (
						<li key={k.id} className="flex flex-wrap items-center justify-between gap-10 rounded-10 border border-inkLine px-12 py-10">
							<div className="min-w-0">
								<p className="text-13 text-[#f1f4ee]">{k.name} <span className="ml-6 text-11 text-[#c6ff4d]">{t(k.level === "work" ? "connectLevelWork" : "connectLevelRead")}{k.approval ? ` · ${t("connectNeedsApproval")}` : ""}</span></p>
								<p className="text-11 text-[#8c948b]">{k.modules.join(", ")}{k.envNames?.length ? ` · ${t("connectEnvShort")}: ${k.envNames.join(", ")}` : ""} · {t("agentsLastUsed")}: {k.lastUsedAt ? k.lastUsedAt.slice(0, 16).replace("T", " ") : "—"} · {k.calls}</p>
							</div>
							<button type="button" onClick={() => { if (window.confirm(t("agentsRevokeAsk", { name: k.name }))) void act("revoke", k.id); }} className="fs-btn fs-btn-ghost h-30 px-12 text-12 text-[#F4A100]">{t("agentsRevoke")}</button>
						</li>
					))}
				</ul>
			)}

			{fresh && (
				<div className="mt-12 rounded-10 border border-[rgba(198,255,77,0.4)] bg-[rgba(198,255,77,0.06)] p-12">
					<p className="text-12 text-[#f1f4ee]">{t("agentsToken", { name: fresh.name })}</p>
					<code className={box}>{fresh.token}</code>
					<button type="button" onClick={() => copy(fresh.token)} className="fs-btn fs-btn-primary mt-8 h-30 px-12 text-12">{t("agentsCopy")}</button>
					<p className="mt-12 text-12 text-[#f1f4ee]">{t("connectSnippetMcp")}</p>
					<code className={box}>{mcpJson(fresh.token)}</code>
					<button type="button" onClick={() => copy(mcpJson(fresh.token))} className="fs-btn fs-btn-ghost mt-6 h-30 px-12 text-12">{t("agentsCopy")}</button>
					<p className="mt-12 text-12 text-[#f1f4ee]">{t("connectSnippetRest")}</p>
					<code className={box}>{curl(fresh.token)}</code>
					<button type="button" onClick={() => setFresh(null)} className="fs-btn fs-btn-ghost mt-10 h-30 px-12 text-12">{t("agentsDone")}</button>
				</div>
			)}

			<div className="mt-14 grid gap-12 md:grid-cols-2">
				<label className="flex flex-col gap-6">
					<span className="text-11 text-[#8c948b]">{t("agentsName")}</span>
					<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("connectNamePh")} className="fs-field h-40 w-full px-12 text-13 outline-none" />
				</label>
				<label className="flex flex-col gap-6">
					<span className="text-11 text-[#8c948b]">{t("connectLevel")}</span>
					<select value={level} onChange={(e) => setLevel(e.target.value === "work" ? "work" : "read")} className="fs-field h-40 px-10 text-13 outline-none">
						<option value="read">{t("connectLevelReadLong")}</option>
						<option value="work">{t("connectLevelWorkLong")}</option>
					</select>
				</label>
			</div>
			<div className="mt-10 flex flex-wrap items-center gap-12">
				<span className="text-11 text-[#8c948b]">{t("connectSections")}:</span>
				{modules.map((m) => (
					<label key={m} className="flex cursor-pointer items-center gap-6 text-12 text-[#cfd4cb]">
						<input type="checkbox" checked={picked.includes(m)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m] : p.filter((x) => x !== m)))} className="h-14 w-14 accent-[#c6ff4d]" />
						{t(`connectSection_${m}`)}
					</label>
				))}
			</div>
			{/* Секреты фирмы агенту: только перечисленные имена из «Переменные окружения» выше; пусто — ни одной */}
			<label className="mt-10 flex flex-col gap-6">
				<span className="text-11 text-[#8c948b]">{t("connectEnvNames")}</span>
				<input value={envNames} onChange={(e) => setEnvNames(e.target.value)} maxLength={400} placeholder="SHIPPING_API_KEY, MAIL_PASSWORD" className="fs-field h-40 w-full px-12 text-13 outline-none" />
			</label>
			{level === "work" && (
				<label className="mt-10 flex cursor-pointer items-start gap-8 text-12 text-[#cfd4cb]">
					<input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} className="mt-[2px] h-14 w-14 shrink-0 accent-[#c6ff4d]" />
					<span>{t("connectApprovalLabel")}<span className="block text-11 text-[#8c948b]">{t("connectApprovalHint")}</span></span>
				</label>
			)}
			<div className="mt-12 flex flex-wrap items-center gap-12">
				<button type="button" onClick={create} disabled={busy || !allowed || name.trim().length < 2 || !picked.length} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : t("connectCreate")}</button>
				<span className="text-11 text-[#8c948b]">MCP: <code className="text-[#cfd4cb]">{mcp}</code></span>
			</div>
		</div>
	);
}
