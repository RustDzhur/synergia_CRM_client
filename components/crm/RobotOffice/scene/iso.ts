import type { Zone } from "@/store/useOfficeStore";

// Изометрия офиса: плоскость пола — сетка клеток (x вправо-вниз, y влево-вниз), z — высота в пикселях.
// Одна клетка пола = 64×32 пикселя на экране. Всё рисуется в одном SVG; масштаб подгоняет браузер (viewBox).
export const TW = 64;
export const TH = 32;
export const WALL_H = 46;
export const SKEW = 26.565; // atan(1/2): наклон «экрана» на лицевой стороне предмета

/** Точка пола (x, y) на высоте z → координаты картинки до сдвига сцены. */
export const project = (x: number, y: number, z = 0): [number, number] => [((x - y) * TW) / 2, ((x + y) * TH) / 2 - z];

export interface RoomDef { zone: Zone; x: number; y: number; w: number; d: number; col: 0 | 1 | 2; row: 0 | 1 }

const RW = 6, RD = 5, GAP_X = 2, CORRIDOR = 3;
// Два ряда по три комнаты, между ними коридор — в нём стоит Айрис.
const ORDER: Zone[][] = [["marketing", "sales", "service"], ["finance", "warehouse", "office"]];
export const ROOMS: RoomDef[] = ORDER.flatMap((zones, row) => zones.map((zone, col) => ({ zone, x: col * (RW + GAP_X), y: row === 0 ? 0 : RD + CORRIDOR, w: RW, d: RD, col: col as 0 | 1 | 2, row: row as 0 | 1 })));
export const GRID_W = 3 * RW + 2 * GAP_X; // 22
export const GRID_D = 2 * RD + CORRIDOR; // 13
export const HUB = { x: GRID_W / 2, y: RD + CORRIDOR / 2 }; // центр коридора

const PAD = 24;
// сдвиг, чтобы вся сцена попала в положительные координаты
export const OFF_X = (GRID_D * TW) / 2 + PAD;
export const OFF_Y = WALL_H + 56 + PAD;
export const SCENE_W = Math.round(((GRID_W + GRID_D) * TW) / 2 + PAD * 2);
export const SCENE_H = Math.round(((GRID_W + GRID_D) * TH) / 2 + WALL_H + 56 + PAD * 2);

/** Точка сцены в итоговых координатах SVG. */
export const pt = (x: number, y: number, z = 0): [number, number] => {
    const [sx, sy] = project(x, y, z);
    return [sx + OFF_X, sy + OFF_Y];
};
export const P = (x: number, y: number, z = 0) => pt(x, y, z).map((n) => n.toFixed(1)).join(",");

export const roomOf = (zone: Zone) => ROOMS.find((r) => r.zone === zone)!;

/** Рабочие места в комнате: стол (левый верхний угол в клетках) и место, где стоит робот. Больше четырёх роботов стоят у входа. */
export function slotFor(room: RoomDef, index: number) {
    if (index < 4) {
        const col = index % 2, row = Math.floor(index / 2);
        const dx = 0.5 + col * 2.9, dy = 1.1 + row * 2.0;
        return { desk: { x: room.x + dx, y: room.y + dy }, robot: { x: room.x + dx + 2.45, y: room.y + dy + 0.95 }, standing: false };
    }
    const k = index - 4;
    return { desk: null, robot: { x: room.x + 1.2 + (k % 4) * 1.3, y: room.y + room.d - 0.5 - Math.floor(k / 4) * 0.8 }, standing: true };
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
