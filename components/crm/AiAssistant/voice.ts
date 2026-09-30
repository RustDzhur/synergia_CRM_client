"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/store/crmApi";

// Голос окна ассистента: диктовка вопроса (микрофон) и озвучка ответа.
//
// Оба пути — браузерные API (SpeechRecognition, MediaRecorder, speechSynthesis), поэтому ключей
// не требуют вовсе. На сервер уходит только запись — и только для браузеров без распознавания
// (Firefox, Safari), если серверная диктовка настроена (ключ OpenAI, см. /api/ai/transcribe).
// Диктовка ничего не выполняет сама: текст попадает в поле ввода, отправка — по кнопке, как и
// написано в правилах ассистента («действия — только после подтверждения»).

/** Язык для распознавания и синтеза речи: локаль интерфейса → тег BCP-47. */
export const speechLang = (locale: string) => (locale === "ua" || locale === "uk" ? "uk-UA" : locale === "de" ? "de-DE" : "en-US");

// ── Диктовка ─────────────────────────────────────────────────────────────────────────────────────────

// Минимальный набор полей SpeechRecognition — стандартных типов в TypeScript ещё нет
type RecognitionEvent = { resultIndex: number; results: { length: number } & Record<number, { isFinal: boolean } & Record<number, { transcript: string }>> };
interface RecognitionLike {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	start: () => void;
	stop: () => void;
	onresult: ((e: RecognitionEvent) => void) | null;
	onerror: ((e: { error?: string }) => void) | null;
	onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

const recognitionCtor = (): RecognitionCtor | null => {
	if (typeof window === "undefined") return null;
	const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const dictationSupported = () => !!recognitionCtor();
export const recorderSupported = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export type MicState = "idle" | "listening" | "transcribing";
export type MicError = "micDenied" | "micUnavailable" | "micFailed";

const voiceExt = (type: string) => (type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm");
// Склейка уже набранного текста и распознанного: диктовка дописывает, а не затирает
const join = (base: string, speech: string) => {
	const s = speech.trim();
	return base ? (s ? `${base} ${s}` : base) : s;
};

export function useVoiceInput({ locale, serverStt, onText, onError }: {
	locale: string;
	serverStt: boolean;
	onText: (fullText: string) => void;
	onError: (code: MicError) => void;
}) {
	const [state, setState] = useState<MicState>("idle");
	const stateRef = useRef<MicState>("idle");
	const recogRef = useRef<RecognitionLike | null>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const baseRef = useRef("");
	// Колбэки держим в ref: движок живёт дольше рендера, замыкание не должно устаревать
	const onTextRef = useRef(onText);
	const onErrorRef = useRef(onError);
	onTextRef.current = onText;
	onErrorRef.current = onError;

	const set = (s: MicState) => { stateRef.current = s; setState(s); };

	const stopAll = useCallback(() => {
		try { recogRef.current?.stop(); } catch { /* уже остановлен */ }
		try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch { /* уже остановлен */ }
	}, []);

	const stop = useCallback(() => stopAll(), [stopAll]);

	const start = useCallback(async (base: string) => {
		if (stateRef.current !== "idle") return void stopAll();
		baseRef.current = base.trim();

		// Путь 1: распознавание в браузере — без ключей и без сервера (Chrome, Edge, Android)
		const Ctor = recognitionCtor();
		if (Ctor) {
			const recog = new Ctor();
			recog.lang = speechLang(locale);
			recog.continuous = true;
			recog.interimResults = true;
			recog.onresult = (e) => {
				let finalText = "";
				let interim = "";
				for (let i = 0; i < e.results.length; i++) {
					const r = e.results[i];
					if (r.isFinal) finalText += r[0].transcript;
					else interim += r[0].transcript;
				}
				// Промежуточный текст показываем сразу — видно, что микрофон слышит
				onTextRef.current(join(baseRef.current, finalText + interim));
			};
			recog.onerror = (e) => {
				// no-speech — просто тишина, это не ошибка; aborted — наша же остановка
				if (e?.error === "not-allowed" || e?.error === "service-not-allowed") onErrorRef.current("micDenied");
				else if (e?.error && e.error !== "aborted" && e.error !== "no-speech") onErrorRef.current("micFailed");
			};
			// В onend ничего не переписываем: последний onresult уже отдал лучший текст,
			// а недослышанное промежуточное остаётся видимым в поле — человек его поправит
			recog.onend = () => set("idle");
			recogRef.current = recog;
			try { recog.start(); set("listening"); } catch { onErrorRef.current("micDenied"); }
			return;
		}

		// Путь 2: запись и распознавание на сервере — для остальных браузеров, если он настроен
		if (!serverStt || !recorderSupported()) return void onErrorRef.current("micUnavailable");
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			return void onErrorRef.current("micDenied");
		}
		const recorder = new MediaRecorder(stream);
		const chunks: Blob[] = [];
		recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
		recorder.onstop = async () => {
			stream.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
			const type = recorder.mimeType || "audio/webm";
			const blob = new Blob(chunks, { type });
			if (!blob.size) return void set("idle");
			set("transcribing");
			try {
				const body = new FormData();
				body.append("file", blob, `voice.${voiceExt(type)}`);
				body.append("language", locale);
				const res = await fetch("/api/ai/transcribe", { method: "POST", headers: authHeaders(false), body });
				const json = (await res.json().catch(() => null)) as { text?: string } | null;
				if (!res.ok || !json) onErrorRef.current("micFailed");
				else onTextRef.current(join(baseRef.current, String(json.text ?? "")));
			} catch {
				onErrorRef.current("micFailed");
			}
			set("idle");
		};
		recorderRef.current = recorder;
		streamRef.current = stream;
		set("listening");
		recorder.start();
	}, [locale, serverStt, stopAll]);

	// Уход со страницы во время записи не должен оставлять микрофон включённым
	useEffect(() => () => { stopAll(); streamRef.current?.getTracks().forEach((track) => track.stop()); }, [stopAll]);

	return { state, start, stop };
}

// ── Озвучка ответов ──────────────────────────────────────────────────────────────────────────────────

/** Текст для чтения вслух: разметка ответа ассистента вслух звучала бы мусором. */
export function stripForSpeech(text: string): string {
	return String(text ?? "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/^\s*[-*]\s+/gm, "")
		.replace(/[*_#>|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function useSpeechOutput(locale: string) {
	const [speakingId, setSpeakingId] = useState<string | null>(null);

	const stop = useCallback(() => {
		if (ttsSupported()) speechSynthesis.cancel();
		setSpeakingId(null);
	}, []);

	const speak = useCallback((id: string, text: string) => {
		if (!ttsSupported()) return false;
		speechSynthesis.cancel();
		const clean = stripForSpeech(text);
		if (!clean) return false;
		const utterance = new SpeechSynthesisUtterance(clean.slice(0, 4000));
		utterance.lang = speechLang(locale);
		utterance.onend = () => setSpeakingId((s) => (s === id ? null : s));
		utterance.onerror = () => setSpeakingId((s) => (s === id ? null : s));
		speechSynthesis.speak(utterance);
		setSpeakingId(id);
		return true;
	}, [locale]);

	// Закрытие окна/уход со страницы останавливает чтение
	useEffect(() => () => { if (ttsSupported()) speechSynthesis.cancel(); }, []);

	return { speak, stop, speakingId };
}
