"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbMinus, TbPlus } from "react-icons/tb";
import { useOfficeStore, type Robot, type Zone } from "@/store/useOfficeStore";
import { useDragKit } from "../dragKit";
import { ACCENT_HEX, type RobotView, isMonitor, isPlatformRobot, titleOf, viewOf } from "../theme";
import { HUB, ROOMS, SCENE_H, SCENE_W, pt, slotFor } from "./iso";
import { COFFEE, LOUNGE, SERVER } from "./layout";
import { OfficeSim, type Mode, type RobotInput } from "./sim";
import Bot from "./Bot";
import SceneDefs, { ZONE_LIGHT } from "./defs";
import { BackWalls, CoffeeBar, FloorSlab, Lounge, ServerRoom, ServiceGlass, ZoneGlass, ZonePad, ZoneSign } from "./furniture";
import Flows, { type Flow } from "./flows";
import Hub from "./hub";
import { Chair, Plant } from "./prims";
import { Station, kindOf } from "./stations";

// Живой открытый офис в изометрии. Роботы — «агенты» (sim.ts): у кого есть поручение — сидит за своим столом и печатает, у кого нет — ходит:
// за кофе, на диван, к серверной, к Айрис. Сцена рисуется один раз, а положение и поза роботов меняются прямо в DOM каждый кадр (без перерисовки React).
// Нажатие выбирает робота; перетаскивание — на зону (он идёт к новому столу); на робота можно бросить карточку поручения или текстовый файл.
const MAX_FILE = 40 * 1024;
const TEXT_FILE = /\.(txt|csv|tsv|md|json|xml|log)$/i;
const S = 1.12; // масштаб спрайта робота в сцене

interface Item { depth: number; key: string; node: React.ReactNode }
interface Handle { pos: SVGGElement; pose: SVGGElement }

function Actor({ robot, view, fresh, lane, selected, register, onSelect, onFile }: { robot: Robot; view: RobotView; fresh: boolean; lane: number; selected: boolean; register: (id: string, h: Handle | null) => void; onSelect: () => void; onFile: (f: File) => void }) {
	const t = useTranslations("office");
	const drag = useDragKit();
	const { canEdit, ai, platform } = useOfficeStore();
	const posRef = useRef<SVGGElement>(null);
	const poseRef = useRef<SVGGElement>(null);
	useEffect(() => {
		if (posRef.current && poseRef.current) register(robot.id, { pos: posRef.current, pose: poseRef.current });
		return () => register(robot.id, null);
	}, [robot.id, register]);
	const over = drag.over?.type === "robot" && drag.over.id === robot.id;
	const color = view.state === "working" ? "#c6ff4d" : view.state === "waiting" ? "#F4A100" : view.state === "failed" ? "#EB5757" : "#8c948b";
	const icon = view.monitor?.kind === "errors" ? (view.state === "working" ? "!" : "") : view.state === "working" ? "gear" : view.state === "waiting" ? "!" : view.state === "failed" ? "×" : fresh ? "ok" : "";
	const iconColor = icon === "ok" ? "#2DDEB6" : view.monitor?.kind === "errors" ? "#EB5757" : color;
	const name = robot.name.length > 9 ? `${robot.name.slice(0, 8)}…` : robot.name;
	const pillW = Math.max(40, name.length * 5.8 + 20);
	const task = view.running?.text?.replace(/\s+/g, " ").trim() ?? "";
	const watch = view.monitor ? (view.monitor.text.replace(/\s+/g, " ").trim() || t(view.monitor.kind === "errors" ? "monWatching" : "monSeoIdle")) : "";
	const bubble = view.monitor ? (watch.length > 26 ? `${watch.slice(0, 25)}…` : watch) : view.state === "working" ? (task ? (task.length > 24 ? `${task.slice(0, 23)}…` : task) : "…") : "";
	const telegram = robot.template === "p_errors" && !!platform?.errors.telegram;
	const bw = bubble ? Math.max(30, bubble.length * 5.4 + 16) : 0;
	return (
		<g
			ref={posRef} transform="translate(-9999 -9999)" data-drop-robot={robot.id}
			style={{ cursor: "pointer", opacity: robot.enabled ? 1 : 0.7 }}
			role="button" tabIndex={0} aria-label={`${robot.name}, ${titleOf(t, robot)}`}
			onClick={() => { if (!drag.justDragged()) onSelect(); }}
			onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
			onPointerDown={canEdit ? (e) => drag.start(e, { kind: "robot", id: robot.id, label: robot.name }) : undefined}
			onDragOver={(e) => { if (canEdit && ai && e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
			onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f && canEdit && ai) { e.preventDefault(); onFile(f); } }}>
			{(selected || over) && <ellipse cx="0" cy="2" rx="26" ry="11.5" fill="rgba(198,255,77,0.14)" stroke="#c6ff4d" strokeWidth="2" filter="url(#f-glow)" className={selected ? undefined : "sc-pulse"} />}
			<rect x="-24" y={-92 * S} width="48" height={92 * S + 10} fill="transparent" />
			<g ref={poseRef} data-pose="stand" data-face="front" data-flip="0" data-work="0" style={{ pointerEvents: "none" }}>
				<g transform={`translate(${-40 * S} ${-97 * S}) scale(${S})`}><Bot accent={robot.accent} state={view.state} /></g>
			</g>
			{bubble && (
				<g transform={`translate(0 ${-98 * S - 12 - lane * 21})`} style={{ pointerEvents: "none" }} className="sc-float">
					<rect x={-bw / 2} y="-9" width={bw} height="17" rx="8.5" fill="rgba(10,14,12,0.92)" stroke="#c6ff4d" strokeOpacity="0.8" filter="url(#f-glow)" />
					<path d="M-3 8 L0 12 L3 8 Z" fill="rgba(10,14,12,0.92)" stroke="#c6ff4d" strokeOpacity="0.8" />
					<text x="0" y="3.2" textAnchor="middle" fontSize="9" fontWeight="600" fill="#e6f5c8">{bubble}</text>
				</g>
			)}
			{icon && (
				<g transform={`translate(17 ${-96 * S})`} style={{ pointerEvents: "none" }}>
					<circle r="9" fill="#0b0f0d" stroke={iconColor} strokeWidth="1.5" filter="url(#f-glow)" />
					{icon === "gear" ? <g className="sc-spin" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round"><circle r="2.6" fill="none" /><path d="M0-6V-4M0 4V6M-6 0H-4M4 0H6M-4.2-4.2l1.4 1.4M2.8 2.8l1.4 1.4M4.2-4.2l-1.4 1.4M-2.8 2.8l-1.4 1.4" /></g>
						: icon === "ok" ? <path d="M-4 0.5l2.8 3L4.5-3.5" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
						: <text x="0" y="4" textAnchor="middle" fontSize="12" fontWeight="700" fill={iconColor}>{icon}</text>}
				</g>
			)}
			<g transform="translate(0 15)" style={{ pointerEvents: "none" }}>
				<rect x={-pillW / 2} y="-7" width={pillW} height="14" rx="7" fill="rgba(10,14,12,0.82)" stroke={selected ? "#c6ff4d" : "rgba(255,255,255,0.14)"} />
				<circle cx={-pillW / 2 + 8} cy="0" r="2.3" fill={robot.enabled ? color : "#6b736a"} />
				{telegram && <g transform={`translate(${pillW / 2 + 9} 0)`}><circle r="7.5" fill="#0b0f0d" stroke="#2DDEB6" strokeWidth="1.2" filter="url(#f-glow)" /><polygon points="-4.2,0.2 4,-3.6 2.2,4 -0.2,1.6 -1.6,3.4 -1.8,0.9" fill="#2DDEB6" /></g>}
				<text x={-pillW / 2 + 14} y="3.3" fontSize="9" fontWeight="600" fill="#e6ecdf">{name}</text>
			</g>
			<title>{`${robot.name} — ${titleOf(t, robot)}`}</title>
		</g>
	);
}

export default function OfficeScene({ onSelect, onBoss }: { onSelect: (id: string) => void; onBoss: () => void }) {
	const t = useTranslations("office");
	const locale = useLocale();
	const drag = useDragKit();
	const { robots, tasks, selected, assign, platform } = useOfficeStore();
	const [zoom, setZoom] = useState(1);
	const [depths, setDepths] = useState<Record<string, number>>({});
	const handles = useRef(new Map<string, Handle>());
	const sim = useRef<OfficeSim | null>(null);
	if (!sim.current) sim.current = new OfficeSim();
	const inputs = useRef<RobotInput[]>([]);
	const staticDepths = useRef<number[]>([]);
	const now = Date.now();

	const views = useMemo(() => Object.fromEntries(robots.map((r) => [r.id, viewOf(r, tasks, now, platform)])), [robots, tasks, now, platform]);
	const bossBusy = tasks.some((x) => x.robot === "iris" && (x.status === "running" || x.status === "queued"));

	// что делает каждый робот: работает/ждёт — сидит за столом, выключен — спит, свободен — гуляет по офису
	inputs.current = useMemo(() => {
		const seen: Record<string, number> = {};
		return robots.map((r): RobotInput => {
			const index = seen[r.zone] ?? 0;
			seen[r.zone] = index + 1;
			const st = views[r.id]?.state;
			const mode: Mode = !r.enabled ? "sleep" : isPlatformRobot(r) || st !== "idle" ? "desk" : "roam"; // роботы платформы сидят за компьютером всегда
			return { id: r.id, zone: r.zone, index, mode, working: st === "working" };
		});
	}, [robots, views]);

	const register = useCallback((id: string, h: Handle | null) => { if (h) handles.current.set(id, h); else handles.current.delete(id); }, []);

	// кадр анимации: двигаем роботов и переключаем позы прямо в DOM
	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const frame = (ts: number) => {
			const dt = Math.min(0.1, (ts - last) / 1000);
			last = ts;
			const out = sim.current!.update(dt, Date.now(), inputs.current);
			out.forEach((v, id) => {
				const h = handles.current.get(id);
				if (!h) return;
				const [sx, sy] = pt(v.x, v.y, 0);
				h.pos.setAttribute("transform", `translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);
				if (h.pose.dataset.pose !== v.pose) h.pose.dataset.pose = v.pose;
				if (h.pose.dataset.face !== v.face) h.pose.dataset.face = v.face;
				const flip = v.flip ? "1" : "0";
				if (h.pose.dataset.flip !== flip) h.pose.dataset.flip = flip;
				const work = v.work ? "1" : "0";
				if (h.pose.dataset.work !== work) h.pose.dataset.work = work;
			});
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	}, []);

	// порядок «дальше → ближе» для роботов среди мебели: пересчитываем несколько раз в секунду и перерисовываем, только если порядок изменился
	useEffect(() => {
		let sig = "";
		const timer = setInterval(() => {
			const list: [string, number][] = [];
			sim.current!.agents.forEach((a, id) => list.push([id, a.x + a.y + 0.15]));
			list.sort((a, b) => a[1] - b[1]);
			const ranks = list.map(([id, d]) => `${id}:${staticDepths.current.filter((s) => s < d).length}`).join("|");
			if (ranks === sig) return;
			sig = ranks;
			setDepths(Object.fromEntries(list));
		}, 220);
		return () => clearInterval(timer);
	}, []);

	async function onFile(r: Robot, file: File) {
		if (file.size > MAX_FILE) return void toast.error(t("fileTooBig"));
		if (!(TEXT_FILE.test(file.name) || file.type.startsWith("text/"))) return void toast.error(t("fileNotText"));
		const body = (await file.text()).slice(0, MAX_FILE);
		const task = await assign(r.id, `${t("fileTask", { name: file.name })}\n\n${body}`, locale, "drop");
		if (task) toast.success(t("taskAssigned", { name: r.name }));
	}

	const freshOf = (id: string) => { const last = tasks.find((x) => x.robot === id); return !!last && last.status === "done" && now - Date.parse(last.finishedAt ?? last.createdAt) < 3 * 60 * 1000; };
	const hotZone = drag.payload?.kind === "robot" && drag.over?.type === "zone" ? drag.over.id : null;
	const zoneLive = (z: Zone) => robots.some((r) => r.zone === z && !isMonitor(r) && views[r.id]?.state === "working");
	const flows: Flow[] = ROOMS.map((room) => ({ id: `z-${room.zone}`, to: [room.x + room.w / 2, room.y + room.d / 2 + 0.5] as [number, number], color: ZONE_LIGHT[room.zone], live: zoneLive(room.zone) }));
	robots.forEach((r, ri) => { if (views[r.id]?.state !== "working" || isMonitor(r)) return; const room = ROOMS.find((x) => x.zone === r.zone)!; const seat = slotFor(room, inputs.current[ri]?.index ?? 0).robot; flows.push({ id: `r-${r.id}`, to: [seat.x, seat.y], color: ACCENT_HEX[r.accent], live: true, strong: true }); });
	const items: Item[] = [];
	const counts: Record<string, number> = {};
	for (const room of ROOMS) {
		const here = robots.filter((r) => r.zone === room.zone);
		counts[room.zone] = here.length;
		here.forEach((r, i) => {
			const slot = slotFor(room, i);
			const on = views[r.id]?.state === "working" || (isMonitor(r) && r.enabled); // экраны наблюдателей всегда включены
			if (slot.desk && slot.chair) {
				items.push({ depth: slot.desk.x + slot.desk.y + 1.5, key: `st-${r.id}`, node: <Station kind={kindOf(r.template, r.skills)} x={slot.desk.x} y={slot.desk.y} on={on} /> });
				items.push({ depth: slot.chair.x + slot.chair.y + 0.62, key: `ch-${r.id}`, node: <Chair x={slot.chair.x} y={slot.chair.y} accent={ACCENT_HEX[r.accent]} /> });
			}
		});
	}
	// общие зоны и мелочь
	items.push({ depth: COFFEE.x + COFFEE.w / 2 + COFFEE.y + COFFEE.d / 2, key: "coffee", node: <CoffeeBar /> });
	items.push({ depth: LOUNGE.sofa.x + LOUNGE.sofa.w / 2 + LOUNGE.sofa.y + LOUNGE.sofa.d / 2 + 0.2, key: "sofa", node: <Lounge /> });
	items.push({ depth: SERVER.x + SERVER.w / 2 + SERVER.y + SERVER.d / 2, key: "server", node: <ServerRoom /> });
	items.push({ depth: HUB.x + HUB.y + 0.4, key: "hub", node: <Hub boss={bossBusy} onFocus={onBoss} /> });
	([[0.7, 0.9], [23.3, 0.9], [0.7, 8.6], [23.3, 8.6], [0.7, 17.3], [23.3, 17.3], [7.6, 6.4], [15.6, 6.4], [8.2, 12.4], [15.3, 12.4], [11.5, 17.3], [8.0, 17.3]] as [number, number][]).forEach(([x, y], i) => items.push({ depth: x + y, key: `pl${i}`, node: <Plant x={x} y={y} big={i < 6} /> }));
	staticDepths.current = items.map((i) => i.depth).sort((a, b) => a - b);
	// роботы: глубина — по последнему снимку; новому роботу — по месту стола
	robots.forEach((r, ri) => {
		const input = inputs.current[ri];
		const room = ROOMS.find((x) => x.zone === r.zone)!;
		const seat = slotFor(room, input?.index ?? 0).robot;
		items.push({
			depth: depths[r.id] ?? seat.x + seat.y + 0.15, key: `rb-${r.id}`,
			node: <Actor robot={r} view={views[r.id]} fresh={freshOf(r.id)} lane={(inputs.current[ri]?.index ?? 0) % 2} selected={selected === r.id} register={register} onSelect={() => onSelect(r.id)} onFile={(f) => void onFile(r, f)} />,
		});
	});
	items.sort((a, b) => a.depth - b.depth);

	return (
		<div className="relative overflow-hidden rounded-14 border border-[rgba(255,255,255,0.09)]" style={{ background: "radial-gradient(ellipse at 50% 40%, #1f2822 0%, #131815 55%, #0b0e0c 100%)" }}>
			<div className="fs-scroll overflow-auto" style={{ maxHeight: zoom > 1 ? "min(80vh, 820px)" : undefined }}>
				<svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={{ width: `${zoom * 100}%`, minWidth: 720, display: "block", margin: "0 auto" }} role="img" aria-label={t("title")}>
					<SceneDefs />
					<FloorSlab />
					{ROOMS.map((room) => <ZonePad key={room.zone} room={room} hot={hotZone === room.zone} live={zoneLive(room.zone)} count={counts[room.zone] ?? 0} />)}
					{/* Айрис раздаёт работу: неоновые линии к зонам и к рабочим местам занятых роботов, по ним бегут кубы данных */}
					<Flows flows={flows} />
					<BackWalls />
					{ROOMS.map((room) => <ZoneGlass key={room.zone} room={room} />)}
					<ServiceGlass />
					{ROOMS.map((room) => <ZoneSign key={room.zone} room={room} label={t(`zone_${room.zone as Zone}`)} count={counts[room.zone] ?? 0} hot={hotZone === room.zone} />)}
					<g>{items.map((it) => <g key={it.key} style={it.key.startsWith("rb-") || it.key === "hub" ? undefined : { pointerEvents: "none" }}>{it.node}</g>)}</g>
				</svg>
			</div>
			<div className="absolute bottom-12 left-12 flex items-center gap-4 rounded-10 border border-inkLine bg-[rgba(13,17,15,0.85)] p-4 backdrop-blur">
				<button type="button" aria-label="−" onClick={() => setZoom((z) => Math.max(1, +(z - 0.3).toFixed(1)))} className="flex h-30 w-30 items-center justify-center rounded-8 text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.06)]"><TbMinus size={16} /></button>
				<span className="w-36 text-center text-11 text-[#8c948b]">{Math.round(zoom * 100)}%</span>
				<button type="button" aria-label="+" onClick={() => setZoom((z) => Math.min(2.8, +(z + 0.3).toFixed(1)))} className="flex h-30 w-30 items-center justify-center rounded-8 text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.06)]"><TbPlus size={16} /></button>
			</div>
		</div>
	);
}
