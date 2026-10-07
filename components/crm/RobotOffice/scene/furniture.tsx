import React from "react";
import { C, GRID_D, GRID_W, P, WALL_H, pt, tone, type RoomDef } from "./iso";
import { COFFEE, LOUNGE, SERVER } from "./layout";
import { ZONE_LIGHT } from "./defs";
import { IsoBox, Plane, Shadow } from "./prims";

// Крупные части открытого офиса: пол-плита с неоновой подсветкой, стеклянные стены, зоны (коврики с голографической вывеской),
// кофе-пойнт, диван, серверный шкаф. Рисуется «снизу вверх»: пол → зоны → предметы по глубине.

export function FloorSlab() {
	const top = [P(0, 0), P(GRID_W, 0), P(GRID_W, GRID_D), P(0, GRID_D)].join(" ");
	const T = 12;
	const frontL = [P(0, GRID_D, 0), P(GRID_W, GRID_D, 0), P(GRID_W, GRID_D, -T), P(0, GRID_D, -T)].join(" ");
	const frontR = [P(GRID_W, 0, 0), P(GRID_W, GRID_D, 0), P(GRID_W, GRID_D, -T), P(GRID_W, 0, -T)].join(" ");
	const tiles: React.ReactNode[] = [];
	for (let i = 0; i < GRID_W; i += 2) for (let j = 0; j < GRID_D; j += 2) if (((i + j) / 2) % 2 === 0) tiles.push(<polygon key={`${i}-${j}`} points={[P(i, j), P(i + 2, j), P(i + 2, j + 2), P(i, j + 2)].join(" ")} />);
	const lines: React.ReactNode[] = [];
	for (let i = 2; i < GRID_W; i += 2) lines.push(<line key={`a${i}`} x1={pt(i, 0)[0]} y1={pt(i, 0)[1]} x2={pt(i, GRID_D)[0]} y2={pt(i, GRID_D)[1]} />);
	for (let j = 2; j < GRID_D; j += 2) lines.push(<line key={`b${j}`} x1={pt(0, j)[0]} y1={pt(0, j)[1]} x2={pt(GRID_W, j)[0]} y2={pt(GRID_W, j)[1]} />);
	const edge = [P(0, GRID_D, 0), P(GRID_W, GRID_D, 0), P(GRID_W, 0, 0)].join(" ");
	const edgeLow = [P(0, GRID_D, -T), P(GRID_W, GRID_D, -T), P(GRID_W, 0, -T)].join(" ");
	return (
		<g>
			{/* свечение под плитой: плита «парит» над тёмным фоном */}
			<polygon points={[P(-0.5, -0.5, -T - 4), P(GRID_W + 1, -0.5, -T - 4), P(GRID_W + 1, GRID_D + 1, -T - 4), P(-0.5, GRID_D + 1, -T - 4)].join(" ")} fill="#c6ff4d" opacity="0.22" filter="url(#f-bloom)" />
			<polygon points={frontL} fill="#161c18" />
			<polygon points={frontR} fill="#0f1411" />
			<polygon points={top} fill="url(#g-floor)" />
			<g fill="rgba(255,255,255,0.06)">{tiles}</g>
			<g stroke="rgba(255,255,255,0.045)" strokeWidth="1">{lines}</g>
			<polygon points={top} fill="url(#g-sheen)" />
			<polyline points={edge} fill="none" stroke="#c6ff4d" strokeOpacity="0.8" strokeWidth="1.6" strokeLinejoin="round" filter="url(#f-glow)" />
			<polyline points={edgeLow} fill="none" stroke="#c6ff4d" strokeOpacity="0.5" strokeWidth="1.2" strokeLinejoin="round" filter="url(#f-glow)" />
		</g>
	);
}

/** Задние стеклянные стены всего офиса (по двум дальним сторонам), окна с огнями города и настенные экраны. */
export function BackWalls() {
	const t = 0.25;
	const wall = { top: C.wallTop, left: C.wallL, right: C.wallR };
	const colsB = Array.from({ length: GRID_W / 2 - 1 }, (_, i) => (i + 1) * 2);
	const colsL = Array.from({ length: GRID_D / 2 - 1 }, (_, i) => (i + 1) * 2);
	const glassB = [P(0.3, 0, 8), P(GRID_W - 0.3, 0, 8), P(GRID_W - 0.3, 0, WALL_H - 6), P(0.3, 0, WALL_H - 6)].join(" ");
	const glassL = [P(0, 0.3, 8), P(0, GRID_D - 0.3, 8), P(0, GRID_D - 0.3, WALL_H - 6), P(0, 0.3, WALL_H - 6)].join(" ");
	return (
		<g>
			<IsoBox x={-t} y={-t} w={t} d={GRID_D + t} h={WALL_H} c={wall} />
			<IsoBox x={0} y={-t} w={GRID_W} d={t} h={WALL_H} c={wall} />
			<polygon points={glassB} fill="url(#g-glass)" stroke="rgba(255,255,255,0.12)" />
			<polygon points={glassL} fill="url(#g-glass)" stroke="rgba(255,255,255,0.10)" />
			<g stroke="rgba(255,255,255,0.10)">
				{colsB.map((x) => <line key={`b${x}`} x1={pt(x, 0, 8)[0]} y1={pt(x, 0, 8)[1]} x2={pt(x, 0, WALL_H - 6)[0]} y2={pt(x, 0, WALL_H - 6)[1]} />)}
				{colsL.map((y) => <line key={`l${y}`} x1={pt(0, y, 8)[0]} y1={pt(0, y, 8)[1]} x2={pt(0, y, WALL_H - 6)[0]} y2={pt(0, y, WALL_H - 6)[1]} />)}
			</g>
			<g fill="#c6ff4d" opacity="0.45">
				{Array.from({ length: 26 }, (_, i) => { const [px, py] = pt(0.8 + ((i * 53) % 97) / 97 * (GRID_W - 1.6), 0, 12 + ((i * 29) % 31)); return <circle key={i} cx={px} cy={py} r="0.9" />; })}
			</g>
			<polyline points={[P(-t, GRID_D, WALL_H), P(-t, -t, WALL_H), P(GRID_W, -t, WALL_H)].join(" ")} fill="none" stroke="#c6ff4d" strokeWidth="1.6" strokeOpacity="0.9" strokeLinejoin="round" filter="url(#f-glow)" />
			<polyline points={[P(0, GRID_D, 1.5), P(0, 0, 1.5), P(GRID_W, 0, 1.5)].join(" ")} fill="none" stroke="#c6ff4d" strokeWidth="1.1" strokeOpacity="0.5" strokeLinejoin="round" />
			{/* настенные экраны над зонами: графики */}
			{[4.2, 20.2].map((x, k) => (
				<Plane key={x} x={x} y={t * 0 + 0.02} z={26}>
					<rect x="0" y="0" width="58" height="26" rx="2" fill="#07110b" stroke="rgba(198,255,77,0.7)" filter="url(#f-glow)" />
					{k === 0 ? [8, 14, 10, 18, 13].map((h, i) => <rect key={i} className="sc-bar" style={{ animationDelay: `${i * 0.2}s` }} x={6 + i * 10} y={22 - h} width="6" height={h} fill={i % 2 ? "#2DDEB6" : "#c6ff4d"} opacity="0.85" />) : <polyline className="sc-line" points="5,19 16,12 26,15 38,7 53,4" fill="none" stroke="#c6ff4d" strokeWidth="1.6" />}
				</Plane>
			))}
		</g>
	);
}

/** Зона: цветной коврик-«остров» на полу. Принимает перетаскиваемого робота (data-drop-zone). */
export function ZonePad({ room, hot, live, count }: { room: RoomDef; hot: boolean; live: boolean; count: number }) {
	const { x, y, w, d, zone } = room;
	const col = ZONE_LIGHT[zone];
	const poly = [P(x + 0.25, y + 0.3), P(x + w - 0.25, y + 0.3), P(x + w - 0.25, y + d - 0.25), P(x + 0.25, y + d - 0.25)].join(" ");
	return (
		<g>
			<polygon points={poly} fill={col} opacity={hot ? 0.3 : 0.07} />
			<polygon points={poly} fill={`url(#pool-${zone})`} opacity={live ? 1 : 0.6} />
			<polygon points={poly} fill="none" stroke={hot ? "#c6ff4d" : col} strokeOpacity={hot ? 1 : live ? 0.8 : 0.45} strokeWidth={hot ? 2 : 1.4} strokeDasharray={hot ? "7 5" : undefined} strokeLinejoin="round" filter="url(#f-glow)" />
			<polygon data-drop-zone={zone} points={poly} fill="transparent" />
			{count === 0 && <text x={pt(x + w / 2, y + d / 2)[0]} y={pt(x + w / 2, y + d / 2)[1] + 4} textAnchor="middle" fontSize="11" fill={col} opacity="0.5" style={{ pointerEvents: "none" }}>＋</text>}
		</g>
	);
}

/** Голографическая вывеска зоны: парит над задним краем коврика. */
export function ZoneSign({ room, label, count, hot }: { room: RoomDef; label: string; count: number; hot: boolean }) {
	const col = hot ? "#c6ff4d" : ZONE_LIGHT[room.zone];
	const [sx, sy] = pt(room.x + room.w / 2, room.y + 0.3, 0);
	const text = count > 0 ? `${label} · ${count}` : label;
	const w = Math.max(76, text.length * 7 + 28);
	return (
		<g transform={`translate(${sx.toFixed(1)} ${(sy - 46).toFixed(1)})`} style={{ pointerEvents: "none" }} className="sc-float">
			<line x1="0" y1="11" x2="0" y2="46" stroke={col} strokeOpacity="0.5" strokeDasharray="2 3" />
			<rect x={-w / 2} y={-11} width={w} height={22} rx={11} fill="rgba(10,14,12,0.88)" stroke={col} strokeWidth="1.1" filter="url(#f-glow)" />
			<circle cx={-w / 2 + 11} cy={0} r={3} fill={col} />
			<text x={-w / 2 + 20} y={4} fontSize="11.5" fontWeight="600" fill="#eef3e8" letterSpacing="0.3">{text}</text>
		</g>
	);
}

/** Кофе-пойнт: длинная стойка, кофемашина с дисплеем, чашки, полка с бутылками на стене. */
export function CoffeeBar() {
	const { x, y, w, d } = COFFEE;
	const body = tone("#303a34");
	return (
		<g>
			<Shadow x={x} y={y} w={w} d={d} o={0.5} />
			<IsoBox x={x} y={y} w={w} d={d} h={14} c={body} />
			<Plane x={x} y={y + d} z={14}>
				{Array.from({ length: Math.round(w) }, (_, i) => <rect key={i} x={3 + i * 32} y="3" width="26" height="9" rx="1.5" fill="none" stroke="rgba(255,255,255,0.08)" />)}
				<rect x="3" y="12.3" width={w * 32 - 6} height="1.4" fill="#c6ff4d" opacity="0.5" />
			</Plane>
			<IsoBox x={x - 0.03} y={y - 0.03} z={14} w={w + 0.06} d={d + 0.06} h={2.2} c={tone("#e9eee5")} edge="rgba(198,255,77,0.6)" />
			{/* кофемашина */}
			<IsoBox x={x + 0.45} y={y + 0.15} z={16.2} w={1.0} d={0.7} h={13} c={C.dark} edge="rgba(198,255,77,0.55)" />
			<Plane x={x + 0.45} y={y + 0.85} z={29}><rect x="3" y="2" width="26" height="5" rx="1" fill="#06140c" /><rect className="sc-pulse" x="5" y="3.6" width="10" height="1.8" fill="#c6ff4d" /><circle cx="24" cy="4.5" r="1.4" fill="#2DDEB6" /><rect x="11" y="7.6" width="10" height="3.5" rx="0.8" fill="rgba(255,255,255,0.22)" /></Plane>
			{[1.8, 2.15, 2.5].map((dx) => <IsoBox key={dx} x={x + dx} y={y + 0.4} z={16.2} w={0.2} d={0.2} h={3.4} c={tone("#f1f4ee")} />)}
			<IsoBox x={x + 2.85} y={y + 0.3} z={16.2} w={0.4} d={0.4} h={5} c={tone("#2d3a32")} edge="rgba(45,222,182,0.6)" />
			{/* стеклянная полка над стойкой */}
			<IsoBox x={x + 0.2} y={y - 0.02} z={36} w={w - 0.4} d={0.2} h={1} c={C.metal} />
			{[0.5, 1.1, 1.7, 2.3].map((dx, i) => <IsoBox key={dx} x={x + dx} y={y} z={37} w={0.22} d={0.22} h={7 + (i % 2) * 2} c={tone(i % 2 ? "#2DDEB6" : "#c6ff4d")} />)}
		</g>
	);
}

/** Диван с низкой спинкой с задней стороны и журнальный столик. */
export function Lounge() {
	const { sofa, table } = LOUNGE;
	const fabric = tone("#3b4a41");
	return (
		<g>
			<Shadow x={sofa.x} y={sofa.y} w={sofa.w} d={sofa.d} o={0.45} />
			<IsoBox x={sofa.x} y={sofa.y} w={sofa.w} d={sofa.d} h={6} c={C.dark} />
			<IsoBox x={sofa.x + 0.02} y={sofa.y + 0.04} z={6} w={0.28} d={sofa.d - 0.08} h={11} c={fabric} edge="rgba(198,255,77,0.35)" />
			{[0, 1].map((i) => <IsoBox key={i} x={sofa.x + 0.3} y={sofa.y + 0.06 + i * ((sofa.d - 0.12) / 2)} z={6} w={sofa.w - 0.34} d={(sofa.d - 0.12) / 2 - 0.04} h={3.2} c={tone("#566a5d")} />)}
			<Shadow x={table.x} y={table.y} w={table.w} d={table.d} o={0.4} />
			<IsoBox x={table.x + 0.08} y={table.y + 0.08} w={0.08} d={0.08} h={6} c={C.metal} flat /><IsoBox x={table.x + table.w - 0.16} y={table.y + table.d - 0.16} w={0.08} d={0.08} h={6} c={C.metal} flat />
			<IsoBox x={table.x} y={table.y} z={6} w={table.w} d={table.d} h={1.6} c={tone("#e9eee5")} edge="rgba(198,255,77,0.55)" />
			<IsoBox x={table.x + 0.2} y={table.y + 0.3} z={7.6} w={0.2} d={0.2} h={3.2} c={tone("#c6ff4d")} />
		</g>
	);
}

/** Серверная: ряд стеклянных стоек с мигающими огнями у задней стены острова. */
export function ServerRoom() {
	const { x, y, w, d } = SERVER;
	const racks = Math.floor(w / 1.5);
	return (
		<g>
			<Shadow x={x} y={y} w={w} d={d} o={0.5} />
			{Array.from({ length: racks }, (_, i) => {
				const rx = x + i * (w / racks) + 0.1, rw = w / racks - 0.2;
				return (
					<g key={i}>
						<IsoBox x={rx} y={y} w={rw} d={d} h={46} c={C.dark} edge="rgba(45,222,182,0.5)" />
						<Plane x={rx} y={y + d} z={46}>
							{[0, 1, 2, 3, 4, 5, 6].map((k) => <g key={k}><rect x="3" y={3 + k * 5.7} width={rw * 32 - 6} height="4.2" rx="0.6" fill="#101813" /><circle className="sc-blink" style={{ animationDelay: `${(i * 7 + k) * 0.31}s` }} cx={rw * 32 - 7} cy={5 + k * 5.7} r="1.1" fill={(i + k) % 3 === 0 ? "#2DDEB6" : "#c6ff4d"} /><rect x="6" y={4.6 + k * 5.7} width={rw * 32 * 0.4} height="1.2" fill="rgba(255,255,255,0.14)" /></g>)}
						</Plane>
					</g>
				);
			})}
			<IsoBox x={x} y={y + d - 0.02} w={w} d={0.05} h={3} c={C.metal} edge="rgba(45,222,182,0.8)" />
		</g>
	);
}
