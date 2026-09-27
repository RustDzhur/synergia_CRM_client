"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAccessAlarm, MdClose } from "react-icons/md";
import { TbCalendarEvent } from "react-icons/tb";
import { apiCall } from "@/app/store/crmApi";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import { useNotificationStore, type Notif } from "@/app/store/useNotificationStore";
import { beep, chime } from "@/app/utils/beep";
import { deadlineStage } from "@/app/utils/deadline";
import { notifText } from "@/app/utils/notifText";
import { usePolling } from "@/app/utils/usePolling";

interface Item { _id: string; title?: string; clientName?: string; deadline?: string; endDate?: string; completed?: boolean; muted?: boolean }

const SENT_KEY = "crm.deadlines.sent";
const readSent = (): string[] => { try { return JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]"); } catch { return []; } };

// Невидимый «диспетчер» уведомлений (один на CRM): опрашивает сервер (этот же опрос запускает напоминания
// календаря — lib/calendar/reminders.ts), следит за сроками задач и сделок в браузере (срок хранится как местное
// время без часового пояса), показывает тосты, системные уведомления браузера и верхнюю полосу с сигналом,
// когда подходит или прошёл дедлайн, а также когда наступает напоминание о событии календаря.
export default function NotificationCenter() {
	const t = useTranslations("notif");
	const locale = useLocale();
	const { load, takeFresh, fresh, markRead } = useNotificationStore();
	const browserOn = useCurrentUserStore((s) => s.user?.notifications?.browser);
	const [banner, setBanner] = useState<Notif | null>(null);

	usePolling(load, 30_000);

	// сроки: раз в минуту берём задачи и сделки и просим сервер создать уведомление на наступивший этап (по одному на этап)
	usePolling(async () => {
		const [tasks, deals] = await Promise.all([apiCall<Item[]>("/api/tasks"), apiCall<Item[]>("/api/deals")]);
		const sent = new Set(readSent());
		let created = false;
		const check = async (kind: "task" | "deal", it: Item, dateText?: string) => {
			if (!dateText || it.completed || it.muted) return;
			const at = new Date(kind === "deal" && dateText.length <= 10 ? `${dateText}T23:59` : dateText).getTime();
			if (Number.isNaN(at)) return;
			const stage = deadlineStage(at);
			if (!stage) return;
			const key = `${kind}:${it._id}:${stage}:${dateText}`;
			if (sent.has(key)) return;
			sent.add(key);
			const res = await apiCall<{ created: boolean }>("/api/notifications", "POST", { kind, id: it._id, stage });
			created = created || !!res.data?.created;
		};
		for (const task of tasks.data ?? []) await check("task", task, task.deadline);
		for (const deal of deals.data ?? []) await check("deal", deal, deal.endDate);
		try { localStorage.setItem(SENT_KEY, JSON.stringify(Array.from(sent).slice(-300))); } catch { /* приватный режим */ }
		if (created) load();
	}, 60_000);

	// новые уведомления: тост (или верхняя полоса для дедлайнов и напоминаний календаря), сигнал и системное уведомление браузера, если включено в Settings
	useEffect(() => {
		if (!fresh.length) return;
		for (const n of takeFresh()) {
			const text = notifText(t, n);
			if (n.type === "deadline" || n.type === "event") {
				setBanner(n);
				// у события календаря свой перезвон: напоминание о встрече отличается от гудка дедлайна
				if (n.type === "event") chime();
				else beep();
			} else toast(text, { icon: "🔔", duration: 6000 });
			if (browserOn && typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
				try { new Notification("Firmspace CRM", { body: text }); } catch { /* не поддерживается */ }
			}
		}
	}, [fresh, takeFresh, t, browserOn]);

	if (!banner) return null;
	// дедлайн — оранжевая полоса с гудком, напоминание о событии — салатовая с перезвоном (звук — в effect выше)
	const isEvent = banner.type === "event";
	return (
		<div role="alert" className={`fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-12 border-b px-16 py-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${
			isEvent ? "border-[rgba(198,255,77,0.35)] bg-[#101A0B]" : "border-[rgba(244,161,0,0.3)] bg-[#1A1509]"
		}`}>
			{isEvent
				? <TbCalendarEvent size={24} className="shrink-0 animate-bounce text-[#c6ff4d]" aria-hidden />
				: <MdAccessAlarm size={26} className="shrink-0 animate-bounce text-[#F4A100]" aria-hidden />}
			<p className={`min-w-0 text-16 font-medium ${isEvent ? "text-[#f1f4ee]" : "text-[#6B4E00]"}`}>{notifText(t, banner)}</p>
			<Link href={`/${locale}${banner.link}`} onClick={() => { markRead([banner.id]); setBanner(null); }} className={`shrink-0 rounded-8 px-16 py-6 text-14 font-medium transition-opacity hover:opacity-80 ${isEvent ? "bg-[#c6ff4d] text-[#0a0c0b]" : "bg-[#F4A100] text-white"}`}>{t("open")}</Link>
			<button type="button" aria-label={t("dismiss")} onClick={() => { markRead([banner.id]); setBanner(null); }} className={`shrink-0 transition-opacity hover:opacity-70 ${isEvent ? "text-[#c6ff4d]" : "text-[#6B4E00]"}`}><MdClose size={22} /></button>
		</div>
	);
}
