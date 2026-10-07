import React from "react";
import { C, P, SKEW, type Tone, pt } from "./iso";

// Простые «кирпичики» сцены: коробка в изометрии, плоскость экрана на лицевой грани, растения.

export function IsoBox({ x, y, z = 0, w, d, h, c, edge }: { x: number; y: number; z?: number; w: number; d: number; h: number; c: Tone; edge?: string }) {
	const zt = z + h;
	const top = [P(x, y, zt), P(x + w, y, zt), P(x + w, y + d, zt), P(x, y + d, zt)].join(" ");
	const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, zt), P(x, y + d, zt)].join(" "); // грань y-max (смотрит влево-вниз)
	const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, zt), P(x + w, y, zt)].join(" "); // грань x-max (смотрит вправо-вниз)
	return (
		<g>
			<polygon points={left} fill={c.left} />
			<polygon points={right} fill={c.right} />
			<polygon points={top} fill={c.top} />
			{edge && <polyline points={[P(x, y + d, zt), P(x + w, y + d, zt), P(x + w, y, zt)].join(" ")} fill="none" stroke={edge} strokeWidth="1" strokeLinejoin="round" />}
		</g>
	);
}

/** Плоскость на лицевой (y-max) грани: внутри рисуем обычными прямоугольниками, ось u — вдоль x, v — вниз. Начало — левый верхний угол грани. */
export function Plane({ x, y, z, children, className }: { x: number; y: number; z: number; children: React.ReactNode; className?: string }) {
	const [sx, sy] = pt(x, y, z);
	return <g className={className} transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) skewY(${SKEW})`}>{children}</g>;
}

/** Плоскость на правой (x-max) грани: u растёт вдоль y влево-вниз, поэтому содержимое зеркально — для надписей не годится. */
export function PlaneR({ x, y, z, children }: { x: number; y: number; z: number; children: React.ReactNode }) {
	const [sx, sy] = pt(x, y, z);
	return <g transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) skewY(${-SKEW}) scale(-1 1)`}>{children}</g>;
}

export function Plant({ x, y, big = false }: { x: number; y: number; big?: boolean }) {
	const [sx, sy] = pt(x, y, 0);
	const k = big ? 1.25 : 1;
	return (
		<g>
			<IsoBox x={x - 0.18} y={y - 0.18} w={0.36} d={0.36} h={9 * k} c={C.pot} />
			<g transform={`translate(${sx.toFixed(1)} ${(sy - 9 * k).toFixed(1)}) scale(${k})`}>
				<path d="M0 0 C-10 -6 -14 -18 -6 -26 C-2 -18 0 -10 0 0Z" fill={C.plant} opacity="0.95" />
				<path d="M0 0 C10 -6 14 -18 6 -26 C2 -18 0 -10 0 0Z" fill="#3a9560" opacity="0.95" />
				<path d="M0 0 C-3 -10 -2 -22 0 -32 C3 -22 3 -10 0 0Z" fill="#256b41" />
			</g>
		</g>
	);
}

/** Стопка бумаг: n листов с лёгким «беспорядком» по смещению. */
export function Papers({ x, y, z = 0, n = 3, w = 0.55, d = 0.7 }: { x: number; y: number; z?: number; n?: number; w?: number; d?: number }) {
	return (
		<g>
			{Array.from({ length: n }, (_, i) => (
				<IsoBox key={i} x={x + ((i * 37) % 5) * 0.012} y={y + ((i * 53) % 5) * 0.012} z={z + i * 1.1} w={w} d={d} h={1} c={C.paper} />
			))}
		</g>
	);
}

/** Табличка комнаты над задней стеной. */
export function RoomSign({ x, y, label, count, active }: { x: number; y: number; label: string; count: number; active: boolean }) {
	const [sx, sy] = pt(x, y, 0);
	const text = count > 0 ? `${label} · ${count}` : label;
	const w = Math.max(70, text.length * 7 + 22);
	return (
		<g transform={`translate(${sx.toFixed(1)} ${(sy - 62).toFixed(1)})`} style={{ pointerEvents: "none" }}>
			<rect x={-w / 2} y={-11} width={w} height={22} rx={11} fill="#0d110f" stroke={active ? "#c6ff4d" : "rgba(198,255,77,0.45)"} strokeWidth="1" />
			<circle cx={-w / 2 + 11} cy={0} r={3} fill={active ? "#c6ff4d" : "rgba(198,255,77,0.55)"} />
			<text x={-w / 2 + 20} y={4} fontSize="11.5" fontWeight="600" fill="#e6ecdf" letterSpacing="0.3">{text}</text>
		</g>
	);
}
