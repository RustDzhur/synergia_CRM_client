"use client";
import React, { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbCalendarEvent, TbChecklist, TbClipboardPlus, TbDots, TbNews, TbPin, TbUser } from "react-icons/tb";
import toast from "react-hot-toast";
import { FeedPost, useFeedStore } from "@/store/useFeedStore";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import Avatar from "../../shared/Avatar";
import { formatDueDate, formatPostDate, initialsOf } from "../format";

const NAVY = "text-[#f1f4ee]";
// Набор смайликов для реакций: «свои эмоции» без свободного ввода — одинаково у всех и не ломает вёрстку
const REACTIONS = ["👍", "❤️", "😄", "🎉", "👏", "🚀"];
const action = "text-13 text-[#8c948b] transition-colors hover:text-[#c6ff4d]";

export default function Post({ post, meName, meAvatar }: { post: FeedPost; meName: string; meAvatar: string }) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const { togglePin, toggleFollow, remove, comment, react, setKind, toTask } = useFeedStore();
	const [text, setText] = useState("");
	const [menuOpen, setMenuOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

	function submit() {
		const value = text.trim();
		if (!value) return;
		comment(post.id, value);
		setText("");
	}

	// «В задачи»: запись становится задачей (со сроком, если он указан), в ленте появляется её карточка
	async function pushToTask() {
		if (busy) return;
		setBusy(true);
		const error = await toTask(post.id);
		setBusy(false);
		if (error) return void toast.error(error);
		toast.success(t("taskCreated"));
	}

	async function pushToNews() {
		await setKind(post.id, "news");
		toast.success(t("newsPublished"));
	}

	return (
		<article className="fs-card animate-fade-in p-16 md:p-18">
			<header className="flex items-start gap-12">
				<Avatar src={post.authorAvatar} initials={initialsOf(post.author)} size={38} className="flex text-13" />
				<div className="min-w-0 flex-1">
					<p className={`truncate text-13 font-medium ${NAVY}`}>{post.author}</p>
					<p className="text-11 text-[#8c948b]">{formatPostDate(post.at, locale)}</p>
				</div>
				<div ref={menuRef} className="relative flex shrink-0 items-center gap-12 pt-6 text-[#8C948B]">
					<button type="button" aria-label={t("more")} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="transition-colors hover:text-[#f1f4ee]">
						<TbDots size={18} />
					</button>
					<button
						type="button"
						aria-pressed={post.pinned}
						aria-label={t("pin")}
						onClick={() => togglePin(post.id)}
						className={`transition-[color,transform] duration-200 ${post.pinned ? "-rotate-45 text-[#c6ff4d]" : "hover:text-[#f1f4ee]"}`}>
						<TbPin size={17} />
					</button>
					<Dropdown open={menuOpen} className="right-0 top-full mt-8 min-w-[150px]">
						<div className="fs-popover overflow-hidden py-4">
							<button
								type="button"
								onClick={() => { setMenuOpen(false); remove(post.id); }}
								className="fs-popover-row block w-full px-14 py-10 text-left text-13 !text-danger transition-colors">
								{t("deletePost")}
							</button>
						</div>
					</Dropdown>
				</div>
			</header>

			{post.kind === "task" ? (
				<>
					<div className="mt-12 flex items-center gap-x-10 md:gap-x-16">
						<span className="fs-chip h-26 shrink-0 gap-8 px-10 text-11">
							<TbChecklist size={15} aria-hidden />
							{t("task")}
						</span>
						<div className="min-w-0">
							<p className="text-13">
								<span className="max-md:hidden text-[#8c948b]">{t("taskLabel")} </span>
								<span className={`font-semibold ${NAVY}`}>{post.taskTitle}</span>
							</p>
						</div>
					</div>
					<p className="mt-6 text-12 text-[#8c948b] md:pl-[80px]">
						{t("responsible")} <span className={NAVY}>{post.responsible}</span>
					</p>
				</>
			) : (
				<p className="mt-12 whitespace-pre-wrap break-words text-13 text-[#f1f4ee]">{post.text}</p>
			)}

			{(post.dueAt || post.audience === "people") && (
				<div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-6 text-11 text-[#8c948b]">
					{post.dueAt && (
						<span className="flex h-24 items-center gap-6 rounded-6 border border-inkLine px-10">
							<TbCalendarEvent size={14} aria-hidden />
							{formatDueDate(post.dueAt, locale)}
						</span>
					)}
					{post.audience === "people" && post.audienceNames.length > 0 && (
						<span className="flex h-24 items-center gap-6 rounded-6 border border-inkLine px-10">
							<TbUser size={14} aria-hidden />
							{t("toWhom")} {post.audienceNames.join(", ")}
						</span>
					)}
				</div>
			)}
			<hr className="my-14 border-inkLine" />

			<div className="mt-12 flex flex-wrap gap-x-12 gap-y-6">
				<span className="text-12 text-[#8C948B]">{post.kind === "news" ? t("news") : post.kind === "task" ? t("task") : t("kindPost")}</span>
				<button type="button" className={action} onClick={() => inputRef.current?.focus()}>{t("comment")}</button>
				<button type="button" className={`${action} ${post.following ? "!text-[#c6ff4d]" : ""}`} aria-pressed={post.following} onClick={() => toggleFollow(post.id)}>
					{post.following ? t("unfollow") : t("follow")}
				</button>
				{post.kind !== "task" && (
					<button type="button" disabled={busy} className={action} onClick={pushToTask}>
						<span className="flex items-center gap-6"><TbClipboardPlus size={15} aria-hidden />{t("toTask")}</span>
					</button>
				)}
				{post.kind !== "news" && (
					<button type="button" className={action} onClick={pushToNews}>
						<span className="flex items-center gap-6"><TbNews size={15} aria-hidden />{t("toNews")}</span>
					</button>
				)}
				<button type="button" className={action} onClick={() => setMenuOpen(true)}>{t("more")}</button>
			</div>

			<div className="mt-12 flex flex-wrap items-center gap-8" role="group" aria-label={t("reactions")}>
				{REACTIONS.map((emoji) => {
					const r = post.reactions.find((x) => x.emoji === emoji);
					return (
						<button
							key={emoji}
							type="button"
							aria-pressed={!!r?.mine}
							aria-label={`${t("reactions")} ${emoji}`}
							onClick={() => react(post.id, emoji)}
							className={`flex h-28 items-center gap-6 rounded-50 border px-10 text-12 transition-colors ${
								r?.mine ? "border-inkAccentLine bg-[rgba(198,255,77,0.10)] text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:border-inkAccentLine"
							}`}>
							<span aria-hidden>{emoji}</span>
							{r ? r.count : ""}
						</button>
					);
				})}
			</div>

			{post.comments.length > 0 && (
				<ul className="mt-12 flex flex-col gap-8">
					{post.comments.map((c) => (
						<li key={c.id} className="animate-fade-in-up rounded-12 border border-inkLine px-14 py-10">
							<p className="flex flex-wrap items-center gap-10">
								<Avatar src={c.authorAvatar} initials={initialsOf(c.author)} size={26} className="flex text-11" />
								<span className="text-13 font-medium text-[#f1f4ee]">{c.author}</span>
								<span className="text-11 text-[#8C948B]">{formatPostDate(c.at, locale)}</span>
							</p>
							<p className="mt-2 break-words text-13 text-[#8c948b]">{c.text}</p>
						</li>
					))}
				</ul>
			)}

			<div className="mt-16 flex items-center gap-12">
				<Avatar src={meAvatar} initials={initialsOf(meName)} size={38} className="hidden text-13 md:flex" />
				<input
					ref={inputRef}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && submit()}
					placeholder={t("addComment")}
					aria-label={t("addComment")}
					maxLength={500}
					className="fs-field h-40 w-full rounded-50 px-16 text-13 outline-none"
				/>
			</div>
		</article>
	);
}
