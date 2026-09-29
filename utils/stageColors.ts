// Цвета стадий: первые пять сняты с макета Figma, шестой — запасной.
// Используются по порядковому номеру стадии, пока пользователь не выбрал свой цвет.
export const STAGE_COLORS = ["#34A2E8", "#57CAEF", "#63D0DE", "#2DDEB6", "#F4A100", "#8A8FF5"];

export function stageColor(color: string | undefined, index: number): string {
    return color || STAGE_COLORS[index % STAGE_COLORS.length];
}

// Палитра выбора цвета: 15 колонок × 5 рядов (как в макете). Первый ряд — цвета стадий из макета и базовые,
// остальные ряды — оттенки тех же тонов: от насыщенных к светлым.
const HUES = [210, 195, 170, 145, 110, 80, 50, 35, 15, 350, 325, 295, 265, 240, 0];
const SHADES: Array<[number, number]> = [
    [78, 42], [80, 52], [82, 62], [70, 72], [55, 82],
];
const HEAD_ROW = [...STAGE_COLORS, "#0B1F33", "#E53935", "#D81B9B", "#8D6E63", "#43A047", "#FFB300", "#7B1FA2", "#546E7A", "#9E9E9E"];

function hsl(h: number, s: number, l: number): string {
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
        return Math.round(255 * c).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export const COLOR_PALETTE: string[] = [
    ...HEAD_ROW.slice(0, 15),
    ...SHADES.slice(0, 4).flatMap(([s, l]) => HUES.map((h) => hsl(h, s, l))),
];
