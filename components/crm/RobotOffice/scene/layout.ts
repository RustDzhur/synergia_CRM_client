import { CELLS, GRID_D, GRID_W, HUB, ROOMS, slotFor } from "./iso";

// Что где стоит в офисе и куда можно ходить: точки интереса (кофе, диван, окно серверной…) и поиск пути между ними.
// Координаты — в клетках пола; робот идёт по центрам клеток, обходя столы и мебель.

export type Pose = "sit" | "stand" | "walk" | "coffee" | "sleep";
export interface Poi { id: string; x: number; y: number; pose: Pose; face: "front" | "back"; flip: boolean; dwell: [number, number]; kind: "coffee" | "lounge" | "server" | "hub" | "walk" | "plant" }

const cell = (id: string) => CELLS.find((c) => c.id === id)!;
const coffee = cell("coffee"), server = cell("server");

// Кофе-пойнт: стойка у задней стены, перед ней стоят с чашкой
export const COFFEE = { x: coffee.x + 1.2, y: coffee.y + 0.5, w: 3.4, d: 1 };
// Лаунж справа от кофе-пойнта: диван и столик
export const LOUNGE = { sofa: { x: coffee.x + 5.0, y: coffee.y + 1.8, w: 0.9, d: 3.0 }, table: { x: coffee.x + 6.4, y: coffee.y + 2.6, w: 0.9, d: 1.2 } };
// Серверная: стеклянный шкаф у задней стены острова
export const SERVER = { x: server.x + 1.0, y: server.y + 0.6, w: 6.0, d: 1.1 };

export const POIS: Poi[] = [
    { id: "coffee1", kind: "coffee", x: coffee.x + 1.9, y: coffee.y + 2.1, pose: "coffee", face: "back", flip: false, dwell: [5, 9] },
    { id: "coffee2", kind: "coffee", x: coffee.x + 3.0, y: coffee.y + 2.1, pose: "coffee", face: "back", flip: false, dwell: [5, 9] },
    { id: "coffee3", kind: "coffee", x: coffee.x + 4.1, y: coffee.y + 2.1, pose: "coffee", face: "back", flip: false, dwell: [5, 9] },
    { id: "sofa1", kind: "lounge", x: LOUNGE.sofa.x + 0.6, y: LOUNGE.sofa.y + 0.8, pose: "sit", face: "front", flip: false, dwell: [8, 16] },
    { id: "sofa2", kind: "lounge", x: LOUNGE.sofa.x + 0.6, y: LOUNGE.sofa.y + 2.1, pose: "sit", face: "front", flip: false, dwell: [8, 16] },
    { id: "srv1", kind: "server", x: server.x + 2.2, y: server.y + 2.2, pose: "stand", face: "back", flip: false, dwell: [4, 8] },
    { id: "srv2", kind: "server", x: server.x + 5.0, y: server.y + 2.2, pose: "stand", face: "back", flip: false, dwell: [4, 8] },
    { id: "hub1", kind: "hub", x: HUB.x - 3.6, y: HUB.y + 0.6, pose: "stand", face: "front", flip: false, dwell: [3, 6] },
    { id: "hub2", kind: "hub", x: HUB.x + 3.6, y: HUB.y - 0.6, pose: "stand", face: "front", flip: true, dwell: [3, 6] },
    { id: "hub3", kind: "hub", x: HUB.x, y: HUB.y + 3.4, pose: "stand", face: "back", flip: false, dwell: [3, 6] },
    ...[[7.4, 6.2], [16.8, 6.2], [7.4, 12.0], [16.8, 12.0], [12, 5.7], [8.2, 3.2], [15.8, 8.8], [4, 11.9], [20, 6.0], [12, 14.6], [6.5, 9], [18, 9.2]].map(([x, y], i) => ({ id: `walk${i}`, kind: "walk" as const, x, y, pose: "stand" as Pose, face: (i % 2 ? "front" : "back") as "front" | "back", flip: i % 3 === 0, dwell: [1.5, 4] as [number, number] })),
];

/** Клетки, через которые нельзя ходить: платформа Айрис, стойка, диван, шкафы серверной и столы (занятые рабочие места). */
export function staticBlocked(): Set<string> {
    const blocked = new Set<string>();
    const rect = (x: number, y: number, w: number, d: number) => { for (let i = Math.floor(x); i < Math.ceil(x + w); i++) for (let j = Math.floor(y); j < Math.ceil(y + d); j++) blocked.add(`${i},${j}`); };
    for (let i = 0; i < GRID_W; i++) for (let j = 0; j < GRID_D; j++) if (Math.hypot(i + 0.5 - HUB.x, j + 0.5 - HUB.y) < 2.5) blocked.add(`${i},${j}`);
    rect(COFFEE.x, COFFEE.y, COFFEE.w, COFFEE.d); rect(LOUNGE.sofa.x, LOUNGE.sofa.y, LOUNGE.sofa.w, LOUNGE.sofa.d); rect(LOUNGE.table.x, LOUNGE.table.y, LOUNGE.table.w, LOUNGE.table.d); rect(SERVER.x, SERVER.y, SERVER.w, SERVER.d);
    return blocked;
}

export const deskBlocked = (zones: Record<string, number>) => {
    const out = new Set<string>();
    for (const room of ROOMS) for (let i = 0; i < (zones[room.zone] ?? 0); i++) {
        const s = slotFor(room, i);
        if (s.desk) for (let x = Math.floor(s.desk.x); x < Math.ceil(s.desk.x + 2); x++) out.add(`${x},${Math.floor(s.desk.y)}`);
    }
    return out;
};

type Pt = [number, number];
const key = (x: number, y: number) => `${x},${y}`;

/** Кратчайший путь по клеткам (A*, 8 направлений без «срезания» углов). Возвращает центры клеток; пусто — пути нет. */
export function findPath(from: Pt, to: Pt, blocked: Set<string>): Pt[] {
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, Math.floor(v)));
    const open = (p: Pt): Pt => {
        // если старт или цель стоит на занятой клетке (кресло, стол) — берём ближайшую свободную рядом
        const c: Pt = [clamp(p[0], GRID_W), clamp(p[1], GRID_D)];
        if (!blocked.has(key(c[0], c[1]))) return c;
        for (let r = 1; r < 5; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = c[0] + dx, y = c[1] + dy; if (x >= 0 && y >= 0 && x < GRID_W && y < GRID_D && !blocked.has(key(x, y))) return [x, y]; }
        return c;
    };
    const s = open(from), g = open(to);
    if (s[0] === g[0] && s[1] === g[1]) return [];
    const h = (x: number, y: number) => Math.hypot(x - g[0], y - g[1]);
    const best = new Map<string, number>([[key(s[0], s[1]), 0]]);
    const prev = new Map<string, string>();
    const queue: { x: number; y: number; f: number }[] = [{ x: s[0], y: s[1], f: h(s[0], s[1]) }];
    while (queue.length) {
        queue.sort((a, b) => a.f - b.f);
        const cur = queue.shift()!;
        if (cur.x === g[0] && cur.y === g[1]) {
            const path: Pt[] = [];
            let k: string | undefined = key(cur.x, cur.y);
            while (k && k !== key(s[0], s[1])) { const [x, y] = k.split(",").map(Number); path.unshift([x + 0.5, y + 0.5]); k = prev.get(k); }
            return path;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const nx = cur.x + dx, ny = cur.y + dy;
            if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_D || blocked.has(key(nx, ny))) continue;
            if (dx && dy && (blocked.has(key(cur.x + dx, cur.y)) || blocked.has(key(cur.x, cur.y + dy)))) continue;
            const cost = (best.get(key(cur.x, cur.y)) ?? 0) + (dx && dy ? 1.414 : 1);
            if (cost < (best.get(key(nx, ny)) ?? Infinity)) { best.set(key(nx, ny), cost); prev.set(key(nx, ny), key(cur.x, cur.y)); queue.push({ x: nx, y: ny, f: cost + h(nx, ny) }); }
        }
    }
    return [];
}
