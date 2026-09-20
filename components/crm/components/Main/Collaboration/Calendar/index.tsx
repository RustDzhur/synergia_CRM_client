"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdChevronLeft, MdChevronRight, MdKeyboardArrowDown } from "react-icons/md";
import { CalEvent, CalendarKind, useCollabHydration, useCollabStore } from "@/app/store/useCollabStore";
import { Task, useTaskStore } from "@/app/store/useTaskStore";
import { addDays, dayKey, localeTag } from "@/app/utils/dateHelpers";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import { TAB_BAR } from "../../shared/tabBar";
import SearchBox from "../../shared/SearchBox";
import EventModal, { EVENT_COLORS, EventDraft } from "./EventModal";
import TaskPreviewModal from "./TaskPreviewModal";

type View = "month" | "week";
const TASK_COLOR = "#34A2E8";
const DONE_COLOR = "#B3B3B3"; // выполненная задача: серая и зачёркнутая
const MAX_PILLS = 3;

// Неделя календаря начинается с понедельника (Mon ... Sun), в отличие от ленты на дашборде
const mondayOf = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

interface Pill { id: string; title: string; color: string; done?: boolean; event?: CalEvent; task?: Task }

// Calendar (/crm/collaboration/calendar): месяц и неделя, «My / Company Calendar», события с цветом и напоминанием.
// Задачи с дедлайном из раздела Tasks показываются тут же (синие) и открываются в окне задачи.
export default function Calendar() {
	const t = useTranslations("collab");
	const locale = useLocale();
	const tag = localeTag(locale);
	useCollabHydration();
	const events = useCollabStore((s) => s.events);
	const { tasks, fetchTasks } = useTaskStore();

	const [cursor, setCursor] = useState(() => new Date());
	const [view, setView] = useState<View>("month");
	const [tab, setTab] = useState<CalendarKind>("my");
	const [query, setQuery] = useState("");
	const [viewOpen, setViewOpen] = useState(false);
	const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date())); // на телефоне
	const [draft, setDraft] = useState<EventDraft | null>(null);
	const [eventOpen, setEventOpen] = useState(false);
	const [taskId, setTaskId] = useState<string | null>(null);
	const viewRef = useRef<HTMLDivElement>(null);
	useClickOutside(viewRef, viewOpen, () => setViewOpen(false));

	useEffect(() => { fetchTasks(); }, [fetchTasks]);

	const todayKey = dayKey(new Date());
	const q = query.trim().toLowerCase();

	// Дни сетки: месяц — полные недели, охватывающие месяц; неделя — семь дней вокруг курсора.
	const days = useMemo(() => {
		if (view === "week") {
			const start = mondayOf(cursor);
			return Array.from({ length: 7 }, (_, i) => addDays(start, i));
		}
		const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
		const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
		const start = mondayOf(first);
		const weeks = Math.ceil(((first.getDay() + 6) % 7 + last.getDate()) / 7);
		return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
	}, [cursor, view]);

	// события по дням: свои события выбранной вкладки + задачи с дедлайном (только на «My Calendar»)
	const pillsByDay = useMemo(() => {
		const map = new Map<string, Pill[]>();
		const push = (key: string, pill: Pill) => map.set(key, [...(map.get(key) ?? []), pill]);
		for (const e of events) {
			if (e.calendar !== tab || (q && !e.title.toLowerCase().includes(q))) continue;
			push(e.date, { id: e.id, title: `${e.startTime} ${e.title}`, color: e.color, event: e });
		}
		if (tab === "my") {
			tasks.forEach((task) => {
				if (!task.deadline || (q && !task.title.toLowerCase().includes(q))) return;
				push(task.deadline.slice(0, 10), { id: task._id, title: `${task.deadline.slice(11, 16)} ${task.title}`, color: task.completed ? DONE_COLOR : TASK_COLOR, done: task.completed, task });
			});
		}
		map.forEach((list) => list.sort((a, b) => a.title.localeCompare(b.title)));
		return map;
	}, [events, tasks, tab, q]);

	const title = cursor.toLocaleDateString(tag, { month: "long", day: "2-digit", year: "numeric" });
	const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 2 + i).toLocaleDateString(tag, { weekday: "short" }));

	function shift(dir: -1 | 1) {
		setCursor((c) => (view === "week" ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));
	}
	function goToday() {
		const now = new Date();
		setCursor(now);
		setSelectedDay(dayKey(now));
	}

	function openCreate(key: string) {
		setDraft({
			title: "", color: EVENT_COLORS[0], calendar: tab, date: key, startTime: "09:00", endDate: key, endTime: "10:00",
			attendees: "", location: "", reminder: "",
		});
		setEventOpen(true);
	}
	function openPill(pill: Pill) {
		if (pill.event) { setDraft(pill.event); setEventOpen(true); }
		else if (pill.task) setTaskId(pill.task._id);
	}
	function onDay(key: string) {
		// на телефоне нажатие выбирает день (события ниже сетки), с планшета — сразу открывает форму нового события
		if (window.matchMedia("(max-width: 767px)").matches) setSelectedDay(key);
		else openCreate(key);
	}

	const selectedPills = pillsByDay.get(selectedDay) ?? [];
	const control = "text-16 text-[#B3B3B3] transition-colors hover:text-primaryColor";

	return (
		<div className="p-16 pt-0 md:p-30">
			<div className="mb-20 flex flex-col gap-16 md:mb-30 md:flex-row md:items-center md:justify-between">
				<div className={TAB_BAR}>
					{(["my", "company"] as const).map((key) => (
						<button
							key={key}
							type="button"
							onClick={() => setTab(key)}
							className={`rounded-4 px-16 py-10 text-16 font-medium tracking-[0.32px] transition-colors duration-200 ${tab === key ? "bg-primaryColor text-white" : "text-[#CCCCCC] hover:text-[#999999]"}`}>
							{key === "my" ? t("myCalendar") : t("companyCalendar")}
						</button>
					))}
				</div>
				<SearchBox value={query} onChange={setQuery} placeholder={t("searchCalendar")} withFilter className="w-full md:w-[250px] lg:w-[350px]" />
			</div>

			<div className="md:rounded-24 md:bg-white md:p-20 md:shadow-heroImage">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between md:pb-16">
					<h2 className="hidden text-24 font-semibold text-[#666666] md:block">{title}</h2>
					<div className="flex flex-col md:flex-row md:items-center md:gap-30">
						<div ref={viewRef} className="relative -mx-16 border-y border-[#E6E6E6] px-16 md:mx-0 md:border-0 md:px-0">
							<button
								type="button"
								onClick={() => setViewOpen(!viewOpen)}
								aria-expanded={viewOpen}
								className={`flex w-full items-center justify-between gap-8 py-12 md:w-auto md:py-0 ${control} text-18 md:text-16`}>
								{view === "month" ? t("month") : t("week")}
								<MdKeyboardArrowDown size={22} className={`transition-transform duration-200 ${viewOpen ? "rotate-180" : ""}`} />
							</button>
							<Dropdown open={viewOpen} className="left-16 top-full mt-2 min-w-[150px] md:left-auto md:right-0">
								<div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white shadow-custom">
									{(["month", "week"] as const).map((v) => (
										<button
											key={v}
											type="button"
											onClick={() => { setView(v); setViewOpen(false); }}
											className={`block w-full px-16 py-10 text-left text-16 transition-colors hover:bg-gray ${view === v ? "text-primaryColor" : "text-[#666666]"}`}>
											{v === "month" ? t("month") : t("week")}
										</button>
									))}
								</div>
							</Dropdown>
						</div>
						<div className="flex items-center justify-between py-16 md:justify-start md:gap-16 md:py-0">
							<button type="button" onClick={() => shift(-1)} aria-label={t("previous")} className={control}><MdChevronLeft size={24} /></button>
							<button type="button" onClick={goToday} className={`${control} text-18 md:text-16`}>{t("today")}</button>
							<button type="button" onClick={() => shift(1)} aria-label={t("next")} className={control}><MdChevronRight size={24} /></button>
						</div>
					</div>
				</div>

				<div className="-mx-16 md:mx-0">
					<div className="grid grid-cols-7 pb-8 text-center text-14 text-[#666666] md:text-right md:text-18 md:[&>span]:pr-16">
						{weekdays.map((w) => <span key={w}>{w}</span>)}
					</div>
					<div className="grid grid-cols-7 border-l border-t border-[#D9D9D9] md:border-[#E0E0E0]">
						{days.map((d) => {
							const key = dayKey(d);
							const inMonth = view === "week" || d.getMonth() === cursor.getMonth();
							const pills = pillsByDay.get(key) ?? [];
							const isToday = key === todayKey;
							return (
								<div
									key={key}
									role="button"
									tabIndex={0}
									aria-label={d.toLocaleDateString(tag, { dateStyle: "full" })}
									onClick={() => onDay(key)}
									onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onDay(key))}
									className={`group relative cursor-pointer border-b border-r border-[#D9D9D9] transition-colors duration-150 hover:bg-[#F0F6FF] md:border-[#E0E0E0] ${
										isWeekend(d) ? "bg-[#F5F7FC]" : "bg-white"
									} ${view === "week" ? "min-h-[300px]" : "min-h-[52px] md:min-h-[90px] lg:min-h-[150px]"}`}>
									<div className="flex justify-center py-6 md:justify-end md:px-10 md:py-8">
										<span
											className={`flex h-[36px] min-w-[54px] items-center justify-center text-16 max-md:rounded-50 md:h-auto md:min-w-0 md:text-18 md:rounded-4 md:px-6 ${
												isToday
													? "font-semibold text-primaryColor md:bg-primaryColor md:text-white"
													: inMonth ? "text-[#999999]" : "text-[#CCCCCC]"
											} ${selectedDay === key ? "max-md:bg-[#CCCCCC] max-md:text-white" : ""}`}>
											{d.getDate()}
										</span>
									</div>
									{/* телефон: точки цветом события; с планшета — подписи */}
									<div className="flex justify-center gap-2 md:hidden">
										{pills.slice(0, 3).map((p) => <span key={p.id} className="h-6 w-6 rounded-50" style={{ background: p.color }} />)}
									</div>
									<ul className="hidden flex-col gap-2 px-6 pb-6 md:flex">
										{pills.slice(0, view === "week" ? 20 : MAX_PILLS).map((p) => (
											<li key={p.id}>
												<button
													type="button"
													onClick={(e) => { e.stopPropagation(); openPill(p); }}
													style={{ background: p.color }}
													className={`block w-full truncate rounded-4 px-6 py-2 text-left text-12 text-white transition-opacity hover:opacity-80 ${p.done ? "line-through" : ""}`}>
													{p.title}
												</button>
											</li>
										))}
										{view === "month" && pills.length > MAX_PILLS && (
											<li className="px-6 text-12 text-[#999999]">+{pills.length - MAX_PILLS}</li>
										)}
									</ul>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* телефон: события выбранного дня и кнопка добавления */}
			<div className="mt-20 md:hidden">
				<div className="mb-10 flex items-center justify-between">
					<p className="text-16 font-medium text-[#666666]">{new Date(`${selectedDay}T00:00`).toLocaleDateString(tag, { day: "numeric", month: "long" })}</p>
					<button type="button" onClick={() => openCreate(selectedDay)} className="rounded-4 bg-primaryColor px-16 py-8 text-14 font-semibold text-white shadow-custom">
						{t("addEvent")}
					</button>
				</div>
				{selectedPills.length === 0 ? (
					<p className="text-14 text-[#B3B3B3]">{t("noEvents")}</p>
				) : (
					<ul className="flex flex-col gap-8">
						{selectedPills.map((p) => (
							<li key={p.id}>
								<button type="button" onClick={() => openPill(p)} style={{ background: p.color }} className={`block w-full truncate rounded-8 px-12 py-10 text-left text-16 text-white ${p.done ? "line-through" : ""}`}>
									{p.title}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>

			<EventModal open={eventOpen} draft={draft} onClose={() => setEventOpen(false)} />
			<TaskPreviewModal taskId={taskId} onClose={() => setTaskId(null)} />
		</div>
	);
}
