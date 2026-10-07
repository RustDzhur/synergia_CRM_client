"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbMinus, TbPlus } from "react-icons/tb";
import { useOfficeStore, type Robot, type Zone } from "@/store/useOfficeStore";
import { useDragKit } from "../dragKit";
import RobotAvatar from "../RobotAvatar";
import { type RobotView, titleOf, viewOf } from "../theme";
import { C, HUB, P, ROOMS, SCENE_H, SCENE_W, TH, TW, WALL_H, type RoomDef, pt, slotFor } from "./iso";
import { IsoBox, Plane, Plant, RoomSign } from "./prims";
import { Station, kindOf } from "./stations";

// Изометрический план офиса: шесть комнат (по функциям), посередине коридор с Айрис. У каждого робота рабочее место по роли
// (экран, бумаги, стеллажи, станок). Робот — это живая фигурка: работает за столом, переходит в другую комнату, когда его перетащили.
// Нажатие выбирает робота; перетаскивание — в комнату (мышь или удержание пальцем); на робота можно бросить поручение с доски или текстовый файл.
const MAX_FILE = 40 * 1024;
const TEXT_FILE = /\.(txt|csv|tsv|md|json|xml|log)$/i;
const R2 = Math.SQRT2;
const ZONE_LIGHT: Record<Zone, string> = { sales: "#c6ff4d", finance: "#2DDEB6", warehouse: "#F4A100", office: "#B8A2FF", marketing: "#FF8A7A", service: "#7CC4FF" };

interface Item { depth: number; key: string; node: React.ReactNode }

function Floor({ room, hot, active }: { room: RoomDef; hot: boolean; active: boolean }) {
	const { x, y, w, d, zone } = room;
	const poly = [P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0)].join(" ");
	const lines: React.ReactNode[] = [];
	for (let i = 1; i < w; i++) lines.push(<line key={`a${i}`} x1={pt(x + i, y)[0]} y1={pt(x + i, y)[1]} x2={pt(x + i, y + d)[0]} y2={pt(x + i, y + d)[1]} />);
	for (let j = 1; j < d; j++) lines.push(<line key={`b${j}`} x1={pt(x, y + j)[0]} y1={pt(x, y + j)[1]} x2={pt(x + w, y + j)[0]} y2={pt(x + w, y + j)[1]} />);
	// ковёр под столами — чуть светлее пола
	const rug = [P(x + 0.3, y + 0.7, 0), P(x + w - 0.3, y + 0.7, 0), P(x + w - 0.3, y + d - 0.3, 0), P(x + 0.3, y + d - 0.3, 0)].join(" ");
	return (
		<g>
			<polygon points={poly} fill={C.floor} stroke={active ? "rgba(198,255,77,0.35)" : "rgba(255,255,255,0.07)"} strokeWidth="1" />
			<polygon points={rug} fill={C.carpet} opacity="0.85" />
			<polygon points={rug} fill={`url(#pool-${zone})`} />
			<g stroke={C.grid} strokeWidth="1">{lines}</g>
			<polygon data-drop-zone={zone} points={poly} fill={hot ? "rgba(198,255,77,0.14)" : "transparent"} stroke={hot ? "#c6ff4d" : "none"} strokeWidth="1.5" strokeDasharray={hot ? "6 4" : undefined} />
		</g>
	);
}

function Walls({ room, id }: { room: RoomDef; id: string }) {
	const { x, y, w, d } = room;
	const t = 0.18;
	return (
		<g>
			<IsoBox x={x - t} y={y - t} w={t} d={d + t} h={WALL_H} c={{ top: C.wallTop, left: C.wallL, right: C.wallR }} />
			<IsoBox x={x} y={y - t} w={w} d={t} h={WALL_H} c={{ top: C.wallTop, left: C.wallL, right: C.wallR }} edge="rgba(198,255,77,0.5)" />
			{/* окно-экран на задней стене */}
			<Plane x={x + 0.9} y={y} z={WALL_H - 10}>
				<rect x="0" y="0" width={(w - 1.8) * 32} height="24" rx="2" fill={`url(#win-${id})`} stroke="rgba(198,255,77,0.18)" />
				{Array.from({ length: Math.floor(w - 1.8) }, (_, i) => <line key={i} x1={(i + 1) * 32} y1="0" x2={(i + 1) * 32} y2="24" stroke="rgba(255,255,255,0.05)" />)}
			</Plane>
		</g>
	);
}

function Hub({ boss, working, onFocus }: { boss: boolean; working: boolean; onFocus: () => void }) {
	const [cx, cy] = pt(HUB.x, HUB.y, 0);
	const ell = (r: number, z = 0) => ({ cx, cy: cy - z, rx: r * TW * 0.5 * R2, ry: r * TH * 0.5 * R2 });
	return (
		<g data-drop-robot="iris" onClick={onFocus} style={{ cursor: "pointer" }}>
			<ellipse {...ell(3.05)} fill="rgba(198,255,77,0.05)" stroke="rgba(198,255,77,0.32)" strokeWidth="1.2" strokeDasharray="5 5" className="sc-dash" />
			<ellipse {...ell(2.2)} fill="#0c100e" stroke="rgba(198,255,77,0.55)" strokeWidth="1.4" />
			<rect x={cx - ell(1.5).rx} y={cy - 12} width={ell(1.5).rx * 2} height="12" fill="#1a211d" />
			<ellipse {...ell(1.5, 0)} fill="#161c18" />
			<ellipse {...ell(1.5, 12)} fill="#222b25" stroke="rgba(198,255,77,0.8)" strokeWidth="1.4" />
			<ellipse {...ell(0.95, 12)} fill="rgba(198,255,77,0.14)" className={working ? "sc-pulse" : undefined} />
			{/* голографические панели вокруг начальника */}
			<g className="sc-float" opacity="0.9">
				<Plane x={HUB.x - 2.3} y={HUB.y + 0.4} z={78}><rect width="46" height="28" rx="2" fill="rgba(198,255,77,0.10)" stroke="rgba(198,255,77,0.55)" />{[0, 1, 2, 3].map((i) => <rect key={i} x="5" y={5 + i * 5.6} width={[28, 20, 32, 14][i]} height="2.2" fill="#c6ff4d" opacity="0.65" />)}</Plane>
				<Plane x={HUB.x + 1.15} y={HUB.y + 0.7} z={70}><rect width="40" height="26" rx="2" fill="rgba(45,222,182,0.10)" stroke="rgba(45,222,182,0.55)" />{[8, 14, 10, 18, 13].map((h, i) => <rect key={i} x={5 + i * 7} y={22 - h} width="4.5" height={h} fill="#2DDEB6" opacity="0.75" />)}</Plane>
			</g>
			<g transform={`translate(${cx - 46} ${cy - 12 - 96 * 0.9})`}>
				<foreignObject x="0" y="0" width="92" height="96" style={{ overflow: "visible" }}><div style={{ width: 92, height: 92 }}><RobotAvatar accent="lime" size={92} boss state={boss ? "working" : "idle"} /></div></foreignObject>
			</g>
			<g transform={`translate(${cx} ${cy + 14})`} style={{ pointerEvents: "none" }}>
				<rect x="-26" y="-9" width="52" height="18" rx="9" fill="#0d110f" stroke="rgba(198,255,77,0.7)" />
				<text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#c6ff4d" letterSpacing="1.2">IRIS</text>
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
	const size = 66;
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
			<ellipse cx="0" cy="3" rx="19" ry="8.5" fill="rgba(0,0,0,0.45)" />
			{(selected || over) && <ellipse cx="0" cy="3" rx="24" ry="11" fill="none" stroke="#c6ff4d" strokeWidth="2" className={selected ? undefined : "sc-pulse"} />}
			<rect x="-30" y={-size * 0.95} width="60" height={size + 18} fill="transparent" />
			<g className={walking ? "sc-walk" : undefined}>
				<foreignObject x={-size / 2} y={-size * 0.9} width={size} height={size} style={{ overflow: "visible", pointerEvents: "none" }}>
					<div style={{ width: size, height: size }}><RobotAvatar accent={robot.accent} size={size} state={walking ? "working" : view.state} /></div>
				</foreignObject>
			</g>
			{badge && !walking && (
				<g transform={`translate(18 ${-size * 0.95})`} style={{ pointerEvents: "none" }} className={view.state === "working" ? "sc-float" : undefined}>
					<circle r="8.5" fill="#0d110f" stroke={color} strokeWidth="1.4" />
					<text x="0" y={badge === "…" ? 2 : 3.6} textAnchor="middle" fontSize={badge === "…" ? 12 : 11} fontWeight="700" fill={color}>{badge}</text>
				</g>
			)}
			<g transform="translate(0 17)" style={{ pointerEvents: "none" }}>
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
		items.push({ depth: room.x + room.y - 0.6, key: `walls-${room.zone}`, node: <Walls room={room} id={room.zone} /> });
		here.forEach((r, i) => {
			const slot = slotFor(room, i);
			const view = views[r.id];
			const kind = kindOf(r.template, r.skills);
			const on = view.state === "working";
			if (slot.desk) items.push({ depth: slot.desk.x + slot.desk.y + 1.5, key: `st-${r.id}`, node: <Station kind={kind} x={slot.desk.x} y={slot.desk.y} on={on} /> });
			items.push({ depth: slot.robot.x + slot.robot.y + 0.2, key: `rb-${r.id}`, node: <RobotFigure robot={r} view={view} x={slot.robot.x} y={slot.robot.y} selected={selected === r.id} walking={(walking[r.id] ?? 0) > now} onSelect={() => onSelect(r.id)} onFile={(f) => void onFile(r, f)} /> });
		});
		// растения и мелочь для уюта
		items.push({ depth: room.x + room.w - 0.4 + room.y + 0.6, key: `pl-${room.zone}`, node: <Plant x={room.x + room.w - 0.5} y={room.y + 0.6} big /> });
		if (room.row === 0) items.push({ depth: room.x + 0.5 + room.y + room.d - 0.6, key: `pl2-${room.zone}`, node: <Plant x={room.x + 0.5} y={room.y + room.d - 0.5} /> });
	}
	// коридор: растения, кулер, сервер
	items.push({ depth: 1 + 5.4, key: "c1", node: <Plant x={1} y={5.4} big /> });
	items.push({ depth: 21 + 5.4, key: "c2", node: <Plant x={21} y={5.4} big /> });
	items.push({ depth: 3.2 + 7.2, key: "cooler", node: <g><IsoBox x={3} y={7} w={0.5} d={0.5} h={22} c={C.metal} /><IsoBox x={3.08} y={7.08} z={22} w={0.34} d={0.34} h={10} c={{ top: "#7CC4FF", left: "rgba(124,196,255,0.55)", right: "rgba(124,196,255,0.4)" }} /></g> });
	items.push({ depth: 18 + 6.2, key: "srv", node: <g>{[0, 1].map((i) => <g key={i}><IsoBox x={18 + i * 0.9} y={6.1} w={0.8} d={0.8} h={34} c={C.dark} edge="rgba(198,255,77,0.4)" /><Plane x={18 + i * 0.9} y={6.9} z={34}>{[0, 1, 2, 3, 4].map((k) => <g key={k}><rect x="3" y={3 + k * 6} width="19" height="4" rx="0.6" fill="#1b231e" /><circle className="sc-blink" style={{ animationDelay: `${(i * 5 + k) * 0.37}s` }} cx="18" cy={5 + k * 6} r="1.1" fill={k % 3 === 0 ? "#2DDEB6" : "#c6ff4d"} /></g>)}</Plane></g>)}</g> });
	items.sort((a, b) => a.depth - b.depth);

	const paths = ROOMS.map((room) => ({ room, a: pt(room.x + room.w / 2, room.row === 0 ? room.y + room.d : room.y, 0), b: pt(HUB.x, HUB.y, 0), live: robots.some((r) => r.zone === room.zone && views[r.id]?.state === "working") }));

	return (
		<div className="relative overflow-hidden rounded-14 border border-[rgba(255,255,255,0.09)]" style={{ background: "radial-gradient(ellipse at 50% 38%, #1f2822 0%, #131815 55%, #0c0f0d 100%)" }}>
			<div className="fs-scroll overflow-auto" style={{ maxHeight: "min(80vh, 820px)" }}>
				<svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={{ width: `${zoom * 100}%`, minWidth: 780, display: "block", margin: "0 auto" }} role="img" aria-label={t("title")}>
					<defs>
						<clipPath id="sc-clip"><rect x="2" y="2" width="42" height="17" /></clipPath>
						<linearGradient id="sc-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c6ff4d" stopOpacity="0.28" /><stop offset="1" stopColor="#c6ff4d" stopOpacity="0" /></linearGradient>
						{ROOMS.map((r) => <radialGradient key={`p${r.zone}`} id={`pool-${r.zone}`} cx="0.5" cy="0.5" r="0.7"><stop offset="0" stopColor={ZONE_LIGHT[r.zone]} stopOpacity="0.22" /><stop offset="1" stopColor={ZONE_LIGHT[r.zone]} stopOpacity="0" /></radialGradient>)}
						{ROOMS.map((r) => <linearGradient key={r.zone} id={`win-${r.zone}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2DDEB6" stopOpacity="0.20" /><stop offset="1" stopColor="#c6ff4d" stopOpacity="0.06" /></linearGradient>)}
					</defs>
					{/* коридор */}
					<polygon points={[P(0, 5, 0), P(22, 5, 0), P(22, 8, 0), P(0, 8, 0)].join(" ")} fill={C.corridor} stroke="rgba(255,255,255,0.05)" />
					{paths.map(({ room, a, b, live }) => (
						<g key={room.zone}>
							<line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#c6ff4d" strokeOpacity={live ? 0.55 : 0.18} strokeWidth="1.5" strokeDasharray="6 6" className={live ? "sc-dash" : undefined} />
							{live && <circle r="3.2" fill="#c6ff4d"><animateMotion dur="2.4s" repeatCount="indefinite" path={`M${b[0]},${b[1]} L${a[0]},${a[1]}`} /></circle>}
						</g>
					))}
					{ROOMS.map((room) => <Floor key={room.zone} room={room} hot={hotZone === room.zone} active={robots.some((r) => r.zone === room.zone && views[r.id]?.state === "working")} />)}
					<Hub boss={bossBusy} working={bossBusy} onFocus={onBoss} />
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
