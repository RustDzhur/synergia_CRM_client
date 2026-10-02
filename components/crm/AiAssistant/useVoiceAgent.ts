"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type AiAction, type AiMessage, useAiStore } from "@/store/useAiStore";
import { BCP47, type VoiceGender, type VoiceLang, chime, isAudioBlocked, isSpeaking, readGender, saveGender, speakText, stopSpeech, subscribeSpeech, unlockAudio } from "./speech";
import { dictationSupported, isOffCommand, isStopCommand, stripWake, useBargeIn, useContinuousListening, voiceDecision, type MicError } from "./voice";

// Голосовое управление всем приложением («Привет, Айрис, открой бухгалтерию и покажи неоплаченные счета»).
//
// Микрофон слушает на любой странице кабинета, пока человек включил Айрис шаром в шапке. Чтобы она не
// реагировала на разговоры в комнате, фраза выполняется только если в ней прозвучало имя — или Айрис «бодрствует»:
// после имени и после каждого её ответа ещё AWAKE_MS можно говорить без имени (уточнения, «да»/«нет»).
// Включение — всегда явное (клик): браузер так требует для микрофона и звука; состояние запоминается, и после
// перезагрузки страницы слушание продолжается само.
//
// Что голос НЕ обходит: изменения данных по-прежнему требуют подтверждения. Айрис готовит действие и
// спрашивает «Подтверждаете?»; «да»/«нет» голосом (короткой фразой) или кнопкой на экране. Переходы по страницам
// и чтение данных подтверждения не требуют.

const ON_KEY = "ai.agent";
const LANG_KEY = "ai.agent.lang";
const WAKE_KEY = "ai.agent.wake";
const AUTO_KEY = "ai.auto"; // «выполнять без подтверждения» — включает сам человек
const AWAKE_MS = 20_000;
const AWAKE_CONFIRM_MS = 45_000;

// Короткие фразы самой Айрис — на языке, на котором с ней говорят (а не на языке интерфейса)
const PHRASES: Record<VoiceLang, { on: string; off: string; done: string; cancelled: string; ask: string; many: string; error: string }> = {
	ru: { on: "Голосовое управление включено. Скажите: Привет, Айрис.", off: "Хорошо, выключаюсь.", done: "Готово.", cancelled: "Отменено.", ask: "Подтверждаете?", many: "Здесь несколько действий — подтвердите нужное кнопкой на экране.", error: "Не получилось, попробуйте ещё раз." },
	uk: { on: "Голосове керування увімкнено. Скажіть: Привіт, Айріс.", off: "Добре, вимикаюсь.", done: "Готово.", cancelled: "Скасовано.", ask: "Підтверджуєте?", many: "Тут кілька дій — підтвердіть потрібну кнопкою на екрані.", error: "Не вийшло, спробуйте ще раз." },
	de: { on: "Die Sprachsteuerung ist an. Sagen Sie: Hallo, Iris.", off: "Okay, ich schalte mich aus.", done: "Erledigt.", cancelled: "Abgebrochen.", ask: "Soll ich das ausführen?", many: "Hier sind mehrere Aktionen – bitte bestätigen Sie die passende per Knopf.", error: "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal." },
	en: { on: "Voice control is on. Say: Hi, Iris.", off: "Okay, switching off.", done: "Done.", cancelled: "Cancelled.", ask: "Shall I go ahead?", many: "There are several actions — please confirm the right one with its button.", error: "That didn't work. Please try again." },
};

// «Привет», «эй», «слушай» перед именем — не просьба
const GREETING = /^(привет|приветик|эй|слушай|слышишь|ну|окей|ок|хай|привіт|слухай|гей|hey|hi|hello|ok|okay|hallo|hör|na)[\s,!.…]*$/iu;
const isGreetingOnly = (rest: string) => {
	const t = rest.trim();
	if (!t) return true;
	return t.split(/[\s,!.…]+/).filter(Boolean).every((w) => GREETING.test(w));
};

const defaultLang = (locale: string): VoiceLang => {
	const nav = (typeof navigator !== "undefined" ? navigator.language : "").toLowerCase();
	if (locale === "ua") return nav.startsWith("uk") ? "uk" : "ru"; // владелец говорит по-русски; украинский — одним нажатием в панели
	if (locale === "de") return "de";
	return nav.startsWith("ru") ? "ru" : "en";
};

export type AgentPhase = "off" | "sleeping" | "listening" | "thinking" | "speaking";

export function useVoiceAgent({ locale, page, blocked, onError }: { locale: string; page: string; blocked: boolean; onError: (code: MicError) => void }) {
	const { messages, busy, send, confirm, cancel } = useAiStore();
	const [supported, setSupported] = useState(false);
	const [enabled, setEnabledState] = useState(false);
	const [lang, setLangState] = useState<VoiceLang>("ru");
	const [gender, setGenderState] = useState<VoiceGender>("f");
	const [requireWake, setRequireWakeState] = useState(true);
	const [awake, setAwake] = useState(false);
	// Режим «без подтверждения»: сервер выполняет изменения сразу (кроме удаления и случаев, когда ассистент читал чужой текст)
	const [autoApprove, setAutoApproveState] = useState(false);
	const speaking = useSyncExternalStore(subscribeSpeech, isSpeaking, () => false);
	const audioBlocked = useSyncExternalStore(subscribeSpeech, isAudioBlocked, () => false);

	const awakeUntil = useRef(0);
	const awakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const spokenRef = useRef<string | null>(null);
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	// Настройки и поддержка браузера — только на клиенте: в разметке сервера этих данных нет
	useEffect(() => {
		const ok = dictationSupported();
		setSupported(ok);
		let on = false, savedLang: string | null = null, wake: string | null = null;
		try { on = localStorage.getItem(ON_KEY) === "1"; savedLang = localStorage.getItem(LANG_KEY); wake = localStorage.getItem(WAKE_KEY); } catch { /* приватный режим */ }
		setLangState((["ru", "uk", "de", "en"] as VoiceLang[]).includes(savedLang as VoiceLang) ? (savedLang as VoiceLang) : defaultLang(locale));
		setGenderState(readGender());
		setRequireWakeState(wake !== "0");
		try { setAutoApproveState(localStorage.getItem(AUTO_KEY) === "1"); } catch { /* приватный режим */ }
		if (ok && on) setEnabledState(true); // после перезагрузки продолжаем слушать
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Первый клик по странице снимает запрет браузера на автовоспроизведение (если слушание поднялось само после перезагрузки)
	useEffect(() => {
		if (!enabled) return;
		const unlock = () => unlockAudio();
		window.addEventListener("pointerdown", unlock, { once: true });
		window.addEventListener("keydown", unlock, { once: true });
		return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
	}, [enabled]);

	const armAwake = useCallback((ms: number) => {
		awakeUntil.current = Date.now() + ms;
		setAwake(true);
		if (awakeTimer.current) clearTimeout(awakeTimer.current);
		awakeTimer.current = setTimeout(() => { if (Date.now() >= awakeUntil.current) setAwake(false); }, ms + 60);
	}, []);
	const sleep = useCallback(() => {
		awakeUntil.current = 0;
		if (awakeTimer.current) clearTimeout(awakeTimer.current);
		setAwake(false);
	}, []);
	useEffect(() => () => { if (awakeTimer.current) clearTimeout(awakeTimer.current); }, []);

	const say = useCallback((text: string, then?: () => void) => {
		void speakText(text, { lang, gender, onDone: then });
	}, [lang, gender]);

	const setEnabled = useCallback((on: boolean, announce = true) => {
		setEnabledState(on);
		try { localStorage.setItem(ON_KEY, on ? "1" : "0"); } catch { /* приватный режим */ }
		if (on) {
			unlockAudio(); // это клик человека — звук разрешён
			spokenRef.current = (() => { const all = useAiStore.getState().messages; return all[all.length - 1]?.id ?? null; })(); // старые ответы не проговариваем
			armAwake(AWAKE_MS);
			if (announce) say(PHRASES[lang].on);
			else chime("ok");
		} else {
			stopSpeech();
			sleep();
		}
	}, [armAwake, lang, say, sleep]);
	const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled]);

	const setLang = (l: VoiceLang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* приватный режим */ } };
	const setGender = (g: VoiceGender) => { setGenderState(g); saveGender(g); };
	const setAutoApprove = (v: boolean) => { setAutoApproveState(v); try { localStorage.setItem(AUTO_KEY, v ? "1" : "0"); } catch { /* приватный режим */ } };
	const setRequireWake = (v: boolean) => { setRequireWakeState(v); try { localStorage.setItem(WAKE_KEY, v ? "1" : "0"); } catch { /* приватный режим */ } };

	const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
	const pending: AiAction[] = lastAssistant?.actions?.filter((a) => a.state === "pending") ?? [];
	const pendingRef = useRef({ msg: lastAssistant as AiMessage | undefined, pending });
	pendingRef.current = { msg: lastAssistant, pending };

	// Фраза, распознанная после паузы
	function handlePhrase(text: string) {
		const { hit, rest } = stripWake(text);
		const isAwake = Date.now() < awakeUntil.current;
		if (!hit && !isAwake && requireWake) return; // разговор не с Айрис — не реагируем
		const utterance = hit ? rest : text;
		const wordCount = utterance.trim().split(/\s+/).length;
		// «Выключись» и «стоп» — только короткой фразой: в длинной просьбе слово «стоп» может быть частью названия
		if (wordCount <= 6 && isOffCommand(utterance)) { setEnabled(false, false); say(PHRASES[lang].off); return; }
		if (wordCount <= 3 && isStopCommand(utterance)) { stopSpeech(); sleep(); return; }
		if (hit && isGreetingOnly(rest)) { stopSpeech(); armAwake(AWAKE_MS); chime("wake"); return; } // «Привет, Айрис» — слушаю дальше
		armAwake(AWAKE_MS);
		const { msg, pending: acts } = pendingRef.current;
		const decision = voiceDecision(utterance, acts.length);
		if (decision.kind === "confirm" && msg && acts[0]) {
			const target = msg.id, action = acts[0].id;
			void confirm(target, action).then(() => {
				const done = useAiStore.getState().messages.find((m) => m.id === target)?.actions?.find((a) => a.id === action)?.state === "done";
				chime(done ? "ok" : "err");
				say(done ? PHRASES[lang].done : PHRASES[lang].error, () => armAwake(AWAKE_MS));
			});
			return;
		}
		if (decision.kind === "cancel" && msg && acts[0]) {
			cancel(msg.id, acts[0].id);
			say(PHRASES[lang].cancelled, () => armAwake(AWAKE_MS));
			return;
		}
		if (decision.kind === "many") { say(PHRASES[lang].many, () => armAwake(AWAKE_MS)); return; }
		chime("wake");
		void send(utterance, { locale, page, voice: true, auto: autoApprove });
	}

	const listening = enabled && supported && !blocked && !busy && !speaking;
	const { interim } = useContinuousListening({
		lang: BCP47[lang],
		active: listening,
		onPhrase: handlePhrase,
		onError: (code) => { onErrorRef.current(code); setEnabled(false, false); },
	});

	// Перебивание голосом: пока Айрис говорит, микрофон измеряет громкость и обрывает речь, когда заговорил человек
	useBargeIn({ active: enabled && speaking, onDetect: () => { stopSpeech(); armAwake(AWAKE_MS); } });

	// Ответ на голосовую команду — вслух (+ «Подтверждаете?», если подготовлено действие)
	useEffect(() => {
		if (!enabled || !lastAssistant || !lastAssistant.voice || lastAssistant.id === spokenRef.current) return;
		spokenRef.current = lastAssistant.id;
		const acts = lastAssistant.actions?.filter((a) => a.state === "pending") ?? [];
		const body = lastAssistant.error ? PHRASES[lang].error : lastAssistant.text;
		const tail = lastAssistant.error ? "" : acts.length === 1 ? ` ${PHRASES[lang].ask}` : acts.length > 1 ? ` ${PHRASES[lang].many}` : "";
		armAwake(acts.length ? AWAKE_CONFIRM_MS : AWAKE_MS);
		void speakText(`${body}${tail}`, { lang, gender, onDone: () => armAwake(acts.length ? AWAKE_CONFIRM_MS : AWAKE_MS) });
	}, [lastAssistant, enabled, lang, gender, armAwake]);

	// Уход со страницы (или выход из кабинета) выключает микрофон и речь; сохранённое состояние остаётся — вернёмся и продолжим
	useEffect(() => () => stopSpeech(), []);

	const phase: AgentPhase = !enabled ? "off" : busy ? "thinking" : speaking ? "speaking" : awake ? "listening" : "sleeping";
	// Распознанное показываем, только когда обращаются к Айрис: чужие разговоры на экране не нужны
	const caption = awake || stripWake(interim).hit ? interim : "";
	return { supported, enabled, toggle, setEnabled, phase, caption, lang, setLang, gender, setGender, requireWake, setRequireWake, autoApprove, setAutoApprove, pending, lastAssistant, audioBlocked, awake };
}
