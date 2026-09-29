import { t3, Tx } from "./i18n";

// Тексты страницы «О нас». Пишем о том, что система действительно делает: без обещаний, которых
// продукт не выполняет, — иначе страница расходится с кабинетом и вызывает вопросы у клиентов.
export interface AboutPoint { title: Tx; text: Tx }

export const ABOUT: {
	title: Tx;
	intro: Tx;
	photoAlt: Tx;
	paragraphs: Tx[];
	points: AboutPoint[];
	screenshotHint: Tx;
} = {
	title: t3("About us", "Über uns", "Про нас"),
	intro: t3(
		"Firmspace AI brings customer relationships, team work, projects and accounting into one cabinet. We build it for small and medium businesses — those where one person often does several jobs at once.",
		"Firmspace AI bringt Kundenbeziehungen, Teamarbeit, Projekte und Buchhaltung in ein Kabinett. Wir bauen es für kleine und mittlere Betriebe — dort, wo eine Person oft mehrere Aufgaben gleichzeitig macht.",
		"Firmspace AI збирає роботу з клієнтами, командну роботу, проєкти й бухгалтерію в одному кабінеті. Ми робимо його для малого й середнього бізнесу — там, де одна людина часто веде кілька напрямів одразу."
	),
	photoAlt: t3("Our team at work", "Unser Team bei der Arbeit", "Наша команда за роботою"),
	paragraphs: [
		t3(
			"We collect in one place what is usually scattered across five programs: the deal pipeline, conversations with customers, tasks and the calendar, quotes, orders, invoices and reports. One login, one set of data, one team.",
			"Wir sammeln an einem Ort, was sonst über fünf Programme verstreut ist: Deal-Pipeline, Kundenkommunikation, Aufgaben und Kalender, Angebote, Aufträge, Rechnungen und Auswertungen. Ein Login, ein Datenbestand, ein Team.",
			"Ми збираємо в одному місці те, що зазвичай розкидане по пʼяти програмах: воронку угод, листування з клієнтами, завдання й календар, пропозиції, замовлення, рахунки та звіти. Один вхід, одні дані, одна команда."
		),
		t3(
			"We started from a simple thought: a small company should not pay for five services and move data between them by hand. That is why every part of Firmspace works with the same customers and the same documents as the rest — an invoice already knows its deal, a task already knows its customer.",
			"Wir haben mit einem einfachen Gedanken begonnen: Ein kleiner Betrieb soll nicht für fünf Dienste zahlen und Daten von Hand übertragen. Deshalb arbeitet jeder Teil von Firmspace mit denselben Kunden und denselben Dokumenten wie die anderen — eine Rechnung kennt ihren Auftrag, eine Aufgabe kennt ihren Kunden.",
			"Ми починали з простої думки: невелика фірма не повинна платити за пʼять сервісів і переносити дані між ними руками. Тому кожна частина Firmspace працює з тими самими клієнтами й документами, що й решта: рахунок уже знає своє замовлення, завдання знає свого клієнта."
		),
		t3(
			"We work with German care: invoices follow §14 UStG, reports include UStVA and EÜR, every action stays in the log, data is stored in Germany. And we try hard to make the system understandable without training — hints instead of instructions.",
			"Wir arbeiten mit deutscher Sorgfalt: Rechnungen folgen §14 UStG, Auswertungen enthalten UStVA und EÜR, jede Aktion bleibt im Protokoll, Daten liegen in Deutschland. Und wir bemühen uns, das System ohne Schulung verständlich zu machen — Hinweise statt Anleitungen.",
			"Ми працюємо з німецькою ретельністю: рахунки відповідають §14 UStG, звіти містять UStVA та EÜR, кожна дія залишається в журналі, дані зберігаються в Німеччині. І дуже стараємося зробити систему зрозумілою без навчання — підказки замість інструкцій."
		),
	],
	points: [
		{
			title: t3("All in one", "Alles an einem Ort", "Усе в одному"),
			text: t3(
				"Deals, conversations, tasks and invoices — without switching between programs.",
				"Deals, Kommunikation, Aufgaben und Rechnungen — ohne Wechsel zwischen Programmen.",
				"Угоди, листування, завдання й рахунки — без перемикання між програмами."
			),
		},
		{
			title: t3("Clear without training", "Verständlich ohne Schulung", "Зрозуміло без навчання"),
			text: t3(
				"The cabinet opens and works: the interface explains itself instead of demanding a manual.",
				"Das Kabinett öffnet sich und funktioniert: Die Oberfläche erklärt sich selbst, statt ein Handbuch zu verlangen.",
				"Кабінет відкривається й працює: інтерфейс пояснює себе сам, а не вимагає інструкції."
			),
		},
		{
			title: t3("German accuracy", "Deutsche Genauigkeit", "Німецька точність"),
			text: t3(
				"Invoices under §14 UStG, UStVA and EÜR reports, an action log for every change.",
				"Rechnungen nach §14 UStG, UStVA- und EÜR-Auswertungen, ein Aktionsprotokoll für jede Änderung.",
				"Рахунки за §14 UStG, звіти UStVA та EÜR, журнал дій на кожну зміну."
			),
		},
		{
			title: t3("Data under control", "Daten unter Kontrolle", "Дані під контролем"),
			text: t3(
				"Storage in Germany, access by role, export of your data at any time.",
				"Speicherung in Deutschland, Zugriff nach Rolle, Export Ihrer Daten jederzeit.",
				"Зберігання в Німеччині, доступ за ролями, експорт даних у будь-який момент."
			),
		},
	],
	screenshotHint: t3(
		"This is what the cabinet looks like — the same layout you get after signing in.",
		"So sieht das Kabinett aus — dieselbe Ansicht erwartet Sie nach der Anmeldung.",
		"Так виглядає кабінет — той самий вигляд після входу."
	),
};
