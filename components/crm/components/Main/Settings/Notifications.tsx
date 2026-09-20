"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { NotificationPrefs, useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import Checkbox from "../shared/Checkbox";
import SettingsTabs from "./SettingsTabs";

const DEFAULTS: NotificationPrefs = { browser: false, email: false, muteEmail: false, muteFrom: "10:00", muteTo: "10:00" };

const timeClass =
	"h-[40px] w-[112px] rounded-8 border border-[#EFEFEF] bg-[#F7F9FC] px-10 text-16 text-[#999999] shadow-custom outline-none transition-colors focus:border-[#5EA8F5]";

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
	const label = "text-16 text-iconColor md:text-18";

	return (
		<div className="p-16 md:p-30">
			<div className="flex flex-col gap-30 lg:flex-row lg:gap-30">
				<SettingsTabs className="shrink-0 md:self-start" />
				<section className="w-full lg:w-[496px]">
					<h2 className="mb-10 text-20 font-semibold text-[#666666]">{t("notifTitle")}</h2>

					<div className={`${row} min-h-[50px]`}>
						<span className={label}>{t("notifBrowser")}</span>
						<Checkbox checked={prefs.browser} onChange={toggleBrowser} label={t("notifBrowser")} />
					</div>
					<div className={`${row} mt-16 min-h-[50px]`}>
						<span className={label}>{t("notifEmail")}</span>
						<Checkbox checked={prefs.email} onChange={(v) => patch({ email: v })} label={t("notifEmail")} />
					</div>

					<p className={`${label} mt-16`}>{t("notifMute")}</p>
					<div className={`${row} mt-10 items-end`}>
						<div className="flex gap-16 md:gap-30">
							<label>
								<span className="mb-6 block text-14 text-[#CCCCCC]">{t("from")}</span>
								<input type="time" value={prefs.muteFrom} onChange={(e) => patch({ muteFrom: e.target.value })} className={timeClass} />
							</label>
							<label>
								<span className="mb-6 block text-14 text-[#CCCCCC]">{t("to")}</span>
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
						className="mt-30 h-[44px] w-full rounded-4 bg-primaryColor px-30 text-16 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60 md:w-auto">
						{t("notifSave")}
					</button>
				</section>
			</div>
		</div>
	);
}
