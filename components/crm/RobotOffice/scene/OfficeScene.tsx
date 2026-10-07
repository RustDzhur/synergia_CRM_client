"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbMinus, TbPlus } from "react-icons/tb";
import { useOfficeStore, type Robot, type Zone } from "@/store/useOfficeStore";
import { useDragKit } from "../dragKit";
import { ACCENT_HEX, type RobotView, titleOf, viewOf } from "../theme";
import { C, CORRIDOR, GRID_W, HUB, P, ROOMS, RD, SCENE_H, SCENE_W, TH, TW, WALL_H, type RoomDef, pt, slotFor } from "./iso";
import Bot from "./Bot";
import SceneDefs, { ZONE_LIGHT } from "./defs";
import { Chair, IsoBox, Plane, Plant, RoomSign } from "./prims";
import { Station, kindOf } from "./stations";

// Изометрический план офиса: шесть комнат (по функциям), посередине коридор с Айрис. У каждого робота рабочее место по роли
// (экран, бумаги, стеллажи, станок). Робот — это живая фигурка: работает за столом, переходит в другую комнату, когда его перетащили.
// Нажатие выбирает робота; перетаскивание — в комнату (мышь или удержание пальцем); на робота можно бросить поручение с доски или текстовый файл.
const MAX_FILE = 40 * 1024;
const TEXT_FILE = /\.(txt|csv|tsv|md|json|xml|log)$/i;
const R2 = Math.SQRT2;

interface Item { depth: number; key: string; node: React.ReactNode }

function Floor({ room, hot, active }: { room: RoomDef; hot: boolean; active: boolean }) {
	const { x, y, w, d, zone } = room;
	const poly = [P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0)].join(" ");
	const lines: React.ReactNode[] = [];
	for (let i = 1; i < w; i++) lines.push(<line key={`a${i}`} x1={pt(x + i, y)[0]} y1={pt(x + i, y)[1]} x2={pt(x + i, y + d)[0]} y2={pt(x + i, y + d)[1]} />);
	for (let j = 1; j < d; j++) lines.push(<line key={`b${j}`} x1={pt(x, y + j)[0]} y1={pt(x, y + j)[1]} x2={pt(x + w, y + j)[0]} y2={pt(x + w, y + j)[1]} />);
	// плитки в шахматном порядке — пол выглядит глянцевым, а не сплошным пятном
	const tiles: React.ReactNode[] = [];
	for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if ((i + j) % 2 === 0) tiles.push(<polygon key={`${i}-${j}`} points={[P(x + i, y + j, 0), P(x + i + 1, y + j, 0), P(x + i + 1, y + j + 1, 0), P(x + i, y + j + 1, 0)].join(" ")} />);
	const rug = [P(x + 0.3, y + 0.8, 0), P(x + w - 0.3, y + 0.8, 0), P(x + w - 0.3, y + d - 0.3, 0), P(x + 0.3, y + d - 0.3, 0)].join(" ");
	const frontEdge = [P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y, 0)].join(" ");
	return (
		<g>
			<polygon points={[P(x - 0.1, y - 0.1, 0), P(x + w + 0.3, y - 0.1, 0), P(x + w + 0.3, y + d + 0.4, 0), P(x - 0.1, y + d + 0.4, 0)].join(" ")} fill="rgba(0,0,0,0.5)" filter="url(#f-soft)" />
			<polygon points={poly} fill="url(#g-floor)" />
			<g fill="rgba(255,255,255,0.025)">{tiles}</g>
			<polygon points={poly} fill={`url(#pool-${zone})`} />
			<polygon points={rug} fill="rgba(0,0,0,0.16)" stroke="rgba(255,255,255,0.05)" />
			<g stroke={C.grid} strokeWidth="1">{lines}</g>
			<polygon points={poly} fill="url(#g-sheen)" />
			<polyline points={frontEdge} fill="none" stroke={ZONE_LIGHT[zone]} strokeOpacity={active ? 0.95 : 0.55} strokeWidth="2" strokeLinejoin="round" filter="url(#f-glow)" />
			<polygon data-drop-zone={zone} points={poly} fill={hot ? "rgba(198,255,77,0.16)" : "transparent"} stroke={hot ? "#c6ff4d" : "none"} strokeWidth="1.5" strokeDasharray={hot ? "6 4" : undefined} />
		</g>
	);
}

function Walls({ room }: { room: RoomDef }) {
	const { x, y, w, d, zone } = room;
	const t = 0.2;
	const light = ZONE_LIGHT[zone];
	const tone3 = { top: C.wallTop, left: C.wallL, right: C.wallR };
	// стеклянное полотно на задней стене (грань y-max) и на левой (грань x-max)
	const glassBack = [P(x + 0.3, y, 6), P(x + w - 0.3, y, 6), P(x + w - 0.3, y, WALL_H - 5), P(x + 0.3, y, WALL_H - 5)].join(" ");
	const glassLeft = [P(x, y + 0.3, 6), P(x, y + d - 0.3, 6), P(x, y + d - 0.3, WALL_H - 5), P(x, y + 0.3, WALL_H - 5)].join(" ");
	return (
		<g>
			<IsoBox x={x - t} y={y - t} w={t} d={d + t} h={WALL_H} c={tone3} />
			<IsoBox x={x} y={y - t} w={w} d={t} h={WALL_H} c={tone3} />
			<polygon points={glassBack} fill="url(#g-glass)" stroke="rgba(255,255,255,0.12)" />
			<polygon points={glassLeft} fill="url(#g-glass)" stroke="rgba(255,255,255,0.10)" />
			{/* переплёты и огни города за стеклом */}
			<g stroke="rgba(255,255,255,0.10)" strokeWidth="1">
				{Array.from({ length: w - 1 }, (_, i) => <line key={`m${i}`} x1={pt(x + 0.3 + (i + 1) * ((w - 0.6) / w), y, 6)[0]} y1={pt(x + 0.3 + (i + 1) * ((w - 0.6) / w), y, 6)[1]} x2={pt(x + 0.3 + (i + 1) * ((w - 0.6) / w), y, WALL_H - 5)[0]} y2={pt(x + 0.3 + (i + 1) * ((w - 0.6) / w), y, WALL_H - 5)[1]} />)}
			</g>
			<g fill={light} opacity="0.5">
				{Array.from({ length: 9 }, (_, i) => { const [px, py] = pt(x + 0.6 + ((i * 53) % 47) / 47 * (w - 1.2), y, 10 + ((i * 29) % 23)); return <circle key={i} cx={px} cy={py} r="0.9" />; })}
			</g>
			{/* неоновые линии по верху и по низу стены */}
			<polyline points={[P(x - t, y + d, WALL_H), P(x - t, y - t, WALL_H), P(x + w, y - t, WALL_H)].join(" ")} fill="none" stroke={light} strokeWidth="1.6" strokeOpacity="0.9" strokeLinejoin="round" filter="url(#f-glow)" />
			<polyline points={[P(x, y + d, 1.5), P(x, y, 1.5), P(x + w, y, 1.5)].join(" ")} fill="none" stroke={light} strokeWidth="1.1" strokeOpacity="0.55" strokeLinejoin="round" />
		</g>
	);
}

function Hub({ boss, onFocus }: { boss: boolean; onFocus: () => void }) {
	const [cx, cy] = pt(HUB.x, HUB.y, 0);
	const ell = (r: number, z = 0) => ({ cx, cy: cy - z, rx: r * TW * 0.5 * R2, ry: r * TH * 0.5 * R2 });
	return (
		<g data-drop-robot="iris" onClick={onFocus} style={{ cursor: "pointer" }}>
			<ellipse {...ell(3.3)} fill="url(#g-holo)" opacity="0.55" />
			<ellipse {...ell(3.1)} fill="none" stroke="#c6ff4d" strokeOpacity="0.45" strokeWidth="1.4" strokeDasharray="4 7" className="sc-dash" />
			<ellipse {...ell(2.45)} fill="#0b0f0d" stroke="#c6ff4d" strokeOpacity="0.8" strokeWidth="1.8" filter="url(#f-glow)" />
			<ellipse {...ell(2.0)} fill="#121815" stroke="rgba(198,255,77,0.35)" strokeWidth="1" />
			{/* цилиндрическая платформа */}
			<ellipse {...ell(1.55, 0)} fill="#0f1411" />
			<rect x={cx - ell(1.55).rx} y={cy - 16} width={ell(1.55).rx * 2} height="16" fill="url(#bt-metal)" />
			<line x1={cx - ell(1.55).rx} y1={cy - 8} x2={cx + ell(1.55).rx} y2={cy - 8 + 0.01} stroke="rgba(198,255,77,0.35)" strokeWidth="1" />
			<ellipse {...ell(1.55, 16)} fill="#27322b" stroke="#c6ff4d" strokeOpacity="0.9" strokeWidth="1.6" filter="url(#f-glow)" />
			<ellipse {...ell(1.0, 16)} fill="rgba(198,255,77,0.18)" className={boss ? "sc-pulse" : undefined} />
			{/* луч света и голограммы */}
			<rect x={cx - ell(1.0).rx} y={cy - 16 - 120} width={ell(1.0).rx * 2} height="120" fill="url(#g-beam)" opacity="0.55" />
			<g className="sc-float">
				<Plane x={HUB.x - 2.6} y={HUB.y + 0.5} z={84}><rect width="50" height="30" rx="2" fill="rgba(198,255,77,0.10)" stroke="rgba(198,255,77,0.7)" filter="url(#f-glow)" />{[0, 1, 2, 3].map((i) => <rect key={i} x="5" y={5 + i * 5.8} width={[30, 22, 34, 16][i]} height="2.2" fill="#c6ff4d" opacity="0.75" />)}</Plane>
				<Plane x={HUB.x + 1.3} y={HUB.y + 0.8} z={74}><rect width="44" height="28" rx="2" fill="rgba(45,222,182,0.10)" stroke="rgba(45,222,182,0.7)" filter="url(#f-glow)" />{[9, 15, 11, 19, 14].map((h, i) => <rect key={i} x={5 + i * 7.5} y={24 - h} width="5" height={h} fill="#2DDEB6" opacity="0.85" />)}</Plane>
			</g>
			<g transform={`translate(${cx - 54} ${cy - 16 - 124}) scale(1.35)`}><Bot accent="lime" boss state={boss ? "working" : "idle"} /></g>
			<g transform={`translate(${cx} ${cy + 17})`} style={{ pointerEvents: "none" }}>
				<rect x="-30" y="-10" width="60" height="20" rx="10" fill="#0d110f" stroke="#c6ff4d" strokeOpacity="0.85" filter="url(#f-glow)" />
				<text x="0" y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#c6ff4d" letterSpacing="1.6">IRIS</text>
			</g>
		</g>
	);
}

function RobotFigure({ robot, view, x, y, selected, walking, onSelect, onFile }: { robot: Robot; view: RobotView; x: number; y: number; selected: boolean; walking: boolean; onSelect: () => void; onFile: (f: File) => void }) {
	const t = useTranslations("office");
	const drag = useDragKit();
	const { canEdit, ai } = useOfficeStore();
	const over = drag.over?.type === "robot" && drag.over.id === robot.id;
	const [sx, sy] = pt(x, y, 0);
	const size = 84;
	const color = view.state === "working" ? "#c6ff4d" : view.state === "waiting" ? "#F4A100" : view.state === "failed" ? "#EB5757" : "#8c948b";
	const badge = view.state === "waiting" ? "!" : view.state === "failed" ? "×" : view.state === "working" ? "…" : "";
	const name = robot.name.length > 9 ? `${robot.name.slice(0, 8)}…` : robot.name;
	const pillW = Math.max(46, name.length * 6.4 + 22);
	return (
		<g
			style={{ transform: `translate(${sx}px, ${sy}px)`, transition: "transform 1s cubic-bezier(0.45, 0, 0.25, 1)", cursor: "pointer", opacity: robot.enabled ? 1 : 0.8 }}
			data-drop-robot={robot.id}
			role="button" tabIndex={0} aria-label={`${robot.name}, ${titleOf(t, robot)}`}
			onClick={() => { if (!drag.justDragged()) onSelect(); }}
			onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
			onPointerDown={canEdit ? (e) => drag.start(e, { kind: "robot", id: robot.id, label: robot.name }) : undefined}
			onDragOver={(e) => { if (canEdit && ai && e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
			onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f && canEdit && ai) { e.preventDefault(); onFile(f); } }}>
			{(selected || over) && <ellipse cx="0" cy="4" rx="28" ry="12.5" fill="rgba(198,255,77,0.12)" stroke="#c6ff4d" strokeWidth="2" filter="url(#f-glow)" className={selected ? undefined : "sc-pulse"} />}
			<rect x="-34" y={-size * 1.02} width="68" height={size * 1.1 + 12} fill="transparent" />
			<g className={walking ? "sc-walk" : undefined} transform={`translate(${-size * 0.4} ${-size * 0.97}) scale(${size / 100})`} style={{ pointerEvents: "none" }}>
				<Bot accent={robot.accent} state={walking ? "working" : view.state} />
			</g>
			{badge && !walking && (
				<g transform={`translate(22 ${-size * 1.0})`} style={{ pointerEvents: "none" }} className={view.state === "working" ? "sc-float" : undefined}>
					<circle r="8.5" fill="#0d110f" stroke={color} strokeWidth="1.4" />
					<text x="0" y={badge === "…" ? 2 : 3.6} textAnchor="middle" fontSize={badge === "…" ? 12 : 11} fontWeight="700" fill={color}>{badge}</text>
				</g>
			)}
			<g transform="translate(0 20)" style={{ pointerEvents: "none" }}>
				<rect x={-pillW / 2} y="-8" width={pillW} height="16" rx="8" fill="#0d110f" stroke={selected ? "#c6ff4d" : "rgba(255,255,255,0.14)"} />
				<circle cx={-pillW / 2 + 9} cy="0" r="2.6" fill={robot.enabled ? color : "#6b736a"} />
				<text x={-pillW / 2 + 16} y="3.6" fontSize="10" fontWeight="600" fill="#e6ecdf">{name}</text>
			</g>
			<title>{`${robot.name} — ${titleOf(t, robot)}`}</title>
		</g>
	);
}

export default function OfficeScene({ onSelect, onBoss, overlay }: { onSelect: (id: string) => void; onBoss: () => void; overlay?: React.ReactNode }) {
	const t = useTranslations("office");
	const locale = useLocale();
	const drag = useDragKit();
	const { robots, tasks, selected, assign } = useOfficeStore();
	const [zoom, setZoom] = useState(1);
	const [walking, setWalking] = useState<Record<string, number>>({});
	const prev = useRef<Record<string, string>>({});
	const now = Date.now();

	// робот сменил комнату — на секунду «идёт»
	useEffect(() => {
		const moved: Record<string, number> = {};
		for (const r of robots) if (prev.current[r.id] && prev.current[r.id] !== r.zone) moved[r.id] = Date.now() + 1000;
		prev.current = Object.fromEntries(robots.map((r) => [r.id, r.zone]));
		if (!Object.keys(moved).length) return;
		setWalking((w) => ({ ...w, ...moved }));
		const timer = setTimeout(() => setWalking({}), 1050);
		return () => clearTimeout(timer);
	}, [robots]);

	const views = useMemo(() => Object.fromEntries(robots.map((r) => [r.id, viewOf(r, tasks, now)])), [robots, tasks, now]);
	const bossBusy = tasks.some((x) => x.robot === "iris" && (x.status === "running" || x.status === "queued"));

	async function onFile(r: Robot, file: File) {
		if (file.size > MAX_FILE) return void toast.error(t("fileTooBig"));
		if (!(TEXT_FILE.test(file.name) || file.type.startsWith("text/"))) return void toast.error(t("fileNotText"));
		const body = (await file.text()).slice(0, MAX_FILE);
		const task = await assign(r.id, `${t("fileTask", { name: file.name })}\n\n${body}`, locale, "drop");
		if (task) toast.success(t("taskAssigned", { name: r.name }));
	}

	// всё, что стоит в комнатах, рисуется по порядку «дальше → ближе»
	const items: Item[] = [];
	const hotZone = drag.payload?.kind === "robot" && drag.over?.type === "zone" ? drag.over.id : null;
	for (const room of ROOMS) {
		const here = robots.filter((r) => r.zone === room.zone);
		items.push({ depth: room.x + room.y - 0.6, key: `walls-${room.zone}`, node: <Walls room={room} /> });
		here.forEach((r, i) => {
			const slot = slotFor(room, i);
			const view = views[r.id];
			const kind = kindOf(r.template, r.skills);
			const on = view.state === "working";
			if (slot.desk) {
				items.push({ depth: slot.desk.x + slot.desk.y + 1.5, key: `st-${r.id}`, node: <Station kind={kind} x={slot.desk.x} y={slot.desk.y} on={on} /> });
				items.push({ depth: slot.desk.x + slot.desk.y + 2.4, key: `ch-${r.id}`, node: <Chair x={slot.desk.x + 0.7} y={slot.desk.y + 1.25} accent={ACCENT_HEX[r.accent]} /> });
			}
			items.push({ depth: slot.robot.x + slot.robot.y + 0.2, key: `rb-${r.id}`, node: <RobotFigure robot={r} view={view} x={slot.robot.x} y={slot.robot.y} selected={selected === r.id} walking={(walking[r.id] ?? 0) > now} onSelect={() => onSelect(r.id)} onFile={(f) => void onFile(r, f)} /> });
		});
		// растения и мелочь для уюта
		items.push({ depth: room.x + room.w - 0.4 + room.y + 0.6, key: `pl-${room.zone}`, node: <Plant x={room.x + room.w - 0.5} y={room.y + 0.6} big /> });
		if (room.row === 0) items.push({ depth: room.x + 0.5 + room.y + room.d - 0.6, key: `pl2-${room.zone}`, node: <Plant x={room.x + 0.5} y={room.y + room.d - 0.5} /> });
	}
	// коридор: растения, кулер, сервер
	items.push({ depth: 1 + RD + 0.4, key: "c1", node: <Plant x={1} y={RD + 0.4} big /> });
	items.push({ depth: 21 + RD + 0.4, key: "c2", node: <Plant x={21} y={RD + 0.4} big /> });
	items.push({ depth: 3.2 + RD + CORRIDOR - 0.8, key: "cooler", node: <g><IsoBox x={3} y={RD + CORRIDOR - 1} w={0.5} d={0.5} h={22} c={C.metal} /><IsoBox x={3.08} y={RD + CORRIDOR - 0.92} z={22} w={0.34} d={0.34} h={10} c={{ top: "#7CC4FF", left: "rgba(124,196,255,0.55)", right: "rgba(124,196,255,0.4)" }} /></g> });
	items.push({ depth: 18 + RD + 1.2, key: "srv", node: <g>{[0, 1].map((i) => <g key={i}><IsoBox x={18 + i * 0.9} y={RD + 0.6} w={0.8} d={0.8} h={34} c={C.dark} edge="rgba(198,255,77,0.4)" /><Plane x={18 + i * 0.9} y={RD + 1.4} z={34}>{[0, 1, 2, 3, 4].map((k) => <g key={k}><rect x="3" y={3 + k * 6} width="19" height="4" rx="0.6" fill="#1b231e" /><circle className="sc-blink" style={{ animationDelay: `${(i * 5 + k) * 0.37}s` }} cx="18" cy={5 + k * 6} r="1.1" fill={k % 3 === 0 ? "#2DDEB6" : "#c6ff4d"} /></g>)}</Plane></g>)}</g> });
	items.sort((a, b) => a.depth - b.depth);

	const paths = ROOMS.map((room) => ({ room, a: pt(room.x + room.w / 2, room.row === 0 ? room.y + room.d : room.y, 0), b: pt(HUB.x, HUB.y, 0), live: robots.some((r) => r.zone === room.zone && views[r.id]?.state === "working") }));

	return (
		<div className="relative overflow-hidden rounded-14 border border-[rgba(255,255,255,0.09)]" style={{ background: "radial-gradient(ellipse at 50% 38%, #1f2822 0%, #131815 55%, #0c0f0d 100%)" }}>
			<div className="fs-scroll overflow-auto" style={{ maxHeight: "min(80vh, 820px)" }}>
				<svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={{ width: `${zoom * 100}%`, minWidth: 780, display: "block", margin: "0 auto" }} role="img" aria-label={t("title")}>
					<SceneDefs />
					{/* коридор */}
					<polygon points={[P(0, RD, 0), P(GRID_W, RD, 0), P(GRID_W, RD + CORRIDOR, 0), P(0, RD + CORRIDOR, 0)].join(" ")} fill={C.corridor} stroke="rgba(255,255,255,0.05)" />
					<polygon points={[P(0, RD, 0), P(GRID_W, RD, 0), P(GRID_W, RD + CORRIDOR, 0), P(0, RD + CORRIDOR, 0)].join(" ")} fill="url(#g-sheen)" opacity="0.7" />
					{paths.map(({ room, a, b, live }) => (
						<g key={room.zone}>
							<line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#c6ff4d" strokeOpacity={live ? 0.55 : 0.18} strokeWidth="1.5" strokeDasharray="6 6" className={live ? "sc-dash" : undefined} />
							{[0, 1].map((k) => (live || k === 0) && (
								<g key={k} opacity={live ? 1 : 0.35} filter="url(#f-glow)">
									<g transform="translate(0 -6)"><polygon points="0,-5 7,-1.5 0,2 -7,-1.5" fill="#d8ff7e" /><polygon points="-7,-1.5 0,2 0,9 -7,5.5" fill="#8fc92b" /><polygon points="7,-1.5 0,2 0,9 7,5.5" fill="#5f8f1a" /></g>
									<animateMotion dur={live ? "2.6s" : "9s"} begin={`${k * 1.3}s`} repeatCount="indefinite" path={`M${b[0]},${b[1]} L${a[0]},${a[1]}`} />
								</g>
							))}
						</g>
					))}
					{ROOMS.map((room) => <Floor key={room.zone} room={room} hot={hotZone === room.zone} active={robots.some((r) => r.zone === room.zone && views[r.id]?.state === "working")} />)}
					<Hub boss={bossBusy} onFocus={onBoss} />
					{items.map((it) => <g key={it.key}>{it.node}</g>)}
					{ROOMS.map((room) => <RoomSign key={room.zone} x={room.x + 1.8} y={room.y} label={t(`zone_${room.zone as Zone}`)} count={robots.filter((r) => r.zone === room.zone).length} active={hotZone === room.zone} />)}
				</svg>
			</div>
			{overlay}
			<div className="absolute bottom-12 left-12 flex items-center gap-4 rounded-10 border border-inkLine bg-[rgba(13,17,15,0.85)] p-4 backdrop-blur">
				<button type="button" aria-label="−" onClick={() => setZoom((z) => Math.max(1, +(z - 0.3).toFixed(1)))} className="flex h-30 w-30 items-center justify-center rounded-8 text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.06)]"><TbMinus size={16} /></button>
				<span className="w-36 text-center text-11 text-[#8c948b]">{Math.round(zoom * 100)}%</span>
				<button type="button" aria-label="+" onClick={() => setZoom((z) => Math.min(2.8, +(z + 0.3).toFixed(1)))} className="flex h-30 w-30 items-center justify-center rounded-8 text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.06)]"><TbPlus size={16} /></button>
			</div>
		</div>
	);
}
