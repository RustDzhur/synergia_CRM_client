"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "@/store/crmApi";
import { type VoiceLang, guessLang, isSpeaking, speakText, stopSpeech, subscribeSpeech } from "./speech";

// Голос окна ассистента: диктовка вопроса (микрофон) и озвучка ответа.
//
// Оба пути — браузерные API (SpeechRecognition, MediaRecorder, speechSynthesis), поэтому ключей
// не требуют вовсе. На сервер уходит только запись — и только для браузеров без распознавания
// (Firefox, Safari), если серверная диктовка настроена (ключ OpenAI, см. /api/ai/transcribe).
// Диктовка ничего не выполняет сама: текст попадает в поле ввода, отправка — по кнопке, как и
// написано в правилах ассистента («действия — только после подтверждения»).

/** Язык для распознавания и синтеза речи: локаль интерфейса → тег BCP-47. */
export const speechLang = (locale: string) => (locale === "ua" || locale === "uk" ? "uk-UA" : locale === "de" ? "de-DE" : locale === "uz" ? "uz-UZ" : "en-US");

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

		// Путь 1: распознавание в браузере — без ключей и без сервера (Chrome, Edge, Android).
		// Узбекский: браузерная модель слабая, поэтому при настроенном сервере диктует он (модель лучше, словарь CRM — docs/UZ_VOICE.md)
		const Ctor = recognitionCtor();
		if (Ctor && !(locale === "uz" && serverStt && recorderSupported())) {
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

/** Язык озвучки по языку интерфейса — подсказка, окончательно язык определяется по самому тексту. */
export const voiceLangFor = (locale: string): VoiceLang => (locale === "ua" || locale === "uk" ? "uk" : locale === "de" ? "de" : locale === "uz" ? "uz" : "en");

// Озвучка ответов: естественный серверный голос, а если он недоступен — голос браузера (см. speech.ts)
export function useSpeechOutput(locale: string) {
	const [speakingId, setSpeakingId] = useState<string | null>(null);
	// Речь могла закончиться или быть прервана в другом месте (голосовое управление, «стоп»): метка «читается» гаснет вместе с ней
	useEffect(() => subscribeSpeech(() => { if (!isSpeaking()) setSpeakingId(null); }), []);

	const stop = useCallback(() => { stopSpeech(); setSpeakingId(null); }, []);

	const speak = useCallback((id: string, text: string, onDone?: () => void) => {
		const clean = stripForSpeech(text);
		if (!clean) return false;
		setSpeakingId(id);
		void speakText(clean.slice(0, 4000), { lang: guessLang(clean, voiceLangFor(locale)), onDone: () => { setSpeakingId((s) => (s === id ? null : s)); onDone?.(); } });
		return true;
	}, [locale]);

	// Закрытие окна/уход со страницы останавливает чтение
	useEffect(() => () => stopSpeech(), []);
	return { speak, stop, speakingId };
}

// ── Режим разговора (Джарвис) ────────────────────────────────────────────────────────────────────────

// Слова-ответы: голосом подтверждают или отменяют действие, командуют «стоп». Сравнение по словам,
// а не по вхождению подстроки — «нету планов» не должно читаться как «нет».
const YES_WORDS = ["ha", "xo‘p", "xop", "tasdiqlayman", "davom et", "o‘chir", "удаляй", "удали", "удалить", "чисти", "чисть", "очищай", "очисти", "очисть", "стирай", "убирай", "убери", "подтверждай", "продолжай", "вперёд", "вперед", "валяй", "разрешаю", "видаляй", "видали", "очисти", "löschen", "lösch", "delete", "remove", "clean", "confirm", "proceed", "отправляй", "отправь", "отправить", "выполни", "сделай", "надсилай", "надішли", "send", "go", "да", "давай", "подтверждаю", "подтверди", "согласен", "согласна", "выполняй", "делай", "хорошо", "конечно", "угу", "так", "ага", "ок", "окей", "добре", "гаразд", "підтверджую", "підтверди", "давай", "зроби", "виконуй", "yes", "ok", "okay", "confirm", "sure", "do it", "ja", "jep", "bestätige", "bestätigen", "mach"];
const NO_WORDS = ["yo‘q", "yoq", "bekor", "bekor qil", "kerak emas", "ні", "нет", "отмена", "отмени", "отбой", "не надо", "не нужно", "не делай", "ні", "no", "nein", "скасуй", "відміни", "відміна", "відбій", "не треба", "cancel", "stop it", "abbrechen", "стоп"];
const STOP_WORDS = ["стоп", "хватит", "замолчи", "тихо", "помолчи", "достатньо", "годі", "зупинись", "зупинитися", "stop", "halt", "стоп режим", "genug", "ruhe"];
// «Выключись» — отключить голосовое управление совсем (а «стоп» только прерывает речь)
const OFF_WORDS = ["выключись", "отключись", "вимкнись", "відключись", "ausschalten", "abschalten", "switch off", "turn off", "выключи голосовое управление", "отключи голосовое управление", "вимкни голосове керування"];

const words = (text: string) => String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);
const hasWord = (list: string[], text: string) => {
	const ws = words(text);
	return list.some((w) => (w.includes(" ") ? text.toLowerCase().includes(w) : ws.includes(w)));
};

/** Ответ «да» / «нет» в распознанной фразе; null — ни то ни другое. */
export function spokenAnswer(text: string): "yes" | "no" | null {
	// Ответом считается только короткая фраза: «создай задачу, да, на завтра» — это новая просьба, а не «да»
	if (words(text).length > 4) return null;
	if (hasWord(YES_WORDS, text)) return "yes";
	if (hasWord(NO_WORDS, text)) return "no";
	return null;
}

/** Команда «стоп» — выйти из режима разговора. */
export const isStopCommand = (text: string) => hasWord(STOP_WORDS, text);
/** Команда «выключись» — отключить голосовое управление. */
export const isOffCommand = (text: string) => OFF_WORDS.some((w) => text.toLowerCase().includes(w));

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

// ── Имя «Айрис» в фразе ──────────────────────────────────────────────────────────────────────────────
// Разговорный режим слушает постоянно — имя больше НЕ ворота: просьбу выполняем и без него (владелец:
// «пусть модель будет постоянно активная и слушающая»). Имя распознаём, чтобы снять его из текста
// («Айрис, створи задачу» → «створи задачу») и отозваться «Слухаю», если позвали только по имени.

const WAKE_WORDS = ["airis", "ayris", "айріс", "айрис", "эйрис", "ейрис", "арис", "ірис", "ирис", "iris", "ayres", "ayrus"];
// Для нечёткого сравнения (одна опечатка) — только длинные формы: короткие («ірис»/«iris» в 4 буквы)
// с допуском на опечатку ловили бы обычные слова («рис», «ира»). Точное совпадение коротких форм
// остаётся: «Ірис» как имя по-прежнему распознаётся
const WAKE_FUZZY = ["airis", "айріс", "айрис", "эйрис", "арис"];

// Расстояние Левенштейна ≤ 1: распознавание слышит имя по-разному («Айрс», «Айріз», «Ейріс») —
// одна опечатка допускается, две уже нет
function nearWord(word: string, target: string): boolean {
	if (Math.abs(word.length - target.length) > 1) return false;
	let i = 0, j = 0, edits = 0;
	while (i < word.length && j < target.length) {
		if (word[i] === target[j]) { i++; j++; continue; }
		if (++edits > 1) return false;
		if (word.length > target.length) i++;
		else if (word.length < target.length) j++;
		else { i++; j++; }
	}
	return edits + (word.length - i) + (target.length - j) <= 1;
}

const isWakeWord = (w: string) => WAKE_WORDS.includes(w) || (w.length >= 4 && WAKE_FUZZY.some((t) => nearWord(w, t)));

/** Имя во фразе: {hit — позвали, rest — сама просьба без имени}. */
export function stripWake(text: string): { hit: boolean; rest: string } {
	// распознавание иногда делит имя на два слова («ай рис», «ай ріс»)
	const raw = String(text ?? "").replace(/(?<![\p{L}\p{N}])(ай|эй|ей)\s+(рис|ріс)(?![\p{L}\p{N}])/giu, "$1$2");
	const ws = words(raw);
	if (!ws.some(isWakeWord)) return { hit: false, rest: raw.trim() };
	// Убираем только ПЕРВОЕ имя — в остальном тексте слово «айріс» может быть частью просьбы.
	// Границы слова — юникодные: \b в JavaScript знает только ASCII и с кириллицей не срабатывает.
	// Варианты с одной опечаткой снимаем тем же списком, что ловим (набор невелик)
	const variants = [...WAKE_WORDS, ...ws.filter((w) => !WAKE_WORDS.includes(w) && isWakeWord(w))];
	const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${variants.join("|")})(?![\\p{L}\\p{N}])[\\s,!.…—–-]*`, "giu");
	return { hit: true, rest: raw.replace(re, "").trim() };
}

// ── Перебивание голосом (как в голосовом режиме ChatGPT) ─────────────────────────────────────────────
// Пока ассистент говорит, микрофон приоткрыт ТОЛЬКО для измерения громкости: поток берётся с
// echoCancellation, чтобы голос ассистента из динамиков не считался речью человека. Как только
// человек заговорил (уровень устойчиво выше фонового), речь ассистента обрывается и слушание
// начинается заново — как в живом разговоре.

const BARGE_POLL_MS = 70;
const BARGE_FRAMES = 3; // ~210 мс устойчивой речи, чтобы кашель не перебивал
const BARGE_MIN_LEVEL = 0.045;

export function useBargeIn({ active, onDetect }: { active: boolean; onDetect: () => void }) {
	const onDetectRef = useRef(onDetect);
	onDetectRef.current = onDetect;
	useEffect(() => {
		if (!active) return;
		if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
		let disposed = false;
		let stream: MediaStream | null = null;
		let ctx: AudioContext | null = null;
		let timer: ReturnType<typeof setInterval> | null = null;
		const stop = () => {
			if (timer) { clearInterval(timer); timer = null; }
			stream?.getTracks().forEach((t) => t.stop());
			stream = null;
			void ctx?.close().catch(() => undefined);
			ctx = null;
		};
		void (async () => {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
				if (disposed) return stop();
				ctx = new AudioContext();
				const src = ctx.createMediaStreamSource(stream);
				const analyser = ctx.createAnalyser();
				analyser.fftSize = 512;
				src.connect(analyser);
				const data = new Float32Array(analyser.fftSize);
				const level = () => {
					analyser.getFloatTimeDomainData(data);
					let sum = 0;
					for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
					return Math.sqrt(sum / data.length);
				};
				// Первые кадры — фон: так порог подстраивается под комнату и под остаток эха динамиков
				let baseline = 0;
				for (let i = 0; i < 5; i++) { baseline += level(); await new Promise((r) => setTimeout(r, 40)); }
				baseline /= 5;
				const threshold = Math.max(BARGE_MIN_LEVEL, baseline * 2.5);
				let loud = 0;
				timer = setInterval(() => {
					if (disposed) return;
					const l = level();
					loud = l > threshold ? loud + 1 : 0;
					if (loud >= BARGE_FRAMES) {
						stop();
						onDetectRef.current();
					}
				}, BARGE_POLL_MS);
			} catch {
				stop(); // без микрофона перебивание недоступно — остаётся кнопка
			}
		})();
		return () => { disposed = true; stop(); };
	}, [active]);
}

/**
 * Непрерывное слушание для режима разговора: распознаёт фразу и сам зовёт onPhrase, когда человек
 * замолчал: тишина 2 секунды — успевает договорить и подумать посреди фразы. Пока человек говорит, текст копится: даже если браузер сам
 * закончил сессию распознавания посреди длинной речи, уже сказанное не теряется (carryRef), а после паузы уходит одной фразой. Пока ассистент думает или
 * говорит, слушание выключено — микрофон не должен слышать собственный голос (перебивание голосом
 * делает useBargeIn). Живёт только на браузерном распознавании: серверный путь требует ручной
 * остановки записи, а «Джарвис» — это именно разговор без рук.
 */
export const SILENCE_MS = 2000; // пауза, после которой фраза считается законченной (владелец просил две секунды: длинные просьбы не обрываются)
export function useContinuousListening({ lang, active, onPhrase, onError }: {
	lang: string; // BCP47: ru-RU, uk-UA, de-DE, en-US — язык, на котором говорит человек (не обязательно язык интерфейса)
	active: boolean;
	onPhrase: (text: string) => void;
	onError: (code: MicError) => void;
}) {
	const [interim, setInterim] = useState("");
	const recogRef = useRef<RecognitionLike | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const phraseRef = useRef("");
	const carryRef = useRef(""); // уже сказанное до перезапуска движка браузером
	const sentRef = useRef(false);
	const onPhraseRef = useRef(onPhrase);
	const onErrorRef = useRef(onError);
	onPhraseRef.current = onPhrase;
	onErrorRef.current = onError;

	useEffect(() => {
		const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
		sentRef.current = false;
		phraseRef.current = "";
		carryRef.current = "";
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
		let restartDelay = 150;

		// Пауза означает конец фразы: отправляем её и останавливаем распознавание до следующего круга
		const arm = () => {
			clearTimer();
			timerRef.current = setTimeout(() => {
				const phrase = phraseRef.current.trim();
				if (!phrase || sentRef.current || disposed) return;
				sentRef.current = true;
				phraseRef.current = "";
				carryRef.current = "";
				setInterim("");
				try { recogRef.current?.stop(); } catch { /* уже остановлен */ }
				onPhraseRef.current(phrase);
			}, SILENCE_MS);
		};

		const startEngine = () => {
			if (disposed) return;
			const recog = new Ctor();
			recog.lang = lang;
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
				const heard = (finalText + interimText).trim();
				// после перезапуска движка браузером результаты начинаются с нуля — приклеиваем то, что было сказано раньше
				const shown = [carryRef.current, heard].filter(Boolean).join(" ").trim();
				// Итог приходит с задержкой — если за паузу он не успел, берём то, что уже распознано (промежуточный текст обычно точен)
				phraseRef.current = shown;
				setInterim(shown);
				if (shown) arm();
			};
			recog.onerror = (e) => {
				if (e?.error === "not-allowed" || e?.error === "service-not-allowed") onErrorRef.current("micDenied");
				// «network»: у браузерного распознавания нет связи со своим сервисом — не крутим перезапуск вхолостую
				else if (e?.error === "network") restartDelay = 3000;
			};
			// Браузер сам завершает сессию распознавания (тишина, лимит времени) — пока режим включён,
			// поднимаем заново. Важно и после отправки фразы: если запрос НЕ ушёл в чат (onPhrase решил
			// ничего не делать), active не меняется, эффект не перезапускается — раньше микрофон умирал
			// после первой же такой фразы, и ассистент «не просыпался» до конца сессии. Сбрасываем буфер
			// и продолжаем слушать; если ассистент ушёл думать/говорить, active станет false, эффект
			// остановит распознавание и сюда мы уже не вернёмся.
			recog.onend = () => {
				if (disposed) return;
				// сессию закончил браузер, а не пауза человека: накопленное не теряем, таймер паузы продолжает идти
				carryRef.current = sentRef.current ? "" : phraseRef.current;
				sentRef.current = false;
				if (!carryRef.current) phraseRef.current = "";
				const delay = restartDelay;
				restartDelay = 150;
				setTimeout(() => { if (!disposed) { try { recog.start(); } catch { /* перезапустим после следующего onend */ } } }, delay);
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
	}, [active, lang]);

	return { interim, supported: dictationSupported() };
}

/**
 * Слушание разговора через сервер (для узбекского): браузерное распознавание узбекского слабое, поэтому речь записывается здесь,
 * граница фразы определяется по громкости (как в useBargeIn), запись уходит на /api/ai/transcribe и фраза приходит текстом.
 * Контракт тот же, что у useContinuousListening: onPhrase зовётся один раз на фразу, interim непустой, пока человек говорит.
 */
const SRV_MIN_LEVEL = 0.014; // ниже — тишина комнаты
const SRV_SILENCE_MS = 1500; // пауза, после которой фраза закончена
const SRV_MIN_SPEECH_MS = 450; // короче — щелчок или кашель, не фраза
const SRV_MAX_MS = 30_000;
export function useServerListening({ lang, active, onPhrase, onError }: {
	lang: string; // язык речи: ru, uk, de, en, uz
	active: boolean;
	onPhrase: (text: string) => void;
	onError: (code: MicError) => void;
}) {
	const [interim, setInterim] = useState("");
	const onPhraseRef = useRef(onPhrase);
	const onErrorRef = useRef(onError);
	onPhraseRef.current = onPhrase;
	onErrorRef.current = onError;

	useEffect(() => {
		setInterim("");
		if (!active || !recorderSupported()) return;
		let disposed = false;
		let stream: MediaStream | null = null;
		let ctx: AudioContext | null = null;
		let timer: ReturnType<typeof setInterval> | null = null;
		let recorder: MediaRecorder | null = null;
		const cleanup = () => {
			if (timer) { clearInterval(timer); timer = null; }
			try { recorder?.state === "recording" && recorder.stop(); } catch { /* уже остановлен */ }
			stream?.getTracks().forEach((t) => t.stop());
			stream = null;
			void ctx?.close().catch(() => undefined);
			ctx = null;
		};
		void (async () => {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
			} catch {
				if (!disposed) onErrorRef.current("micDenied");
				return;
			}
			if (disposed) return cleanup();
			ctx = new AudioContext();
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 1024;
			ctx.createMediaStreamSource(stream).connect(analyser);
			const data = new Float32Array(analyser.fftSize);
			const level = () => {
				analyser.getFloatTimeDomainData(data);
				let sum = 0;
				for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
				return Math.sqrt(sum / data.length);
			};
			let baseline = 0;
			for (let i = 0; i < 6; i++) { baseline += level(); await new Promise((r) => setTimeout(r, 40)); }
			baseline /= 6;
			const threshold = Math.max(SRV_MIN_LEVEL, baseline * 3);

			let chunks: Blob[] = [];
			let startedAt = 0;
			let lastLoud = 0;
			let loudFrames = 0;
			let sending = false;

			const send = async (blob: Blob, spokenMs: number) => {
				if (spokenMs < SRV_MIN_SPEECH_MS || !blob.size) return;
				sending = true;
				try {
					const body = new FormData();
					body.append("file", blob, `voice.${voiceExt(blob.type || "audio/webm")}`);
					body.append("language", lang);
					const res = await fetch("/api/ai/transcribe", { method: "POST", headers: authHeaders(false), body });
					const json = (await res.json().catch(() => null)) as { text?: string } | null;
					if (disposed) return;
					if (!res.ok || !json) onErrorRef.current("micFailed");
					else if (json.text?.trim()) onPhraseRef.current(json.text.trim());
				} catch {
					if (!disposed) onErrorRef.current("micFailed");
				} finally {
					sending = false;
					if (!disposed) setInterim("");
				}
			};

			const begin = () => {
				chunks = [];
				recorder = new MediaRecorder(stream as MediaStream);
				recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
				const spokenFrom = Date.now();
				const rec = recorder;
				rec.onstop = () => { void send(new Blob(chunks, { type: rec.mimeType || "audio/webm" }), lastLoud - spokenFrom); };
				startedAt = spokenFrom;
				rec.start();
				setInterim("…"); // «слышу речь»: держит Айрис бодрствующей, пока человек говорит
			};

			timer = setInterval(() => {
				if (disposed || sending) return;
				const now = Date.now();
				const loud = level() > threshold;
				if (recorder?.state === "recording") {
					if (loud) lastLoud = now;
					if (now - lastLoud > SRV_SILENCE_MS || now - startedAt > SRV_MAX_MS) { try { recorder.stop(); } catch { /* уже остановлен */ } }
					return;
				}
				loudFrames = loud ? loudFrames + 1 : 0;
				if (loudFrames >= 2) { loudFrames = 0; lastLoud = now; begin(); }
			}, 50);
		})();
		return () => { disposed = true; cleanup(); setInterim(""); };
	}, [active, lang]);

	return { interim, supported: recorderSupported() };
}
