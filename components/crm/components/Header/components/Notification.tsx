"use client";
import React, { useRef } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MdAccessAlarm, MdAutoMode, MdCallMissed, MdChat, MdMail, MdNotifications, MdPersonAdd } from "react-icons/md";
import { useNotificationStore, type Notif } from "@/app/store/useNotificationStore";
import Dropdown from "@/app/utils/Dropdown";
import { notifText } from "@/app/utils/notifText";
import { useClickOutside } from "@/app/utils/useClickOutside";

const ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
	mail: MdMail, mail_many: MdMail, lead: MdPersonAdd, message: MdChat, missed_call: MdCallMissed, deadline: MdAccessAlarm, team: MdChat, automation: MdAutoMode,
};

const ago = (iso: string) => {
	const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
	if (m < 1) return "now";
	if (m < 60) return `${m} min`;
	const h = Math.round(m / 60);
	return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
};

// Колокольчик в шапке: число непрочитанных и список — письма, лиды, пропущенные звонки, сообщения в каналах, дедлайны.
// Опрос сервера и системные уведомления — в NotificationCenter (подключён один раз в layout CRM).
export default function Notification() {
	const t = useTranslations("notif");
	const locale = useLocale();
	const { items, unread, open, toggle, close, markRead, markAll } = useNotificationStore();
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, close);

	const row = (n: Notif) => {
		const Icon = ICON[n.type] ?? MdNotifications;
		const body = (
			<>
				<Icon size={22} className={`mt-2 shrink-0 ${n.type === "deadline" ? "text-[#F4A100]" : "text-primaryColor"}`} />
				<span className="min-w-0 flex-1">
					<span className={`block text-14 ${n.read ? "text-[#999999]" : "font-medium text-[#333333]"}`}>{notifText(t, n)}</span>
					<span className="block text-12 text-[#B3B3B3]">{ago(n.at)}</span>
				</span>
				{!n.read && <span className="mt-6 h-[8px] w-[8px] shrink-0 rounded-[50%] bg-primaryColor" aria-hidden />}
			</>
		);
		const cls = "flex w-full items-start gap-10 px-16 py-10 text-left transition-colors hover:bg-gray";
		return n.link ? (
			<Link key={n.id} href={`/${locale}${n.link}`} onClick={() => { markRead([n.id]); close(); }} className={cls}>{body}</Link>
		) : (
			<button key={n.id} type="button" onClick={() => markRead([n.id])} className={cls}>{body}</button>
		);
	};

	return (
		<div ref={ref} className="relative">
			<button type="button" aria-label={t("title")} aria-expanded={open} onClick={toggle} className="relative flex">
				<MdNotifications size={24} color={unread > 0 ? "#5EA8F5" : "#B3B3B3"} />
				{unread > 0 && (
					<span className="absolute -right-6 -top-6 flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-danger px-4 text-[11px] font-semibold leading-none text-white">
						{unread > 99 ? "99+" : unread}
					</span>
				)}
			</button>
			<Dropdown open={open} className="right-0 top-full z-[60] mt-12 w-[340px] max-w-[calc(100vw-32px)]">
				<div className="overflow-hidden rounded-16 border border-[#E2F1F5] bg-white shadow-heroImage">
					<div className="flex items-center justify-between border-b border-[#EFEFEF] px-16 py-10">
						<span className="text-16 font-medium text-[#333333]">{t("title")}</span>
						{unread > 0 && <button type="button" onClick={markAll} className="text-14 text-primaryColor hover:underline">{t("markAll")}</button>}
					</div>
					<div className="max-h-[420px] overflow-y-auto">
						{items.length === 0 ? <p className="px-16 py-24 text-center text-14 text-[#999999]">{t("empty")}</p> : items.map(row)}
					</div>
				</div>
			</Dropdown>
		</div>
	);
}
