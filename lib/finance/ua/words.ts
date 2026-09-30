// Сума прописом українською: «одна тисяча двісті тридцять чотири гривні 56 копійок».
// Бухгалтерські документи в Україні друкують суму словами, тому це не украшение, а реквизит.
//
// Правила украинских числительных: род (одна гривня / один мільйон), три формы множественного
// (1 гривня, 2–4 гривні, 5+ гривень) и исключения для 11–14 (одинадцять гривень, не «гривня»).
// Функция чистая и полностью покрыта тестом (суми прописом — приёмка этапа U3).

const ONES_M = ["", "один", "два", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"];
const ONES_F = ["", "одна", "дві", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"];
const TEENS = ["десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять", "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять"];
const TENS = ["", "", "двадцять", "тридцять", "сорок", "п'ятдесят", "шістдесят", "сімдесят", "вісімдесят", "дев'яносто"];
const HUNDREDS = ["", "сто", "двісті", "триста", "чотириста", "п'ятсот", "шістсот", "сімсот", "вісімсот", "дев'ятсот"];

/** Форма множественного числа: 1 — singular, 2–4 — few, остальное — many (с учётом 11–14). */
export function pluralForm(n: number, singular: string, few: string, many: string): string {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last === 1) return singular;
    if (last >= 2 && last <= 4) return few;
    return many;
}

/** Число 0–999 словами; gender — «f» для женского рода (одна тисяча, одна гривня). */
function trio(n: number, gender: "m" | "f"): string {
    const out: string[] = [];
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h) out.push(HUNDREDS[h]);
    if (rest >= 10 && rest < 20) out.push(TEENS[rest - 10]);
    else {
        const t = Math.floor(rest / 10);
        const o = rest % 10;
        if (t) out.push(TENS[t]);
        if (o) out.push((gender === "f" ? ONES_F : ONES_M)[o]);
    }
    return out.join(" ");
}

// Индекс = номер тройки: 1 — тысячи, 2 — миллионы, 3 — миллиарды (chunks[0] — единицы).
// Разряды кончаются на квадриллионе: сумма больше 10^18 — уже не бухгалтерская ошибка, а испорченные
// данные; такие числа обрабатывает uahInWords, не роняя рендер документа (раньше индекс уходил
// за пределы массива, и PDF падал с «Server error» — «загрузка счёта в ПДФ не работает»).
const GROUPS: Array<{ one: string; few: string; many: string; gender: "m" | "f" }> = [
    { one: "тисяча", few: "тисячі", many: "тисяч", gender: "f" },
    { one: "мільйон", few: "мільйони", many: "мільйонів", gender: "m" },
    { one: "мільярд", few: "мільярди", many: "мільярдів", gender: "m" },
    { one: "трильйон", few: "трильйони", many: "трильйонів", gender: "m" },
    { one: "квадрильйон", few: "квадрильйони", many: "квадрильйонів", gender: "m" },
];

/** Максимальное число, которое раскладывается в слова (10^18 − 1). Больше — уже не сумма документа. */
const MAX_WORDS = 1e18 - 1;

/** Целое число словами: 1 234 → «одна тисяча двісті тридцять чотири»; 0 → «нуль».
 *  gender — род последнего разряда: «одна гривня» (f), но «один мільйон» (m). */
export function intInWords(value: number, gender: "m" | "f" = "m"): string {
    const n = Math.floor(Math.abs(value));
    if (n === 0) return "нуль";
    const parts: string[] = [];
    let rest = n;
    // Разбиваем на тройки от старших к младшим: миллиарды, миллионы, тысячи, единицы
    const chunks: number[] = [];
    while (rest > 0) {
        chunks.push(rest % 1000);
        rest = Math.floor(rest / 1000);
    }
    for (let i = chunks.length - 1; i >= 0; i--) {
        const chunk = chunks[i];
        if (!chunk) continue;
        if (i === 0) parts.push(trio(chunk, gender));
        else {
            const g = GROUPS[i - 1];
            if (!g) return n.toLocaleString("uk-UA"); // число вне разрядов — печатаем цифрами, но не падаем
            parts.push(`${trio(chunk, g.gender)} ${pluralForm(chunk, g.one, g.few, g.many)}`);
        }
    }
    return parts.join(" ");
}

/**
 * Сума прописом для гривны: «Дві тисячі сто гривень 05 копійок».
 * Копейки всегда двумя цифрами — «5 копійок» на документе выглядело бы как ошибка.
 */
export function uahInWords(amount: number): string {
    const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
    const total = Math.round(safe * 100);
    const hryvnia = Math.floor(total / 100);
    const kopiyky = total % 100;
    // Сумма вне разрядов (испорченные данные) — цифрами: документ напечатается, а не упадёт
    if (hryvnia > MAX_WORDS) return `${hryvnia.toLocaleString("uk-UA")} ₴ ${String(kopiyky).padStart(2, "0")} коп.`;
    const words = intInWords(hryvnia, "f");
    const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
    return `${capitalized} ${pluralForm(hryvnia, "гривня", "гривні", "гривень")} ${String(kopiyky).padStart(2, "0")} ${pluralForm(kopiyky, "копійка", "копійки", "копійок")}`;
}
