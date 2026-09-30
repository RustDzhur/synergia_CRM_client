"use client";
import { useEffect, useRef } from "react";

// Живой шар голосового режима — «как у Джарвиса» из «Железного человека»: тёмная сфера, по которой
// ходят золотые волокна, вращаются тонкие дуги и проносятся искры. Цвет и скорость зависят от
// состояния: простой — тлеющее золото, слушаю — яркое и быстрое, думаю — светлое золото мелкой
// рябью, говорю — самое живое. Canvas 2D, без зависимостей; рисуется только пока компонент на экране.

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const PALETTE: Record<OrbState, { core: string; mid: string; rim: string; spark: string; speed: number; amp: number }> = {
	idle: { core: "#c9a25a", mid: "#8a662a", rim: "rgba(255,196,90,0.22)", spark: "rgba(255,214,120,0.55)", speed: 0.6, amp: 1.3 },
	listening: { core: "#ffd75e", mid: "#f0a92e", rim: "rgba(255,205,90,0.55)", spark: "rgba(255,235,170,0.95)", speed: 1.7, amp: 3.0 },
	thinking: { core: "#ffe9b0", mid: "#d9a94f", rim: "rgba(255,230,160,0.45)", spark: "rgba(255,240,200,0.85)", speed: 2.3, amp: 1.7 },
	speaking: { core: "#ffdf7a", mid: "#e08f1f", rim: "rgba(255,190,70,0.60)", spark: "rgba(255,240,180,1)", speed: 2.9, amp: 4.2 },
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
		// Искры: у каждой свой угол и радиус — по ним «проносится» золотая пыль, как в кадрах фильма
		const sparks = Array.from({ length: 7 }, (_, i) => ({ base: (i / 7) * Math.PI * 2, r: 0.52 + (i % 3) * 0.12, w: 0.5 + (i % 4) * 0.22, a: 0.35 + (i % 3) * 0.22 }));

		const draw = (now: number) => {
			const p = PALETTE[stateRef.current];
			const t = (now - started) / 1000;
			const c = size / 2;
			const base = size * 0.30;
			ctx.clearRect(0, 0, size, size);

			// Тёмная сфера-подложка: золото читается только на тёмном, как в фильме
			const disc = ctx.createRadialGradient(c, c, base * 0.1, c, c, size / 2 - 1);
			disc.addColorStop(0, "rgba(38,30,14,0.95)");
			disc.addColorStop(0.75, "rgba(22,17,8,0.92)");
			disc.addColorStop(1, "rgba(12,10,5,0.65)");
			ctx.fillStyle = disc;
			ctx.beginPath();
			ctx.arc(c, c, size / 2 - 1, 0, Math.PI * 2);
			ctx.fill();

			// Тёплое свечение состояния вокруг ядра
			const glow = ctx.createRadialGradient(c, c, base * 0.2, c, c, size / 2 - 1);
			glow.addColorStop(0, p.rim);
			glow.addColorStop(1, "rgba(0,0,0,0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(c, c, size / 2 - 1, 0, Math.PI * 2);
			ctx.fill();

			// Золотые «волокна» — тонкие линии на разных радиусах с медленным вращением узора;
			// заливкой они выглядели блином, линиями читаются как светящаяся паутина сферы
			const spin = t * (0.12 + p.speed * 0.05);
			const layers = [
				{ color: "#a06a1a", alpha: 0.5, k: 3, w: 1.1, a: p.amp * 1.15, bob: 0.32, lw: 1.8, spin: 1, roff: -9 },
				{ color: p.mid, alpha: 0.55, k: 4, w: 1.5, a: p.amp, bob: 0.3, lw: 1.3, spin: 0.8, roff: -3 },
				{ color: p.core, alpha: 0.95, k: 5, w: 2.0, a: p.amp * 0.72, bob: 0.22, lw: 1.4, spin: 1.25, roff: 3 },
				{ color: "#ffefc2", alpha: 0.5, k: 6, w: 2.8, a: p.amp * 0.5, bob: 0.18, lw: 0.8, spin: 1.6, roff: 9 },
			];
			for (const layer of layers) {
				ctx.beginPath();
				for (let i = 0; i <= 96; i++) {
					const th = (i / 96) * Math.PI * 2;
					const r = base + layer.roff
						+ Math.sin(th * layer.k + t * layer.w * p.speed + layer.k) * layer.a
						+ Math.sin(th * 2 - t * 1.1) * layer.a * layer.bob
						+ Math.sin(t * 0.9) * 0.6;
					const rot = th + spin * layer.spin * 0.25;
					const x = c + Math.cos(rot) * r;
					const y = c + Math.sin(rot) * r * 0.985;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.closePath();
				ctx.globalAlpha = layer.alpha;
				ctx.strokeStyle = layer.color;
				ctx.lineWidth = layer.lw;
				ctx.stroke();
			}
			ctx.globalAlpha = 1;

			// Объём сферы: к краю темнеет, как у стеклянного шара
			const vign = ctx.createRadialGradient(c, c, base * 0.45, c, c, size / 2 - 1);
			vign.addColorStop(0, "rgba(0,0,0,0)");
			vign.addColorStop(1, "rgba(6,5,2,0.6)");
			ctx.fillStyle = vign;
			ctx.beginPath();
			ctx.arc(c, c, size / 2 - 1, 0, Math.PI * 2);
			ctx.fill();

			// Раскалённое ядро: маленькая точка, по которой видно «сердце» ассистента
			const hot = ctx.createRadialGradient(c, c, 0, c, c, base * 0.55);
			hot.addColorStop(0, p.spark);
			hot.addColorStop(1, "rgba(0,0,0,0)");
			ctx.globalAlpha = 0.9;
			ctx.fillStyle = hot;
			ctx.beginPath();
			ctx.arc(c, c, base * 0.55, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;

			// Вращающиеся тонкие дуги — «кольца» Джарвиса; на слушании они крупнее и быстрее
			const ringSpeed = stateRef.current === "idle" ? 0.25 : 0.8;
			const rings = [
				{ r: base + p.amp + 4, len: 1.5, off: t * ringSpeed * 0.9, w: 1.1 },
				{ r: base + p.amp + 8.5, len: 0.9, off: -t * ringSpeed * 1.35 + 2, w: 0.8 },
			];
			ctx.strokeStyle = p.rim;
			for (const ring of rings) {
				ctx.lineWidth = ring.w;
				ctx.beginPath();
				ctx.arc(c, c, Math.min(ring.r, size / 2 - 1.5), ring.off, ring.off + ring.len);
				ctx.stroke();
			}

			// Искры по орбите: тлеющие точки, оживают со скоростью состояния
			for (const sp of sparks) {
				const ang = sp.base + t * sp.w * p.speed;
				const rr = base * (0.8 + sp.r * 0.55) + Math.sin(t * 1.7 + sp.base * 3) * 1.2;
				const x = c + Math.cos(ang) * rr;
				const y = c + Math.sin(ang) * rr;
				ctx.globalAlpha = sp.a * (0.6 + 0.4 * Math.sin(t * 2.3 + sp.base * 5));
				ctx.fillStyle = p.spark;
				ctx.beginPath();
				ctx.arc(x, y, Math.max(0.6, size * 0.014), 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;

			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, [size]);

	return <canvas ref={canvasRef} style={{ width: size, height: size }} className={className} aria-hidden />;
}
