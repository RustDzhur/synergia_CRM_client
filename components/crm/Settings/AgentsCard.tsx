"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

interface Agent { id: string; name: string; scopes: string[]; envNames?: string[]; createdAt: string; lastUsedAt: string }

// Площадка агентов: список внешних агентов (DeepSeek Harness и др.), у каждого свой токен и свои права. Видна только
// администратору платформы (для остальных сервер отвечает 403 — карточка не рисуется). Токен показывается один раз.
export default function AgentsCard() {
	const t = useTranslations("settings");
	const [agents, setAgents] = useState<Agent[] | null>(null); // null — нет доступа или ещё грузится
	const [scopes, setScopes] = useState<string[]>([]);
	const [base, setBase] = useState("");
	const [name, setName] = useState("");
	const [picked, setPicked] = useState<string[]>(["blog"]);
	const [envNames, setEnvNames] = useState("");
	const [editing, setEditing] = useState<{ id: string; scopes: string[]; envNames: string } | null>(null);
	const [fresh, setFresh] = useState<{ name: string; token: string; scopes: string[]; envNames: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const res = await apiCall<{ agents: Agent[]; scopes: string[]; base: string }>("/api/agents");
		if (!res.ok || !res.data) return setAgents(null);
		setAgents(res.data.agents);
		setScopes(res.data.scopes);
		setBase(res.data.base);
	}, []);
	useEffect(() => { void load(); }, [load]);

	async function create() {
		setBusy(true);
		const res = await apiCall<{ token: string }>("/api/agents", "POST", { action: "create", name, scopes: picked, envNames });
		setBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setFresh({ name, token: res.data.token, scopes: picked, envNames });
		setName("");
		setEnvNames("");
		void load();
	}

	async function saveEdit() {
		if (!editing) return;
		setBusy(true);
		const res = await apiCall("/api/agents", "POST", { action: "update", id: editing.id, scopes: editing.scopes, envNames: editing.envNames });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("agentsSaved"));
		setEditing(null);
		void load();
	}

	async function revoke(a: Agent) {
		if (!window.confirm(t("agentsRevokeAsk", { name: a.name }))) return;
		const res = await apiCall("/api/agents", "POST", { action: "revoke", id: a.id });
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("agentsRevoked"));
		void load();
	}

	// Готовое сообщение для самого агента: его можно вставить ему в чат — он сам сохранит токен в свой .env (терминал не нужен)
	const forAgent = (f: NonNullable<typeof fresh>) => [
		`Твои данные доступа к платформе Firmspace. Сохрани их в свой файл .env рядом с рабочей папкой и не выводи токен в чат и логи:`,
		`FIRMSPACE_API=http://127.0.0.1:3210`,
		`FIRMSPACE_TOKEN=${f.token}`,
		`Все запросы: заголовок "Authorization: Bearer $FIRMSPACE_TOKEN".`,
		f.scopes.includes("blog") ? `Блог: GET/POST $FIRMSPACE_API/api/agent/blog (статья на en/de/ua, сохраняется черновиком) — формат в docs/AGENTS.md.` : "",
		f.scopes.includes("env") ? `Секреты: GET $FIRMSPACE_API/api/agent/env (список имён) и GET $FIRMSPACE_API/api/agent/env?name=ИМЯ (значение; для фирмы добавь &org=<id>). Тебе разрешено: ${f.envNames || "—"}.` : "",
	].filter(Boolean).join("\n");
	if (agents === null) return null;
	const api = `${base || "https://www.firmspace.de"}/api/agent/blog`;

	return (
		<div className="fs-card mb-20 p-16">
			<p className="text-14 font-medium text-[#f1f4ee]">{t("agentsTitle")}</p>
			<p className="mt-4 max-w-[720px] text-12 leading-[1.5] text-[#8c948b]">{t("agentsHelp")}</p>

			{agents.length > 0 && (
				<ul className="mt-12 flex flex-col gap-8">
					{agents.map((a) => (
						<li key={a.id} className="flex flex-wrap items-center justify-between gap-10 rounded-10 border border-inkLine px-12 py-10">
							<div className="min-w-0">
								<p className="text-13 text-[#f1f4ee]">{a.name} <span className="ml-6 text-11 text-[#c6ff4d]">{a.scopes.map((s) => t(`agentScope_${s}`)).join(", ")}</span></p>
								{a.scopes.includes("env") && <p className="text-11 text-[#8c948b]">{t("agentsEnvAllowed")}: {a.envNames?.join(", ") || "—"}</p>}
								<p className="text-11 text-[#8c948b]">{t("agentsCreated")}: {a.createdAt.slice(0, 10)} · {t("agentsLastUsed")}: {a.lastUsedAt ? a.lastUsedAt.slice(0, 16).replace("T", " ") : "—"}</p>
							</div>
							<div className="flex gap-8">
								<button type="button" onClick={() => setEditing(editing?.id === a.id ? null : { id: a.id, scopes: a.scopes, envNames: (a.envNames ?? []).join(", ") })} className="fs-btn fs-btn-ghost h-30 px-12 text-12">{t("agentsEdit")}</button>
								<button type="button" onClick={() => revoke(a)} className="fs-btn fs-btn-ghost h-30 px-12 text-12 text-[#F4A100]">{t("agentsRevoke")}</button>
							</div>
							{editing?.id === a.id && (
								<div className="flex w-full flex-wrap items-end gap-12 border-t border-inkLine pt-10">
									{scopes.map((s) => (
										<label key={s} className="flex cursor-pointer items-center gap-6 text-12 text-[#cfd4cb]">
											<input type="checkbox" checked={editing.scopes.includes(s)} onChange={(e) => setEditing((v) => v && ({ ...v, scopes: e.target.checked ? [...v.scopes, s] : v.scopes.filter((x) => x !== s) }))} className="h-14 w-14 accent-[#c6ff4d]" />
											{t(`agentScope_${s}`)}
										</label>
									))}
									{editing.scopes.includes("env") && <input value={editing.envNames} onChange={(e) => setEditing((v) => v && ({ ...v, envNames: e.target.value }))} placeholder="MAIL_PASSWORD, BLOG_TOKEN" aria-label={t("agentsEnvNames")} className="fs-field h-36 min-w-[240px] flex-1 px-12 text-13 outline-none" />}
									<button type="button" onClick={saveEdit} disabled={busy || !editing.scopes.length} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{busy ? "…" : t("agentsSave")}</button>
								</div>
							)}
						</li>
					))}
				</ul>
			)}

			{fresh && (
				<div className="mt-12 rounded-10 border border-[rgba(198,255,77,0.4)] bg-[rgba(198,255,77,0.06)] p-12">
					<p className="text-12 text-[#f1f4ee]">{t("agentsToken", { name: fresh.name })}</p>
					<code className="mt-6 block break-all rounded-8 bg-[rgba(0,0,0,0.35)] p-8 text-12 text-[#c6ff4d]">{fresh.token}</code>
					<p className="mt-6 text-11 text-[#8c948b]">API: {api} · {base || "https://www.firmspace.de"}/api/agent/env · docs/AGENTS.md</p>
					<div className="mt-8 flex gap-8">
						<button type="button" onClick={() => { void navigator.clipboard?.writeText(forAgent(fresh)); toast.success(t("agentsCopied")); }} className="fs-btn fs-btn-primary h-30 px-12 text-12">{t("agentsCopyForAgent")}</button>
						<button type="button" onClick={() => { void navigator.clipboard?.writeText(fresh.token); toast.success(t("agentsCopied")); }} className="fs-btn fs-btn-ghost h-30 px-12 text-12">{t("agentsCopy")}</button>
						<button type="button" onClick={() => setFresh(null)} className="fs-btn fs-btn-ghost h-30 px-12 text-12">{t("agentsDone")}</button>
					</div>
				</div>
			)}

			<div className="mt-12 flex flex-wrap items-end gap-12">
				<label className="flex min-w-[220px] flex-1 flex-col gap-6">
					<span className="text-11 text-[#8c948b]">{t("agentsName")}</span>
					<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("agentsNamePh")} className="fs-field h-40 w-full px-12 text-13 outline-none" />
				</label>
				<div className="flex flex-wrap items-center gap-12 pb-10">
					{scopes.map((s) => (
						<label key={s} className="flex cursor-pointer items-center gap-6 text-12 text-[#cfd4cb]">
							<input type="checkbox" checked={picked.includes(s)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s] : p.filter((x) => x !== s)))} className="h-14 w-14 accent-[#c6ff4d]" />
							{t(`agentScope_${s}`)}
						</label>
					))}
				</div>
				{picked.includes("env") && (
					<label className="flex min-w-[260px] flex-1 flex-col gap-6">
						<span className="text-11 text-[#8c948b]">{t("agentsEnvNames")}</span>
						<input value={envNames} onChange={(e) => setEnvNames(e.target.value)} maxLength={400} placeholder="MAIL_PASSWORD, BLOG_TOKEN" className="fs-field h-40 w-full px-12 text-13 outline-none" />
					</label>
				)}
				<button type="button" onClick={create} disabled={busy || name.trim().length < 2 || !picked.length || (picked.includes("env") && !envNames.trim())} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : t("agentsCreate")}</button>
			</div>
		</div>
	);
}
