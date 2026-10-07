import type { Zone } from "@/store/useOfficeStore";

// Изометрия офиса: плоскость пола — сетка клеток (x вправо-вниз, y влево-вниз), z — высота в пикселях.
// Одна клетка пола = 64×32 пикселя на экране. Всё рисуется в одном SVG; масштаб подгоняет браузер (viewBox).
export const TW = 64;
export const TH = 32;
export const WALL_H = 58;
export const SKEW = 26.565; // atan(1/2): наклон «экрана» на лицевой стороне предмета

/** Точка пола (x, y) на высоте z → координаты картинки до сдвига сцены. */
export const project = (x: number, y: number, z = 0): [number, number] => [((x - y) * TW) / 2, ((x + y) * TH) / 2 - z];

export interface RoomDef { zone: Zone; x: number; y: number; w: number; d: number; col: 0 | 1 | 2; row: 0 | 1 | 2 }
export type CellKind = "zone" | "coffee" | "hub" | "server";
export interface CellDef { id: string; kind: CellKind; zone: Zone | null; x: number; y: number; w: number; d: number; col: 0 | 1 | 2; row: 0 | 1 | 2 }

// Один большой открытый офис 24×18 клеток: сетка 3×3 «островов» по 8×6. По углам и бокам — рабочие зоны, сверху в центре — кофе-пойнт
// и лаунж, справа снизу — серверная, в самом центре — Айрис. Между островами свободный пол: по нему ходят роботы.
export const CELL_W = 8, CELL_D = 6;
const LAYOUT: [CellKind, Zone | null][][] = [
    [["zone", "marketing"], ["coffee", null], ["zone", "service"]],
    [["zone", "sales"], ["hub", null], ["zone", "finance"]],
    [["zone", "office"], ["zone", "warehouse"], ["server", null]],
];
export const CELLS: CellDef[] = LAYOUT.flatMap((rowDef, row) => rowDef.map(([kind, zone], col) => ({ id: zone ?? kind, kind, zone, x: col * CELL_W, y: row * CELL_D, w: CELL_W, d: CELL_D, col: col as 0 | 1 | 2, row: row as 0 | 1 | 2 })));
export const ROOMS: RoomDef[] = CELLS.filter((c) => c.zone).map((c) => ({ zone: c.zone as Zone, x: c.x, y: c.y, w: c.w, d: c.d, col: c.col, row: c.row }));
export const GRID_W = 3 * CELL_W; // 24
export const GRID_D = 3 * CELL_D; // 18
export const HUB = { x: GRID_W / 2, y: GRID_D / 2 }; // центр офиса
const PAD = 24;
// сдвиг, чтобы вся сцена попала в положительные координаты
export const OFF_X = (GRID_D * TW) / 2 + PAD;
export const OFF_Y = WALL_H + 70 + PAD;
export const SCENE_W = Math.round(((GRID_W + GRID_D) * TW) / 2 + PAD * 2);
export const SCENE_H = Math.round(((GRID_W + GRID_D) * TH) / 2 + WALL_H + 70 + PAD * 2 + 28);

/** Точка сцены в итоговых координатах SVG. */
export const pt = (x: number, y: number, z = 0): [number, number] => {
    const [sx, sy] = project(x, y, z);
    return [sx + OFF_X, sy + OFF_Y];
};
export const P = (x: number, y: number, z = 0) => pt(x, y, z).map((n) => n.toFixed(1)).join(",");

export const roomOf = (zone: Zone) => ROOMS.find((r) => r.zone === zone)!;

/** Шесть столов зоны (левый верхний угол стола относительно острова): сначала центральный у задней стены, потом по бокам, потом второй ряд. */
const DESKS: [number, number][] = [[3, 1.1], [0.5, 1.1], [5.5, 1.1], [3, 3.7], [0.5, 3.7], [5.5, 3.7]];
export const DESK_W = 2;
/** Рабочее место: стол и кресло, на котором сидит робот. Робот без стола (больше шести в зоне) ходит по офису и работает стоя. */
export function slotFor(room: RoomDef, index: number) {
    if (index >= DESKS.length) return { desk: null, chair: null, robot: { x: room.x + 4, y: room.y + room.d - 0.8 }, standing: true };
    const [dx, dy] = DESKS[index];
    const desk = { x: room.x + dx, y: room.y + dy };
    // кресло перед столом, чуть правее монитора: монитор остаётся виден
    const chair = { x: desk.x + 1.05, y: desk.y + 1.2 };
    return { desk, chair, robot: { x: chair.x + 0.31, y: chair.y + 0.31 }, standing: false };
}

// ── цвета ──
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
export const mix = (a: string, b: string, t: number) => { const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b); return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t); };

export interface Tone { top: string; left: string; right: string }
/** Три грани предмета из одного цвета: верх светлее, правая грань темнее. */
export const tone = (base: string): Tone => ({ top: mix(base, "#ffffff", 0.14), left: base, right: mix(base, "#000000", 0.34) });

export const C = {
    floor: "#252e28", floorAlt: "#262f29", grid: "rgba(255,255,255,0.055)", carpet: "#2c372f", corridor: "#171d19",
    wallL: "#36423b", wallR: "#27302b", wallTop: "#46544b", lime: "#c6ff4d", teal: "#2DDEB6", amber: "#F4A100", red: "#EB5757",
    desk: tone("#4c5a52"), deskTop: tone("#667a6e"), dark: tone("#1e2521"), metal: tone("#76837a"), paper: tone("#eef2ea"), box: tone("#4d6054"), shelf: tone("#46544b"),
    screen: "#06140c", plant: "#2f7d4f", pot: tone("#39433d"),
};
