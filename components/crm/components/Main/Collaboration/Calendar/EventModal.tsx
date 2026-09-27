"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbChevronDown, TbX } from "react-icons/tb";
import { CalendarKind, EventDraft, useCollabStore } from "@/app/store/useCollabStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import Modal from "../../shared/Modal";

export const EVENT_COLORS = ["#FFB02E", "#34A2E8", "#2DDEB6", "#F04333", "#8A8FF5", "#57CAEF"];
const REMINDERS = [5, 15, 30, 60];

// Черновик события объявлен в хранилище (с id — правка существующего, без id — новое); реэкспорт —
// чтобы у вызывающих компонентов (календарь, дашборд) остался один адрес импорта.
export type { EventDraft };

interface Props {
	open: boolean;
	draft: EventDraft | null; // с id — правка существующего события, без id — новое
	onClose: () => void;
}

// Окно «Event Name» (Figma: Calendar-Modal): название и цвет, описание, календарь, даты и время,
// участники, место и напоминание. Событие сохраняется на сервере (/api/events).
export default function EventModal({ open, draft, onClose }: Props) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const { saveEvent, deleteEvent } = useCollabStore();
	const [form, setForm] = useState<EventDraft | null>(draft);
	const [busy, setBusy] = useState(false); // запрос к серверу в пути: второе нажатие не отправляем
	const [colorsOpen, setColorsOpen] = useState(false);
	const colorRef = useRef<HTMLDivElement>(null);
	useClickOutside(colorRef, colorsOpen, () => setColorsOpen(false));

	// при каждом открытии подставляем свежий черновик; при закрытии оставляем прежний — окно плавно гаснет с теми же данными
	useEffect(() => {
		if (open && draft) setForm(draft);
		setColorsOpen(false);
	}, [open, draft]);

	// Escape при открытой палитре цвета закрывает только палитру, а не всё окно (иначе теряется набранное событие).
	// Слушатель на этапе перехвата срабатывает раньше обработчика Escape в Modal и останавливает событие.
	useEffect(() => {
		if (!colorsOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.stopPropagation();
			setColorsOpen(false);
		};
		document.addEventListener("keydown", onKey, true);
		return () => document.removeEventListener("keydown", onKey, true);
	}, [colorsOpen]);

	if (!form) return null;
	const isEdit = Boolean(form.id);
	const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form || busy) return;
		if (!form.title.trim()) return void toast.error(t("eventNameRequired"));
		if (`${form.endDate}T${form.endTime}` < `${form.date}T${form.startTime}`) return void toast.error(t("eventEndBefore"));
		setBusy(true);
		const saved = await saveEvent({ ...form, title: form.title.trim() });
		setBusy(false);
		// при ошибке окно остаётся открытым — набранное не теряется, можно повторить
		if (!saved) return void toast.error(t("error"));
		// событие сохранено, но в Google не уехало: говорим прямо, иначе его будут искать в телефоне
		if (saved.syncError) toast.error(t("eventSyncFailed", { message: saved.syncError }), { duration: 7000 });
		else toast.success(t("eventSaved"));
		onClose();
	}

	async function remove() {
		if (!form?.id || busy) return;
		setBusy(true);
		const result = await deleteEvent(form.id);
		setBusy(false);
		if (!result) return void toast.error(t("error"));
		// Событие из внешнего календаря могло остаться там (iCloud не даёт писать, Google не ответил):
		// синхронизация вернёт его, и об этом нужно сказать сразу
		if (result.syncError) toast.error(t("eventDeleteFailed", { message: result.syncError }), { duration: 7000 });
		else toast.success(t("eventDeleted"));
		onClose();
	}

	const plain =
		"cursor-pointer bg-transparent text-13 text-[#f1f4ee] outline-none transition-colors focus:text-[#c6ff4d] [&::-webkit-calendar-picker-indicator]:hidden";
	// значок календаря скрыт, как в макете (там просто «26.06.2023»); окно выбора открывается нажатием на само поле
	const openPicker = (e: React.MouseEvent<HTMLInputElement>) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
	const label = "text-12 text-[#8c948b]";

	return (
		<Modal open={open} onClose={onClose} label={t("eventName")} className="w-full max-w-[788px]" align="top" flushOnMobile>
			<form onSubmit={submit} className="fs-popover fs-scroll overflow-hidden max-md:min-h-screen max-md:rounded-[0px] max-md:border-0 md:my-[40px]">
				<div className="flex items-center gap-12 border-b border-inkLine bg-[rgba(255,255,255,0.02)] px-16 py-14 md:border-0 md:bg-transparent md:px-32 md:pt-24">
					<input
						value={form.title}
						onChange={(e) => set("title", e.target.value)}
						placeholder={t("eventName")}
						aria-label={t("eventName")}
						maxLength={100}
						className="min-w-0 flex-1 bg-transparent text-18 font-semibold text-[#f1f4ee] outline-none placeholder:text-[#8C948B]"
					/>
					<div ref={colorRef} className="relative flex shrink-0 items-center gap-10">
						<button type="button" onClick={() => setColorsOpen(!colorsOpen)} aria-label={t("eventColor")} aria-expanded={colorsOpen} className="flex items-center gap-6 text-[#8c948b]">
							<span className="h-24 w-24 rounded-4" style={{ background: form.color }} />
							<TbChevronDown size={18} className={`transition-transform duration-200 ${colorsOpen ? "rotate-180" : ""}`} />
						</button>
						<Dropdown open={colorsOpen} className="right-0 top-full mt-8">
							<div className="fs-popover flex gap-10 p-12">
								{EVENT_COLORS.map((c) => (
									<button
										key={c}
										type="button"
										aria-label={c}
										onClick={() => { set("color", c); setColorsOpen(false); }}
										style={{ background: c }}
										className={`h-26 w-26 rounded-4 transition-transform hover:scale-110 ${form.color === c ? "ring-2 ring-[#c6ff4d] ring-offset-2 ring-offset-[#141716]" : ""}`}
									/>
								))}
							</div>
						</Dropdown>
						<button type="button" onClick={onClose} aria-label={t("close")} className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
							<TbX size={20} />
						</button>
					</div>
				</div>

				<div className="px-16 md:px-32">
					{/* Подробное описание события: под названием, как «Description» у задачи */}
					<label htmlFor="event-description" className={`mt-16 block md:mt-20 ${label}`}>{t("eventDescription")}</label>
					<textarea
						id="event-description"
						value={form.description}
						onChange={(e) => set("description", e.target.value)}
						placeholder={t("eventDescriptionPlaceholder")}
						maxLength={2000}
						rows={3}
						className="fs-field fs-scroll mt-8 w-full resize-y px-12 py-8 text-13 outline-none"
					/>

					<label className="relative mt-16 flex items-center gap-8 text-13 text-[#8c948b] md:mt-20">
						{t("calendarLabel")}:
						<select
							value={form.calendar}
							onChange={(e) => set("calendar", e.target.value as CalendarKind)}
							className="cursor-pointer appearance-none bg-transparent pr-24 text-[#f1f4ee] outline-none focus:text-[#c6ff4d]">
							<option value="my">{t("myCalendar")}</option>
							<option value="company">{t("companyCalendar")}</option>
						</select>
						<TbChevronDown size={18} className="pointer-events-none -ml-24" />
					</label>

					<div className="mt-20 flex flex-wrap items-center gap-x-8 gap-y-8 md:gap-x-12 md:pl-20">
						<input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} aria-label={t("startDate")} onClick={openPicker} className={`${plain} w-[88px] md:w-auto`} />
						<input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} aria-label={t("startTime")} onClick={openPicker} className={`${plain} w-[46px] md:w-auto`} />
						<span className="text-[#8C948B]">-</span>
						<input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} aria-label={t("endTime")} onClick={openPicker} className={`${plain} w-[46px] md:w-auto`} />
						<input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} aria-label={t("endDate")} onClick={openPicker} className={`${plain} w-[88px] md:w-auto`} />
					</div>

					<p className={`mt-20 ${label}`}>{t("attendees")}</p>
					<div className="mt-8 flex items-center justify-between gap-16 text-13">
						<input
							value={form.attendees}
							onChange={(e) => set("attendees", e.target.value)}
							placeholder={t("change")}
							aria-label={t("attendees")}
							maxLength={200}
							className="min-w-0 flex-1 bg-transparent text-[#f1f4ee] outline-none placeholder:text-[#8C948B] focus:text-[#c6ff4d]"
						/>
						<Link href={`/${locale}/crm/collaboration/chat-and-calls`} className="flex shrink-0 items-center gap-8 text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
							{t("openChat")}
							<TbChevronDown size={18} />
						</Link>
					</div>
				</div>

				<div className="mt-20 grid grid-cols-[auto_1fr] items-center gap-x-24 gap-y-16 border-y border-inkLine bg-[rgba(255,255,255,0.02)] px-16 py-14 text-13 md:px-[60px] md:py-16">
					<label htmlFor="event-location" className="text-[#8c948b]">{t("location")}:</label>
					<input
						id="event-location"
						value={form.location}
						onChange={(e) => set("location", e.target.value)}
						placeholder={t("add")}
						maxLength={200}
						className="min-w-0 bg-transparent text-[#f1f4ee] outline-none placeholder:text-[#8C948B] focus:text-[#c6ff4d]"
					/>
					<span className="text-[#8c948b]">{t("reminder")}:</span>
					<div className="flex flex-wrap items-center gap-x-24 gap-y-8">
						{form.reminder > 0 && (
							<span className="flex items-center gap-6 text-[#c6ff4d]">
								{t("minutesBefore", { count: form.reminder })}
								<button type="button" onClick={() => set("reminder", 0)} aria-label={t("removeReminder")} className="text-[#8c948b] transition-colors hover:text-danger">
									<TbX size={16} />
								</button>
							</span>
						)}
						<label className="relative cursor-pointer text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
							{t("add")}
							<select
								value=""
								onChange={(e) => e.target.value && set("reminder", Number(e.target.value))}
								aria-label={t("reminder")}
								className="absolute inset-0 cursor-pointer opacity-0">
								<option value="" />
								{REMINDERS.map((m) => (
									<option key={m} value={m}>{t("minutesBefore", { count: m })}</option>
								))}
							</select>
						</label>
					</div>
				</div>

				<div className="flex flex-col items-stretch gap-12 px-16 py-20 md:flex-row md:items-center md:justify-end md:gap-12 md:px-32 md:py-24">
					{isEdit && (
						<button
							type="button"
							onClick={remove}
							disabled={busy}
							className="text-13 font-medium text-danger transition-opacity hover:opacity-80 disabled:opacity-60 max-md:order-last md:mr-auto">
							{t("deleteEvent")}
						</button>
					)}
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">
						{t("cancel")}
					</button>
					<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60 md:min-w-[133px]">
						{isEdit ? t("save") : t("create")}
					</button>
				</div>
			</form>
		</Modal>
	);
}
