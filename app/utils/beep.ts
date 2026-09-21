// Короткий сигнал без звуковых файлов (WebAudio). Браузер может не разрешить звук, пока пользователь не кликал по странице — тогда молчим.
export function beep(times = 2) {
	try {
		const ctx = new AudioContext();
		for (let i = 0; i < times; i++) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const at = ctx.currentTime + i * 0.35;
			osc.frequency.value = 880;
			gain.gain.setValueAtTime(0.0001, at);
			gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
			osc.connect(gain).connect(ctx.destination);
			osc.start(at);
			osc.stop(at + 0.3);
		}
		setTimeout(() => ctx.close().catch(() => undefined), times * 400 + 300);
	} catch { /* нет AudioContext */ }
}
