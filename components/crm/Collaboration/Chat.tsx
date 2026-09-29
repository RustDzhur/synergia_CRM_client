"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbArrowLeft, TbDots, TbMessages, TbMicrophone, TbPaperclip, TbPhone, TbPlayerStop } from "react-icons/tb";
import { apiCall, authHeaders } from "@/store/crmApi";
import { useCallStore } from "@/store/useCallStore";
import type { ConversationDTO, MessageDTO } from "@/types/integrations";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import { usePolling } from "@/utils/usePolling";
import { useScrollLock } from "@/utils/useScrollLock";
import ConfirmDialog from "../shared/ConfirmDialog";
import ChatEmpty from "./ChatEmpty";
import { hhmm } from "./format";
import AttachmentView from "./chatParts/AttachmentView";
import CallEntry from "./chatParts/CallEntry";
import ChannelBadge from "./chatParts/ChannelBadge";
import ChatList from "./chatParts/ChatList";
import useAttachmentUrls from "./chatParts/useAttachmentUrls";
import { MEDIA_CHANNELS, voiceExt } from "./chatParts/model";

// Chat and Calls (/crm/collaboration/chat-and-calls). Беседы из подключённых каналов (Settings → Integration):
// Telegram, Viber, Messenger, SMS/звонки Twilio, онлайн-чат сайта. Новые сообщения подтягиваются опросом сервера.
// Десктоп: список бесед слева, переписка справа.
// Планшет: только переписка, список выезжает справа по значку в шапке чата. Телефон: сначала список, по нажатию — переписка.
export default function Chat() {
	const t = useTranslations("collab");
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
	const [recording, setRecording] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
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

	const attachmentUrls = useAttachmentUrls(messages);
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

	// Отправка вложения: сначала файл уходит в хранилище фирмы, потом — собеседнику через его канал.
	// Текст рядом с файлом становится подписью (у Viber для файлов — отдельным сообщением).
	async function sendFile(file: File) {
		if (!active || sending) return;
		setSending(true);
		const form = new FormData();
		form.append("file", file);
		const caption = text.trim();
		if (caption) form.append("text", caption);
		const res = await fetch(`/api/conversations/${active.id}/attachment`, { method: "POST", headers: authHeaders(false), body: form });
		const body = await res.json().catch(() => null);
		setSending(false);
		if (!res.ok) return void toast.error(body?.message || t("sendFailed")); // текст остаётся в поле — можно отправить ещё раз
		setText("");
		if (body) setMessages((list) => (list.some((m) => m.id === body.id) ? list : [...list, body as MessageDTO]));
		loadChats();
	}

	// Голосовое: пишем с микрофона и отправляем как звуковой файл (то же поле, что и у вложения)
	async function toggleRecording() {
		if (recording) return void recorderRef.current?.stop();
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return void toast.error(t("micDenied"));
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			const chunks: Blob[] = [];
			recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
			recorder.onstop = () => {
				stream.getTracks().forEach((track) => track.stop());
				setRecording(false);
				const type = recorder.mimeType || "audio/webm";
				const blob = new Blob(chunks, { type });
				if (blob.size) void sendFile(new File([blob], `voice.${voiceExt(type)}`, { type: blob.type }));
			};
			recorderRef.current = recorder;
			setRecording(true);
			recorder.start();
		} catch {
			setRecording(false);
			toast.error(t("micDenied"));
		}
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

	const iconButton = "text-[#8c948b] transition-colors hover:text-[#c6ff4d]";

	if (loaded && chats.length === 0) return <ChatEmpty />;

	return (
		<div className="flex h-[calc(100vh-137px)] md:h-[calc(100vh-110px)] md:p-24 lg:p-32">
			{/* список бесед: телефон (страница) и десктоп (колонка слева) */}
			<aside
				className={`${view === "list" ? "block" : "hidden"} fs-scroll w-full overflow-y-auto md:hidden lg:block lg:w-[340px] lg:shrink-0 lg:fs-card`}>
				<ChatList chats={chats} activeId={activeId} onSelect={select} />
			</aside>

			<section
				className={`${view === "chat" ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex md:overflow-hidden md:fs-card lg:ml-20`}>
				{!active ? (
					<p className="m-auto p-30 text-13 text-[#8c948b]">{t("chatsEmpty")}</p>
				) : (
					<>
						<header className="flex items-center justify-between gap-12 border-b border-inkLine px-16 py-12 md:px-20">
							<div className="flex min-w-0 items-center gap-12">
								<button type="button" onClick={() => setView("list")} aria-label={t("back")} className={`${iconButton} md:hidden`}>
									<TbArrowLeft size={20} />
								</button>
								<h2 className="truncate text-14 font-semibold text-[#f1f4ee]">{active.name}</h2>
								<ChannelBadge channel={active.channel} size={18} />
							</div>
							<div ref={menuRef} className="relative flex items-center gap-16">
								<button type="button" onClick={() => setDrawer(true)} aria-label={t("conversations")} className={`${iconButton} hidden md:block lg:hidden`}>
									<TbMessages size={20} />
								</button>
								{(active.channel === "twilio" || active.channel === "sip") && (
									<button type="button" onClick={call} aria-label={t("call")} className={iconButton}>
										<TbPhone size={20} />
									</button>
								)}
								<button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={t("more")} className={iconButton}>
									<TbDots size={20} />
								</button>
								<Dropdown open={menuOpen} className="right-0 top-full mt-8 min-w-[190px]">
									<div className="fs-popover overflow-hidden py-4">
										<button
											type="button"
											onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
											className="fs-popover-row block w-full px-14 py-10 text-left text-13 !text-danger transition-colors">
											{t("deleteChat")}
										</button>
									</div>
								</Dropdown>
							</div>
						</header>

						<div className="fs-scroll flex-1 overflow-y-auto px-16 py-20 md:px-20">
							<div className="flex flex-col gap-14">
								{messages.map((m) => {
									if (m.kind === "call") return <CallEntry key={m.id} m={m} />;
									const mine = m.direction === "out";
									return (
										<div key={m.id} className={`flex animate-fade-in flex-col ${mine ? "items-end" : "items-start"}`}>
											<p className="mb-6 text-12 font-medium text-[#8c948b]">
												{mine ? t("you") : active.name}{" "}
												<span className="ml-6 text-11 font-normal text-[#8C948B]">{hhmm(new Date(m.at))}</span>
											</p>
											{m.attachment && (
												<AttachmentView a={m.attachment} url={attachmentUrls[m.id]} mine={mine} />
											)}
											{m.text && (
												<p
													className={`max-w-[85%] whitespace-pre-wrap break-words rounded-14 px-16 py-10 text-13 md:text-13 ${
														mine ? "bg-[rgba(198,255,77,0.14)] text-[#f1f4ee]" : "bg-[rgba(255,255,255,0.05)] text-[#f1f4ee]"
													} ${m.attachment ? "mt-8" : ""}`}>
													{m.text}
												</p>
											)}
										</div>
									);
								})}
								<div ref={endRef} />
							</div>
						</div>

						{active.channel === "sip" ? (
							<footer className="flex h-[56px] items-center border-t border-inkLine px-16 text-12 text-[#8c948b] md:px-20">{t("callsOnly")}</footer>
						) : (
						<footer className="flex items-center gap-12 border-t border-inkLine px-16 md:px-20">
							<input
								value={text}
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && submit()}
								placeholder={t("writeMessage")}
								aria-label={t("writeMessage")}
								maxLength={2000}
								className="h-[56px] w-full bg-transparent text-13 text-[#f1f4ee] outline-none placeholder:text-[#9AA396]"
							/>
							{active && MEDIA_CHANNELS.includes(active.channel) && (
								<>
									{/* голосовое с микрофона */}
									<button
										type="button"
										onClick={toggleRecording}
										disabled={sending}
										aria-label={recording ? t("stopRecording") : t("recordVoice")}
										aria-pressed={recording}
										className={`shrink-0 transition-colors ${recording ? "animate-pulse text-danger" : "text-[#8C948B] hover:text-[#c6ff4d]"}`}>
										{recording ? <TbPlayerStop size={20} /> : <TbMicrophone size={20} />}
									</button>
									<input
										ref={fileRef}
										type="file"
										className="hidden"
										aria-label={t("attach")}
										onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void sendFile(file); }}
									/>
									<button
										type="button"
										onClick={() => fileRef.current?.click()}
										disabled={sending}
										aria-label={t("attach")}
										className="shrink-0 text-[#8C948B] transition-colors hover:text-[#c6ff4d] disabled:opacity-50">
										<TbPaperclip size={20} />
									</button>
								</>
							)}
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
				<div className={`fs-scroll h-full w-[300px] overflow-y-auto border-l border-inkLine bg-inkPanel shadow-[0_18px_44px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out motion-reduce:transition-none ${drawer ? "translate-x-0" : "translate-x-full"}`}>
					<ChatList chats={chats} activeId={activeId} onSelect={select} />
				</div>
			</div>

			<ConfirmDialog open={confirmDelete} title={t("deleteChat")} text={t("confirmDeleteChat")} onCancel={() => setConfirmDelete(false)} onConfirm={removeChat} />
		</div>
	);
}
