"use client";
import React, { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MdAccessAlarm, MdAutoMode, MdCallMissed, MdChat, MdMail, MdPersonAdd } from "react-icons/md";
import { TbBell } from "react-icons/tb";
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
// align="up": в мобильном меню колокольчик стоит низко на длинной прокручиваемой панели — список открывается вверх от него,
// а не вниз за пределы экрана.
export default function Notification({ align = "down" }: { align?: "down" | "up" } = {}) {
	const t = useTranslations("notif");
	const locale = useLocale();
	const { items, unread, markRead, markAll } = useNotificationStore();
	// Панель — своя у каждого колокольчика (шапка и мобильное меню рендерят его одновременно): общий флаг
	// в сторе открывал обе, и «клик снаружи» от одной закрывал ту, в которой как раз нажимали кнопку —
	// из-за этого «прочитать все» не срабатывало. См. CurrentUser.tsx.
	const [open, setOpen] = useState(false);
	const close = useCallback(() => setOpen(false), []);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, close);

	// Если сервер отметку не подтвердил, стор возвращает состояние к настоящему — говорим об этом, а не молчим
	const onMarkAll = async () => {
		if (!(await markAll())) toast.error(t("markFailed"));
	};

	const row = (n: Notif) => {
		const Icon = ICON[n.type] ?? TbBell;
		const body = (
			<>
				<Icon size={18} className={`mt-2 shrink-0 ${n.type === "deadline" ? "text-[#F4A100]" : "text-[#c6ff4d]"}`} />
				<span className="min-w-0 flex-1">
					<span className={`block text-13 ${n.read ? "text-[#8c948b]" : "font-medium text-[#f1f4ee]"}`}>{notifText(t, n)}</span>
					<span className="block text-11 text-[#9AA396]">{ago(n.at)}</span>
				</span>
				{!n.read && <span className="mt-6 h-6 w-6 shrink-0 rounded-50 bg-[#c6ff4d]" aria-hidden />}
			</>
		);
		const cls = "fs-popover-row flex w-full items-start gap-10 px-14 py-10 text-left transition-colors";
		return n.link ? (
			<Link key={n.id} href={`/${locale}${n.link}`} onClick={() => { markRead([n.id]); close(); }} className={cls}>{body}</Link>
		) : (
			<button key={n.id} type="button" onClick={() => markRead([n.id])} className={cls}>{body}</button>
		);
	};

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-label={t("title")}
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="relative flex h-34 w-34 items-center justify-center rounded-9 transition-colors hover:bg-[rgba(255,255,255,0.06)]">
				<TbBell size={19} className={unread > 0 ? "text-[#c6ff4d]" : "text-[#8c948b]"} />
				{unread > 0 && (
					<span className="absolute -right-3 -top-3 flex h-16 min-w-16 items-center justify-center rounded-50 bg-[#c6ff4d] px-4 text-10 font-bold leading-none text-[#0a0c0b]">
						{unread > 99 ? "99+" : unread}
					</span>
				)}
			</button>
			<Dropdown
				open={open}
				className={`right-0 z-[60] w-340 max-w-[calc(100vw-32px)] ${align === "up" ? "bottom-full mb-12 origin-bottom" : "top-full mt-12"}`}>
				<div className="fs-popover overflow-hidden">
					<div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] px-14 py-10">
						<span className="text-14 font-semibold text-[#f1f4ee]">{t("title")}</span>
						{unread > 0 && <button type="button" onClick={onMarkAll} className="text-12 text-[#c6ff4d] hover:underline">{t("markAll")}</button>}
					</div>
					{/* никогда не просит больше половины высоты экрана — на невысоких телефонах список остаётся виден целиком со своим скроллом */}
					<div className="fs-scroll max-h-[420px] overflow-y-auto [max-height:min(420px,55vh)]">
						{items.length === 0 ? <p className="px-14 py-24 text-center text-13 text-[#8c948b]">{t("empty")}</p> : items.map(row)}
					</div>
				</div>
			</Dropdown>
		</div>
	);
}
