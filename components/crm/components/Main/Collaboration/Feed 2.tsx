"use client";
import React, { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdChecklist, MdMoreHoriz, MdPushPin } from "react-icons/md";
import { FeedPost, useCollabHydration, useCollabStore } from "@/app/store/useCollabStore";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import Avatar from "../shared/Avatar";
import SearchBox from "../shared/SearchBox";
import CodeArt from "./CodeArt";
import { formatPostDate, initialsOf } from "./format";

const NAVY = "text-[#334A74]";

function Post({ post }: { post: FeedPost }) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const { togglePin, toggleFollow, deletePost, addComment } = useCollabStore();
	const user = useCurrentUserStore((s) => s.user);
	const [text, setText] = useState("");
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

	const me = user ? `${user.firstname} ${user.lastname}` : "";
	const action = "text-16 text-[#999999] transition-colors hover:text-primaryColor";

	function submit() {
		const value = text.trim();
		if (!value) return;
		addComment(post.id, me || post.author, value);
		setText("");
	}

	return (
		<article className="animate-fade-in rounded-24 bg-white p-16 shadow-heroImage md:p-18">
			<header className="flex items-start gap-12">
				<Avatar initials={initialsOf(post.author)} size={60} className="flex text-20" />
				<div className="min-w-0 flex-1">
					<p className={`truncate text-18 font-medium md:text-20 ${NAVY}`}>{post.author}</p>
					<p className="text-14 text-[#666666]">{formatPostDate(post.at, locale)}</p>
				</div>
				<div ref={menuRef} className="relative flex shrink-0 items-center gap-12 pt-6 text-[#B3B3B3]">
					<button type="button" aria-label={t("more")} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="transition-colors hover:text-[#666666]">
						<MdMoreHoriz size={22} />
					</button>
					<button
						type="button"
						aria-pressed={post.pinned}
						aria-label={t("pin")}
						onClick={() => togglePin(post.id)}
						className={`transition-[color,transform] duration-200 ${post.pinned ? "-rotate-45 text-primaryColor" : "hover:text-[#666666]"}`}>
						<MdPushPin size={22} />
					</button>
					<Dropdown open={menuOpen} className="right-0 top-full mt-8 min-w-[150px]">
						<div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white shadow-custom">
							<button
								type="button"
								onClick={() => { setMenuOpen(false); deletePost(post.id); }}
								className="block w-full px-16 py-10 text-left text-16 text-danger transition-colors hover:bg-gray">
								{t("deletePost")}
							</button>
						</div>
					</Dropdown>
				</div>
			</header>

			<div className="mt-12 flex items-center gap-x-12 md:gap-x-20">
				<span className="flex h-[36px] shrink-0 items-center gap-10 rounded-4 bg-[#E7EDF3] px-16 text-14 text-[#666666]">
					<MdChecklist size={18} aria-hidden />
					{t("task")}
				</span>
				<div className="min-w-0">
					<p className="text-16 text-[#666666] md:text-20">
						<span className="max-md:hidden">{t("taskLabel")} </span>
						<span className={`font-semibold ${NAVY}`}>{post.taskTitle}</span>
					</p>
				</div>
			</div>
			<p className="mt-6 text-14 text-[#666666] md:text-16 md:pl-[100px]">
				{t("responsible")} <span className={NAVY}>{post.responsible}</span>
			</p>
			<hr className="my-16 border-[#D9D9D9]" />

			{post.withImage && <CodeArt className="-mx-16 h-[350px] w-[calc(100%+32px)] max-w-none md:mx-0 md:h-[200px] md:w-[400px]" />}

			<div className="mt-12 flex flex-wrap gap-x-12 gap-y-6">
				<span className="text-16 text-[#999999]">{t("news")}</span>
				<button type="button" className={action} onClick={() => inputRef.current?.focus()}>{t("comment")}</button>
				<button type="button" className={`${action} ${post.following ? "!text-primaryColor" : ""}`} aria-pressed={post.following} onClick={() => toggleFollow(post.id)}>
					{post.following ? t("unfollow") : t("follow")}
				</button>
				<button type="button" className={action} onClick={() => setMenuOpen(true)}>{t("more")}</button>
			</div>

			{post.comments.length > 0 && (
				<ul className="mt-12 flex flex-col gap-10">
					{post.comments.map((c) => (
						<li key={c.id} className="animate-fade-in-up rounded-24 border border-[#E6E6E6] px-20 py-10 shadow-custom">
							<p className="flex flex-wrap items-baseline gap-10">
								<span className="text-18 font-medium text-[#4D4D4D]">{c.author}</span>
								<span className="text-14 text-[#999999]">{formatPostDate(c.at, locale)}</span>
							</p>
							<p className="mt-2 break-words text-16 text-[#666666] md:text-18">{c.text}</p>
						</li>
					))}
				</ul>
			)}

			<div className="mt-16 flex items-center gap-12">
				<Avatar src={user?.avatarUrl} initials={initialsOf(me)} size={60} className="hidden text-20 md:flex" />
				<input
					ref={inputRef}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && submit()}
					placeholder={t("addComment")}
					aria-label={t("addComment")}
					maxLength={500}
					className="h-[50px] w-full rounded-50 border border-[#E6E6E6] px-20 text-16 text-[#666666] shadow-custom outline-none transition-colors placeholder:text-[#CCCCCC] focus:border-[#5EA8F5] md:h-[60px] md:text-18"
				/>
			</div>
		</article>
	);
}

// Feed (/crm/collaboration/feed): лента записей — карточка автора, задача, картинка, «Comment / Follow / More», комментарии.
export default function Feed() {
	const t = useTranslations("collab");
	useCollabHydration();
	const posts = useCollabStore((s) => s.posts);
	const [query, setQuery] = useState("");

	// закреплённые записи всегда сверху; порядок остальных сохраняется
	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		const match = (p: FeedPost) =>
			!q ||
			[p.author, p.taskTitle, p.responsible, ...p.comments.map((c) => c.text)].some((v) => v.toLowerCase().includes(q));
		const list = posts.filter(match);
		return [...list.filter((p) => p.pinned), ...list.filter((p) => !p.pinned)];
	}, [posts, query]);

	return (
		<div className="p-16 md:p-30">
			<div className="mb-20 flex flex-col gap-16 md:mb-30 md:flex-row md:items-center md:justify-between">
				<h1 className="text-32 font-medium text-[#4D4D4D] md:text-34">{t("feedTitle")}</h1>
				<SearchBox value={query} onChange={setQuery} placeholder={t("filterSearch")} className="w-full md:w-[250px] lg:w-[350px]" />
			</div>
			{visible.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("feedEmpty")}</p>
			) : (
				<div className="flex flex-col gap-30">
					{visible.map((p) => <Post key={p.id} post={p} />)}
				</div>
			)}
		</div>
	);
}
