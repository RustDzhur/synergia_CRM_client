import type { Zone } from "@/store/useOfficeStore";
import { roomOf, slotFor } from "./iso";
import { POIS, type Poi, type Pose, deskBlocked, findPath, staticBlocked } from "./layout";

// Живой офис: каждый робот — «агент» с позицией на полу. Кто работает (есть поручение) — сидит за своим столом и печатает;
// кто свободен — ходит по офису: за кофе, на диван, к окну серверной, поболтать к коллегам. Всё считается в браузере и ни на что не влияет в данных.
export type Mode = "desk" | "roam" | "sleep";
export interface RobotInput { id: string; zone: Zone; index: number; mode: Mode; working: boolean }
export interface AgentView { x: number; y: number; pose: Pose; face: "front" | "back"; flip: boolean; work: boolean; poi?: string }

interface Agent extends AgentView {
    path: [number, number][];
    goalKey: string;
    goal: { x: number; y: number; pose: Pose; face: "front" | "back"; flip: boolean; dwell: [number, number]; poi?: string } | null;
    arrived: boolean;
    dwellUntil: number;
    lastMode: Mode;
}

export const SPEED = 1.9; // клеток в секунду
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class OfficeSim {
    agents = new Map<string, Agent>();
    private blocked = new Set<string>();
    private blockedKey = "";
    private seats = new Map<string, { x: number; y: number; standing: boolean }>();

    /** Какие столы заняты (по числу роботов в зонах) — по ним строятся обходы. */
    private setup(inputs: RobotInput[]) {
        const counts: Record<string, number> = {};
        for (const r of inputs) counts[r.zone] = (counts[r.zone] ?? 0) + 1;
        const k = JSON.stringify(counts);
        if (k !== this.blockedKey) {
            this.blockedKey = k;
            this.blocked = staticBlocked();
            deskBlocked(counts).forEach((c) => this.blocked.add(c));
        }
        this.seats.clear();
        for (const r of inputs) {
            const room = roomOf(r.zone);
            const s = slotFor(room, r.index);
            this.seats.set(r.id, { x: s.robot.x, y: s.robot.y, standing: s.standing });
        }
    }

    seatOf(id: string) { return this.seats.get(id); }

    private pickPoi(taken: Set<string>): Poi {
        const pool = POIS.filter((p) => !taken.has(p.id));
        const weights = pool.map((p) => (p.kind === "coffee" ? 3 : p.kind === "lounge" ? 2.2 : p.kind === "server" ? 1 : p.kind === "hub" ? 1.2 : 1.4));
        let r = Math.random() * weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
        return pool[pool.length - 1] ?? POIS[0];
    }

    /** Один шаг: dt — секунды, now — миллисекунды. Возвращает вид каждого робота для отрисовки. */
    update(dt: number, now: number, inputs: RobotInput[]): Map<string, AgentView> {
        this.setup(inputs);
        const ids = new Set(inputs.map((i) => i.id));
        this.agents.forEach((_, id) => { if (!ids.has(id)) this.agents.delete(id); });
        const taken = new Set<string>();
        this.agents.forEach((a) => { if (a.goal?.poi) taken.add(a.goal.poi); });

        for (const inp of inputs) {
            const seat = this.seats.get(inp.id)!;
            let a = this.agents.get(inp.id);
            if (!a) {
                // новый робот появляется у своего стола, а свободный — сразу где-нибудь гуляет
                const start = inp.mode === "roam" ? POIS[Math.floor(Math.random() * POIS.length)] : { x: seat.x, y: seat.y };
                a = { x: start.x, y: start.y, pose: "stand", face: "front", flip: false, work: false, path: [], goalKey: "", goal: null, arrived: true, dwellUntil: now + rnd(500, 3500), lastMode: inp.mode };
                this.agents.set(inp.id, a);
            }
            // что робот хочет делать
            if (inp.mode !== "roam") {
                const want = `desk:${seat.x.toFixed(2)},${seat.y.toFixed(2)}`;
                if (a.goalKey !== want) { this.goTo(a, want, { x: seat.x, y: seat.y, pose: inp.mode === "sleep" ? "sleep" : seat.standing ? "stand" : "sit", face: "back", flip: false, dwell: [0, 0] }); }
                else if (a.arrived) { a.pose = inp.mode === "sleep" ? "sleep" : seat.standing ? "stand" : "sit"; a.face = "back"; a.flip = false; }
            } else {
                if (a.lastMode !== "roam") { a.dwellUntil = now + 2500; a.goalKey = ""; a.goal = null; } // закончил работу — посидел, потом пошёл гулять
                if (a.arrived && now >= a.dwellUntil) {
                    if (a.goal?.poi) taken.delete(a.goal.poi);
                    const p = this.pickPoi(taken);
                    taken.add(p.id);
                    this.goTo(a, `poi:${p.id}`, { x: p.x, y: p.y, pose: p.pose, face: p.face, flip: p.flip, dwell: p.dwell, poi: p.id });
                }
            }
            a.lastMode = inp.mode;
            a.work = inp.working;
            this.move(a, dt, now);
        }
        const out = new Map<string, AgentView>();
        this.agents.forEach((a, id) => out.set(id, { x: a.x, y: a.y, pose: a.pose, face: a.face, flip: a.flip, work: a.work, poi: a.goal?.poi }));
        return out;
    }

    private goTo(a: Agent, key: string, goal: NonNullable<Agent["goal"]>) {
        a.goalKey = key;
        a.goal = goal;
        a.path = findPath([a.x, a.y], [goal.x, goal.y], this.blocked);
        a.arrived = false;
        if (!a.path.length && Math.hypot(a.x - goal.x, a.y - goal.y) > 0.4) a.path = [[goal.x, goal.y]]; // пути нет (кругом мебель) — идём напрямую
    }

    private move(a: Agent, dt: number, now: number) {
        if (a.arrived) return;
        const target: [number, number] = a.path.length ? a.path[0] : [a.goal!.x, a.goal!.y];
        const dx = target[0] - a.x, dy = target[1] - a.y, dist = Math.hypot(dx, dy);
        const step = Math.max(0, SPEED * dt);
        if (dist > 0.04) {
            a.pose = "walk";
            const sxm = dx - dy, sym = dx + dy;
            if (Math.abs(sym) > 0.05) a.face = sym > 0 ? "front" : "back";
            if (Math.abs(sxm) > 0.05) a.flip = sxm < 0;
        }
        if (dist <= step) {
            a.x = target[0]; a.y = target[1];
            if (a.path.length) { a.path.shift(); if (a.path.length) return; }
            // последний шаг к цели: от центра клетки — к самой точке (кресло, подставка)
            if (a.goal && Math.hypot(a.x - a.goal.x, a.y - a.goal.y) > 0.04) { a.path = [[a.goal.x, a.goal.y]]; return; }
            a.arrived = true;
            if (a.goal) { a.x = a.goal.x; a.y = a.goal.y; a.pose = a.goal.pose; a.face = a.goal.face; a.flip = a.goal.flip; a.dwellUntil = now + rnd(a.goal.dwell[0], a.goal.dwell[1]) * 1000; }
            return;
        }
        if (dist > 1e-9) { a.x += (dx / dist) * step; a.y += (dy / dist) * step; }
    }
}
