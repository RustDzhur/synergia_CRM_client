"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdCall, MdCallEnd, MdMic, MdMicOff } from "react-icons/md";
import { useCallStore } from "@/app/store/useCallStore";

const mmss = (ms: number) => {
	const s = Math.max(0, Math.floor(ms / 1000));
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// Панель звонка внизу справа: входящий (принять / отклонить), набор и разговор (таймер, микрофон, завершить).
// Подключается один раз в layout CRM, поэтому звонок не прерывается при переходе между страницами.
export default function Softphone() {
	const t = useTranslations("collab");
	const { state, peer, muted, startedAt, error, init, answer, decline, hangup, toggleMute } = useCallStore();
	const [, tick] = useState(0);

	useEffect(() => { init(); }, [init]);

	useEffect(() => {
		if (state !== "active") return;
		const id = setInterval(() => tick((n) => n + 1), 1000);
		return () => clearInterval(id);
	}, [state]);

	useEffect(() => {
		if (error) {
			toast.error(error === "token" ? t("phoneAuthError") : error === "mic" ? t("phoneMicError") : error);
			useCallStore.setState({ error: "" });
		}
	}, [error, t]);

	if (state === "off" || state === "idle") return null;

	const round = "flex h-[48px] w-[48px] items-center justify-center rounded-50 text-white shadow-custom transition-opacity hover:opacity-80";
	return (
		<div role="status" aria-live="polite" className="fixed bottom-16 right-16 z-[70] w-[300px] max-w-[calc(100vw-32px)] animate-fade-in rounded-16 border border-[#E2F1F5] bg-white p-16 shadow-heroImage">
			<p className="text-14 text-[#999999]">
				{state === "incoming" ? t("callIncoming") : state === "dialing" ? t("callDialing") : t("callActive")}
			</p>
			<p className="mb-12 truncate text-20 font-semibold text-[#333333]">{peer}</p>
			{state === "active" && startedAt && <p className="mb-12 text-16 tabular-nums text-primaryColor">{mmss(Date.now() - startedAt)}</p>}
			<div className="flex items-center justify-center gap-16">
				{state === "incoming" ? (
					<>
						<button type="button" onClick={decline} aria-label={t("callDecline")} className={`${round} bg-danger`}><MdCallEnd size={24} /></button>
						<button type="button" onClick={answer} aria-label={t("callAnswer")} className={`${round} bg-[#009A2B]`}><MdCall size={24} /></button>
					</>
				) : (
					<>
						{state === "active" && (
							<button type="button" onClick={toggleMute} aria-pressed={muted} aria-label={t("callMute")} className={`${round} ${muted ? "bg-[#666666]" : "bg-primaryColor"}`}>
								{muted ? <MdMicOff size={24} /> : <MdMic size={24} />}
							</button>
						)}
						<button type="button" onClick={hangup} aria-label={t("callHangup")} className={`${round} bg-danger`}><MdCallEnd size={24} /></button>
					</>
				)}
			</div>
		</div>
	);
}
