"use client";
import { useEffect, useRef } from "react";

// Живой шар голосового режима («как у Джарвиса»): несколько слоёв синусоид дают эффект колышущейся
// воды, цвет и скорость зависят от состояния — слушаю (лаймовые волны), думаю (холодный синий),
// говорю (лайм с бирюзой), простой (приглушённый). Canvas 2D, без зависимостей; рисуется только
// пока компонент на экране.

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const PALETTE: Record<OrbState, { core: string; mid: string; rim: string; speed: number; amp: number }> = {
	idle: { core: "#8a9680", mid: "#5a6a4c", rim: "rgba(198,255,77,0.20)", speed: 0.6, amp: 1.4 },
	listening: { core: "#c6ff4d", mid: "#7ddc3f", rim: "rgba(198,255,77,0.45)", speed: 1.4, amp: 3.0 },
	thinking: { core: "#9fe8ff", mid: "#3fb0dc", rim: "rgba(96,196,255,0.40)", speed: 2.0, amp: 2.0 },
	speaking: { core: "#c6ff4d", mid: "#2DDEB6", rim: "rgba(45,222,182,0.50)", speed: 2.6, amp: 4.0 },
};

export default function VoiceOrb({ size = 52, state, className = "" }: { size?: number; state: OrbState; className?: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stateRef = useRef<OrbState>(state);
	stateRef.current = state;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
		canvas.width = size * dpr;
		canvas.height = size * dpr;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		let raf = 0;
		const started = performance.now();

		const draw = (now: number) => {
			const p = PALETTE[stateRef.current];
			const t = (now - started) / 1000;
			const c = size / 2;
			const base = size * 0.29;
			ctx.clearRect(0, 0, size, size);

			// Свечение вокруг шара — «дыхание» состояния
			const glowR = size / 2 - 1;
			const glow = ctx.createRadialGradient(c, c, base * 0.3, c, c, glowR);
			glow.addColorStop(0, p.rim);
			glow.addColorStop(1, "rgba(0,0,0,0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(c, c, glowR, 0, Math.PI * 2);
			ctx.fill();

			// Три слоя волн с разными частотами и фазами — «водичка»
			const layers = [
				{ color: p.mid, alpha: 0.45, k: 3, w: 1.3, a: p.amp, bob: 0.35 },
				{ color: p.core, alpha: 0.75, k: 4, w: 1.9, a: p.amp * 0.7, bob: 0.25 },
				{ color: "#0d120b", alpha: 0.28, k: 5, w: 2.6, a: p.amp * 0.5, bob: 0.2 },
			];
			for (const layer of layers) {
				ctx.beginPath();
				for (let i = 0; i <= 72; i++) {
					const th = (i / 72) * Math.PI * 2;
					const r = base
						+ Math.sin(th * layer.k + t * layer.w * p.speed + layer.k) * layer.a
						+ Math.sin(th * 2 - t * 1.1) * layer.a * layer.bob
						+ Math.sin(t * 0.9) * 0.6;
					const x = c + Math.cos(th) * r;
					const y = c + Math.sin(th) * r;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.closePath();
				ctx.globalAlpha = layer.alpha;
				ctx.fillStyle = layer.color;
				ctx.fill();
			}
			ctx.globalAlpha = 1;

			// Тонкое кольцо по краю — собранность формы
			ctx.beginPath();
			ctx.arc(c, c, base + p.amp + 3.5, 0, Math.PI * 2);
			ctx.lineWidth = 1;
			ctx.strokeStyle = p.rim;
			ctx.stroke();

			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, [size]);

	return <canvas ref={canvasRef} style={{ width: size, height: size }} className={className} aria-hidden />;
}
