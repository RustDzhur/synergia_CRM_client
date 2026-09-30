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

	// onDone — когда фраза дочитана (или чтение сорвалось): режим разговора по нему возобновляет слушание
	const speak = useCallback((id: string, text: string, onDone?: () => void) => {
		if (!ttsSupported()) return false;
		speechSynthesis.cancel();
		const clean = stripForSpeech(text);
		if (!clean) return false;
		const utterance = new SpeechSynthesisUtterance(clean.slice(0, 4000));
		utterance.lang = speechLang(locale);
		const finish = () => { setSpeakingId((s) => (s === id ? null : s)); onDone?.(); };
		utterance.onend = finish;
		utterance.onerror = finish;
		speechSynthesis.speak(utterance);
		setSpeakingId(id);
		return true;
	}, [locale]);

	// Закрытие окна/уход со страницы останавливает чтение
	useEffect(() => () => { if (ttsSupported()) speechSynthesis.cancel(); }, []);

	return { speak, stop, speakingId };
}

// ── Режим разговора (Джарвис) ────────────────────────────────────────────────────────────────────────

// Слова-ответы: голосом подтверждают или отменяют действие, командуют «стоп». Сравнение по словам,
// а не по вхождению подстроки — «нету планов» не должно читаться как «нет».
const YES_WORDS = ["так", "ага", "ок", "окей", "добре", "гаразд", "підтверджую", "підтверди", "давай", "зроби", "виконуй", "yes", "ok", "okay", "confirm", "sure", "do it", "ja", "jep", "bestätige", "bestätigen", "mach"];
const NO_WORDS = ["ні", "нет", "no", "nein", "скасуй", "відміни", "відміна", "відбій", "не треба", "cancel", "stop it", "abbrechen", "стоп"];
const STOP_WORDS = ["стоп", "зупинись", "зупинитися", "stop", "halt", "стоп режим"];

const words = (text: string) => String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);
const hasWord = (list: string[], text: string) => {
	const ws = words(text);
	return list.some((w) => (w.includes(" ") ? text.toLowerCase().includes(w) : ws.includes(w)));
};

/** Ответ «да» / «нет» в распознанной фразе; null — ни то ни другое. */
export function spokenAnswer(text: string): "yes" | "no" | null {
	if (hasWord(YES_WORDS, text)) return "yes";
	if (hasWord(NO_WORDS, text)) return "no";
	return null;
}

/** Команда «стоп» — выйти из режима разговора. */
export const isStopCommand = (text: string) => hasWord(STOP_WORDS, text);

/**
 * Что делать с распознанной фразой, когда ассистент ждёт подтверждения:
 * «так» подтверждает единственное предложенное действие, «ні» отменяет, всё остальное — новый вопрос.
 * При нескольких действиях голосом подтверждать нельзя — их слишком легко перепутать, просим кнопку.
 */
export function voiceDecision(text: string, pendingActions: number): { kind: "confirm" } | { kind: "cancel" } | { kind: "many" } | { kind: "send" } {
	if (pendingActions > 0) {
		const answer = spokenAnswer(text);
		if (answer === "yes") return pendingActions === 1 ? { kind: "confirm" } : { kind: "many" };
		if (answer === "no") return { kind: "cancel" };
	}
	return { kind: "send" };
}

/**
 * Непрерывное слушание для режима разговора: распознаёт фразу и сам зовёт onPhrase, когда человек
 * замолчал (тишина ~1,4 с). Пока ассистент думает или говорит, слушание выключено — микрофон не
 * должен слышать собственный голос. Живёт только на браузерном распознавании: серверный путь
 * требует ручной остановки записи, а «Джарвис» — это именно разговор без рук.
 */
export function useContinuousListening({ locale, active, onPhrase, onError }: {
	locale: string;
	active: boolean;
	onPhrase: (text: string) => void;
	onError: (code: MicError) => void;
}) {
	const [interim, setInterim] = useState("");
	const recogRef = useRef<RecognitionLike | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const phraseRef = useRef("");
	const sentRef = useRef(false);
	const onPhraseRef = useRef(onPhrase);
	const onErrorRef = useRef(onError);
	onPhraseRef.current = onPhrase;
	onErrorRef.current = onError;

	useEffect(() => {
		const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
		sentRef.current = false;
		phraseRef.current = "";
		setInterim("");
		if (!active) {
			clearTimer();
			try { recogRef.current?.stop(); } catch { /* уже остановлен */ }
			recogRef.current = null;
			return;
		}
		const Ctor = recognitionCtor();
		if (!Ctor) return;
		let disposed = false;

		// Пауза означает конец фразы: отправляем её и останавливаем распознавание до следующего круга
		const arm = () => {
			clearTimer();
			timerRef.current = setTimeout(() => {
				const phrase = phraseRef.current.trim();
				if (!phrase || sentRef.current || disposed) return;
				sentRef.current = true;
				phraseRef.current = "";
				setInterim("");
				try { recogRef.current?.stop(); } catch { /* уже остановлен */ }
				onPhraseRef.current(phrase);
			}, 1400);
		};

		const startEngine = () => {
			if (disposed) return;
			const recog = new Ctor();
			recog.lang = speechLang(locale);
			recog.continuous = true;
			recog.interimResults = true;
			recog.onresult = (e) => {
				let finalText = "";
				let interimText = "";
				for (let i = 0; i < e.results.length; i++) {
					const r = e.results[i];
					if (r.isFinal) finalText += r[0].transcript;
					else interimText += r[0].transcript;
				}
				phraseRef.current = finalText;
				const shown = (finalText + interimText).trim();
				setInterim(shown);
				if (shown) arm();
			};
			recog.onerror = (e) => {
				if (e?.error === "not-allowed" || e?.error === "service-not-allowed") onErrorRef.current("micDenied");
			};
			// Браузер сам завершает сессию распознавания (тишина, лимит времени) — пока режим включён, поднимаем заново
			recog.onend = () => {
				if (disposed || sentRef.current) return;
				try { recog.start(); } catch { /* перезапустим после следующего события */ }
			};
			recogRef.current = recog;
			try { recog.start(); } catch { /* уже запущен */ }
		};
		startEngine();

		return () => {
			disposed = true;
			clearTimer();
			try { recogRef.current?.stop(); } catch { /* уже остановлен */ }
			recogRef.current = null;
			setInterim("");
		};
	}, [active, locale]);

	return { interim, supported: dictationSupported() };
}
