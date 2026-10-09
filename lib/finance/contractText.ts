import { formatMoney } from "./money";
import type { Market } from "./market";
import { ALIASES } from "./contractFields";

// Текст договора: фирма правит один раз в настройках бухгалтерии (или отдельный договор — в самой форме),
// а поля договора (номер, клиент, сумма, срок) подставляются в текст на месте подстановок {{…}}.
// Плейсхолдеры латиницей и без падежей: текст пишет человек, и подстановка не должна требовать
// склонений вида «{{клиенту}}». Незнакомая подстановка остаётся как есть — её видно и легко исправить.
// Файл чистый: те же функции нужны в браузере (предпросмотр текста) и на сервере (рендер PDF).

export interface ContractVars {
	number: string; // номер договора
	date: string; // дата договора (дд.мм.гггг)
	firm: string; // название фирмы-исполнителя
	firmAddress: string;
	firmTaxId: string; // ЄДРПОУ/ІПН или USt-IdNr.
	signer: string; // подписант (ФОП или директор)
	customer: string; // клиент
	customerAddress: string;
	customerTaxId: string;
	value: string; // сумма с валютой, уже отформатированная
	start: string; // начало работ (дд.мм.гггг)
	end: string; // завершение (дд.мм.гггг)
}

// Что можно вставить в текст — подписи для подсказки в интерфейсе (порядок как в ContractVars)
export const CONTRACT_VAR_KEYS = ["number", "date", "firm", "signer", "customer", "value", "start", "end", "firmTaxId", "customerTaxId", "firmAddress", "customerAddress"] as const;

/** Дата договора из ISO (YYYY-MM-DD) в привычный вид дд.мм.гггг; пустое — пустая строка. */
export function contractDate(iso?: string | null): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
	return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** Подстановка значений в текст: {{number}}, {{ customerTaxId }}, {{passport}} — регистр и пробелы не важны. */
export function fillContractText(text: string, vars: Record<string, string>): string {
	// Ключи сравниваем без регистра: в тексте пишут {{customerTaxId}} и {{customertaxid}} — оба должны найтись
	const map: Record<string, string> = {};
	for (const [key, value] of Object.entries(vars)) map[key.toLowerCase()] = String(value ?? "");
	return String(text ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) => {
		const k = key.toLowerCase();
		// синонимы ({{Name}}, {{address}}, {{passport}}) — см. ALIASES в contractFields.ts; прямое имя всегда важнее
		const alias = ALIASES[k];
		const value = map[k] !== undefined ? map[k] : alias ? map[alias.toLowerCase()] : undefined;
		return value === undefined ? whole : value;
	});
}

// Произвольное поле шаблона договора: key — имя подстановки {{key}}, label — подпись в форме,
// type — тип ввода, source: manual (вручную) или contact (значение тянется из карточки клиента).
export interface ContractField {
	key: string; // латиница/цифры/подчёркивание — имя подстановки {{key}}
	label: string; // подпись поля в форме
	type: "text" | "date" | "number" | "money";
	source: "manual" | "contact";
}

export interface ContractTemplateDef {
	id: string;
	name: string;
	body: string;
	fields: ContractField[];
}

/** Сумма договора строкой — так же, как её печатает PDF. */
export function contractValueText(value: number, currency: string): string {
	return formatMoney(Number(value) || 0, currency);
}

// Типовой текст: с него фирма начинает — не образец юридической силы, а рабочий каркас, который
// каждая фирма правит под себя. Поэтому он и лежит в настройках, а не зашит в PDF.
const DEFAULT_UA = `ДОГОВІР № {{number}}

м. ____________                                                                        {{date}}

{{firm}}, далі — «Виконавець», в особі {{signer}}, з однієї сторони, та {{customer}}, далі — «Замовник», з іншої сторони, уклали цей Договір про наведене нижче.

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Виконавець зобов'язується надати Замовнику послуги (виконати роботи) власними силами, а Замовник — прийняти та оплатити їх.
1.2. Конкретний перелік послуг, обсяг і строки узгоджуються сторонами в рахунках, актах та інших додатках, які є невід'ємною частиною цього Договору.

2. ВАРТІСТЬ І ПОРЯДОК РОЗРАХУНКІВ
2.1. Загальна сума Договору становить {{value}}.
2.2. Розрахунки проводяться у безготівковій формі на поточний рахунок Виконавця на підставі виставлених рахунків.
2.3. Датою оплати вважається дата надходження коштів на рахунок Виконавця.

3. СТРОКИ
3.1. Початок надання послуг: {{start}}.
3.2. Завершення надання послуг: {{end}}.
3.3. Послуги вважаються наданими після підписання сторонами акта виконаних робіт.

4. ПРАВА ТА ОБОВ'ЯЗКИ СТОРІН
4.1. Виконавець надає послуги якісно та у погоджені строки.
4.2. Замовник своєчасно надає інформацію та матеріали, потрібні для надання послуг, і оплачує їх згідно з умовами цього Договору.

5. ВІДПОВІДАЛЬНІСТЬ СТОРІН
5.1. За порушення строків оплати Замовник сплачує пеню в розмірі, передбаченому законодавством, якщо інше не погоджено сторонами.
5.2. Сторони звільняються від відповідальності за невиконання зобов'язань внаслідок обставин непереборної сили.

6. СТРОК ДІЇ ТА ІНШІ УМОВИ
6.1. Договір набирає чинності з моменту підписання і діє до повного виконання сторонами своїх зобов'язань.
6.2. Зміни та доповнення оформлюються письмово і підписуються обома сторонами.
6.3. Договір складено у двох примірниках, по одному для кожної сторони.

7. РЕКВІЗИТИ СТОРІН

Виконавець: {{firm}}                                 Замовник: {{customer}}
Адреса: {{firmAddress}}                              Адреса: {{customerAddress}}
Код: {{firmTaxId}}                                   Код: {{customerTaxId}}`;

const DEFAULT_DE = `VERTRAG Nr. {{number}}

Ort: ____________                                                                      Datum: {{date}}

zwischen {{firm}}, vertreten durch {{signer}} (nachfolgend „Auftragnehmer"), und {{customer}} (nachfolgend „Auftraggeber") wird folgender Vertrag geschlossen:

§ 1 Vertragsgegenstand
(1) Der Auftragnehmer erbringt für den Auftraggeber die vereinbarten Leistungen mit eigenen Mitteln.
(2) Art, Umfang und Termine der Leistungen ergeben sich aus den Angeboten, Rechnungen und Anlagen, die Bestandteil dieses Vertrages sind.

§ 2 Vergütung
(1) Die Gesamtvergütung beträgt {{value}}.
(2) Die Zahlung erfolgt bargeldlos auf das Konto des Auftragnehmers auf Grundlage gestellter Rechnungen.
(3) Als Zahlungsdatum gilt der Eingang auf dem Konto des Auftragnehmers.

§ 3 Laufzeit
(1) Beginn der Leistungen: {{start}}.
(2) Ende der Leistungen: {{end}}.
(3) Die Leistungen gelten als erbracht, sobald beide Parteien das Abnahmeprotokoll unterzeichnet haben.

§ 4 Pflichten der Parteien
(1) Der Auftragnehmer erbringt die Leistungen fristgerecht und fachgerecht.
(2) Der Auftraggeber stellt die erforderlichen Informationen und Unterlagen rechtzeitig bereit und vergütet die Leistungen gemäß diesem Vertrag.

§ 5 Haftung
(1) Bei Zahlungsverzug schuldet der Auftraggeber Verzugszinsen in gesetzlicher Höhe, soweit nichts anderes vereinbart ist.
(2) Die Parteien haften nicht für die Nichterfüllung infolge höherer Gewalt.

§ 6 Schlussbestimmungen
(1) Der Vertrag tritt mit Unterzeichnung in Kraft und gilt bis zur vollständigen Erfüllung der Pflichten.
(2) Änderungen und Ergänzungen bedürfen der Schriftform.
(3) Der Vertrag wird in zwei Ausfertigungen geschlossen, je eine für jede Partei.

§ 7 Angaben der Parteien

Auftragnehmer: {{firm}}                              Auftraggeber: {{customer}}
Anschrift: {{firmAddress}}                           Anschrift: {{customerAddress}}
Steuernummer: {{firmTaxId}}                          Steuernummer: {{customerTaxId}}`;

const DEFAULT_UZ = `SHARTNOMA № {{number}} / ДОГОВОР № {{number}}

____________ sh. / г. ____________                                                                        {{date}}

{{firm}}, bundan keyin «Ijrochi» / в дальнейшем «Исполнитель», {{signer}} timsolida, bir tomondan, va {{customer}}, bundan keyin «Buyurtmachi» / в дальнейшем «Заказчик», ikkinchi tomondan, quyidagilar haqida ushbu Shartnomani tuzdilar. / заключили настоящий Договор о нижеследующем.

1. SHARTNOMA PREDMETI / ПРЕДМЕТ ДОГОВОРА
1.1. Ijrochi Buyurtmachiga xizmatlar ko‘rsatish (ishlarni bajarish) majburiyatini oladi, Buyurtmachi esa ularni qabul qilib, to‘lash majburiyatini oladi. / Исполнитель обязуется оказать Заказчику услуги (выполнить работы), а Заказчик — принять и оплатить их.
1.2. Xizmatlar ro‘yxati, hajmi va muddatlari hisob-fakturalarda, dalolatnomalarda va boshqa ilovalarda kelishiladi; ular ushbu Shartnomaning ajralmas qismidir. / Перечень, объём и сроки услуг согласуются сторонами в счетах-фактурах, актах и иных приложениях, являющихся неотъемлемой частью Договора.

2. NARX VA HISOB-KITOB TARTIBI / СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ
2.1. Shartnomaning umumiy summasi {{value}} ni tashkil etadi. / Общая сумма Договора составляет {{value}}.
2.2. Hisob-kitoblar berilgan hisob-fakturalar asosida Ijrochining hisob raqamiga pul o‘tkazish yo‘li bilan amalga oshiriladi. / Расчёты производятся в безналичной форме на расчётный счёт Исполнителя на основании выставленных счетов-фактур.
2.3. To‘lov sanasi — mablag‘lar Ijrochi hisobiga tushgan sana. / Датой оплаты считается дата поступления средств на счёт Исполнителя.

3. MUDDATLAR / СРОКИ
3.1. Xizmatlar ko‘rsatish boshlanishi: {{start}}. / Начало оказания услуг: {{start}}.
3.2. Xizmatlar ko‘rsatish tugashi: {{end}}. / Окончание оказания услуг: {{end}}.
3.3. Xizmatlar tomonlar bajarilgan ishlar dalolatnomasini imzolagandan keyin ko‘rsatilgan hisoblanadi. / Услуги считаются оказанными после подписания сторонами акта выполненных работ.

4. TOMONLARNING HUQUQ VA MAJBURIYATLARI / ПРАВА И ОБЯЗАННОСТИ СТОРОН
4.1. Ijrochi xizmatlarni sifatli va kelishilgan muddatlarda ko‘rsatadi. / Исполнитель оказывает услуги качественно и в согласованные сроки.
4.2. Buyurtmachi xizmatlar ko‘rsatish uchun zarur ma’lumot va materiallarni o‘z vaqtida taqdim etadi va xizmatlarni ushbu Shartnoma shartlariga muvofiq to‘laydi. / Заказчик своевременно предоставляет необходимую информацию и материалы и оплачивает услуги в соответствии с условиями Договора.

5. JAVOBGARLIK VA NIZOLAR / ОТВЕТСТВЕННОСТЬ И СПОРЫ
5.1. Tomonlar ushbu Shartnoma bo‘yicha majburiyatlarni bajarmaganlik uchun O‘zbekiston Respublikasi qonunchiligiga muvofiq javob beradi. / Стороны несут ответственность за неисполнение обязательств в соответствии с законодательством Республики Узбекистан.
5.2. Nizolar muzokaralar yo‘li bilan, kelishuvga erishilmasa — sud tartibida hal etiladi. / Споры решаются путём переговоров, а при недостижении согласия — в судебном порядке.

6. YAKUNIY QOIDALAR / ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ
6.1. Shartnoma imzolangan paytdan kuchga kiradi va majburiyatlar to‘liq bajarilgunga qadar amal qiladi. / Договор вступает в силу с момента подписания и действует до полного исполнения обязательств.
6.2. O‘zgartirish va qo‘shimchalar yozma shaklda kiritiladi. / Изменения и дополнения вносятся в письменной форме.
6.3. Shartnoma ikki nusxada tuziladi, har bir tomon uchun bittadan. / Договор составлен в двух экземплярах, по одному для каждой стороны.

7. TOMONLARNING REKVIZITLARI / РЕКВИЗИТЫ СТОРОН

Ijrochi / Исполнитель: {{firm}}                              Buyurtmachi / Заказчик: {{customer}}
Manzil / Адрес: {{firmAddress}}                           Manzil / Адрес: {{customerAddress}}
STIR / ИНН: {{firmTaxId}}                          STIR / ИНН: {{customerTaxId}}`;

/** Типовой текст договора по рынку фирмы (DE — немецкий, UA — украинский, UZ — узбекский/русский). Каркас, а не юридически выверенный образец. */
export function defaultContractText(market: Market | null): string {
	return market === "UA" ? DEFAULT_UA : market === "UZ" ? DEFAULT_UZ : DEFAULT_DE;
}
