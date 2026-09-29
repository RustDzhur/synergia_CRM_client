import { localeTag } from "@/utils/dateHelpers";
import { seedRecord as rec, type RecordItem } from "../shared/records/config";

// Стартовые статьи базы знаний — на языке интерфейса. Идентификаторы (kb-g1, kb-s1 …) одинаковы
// во всех языках: это ключи записей, поэтому смена языка не создаёт вторых копий статей,
// а просто показывает тот же текст на другом языке.
//
// Правила те же, что были в немецком варианте: статья описывает, что делать, а не пересказывает
// интерфейс; в юридических местах ссылаемся на норму (§ 14 UStG), но не выдаём это за консультацию.
type Seed = Record<string, RecordItem[]>;

const EN: Seed = {
	general: [
		rec("kb-g1", { title: "How this knowledge base is meant to be used", category: "process", body: "Keep here the instructions the team reaches for every day: how a quote is prepared, who approves what, where the templates live. One page per topic, short sentences, and nothing that is already obvious from the interface.", author: "", updated: "" }),
		rec("kb-g2", { title: "How an entry should be built", category: "tools", body: "Title = the question. Body = the answer, step by step. Add the person responsible and the date of the last check, so it is clear whether the entry is still current.", author: "", updated: "" }),
	],
	sales: [
		rec("kb-s1", { title: "Prepare and send a quote", category: "process", body: "1. Create or open the customer in CRM.\n2. Create the quote under Finance and add the line items.\n3. Check that the tax rate and the supply date are right.\n4. Send it to the customer as a PDF, or download it.", author: "", updated: "" }),
	],
	finance: [
		rec("kb-f1", { title: "Invoice: what has to be on it", category: "invoice", body: "Full company name and address, tax number or VAT ID, invoice date, consecutive invoice number, supply date, type and quantity of the service, net amount, tax rate and tax amount. Small businesses state the § 19 UStG note instead of the tax.", author: "", updated: "" }),
		rec("kb-f2", { title: "When a reminder goes out", category: "deadlines", body: "Once the payment term has passed, the invoice counts as overdue. The first reminder goes out after the period set in the settings, and each following one raises the dunning level. Amounts and periods live under Finance → Settings.", author: "", updated: "" }),
	],
	team: [
		rec("kb-t1", { title: "A new colleague joins", category: "onboarding", body: "1. Add the employee under My company.\n2. Give access in Settings → Team (e-mail, role, sections).\n3. Without an account the entry stays a directory entry: the person appears in lists but cannot work on tasks.", author: "", updated: "" }),
	],
};

const DE: Seed = {
	general: [
		rec("kb-g1", { title: "Wie diese Wissensdatenbank gedacht ist", category: "process", body: "Legen Sie hier Anleitungen ab, die im Alltag gebraucht werden: wie ein Angebot entsteht, wer was freigibt, wo die Vorlagen liegen. Eine Seite pro Thema, kurze Sätze, und nichts, was aus der Oberfläche ohnehin ersichtlich ist.", author: "", updated: "" }),
		rec("kb-g2", { title: "Wie ein Eintrag aufgebaut sein sollte", category: "tools", body: "Titel = was die Frage ist. Text = die Antwort in Schritten. Verantwortliche Person und Datum der letzten Prüfung gehören dazu, damit klar ist, ob der Eintrag noch aktuell ist.", author: "", updated: "" }),
	],
	sales: [
		rec("kb-s1", { title: "Angebot erstellen und versenden", category: "process", body: "1. Kunde in CRM anlegen oder öffnen.\n2. Angebot im Bereich Finanzen erstellen, Positionen eintragen.\n3. Prüfen, ob Steuersatz und Leistungsdatum stimmen.\n4. Als PDF an den Kunden senden oder herunterladen.", author: "", updated: "" }),
	],
	finance: [
		rec("kb-f1", { title: "Rechnung: was darauf stehen muss", category: "invoice", body: "Vollständiger Firmenname und Anschrift, Steuernummer oder USt-IdNr., Rechnungsdatum, fortlaufende Rechnungsnummer, Leistungsdatum, Art und Menge der Leistung, Nettobetrag, Steuersatz und Steuerbetrag. Bei Kleinunternehmerregelung statt der Steuer der Hinweis nach § 19 UStG.", author: "", updated: "" }),
		rec("kb-f2", { title: "Wann gemahnt wird", category: "deadlines", body: "Nach Ablauf des Zahlungsziels wird die Rechnung als überfällig geführt. Die erste Zahlungserinnerung geht nach der eingestellten Frist raus, danach steigt die Mahnstufe. Beträge und Fristen sind im Bereich Finanzen → Einstellungen hinterlegt.", author: "", updated: "" }),
	],
	team: [
		rec("kb-t1", { title: "Neue Kollegin, neuer Kollege", category: "onboarding", body: "1. Mitarbeiter im Bereich Meine Firma eintragen.\n2. Zugang in Einstellungen → Team anlegen (E-Mail, Rolle, Module).\n3. Ohne Konto bleibt der Eintrag ein reiner Verzeichniseintrag: er erscheint in Listen, kann aber keine Aufgaben bearbeiten.", author: "", updated: "" }),
	],
};

const UA: Seed = {
	general: [
		rec("kb-g1", { title: "Для чого ця база знань", category: "process", body: "Тримайте тут інструкції, до яких команда звертається щодня: як готується пропозиція, хто що погоджує, де лежать шаблони. Одна сторінка на тему, короткі речення й нічого з того, що й так видно в інтерфейсі.", author: "", updated: "" }),
		rec("kb-g2", { title: "Як має бути побудований запис", category: "tools", body: "Заголовок = саме питання. Текст = відповідь кроками. Додайте відповідальну людину й дату останньої перевірки — так видно, чи запис ще актуальний.", author: "", updated: "" }),
	],
	sales: [
		rec("kb-s1", { title: "Підготувати й надіслати пропозицію", category: "process", body: "1. Створіть або відкрийте клієнта в CRM.\n2. Створіть пропозицію в розділі «Фінанси» й додайте позиції.\n3. Перевірте ставку податку й дату надання послуги.\n4. Надішліть клієнту PDF або завантажте його.", author: "", updated: "" }),
	],
	finance: [
		rec("kb-f1", { title: "Рахунок: що на ньому має бути", category: "invoice", body: "Повна назва й адреса фірми, податковий номер або VAT ID, дата рахунку, послідовний номер, дата надання послуги, вид і кількість послуги, сума без податку, ставка й сума податку. У малих підприємств замість податку — примітка за § 19 UStG.", author: "", updated: "" }),
		rec("kb-f2", { title: "Коли надходить нагадування", category: "deadlines", body: "Після завершення строку оплати рахунок вважається простроченим. Перше нагадування надходить після встановленого в налаштуваннях строку, далі ступінь підвищується. Суми й строки задаються в розділі «Фінанси» → «Налаштування».", author: "", updated: "" }),
	],
	team: [
		rec("kb-t1", { title: "Приходить новий колега", category: "onboarding", body: "1. Додайте співробітника в розділі «Моя фірма».\n2. Дайте доступ у «Налаштування» → «Команда» (пошта, роль, розділи).\n3. Без акаунта запис залишається довідковим: людина видна в списках, але не може брати завдання.", author: "", updated: "" }),
	],
};

const BY_LOCALE: Record<string, Seed> = { en: EN, de: DE, ua: UA, uk: UA };

// Стартовые статьи для текущего языка: неизвестный язык — английский, чтобы текст не пропадал
export const knowledgeSeed = (locale: string): Seed => BY_LOCALE[localeTag(locale)] ?? EN;
