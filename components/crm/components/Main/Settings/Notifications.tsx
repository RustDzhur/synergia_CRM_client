"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { NotificationPrefs, useCurrentUserStore } from "@/store/useCurrentUserStore";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import Checkbox from "../shared/Checkbox";
import SettingsTabs from "./SettingsTabs";

const DEFAULTS: NotificationPrefs = { browser: false, email: false, muteEmail: false, muteFrom: "10:00", muteTo: "10:00" };

const timeClass = "fs-field h-40 w-[112px] px-12 text-13 outline-none";

// Settings → Notifications (/crm/settings/notifications): три флажка, период «не беспокоить» и Save.
export default function Notifications() {
	const t = useTranslations("settings");
	const { user, updateUser } = useCurrentUserStore();
	const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (user) setPrefs({ ...DEFAULTS, ...user.notifications });
	}, [user]);

	const patch = (p: Partial<NotificationPrefs>) => setPrefs((prev) => ({ ...prev, ...p }));

	async function save() {
		setSaving(true);
		const ok = await updateUser({ notifications: prefs });
		setSaving(false);
		ok ? toast.success(t("notifSaved")) : toast.error(t("error"));
	}

	// Разрешение браузера нужно один раз — иначе флажок «Browser Tab Notifications» ничего бы не делал.
	async function toggleBrowser(checked: boolean) {
		patch({ browser: checked });
		if (checked && typeof Notification !== "undefined" && Notification.permission === "default") {
			try { await Notification.requestPermission(); } catch { /* не критично */ }
		}
	}

	const row = "flex items-center justify-between gap-16";
	const label = "text-13 text-[#cfd4cb]";

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="flex flex-col gap-20 lg:flex-row lg:gap-20">
				<SettingsTabs className="shrink-0 md:self-start" />
				<section className="w-full lg:w-[496px]">
					<h2 className="mb-10 text-15 font-semibold text-[#f1f4ee]">{t("notifTitle")}</h2>

					<div className={`${row} min-h-[44px]`}>
						<span className={label}>{t("notifBrowser")}</span>
						<Checkbox checked={prefs.browser} onChange={toggleBrowser} label={t("notifBrowser")} />
					</div>
					<div className={`${row} mt-16 min-h-[44px]`}>
						<span className={label}>{t("notifEmail")}</span>
						<Checkbox checked={prefs.email} onChange={(v) => patch({ email: v })} label={t("notifEmail")} />
					</div>

					<p className={`${label} mt-16`}>{t("notifMute")}</p>
					<div className={`${row} mt-10 items-end`}>
						<div className="flex gap-16 md:gap-24">
							<label>
								<span className="mb-6 block text-12 text-[#8c948b]">{t("from")}</span>
								<input type="time" value={prefs.muteFrom} onChange={(e) => patch({ muteFrom: e.target.value })} className={timeClass} />
							</label>
							<label>
								<span className="mb-6 block text-12 text-[#8c948b]">{t("to")}</span>
								<input type="time" value={prefs.muteTo} onChange={(e) => patch({ muteTo: e.target.value })} className={timeClass} />
							</label>
						</div>
						<div className="pb-10">
							<Checkbox checked={prefs.muteEmail} onChange={(v) => patch({ muteEmail: v })} label={t("notifMute")} />
						</div>
					</div>

					<button
						type="button"
						onClick={save}
						disabled={saving}
						className="fs-btn fs-btn-primary mt-24 h-40 w-full disabled:opacity-60 md:w-auto">
						{t("notifSave")}
					</button>
				</section>
			</div>
		</div>
	);
}
