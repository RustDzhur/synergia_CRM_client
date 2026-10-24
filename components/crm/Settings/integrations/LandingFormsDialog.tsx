"use client";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbX } from "react-icons/tb";
import { SITE_PATTERN } from "@/lib/landingLeads";
import { useIntegrationsStore } from "@/store/useIntegrationsStore";
import Modal from "../../shared/Modal";
import CopyField from "./integrationParts/CopyField";

// Окно «Формы с сайтов» (Settings → Integration): фирма сама заводит токен приёма заявок под метку
// своего сайта. Заявки с формы идут на POST /api/webhooks/landing/<token> и попадают в CRM карточкой
// в колонке «New Lead» (см. app/api/webhooks/landing/[token]/route.ts). Одна метка — один сайт/форма.
export default function LandingFormsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const t = useTranslations("settings");
	const { items, connect, remove, load } = useIntegrationsStore();
	const [site, setSite] = useState("");
	const [busyAdd, setBusyAdd] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [error, setError] = useState("");

	const forms = items.filter((i) => i.type === "landing");

	async function create(e: React.FormEvent) {
		e.preventDefault();
		if (busyAdd) return;
		const label = site.trim().toLowerCase();
		if (!SITE_PATTERN.test(label)) return setError(t("intLandingSiteBad"));
		setBusyAdd(true);
		setError("");
		const res = await connect("landing", { site: label });
		setBusyAdd(false);
		if (!res.ok) return setError(/already exists/i.test(res.message) ? t("intLandingDup") : res.message);
		setSite("");
		toast.success(t("intLandingCreated"));
		void load();
	}

	async function revoke(id: string) {
		if (busyId) return;
		setBusyId(id);
		const ok = await remove(id);
		setBusyId(null);
		if (ok) {
			toast(t("intLandingRevoked"));
			void load();
		} else toast.error(t("intFailed"));
	}

	return (
		<Modal open={open} onClose={onClose} label={t("intLandingForms")} className="w-full max-w-[560px]">
			<div className="fs-popover fs-scroll max-h-[calc(100vh-32px)] overflow-y-auto">
				<div className="flex items-center justify-between border-b border-inkLine bg-[rgba(124,147,255,0.06)] px-20 py-12">
					<h2 className="text-15 font-semibold text-[#edf2ff]">{t("intLandingForms")}</h2>
					<button type="button" onClick={onClose} aria-label={t("intClose")} className="text-[#9aa7c9] transition-colors hover:text-[#edf2ff]">
						<TbX size={18} />
					</button>
				</div>

				<div className="flex flex-col gap-14 p-20">
					<p className="text-12 leading-[1.5] text-[#9aa7c9]">{t("intLandingHint")}</p>

					{forms.length === 0 && <p className="text-12 text-[#9aa7c9]">{t("intLandingEmpty")}</p>}

					{forms.map((item) => {
						const token = item.webhookUrl.split("/").pop() ?? "";
						return (
							<div key={item.id} className="flex flex-col gap-10 rounded-10 border border-inkLine p-12">
								<div className="flex items-center justify-between gap-8">
									<span className="min-w-0 truncate text-13 font-medium text-[#edf2ff]">{String(item.config.site ?? "")}</span>
									<button
										type="button"
										disabled={busyId !== null}
										onClick={() => revoke(item.id)}
										className="shrink-0 rounded-8 border border-inkLine px-10 py-6 text-12 text-danger transition-colors hover:border-[rgba(235,87,87,0.4)] hover:bg-[rgba(235,87,87,0.08)] disabled:opacity-50">
										{busyId === item.id ? "…" : t("intLandingRevoke")}
									</button>
								</div>
								<CopyField label={t("intCallbackUrl")} value={item.webhookUrl} />
								<CopyField label={t("intLandingToken")} value={token} />
							</div>
						);
					})}

					<form onSubmit={create} className="flex items-end gap-8">
						<label className="block min-w-0 flex-1">
							<span className="mb-6 block text-12 text-[#9aa7c9]">{t("intLandingSite")}</span>
							<input
								value={site}
								onChange={(e) => setSite(e.target.value)}
								placeholder={t("intLandingSitePh")}
								pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{1,30}"
								maxLength={31}
								autoComplete="off"
								className="fs-field h-40 w-full px-12 text-13 outline-none"
							/>
						</label>
						<button type="submit" disabled={busyAdd} className="fs-btn h-40 shrink-0 fs-btn-primary disabled:opacity-50">
							{busyAdd ? "…" : t("intLandingAdd")}
						</button>
					</form>

					{error && <p role="alert" className="text-13 text-danger [overflow-wrap:anywhere]">{error}</p>}
				</div>
			</div>
		</Modal>
	);
}
