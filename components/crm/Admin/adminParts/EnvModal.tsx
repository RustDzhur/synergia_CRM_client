"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import Modal from "../../shared/Modal";
import { inputClass } from "./model";

interface Var { name: string; length: number; updatedAt: string; updatedBy: string }

// Переменные окружения фирмы: клиент прислал ключ нужного ему API — администратор вносит его здесь, и серверная интеграция читает его
// как getFirmEnv(фирма, "ИМЯ"); в правилах автоматизации доступно {{env.ИМЯ}} в адресе вебхука. Значения шифруются в базе; администратор
// может показать значение кнопкой «глаз» (в журнал аудита), а внешний агент читает их через /api/agent/env по своему токену.
// org.id === "platform" — общие переменные платформы (для агентов).
export default function EnvModal({ org, onClose }: { org: { id: string; name: string } | null; onClose: () => void }) {
	const t = useTranslations("admin");
	const [vars, setVars] = useState<Var[]>([]);
	const [name, setName] = useState("");
	const [value, setValue] = useState("");
	const [busy, setBusy] = useState(false);
	const [shown, setShown] = useState<Record<string, string>>({});

	const load = useCallback(async () => {
		if (!org) return;
		const res = await apiCall<Var[]>(`/api/admin/orgs/${org.id}/env`);
		if (res.data) setVars(res.data);
	}, [org]);
	useEffect(() => { setName(""); setValue(""); setVars([]); setShown({}); void load(); }, [load]);

	async function save() {
		if (!org) return;
		setBusy(true);
		const res = await apiCall(`/api/admin/orgs/${org.id}/env`, "PUT", { name: name.trim().toUpperCase(), value });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("saved"));
		setName(""); setValue("");
		void load();
	}
	async function reveal(v: Var) {
		if (!org) return;
		if (shown[v.name] !== undefined) return setShown(({ [v.name]: _, ...rest }) => rest);
		const res = await apiCall<{ value: string }>(`/api/admin/orgs/${org.id}/env?reveal=${encodeURIComponent(v.name)}`);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setShown((s) => ({ ...s, [v.name]: res.data!.value }));
	}
	async function remove(v: Var) {
		if (!org || !window.confirm(t("envDeleteAsk", { name: v.name }))) return;
		const res = await apiCall(`/api/admin/orgs/${org.id}/env?name=${encodeURIComponent(v.name)}`, "DELETE");
		if (!res.ok) return void toast.error(res.message);
		void load();
	}

	return (
		<Modal open={!!org} onClose={onClose} label={t("envTitle")} align="top" className="fs-popover w-full max-w-[600px] p-20">
			{org && (
				<>
					<h2 className="mb-6 text-15 font-semibold text-[#f1f4ee]">{t("envHeading", { name: org.name })}</h2>
					<p className="mb-14 text-12 leading-[1.5] text-[#8c948b]">{t("envHelp")}</p>
					{vars.length === 0 ? <p className="mb-14 text-12 text-[#8c948b]">{t("envNone")}</p> : (
						<ul className="mb-14 flex flex-col gap-8">
							{vars.map((v) => (
								<li key={v.name} className="flex items-center justify-between gap-10 rounded-10 border border-inkLine px-12 py-8">
									<div className="min-w-0">
										<p className="text-13 text-[#f1f4ee]"><code>{v.name}</code> <span className="ml-6 text-11 text-[#8c948b]">{shown[v.name] === undefined ? `•••• (${v.length})` : ""}</span></p>
										{shown[v.name] !== undefined && <code className="mt-4 block select-all break-all rounded-8 bg-[rgba(0,0,0,0.35)] p-6 text-12 text-[#c6ff4d]">{shown[v.name]}</code>}
										<p className="text-11 text-[#9AA396]">{v.updatedAt.slice(0, 16).replace("T", " ")} {v.updatedBy}</p>
									</div>
									<div className="flex shrink-0 gap-12">
										<button type="button" onClick={() => reveal(v)} className="text-12 text-[#c6ff4d] hover:underline">{shown[v.name] === undefined ? t("envReveal") : t("envHide")}</button>
										<button type="button" onClick={() => remove(v)} className="text-12 text-danger hover:underline">{t("envDelete")}</button>
									</div>
								</li>
							))}
						</ul>
					)}
					<div className="grid gap-10 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
						<label className="flex flex-col gap-6"><span className="text-11 text-[#8c948b]">{t("envName")}</span><input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="SHIPPING_API_KEY" maxLength={64} className={`${inputClass} w-full`} /></label>
						<label className="flex flex-col gap-6"><span className="text-11 text-[#8c948b]">{t("envValue")}</span><input value={value} onChange={(e) => setValue(e.target.value)} type="password" autoComplete="off" maxLength={4000} className={`${inputClass} w-full`} /></label>
						<button type="button" onClick={save} disabled={busy || name.trim().length < 2 || !value} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{busy ? "…" : t("envSave")}</button>
					</div>
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost mt-16 h-34">{t("cancel")}</button>
				</>
			)}
		</Modal>
	);
}
