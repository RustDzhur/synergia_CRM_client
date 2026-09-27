"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdAddTask, MdChecklist, MdClose, MdGroup, MdMoreHoriz, MdNewspaper, MdPerson, MdPushPin, MdSchedule } from "react-icons/md";
import toast from "react-hot-toast";
import { api } from "@/app/store/crmApi";
import { FeedPost, useFeedStore } from "@/app/store/useFeedStore";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import { usePolling } from "@/app/utils/usePolling";
import Avatar from "../shared/Avatar";
import SearchBox from "../shared/SearchBox";
import { formatDueDate, formatPostDate, initialsOf } from "./format";

const NAVY = "text-[#334A74]";
// Набор смайликов для реакций: «свои эмоции» без свободного ввода — одинаково у всех и не ломает вёрстку
const REACTIONS = ["👍", "❤️", "😄", "🎉", "👏", "🚀"];
const action = "text-16 text-[#999999] transition-colors hover:text-primaryColor";

interface Member { userId: string; name: string; email: string; you?: boolean }

// Кому адресована запись: вся фирма или выбранные люди
function AudiencePicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
	const t = useTranslations("collab");
	const [open, setOpen] = useState(false);
	const [members, setMembers] = useState<Member[]>([]);
	const [loaded, setLoaded] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const close = useCallback(() => setOpen(false), []);
	useClickOutside(ref, open, close);

	// Участников спрашиваем при первом открытии списка, а не при загрузке страницы
	useEffect(() => {
		if (!open || loaded) return;
		let alive = true;
		api<{ members: Member[] }>("/api/orgs/members").then((data) => {
			if (!alive || !data) return;
			setMembers(data.members.filter((m) => !m.you));
			setLoaded(true);
		});
		return () => { alive = false; };
	}, [open, loaded]);

	const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className={`flex h-[42px] items-center gap-8 rounded-8 border px-14 text-14 transition-colors md:text-16 ${ids.length ? "border-[#5EA8F5] text-[#5EA8F5]" : "border-[#E6E6E6] text-[#999999] hover:text-[#666666]"}`}>
				{ids.length === 1 ? <MdPerson size={18} aria-hidden /> : <MdGroup size={18} aria-hidden />}
				{ids.length ? `${t("toWhom")} ${ids.length}` : t("pickRecipients")}
			</button>
			<Dropdown open={open} className="bottom-full left-0 mb-8 w-[260px]">
				<div className="max-h-[260px] overflow-y-auto rounded-8 border border-[#E2F1F5] bg-white p-8 shadow-custom">
					<button
						type="button"
						onClick={() => { onChange([]); close(); }}
						className={`block w-full rounded-8 px-12 py-8 text-left text-16 transition-colors hover:bg-gray ${ids.length ? "text-[#666666]" : "font-medium text-primaryColor"}`}>
						{t("everyone")}
					</button>
					{members.map((m) => (
						<label key={m.userId} className="flex cursor-pointer items-center gap-10 rounded-8 px-12 py-8 text-16 text-[#666666] transition-colors hover:bg-gray">
							<input type="checkbox" checked={ids.includes(m.userId)} onChange={() => toggle(m.userId)} className="h-[16px] w-[16px] accent-[#5EA8F5]" />
							<span className="truncate">{m.name}</span>
						</label>
					))}
					{loaded && members.length === 0 && <p className="px-12 py-8 text-14 text-[#999999]">{t("noColleagues")}</p>}
				</div>
			</Dropdown>
		</div>
	);
}

function Post({ post, meName, meAvatar }: { post: FeedPost; meName: string; meAvatar: string }) {
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
		<article className="animate-fade-in rounded-24 bg-white p-16 shadow-heroImage md:p-18">
			<header className="flex items-start gap-12">
				<Avatar src={post.authorAvatar} initials={initialsOf(post.author)} size={60} className="flex text-20" />
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
								onClick={() => { setMenuOpen(false); remove(post.id); }}
								className="block w-full px-16 py-10 text-left text-16 text-danger transition-colors hover:bg-gray">
								{t("deletePost")}
							</button>
						</div>
					</Dropdown>
				</div>
			</header>

			{post.kind === "task" ? (
				<>
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
				</>
			) : (
				<p className="mt-12 whitespace-pre-wrap break-words text-16 text-[#4D4D4D] md:text-18">{post.text}</p>
			)}

			{(post.dueAt || post.audience === "people") && (
				<div className="mt-12 flex flex-wrap items-center gap-x-12 gap-y-6 text-14 text-[#666666]">
					{post.dueAt && (
						<span className="flex h-[32px] items-center gap-8 rounded-4 bg-[#E7EDF3] px-12">
							<MdSchedule size={16} aria-hidden />
							{formatDueDate(post.dueAt, locale)}
						</span>
					)}
					{post.audience === "people" && post.audienceNames.length > 0 && (
						<span className="flex h-[32px] items-center gap-8 rounded-4 bg-[#E7EDF3] px-12">
							<MdPerson size={16} aria-hidden />
							{t("toWhom")} {post.audienceNames.join(", ")}
						</span>
					)}
				</div>
			)}
			<hr className="my-16 border-[#D9D9D9]" />

			<div className="mt-12 flex flex-wrap gap-x-12 gap-y-6">
				<span className="text-16 text-[#999999]">{post.kind === "news" ? t("news") : post.kind === "task" ? t("task") : t("kindPost")}</span>
				<button type="button" className={action} onClick={() => inputRef.current?.focus()}>{t("comment")}</button>
				<button type="button" className={`${action} ${post.following ? "!text-primaryColor" : ""}`} aria-pressed={post.following} onClick={() => toggleFollow(post.id)}>
					{post.following ? t("unfollow") : t("follow")}
				</button>
				{post.kind !== "task" && (
					<button type="button" disabled={busy} className={action} onClick={pushToTask}>
						<span className="flex items-center gap-6"><MdAddTask size={18} aria-hidden />{t("toTask")}</span>
					</button>
				)}
				{post.kind !== "news" && (
					<button type="button" className={action} onClick={pushToNews}>
						<span className="flex items-center gap-6"><MdNewspaper size={18} aria-hidden />{t("toNews")}</span>
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
							className={`flex h-[32px] items-center gap-6 rounded-50 border px-10 text-14 transition-colors ${
								r?.mine ? "border-[#5EA8F5] bg-[#EAF3FE] text-[#5EA8F5]" : "border-[#E6E6E6] text-[#666666] hover:border-[#5EA8F5]"
							}`}>
							<span aria-hidden>{emoji}</span>
							{r ? r.count : ""}
						</button>
					);
				})}
			</div>

			{post.comments.length > 0 && (
				<ul className="mt-12 flex flex-col gap-10">
					{post.comments.map((c) => (
						<li key={c.id} className="animate-fade-in-up rounded-24 border border-[#E6E6E6] px-20 py-10 shadow-custom">
							<p className="flex flex-wrap items-center gap-10">
								<Avatar src={c.authorAvatar} initials={initialsOf(c.author)} size={32} className="flex text-12" />
								<span className="text-18 font-medium text-[#4D4D4D]">{c.author}</span>
								<span className="text-14 text-[#999999]">{formatPostDate(c.at, locale)}</span>
							</p>
							<p className="mt-2 break-words text-16 text-[#666666] md:text-18">{c.text}</p>
						</li>
					))}
				</ul>
			)}

			<div className="mt-16 flex items-center gap-12">
				<Avatar src={meAvatar} initials={initialsOf(meName)} size={60} className="hidden text-20 md:flex" />
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

// Feed (/crm/collaboration/feed): лента фирмы — посты коллег, новости и карточки задач, «Comment / Follow / More», комментарии,
// смайлики-реакции, срок у записи, адресаты (вся фирма или конкретные люди) и перенос записи в задачи или новости.
// Данные на сервере; страница опрашивает его раз в 20 секунд, поэтому записи коллег появляются без перезагрузки.
export default function Feed() {
	const t = useTranslations("collab");
	const { posts, loaded, load, publish } = useFeedStore();
	usePolling(load, 20_000);
	const user = useCurrentUserStore((s) => s.user);
	const [query, setQuery] = useState("");
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const [dueAt, setDueAt] = useState("");
	const [asNews, setAsNews] = useState(false);
	const [audienceIds, setAudienceIds] = useState<string[]>([]);
	const [kindFilter, setKindFilter] = useState<"all" | "news" | "task">("all");

	const meName = user ? `${user.firstname} ${user.lastname}` : "";
	// Своя аватарка: из профиля, а если он ещё не загружен — из собственных записей ленты
	const meAvatar = user?.avatarUrl || posts.find((p) => p.authorId === user?.id)?.authorAvatar || "";

	async function submitPost(e: React.FormEvent) {
		e.preventDefault();
		const value = draft.trim();
		if (!value || busy) return;
		setBusy(true);
		const error = await publish(value, { kind: asNews ? "news" : "post", dueAt, audienceIds });
		setBusy(false);
		if (error) return void toast.error(error);
		setDraft("");
		setDueAt("");
		setAudienceIds([]);
		setAsNews(false);
	}

	// закреплённые записи всегда сверху; порядок остальных сохраняется
	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		const match = (p: FeedPost) =>
			(kindFilter === "all" || p.kind === kindFilter) &&
			(!q ||
				[p.author, p.text, p.taskTitle, p.responsible, ...p.audienceNames, ...p.comments.map((c) => c.text)].some((v) => v.toLowerCase().includes(q)));
		const list = posts.filter(match);
		return [...list.filter((p) => p.pinned), ...list.filter((p) => !p.pinned)];
	}, [posts, query, kindFilter]);

	const chip = (key: "all" | "news" | "task", label: string) => (
		<button
			key={key}
			type="button"
			aria-pressed={kindFilter === key}
			onClick={() => setKindFilter(key)}
			className={`h-[36px] rounded-8 border px-16 text-14 transition-colors md:text-16 ${
				kindFilter === key ? "border-[#5EA8F5] text-[#5EA8F5]" : "border-[#E6E6E6] text-[#666666] hover:border-[#5EA8F5]"
			}`}>
			{label}
		</button>
	);

	return (
		<div className="p-16 md:p-30">
			<div className="mb-20 flex flex-col gap-16 md:mb-30 md:flex-row md:items-center md:justify-between">
				<h1 className="text-24 font-medium text-[#4D4D4D] md:text-25">{t("feedTitle")}</h1>
				<SearchBox value={query} onChange={setQuery} placeholder={t("filterSearch")} className="w-full md:w-[250px] lg:w-[350px]" />
			</div>
			<form onSubmit={submitPost} className="mb-30 flex flex-col gap-10 rounded-24 bg-white p-16 shadow-heroImage md:p-18">
				<div className="flex items-start gap-12">
					<Avatar src={meAvatar} initials={initialsOf(meName)} size={60} className="hidden text-20 md:flex" />
					<textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						maxLength={2000}
						rows={3}
						placeholder={t("feedPostPlaceholder")}
						aria-label={t("feedPostPlaceholder")}
						className="w-full resize-none rounded-16 border border-[#E6E6E6] px-20 py-12 text-16 text-[#666666] outline-none transition-colors placeholder:text-[#CCCCCC] focus:border-[#5EA8F5] md:text-18"
					/>
				</div>
				<div className="flex flex-wrap items-center gap-10">
					<label className="flex h-[42px] items-center gap-8 rounded-8 border border-[#E6E6E6] px-14 text-14 text-[#999999] transition-colors focus-within:border-[#5EA8F5] md:text-16">
						<MdSchedule size={18} aria-hidden />
						<input
							type="datetime-local"
							value={dueAt}
							onChange={(e) => setDueAt(e.target.value)}
							aria-label={t("dueDate")}
							className="bg-transparent text-14 text-[#666666] outline-none md:text-16"
						/>
					</label>
					<AudiencePicker ids={audienceIds} onChange={setAudienceIds} />
					<button
						type="button"
						aria-pressed={asNews}
						onClick={() => setAsNews((v) => !v)}
						className={`flex h-[42px] items-center gap-8 rounded-8 border px-14 text-14 transition-colors md:text-16 ${asNews ? "border-[#5EA8F5] text-[#5EA8F5]" : "border-[#E6E6E6] text-[#999999] hover:text-[#666666]"}`}>
						<MdNewspaper size={18} aria-hidden />
						{t("news")}
					</button>
					{audienceIds.length > 0 && (
						<button type="button" onClick={() => setAudienceIds([])} aria-label={t("everyone")} className="flex h-[42px] items-center gap-6 rounded-8 border border-[#E6E6E6] px-12 text-14 text-[#999999] transition-colors hover:text-[#666666] md:text-16">
							<MdClose size={16} aria-hidden />
							{t("everyone")}
						</button>
					)}
					<button type="submit" disabled={!draft.trim() || busy} className="ml-auto rounded-8 bg-primaryColor px-24 py-10 text-16 font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-[0.5]">
						{t("feedPublish")}
					</button>
				</div>
			</form>
			<div className="mb-20 flex flex-wrap items-center gap-10">
				{chip("all", t("all"))}
				{chip("news", t("news"))}
				{chip("task", t("task"))}
			</div>
			{!loaded ? null : visible.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("feedEmpty")}</p>
			) : (
				<div className="flex flex-col gap-30">
					{visible.map((p) => <Post key={p.id} post={p} meName={meName} meAvatar={meAvatar} />)}
				</div>
			)}
		</div>
	);
}
