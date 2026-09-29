"use client";
import React, { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbCheckbox, TbDots, TbPin, TbX } from "react-icons/tb";
import { Task, useTaskStore } from "@/store/useTaskStore";
import { useCurrentUserStore } from "@/store/useCurrentUserStore";
import { localeTag } from "@/utils/dateHelpers";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import UserAvatar from "../shared/Avatar";

const initials = (name: string) =>
	name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Avatar({ name, src, size }: { name: string; src?: string; size: number }) {
	return (
		<UserAvatar src={src} initials={initials(name)} size={size} />
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

	const menuItem = "fs-popover-row block w-full px-14 py-10 text-left text-13 text-[#cfd4cb] transition-colors duration-150";

	return (
		<article className="fs-card p-16 md:p-20">
			<header className="flex items-start justify-between gap-12">
				<div className="flex min-w-0 items-center gap-12">
					<Avatar name={task.createdBy ?? ""} src={user && task.createdBy === authorName ? user.avatarUrl : undefined} size={38} />
					<div className="min-w-0">
						<p className="truncate text-14 font-medium text-[#f1f4ee]">{task.createdBy}</p>
						<p className="text-12 text-[#8c948b]">{task.createdAt ? when(task.createdAt) : ""}</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-10 text-[#8c948b]">
					<div ref={menuRef} className="relative">
						<button type="button" aria-label={t("options")} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="transition-colors hover:text-[#f1f4ee]">
							<TbDots size={18} />
						</button>
						<Dropdown open={menuOpen} className="right-0 top-full mt-8 min-w-[200px]">
							<div className="fs-popover overflow-hidden py-4">
								<button type="button" className={menuItem} onClick={() => { setMenuOpen(false); updateTask(task._id, { completed: !task.completed }); }}>
									{task.completed ? t("markActive") : t("markDone")}
								</button>
								<div className="my-4 border-t border-inkLine" />
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
						className={`transition-colors ${task.pinned ? "text-[#c6ff4d]" : "hover:text-[#f1f4ee]"}`}>
						<TbPin size={17} />
					</button>
				</div>
			</header>

			<div className="mt-12 flex flex-wrap items-center gap-16">
				<span className="flex items-center gap-8 rounded-8 border border-inkLine px-10 py-6 text-12 text-[#8c948b]">
					<TbCheckbox size={15} />
					{t("task")}
				</span>
				<div className="min-w-0">
					<p className={`text-13 text-[#8c948b] ${task.completed ? "line-through opacity-60" : ""}`}>
						{t("task")}: <span className="font-semibold text-[#f1f4ee]">{task.title}</span>
					</p>
					<p className="text-13 text-[#8c948b]">
						{t("responsiblePerson")}: <span className="text-[#cfd4cb]">{task.responsible}</span>
					</p>
				</div>
			</div>

			<hr className="my-14 border-inkLine" />

			<div className="flex gap-16 text-13 text-[#8c948b]">
				<button type="button" onClick={() => inputRef.current?.focus()} className="transition-colors hover:text-[#c6ff4d]">
					{t("comment")}
				</button>
			</div>

			<ul className="mt-12 flex flex-col gap-8 md:pl-40">
				{comments.length === 0 && <li className="text-13 text-[#9AA396]">{t("noComments")}</li>}
				{comments.map((c) => (
					<li key={c._id} className="group animate-fade-in-up">
						<div className="rounded-12 border border-inkLine bg-[rgba(255,255,255,0.02)] px-16 py-10">
							<div className="flex items-baseline gap-10">
								<span className="text-13 font-medium text-[#cfd4cb]">{c.meta}</span>
								<span className="text-11 text-[#9AA396]">{when(c.createdAt)}</span>
							</div>
							<p className="mt-4 whitespace-pre-wrap break-words text-13 text-[#8c948b]">{c.text}</p>
						</div>
						<div className="mt-4 flex gap-12 pl-8 text-11 text-[#9AA396]">
							<button type="button" onClick={() => { setText(`@${c.meta} `); inputRef.current?.focus(); }} className="transition-colors hover:text-[#c6ff4d]">
								{t("reply")}
							</button>
							<button type="button" onClick={() => removeComment(task._id, c._id)} className="flex items-center gap-4 transition-colors hover:text-danger" aria-label={t("delete")}>
								<TbX size={13} />
								{t("delete")}
							</button>
						</div>
					</li>
				))}
			</ul>

			<div className="mt-16 flex items-center gap-12">
				<Avatar name={authorName} src={user?.avatarUrl} size={34} />
				<input
					ref={inputRef}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && submit()}
					placeholder={t("addComment")}
					maxLength={2000}
					className="fs-field h-40 min-w-0 flex-1 rounded-50 px-16 text-13 outline-none"
				/>
			</div>
		</article>
	);
}
