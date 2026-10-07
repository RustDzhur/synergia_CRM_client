import React from "react";
import { C, tone } from "./iso";
import { IsoBox, Papers, Plane } from "./prims";

// Рабочие места по ролям. Стол занимает 2×1 клетки с левым верхним углом (x, y); работающий (on) — экран ярче, бумаги и детали движутся.
// Экраны рисуются плоскостью на лицевой грани монитора: внутри — обычные SVG-прямоугольники в пикселях (ширина w·32 − 4, высота 17).

const LIME = "#c6ff4d", TEAL = "#2DDEB6", AMBER = "#F4A100", RED = "#EB5757", GRAY = "rgba(255,255,255,0.28)", DIM = "rgba(255,255,255,0.14)";
const GREEN_TOP = 16.5; // высота столешницы

function Desk({ x, y, w = 2, h = 14 }: { x: number; y: number; w?: number; h?: number }) {
	return (
		<g>
			<IsoBox x={x} y={y} w={w} d={1} h={h} c={C.desk} />
			<Plane x={x} y={y + 1} z={h}>
				<rect x="3" y="2.5" width={w * 32 / 2 - 4} height={h - 5} rx="1.5" fill="none" stroke="rgba(255,255,255,0.07)" />
				<rect x={w * 32 / 2 + 1} y="2.5" width={w * 32 / 2 - 4} height={h - 5} rx="1.5" fill="none" stroke="rgba(255,255,255,0.07)" />
				<rect x={w * 32 / 4 - 5} y="6" width="10" height="1.8" rx="0.9" fill="rgba(198,255,77,0.35)" />
				<rect x={w * 32 * 0.75 - 5} y="6" width="10" height="1.8" rx="0.9" fill="rgba(198,255,77,0.35)" />
			</Plane>
			<IsoBox x={x - 0.04} y={y - 0.04} z={h} w={w + 0.08} d={1.08} h={2.5} c={C.deskTop} edge="rgba(198,255,77,0.55)" />
		</g>
	);
}

type Screen = (p: { sw: number; on: boolean }) => React.ReactNode;

function Monitor({ x, y, z = GREEN_TOP, w = 1.3, on, screen }: { x: number; y: number; z?: number; w?: number; on: boolean; screen: Screen }) {
	const sw = w * 32 - 4;
	return (
		<g>
			<IsoBox x={x + w / 2 - 0.14} y={y + 0.04} z={z} w={0.28} d={0.22} h={3} c={C.dark} />
			<IsoBox x={x} y={y} z={z + 3} w={w} d={0.1} h={21} c={C.dark} />
			<Plane x={x} y={y + 0.1} z={z + 24}>
				<rect x="2" y="2" width={sw} height="17" rx="1" fill={C.screen} />
				<g opacity={on ? 1 : 0.5} clipPath="url(#sc-clip)">{screen({ sw, on })}</g>
				{on && <rect x="2" y="2" width={sw} height="17" rx="1" fill="url(#sc-glow)" opacity="0.5" />}
			</Plane>
		</g>
	);
}

const Rows = ({ sw, rows, on }: { sw: number; rows: React.ReactNode[]; on: boolean }) => <g className={on ? "sc-scroll" : undefined}>{rows}<g transform={`translate(0 ${rows.length * 3.5})`}>{rows}</g><rect x="2" y="2" width={sw} height="0" /></g>;

const sheet: Screen = ({ sw, on }) => (
	<g>
		<rect x="3" y="3" width={sw - 2} height="3.2" fill={TEAL} opacity="0.85" />
		<g transform="translate(0 3)"><Rows sw={sw} on={on} rows={[0, 1, 2, 3].map((i) => <g key={i}><rect x="4" y={7 + i * 3.5} width={sw * 0.38} height="1.6" fill={GRAY} /><rect x={sw * 0.58} y={7 + i * 3.5} width={sw * (0.18 + (i % 3) * 0.07)} height="1.6" fill={i % 2 ? LIME : TEAL} /></g>)} /></g>
	</g>
);
const kanban: Screen = ({ sw }) => (
	<g>
		{[0, 1, 2].map((c) => <g key={c}><rect x={3 + c * (sw / 3)} y="3" width={sw / 3 - 3} height="2" fill={[LIME, TEAL, AMBER][c]} opacity="0.8" />{Array.from({ length: 3 - (c % 2) }, (_, r) => <rect key={r} x={3 + c * (sw / 3)} y={7 + r * 3.6} width={sw / 3 - 3} height="2.6" rx="0.6" fill={DIM} />)}</g>)}
	</g>
);
const list: Screen = ({ sw, on }) => (
	<g><Rows sw={sw} on={on} rows={[0, 1, 2, 3].map((i) => <g key={i}><circle cx="6" cy={6 + i * 3.5} r="1.2" fill={i % 3 === 0 ? RED : AMBER} /><rect x="10" y={5.2 + i * 3.5} width={sw * 0.5} height="1.6" fill={GRAY} /><rect x={sw * 0.76} y={5.2 + i * 3.5} width={sw * 0.16} height="1.6" fill={i % 3 === 0 ? RED : AMBER} opacity="0.8" /></g>)} /></g>
);
const bars: Screen = ({ sw, on }) => (
	<g>{[5, 9, 6, 12, 10, 14].map((h, i) => <rect key={i} className={on ? "sc-bar" : undefined} style={{ animationDelay: `${i * 0.15}s` }} x={5 + i * (sw - 8) / 6} y={17 - h} width={(sw - 8) / 6 - 2} height={h} fill={i % 2 ? TEAL : LIME} opacity="0.9" />)}</g>
);
const line: Screen = ({ sw }) => (
	<g><polyline points={`4,14 ${sw * 0.25},9 ${sw * 0.45},12 ${sw * 0.65},6 ${sw - 3},4`} fill="none" stroke={LIME} strokeWidth="1.2" /><polyline points={`4,15 ${sw * 0.3},13 ${sw * 0.55},14 ${sw * 0.8},10 ${sw - 3},9`} fill="none" stroke={TEAL} strokeWidth="1" opacity="0.7" /><rect x="3" y="3" width={sw * 0.3} height="1.5" fill={GRAY} /></g>
);
const checklist: Screen = ({ sw, on }) => (
	<g>{[0, 1, 2, 3].map((i) => <g key={i}><rect x="4" y={4 + i * 3.6} width="2.6" height="2.6" rx="0.5" fill="none" stroke={i < 2 ? LIME : GRAY} strokeWidth="0.7" />{i < 2 && <path d={`M4.6 ${5.3 + i * 3.6} l0.8 0.9 l1.3 -1.8`} stroke={LIME} strokeWidth="0.8" fill="none" className={on ? "sc-tick" : undefined} />}<rect x="9" y={4.6 + i * 3.6} width={sw * (0.62 - i * 0.08)} height="1.5" fill={i < 2 ? DIM : GRAY} /></g>)}</g>
);
const envelopes: Screen = ({ sw, on }) => (
	<g><Rows sw={sw} on={on} rows={[0, 1, 2, 3].map((i) => <g key={i}><rect x="4" y={4 + i * 3.5} width="4.2" height="2.8" rx="0.4" fill="none" stroke={i === 0 ? LIME : GRAY} strokeWidth="0.6" /><path d={`M4 ${4.2 + i * 3.5} l2.1 1.5 l2.1 -1.5`} fill="none" stroke={i === 0 ? LIME : GRAY} strokeWidth="0.5" /><rect x="10.5" y={4.8 + i * 3.5} width={sw * 0.55} height="1.5" fill={GRAY} /></g>)} /></g>
);
const profile: Screen = ({ sw }) => (
	<g><circle cx="9" cy="8" r="3.4" fill={DIM} /><circle cx="9" cy="7" r="1.3" fill={GRAY} /><rect x="15" y="5" width={sw * 0.5} height="2" fill={GRAY} /><rect x="15" y="9" width={sw * 0.35} height="1.6" fill={DIM} /><rect x="4" y="13.5" width={sw - 8} height="1.6" fill={DIM} /><rect x={sw - 14} y="3" width="9" height="2" rx="1" fill={LIME} opacity="0.8" /></g>
);
const growth: Screen = ({ sw, on }) => (
	<g><polyline className={on ? "sc-line" : undefined} points={`4,14 ${sw * 0.2},12 ${sw * 0.38},13 ${sw * 0.55},8 ${sw * 0.75},6 ${sw - 4},3`} fill="none" stroke={LIME} strokeWidth="1.3" /><circle cx={sw - 4} cy="3" r="1.4" fill={LIME} /><rect x="4" y="3" width="9" height="3" fill={AMBER} opacity="0.85" /><rect x="14" y="3.6" width="7" height="1.6" fill={GRAY} /></g>
);
const chat: Screen = ({ sw, on }) => (
	<g>{[0, 1, 2].map((i) => <rect key={i} className={on ? "sc-pop" : undefined} style={{ animationDelay: `${i * 0.5}s` }} x={i % 2 ? sw - 4 - sw * 0.5 : 4} y={3.5 + i * 4.6} width={sw * 0.5} height="3.4" rx="1.4" fill={i % 2 ? LIME : DIM} opacity={i % 2 ? 0.8 : 1} />)}</g>
);
const dashboard: Screen = ({ sw }) => (
	<g>{[0, 1, 2].map((i) => <rect key={i} x={3 + i * (sw / 3)} y="3" width={sw / 3 - 3} height="5" rx="0.8" fill={[LIME, TEAL, AMBER][i]} opacity="0.55" />)}<rect x="3" y="10" width={sw - 4} height="5.5" rx="0.8" fill={DIM} /><polyline points={`5,14.5 ${sw * 0.3},12 ${sw * 0.5},13 ${sw * 0.8},11`} fill="none" stroke={LIME} strokeWidth="0.9" /></g>
);
const table: Screen = ({ sw, on }) => (
	<g><Rows sw={sw} on={on} rows={[0, 1, 2, 3].map((i) => <g key={i}><rect x="4" y={4 + i * 3.5} width={sw * 0.3} height="1.6" fill={GRAY} /><rect x={sw * 0.42} y={4 + i * 3.5} width={sw * 0.18} height="1.6" fill={DIM} /><rect x={sw * 0.7} y={4 + i * 3.5} width={sw * 0.2} height="1.6" fill={i === 1 ? AMBER : TEAL} opacity="0.85" /></g>)} /></g>
);

/** Шестерёнка станка: вращается, когда робот работает. */
function Gear({ on, r = 6.5 }: { on: boolean; r?: number }) {
	return (
		<g className={on ? "sc-spin" : undefined} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
			<circle r={r} fill="none" stroke={LIME} strokeWidth="2.2" strokeDasharray="3.1 2.1" />
			<circle r={r - 2.6} fill={C.screen} stroke={LIME} strokeWidth="1" />
			<circle r="1.4" fill={LIME} />
		</g>
	);
}

const Mug = ({ x, y, z = GREEN_TOP }: { x: number; y: number; z?: number }) => <IsoBox x={x} y={y} z={z} w={0.17} d={0.17} h={3.4} c={tone("#e8ede4")} />;
const Box = ({ x, y, z = 0, w = 0.6, d = 0.6, h = 7, tape = true }: { x: number; y: number; z?: number; w?: number; d?: number; h?: number; tape?: boolean }) => (
	<g><IsoBox x={x} y={y} z={z} w={w} d={d} h={h} c={C.box} />{tape && <IsoBox x={x + w * 0.4} y={y - 0.002} z={z + h} w={w * 0.2} d={d + 0.004} h={0.4} c={tone("#c6ff4d")} />}</g>
);

export type StationKind = "accounting" | "sales" | "dunning" | "controlling" | "warehouse" | "purchasing" | "production" | "tasks" | "mail" | "hr" | "marketing" | "support" | "orders" | "generic";

/** Какое рабочее место у робота — по шаблону (у своих роботов — по главному навыку). */
export function kindOf(template: string, skills: string[]): StationKind {
	const known: StationKind[] = ["accounting", "sales", "dunning", "controlling", "warehouse", "purchasing", "production", "tasks", "mail", "hr", "marketing", "support", "orders"];
	if ((known as string[]).includes(template)) return template as StationKind;
	const by: [string, StationKind][] = [["production", "production"], ["stock", "warehouse"], ["purchasing", "purchasing"], ["invoices", "accounting"], ["finance", "controlling"], ["mail", "mail"], ["blog", "marketing"], ["hr", "hr"], ["crm", "sales"], ["tasks", "tasks"], ["quotes", "orders"]];
	return by.find(([s]) => skills.includes(s))?.[1] ?? "generic";
}

export function Station({ kind, x, y, on }: { kind: StationKind; x: number; y: number; on: boolean }) {
	const z = GREEN_TOP;
	switch (kind) {
		case "accounting":
			return (
				<g>
					<Desk x={x} y={y} /><Papers x={x + 0.05} y={y + 0.45} z={z} n={4} /><Papers x={x + 1.45} y={y + 0.5} z={z} n={2} />
					<Monitor x={x + 0.5} y={y + 0.12} on={on} screen={sheet} />
					<IsoBox x={x + 1.1} y={y + 0.62} z={z} w={0.3} d={0.36} h={2} c={C.dark} edge="rgba(198,255,77,0.5)" />
					{on && <g className="sc-shuffle"><IsoBox x={x + 0.78} y={y + 0.6} z={z + 4} w={0.5} d={0.66} h={0.9} c={C.paper} /></g>}
				</g>
			);
		case "sales":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.4} y={y + 0.12} on={on} screen={kanban} /><Mug x={x + 0.12} y={y + 0.62} />
					<IsoBox x={x + 1.55} y={y + 0.5} z={z} w={0.32} d={0.42} h={2.6} c={C.dark} /><IsoBox x={x + 1.57} y={y + 0.52} z={z + 2.6} w={0.28} d={0.1} h={1.4} c={tone("#c6ff4d")} />
				</g>
			);
		case "orders":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.4} y={y + 0.12} on={on} screen={table} /><Papers x={x + 1.5} y={y + 0.45} z={z} n={3} /><Papers x={x + 0.08} y={y + 0.6} z={z} n={2} />
					{on && <g className="sc-shuffle"><IsoBox x={x + 1.1} y={y + 0.62} z={z + 4} w={0.46} d={0.6} h={0.9} c={C.paper} /></g>}
				</g>
			);
		case "dunning":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.45} y={y + 0.12} on={on} screen={list} />
					<Papers x={x + 0.05} y={y + 0.5} z={z} n={4} /><IsoBox x={x + 1.5} y={y + 0.5} z={z} w={0.5} d={0.34} h={0.9} c={C.paper} edge="rgba(244,161,0,0.8)" /><IsoBox x={x + 1.55} y={y + 0.56} z={z + 0.9} w={0.5} d={0.34} h={0.9} c={C.paper} edge="rgba(244,161,0,0.8)" />
					{on && <g className="sc-shuffle"><IsoBox x={x + 1.0} y={y + 0.66} z={z + 4} w={0.46} d={0.58} h={0.9} c={C.paper} /></g>}
				</g>
			);
		case "controlling":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.08} y={y + 0.16} w={1.0} on={on} screen={bars} /><Monitor x={x + 1.05} y={y + 0.1} w={0.92} on={on} screen={line} />
					<Papers x={x + 0.3} y={y + 0.6} z={z} n={2} w={0.4} d={0.5} />
				</g>
			);
		case "warehouse":
			return (
				<g>
					{[0, 12, 24].map((zz) => <IsoBox key={zz} x={x} y={y} z={zz + 2} w={2.1} d={0.85} h={1.3} c={C.shelf} edge="rgba(198,255,77,0.28)" />)}
					{[[0, 0], [2.02, 0], [0, 0.77], [2.02, 0.77]].map(([dx, dy], i) => <IsoBox key={i} x={x + dx} y={y + dy} w={0.08} d={0.08} h={39} c={C.metal} />)}
					<Box x={x + 0.15} y={y + 0.12} z={3.3} w={0.55} d={0.6} h={8} /><Box x={x + 0.85} y={y + 0.15} z={3.3} w={0.5} d={0.55} h={6} /><Box x={x + 1.45} y={y + 0.1} z={3.3} w={0.5} d={0.62} h={8.5} />
					<Box x={x + 0.2} y={y + 0.14} z={15.3} w={0.5} d={0.58} h={7} /><Box x={x + 1.0} y={y + 0.12} z={15.3} w={0.8} d={0.6} h={6} tape={false} />
					<Box x={x + 0.5} y={y + 0.15} z={27.3} w={0.45} d={0.5} h={6} /><Box x={x + 1.2} y={y + 0.12} z={27.3} w={0.55} d={0.6} h={5} />
					<IsoBox x={x + 2.35} y={y + 0.15} w={0.95} d={0.9} h={2.4} c={C.shelf} /><Box x={x + 2.45} y={y + 0.2} z={2.4} w={0.45} d={0.5} h={7} /><Box x={x + 2.95 - 0.05} y={y + 0.35} z={2.4} w={0.3} d={0.4} h={5} />
					{on && <g className="sc-pulse"><IsoBox x={x + 0.9} y={y + 0.9} z={2.4} w={0.2} d={0.1} h={0.6} c={tone("#c6ff4d")} /></g>}
				</g>
			);
		case "purchasing":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.4} y={y + 0.12} on={on} screen={table} />
					<IsoBox x={x + 1.55} y={y + 0.5} z={z} w={0.32} d={0.42} h={2.6} c={C.dark} />
					<Box x={x + 2.2} y={y + 0.15} w={0.7} d={0.7} h={9} /><Box x={x + 2.3} y={y + 0.25} z={9} w={0.5} d={0.5} h={6} /><Box x={x + 2.3} y={y + 0.85} w={0.5} d={0.55} h={6} />
				</g>
			);
		case "production":
			return (
				<g>
					<Desk x={x} y={y} h={15} />
					<IsoBox x={x + 0.2} y={y + 0.12} z={17.5} w={1.0} d={0.75} h={12} c={C.dark} edge="rgba(198,255,77,0.6)" />
					<Plane x={x + 0.2} y={y + 0.87} z={29.5}><rect x="2" y="2" width="28" height="9" rx="1" fill={C.screen} /><g transform="translate(9 6.5) scale(0.62)"><Gear on={on} /></g><rect x="17" y="4" width="11" height="1.6" fill={GRAY} /><rect x="17" y="7" width="7" height="1.6" fill={on ? LIME : DIM} /></Plane>
					<IsoBox x={x + 1.35} y={y + 0.3} z={17.5} w={0.35} d={0.35} h={5} c={C.metal} /><IsoBox x={x + 1.52} y={y + 0.58} z={17.5} w={0.3} d={0.3} h={2.5} c={C.metal} />
					<IsoBox x={x + 2.15} y={y + 0.2} w={0.7} d={0.6} h={7} c={C.metal} edge="rgba(198,255,77,0.4)" />
				</g>
			);
		case "tasks":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.45} y={y + 0.12} on={on} screen={checklist} />
					{[[0.08, LIME], [0.36, AMBER], [1.62, TEAL]].map(([dx, col], i) => <IsoBox key={i} x={x + (dx as number)} y={y + 0.55 + (i % 2) * 0.1} z={z} w={0.24} d={0.24} h={0.5} c={tone(col as string)} />)}
					<Mug x={x + 1.7} y={y + 0.55} />
				</g>
			);
		case "mail":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.4} y={y + 0.12} on={on} screen={envelopes} />
					<IsoBox x={x + 1.5} y={y + 0.4} z={z} w={0.45} d={0.55} h={1.4} c={C.dark} /><Papers x={x + 1.54} y={y + 0.46} z={z + 1.4} n={3} w={0.36} d={0.42} />
					<IsoBox x={x + 2.2} y={y + 0.15} w={0.42} d={0.42} h={20} c={C.metal} /><IsoBox x={x + 2.3} y={y + 0.5} z={14} w={0.22} d={0.12} h={1.2} c={tone("#c6ff4d")} />
					{on && <g className="sc-shuffle"><IsoBox x={x + 0.95} y={y + 0.62} z={z + 4} w={0.4} d={0.5} h={0.8} c={C.paper} /></g>}
				</g>
			);
		case "hr":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.45} y={y + 0.12} on={on} screen={profile} />
					<IsoBox x={x + 1.5} y={y + 0.5} z={z} w={0.42} d={0.5} h={0.9} c={tone("#F4A100")} /><Papers x={x + 0.1} y={y + 0.55} z={z} n={2} />
					<IsoBox x={x + 2.2} y={y + 0.1} w={0.6} d={0.7} h={30} c={C.metal} />
					<Plane x={x + 2.2} y={y + 0.8} z={30}>{[0, 1, 2].map((i) => <g key={i}><rect x="2" y={2.5 + i * 9} width="17" height="7" rx="0.8" fill="none" stroke="rgba(255,255,255,0.18)" /><rect x="7.5" y={5 + i * 9} width="6" height="1.6" rx="0.8" fill="rgba(198,255,77,0.6)" /></g>)}</Plane>
				</g>
			);
		case "marketing":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.4} y={y + 0.12} on={on} screen={growth} />
					<IsoBox x={x + 2.05} y={y + 0.12} w={0.06} d={0.06} h={26} c={C.metal} /><IsoBox x={x + 2.95} y={y + 0.12} w={0.06} d={0.06} h={26} c={C.metal} />
					<IsoBox x={x + 2.0} y={y + 0.14} z={8} w={1.06} d={0.06} h={22} c={C.paper} />
					<Plane x={x + 2.0} y={y + 0.2} z={30}>{[0, 1, 2, 3].map((i) => <rect key={i} className={on ? "sc-bar" : undefined} style={{ animationDelay: `${i * 0.2}s` }} x={4 + i * 7} y={20 - [6, 11, 8, 15][i]} width="5" height={[6, 11, 8, 15][i]} fill={[TEAL, LIME, AMBER, LIME][i]} opacity="0.85" />)}<rect x="4" y="3" width="14" height="2" fill="rgba(0,0,0,0.22)" /></Plane>
				</g>
			);
		case "support":
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.4} y={y + 0.12} on={on} screen={chat} />
					<IsoBox x={x + 1.55} y={y + 0.55} z={z} w={0.34} d={0.34} h={1.6} c={C.dark} edge="rgba(198,255,77,0.7)" /><IsoBox x={x + 1.6} y={y + 0.6} z={z + 1.6} w={0.24} d={0.06} h={2.6} c={C.dark} />
					<Mug x={x + 0.12} y={y + 0.62} />
				</g>
			);
		default:
			return (
				<g>
					<Desk x={x} y={y} /><Monitor x={x + 0.45} y={y + 0.12} on={on} screen={dashboard} /><Papers x={x + 0.08} y={y + 0.55} z={z} n={2} /><Mug x={x + 1.6} y={y + 0.6} />
				</g>
			);
	}
}
