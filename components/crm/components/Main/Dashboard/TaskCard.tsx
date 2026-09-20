"use client";
import React, { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdAssignmentTurnedIn, MdClose, MdMoreHoriz, MdPushPin } from "react-icons/md";
import { Task, useTaskStore } from "@/app/store/useTaskStore";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import { localeTag } from "@/app/utils/dateHelpers";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";

const initials = (name: string) =>
	name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Avatar({ name, src, size }: { name: string; src?: string; size: number }) {
	return (
		<span
			style={{ width: size, height: size }}
			className="flex shrink-0 items-center justify-center overflow-hidden rounded-50 bg-[#D9D9D9] text-16 font-medium text-white">
			{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
		</span>
	);
}

// Карточка задачи в ленте: автор, срок, отметка «закреплено», меню и ветка комментариев.
export default function TaskCard({ task }: { task: Task }) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const tag = localeTag(locale);
	const { updateTask, deleteTasks, addComment, removeComment } = useTaskStore();
	const user = useCurrentUserStore((s) => s.user);
	const [menuOpen, setMenuOpen] = useState(false);
	const [text, setText] = useState("");
	const menuRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

	const authorName = user ? `${user.firstname} ${user.lastname}`.trim() : "";
	const comments = (task.activities ?? []).filter((a) => a.type === "comment");
	const when = (iso: string) =>
		new Date(iso).toLocaleString(tag, { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

	async function submit() {
		const value = text.trim();
		if (!value) return;
		setText("");
		await addComment(task._id, value, authorName);
	}

	const menuItem = "block w-full px-16 py-10 text-left text-16 text-[#666666] transition-colors duration-150 hover:bg-gray";

	return (
		<article className="rounded-16 border border-[#E6E6E6] bg-white p-16 shadow-[0_2px_8px_rgba(0,0,0,0.16)] md:p-25">
			<header className="flex items-start justify-between gap-12">
				<div className="flex min-w-0 items-center gap-12">
					<Avatar name={task.createdBy ?? ""} src={user && task.createdBy === authorName ? user.avatarUrl : undefined} size={60} />
					<div className="min-w-0">
						<p className="truncate text-18 font-medium text-[#334A74]">{task.createdBy}</p>
						<p className="text-14 text-[#666666]">{task.createdAt ? when(task.createdAt) : ""}</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-12 text-[#999999]">
					<div ref={menuRef} className="relative">
						<button type="button" aria-label={t("options")} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="transition-colors hover:text-black">
							<MdMoreHoriz size={24} />
						</button>
						<Dropdown open={menuOpen} className="right-0 top-full mt-8 min-w-[200px]">
							<div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white shadow-custom">
								<button type="button" className={menuItem} onClick={() => { setMenuOpen(false); updateTask(task._id, { completed: !task.completed }); }}>
									{task.completed ? t("markActive") : t("markDone")}
								</button>
								<div className="border-t border-[#E2F1F5]" />
								<button type="button" className={`${menuItem} !text-danger`} onClick={() => { setMenuOpen(false); deleteTasks([task._id]); }}>
									{t("delete")}
								</button>
							</div>
						</Dropdown>
					</div>
					<button
						type="button"
						aria-label={task.pinned ? t("unpin") : t("pin")}
						aria-pressed={task.pinned}
						onClick={() => updateTask(task._id, { pinned: !task.pinned })}
						className={`transition-colors ${task.pinned ? "text-primaryColor" : "hover:text-black"}`}>
						<MdPushPin size={22} />
					</button>
				</div>
			</header>

			<div className="mt-12 flex flex-wrap items-center gap-16">
				<span className="flex items-center gap-8 rounded-4 bg-[#E7EDF3] px-12 py-8 text-14 text-[#666666]">
					<MdAssignmentTurnedIn size={18} />
					{t("task")}
				</span>
				<div className="min-w-0">
					<p className={`text-16 text-[#4D4D4D] md:text-18 ${task.completed ? "line-through opacity-60" : ""}`}>
						{t("task")}: <span className="font-bold text-[#2B3856]">{task.title}</span>
					</p>
					<p className="text-14 text-[#4D4D4D]">
						{t("responsiblePerson")}: <span className="text-[#334A74]">{task.responsible}</span>
					</p>
				</div>
			</div>

			<hr className="my-16 border-[#CCCCCC]" />

			<div className="flex gap-16 text-14 text-[#999999] md:text-16">
				<button type="button" onClick={() => inputRef.current?.focus()} className="transition-colors hover:text-primaryColor">
					{t("comment")}
				</button>
			</div>

			<ul className="mt-12 flex flex-col gap-12 md:pl-40">
				{comments.length === 0 && <li className="text-14 text-[#B3B3B3]">{t("noComments")}</li>}
				{comments.map((c) => (
					<li key={c._id} className="group animate-fade-in-up">
						<div className="rounded-24 border border-[#CCCCCC] px-20 py-12">
							<div className="flex items-baseline gap-10">
								<span className="text-16 font-medium text-[#666666] md:text-18">{c.meta}</span>
								<span className="text-12 text-[#B3B3B3] md:text-14">{when(c.createdAt)}</span>
							</div>
							<p className="mt-4 whitespace-pre-wrap break-words text-14 text-[#999999] md:text-16">{c.text}</p>
						</div>
						<div className="mt-4 flex gap-12 pl-8 text-12 text-[#B3B3B3] md:text-14">
							<button type="button" onClick={() => { setText(`@${c.meta} `); inputRef.current?.focus(); }} className="transition-colors hover:text-primaryColor">
								{t("reply")}
							</button>
							<button type="button" onClick={() => removeComment(task._id, c._id)} className="flex items-center gap-4 transition-colors hover:text-danger" aria-label={t("delete")}>
								<MdClose size={14} />
								{t("delete")}
							</button>
						</div>
					</li>
				))}
			</ul>

			<div className="mt-16 flex items-center gap-12">
				<Avatar name={authorName} src={user?.avatarUrl} size={60} />
				<input
					ref={inputRef}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && submit()}
					placeholder={t("addComment")}
					maxLength={2000}
					className="h-[56px] min-w-0 flex-1 rounded-50 border border-[#CCCCCC] px-24 text-16 text-[#666666] outline-none transition-colors placeholder:text-[#CCCCCC] focus:border-[#5EA8F5]"
				/>
			</div>
		</article>
	);
}
