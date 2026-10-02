"use client";
import { authHeaders } from "@/store/crmApi";

// Озвучка Айрис в браузере: естественный голос с сервера (POST /api/ai/tts → mp3, нейронные голоса) и
// запасной синтез речи самого браузера, если сервер недоступен. Один движок на всю страницу: им пользуются
// и голосовое управление, и кнопка «Слушать» у ответа в чате — две озвучки одновременно не звучат.
//
// Как получается беглая речь: ответ режется на предложения, первое запрашивается сразу, следующие
// подгружаются, пока играет предыдущее — пауз между предложениями нет, а начало речи не ждёт весь ответ.

export type VoiceLang = "ru" | "uk" | "de" | "en";
export type VoiceGender = "f" | "m";
export const BCP47: Record<VoiceLang, string> = { ru: "ru-RU", uk: "uk-UA", de: "de-DE", en: "en-US" };
export const VOICE_LANGS: VoiceLang[] = ["ru", "uk", "de", "en"];

const GENDER_KEY = "ai.voice.gender";
export const readGender = (): VoiceGender => { try { return localStorage.getItem(GENDER_KEY) === "m" ? "m" : "f"; } catch { return "f"; } };
export const saveGender = (g: VoiceGender) => { try { localStorage.setItem(GENDER_KEY, g); } catch { /* приватный режим */ } };

/** Язык фразы по алфавиту и характерным буквам — для выбора голоса браузера; hint — язык, выбранный человеком. */
export function guessLang(text: string, hint?: VoiceLang): VoiceLang {
	const s = String(text ?? "");
	const letters = s.replace(/[^\p{L}]/gu, "");
	const cyr = (letters.match(/[Ѐ-ӿ]/g) ?? []).length;
	if (cyr > letters.length * 0.4) {
		if (/[іїєґ]/i.test(s) && !/[ыэъ]/i.test(s)) return "uk";
		if (/[ыэъ]/i.test(s)) return "ru";
		return hint === "uk" ? "uk" : "ru";
	}
	if (/[äöüß]/i.test(s)) return "de";
	return hint === "de" ? "de" : hint === "ru" || hint === "uk" ? hint : "en";
}

/** Предложения для потоковой озвучки: первое короткое (быстрый старт), остальные — пачками до max знаков. */
export function splitSentences(text: string, max = 240): string[] {
	const parts = String(text ?? "").replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
	const out: string[] = [];
	let cur = "";
	for (const p of parts) {
		if (cur && cur.length + p.length + 1 > max) { out.push(cur); cur = p; }
		else cur = cur ? `${cur} ${p}` : p;
		if (out.length === 0 && cur.length >= 50) { out.push(cur); cur = ""; } // начало речи не ждёт набора абзаца
	}
	if (cur) out.push(cur);
	// слишком длинное предложение режем по пробелам
	return out.flatMap((s) => {
		if (s.length <= max) return [s];
		const chunks: string[] = [];
		let rest = s;
		while (rest.length > max) {
			const at = rest.lastIndexOf(" ", max);
			const cut = at > max / 2 ? at : max;
			chunks.push(rest.slice(0, cut).trim());
			rest = rest.slice(cut).trim();
		}
		if (rest) chunks.push(rest);
		return chunks;
	});
}

/** Текст для чтения вслух: разметка и ссылки вслух звучали бы мусором. */
export function cleanForSpeech(text: string): string {
	return String(text ?? "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/^\s*[-*•]\s+/gm, "")
		.replace(/[*_#>|~]/g, " ")
		.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

// ── состояние движка ─────────────────────────────────────────────────────────────────────────────────
let token = 0; // номер текущей реплики: новая реплика или stop() делают старую недействительной
let speaking = false;
let blocked = false; // браузер не разрешил автовоспроизведение — нужен клик по странице
let serverEnabled = true;
let downUntil = 0; // сервер озвучки не ответил — какое-то время читаем голосом браузера
let abortCurrent: (() => void) | null = null;
let audioEl: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const subscribeSpeech = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const isSpeaking = () => speaking;
export const isAudioBlocked = () => blocked;
/** Серверная озвучка выключена на сервере (TTS_DISABLED) — тогда сразу читаем голосом браузера. */
export const configureSpeech = (o: { server?: boolean }) => { if (o.server !== undefined) serverEnabled = o.server; };

const setSpeaking = (v: boolean) => { if (speaking !== v) { speaking = v; notify(); } };
const getAudio = () => (audioEl ??= new Audio());

// Тихий wav: проигрывание его по клику «разблокирует» звук для последующих реплик без клика
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
let audioCtx: AudioContext | null = null;
/** Вызывать из обработчика клика/нажатия: снимает запрет браузера на автовоспроизведение. */
export function unlockAudio() {
	try {
		const a = getAudio();
		if (!a.src || a.paused) { a.src = SILENT_WAV; void a.play().then(() => { blocked = false; notify(); }).catch(() => undefined); }
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (AC) { audioCtx ??= new AC(); void audioCtx.resume().catch(() => undefined); }
	} catch { /* звук недоступен */ }
}

/** Короткий сигнал: «слышу» (две ноты вверх), «готово» (одна), «не вышло» (вниз). Без сети и без задержки. */
export function chime(kind: "wake" | "ok" | "err" = "wake") {
	try {
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AC) return;
		audioCtx ??= new AC();
		const ctx = audioCtx;
		void ctx.resume().catch(() => undefined);
		const notes = kind === "wake" ? [660, 880] : kind === "ok" ? [740] : [440, 330];
		notes.forEach((f, i) => {
			const t0 = ctx.currentTime + i * 0.11;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = f;
			gain.gain.setValueAtTime(0.0001, t0);
			gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
			osc.connect(gain).connect(ctx.destination);
			osc.start(t0);
			osc.stop(t0 + 0.18);
		});
	} catch { /* звук недоступен */ }
}

// ── сервер ───────────────────────────────────────────────────────────────────────────────────────────
async function fetchClip(text: string, lang: VoiceLang | undefined, gender: VoiceGender, speed?: number): Promise<Blob | null> {
	if (!serverEnabled || Date.now() < downUntil) return null;
	try {
		const res = await fetch("/api/ai/tts", { method: "POST", headers: authHeaders(), body: JSON.stringify({ text, lang, gender, speed }) });
		if (res.status === 503 || res.status === 404) { downUntil = Date.now() + 60_000; return null; } // сервис озвучки не работает
		if (!res.ok) return null;
		const blob = await res.blob();
		return blob.size > 400 ? blob : null;
	} catch {
		downUntil = Date.now() + 20_000; // нет сети — не дёргаем сервер на каждом предложении
		return null;
	}
}

function playBlob(blob: Blob): Promise<boolean> {
	return new Promise((resolve) => {
		const a = getAudio();
		const url = URL.createObjectURL(blob);
		let done = false;
		const finish = (ok: boolean) => {
			if (done) return;
			done = true;
			a.onended = null; a.onerror = null;
			abortCurrent = null;
			URL.revokeObjectURL(url);
			resolve(ok);
		};
		abortCurrent = () => { try { a.pause(); } catch { /* уже остановлен */ } finish(true); };
		a.onended = () => finish(true);
		a.onerror = () => finish(false);
		a.src = url;
		a.play().then(() => { if (blocked) { blocked = false; notify(); } }).catch((e: { name?: string }) => {
			if (e?.name === "NotAllowedError") { blocked = true; notify(); }
			finish(false);
		});
	});
}

// ── запасной голос браузера ──────────────────────────────────────────────────────────────────────────
const voiceScore = (v: SpeechSynthesisVoice, gender: VoiceGender) => {
	const n = v.name.toLowerCase();
	let s = 0;
	if (/natural|neural|online|premium|enhanced|google/.test(n)) s += 3; // самые «живые» из установленных
	if (!v.localService) s += 1;
	const female = /(female|woman|svetlana|milena|katya|irina|anna|polina|ostap|alena|samantha|victoria|katja|marie|helena|zira|aria|jenny|ava)/.test(n);
	const male = /(male|man|dmitry|yuri|pavel|maxim|daniel|thomas|stefan|killian|guy|andrew)/.test(n);
	if (gender === "f" && female) s += 1;
	if (gender === "m" && male) s += 1;
	return s;
};

function browserSpeak(text: string, lang: VoiceLang, gender: VoiceGender): Promise<void> {
	return new Promise((resolve) => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
		const u = new SpeechSynthesisUtterance(text.slice(0, 1000));
		u.lang = BCP47[lang];
		const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(lang));
		if (voices.length) u.voice = voices.sort((a, b) => voiceScore(b, gender) - voiceScore(a, gender))[0];
		let done = false;
		const finish = () => { if (done) return; done = true; abortCurrent = null; resolve(); };
		abortCurrent = () => { try { speechSynthesis.cancel(); } catch { /* уже остановлен */ } finish(); };
		u.onend = finish;
		u.onerror = finish;
		// некоторые голоса не присылают onend — не зависаем навсегда
		setTimeout(finish, 4000 + text.length * 110);
		speechSynthesis.speak(u);
	});
}

export interface SpeakOpts { lang?: VoiceLang; gender?: VoiceGender; speed?: number; onDone?: () => void }

/** Остановить речь немедленно (перебивание, «стоп», закрытие окна). */
export function stopSpeech() {
	token++;
	const abort = abortCurrent;
	abortCurrent = null;
	abort?.();
	try { if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* нечего останавливать */ }
	setSpeaking(false);
}

/** Произнести текст. Новая реплика обрывает предыдущую. Возвращается, когда речь закончилась или её прервали. */
export async function speakText(raw: string, opts: SpeakOpts = {}): Promise<void> {
	const clean = cleanForSpeech(raw);
	const sentences = splitSentences(clean).slice(0, 14);
	if (!sentences.length) return;
	stopSpeech();
	const my = token;
	const gender = opts.gender ?? readGender();
	const lang = guessLang(clean, opts.lang);
	setSpeaking(true);

	const clips: Promise<Blob | null>[] = [];
	const clip = (i: number) => (i < sentences.length ? (clips[i] ??= fetchClip(sentences[i], lang, gender, opts.speed)) : null);
	clip(0); clip(1);
	let finished = true;
	for (let i = 0; i < sentences.length; i++) {
		if (my !== token) { finished = false; break; }
		clip(i + 2); // пока играет это предложение, готовятся следующие
		const blob = await clip(i);
		if (my !== token) { finished = false; break; }
		const ok = blob ? await playBlob(blob) : false;
		if (my !== token) { finished = false; break; }
		if (!ok) await browserSpeak(sentences[i], lang, gender);
	}
	if (my === token) { setSpeaking(false); if (finished) opts.onDone?.(); }
}
