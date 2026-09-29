"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import { inputClass } from "./model";

// Приложение Meta для всей платформы: через него фирмы подключают свои страницы Facebook и номера
// WhatsApp. Задаётся один раз здесь — тогда в кабинете фирмы достаточно одной кнопки.
export default function MetaCard() {
	const t = useTranslations("admin");
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

	return (
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
						<input value={metaId} onChange={(e) => setMetaId(e.target.value)} placeholder="1098409499579046" maxLength={40} className={inputClass} />
					</label>
					<label className="flex flex-col gap-6">
						<span className="text-11 text-[#8c948b]">{t("metaSecret")}</span>
						<input value={metaSecret} onChange={(e) => setMetaSecret(e.target.value)} type="password" autoComplete="off" maxLength={80} placeholder={metaHasSecret ? t("metaKeepSecret") : ""} className={inputClass} />
					</label>
				</div>
			)}
			{metaFromEnv && <p className="mt-8 text-11 text-[#8c948b]">{t("metaFromEnvHelp")}</p>}
		</div>
	);
}
