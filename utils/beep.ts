// Короткие сигналы без звуковых файлов (WebAudio). Браузер не даёт играть звук, пока пользователь не кликал
// по странице: звуковой контекст создаётся «спящим» (suspended). Мы будим его (resume) и, если разбудить
// не удалось, запоминаем сигнал и повторяем его при первом нажатии — один раз.

let ctx: AudioContext | null = null;
let missed: (() => void) | null = null; // сигнал, который не прозвучал: ждёт первого нажатия
let waiting = false; // слушатель pointerdown уже поставлен

interface Note { freq: number; at: number; dur: number; gain: number }

function audio(): AudioContext | null {
	try {
		if (!ctx) ctx = new AudioContext();
		return ctx;
	} catch {
		return null; // браузер без WebAudio
	}
}

function schedule(c: AudioContext, notes: Note[]) {
	const base = c.currentTime + 0.02;
	for (const note of notes) {
		const at = base + note.at;
		const osc = c.createOscillator();
		const gain = c.createGain();
		osc.type = "sine";
		osc.frequency.value = note.freq;
		gain.gain.setValueAtTime(0.0001, at);
		gain.gain.exponentialRampToValueAtTime(note.gain, at + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + note.dur);
		osc.connect(gain).connect(c.destination);
		osc.start(at);
		osc.stop(at + note.dur + 0.05);
	}
}

// Проигрывает запомненный сигнал, когда контекст наконец проснулся (повторный вызов ничего не делает)
function flush(c: AudioContext) {
	if (c.state !== "running") return;
	const run = missed;
	missed = null;
	run?.();
}

function wake(c: AudioContext) {
	void c.resume().then(() => flush(c)).catch(() => undefined);
}

function play(notes: Note[]) {
	const c = audio();
	if (!c) return;
	if (c.state === "running") {
		schedule(c, notes);
		return;
	}
	// страницу открыли, но по ней ещё не нажимали: сейчас сигнал не прозвучит — запоминаем и будим контекст
	missed = () => schedule(c, notes);
	wake(c);
	if (!waiting) {
		waiting = true;
		document.addEventListener("pointerdown", () => { waiting = false; wake(c); }, { once: true });
	}
}

// Гудок «срок подходит»: два коротких сигнала 880 Гц (дедлайны задач и сделок)
export function beep(times = 2) {
	play(Array.from({ length: times }, (_, i) => ({ freq: 880, at: i * 0.35, dur: 0.25, gain: 0.2 })));
}

// Перезвон «напоминание о событии календаря»: восходящие ноты — на слух отличается от гудка дедлайна
export function chime() {
	play([
		{ freq: 523.25, at: 0, dur: 0.35, gain: 0.16 }, // C5
		{ freq: 659.25, at: 0.16, dur: 0.35, gain: 0.16 }, // E5
		{ freq: 783.99, at: 0.32, dur: 0.5, gain: 0.18 }, // G5
	]);
}
