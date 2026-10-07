"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbMinus, TbPlus } from "react-icons/tb";
import { useOfficeStore, type Robot, type Zone } from "@/store/useOfficeStore";
import { useDragKit } from "../dragKit";
import { ACCENT_HEX, type RobotView, titleOf, viewOf } from "../theme";
import { HUB, ROOMS, SCENE_H, SCENE_W, TH, TW, pt, slotFor } from "./iso";
import { COFFEE, LOUNGE, SERVER } from "./layout";
import { OfficeSim, type Mode, type RobotInput } from "./sim";
import Bot from "./Bot";
import SceneDefs, { ZONE_LIGHT } from "./defs";
import { BackWalls, CoffeeBar, FloorSlab, Lounge, ServerRoom, ZonePad, ZoneSign } from "./furniture";
import { Chair, Plane, Plant } from "./prims";
import { Station, kindOf } from "./stations";

// Живой открытый офис в изометрии. Роботы — «агенты» (sim.ts): у кого есть поручение — сидит за своим столом и печатает, у кого нет — ходит:
// за кофе, на диван, к серверной, к Айрис. Сцена рисуется один раз, а положение и поза роботов меняются прямо в DOM каждый кадр (без перерисовки React).
// Нажатие выбирает робота; перетаскивание — на зону (он идёт к новому столу); на робота можно бросить карточку поручения или текстовый файл.
const MAX_FILE = 40 * 1024;
const TEXT_FILE = /\.(txt|csv|tsv|md|json|xml|log)$/i;
const R2 = Math.SQRT2;
const S = 1.0; // масштаб спрайта робота в сцене

interface Item { depth: number; key: string; node: React.ReactNode }
interface Handle { pos: SVGGElement; pose: SVGGElement }

function Hub({ boss, onFocus }: { boss: boolean; onFocus: () => void }) {
	const [cx, cy] = pt(HUB.x, HUB.y, 0);
	const ell = (r: number, z = 0) => ({ cx, cy: cy - z, rx: r * TW * 0.5 * R2, ry: r * TH * 0.5 * R2 });
	return (
		<g data-drop-robot="iris" onClick={onFocus} style={{ cursor: "pointer" }}>
			<ellipse {...ell(3.3)} fill="url(#g-holo)" opacity="0.55" />
			<ellipse {...ell(3.1)} fill="none" stroke="#c6ff4d" strokeOpacity="0.45" strokeWidth="1.4" strokeDasharray="4 7" className="sc-dash" />
			<ellipse {...ell(2.45)} fill="#0b0f0d" stroke="#c6ff4d" strokeOpacity="0.8" strokeWidth="1.8" filter="url(#f-glow)" />
			<ellipse {...ell(2.0)} fill="#121815" stroke="rgba(198,255,77,0.35)" strokeWidth="1" />
			<ellipse {...ell(1.55, 0)} fill="#0f1411" />
			<rect x={cx - ell(1.55).rx} y={cy - 16} width={ell(1.55).rx * 2} height="16" fill="url(#bt-metal)" />
			<line x1={cx - ell(1.55).rx} y1={cy - 8} x2={cx + ell(1.55).rx} y2={cy - 8 + 0.01} stroke="rgba(198,255,77,0.35)" strokeWidth="1" />
			<ellipse {...ell(1.55, 16)} fill="#27322b" stroke="#c6ff4d" strokeOpacity="0.9" strokeWidth="1.6" filter="url(#f-glow)" />
			<ellipse {...ell(1.0, 16)} fill="rgba(198,255,77,0.18)" className={boss ? "sc-pulse" : undefined} />
			<rect x={cx - ell(1.0).rx} y={cy - 16 - 120} width={ell(1.0).rx * 2} height="120" fill="url(#g-beam)" opacity="0.55" style={{ pointerEvents: "none" }} />
			<g className="sc-float" style={{ pointerEvents: "none" }}>
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

function Actor({ robot, view, selected, register, onSelect, onFile }: { robot: Robot; view: RobotView; selected: boolean; register: (id: string, h: Handle | null) => void; onSelect: () => void; onFile: (f: File) => void }) {
	const t = useTranslations("office");
	const drag = useDragKit();
	const { canEdit, ai } = useOfficeStore();
	const posRef = useRef<SVGGElement>(null);
	const poseRef = useRef<SVGGElement>(null);
	useEffect(() => {
		if (posRef.current && poseRef.current) register(robot.id, { pos: posRef.current, pose: poseRef.current });
		return () => register(robot.id, null);
	}, [robot.id, register]);
	const over = drag.over?.type === "robot" && drag.over.id === robot.id;
	const color = view.state === "working" ? "#c6ff4d" : view.state === "waiting" ? "#F4A100" : view.state === "failed" ? "#EB5757" : "#8c948b";
	const badge = view.state === "waiting" ? "!" : view.state === "failed" ? "×" : "";
	const name = robot.name.length > 9 ? `${robot.name.slice(0, 8)}…` : robot.name;
	const pillW = Math.max(40, name.length * 5.8 + 20);
	const task = view.running?.text?.replace(/\s+/g, " ").trim() ?? "";
	const bubble = view.state === "working" ? (task ? (task.length > 24 ? `${task.slice(0, 23)}…` : task) : "…") : "";
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
				<g transform={`translate(0 ${-98 * S - 8})`} style={{ pointerEvents: "none" }} className="sc-float">
					<rect x={-bw / 2} y="-9" width={bw} height="17" rx="8.5" fill="rgba(10,14,12,0.92)" stroke="#c6ff4d" strokeOpacity="0.8" filter="url(#f-glow)" />
					<path d="M-3 8 L0 12 L3 8 Z" fill="rgba(10,14,12,0.92)" stroke="#c6ff4d" strokeOpacity="0.8" />
					<text x="0" y="3.2" textAnchor="middle" fontSize="9" fontWeight="600" fill="#e6f5c8">{bubble}</text>
				</g>
			)}
			{badge && (
				<g transform={`translate(18 ${-98 * S})`} style={{ pointerEvents: "none" }}>
					<circle r="8" fill="#0d110f" stroke={color} strokeWidth="1.4" />
					<text x="0" y="3.6" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{badge}</text>
				</g>
			)}
			<g transform="translate(0 15)" style={{ pointerEvents: "none" }}>
				<rect x={-pillW / 2} y="-7" width={pillW} height="14" rx="7" fill="rgba(10,14,12,0.82)" stroke={selected ? "#c6ff4d" : "rgba(255,255,255,0.14)"} />
				<circle cx={-pillW / 2 + 8} cy="0" r="2.3" fill={robot.enabled ? color : "#6b736a"} />
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
	const { robots, tasks, selected, assign } = useOfficeStore();
	const [zoom, setZoom] = useState(1);
	const [depths, setDepths] = useState<Record<string, number>>({});
	const handles = useRef(new Map<string, Handle>());
	const sim = useRef<OfficeSim | null>(null);
	if (!sim.current) sim.current = new OfficeSim();
	const inputs = useRef<RobotInput[]>([]);
	const staticDepths = useRef<number[]>([]);
	const now = Date.now();

	const views = useMemo(() => Object.fromEntries(robots.map((r) => [r.id, viewOf(r, tasks, now)])), [robots, tasks, now]);
	const bossBusy = tasks.some((x) => x.robot === "iris" && (x.status === "running" || x.status === "queued"));

	// что делает каждый робот: работает/ждёт — сидит за столом, выключен — спит, свободен — гуляет по офису
	inputs.current = useMemo(() => {
		const seen: Record<string, number> = {};
		return robots.map((r): RobotInput => {
			const index = seen[r.zone] ?? 0;
			seen[r.zone] = index + 1;
			const st = views[r.id]?.state;
			const mode: Mode = !r.enabled ? "sleep" : st === "idle" ? "roam" : "desk";
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

	const hotZone = drag.payload?.kind === "robot" && drag.over?.type === "zone" ? drag.over.id : null;
	const zoneLive = (z: Zone) => robots.some((r) => r.zone === z && views[r.id]?.state === "working");
	const items: Item[] = [];
	const counts: Record<string, number> = {};
	for (const room of ROOMS) {
		const here = robots.filter((r) => r.zone === room.zone);
		counts[room.zone] = here.length;
		here.forEach((r, i) => {
			const slot = slotFor(room, i);
			const on = views[r.id]?.state === "working";
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
	items.push({ depth: HUB.x + HUB.y - 0.5, key: "hub", node: <Hub boss={bossBusy} onFocus={onBoss} /> });
	([[0.7, 0.9], [23.3, 0.9], [0.7, 8.6], [23.3, 8.6], [0.7, 17.3], [23.3, 17.3], [7.6, 6.4], [15.6, 6.4], [8.2, 12.4], [15.3, 12.4], [11.5, 17.3], [8.0, 17.3]] as [number, number][]).forEach(([x, y], i) => items.push({ depth: x + y, key: `pl${i}`, node: <Plant x={x} y={y} big={i < 6} /> }));
	staticDepths.current = items.map((i) => i.depth).sort((a, b) => a - b);
	// роботы: глубина — по последнему снимку; новому роботу — по месту стола
	robots.forEach((r, ri) => {
		const input = inputs.current[ri];
		const room = ROOMS.find((x) => x.zone === r.zone)!;
		const seat = slotFor(room, input?.index ?? 0).robot;
		items.push({
			depth: depths[r.id] ?? seat.x + seat.y + 0.15, key: `rb-${r.id}`,
			node: <Actor robot={r} view={views[r.id]} selected={selected === r.id} register={register} onSelect={() => onSelect(r.id)} onFile={(f) => void onFile(r, f)} />,
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
					{/* Айрис раздаёт работу: пунктир к зонам с работающими роботами и бегущие кубы данных */}
					{ROOMS.map((room) => {
						const live = zoneLive(room.zone);
						const a = pt(room.x + room.w / 2, room.y + room.d / 2, 0), b = pt(HUB.x, HUB.y, 0);
						return (
							<g key={`ln-${room.zone}`} style={{ pointerEvents: "none" }}>
								<line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ZONE_LIGHT[room.zone]} strokeOpacity={live ? 0.5 : 0.1} strokeWidth="1.4" strokeDasharray="5 6" className={live ? "sc-dash" : undefined} />
								{live && (
									<g filter="url(#f-glow)">
										<g transform="translate(0 -6)"><polygon points="0,-5 7,-1.5 0,2 -7,-1.5" fill="#d8ff7e" /><polygon points="-7,-1.5 0,2 0,9 -7,5.5" fill="#8fc92b" /><polygon points="7,-1.5 0,2 0,9 7,5.5" fill="#5f8f1a" /></g>
										<animateMotion dur="2.6s" repeatCount="indefinite" path={`M${b[0]},${b[1]} L${a[0]},${a[1]}`} />
									</g>
								)}
							</g>
						);
					})}
					<BackWalls />
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
