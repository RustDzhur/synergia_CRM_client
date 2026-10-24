"use client";
import React, { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbCalendarEvent, TbNews, TbX } from "react-icons/tb";
import toast from "react-hot-toast";
import { FeedPost, useFeedStore } from "@/store/useFeedStore";
import { useCurrentUserStore } from "@/store/useCurrentUserStore";
import { usePolling } from "@/utils/usePolling";
import Avatar from "../shared/Avatar";
import SearchBox from "../shared/SearchBox";
import { TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import { initialsOf } from "./format";
import AudiencePicker from "./feedParts/AudiencePicker";
import EmojiPicker from "./feedParts/EmojiPicker";
import Post from "./feedParts/Post";

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
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Вставляем смайлик туда, где стоит курсор, а не в конец текста — иначе правка середины сбивала бы порядок
	function insertEmoji(emoji: string) {
		const el = textareaRef.current;
		if (!el) return void setDraft((d) => d + emoji);
		const start = el.selectionStart ?? draft.length;
		const end = el.selectionEnd ?? start;
		const next = draft.slice(0, start) + emoji + draft.slice(end);
		setDraft(next.slice(0, 2000));
		requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); });
	}

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
			className={`${TAB_ITEM} ${kindFilter === key ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}>
			{label}
		</button>
	);

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<div className="mb-20 flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
				<h1 className="text-20 font-semibold tracking-[-0.4px] text-[#f1f4ee] md:text-24">{t("feedTitle")}</h1>
				<SearchBox value={query} onChange={setQuery} placeholder={t("filterSearch")} className="w-full md:w-[250px] lg:w-[350px]" />
			</div>
			<form onSubmit={submitPost} className="fs-card mb-20 flex flex-col gap-10 p-16 md:p-18">
				<div className="flex items-start gap-12">
					<Avatar src={meAvatar} initials={initialsOf(meName)} size={38} className="hidden text-13 md:flex" />
					<textarea
						ref={textareaRef}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						maxLength={2000}
						rows={3}
						placeholder={t("feedPostPlaceholder")}
						aria-label={t("feedPostPlaceholder")}
						className="fs-field w-full resize-none rounded-12 px-14 py-10 text-13 outline-none"
					/>
				</div>
				<div className="flex flex-wrap items-center gap-10">
					<label className="fs-field flex h-34 items-center gap-8 px-12 text-12 text-[#8c948b] transition-colors">
						<TbCalendarEvent size={15} aria-hidden />
						<input
							type="datetime-local"
							value={dueAt}
							onChange={(e) => setDueAt(e.target.value)}
							aria-label={t("dueDate")}
							className="bg-transparent text-12 text-[#f1f4ee] outline-none"
						/>
					</label>
					<AudiencePicker ids={audienceIds} onChange={setAudienceIds} />
					<EmojiPicker onPick={insertEmoji} />
					<button
						type="button"
						aria-pressed={asNews}
						onClick={() => setAsNews((v) => !v)}
						className={`flex h-34 items-center gap-8 rounded-10 border px-12 text-12 transition-colors ${asNews ? "border-inkAccentLine text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
						<TbNews size={15} aria-hidden />
						{t("news")}
					</button>
					{audienceIds.length > 0 && (
						<button type="button" onClick={() => setAudienceIds([])} aria-label={t("everyone")} className="flex h-34 items-center gap-6 rounded-10 border border-inkLine px-12 text-12 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
							<TbX size={14} aria-hidden />
							{t("everyone")}
						</button>
					)}
					<button type="submit" disabled={!draft.trim() || busy} className="fs-btn fs-btn-primary ml-auto h-38 disabled:cursor-default disabled:opacity-[0.5]">
						{t("feedPublish")}
					</button>
				</div>
			</form>
			<div className="mb-20 flex flex-wrap items-center gap-8">
				{chip("all", t("all"))}
				{chip("news", t("news"))}
				{chip("task", t("task"))}
			</div>
			{!loaded ? null : visible.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("feedEmpty")}</p>
			) : (
				<div className="flex flex-col gap-16">
					{visible.map((p) => <Post key={p.id} post={p} meName={meName} meAvatar={meAvatar} />)}
				</div>
			)}
		</div>
	);
}
