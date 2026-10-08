// ── Имя «Айрис» в фразе ──────────────────────────────────────────────────────────────────────────────
// Разговорный режим слушает постоянно — имя больше НЕ ворота: просьбу выполняем и без него (владелец:
// «пусть модель будет постоянно активная и слушающая»). Имя распознаём, чтобы снять его из текста
// («Айрис, створи задачу» → «створи задачу») и отозваться «Слухаю», если позвали только по имени.
//
// Распознаватели слышат имя по-разному — особенно по-узбекски («Salom, Ayris» → «салом арис», «Salom Aris», «Ayrish», «саломайрис»).
// Поэтому сравнение идёт не по буквам исходного текста, а по латинской транслитерации: кириллица, ı/ё и апострофы приводятся к одному виду.

const CYR: Record<string, string> = {
	а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
	у: "u", ф: "f", х: "h", ц: "c", ч: "c", ш: "s", щ: "s", ъ: "", ы: "i", ь: "", э: "e", ю: "u", я: "a", і: "i", ї: "i", є: "e", ґ: "g", ў: "u", қ: "k", ғ: "g", ҳ: "h",
};
/** Слово в упрощённую латиницу: «Айрис»/«ayris»/«Ayrıs»/«аирис» → ayris/airis; ай→ay, ей→ey. */
export function wakeKey(word: string): string {
	let w = word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ʻʼ'’`]/g, "").replace(/ı/g, "i");
	w = Array.from(w).map((c) => CYR[c] ?? c).join("");
	return w.replace(/ai/g, "ay").replace(/ei/g, "ey").replace(/y+/g, "y").replace(/h$/, "").replace(/s{2,}/g, "s");
}

// Эталоны в той же транслитерации. «iris»/«aris» — точные формы (рис, Ира — не имя)
const WAKE_EXACT = new Set(["ayris", "eyris", "aris", "iris", "ayres", "ayrus", "ayrs", "ayriz", "ayrisa", "ares", "arys", "arus"]);
const WAKE_FUZZY = ["ayris", "eyris"];

// Расстояние Левенштейна ≤ 1: распознавание слышит имя по-разному («Айрс», «Айріз», «Ейріс») — одна опечатка допускается, две уже нет
function nearWord(word: string, target: string): boolean {
	if (Math.abs(word.length - target.length) > 1) return false;
	let i = 0, j = 0, edits = 0;
	while (i < word.length && j < target.length) {
		if (word[i] === target[j]) { i++; j++; continue; }
		if (++edits > 1) return false;
		if (word.length > target.length) i++;
		else if (word.length < target.length) j++;
		else { i++; j++; }
	}
	return edits + (word.length - i) + (target.length - j) <= 1;
}

// «саломайрис» — приветствие слиплось с именем: слово оканчивается на имя
const isWakeWord = (w: string) => {
	const k = wakeKey(w);
	if (!k) return false;
	return WAKE_EXACT.has(k) || (k.length >= 5 && WAKE_FUZZY.some((t) => nearWord(k, t))) || (k.length >= 8 && /(ayris|eyris)$/.test(k));
};

const wordsOf = (text: string) => String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s'ʻʼ’`]/gu, " ").split(/\s+/).filter(Boolean);

/** Имя во фразе: {hit — позвали, rest — сама просьба без имени}. */
export function stripWake(text: string): { hit: boolean; rest: string } {
	// распознавание иногда делит имя на два слова («ай рис», «ай ріс», «ay ris»)
	const raw = String(text ?? "").replace(/(?<![\p{L}\p{N}])(ай|эй|ей|ay|ey|ai)\s+(рис|ріс|ris)(?![\p{L}\p{N}])/giu, "$1$2");
	const hits = wordsOf(raw).filter(isWakeWord);
	if (!hits.length) return { hit: false, rest: raw.trim() };
	// Убираем только ПЕРВОЕ имя — в остальном тексте слово «айріс» может быть частью просьбы.
	// Границы слова — юникодные: \b в JavaScript знает только ASCII и с кириллицей не срабатывает.
	const first = hits[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const re = new RegExp(`(?<![\\p{L}\\p{N}])${first}(?![\\p{L}\\p{N}])[\\s,!.…—–-]*`, "iu");
	return { hit: true, rest: raw.replace(re, "").trim() };
}
