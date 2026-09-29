import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Общие таблицы (shared/records): Маркетинг, Автоматизация, Моя компания.
export const TABLES: DocSection[] = [
	{
		id: "tables",
		title: t3("Tables: search, sorting, columns, adding and deleting", "Tabellen: Suche, Sortierung, Spalten, Hinzufügen und Löschen", "Таблиці: пошук, сортування, стовпці, додавання й видалення"),
		intro: t3(
			"Several sections show their data in the same kind of table: the tabs of [[navigation.marketing]] (except Start and Ad performance), the tabs [[automation.tab_variables]], [[automation.tab_constants]] and [[automation.tab_logs]] of [[navigation.automation]], and the tables of [[navigation.company]]. Everything below works the same way in all of them.",
			"Mehrere Bereiche zeigen ihre Daten in derselben Tabellenart: die Tabs von [[navigation.marketing]] (außer Start und Werbeleistung), die Tabs [[automation.tab_variables]], [[automation.tab_constants]] und [[automation.tab_logs]] von [[navigation.automation]] sowie die Tabellen von [[navigation.company]]. Alles Folgende funktioniert überall gleich.",
			"Кілька розділів показують дані в однаковій таблиці: вкладки [[navigation.marketing]] (крім Start і Ad performance), вкладки [[automation.tab_variables]], [[automation.tab_constants]] і [[automation.tab_logs]] розділу [[navigation.automation]], а також таблиці [[navigation.company]]. Усе нижче працює однаково в усіх них.",
		),
		groups: [
			{
				title: t3("Tabs, search and filters", "Tabs, Suche und Filter", "Вкладки, пошук і фільтри"),
				steps: [
					t3(
						"The tab bar at the top switches between the tables of the section. If not all tabs fit on a wide screen, an arrow button ([[records.scrollTabs]]) at the right end scrolls the bar. The address of the page remembers the tab, so a link with ?tab= opens the needed tab directly.",
						"Die Tab-Leiste oben wechselt zwischen den Tabellen des Bereichs. Passen auf einem breiten Bildschirm nicht alle Tabs hinein, scrollt eine Pfeiltaste ([[records.scrollTabs]]) am rechten Ende die Leiste. Die Seitenadresse merkt sich den Tab, ein Link mit ?tab= öffnet also direkt den gewünschten Tab.",
						"Смуга вкладок угорі перемикає таблиці розділу. Якщо на широкому екрані вкладки не вміщаються, кнопка-стрілка ([[records.scrollTabs]]) на правому краю прокручує смугу. Адреса сторінки запам’ятовує вкладку, тож посилання з ?tab= відкриває потрібну вкладку одразу.",
					),
					t3(
						"The field [[records.search]] filters the rows of the current table as you type. Next to it there is a filter list for each column that has fixed values (for example a status or a channel); its first option is “All — <column>”. Search and filters combine. At the top right a chip shows how many rows are shown.",
						"Das Feld [[records.search]] filtert die Zeilen der aktuellen Tabelle beim Tippen. Daneben gibt es für jede Spalte mit festen Werten (z. B. Status oder Kanal) eine Filterliste; ihre erste Option lautet „Alle — <Spalte>“. Suche und Filter werden kombiniert. Oben rechts zeigt ein Chip, wie viele Zeilen angezeigt werden.",
						"Поле [[records.search]] фільтрує рядки поточної таблиці під час введення. Поруч для кожного стовпця з фіксованими значеннями (наприклад, статус чи канал) є список-фільтр; його перший варіант — «Усі — <стовпець>». Пошук і фільтри поєднуються. Угорі праворуч чип показує, скільки рядків показано.",
					),
					t3(
						"If nothing matches, the table shows [[records.nothingFound]]. If the table is really empty, it shows [[records.empty]].",
						"Passt nichts, zeigt die Tabelle [[records.nothingFound]]. Ist die Tabelle wirklich leer, zeigt sie [[records.empty]].",
						"Якщо нічого не підходить, таблиця показує [[records.nothingFound]]. Якщо таблиця справді порожня, вона показує [[records.empty]].",
					),
				],
			},
			{
				title: t3("The toolbar above the table", "Die Werkzeugleiste über der Tabelle", "Панель над таблицею"),
				steps: [
					t3(
						"The primary green button on the right of the toolbar has the caption “Add …” with the type of record (for example “Add Campaign” or “Add Variable”). It opens an empty record window.",
						"Die grüne Hauptschaltfläche rechts in der Leiste trägt die Beschriftung „… hinzufügen“ mit der Art des Eintrags (z. B. „Kampagne hinzufügen“ oder „Variable hinzufügen“). Sie öffnet ein leeres Eintragsfenster.",
						"Головна зелена кнопка праворуч на панелі має підпис «Додати: …» з типом запису (наприклад, «Додати: Кампанія» чи «Додати: Змінна»). Вона відкриває порожнє вікно запису.",
					),
					t3(
						"Left of it stands the button “Edit …” (for example “Edit Campaign”). It becomes active only when exactly one row is ticked; it opens that row for editing.",
						"Links davon steht die Schaltfläche „… bearbeiten“ (z. B. „Kampagne bearbeiten“). Sie wird nur aktiv, wenn genau eine Zeile angehakt ist; sie öffnet diese Zeile zum Bearbeiten.",
						"Ліворуч від неї кнопка «Редагувати: …» (наприклад, «Редагувати: Кампанія»). Вона стає активною лише тоді, коли позначено рівно один рядок; відкриває цей рядок для редагування.",
					),
					t3(
						"As soon as at least one row is ticked, a red button [[crm.deleteSelected]] with the number of ticked rows appears. It asks for confirmation (with the number of rows) and deletes all ticked rows at once. The toast [[records.deleted]] confirms.",
						"Sobald mindestens eine Zeile angehakt ist, erscheint eine rote Schaltfläche [[crm.deleteSelected]] mit der Anzahl der angehakten Zeilen. Sie fragt nach (mit der Zeilenzahl) und löscht alle angehakten Zeilen auf einmal. Der Hinweis [[records.deleted]] bestätigt.",
						"Щойно позначено хоча б один рядок, з’являється червона кнопка [[crm.deleteSelected]] з кількістю позначених рядків. Вона просить підтвердження (з кількістю рядків) і видаляє всі позначені рядки одразу. Повідомлення [[records.deleted]] підтверджує.",
					),
				],
			},
			{
				title: t3("The table itself", "Die Tabelle selbst", "Сама таблиця"),
				steps: [
					t3(
						"The checkbox in the header row ticks or unticks all rows that are currently shown (after search and filters). The checkbox in a row ticks that row only.",
						"Das Kontrollkästchen in der Kopfzeile hakt alle aktuell angezeigten Zeilen an oder ab (nach Suche und Filtern). Das Kontrollkästchen in einer Zeile hakt nur diese Zeile an.",
						"Прапорець у рядку заголовка позначає або знімає позначку з усіх рядків, що зараз показано (після пошуку й фільтрів). Прапорець у рядку позначає лише цей рядок.",
					),
					t3(
						"The gear icon in the header opens the list [[records.columns]] with a checkbox for every column. Untick a column to hide it, tick it to show it again. The name column cannot be hidden. Your choice is remembered in this browser.",
						"Das Zahnradsymbol in der Kopfzeile öffnet die Liste [[records.columns]] mit einem Kontrollkästchen je Spalte. Entfernen Sie den Haken, um eine Spalte auszublenden; setzen Sie ihn, um sie wieder einzublenden. Die Namensspalte lässt sich nicht ausblenden. Ihre Auswahl wird in diesem Browser gespeichert.",
						"Значок шестерні в заголовку відкриває список [[records.columns]] з прапорцем для кожного стовпця. Зніміть прапорець, щоб сховати стовпець; поставте, щоб показати знову. Стовпець назви сховати не можна. Ваш вибір запам’ятовується в цьому браузері.",
					),
					t3(
						"A click on a column header sorts the table by this column: first ascending, a second click descending, a third click removes the sorting. Rows with an empty value always go to the end.",
						"Ein Klick auf eine Spaltenüberschrift sortiert die Tabelle nach dieser Spalte: zuerst aufsteigend, ein zweiter Klick absteigend, ein dritter hebt die Sortierung auf. Zeilen mit leerem Wert stehen immer am Ende.",
						"Клік по заголовку стовпця сортує таблицю за ним: спершу за зростанням, другий клік — за спаданням, третій прибирає сортування. Рядки з порожнім значенням завжди йдуть у кінець.",
					),
					t3(
						"Status columns show a coloured dot before the text (for example green for success or active, red for an error). A click on any row, or on the pencil icon ([[records.editRow]]) at its end, opens the record window for this row.",
						"Statusspalten zeigen vor dem Text einen farbigen Punkt (z. B. grün für Erfolg oder Aktiv, rot für einen Fehler). Ein Klick auf eine beliebige Zeile oder auf das Stiftsymbol ([[records.editRow]]) an ihrem Ende öffnet das Eintragsfenster dieser Zeile.",
						"Стовпці статусу показують кольорову крапку перед текстом (наприклад, зелену для успіху чи активного, червону для помилки). Клік по будь-якому рядку або по значку олівця ([[records.editRow]]) в його кінці відкриває вікно запису цього рядка.",
					),
				],
			},
			{
				title: t3("The record window", "Das Eintragsfenster", "Вікно запису"),
				steps: [
					t3(
						"The window has a cross in the corner and the fields of the table: text fields (up to 100 characters), number fields (0 or more), date fields and drop-down lists. Some fields are wide and take the whole row. Required fields are the name (and in some tables more).",
						"Das Fenster hat ein Kreuz in der Ecke und die Felder der Tabelle: Textfelder (bis 100 Zeichen), Zahlenfelder (0 oder mehr), Datumsfelder und Auswahllisten. Manche Felder sind breit und nehmen die ganze Zeile ein. Pflichtfeld ist der Name (in manchen Tabellen mehr).",
						"У вікні є хрестик у куті та поля таблиці: текстові (до 100 символів), числові (0 або більше), дати й випадні списки. Деякі поля широкі й займають цілий рядок. Обов’язкове поле — назва (у деяких таблицях більше).",
					),
					t3(
						"The bottom buttons are [[records.cancel]] (closes without saving) and [[records.create]] for a new record or [[records.save]] for an existing one. If a required field is empty, a message names it; if a number field has something else than a number, a message asks for a number of 0 or more. After a successful save the message [[records.saved]] appears.",
						"Unten stehen [[records.cancel]] (schließt ohne Speichern) und [[records.create]] bei einem neuen Eintrag bzw. [[records.save]] bei einem vorhandenen. Ist ein Pflichtfeld leer, nennt eine Meldung es; steht in einem Zahlenfeld etwas anderes als eine Zahl, bittet eine Meldung um eine Zahl ab 0. Nach erfolgreichem Speichern erscheint die Meldung [[records.saved]].",
						"Унизу кнопки [[records.cancel]] (закриває без збереження) і [[records.create]] для нового запису або [[records.save]] для наявного. Якщо обов’язкове поле порожнє, повідомлення називає його; якщо в числовому полі не число, повідомлення просить число від 0. Після успішного збереження з’являється повідомлення [[records.saved]].",
					),
					t3(
						"When you edit an existing record, a red link [[records.delete]] appears at the bottom left of the window. It asks “[[records.confirmDeleteOne]]” and, after confirmation, deletes it (the message [[records.deleted]]).",
						"Beim Bearbeiten eines vorhandenen Eintrags erscheint unten links im Fenster ein roter Link [[records.delete]]. Er fragt „[[records.confirmDeleteOne]]“ und löscht ihn nach Bestätigung (Meldung [[records.deleted]]).",
						"Під час редагування наявного запису внизу ліворуч у вікні з’являється червоне посилання [[records.delete]]. Воно питає «[[records.confirmDeleteOne]]» і після підтвердження видаляє його (повідомлення [[records.deleted]]).",
					),
				],
			},
		],
	},
];
