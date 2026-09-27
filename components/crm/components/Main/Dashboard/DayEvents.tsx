"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalEvent, EventDraft, useCollabStore } from "@/app/store/useCollabStore";
import EventModal from "../Collaboration/Calendar/EventModal";

interface Props {
	selected: string; // "YYYY-MM-DD" — события этого дня
}

// «Events» на дашборде: события выбранного дня рядом с задачами (время, название, цвет и место).
// Нажатие открывает то же окно события, что и в календаре.
export default function DayEvents({ selected }: Props) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const events = useCollabStore((s) => s.events);
	const eventsLoading = useCollabStore((s) => s.eventsLoading);
	const [draft, setDraft] = useState<EventDraft | null>(null);
	const [open, setOpen] = useState(false);

	const visible = useMemo(
		() =>
			events
				.filter((e) => e.date === selected)
				.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title)),
		[events, selected]
	);

	function openEvent(event: CalEvent) {
		setDraft(event);
		setOpen(true);
	}

	return (
		<section className="fs-card p-16 md:p-20">
			<div className="mb-14 flex items-center justify-between gap-12">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("eventsTitle")}</h2>
				<Link href={`/${locale}/crm/collaboration/calendar`} className="text-12 text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
					{t("openCalendar")}
				</Link>
			</div>

			{visible.length === 0 ? (
				<p className="rounded-14 border border-dashed border-[rgba(255,255,255,0.12)] p-20 text-center text-13 text-[#8c948b]">
					{eventsLoading ? "…" : t("noEvents")}
				</p>
			) : (
				<ul className="fs-scroll flex max-h-[300px] flex-col gap-8 overflow-y-auto pr-4">
					{visible.map((e) => (
						<li key={e.id}>
							<button
								type="button"
								onClick={() => openEvent(e)}
								className="flex w-full items-start gap-10 rounded-12 border border-inkLine bg-[rgba(255,255,255,0.02)] px-12 py-10 text-left transition-colors hover:border-[rgba(255,255,255,0.18)]">
								<span className="mt-3 h-10 w-10 shrink-0 rounded-50" style={{ background: e.color }} aria-hidden />
								<span className="min-w-0 flex-1">
									<span className="flex items-baseline gap-8">
										<span className="shrink-0 text-12 font-medium text-[#c6ff4d]">{e.startTime}</span>
										<span className="min-w-0 truncate text-13 text-[#f1f4ee]">{e.title}</span>
									</span>
									{e.location && <span className="mt-2 block truncate text-12 text-[#8c948b]">{e.location}</span>}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}

			<EventModal open={open} draft={draft} onClose={() => setOpen(false)} />
		</section>
	);
}
