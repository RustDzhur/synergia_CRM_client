// Сравнение версий текста по строкам (наибольшая общая подпоследовательность). Для договоров хватает: строки — это пункты.
export type DiffLine = { type: "same" | "add" | "del"; text: string };

export function diffLines(a: string, b: string): DiffLine[] {
    const x = a.split(/\r?\n/), y = b.split(/\r?\n/);
    // защита от больших входов: квадратичная таблица ограничена
    if (x.length * y.length > 4_000_000) return [...x.map((t) => ({ type: "del" as const, text: t })), ...y.map((t) => ({ type: "add" as const, text: t }))];
    const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
    for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out: DiffLine[] = [];
    let i = 0, j = 0;
    while (i < x.length && j < y.length) {
        if (x[i] === y[j]) { out.push({ type: "same", text: x[i] }); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "del", text: x[i++] });
        else out.push({ type: "add", text: y[j++] });
    }
    while (i < x.length) out.push({ type: "del", text: x[i++] });
    while (j < y.length) out.push({ type: "add", text: y[j++] });
    return out;
}

/** Переменные шаблона вида {{name}} (латиница, цифры, подчёркивание). */
export const templateVars = (body: string): string[] => Array.from(new Set(Array.from(body.matchAll(/\{\{\s*([a-zA-Z_][\w]{0,40})\s*\}\}/g), (m) => m[1])));
export const fillTemplate = (body: string, values: Record<string, string>) => body.replace(/\{\{\s*([a-zA-Z_][\w]{0,40})\s*\}\}/g, (_, k: string) => values[k] ?? `{{${k}}}`);
