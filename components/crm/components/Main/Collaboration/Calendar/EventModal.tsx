"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose, MdKeyboardArrowDown } from "react-icons/md";
import { CalEvent, CalendarKind, useCollabStore } from "@/app/store/useCollabStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import Modal from "../../shared/Modal";

export const EVENT_COLORS = ["#FFB02E", "#34A2E8", "#2DDEB6", "#F04333", "#8A8FF5", "#57CAEF"];
const REMINDERS = ["5", "15", "30", "60"];

export type EventDraft = Omit<CalEvent, "id"> & { id?: string };

interface Props {
	open: boolean;
	draft: EventDraft | null; // с id — правка существующего события, без id — новое
	onClose: () => void;
}

// Окно «Event Name» (Figma: Calendar-Modal): название и цвет, календарь, даты и время, участники, место и напоминание.
export default function EventModal({ open, draft, onClose }: Props) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const { saveEvent, deleteEvent } = useCollabStore();
	const [form, setForm] = useState<EventDraft | null>(draft);
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

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form) return;
		if (!form.title.trim()) return void toast.error(t("eventNameRequired"));
		if (`${form.endDate}T${form.endTime}` < `${form.date}T${form.startTime}`) return void toast.error(t("eventEndBefore"));
		saveEvent({ ...form, title: form.title.trim() });
		toast.success(t("eventSaved"));
		onClose();
	}

	const plain =
		"cursor-pointer bg-transparent text-15 text-[#666666] outline-none transition-colors focus:text-primaryColor md:text-18 [&::-webkit-calendar-picker-indicator]:hidden";
	// значок календаря скрыт, как в макете (там просто «26.06.2023»); окно выбора открывается нажатием на само поле
	const openPicker = (e: React.MouseEvent<HTMLInputElement>) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
	const label = "text-14 text-[#B3B3B3]";

	return (
		<Modal open={open} onClose={onClose} label={t("eventName")} className="w-full max-w-[788px]" align="top" flushOnMobile>
			<form onSubmit={submit} className="overflow-hidden bg-white shadow-heroImage max-md:min-h-screen md:my-[40px] md:rounded-24">
				<div className="flex items-center gap-12 bg-[#F5F7FC] px-16 py-16 md:bg-white md:px-40 md:pt-30">
					<input
						value={form.title}
						onChange={(e) => set("title", e.target.value)}
						placeholder={t("eventName")}
						aria-label={t("eventName")}
						maxLength={100}
						className="min-w-0 flex-1 bg-transparent text-24 font-medium text-[#666666] outline-none placeholder:text-[#B3B3B3]"
					/>
					<div ref={colorRef} className="relative flex shrink-0 items-center gap-10">
						<button type="button" onClick={() => setColorsOpen(!colorsOpen)} aria-label={t("eventColor")} aria-expanded={colorsOpen} className="flex items-center gap-6 text-[#666666]">
							<span className="h-30 w-30 rounded-4" style={{ background: form.color }} />
							<MdKeyboardArrowDown size={24} className={`transition-transform duration-200 ${colorsOpen ? "rotate-180" : ""}`} />
						</button>
						<Dropdown open={colorsOpen} className="right-0 top-full mt-8">
							<div className="flex gap-10 rounded-8 border border-[#E2F1F5] bg-white p-12 shadow-custom">
								{EVENT_COLORS.map((c) => (
									<button
										key={c}
										type="button"
										aria-label={c}
										onClick={() => { set("color", c); setColorsOpen(false); }}
										style={{ background: c }}
										className={`h-30 w-30 rounded-4 transition-transform hover:scale-110 ${form.color === c ? "ring-2 ring-[#666666] ring-offset-2" : ""}`}
									/>
								))}
							</div>
						</Dropdown>
						<button type="button" onClick={onClose} aria-label={t("close")} className="text-[#4D4D4D] transition-opacity hover:opacity-70">
							<MdClose size={28} />
						</button>
					</div>
				</div>

				<div className="px-16 md:px-40">
					<label className="relative mt-16 flex items-center gap-8 text-16 text-[#B3B3B3] md:mt-30 md:text-20">
						{t("calendarLabel")}:
						<select
							value={form.calendar}
							onChange={(e) => set("calendar", e.target.value as CalendarKind)}
							className="cursor-pointer appearance-none bg-transparent pr-24 outline-none focus:text-primaryColor">
							<option value="my">{t("myCalendar")}</option>
							<option value="company">{t("companyCalendar")}</option>
						</select>
						<MdKeyboardArrowDown size={22} className="pointer-events-none -ml-24" />
					</label>

					<div className="mt-24 flex flex-wrap items-center gap-x-8 gap-y-8 md:mt-30 md:gap-x-12 md:pl-20">
						<input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} aria-label={t("startDate")} onClick={openPicker} className={`${plain} w-[88px] md:w-auto`} />
						<input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} aria-label={t("startTime")} onClick={openPicker} className={`${plain} w-[46px] md:w-auto`} />
						<span className="text-[#4D4D4D]">-</span>
						<input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} aria-label={t("endTime")} onClick={openPicker} className={`${plain} w-[46px] md:w-auto`} />
						<input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} aria-label={t("endDate")} onClick={openPicker} className={`${plain} w-[88px] md:w-auto`} />
					</div>

					<p className={`mt-24 ${label}`}>{t("attendees")}</p>
					<div className="mt-8 flex items-center justify-between gap-16 text-16 text-[#666666] md:text-18">
						<input
							value={form.attendees}
							onChange={(e) => set("attendees", e.target.value)}
							placeholder={t("change")}
							aria-label={t("attendees")}
							maxLength={200}
							className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#666666] focus:text-primaryColor"
						/>
						<Link href={`/${locale}/crm/collaboration/chat-and-calls`} className="flex shrink-0 items-center gap-8 transition-colors hover:text-primaryColor">
							{t("openChat")}
							<MdKeyboardArrowDown size={22} />
						</Link>
					</div>
				</div>

				<div className="mt-24 grid grid-cols-[auto_1fr] items-center gap-x-24 gap-y-16 bg-[#F5F7FC] px-16 py-16 text-16 md:px-[80px] md:py-20 md:text-18">
					<label htmlFor="event-location" className="text-[#B3B3B3]">{t("location")}:</label>
					<input
						id="event-location"
						value={form.location}
						onChange={(e) => set("location", e.target.value)}
						placeholder={t("add")}
						maxLength={200}
						className="min-w-0 bg-transparent text-[#666666] outline-none placeholder:text-[#666666] focus:text-primaryColor"
					/>
					<span className="text-[#B3B3B3]">{t("reminder")}:</span>
					<div className="flex flex-wrap items-center gap-x-24 gap-y-8">
						{form.reminder && (
							<span className="flex items-center gap-6 text-primaryColor">
								{t("minutesBefore", { count: Number(form.reminder) })}
								<button type="button" onClick={() => set("reminder", "")} aria-label={t("removeReminder")} className="text-[#B3B3B3] transition-colors hover:text-danger">
									<MdClose size={16} />
								</button>
							</span>
						)}
						<label className="relative cursor-pointer text-[#666666] transition-colors hover:text-primaryColor">
							{t("add")}
							<select
								value=""
								onChange={(e) => e.target.value && set("reminder", e.target.value)}
								aria-label={t("reminder")}
								className="absolute inset-0 cursor-pointer opacity-0">
								<option value="" />
								{REMINDERS.map((m) => (
									<option key={m} value={m}>{t("minutesBefore", { count: Number(m) })}</option>
								))}
							</select>
						</label>
					</div>
				</div>

				<div className="flex flex-col items-stretch gap-12 px-16 py-24 md:flex-row md:items-center md:justify-end md:gap-20 md:px-40 md:py-30">
					{isEdit && (
						<button
							type="button"
							onClick={() => { deleteEvent(form.id as string); toast.success(t("eventDeleted")); onClose(); }}
							className="px-16 py-10 text-16 font-medium text-danger transition-opacity hover:opacity-80 max-md:order-last md:mr-auto">
							{t("deleteEvent")}
						</button>
					)}
					<button type="button" onClick={onClose} className="px-16 py-10 text-16 font-medium text-[#B3B3B3] transition-colors hover:text-black">
						{t("cancel")}
					</button>
					<button type="submit" className="h-[50px] rounded-4 bg-primaryColor px-30 text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 md:min-w-[133px]">
						{isEdit ? t("save") : t("create")}
					</button>
				</div>
			</form>
		</Modal>
	);
}
