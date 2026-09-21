"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdBackspace, MdCall, MdCallEnd, MdCallMade, MdCallMissed, MdCallReceived, MdClose, MdDialpad, MdMic, MdMicOff } from "react-icons/md";
import { providerLabel } from "@/app/config/callProviders";
import { useCallStore } from "@/app/store/useCallStore";

const mmss = (ms: number) => {
	const s = Math.max(0, Math.floor(ms / 1000));
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// Клавиши как на телефоне: цифра и буквы под ней
const KEYS: [string, string][] = [
	["1", ""], ["2", "ABC"], ["3", "DEF"],
	["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
	["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
	["*", ""], ["0", "+"], ["#", ""],
];

// Гудок входящего звонка: два коротких сигнала раз в 3 секунды (без звуковых файлов). Браузер может не разрешить звук,
// пока пользователь не кликал по странице, — тогда звонок остаётся беззвучным, но панель всё равно появляется.
function useRingtone(active: boolean) {
	useEffect(() => {
		if (!active) return;
		let ctx: AudioContext | null = null;
		let timer: ReturnType<typeof setInterval> | undefined;
		try {
			ctx = new AudioContext();
			const beep = (at: number) => {
				if (!ctx) return;
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.frequency.value = 440;
				gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
				gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + at + 0.02);
				gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.4);
				osc.connect(gain).connect(ctx.destination);
				osc.start(ctx.currentTime + at);
				osc.stop(ctx.currentTime + at + 0.45);
			};
			const ring = () => { beep(0); beep(0.6); };
			ring();
			timer = setInterval(ring, 3000);
		} catch { /* нет AudioContext — без звука */ }
		return () => {
			if (timer) clearInterval(timer);
			ctx?.close().catch(() => undefined);
		};
	}, [active]);
}

const shortTime = (iso: string) => {
	const d = new Date(iso);
	const today = new Date();
	const p = (n: number) => String(n).padStart(2, "0");
	const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
	return d.toDateString() === today.toDateString() ? hm : `${p(d.getDate())}.${p(d.getMonth() + 1)} ${hm}`;
};

// Звонилка внизу справа: кнопка-значок открывает панель с набором номера (клавиатура как на телефоне), списком
// недавних звонков и выбором провайдера. Входящий, набор и разговор (таймер, микрофон, цифры во время разговора,
// завершить). Подключается один раз в layout CRM, поэтому звонок не прерывается при переходе между страницами.
export default function Softphone() {
	const t = useTranslations("collab");
	const locale = useLocale();
	const {
		state, peer, muted, startedAt, error, link, providers, provider, dialerOpen, number, history,
		init, answer, decline, hangup, toggleMute, sendDigit, openDialer, closeDialer, setNumber, startCall, selectProvider,
	} = useCallStore();
	const [, tick] = useState(0);
	const [tab, setTab] = useState<"keys" | "recent">("keys");
	const [dtmfOpen, setDtmfOpen] = useState(false);
	const [sent, setSent] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => { init(); }, [init]);
	useRingtone(state === "incoming");

	useEffect(() => {
		if (state !== "active") return;
		const id = setInterval(() => tick((n) => n + 1), 1000);
		return () => clearInterval(id);
	}, [state]);

	useEffect(() => {
		if (state === "idle") { setDtmfOpen(false); setSent(""); }
	}, [state]);

	useEffect(() => {
		if (error) {
			toast.error(error === "token" ? t("phoneAuthError") : error === "mic" ? t("phoneMicError") : error);
			useCallStore.setState({ error: "" });
		}
	}, [error, t]);

	const inCall = state === "dialing" || state === "incoming" || state === "active";
	const open = dialerOpen || inCall;
	const round = "flex h-[52px] w-[52px] items-center justify-center rounded-50 text-white shadow-custom transition-opacity hover:opacity-80";
	const dot = link === "ready" ? "bg-[#009A2B]" : link === "connecting" ? "bg-[#F4A100]" : "bg-[#BDBDBD]";

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => openDialer()}
				aria-label={t("dialerOpen")}
				className="fixed bottom-16 right-16 z-[70] flex h-[56px] w-[56px] items-center justify-center rounded-50 bg-primaryColor text-white shadow-heroImage transition-opacity hover:opacity-80">
				<MdDialpad size={26} />
				<span className={`absolute right-2 top-2 h-[12px] w-[12px] rounded-50 border-2 border-[#FFFFFF] ${dot}`} />
			</button>
		);
	}

	function pressKey(d: string) {
		if (state === "active") {
			sendDigit(d);
			setSent((s) => (s + d).slice(-16));
		} else sendDigit(d);
	}

	const statusText = state === "incoming" ? t("callIncoming") : state === "dialing" ? t("callDialing") : t("callActive");
	const keypad = (
		<div className="grid grid-cols-3 gap-8">
			{KEYS.map(([d, letters]) => (
				<button
					key={d}
					type="button"
					onClick={() => pressKey(d)}
					aria-label={d}
					className="flex h-[52px] flex-col items-center justify-center rounded-10 bg-[#F5F8FA] text-[#333333] transition-colors hover:bg-[#E8F0F6] active:bg-[#DCE8F1]">
					<span className="text-20 font-medium leading-none">{d}</span>
					{letters && <span className="mt-2 text-[9px] leading-none tracking-[1px] text-[#999999]">{letters}</span>}
				</button>
			))}
		</div>
	);

	return (
		<div role="dialog" aria-label={t("dialerTitle")} className="fixed bottom-16 right-16 z-[70] w-[300px] max-w-[calc(100vw-32px)] animate-fade-in rounded-16 border border-[#E2F1F5] bg-white shadow-heroImage">
			<div className="flex items-center gap-8 border-b border-[#EFEFEF] px-16 py-10">
				<span className={`h-[10px] w-[10px] shrink-0 rounded-50 ${dot}`} title={link === "ready" ? t("linkReady") : link === "connecting" ? t("linkConnecting") : t("linkOffline")} />
				{providers.length > 1 ? (
					<select
						value={provider?.integrationId ?? ""}
						disabled={inCall}
						onChange={(e) => selectProvider(e.target.value)}
						aria-label={t("dialerProvider")}
						className="min-w-0 flex-1 truncate bg-transparent text-14 font-medium text-[#333333] outline-none disabled:opacity-60">
						{providers.map((p) => <option key={p.integrationId} value={p.integrationId}>{providerLabel(p.type, p.brand)} · {p.name}</option>)}
					</select>
				) : (
					<span className="min-w-0 flex-1 truncate text-14 font-medium text-[#333333]">{provider ? `${providerLabel(provider.type, provider.brand)} · ${provider.name}` : t("dialerTitle")}</span>
				)}
				{!inCall && (
					<button type="button" onClick={closeDialer} aria-label={t("dialerClose")} className="text-[#999999] transition-colors hover:text-[#333333]">
						<MdClose size={20} />
					</button>
				)}
			</div>

			{!inCall && (
				<div className="p-16">
					<div className="mb-12 flex rounded-8 bg-[#F5F8FA] p-2" role="tablist">
						{(["keys", "recent"] as const).map((k) => (
							<button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-[30px] flex-1 rounded-6 text-14 font-medium transition-colors ${tab === k ? "bg-white text-primaryColor shadow-custom" : "text-[#999999]"}`}>
								{k === "keys" ? t("dialerKeypad") : t("dialerRecent")}
							</button>
						))}
					</div>

					{tab === "keys" ? (
						<>
							<div className="mb-12 flex items-center gap-6 border-b border-[#EFEFEF] pb-6">
								<input
									ref={inputRef}
									type="text"
									inputMode="tel"
									value={number}
									onChange={(e) => setNumber(e.target.value.replace(/[^0-9+*#]/g, ""))}
									onKeyDown={(e) => { if (e.key === "Enter" && state !== "off") startCall(); }}
									placeholder={t("dialerNumber")}
									aria-label={t("dialerNumber")}
									autoComplete="off"
									className="h-[36px] min-w-0 flex-1 bg-transparent text-center text-24 tracking-[1px] text-[#333333] outline-none placeholder:text-16 placeholder:tracking-normal placeholder:text-[#BDBDBD]"
								/>
								<button type="button" onClick={() => setNumber(number.slice(0, -1))} aria-label={t("dialerBackspace")} disabled={!number} className="text-[#999999] transition-colors hover:text-[#333333] disabled:opacity-20">
									<MdBackspace size={22} />
								</button>
							</div>
							{keypad}
							{providers.length === 0 ? (
								<div className="mt-12 text-center">
									<p className="text-14 text-[#666666]">{t("dialerNoProvider")}</p>
									<Link href={`/${locale}/crm/settings/integration`} onClick={closeDialer} className="mt-6 inline-block text-14 font-medium text-primaryColor hover:underline">{t("dialerConnect")}</Link>
								</div>
							) : state === "off" ? (
								<p className="mt-12 text-center text-12 text-[#EB5757]">{t("linkOffline")}</p>
							) : null}
							<div className="mt-12 flex justify-center">
								<button type="button" onClick={() => startCall()} disabled={!number || state === "off"} aria-label={t("dialerCall")} className={`${round} bg-[#009A2B] disabled:opacity-40`}>
									<MdCall size={26} />
								</button>
							</div>
						</>
					) : (
						<ul className="max-h-[340px] overflow-y-auto">
							{history.length === 0 && <li className="py-24 text-center text-14 text-[#999999]">{t("dialerNoCalls")}</li>}
							{history.map((c) => {
								const missed = c.direction === "in" && c.status !== "completed";
								const Icon = missed ? MdCallMissed : c.direction === "in" ? MdCallReceived : MdCallMade;
								const label = c.status === "completed" ? mmss(c.duration * 1000) : c.status === "busy" ? t("dialerBusy") : c.status === "failed" ? t("dialerFailed") : c.direction === "in" ? t("dialerMissed") : t("dialerNoAnswer");
								return (
									<li key={c.id}>
										<button type="button" onClick={() => { setNumber(c.peer); setTab("keys"); }} className="flex w-full items-center gap-10 rounded-8 px-8 py-8 text-left transition-colors hover:bg-[#F5F8FA]">
											<Icon size={20} className={missed || c.status === "failed" ? "text-danger" : "text-[#009A2B]"} />
											<span className="min-w-0 flex-1">
												<span className="block truncate text-14 font-medium text-[#333333]">{c.name && c.name !== c.peer ? c.name : c.peer}</span>
												<span className="block truncate text-12 text-[#999999]">{c.name && c.name !== c.peer ? `${c.peer} · ` : ""}{label}</span>
											</span>
											<span className="shrink-0 text-12 text-[#999999]">{shortTime(c.at)}</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			)}

			{inCall && (
				<div role="status" aria-live="polite" className="p-16">
					<p className="text-14 text-[#999999]">{statusText}</p>
					<p className="mb-2 truncate text-20 font-semibold text-[#333333]">{peer}</p>
					{state === "active" && startedAt ? <p className="mb-12 text-16 tabular-nums text-primaryColor">{mmss(Date.now() - startedAt)}</p> : <div className="mb-12" />}
					{state === "active" && dtmfOpen && (
						<div className="mb-12">
							<p className="mb-6 h-[20px] truncate text-center text-16 tracking-[2px] text-[#666666]">{sent}</p>
							{keypad}
						</div>
					)}
					<div className="flex items-center justify-center gap-16">
						{state === "incoming" ? (
							<>
								<button type="button" onClick={decline} aria-label={t("callDecline")} className={`${round} bg-danger`}><MdCallEnd size={26} /></button>
								<button type="button" onClick={answer} aria-label={t("callAnswer")} className={`${round} bg-[#009A2B]`}><MdCall size={26} /></button>
							</>
						) : (
							<>
								{state === "active" && (
									<>
										<button type="button" onClick={toggleMute} aria-pressed={muted} aria-label={t("callMute")} className={`${round} ${muted ? "bg-[#666666]" : "bg-primaryColor"}`}>
											{muted ? <MdMicOff size={24} /> : <MdMic size={24} />}
										</button>
										<button type="button" onClick={() => setDtmfOpen((v) => !v)} aria-pressed={dtmfOpen} aria-label={t("dialerKeypad")} className={`${round} ${dtmfOpen ? "bg-[#666666]" : "bg-primaryColor"}`}>
											<MdDialpad size={24} />
										</button>
									</>
								)}
								<button type="button" onClick={hangup} aria-label={t("callHangup")} className={`${round} bg-danger`}><MdCallEnd size={26} /></button>
							</>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
