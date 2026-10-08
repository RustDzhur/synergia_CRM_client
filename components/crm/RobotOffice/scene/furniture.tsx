import React from "react";
import { TbBox, TbBuildingSkyscraper, TbCalculator, TbChartBar, TbHeadset, TbServer, TbSpeakerphone } from "react-icons/tb";
import { C, GRID_D, GRID_W, P, pt, tone, type RoomDef } from "./iso";
import { CELLS } from "./iso";
import { COFFEE, LOUNGE, SERVER } from "./layout";
import { ZONE_LIGHT } from "./defs";
import { Band, CornerGlass, Cyl, arcPts, lineSteps, poly, roundedRect, type Pt } from "./glass";
import { IsoBox, Plane, Shadow } from "./prims";

// Крупные части офиса: парящая плита со скруглёнными углами, изогнутые стеклянные стены с панорамой города, зоны-капсулы с дугами из стекла,
// кофе-пойнт с неоновой вывеской, лаунж с круглым столиком и дугой-диваном, серверная. Всё подсвечивается неоном.
const LIME = "#c6ff4d", TEAL = "#2DDEB6";
const FLOOR_R = 2.6;

const isNear = (a: Pt, b: Pt, c: Pt) => { const mx = (a[0] + b[0]) / 2 - c[0], my = (a[1] + b[1]) / 2 - c[1]; return mx + my > 0; };

export function FloorSlab() {
	const pts = roundedRect(0, 0, GRID_W, GRID_D, FLOOR_R, 8);
	const c: Pt = [GRID_W / 2, GRID_D / 2];
	const T = 12;
	const near: [Pt, Pt][] = [];
	for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (isNear(a, b, c)) near.push([a, b]); }
	const lines: React.ReactNode[] = [];
	for (let i = 2; i < GRID_W; i += 2) lines.push(<line key={`a${i}`} x1={pt(i, 0)[0]} y1={pt(i, 0)[1]} x2={pt(i, GRID_D)[0]} y2={pt(i, GRID_D)[1]} />);
	for (let j = 2; j < GRID_D; j += 2) lines.push(<line key={`b${j}`} x1={pt(0, j)[0]} y1={pt(0, j)[1]} x2={pt(GRID_W, j)[0]} y2={pt(GRID_W, j)[1]} />);
	return (
		<g>
			<defs><clipPath id="floor-clip"><polygon points={poly(pts)} /></clipPath></defs>
			<polygon points={poly(pts, -T - 6)} fill={LIME} opacity="0.28" filter="url(#f-bloom)" />
			{near.map(([a, b], i) => <polygon key={i} points={[P(a[0], a[1], 0), P(b[0], b[1], 0), P(b[0], b[1], -T), P(a[0], a[1], -T)].join(" ")} fill={i % 2 ? "#0e1411" : "#141b17"} />)}
			<polygon points={poly(pts)} fill="url(#g-floor)" />
			<g clipPath="url(#floor-clip)">
				<g stroke="rgba(198,255,77,0.07)" strokeWidth="1">{lines}</g>
				<polygon points={[P(2, 0), P(9, 0), P(0, 9), P(0, 2)].join(" ")} fill="#fff" opacity="0.035" />
				<polygon points={[P(14, 0), P(17, 0), P(0, 17), P(0, 14)].join(" ")} fill="#fff" opacity="0.03" />
				<polygon points={poly(pts)} fill="url(#g-sheen)" />
			</g>
			{near.map(([a, b], i) => <line key={`t${i}`} x1={pt(a[0], a[1], 0)[0]} y1={pt(a[0], a[1], 0)[1]} x2={pt(b[0], b[1], 0)[0]} y2={pt(b[0], b[1], 0)[1]} stroke={LIME} strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" filter="url(#f-glow)" />)}
			{near.map(([a, b], i) => <line key={`l${i}`} x1={pt(a[0], a[1], -T)[0]} y1={pt(a[0], a[1], -T)[1]} x2={pt(b[0], b[1], -T)[0]} y2={pt(b[0], b[1], -T)[1]} stroke={TEAL} strokeOpacity="0.55" strokeWidth="1.2" filter="url(#f-glow)" />)}
		</g>
	);
}

/** Силуэты города за стеклом: тёмные башни с редкими светящимися окнами. */
function Skyline() {
	const out: React.ReactNode[] = [];
	const hs = [46, 70, 38, 84, 56, 42, 76, 52, 92, 46, 66, 40];
	for (let i = 0; i < 12; i++) {
		const x = i * 2.05 + 0.2, h = hs[i], w = 1.5 + (i % 3) * 0.2;
		out.push(
			<g key={`b${i}`}>
				<IsoBox x={x} y={-3.4} w={w} d={1.6} h={h} c={tone(i % 2 ? "#0f1814" : "#121d18")} flat />
				<Plane x={x} y={-1.8} z={h}>
					{Array.from({ length: Math.floor(h / 13) }, (_, r) => Array.from({ length: Math.floor(w * 32 / 8) }, (_, k) => ((r * 7 + k * 3 + i) % 5 < 3) && <rect key={`${r}-${k}`} x={3 + k * 8} y={4 + r * 13} width="4" height="5" fill={(r + k + i) % 3 ? LIME : TEAL} opacity="0.8" />))}
				</Plane>
			</g>,
		);
	}
	for (let i = 0; i < 9; i++) {
		const y = i * 2.1 + 0.4, h = hs[(i * 5) % 12] * 0.85, d = 1.5;
		out.push(<IsoBox key={`l${i}`} x={-3.6} y={y} w={1.6} d={d} h={h} c={tone(i % 2 ? "#0e1612" : "#111b16")} flat />);
	}
	return <g opacity="0.55">{out}</g>;
}

/** Изогнутая стеклянная стена вдоль двух дальних сторон: скруглённый угол, мягкий неон по верху, панорама города. */
export function BackWalls() {
	const R = 3.6, H = 64;
	const pts: Pt[] = [...lineSteps(0, GRID_D - 1, 0, R, 2.1).slice(0, -1), ...arcPts(R, R, R, 180, 270, 16), ...lineSteps(R, 0, GRID_W - 1, 0, 2.1).slice(1)];
	return (
		<g>
			<Skyline />
			<Band pts={pts} z0={0} z1={H} edge={LIME} posts={1} />
			<Band pts={pts} z0={H - 2} z1={H + 3} fill="#27322b" solid edge={LIME} edgeOp={0.9} baseEdge={false} />
			{/* настенные экраны с графиками на прямой части задней стены */}
			{[6.2, 16.6].map((x, k) => (
				<Plane key={x} x={x} y={0.06} z={50}>
					<rect x="0" y="0" width="62" height="28" rx="3" fill="#06130c" stroke={LIME} strokeOpacity="0.8" filter="url(#f-glow)" />
					{k === 0 ? [8, 14, 10, 19, 13, 17].map((h, i) => <rect key={i} className="sc-bar" style={{ animationDelay: `${i * 0.2}s` }} x={6 + i * 9} y={24 - h} width="5.5" height={h} fill={i % 2 ? TEAL : LIME} opacity="0.9" />) : <polyline className="sc-line" points="5,22 16,13 27,17 39,8 56,4" fill="none" stroke={LIME} strokeWidth="1.8" />}
				</Plane>
			))}
		</g>
	);
}

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; x?: number; y?: number }>> = { platform: TbServer, sales: TbChartBar, marketing: TbSpeakerphone, service: TbHeadset, finance: TbCalculator, warehouse: TbBox, office: TbBuildingSkyscraper };

/** Зона-капсула: скруглённый светящийся коврик и стеклянные дуги по задним углам. Принимает перетаскиваемого робота (data-drop-zone). */
export function ZonePad({ room, hot, live, count }: { room: RoomDef; hot: boolean; live: boolean; count: number }) {
	const { x, y, w, d, zone } = room;
	const col = ZONE_LIGHT[zone];
	const pts = roundedRect(x + 0.35, y + 0.4, w - 0.7, d - 0.65, 1.5, 8);
	const inner = roundedRect(x + 0.75, y + 0.8, w - 1.5, d - 1.45, 1.1, 6);
	return (
		<g>
			<polygon points={poly(pts)} fill="#2f3b34" />
			<polygon points={poly(pts)} fill={col} opacity={hot ? 0.4 : live ? 0.2 : 0.12} />
			<polygon points={poly(pts)} fill={`url(#pool-${zone})`} opacity={live ? 1 : 0.85} />
			<polygon points={poly(pts)} fill="url(#g-sheen)" opacity="0.8" />
			<polygon points={poly(inner)} fill="rgba(0,0,0,0.14)" stroke={col} strokeOpacity="0.22" strokeDasharray="3 5" />
			<polygon points={poly(pts)} fill="none" stroke={hot ? LIME : col} strokeOpacity={hot ? 1 : live ? 0.95 : 0.6} strokeWidth={hot ? 2.2 : 1.6} strokeDasharray={hot ? "7 5" : undefined} strokeLinejoin="round" filter="url(#f-glow)" />
			<polygon data-drop-zone={zone} points={poly(pts)} fill="transparent" />
			{count === 0 && <g style={{ pointerEvents: "none" }} opacity="0.6"><circle cx={pt(x + w / 2, y + d / 2)[0]} cy={pt(x + w / 2, y + d / 2)[1]} r="9" fill="none" stroke={col} strokeDasharray="2 3" /><text x={pt(x + w / 2, y + d / 2)[0]} y={pt(x + w / 2, y + d / 2)[1] + 4} textAnchor="middle" fontSize="13" fill={col}>+</text></g>}
		</g>
	);
}

/** Стеклянные дуги зоны по задним углам (над полом, за мебелью). */
export function ZoneGlass({ room }: { room: RoomDef }) {
	const col = ZONE_LIGHT[room.zone];
	const x0 = room.x + 0.35, y0 = room.y + 0.4, x1 = room.x + room.w - 0.35;
	return (
		<g>
			<CornerGlass x={x0} y={y0} r={1.5} armX={3.2} armY={3.0} h={44} edge={col} />
			<CornerGlass x={x1} y={y0} r={1.5} armX={3.2} armY={1.6} h={44} edge={col} flip />
		</g>
	);
}

/** Голографическая вывеска зоны с иконкой: парит над задним краем. */
export function ZoneSign({ room, label, count, hot }: { room: RoomDef; label: string; count: number; hot: boolean }) {
	const col = hot ? LIME : ZONE_LIGHT[room.zone];
	const Icon = ICONS[room.zone] ?? TbBox;
	const [sx, sy] = pt(room.x + room.w / 2, room.y + 0.45, 0);
	const text = count > 0 ? `${label} · ${count}` : label;
	const w = Math.max(88, text.length * 7 + 44);
	return (
		<g transform={`translate(${sx.toFixed(1)} ${(sy - 62).toFixed(1)})`} style={{ pointerEvents: "none" }} className="sc-float">
			<line x1="0" y1="14" x2="0" y2="58" stroke={col} strokeOpacity="0.55" strokeDasharray="2 3" />
			<rect x={-w / 2} y={-14} width={w} height={28} rx={14} fill="rgba(8,12,10,0.9)" stroke={col} strokeWidth="1.3" filter="url(#f-glow)" />
			<circle cx={-w / 2 + 16} cy={0} r="10" fill={col} fillOpacity="0.16" stroke={col} strokeOpacity="0.7" />
			<Icon size={13} color={col} x={-w / 2 + 9.5} y={-6.5} />
			<text x={-w / 2 + 32} y={4.4} fontSize="12" fontWeight="600" fill="#eef3e8" letterSpacing="0.3">{text}</text>
		</g>
	);
}

function Pendant({ x, y, z = 74, color = LIME }: { x: number; y: number; z?: number; color?: string }) {
	const [sx, sy] = pt(x, y, z);
	return (
		<g>
			<line x1={sx} y1={sy - 30} x2={sx} y2={sy - 8} stroke="rgba(255,255,255,0.3)" />
			<ellipse cx={sx} cy={sy + 6} rx="16" ry="10" fill={color} opacity="0.2" filter="url(#f-bloom)" />
			<path d={`M${sx - 8} ${sy - 4} Q${sx} ${sy - 12} ${sx + 8} ${sy - 4} L${sx + 6} ${sy + 2} L${sx - 6} ${sy + 2} Z`} fill="#222b26" stroke={color} strokeOpacity="0.9" filter="url(#f-glow)" />
			<ellipse cx={sx} cy={sy + 2} rx="6" ry="2.4" fill={color} />
		</g>
	);
}

/** Кофе-пойнт: стойка с кофемашиной, неоновая вывеска COFFEE, подвесные лампы, круглые табуреты. */
export function CoffeeBar() {
	const { x, y, w, d } = COFFEE;
	const body = tone("#303a34");
	const [nx, ny] = pt(x + w / 2, y + 0.1, 60);
	return (
		<g>
			<Shadow x={x} y={y} w={w} d={d} o={0.5} />
			<IsoBox x={x} y={y} w={w} d={d} h={14} c={body} />
			<Plane x={x} y={y + d} z={14}>
				{Array.from({ length: Math.round(w) }, (_, i) => <rect key={i} x={3 + i * 32} y="3" width="26" height="9" rx="4.5" fill="none" stroke="rgba(198,255,77,0.28)" />)}
				<rect x="3" y="12.2" width={w * 32 - 6} height="1.6" fill={LIME} opacity="0.7" />
			</Plane>
			<IsoBox x={x - 0.03} y={y - 0.03} z={14} w={w + 0.06} d={d + 0.06} h={2.2} c={tone("#e9eee5")} edge="rgba(198,255,77,0.7)" />
			<IsoBox x={x + 0.45} y={y + 0.15} z={16.2} w={1.0} d={0.7} h={13} c={C.dark} edge="rgba(198,255,77,0.55)" />
			<Plane x={x + 0.45} y={y + 0.85} z={29}><rect x="3" y="2" width="26" height="5" rx="2" fill="#06140c" /><rect className="sc-pulse" x="5" y="3.6" width="10" height="1.8" fill={LIME} /><circle cx="24" cy="4.5" r="1.4" fill={TEAL} /></Plane>
			{[1.8, 2.15, 2.5].map((dx) => <IsoBox key={dx} x={x + dx} y={y + 0.4} z={16.2} w={0.2} d={0.2} h={3.4} c={tone("#f1f4ee")} />)}
			{/* неоновая вывеска */}
			<g transform={`translate(${nx.toFixed(1)} ${ny.toFixed(1)}) skewY(26.565)`} style={{ pointerEvents: "none" }}>
				<text x="0" y="0" textAnchor="middle" fontSize="23" fontWeight="800" fontStyle="italic" fill="none" stroke={LIME} strokeWidth="1.6" filter="url(#f-glow)" letterSpacing="2" className="sc-blink-soft">COFFEE</text>
				<text x="0" y="0" textAnchor="middle" fontSize="23" fontWeight="800" fontStyle="italic" fill={LIME} fillOpacity="0.18" letterSpacing="2">COFFEE</text>
			</g>
			<Pendant x={x + 0.8} y={y + 0.9} /><Pendant x={x + 2.4} y={y + 0.9} />
			{[0, 1].map((i) => <g key={i}><Cyl x={x + w + 0.35} y={y + 0.4 + i * 0.75} r={0.2} h={9} side="#26302a" top="#c6ff4d" /></g>)}
		</g>
	);
}

/** Лаунж: дуговой диван вокруг круглого стеклянного столика с неоновым ободком. */
export function Lounge() {
	const { table } = LOUNGE;
	const cx = table.x + table.w / 2, cy = table.y + table.d / 2;
	const arc = (r: number) => arcPts(cx, cy, r, 112, 248, 14);
	return (
		<g>
			<polygon points={poly(roundedRect(cx - 2.2, cy - 2.1, 4.2, 4.2, 2.1, 10))} fill={TEAL} opacity="0.08" />
			<Band pts={arc(1.85)} z0={6} z1={17} fill="#3f5246" solid edge={LIME} edgeOp={0.55} />
			<polygon points={[...arc(1.85).map(([x, y]) => P(x, y, 6)), ...arc(1.3).reverse().map(([x, y]) => P(x, y, 6))].join(" ")} fill="#56705f" />
			<Band pts={arc(1.3)} z0={0} z1={6} fill="#26302a" solid edge={TEAL} edgeOp={0.6} />
			<Cyl x={cx} y={cy} r={0.5} h={8} side="#1d2621" top="rgba(125,255,225,0.35)" edge={TEAL} glow />
			<ellipse cx={pt(cx, cy, 8)[0]} cy={pt(cx, cy, 8)[1]} rx="9" ry="4.5" fill={LIME} opacity="0.35" />
		</g>
	);
}

/** Серверная: ряд стеклянных стоек с мигающими огнями. */
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
						<IsoBox x={rx} y={y} w={rw} d={d} h={50} c={C.dark} edge="rgba(45,222,182,0.6)" />
						<Plane x={rx} y={y + d} z={50}>
							<rect x="2" y="2" width={rw * 32 - 4} height="46" fill="rgba(125,255,225,0.06)" />
							{[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <g key={k}><rect x="4" y={4 + k * 5.5} width={rw * 32 - 8} height="3.8" rx="1" fill="#0d1612" /><circle className="sc-blink" style={{ animationDelay: `${(i * 7 + k) * 0.31}s` }} cx={rw * 32 - 8} cy={5.9 + k * 5.5} r="1.2" fill={(i + k) % 3 === 0 ? TEAL : LIME} /><rect x="7" y={5.2 + k * 5.5} width={rw * 32 * 0.35} height="1.2" fill="rgba(255,255,255,0.16)" /></g>)}
						</Plane>
					</g>
				);
			})}
		</g>
	);
}

/** Стеклянные дуги вокруг серверной и кофе-зоны, как у рабочих зон. */
export function ServiceGlass() {
	return (
		<g>
			{CELLS.filter((c) => c.kind === "coffee").map((c) => {
				const col = LIME;
				return (
					<g key={c.id}>
						<CornerGlass x={c.x + 0.35} y={c.y + 0.4} r={1.5} armX={2.6} armY={2.6} h={44} edge={col} />
						<CornerGlass x={c.x + c.w - 0.35} y={c.y + 0.4} r={1.5} armX={2.6} armY={1.6} h={44} edge={col} flip />
					</g>
				);
			})}
		</g>
	);
}
