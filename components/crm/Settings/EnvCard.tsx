"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

interface Var { name: string; length: number; updatedAt: string; updatedBy: string }

// Переменные окружения фирмы — единственное место, где их задают. Каждая фирма вносит свои ключи сама (API доставки, склада, почтового
// сервиса…); значения шифруются на сервере, их видно по кнопке «Показать». Используются в правилах автоматизации как {{env.ИМЯ}}
// (например, в адресе вебхука) и читаются внешним агентом, которому разрешено это в ключе «Подключить агента или бота».
export default function EnvCard() {
	const t = useTranslations("settings");
	const [vars, setVars] = useState<Var[] | null>(null); // null — нет прав или грузится
	const [name, setName] = useState("");
	const [value, setValue] = useState("");
	const [busy, setBusy] = useState(false);
	const [shown, setShown] = useState<Record<string, string>>({});

	const load = useCallback(async () => {
		const res = await apiCall<Var[]>("/api/env");
		setVars(res.ok && res.data ? res.data : null);
	}, []);
	useEffect(() => { void load(); }, [load]);

	async function save() {
		setBusy(true);
		const res = await apiCall("/api/env", "PUT", { name: name.trim().toUpperCase(), value });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("envSaved"));
		setName(""); setValue("");
		void load();
	}
	async function reveal(v: Var) {
		if (shown[v.name] !== undefined) return setShown(({ [v.name]: _, ...rest }) => rest);
		const res = await apiCall<{ value: string }>(`/api/env?reveal=${encodeURIComponent(v.name)}`);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setShown((s) => ({ ...s, [v.name]: res.data!.value }));
	}
	async function remove(v: Var) {
		if (!window.confirm(t("envDeleteAsk", { name: v.name }))) return;
		const res = await apiCall(`/api/env?name=${encodeURIComponent(v.name)}`, "DELETE");
		if (!res.ok) return void toast.error(res.message);
		void load();
	}

	if (vars === null) return null;
	return (
		<div className="fs-card mb-20 p-16">
			<p className="text-14 font-medium text-[#f1f4ee]">{t("envTitle")}</p>
			<p className="mt-4 max-w-[720px] text-12 leading-[1.5] text-[#8c948b]">{t("envHelp")}</p>

			{vars.length === 0 ? (
				<p className="mt-12 text-12 text-[#8c948b]">{t("envNone")}</p>
			) : (
				<ul className="mt-12 flex flex-col gap-8">
					{vars.map((v) => (
						<li key={v.name} className="flex flex-wrap items-center justify-between gap-10 rounded-10 border border-inkLine px-12 py-8">
							<div className="min-w-0">
								<p className="text-13 text-[#f1f4ee]"><code>{v.name}</code> <span className="ml-6 text-11 text-[#8c948b]">{shown[v.name] === undefined ? `•••• (${v.length})` : ""}</span></p>
								{shown[v.name] !== undefined && <code className="mt-4 block select-all break-all rounded-8 bg-[rgba(0,0,0,0.35)] p-6 text-12 text-[#c6ff4d]">{shown[v.name]}</code>}
								<p className="text-11 text-[#9AA396]">{v.updatedAt.slice(0, 16).replace("T", " ")}</p>
							</div>
							<div className="flex gap-12">
								<button type="button" onClick={() => reveal(v)} className="text-12 text-[#c6ff4d] hover:underline">{shown[v.name] === undefined ? t("envShow") : t("envHide")}</button>
								<button type="button" onClick={() => remove(v)} className="text-12 text-danger hover:underline">{t("envDelete")}</button>
							</div>
						</li>
					))}
				</ul>
			)}

			<div className="mt-14 grid gap-10 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
				<label className="flex flex-col gap-6"><span className="text-11 text-[#8c948b]">{t("envName")}</span><input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="SHIPPING_API_KEY" maxLength={64} className="fs-field h-40 w-full px-12 text-13 outline-none" /></label>
				<label className="flex flex-col gap-6"><span className="text-11 text-[#8c948b]">{t("envValue")}</span><input value={value} onChange={(e) => setValue(e.target.value)} type="password" autoComplete="off" maxLength={4000} className="fs-field h-40 w-full px-12 text-13 outline-none" /></label>
				<button type="button" onClick={save} disabled={busy || name.trim().length < 2 || !value} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : t("envSave")}</button>
			</div>
			<p className="mt-8 text-11 text-[#8c948b]">{t("envUse")}</p>
		</div>
	);
}
