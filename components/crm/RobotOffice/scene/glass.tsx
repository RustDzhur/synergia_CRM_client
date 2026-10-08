import React from "react";
import { P, pt } from "./iso";

// Стекло и дуги: контуры на полу из точек (скруглённые прямоугольники, дуги), из которых «выдавливаются» стеклянные ленты с неоновой кромкой.
export type Pt = [number, number];

export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, steps = 10): Pt[] {
	const out: Pt[] = [];
	for (let i = 0; i <= steps; i++) { const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
	return out;
}

/** Скруглённый прямоугольник на полу, по часовой стрелке (на экране), начиная с задней стороны. */
export function roundedRect(x: number, y: number, w: number, d: number, r: number, steps = 8): Pt[] {
	return [
		...arcPts(x + r, y + r, r, 180, 270, steps), // задний левый угол
		...arcPts(x + w - r, y + r, r, 270, 360, steps),
		...arcPts(x + w - r, y + d - r, r, 0, 90, steps),
		...arcPts(x + r, y + d - r, r, 90, 180, steps),
	];
}

export const poly = (pts: Pt[], z = 0) => pts.map(([x, y]) => P(x, y, z)).join(" ");

/** Лента (стеклянная стена, экран) вдоль линии на полу от высоты z0 до z1. alt чередует яркость соседних граней — получается «гранёное» стекло. */
export function Band({ pts, z0 = 0, z1, fill = "url(#g-glass2)", edge, edgeOp = 0.95, baseEdge = true, posts = 0, closed = false, solid = false }: { pts: Pt[]; z0?: number; z1: number; fill?: string; edge?: string; edgeOp?: number; baseEdge?: boolean; posts?: number; closed?: boolean; solid?: boolean }) {
	const n = pts.length;
	const segs: [Pt, Pt][] = [];
	for (let i = 0; i < n - 1; i++) segs.push([pts[i], pts[i + 1]]);
	if (closed) segs.push([pts[n - 1], pts[0]]);
	segs.sort((a, b) => a[0][0] + a[0][1] + a[1][0] + a[1][1] - (b[0][0] + b[0][1] + b[1][0] + b[1][1]));
	const top = edge ? pts.map(([x, y]) => P(x, y, z1)).join(" ") : "";
	const bot = edge ? pts.map(([x, y]) => P(x, y, z0)).join(" ") : "";
	return (
		<g>
			{segs.map(([a, b], i) => {
				const q = [P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)].join(" ");
				return <g key={i}><polygon points={q} fill={fill} opacity={solid ? 1 : 0.75 + ((i * 7) % 3) * 0.12} />{!solid && <polygon points={q} fill="url(#g-streak)" />}</g>;
			})}
			{edge && <polyline points={top} fill="none" stroke={edge} strokeOpacity={edgeOp} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" filter="url(#f-glow)" />}
			{edge && baseEdge && <polyline points={bot} fill="none" stroke={edge} strokeOpacity={edgeOp * 0.55} strokeWidth="1.1" strokeLinejoin="round" />}
			{posts > 0 && pts.filter((_, i) => i % posts === 0).map(([x, y], i) => { const [sx, sy0] = pt(x, y, z0), [, sy1] = pt(x, y, z1); return <line key={i} x1={sx} y1={sy0} x2={sx} y2={sy1} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />; })}
		</g>
	);
}

/** Угловой стеклянный «кронштейн» зоны: дуга и два плеча вдоль задней и боковой сторон. */
export function CornerGlass({ x, y, r = 1.5, armX = 3.4, armY = 3.2, h = 46, edge, flip = false }: { x: number; y: number; r?: number; armX?: number; armY?: number; h?: number; edge: string; flip?: boolean }) {
	const pts: Pt[] = flip
		? [[x - armX, y], ...arcPts(x - r, y + r, r, 270, 360, 10), [x, y + armY]]
		: [[x + armX, y], ...arcPts(x + r, y + r, r, 270, 180, 10), [x, y + armY]];
	return <Band pts={pts} z1={h} edge={edge} posts={5} />;
}

export const lineSteps = (x0: number, y0: number, x1: number, y1: number, step = 2): Pt[] => {
	const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
	return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n] as Pt);
};

/** Круглая тумба/платформа: боковая стенка, верхний эллипс. r — радиус в клетках. */
export function Cyl({ x, y, r, z = 0, h, side = "#2b362f", top = "#3a4a41", edge, glow = false }: { x: number; y: number; r: number; z?: number; h: number; side?: string; top?: string; edge?: string; glow?: boolean }) {
	const [cx, cy] = pt(x, y, z);
	const rx = r * 45.25, ry = r * 22.63;
	return (
		<g>
			<ellipse cx={cx} cy={cy + 1} rx={rx * 1.12} ry={ry * 1.15} fill="rgba(0,0,0,0.4)" filter="url(#f-soft)" />
			<path d={`M${cx - rx} ${cy} L${cx - rx} ${cy - h} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy - h} L${cx + rx} ${cy} A${rx} ${ry} 0 0 1 ${cx - rx} ${cy} Z`} fill={side} />
			<path d={`M${cx - rx} ${cy} L${cx - rx} ${cy - h} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy - h} L${cx + rx} ${cy} A${rx} ${ry} 0 0 1 ${cx - rx} ${cy} Z`} fill="url(#g-cyl)" />
			<ellipse cx={cx} cy={cy - h} rx={rx} ry={ry} fill={top} stroke={edge} strokeWidth={edge ? 1.5 : 0} filter={glow ? "url(#f-glow)" : undefined} />
		</g>
	);
}
