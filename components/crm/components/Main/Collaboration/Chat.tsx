"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdArrowBack, MdAttachFile, MdCall, MdCallMade, MdCallMissed, MdCallReceived, MdForum, MdMoreHoriz } from "react-icons/md";
import { apiCall } from "@/app/store/crmApi";
import { useCallStore } from "@/app/store/useCallStore";
import type { ConversationDTO, MessageDTO, MessagingChannel } from "@/app/types/integrations";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import { usePolling } from "@/app/utils/usePolling";
import { useScrollLock } from "@/app/utils/useScrollLock";
import Avatar from "../shared/Avatar";
import ConfirmDialog from "../shared/ConfirmDialog";
import { CHANNEL_COLOR, CHANNEL_ICON } from "./channelMeta";
import ChatEmpty from "./ChatEmpty";
import { formatChatDate, hhmm, initialsOf } from "./format";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function ChannelBadge({ channel, size = 16 }: { channel: MessagingChannel; size?: number }) {
	const t = useTranslations("collab");
	const Icon = CHANNEL_ICON[channel];
	return <span title={t(`ch_${channel}`)} aria-label={t(`ch_${channel}`)} style={{ color: CHANNEL_COLOR[channel] }} className="shrink-0"><Icon size={size} /></span>;
}

// Строка о звонке в переписке: направление, итог, длительность
function CallEntry({ m }: { m: MessageDTO }) {
	const t = useTranslations("collab");
	const status = String(m.meta.status ?? "");
	const duration = Number(m.meta.duration) || 0;
	const done = status === "completed";
	let label: string;
	let Icon = m.direction === "in" ? MdCallReceived : MdCallMade;
	if (m.direction === "in") {
		label = done ? t("callLogIn", { duration: mmss(duration) }) : t("callLogMissed");
		if (!done) Icon = MdCallMissed;
	} else {
		label = done ? t("callLogOut", { duration: mmss(duration) }) : status === "no-answer" ? t("callLogNoAnswer") : status === "busy" ? t("callLogBusy") : t("callLogFailed");
	}
	return (
		<div className="flex animate-fade-in items-center justify-center gap-8 text-14 text-[#999999]">
			<Icon size={18} className={done ? "text-[#009A2B]" : "text-danger"} />
			<span>{label}</span>
			<span>{hhmm(new Date(m.at))}</span>
		</div>
	);
}

function ChatList({ chats, activeId, onSelect }: { chats: ConversationDTO[]; activeId: string | null; onSelect: (id: string) => void }) {
	const t = useTranslations("collab");
	const locale = useLocale();
	if (chats.length === 0) return <p className="p-30 text-center text-16 text-[#999999]">{t("chatsEmpty")}</p>;
	return (
		<ul>
			{chats.map((c) => {
				const active = c.id === activeId;
				return (
					<li key={c.id}>
						<button
							type="button"
							onClick={() => onSelect(c.id)}
							aria-current={active ? "true" : undefined}
							className={`flex w-full items-center gap-12 px-12 py-[18px] text-left transition-colors duration-150 ${active ? "bg-[#EBEEFF]" : "hover:bg-[#F7F9FF]"}`}>
							<Avatar initials={initialsOf(c.name)} size={58} className="flex text-18" />
							<div className="min-w-0 flex-1">
								<div className="flex items-start justify-between gap-8">
									<p className="flex min-w-0 items-center gap-6 text-18 font-semibold text-[#333333]">
											<ChannelBadge channel={c.channel} />
											<span className="truncate">{c.name}</span>
										</p>
									<p className="shrink-0 whitespace-nowrap text-12 text-[#333333] md:max-lg:hidden lg:text-14">{formatChatDate(c.lastAt, locale)}</p>
								</div>
								<div className="mt-2 flex items-end justify-between gap-8">
									<p className="truncate text-14 text-[#666666]">{c.lastText}</p>
									{c.unread > 0 && (
										<span className="flex h-[25px] min-w-[27px] shrink-0 items-center justify-center rounded-4 bg-primaryColor px-6 text-14 font-semibold text-white">
											{c.unread}
										</span>
									)}
								</div>
							</div>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

// Chat and Calls (/crm/collaboration/chat-and-calls). Беседы из подключённых каналов (Settings → Integration):
// Telegram, Viber, Messenger, SMS/звонки Twilio, онлайн-чат сайта. Новые сообщения подтягиваются опросом сервера.
// Десктоп: список бесед слева, переписка справа.
// Планшет: только переписка, список выезжает справа по значку в шапке чата. Телефон: сначала список, по нажатию — переписка.
export default function Chat() {
	const t = useTranslations("collab");
	const locale = useLocale();
	const [chats, setChats] = useState<ConversationDTO[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [messages, setMessages] = useState<MessageDTO[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [view, setView] = useState<"list" | "chat">("list"); // только для телефона
	const [drawer, setDrawer] = useState(false); // только для планшета
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const callState = useCallStore((s) => s.state);
	useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));
	useScrollLock(drawer);

	// на десктопе и планшете всегда открыта какая-то беседа: по умолчанию первая
	const activeId = selectedId && chats.some((c) => c.id === selectedId) ? selectedId : chats[0]?.id ?? null;
	const active = chats.find((c) => c.id === activeId) ?? null;

	const loadChats = useCallback(async () => {
		const res = await apiCall<ConversationDTO[]>("/api/conversations");
		if (res.ok && res.data) setChats(res.data);
		setLoaded(true);
	}, []);

	// На телефоне список и переписка — разные экраны: «прочитанной» беседа становится, только когда её реально открыли
	const visible = activeId !== null && (view === "chat" || (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches));
	const loadMessages = useCallback(async () => {
		if (!activeId) return;
		const res = await apiCall<{ conversation: ConversationDTO; messages: MessageDTO[] }>(`/api/conversations/${activeId}?read=1`);
		if (!res.ok || !res.data) return;
		setMessages(res.data.messages);
		setChats((list) => list.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)));
	}, [activeId]);

	usePolling(loadChats, 6000);
	usePolling(loadMessages, 3000, visible);
	useEffect(() => { setMessages([]); }, [activeId]);

	useEffect(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [activeId, messages.length, view]);

	function select(id: string) {
		setSelectedId(id);
		setView("chat");
		setDrawer(false);
	}

	async function submit() {
		const value = text.trim();
		if (!value || !active || sending) return;
		setSending(true);
		const res = await apiCall<MessageDTO>(`/api/conversations/${active.id}/messages`, "POST", { text: value });
		setSending(false);
		if (!res.ok) return void toast.error(res.message || t("sendFailed")); // текст остаётся в поле — можно отправить ещё раз
		setText("");
		if (res.data) setMessages((list) => (list.some((m) => m.id === res.data!.id) ? list : [...list, res.data!]));
		loadChats();
	}

	async function removeChat() {
		if (!active) return;
		setConfirmDelete(false);
		const res = await apiCall(`/api/conversations/${active.id}`, "DELETE");
		if (!res.ok) return void toast.error(t("sendFailed"));
		setChats((list) => list.filter((c) => c.id !== active.id));
		setSelectedId(null);
		setView("list");
	}

	async function call() {
		if (!active) return;
		if (callState === "off") return void toast.error(t("phoneNotReady"));
		if (callState !== "idle") return;
		const phone = useCallStore.getState();
		// беседа принадлежит другому провайдеру, чем выбран в звонилке (Twilio ↔ SIP) — звоним через её провайдера
		if (phone.provider?.integrationId !== active.integrationId && phone.providers.some((p) => p.integrationId === active.integrationId)) {
			await phone.selectProvider(active.integrationId);
			if (useCallStore.getState().state !== "idle") return;
		}
		useCallStore.getState().startCall(active.externalId);
	}

	const iconButton = "text-[#666666] transition-colors hover:text-primaryColor";

	if (loaded && chats.length === 0) return <ChatEmpty />;

	return (
		<div className="flex h-[calc(100vh-137px)] md:h-[calc(100vh-110px)] md:p-30">
			{/* список бесед: телефон (страница) и десктоп (колонка слева) */}
			<aside
				className={`${view === "list" ? "block" : "hidden"} w-full overflow-y-auto md:hidden lg:block lg:w-[400px] lg:shrink-0 lg:rounded-16 lg:border lg:border-[#E6E6E6] lg:shadow-custom`}>
				<ChatList chats={chats} activeId={activeId} onSelect={select} />
			</aside>

			<section
				className={`${view === "chat" ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex md:overflow-hidden md:rounded-16 md:border md:border-[#E6E6E6] md:shadow-heroImage lg:ml-30`}>
				{!active ? (
					<p className="m-auto p-30 text-16 text-[#999999]">{t("chatsEmpty")}</p>
				) : (
					<>
						<header className="flex items-center justify-between gap-12 border-b border-[#E6E6E6] px-16 py-16 md:px-30">
							<div className="flex min-w-0 items-center gap-12">
								<button type="button" onClick={() => setView("list")} aria-label={t("back")} className={`${iconButton} md:hidden`}>
									<MdArrowBack size={24} />
								</button>
								<h2 className="truncate text-24 font-semibold text-primaryColor">{active.name}</h2>
								<ChannelBadge channel={active.channel} size={20} />
							</div>
							<div ref={menuRef} className="relative flex items-center gap-20">
								<button type="button" onClick={() => setDrawer(true)} aria-label={t("conversations")} className={`${iconButton} hidden md:block lg:hidden`}>
									<MdForum size={24} />
								</button>
								{(active.channel === "twilio" || active.channel === "sip") && (
									<button type="button" onClick={call} aria-label={t("call")} className={iconButton}>
										<MdCall size={24} />
									</button>
								)}
								<button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={t("more")} className={iconButton}>
									<MdMoreHoriz size={24} />
								</button>
								<Dropdown open={menuOpen} className="right-0 top-full mt-8 min-w-[190px]">
									<div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white shadow-custom">
										<button
											type="button"
											onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
											className="block w-full px-16 py-10 text-left text-16 text-danger transition-colors hover:bg-gray">
											{t("deleteChat")}
										</button>
									</div>
								</Dropdown>
							</div>
						</header>

						<div className="flex-1 overflow-y-auto px-16 py-20 md:px-30">
							<div className="flex flex-col gap-16">
								{messages.map((m) => {
									if (m.kind === "call") return <CallEntry key={m.id} m={m} />;
									const mine = m.direction === "out";
									return (
										<div key={m.id} className={`flex animate-fade-in flex-col ${mine ? "items-end" : "items-start"}`}>
											<p className="mb-8 text-16 font-medium text-[#4D4D4D]">
												{mine ? t("you") : active.name}{" "}
												<span className="ml-6 text-14 font-normal text-[#B3B3B3]">{hhmm(new Date(m.at))}</span>
											</p>
											<p
												className={`max-w-[85%] whitespace-pre-wrap break-words rounded-16 px-20 py-12 text-16 shadow-custom md:text-18 ${
													mine ? "bg-white text-[#4D4D4D]" : "bg-primaryColor text-white"
												}`}>
												{m.text}
											</p>
										</div>
									);
								})}
								<div ref={endRef} />
							</div>
						</div>

						{active.channel === "sip" ? (
							<footer className="flex h-[64px] items-center border-t border-[#E6E6E6] px-16 text-14 text-[#999999] md:px-30">{t("callsOnly")}</footer>
						) : (
						<footer className="flex items-center gap-12 border-t border-[#E6E6E6] px-16 md:px-30">
							<input
								value={text}
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && submit()}
								placeholder={t("writeMessage")}
								aria-label={t("writeMessage")}
								maxLength={2000}
								className="h-[64px] w-full text-16 text-[#4D4D4D] outline-none placeholder:text-[#CCCCCC]"
							/>
							<button type="button" onClick={() => toast(t("attachSoon"))} aria-label={t("attach")} className="shrink-0 text-[#B3B3B3] transition-colors hover:text-primaryColor">
								<MdAttachFile size={24} />
							</button>
						</footer>
						)}
					</>
				)}
			</section>

			{/* планшет: список бесед выезжает справа поверх переписки */}
			<div
				onClick={(e) => e.target === e.currentTarget && setDrawer(false)}
				aria-hidden={!drawer}
				className={`fixed inset-0 z-50 hidden justify-end bg-modalBG transition-[opacity,visibility] duration-300 motion-reduce:transition-none md:flex lg:hidden ${
					drawer ? "visible opacity-100" : "invisible opacity-0"
				}`}>
				<div className={`h-full w-[300px] overflow-y-auto bg-white shadow-heroImage transition-transform duration-300 ease-out motion-reduce:transition-none ${drawer ? "translate-x-0" : "translate-x-full"}`}>
					<ChatList chats={chats} activeId={activeId} onSelect={select} />
				</div>
			</div>

			<ConfirmDialog open={confirmDelete} title={t("deleteChat")} text={t("confirmDeleteChat")} onCancel={() => setConfirmDelete(false)} onConfirm={removeChat} />
		</div>
	);
}
