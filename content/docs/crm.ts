import { t3 } from "../i18n";
import type { DocSection } from "./types";

// CRM: воронка сделок, контакты, компании.
export const CRM: DocSection[] = [
	{
		id: "crm",
		title: t3("Deals, contacts and companies", "Deals, Kontakte und Firmen", "Угоди, контакти та компанії"),
		intro: t3(
			"The [[navigation.crm]] section keeps your customers in three tabs: [[crm.deals]] (the sales pipeline), [[crm.contacts]] (people) and [[crm.companies]] (organisations).",
			"Der Bereich [[navigation.crm]] führt Ihre Kunden in drei Tabs: [[crm.deals]] (die Verkaufs-Pipeline), [[crm.contacts]] (Personen) und [[crm.companies]] (Organisationen).",
			"Розділ [[navigation.crm]] веде ваших клієнтів у трьох вкладках: [[crm.deals]] (воронка продажів), [[crm.contacts]] (люди) і [[crm.companies]] (організації).",
		),
		groups: [
			{
				title: t3("Tabs and search", "Tabs und Suche", "Вкладки та пошук"),
				steps: [
					t3(
						"Switch between [[crm.deals]], [[crm.contacts]] and [[crm.companies]] with the tabs at the top. The active tab is stored in the address (?tab=…), so after returning from an edit page you land on the same tab, and you can copy the link.",
						"Wechseln Sie mit den Tabs oben zwischen [[crm.deals]], [[crm.contacts]] und [[crm.companies]]. Der aktive Tab steht in der Adresse (?tab=…): Nach der Rückkehr von einer Bearbeitungsseite landen Sie im selben Tab, und Sie können den Link kopieren.",
						"Перемикайтеся між [[crm.deals]], [[crm.contacts]] і [[crm.companies]] вкладками вгорі. Активну вкладку збережено в адресі (?tab=…), тож після повернення зі сторінки редагування ви потрапляєте на ту саму вкладку, а посилання можна копіювати.",
					),
					t3(
						"The search field next to the tabs filters the current tab as you type. In [[crm.deals]] it looks at the deal name, the client and the company; in [[crm.contacts]] at name, e-mail, company and position. Switching the tab clears the search.",
						"Das Suchfeld neben den Tabs filtert den aktuellen Tab beim Tippen. In [[crm.deals]] sucht es nach Dealname, Kunde und Firma; in [[crm.contacts]] nach Name, E-Mail, Firma und Position. Beim Tabwechsel wird die Suche geleert.",
						"Поле пошуку поруч із вкладками фільтрує поточну вкладку під час введення. У [[crm.deals]] воно шукає за назвою угоди, клієнтом і компанією; у [[crm.contacts]] — за іменем, e-mail, компанією та посадою. Під час перемикання вкладки пошук очищується.",
					),
					t3(
						"While a search is active, cards cannot be dragged (their positions would be misleading). Clear the field to drag again.",
						"Solange eine Suche aktiv ist, lassen sich Karten nicht ziehen (ihre Positionen wären irreführend). Leeren Sie das Feld, um wieder zu ziehen.",
						"Поки пошук активний, картки не можна перетягувати (їхні позиції вводили б в оману). Очистіть поле, щоб знову перетягувати.",
					),
				],
			},
			{
				title: t3("The deals board", "Das Deal-Board", "Дошка угод"),
				steps: [
					t3(
						"The row above the board has two views: [[crm.kanban]] (columns with cards, opened by default) and [[crm.list]] (one table of all deals). To the right are counters: [[crm.inbound]] is the number of deals in the first column, [[crm.planned]] in the second, and [[crm.more]] in all the others. A click on [[crm.more]] opens a small list with the count for every further column.",
						"Die Zeile über dem Board hat zwei Ansichten: [[crm.kanban]] (Spalten mit Karten, standardmäßig geöffnet) und [[crm.list]] (eine Tabelle aller Deals). Rechts stehen Zähler: [[crm.inbound]] ist die Zahl der Deals in der ersten Spalte, [[crm.planned]] in der zweiten und [[crm.more]] in allen übrigen. Ein Klick auf [[crm.more]] öffnet eine kleine Liste mit der Anzahl je weiterer Spalte.",
						"Рядок над дошкою має два подання: [[crm.kanban]] (колонки з картками, відкрито за замовчуванням) і [[crm.list]] (одна таблиця всіх угод). Праворуч — лічильники: [[crm.inbound]] — кількість угод у першій колонці, [[crm.planned]] — у другій, [[crm.more]] — в усіх решта. Натиск на [[crm.more]] відкриває невеликий список із кількістю для кожної подальшої колонки.",
					),
					t3(
						"Each column is an arrow-shaped stage of your sales process (for example a new enquiry, then offer, then won). In the column header you see the stage name and a gear icon; under it a button [[crm.addCard]] with the number of deals in the stage.",
						"Jede Spalte ist eine pfeilförmige Phase Ihres Verkaufsprozesses (zum Beispiel neue Anfrage, dann Angebot, dann gewonnen). Im Spaltenkopf sehen Sie den Phasennamen und ein Zahnrad; darunter eine Schaltfläche [[crm.addCard]] mit der Zahl der Deals der Phase.",
						"Кожна колонка — стрілоподібний етап вашого процесу продажів (наприклад, нове звернення, потім пропозиція, потім виграно). У заголовку колонки — назва етапу й значок шестерні; під ним кнопка [[crm.addCard]] і кількість угод етапу.",
					),
					t3(
						"A deal card shows the deal name in bold, under it the contact and the company, on the right the number of entries in its history and small icons for messages, e-mail and calls (they light up when such entries exist). At the bottom of the card you see [[crm.activity]] and how long ago the last entry was made. A click on the card opens the deal window.",
						"Eine Deal-Karte zeigt fett den Dealnamen, darunter Kontakt und Firma, rechts die Zahl der Einträge im Verlauf und kleine Symbole für Nachrichten, E-Mail und Anrufe (sie leuchten auf, wenn es solche Einträge gibt). Unten steht [[crm.activity]] und wie lange der letzte Eintrag her ist. Ein Klick auf die Karte öffnet das Deal-Fenster.",
						"Картка угоди показує жирним назву угоди, під нею контакт і компанію, праворуч — кількість записів в історії та маленькі значки повідомлень, пошти й дзвінків (вони світяться, коли такі записи є). Унизу картки — [[crm.activity]] і як давно зроблено останній запис. Натиск на картку відкриває вікно угоди.",
					),
					t3(
						"To change a stage, drag the card by any point into another column, or into another place of the same column to change the order. The move is saved immediately and a “[[crm.stageChanged]]” entry appears in the deal history.",
						"Um die Phase zu ändern, ziehen Sie die Karte an beliebiger Stelle in eine andere Spalte – oder an eine andere Stelle derselben Spalte, um die Reihenfolge zu ändern. Die Verschiebung wird sofort gespeichert, und im Dealverlauf erscheint der Eintrag „[[crm.stageChanged]]“.",
						"Щоб змінити етап, перетягніть картку за будь-яке місце в іншу колонку — або в інше місце тієї ж колонки, щоб змінити порядок. Переміщення зберігається одразу, а в історії угоди з’являється запис «[[crm.stageChanged]]».",
					),
					t3(
						"Without deals the list view says “[[crm.noDeals]]”.",
						"Ohne Deals steht in der Listenansicht „[[crm.noDeals]]“.",
						"Без угод подання «список» каже «[[crm.noDeals]]».",
					),
				],
			},
			{
				title: t3("Creating a deal", "Einen Deal anlegen", "Створення угоди"),
				steps: [
					t3(
						"Press [[crm.addCard]] in the column where the deal should start. A form unfolds under the button.",
						"Klicken Sie in der Spalte, in der der Deal beginnen soll, auf [[crm.addCard]]. Unter der Schaltfläche klappt ein Formular auf.",
						"Натисніть [[crm.addCard]] у колонці, з якої має починатися угода. Під кнопкою розгорнеться форма.",
					),
					t3(
						"[[crm.taskName]] is the only required field (the hint says “[[crm.taskNamePlaceholder]]”; up to 200 characters). Without a name the [[crm.save]] button stays inactive.",
						"[[crm.taskName]] ist das einzige Pflichtfeld (der Hinweis lautet „[[crm.taskNamePlaceholder]]“; bis zu 200 Zeichen). Ohne Namen bleibt die Schaltfläche [[crm.save]] inaktiv.",
						"[[crm.taskName]] — єдине обов’язкове поле (підказка «[[crm.taskNamePlaceholder]]»; до 200 символів). Без назви кнопка [[crm.save]] неактивна.",
					),
					t3(
						"In [[crm.client]] start typing a name, phone or e-mail of an existing contact: a list of suggestions appears, and a click on one links the deal to that contact (and fills the company if the contact has one). You can also type a name that does not exist yet.",
						"Tippen Sie bei [[crm.client]] Name, Telefon oder E-Mail eines vorhandenen Kontakts: Es erscheint eine Vorschlagsliste, und ein Klick darauf verknüpft den Deal mit diesem Kontakt (und füllt die Firma, wenn der Kontakt eine hat). Sie können auch einen noch nicht vorhandenen Namen eingeben.",
						"У [[crm.client]] почніть вводити ім’я, телефон чи e-mail наявного контакту: з’явиться список підказок, і натиск на пункт пов’язує угоду з цим контактом (та підставляє компанію, якщо вона в контакту є). Можна ввести й ім’я, якого ще немає.",
					),
					t3(
						"[[crm.company]] works the same way with the companies of the CRM. [[crm.startDate]] and [[crm.endDate]] are date pickers for the planned start and end.",
						"[[crm.company]] funktioniert genauso mit den Firmen des CRM. [[crm.startDate]] und [[crm.endDate]] sind Datumsfelder für geplanten Beginn und Ende.",
						"[[crm.company]] працює так само з компаніями CRM. [[crm.startDate]] і [[crm.endDate]] — вибір дат запланованого початку й завершення.",
					),
					t3(
						"[[crm.save]] creates the card at the top of the column; [[crm.cancel]] closes the form. The window also reacts to Enter in the name field. The event “[[crm.dealCreated]]” is the first entry of the history, and an automation rule “deal created” fires.",
						"[[crm.save]] legt die Karte oben in der Spalte an; [[crm.cancel]] schließt das Formular. Auch die Eingabetaste im Namensfeld speichert. Das Ereignis „[[crm.dealCreated]]“ ist der erste Eintrag des Verlaufs, und eine Automatisierungsregel „Deal erstellt“ wird ausgelöst.",
						"[[crm.save]] створює картку вгорі колонки; [[crm.cancel]] закриває форму. Enter у полі назви теж зберігає. Подія «[[crm.dealCreated]]» — перший запис історії, і спрацьовує правило автоматизації «угоду створено».",
					),
				],
			},
			{
				title: t3("Managing stages (columns)", "Phasen (Spalten) verwalten", "Керування етапами (колонками)"),
				steps: [
					t3(
						"To rename a stage press the gear icon in its header (hint “[[crm.renameStage]]”). The name turns into an input field: type the new name (up to 60 characters) and press Enter, or click elsewhere, to save. Esc cancels the change.",
						"Um eine Phase umzubenennen, klicken Sie im Kopf auf das Zahnrad (Hinweis „[[crm.renameStage]]“). Der Name wird zum Eingabefeld: Tippen Sie den neuen Namen (bis 60 Zeichen) und drücken Sie Enter oder klicken Sie woanders hin, um zu speichern. Esc bricht die Änderung ab.",
						"Щоб перейменувати етап, натисніть шестерню в його заголовку (підказка «[[crm.renameStage]]»). Назва стане полем введення: наберіть нову назву (до 60 символів) і натисніть Enter або клацніть деінде, щоб зберегти. Esc скасовує зміну.",
					),
					t3(
						"In the same edit mode the pipette icon ([[crm.chooseColor]]) opens a colour window: choose one of the ready colours or use [[crm.customColor]]. The colour applies to the arrow in the board and to the stage chip in the list.",
						"Im selben Bearbeitungsmodus öffnet das Pipettensymbol ([[crm.chooseColor]]) ein Farbfenster: Wählen Sie eine fertige Farbe oder nutzen Sie [[crm.customColor]]. Die Farbe gilt für den Pfeil im Board und den Phasen-Chip in der Liste.",
						"У тому ж режимі редагування значок піпетки ([[crm.chooseColor]]) відкриває вікно кольору: оберіть готовий колір або скористайтеся [[crm.customColor]]. Колір діє для стрілки на дошці та мітки етапу в списку.",
					),
					t3(
						"The trash icon in edit mode deletes the stage. A window asks “[[crm.confirmDeleteStage]]”: after the confirmation the column and every deal in it are deleted, and this cannot be undone.",
						"Das Papierkorbsymbol im Bearbeitungsmodus löscht die Phase. Ein Fenster fragt „[[crm.confirmDeleteStage]]“: Nach der Bestätigung werden Spalte und alle darin liegenden Deals gelöscht, das lässt sich nicht rückgängig machen.",
						"Значок кошика в режимі редагування видаляє етап. Вікно питає «[[crm.confirmDeleteStage]]»: після підтвердження колонка й усі угоди в ній видаляються, це не скасувати.",
					),
					t3(
						"To reorder the stages, grab a column by its arrow header (the hint says “[[crm.columnDrag]]”) and drag it left or right.",
						"Um die Phasen neu zu ordnen, greifen Sie eine Spalte an ihrem Pfeilkopf (Hinweis „[[crm.columnDrag]]“) und ziehen sie nach links oder rechts.",
						"Щоб змінити порядок етапів, візьміться за колонку за її стрілку-заголовок (підказка «[[crm.columnDrag]]») і перетягніть ліворуч або праворуч.",
					),
					t3(
						"The dashed button [[crm.addStage]] after the last column adds a stage: type the name (the hint says “[[crm.newStageName]]”) and press [[crm.save]] or Enter; [[crm.cancel]] closes the field.",
						"Die gestrichelte Schaltfläche [[crm.addStage]] hinter der letzten Spalte fügt eine Phase hinzu: Geben Sie den Namen ein (Hinweis „[[crm.newStageName]]“) und klicken Sie auf [[crm.save]] oder drücken Sie Enter; [[crm.cancel]] schließt das Feld.",
						"Пунктирна кнопка [[crm.addStage]] після останньої колонки додає етап: введіть назву (підказка «[[crm.newStageName]]») і натисніть [[crm.save]] або Enter; [[crm.cancel]] закриває поле.",
					),
				],
			},
			{
				title: t3("List view of deals", "Listenansicht der Deals", "Подання угод списком"),
				steps: [
					t3(
						"The [[crm.list]] view shows all deals in one table with the columns [[crm.listName]], [[crm.client]], [[crm.company]], [[crm.listStage]] (a coloured chip), [[crm.startDate]] and [[crm.lastSeen]] (when the deal was last changed).",
						"Die Ansicht [[crm.list]] zeigt alle Deals in einer Tabelle mit den Spalten [[crm.listName]], [[crm.client]], [[crm.company]], [[crm.listStage]] (farbiger Chip), [[crm.startDate]] und [[crm.lastSeen]] (wann der Deal zuletzt geändert wurde).",
						"Подання [[crm.list]] показує всі угоди однією таблицею зі стовпцями [[crm.listName]], [[crm.client]], [[crm.company]], [[crm.listStage]] (кольорова мітка), [[crm.startDate]] і [[crm.lastSeen]] (коли угоду востаннє змінено).",
					),
					t3(
						"A click on a row opens the deal window. The search field above applies to the list too. To move a deal between stages use the stage arrows in the deal window.",
						"Ein Klick auf eine Zeile öffnet das Deal-Fenster. Das Suchfeld darüber gilt auch für die Liste. Um einen Deal zwischen Phasen zu verschieben, nutzen Sie die Phasenpfeile im Deal-Fenster.",
						"Натиск на рядок відкриває вікно угоди. Пошук угорі діє й для списку. Щоб перемістити угоду між етапами, скористайтеся стрілками етапів у вікні угоди.",
					),
				],
			},
			{
				title: t3("The deal window", "Das Deal-Fenster", "Вікно угоди"),
				steps: [
					t3(
						"At the top of the window is the deal name. The pencil icon ([[crm.edit]]) turns it into an input field: change the name and confirm with Enter or the check mark; cancelling restores the old name. The button [[ai.summary]] asks the AI assistant for a short description of the deal (who it is, current state, open points, recommended next action). The cross ([[crm.close]]) closes the window.",
						"Oben im Fenster steht der Dealname. Das Stiftsymbol ([[crm.edit]]) macht daraus ein Eingabefeld: Ändern Sie den Namen und bestätigen Sie mit Enter oder dem Häkchen; Abbrechen stellt den alten Namen wieder her. Die Schaltfläche [[ai.summary]] bittet den KI-Assistenten um eine kurze Beschreibung des Deals (wer, aktueller Stand, offene Punkte, empfohlener nächster Schritt). Das Kreuz ([[crm.close]]) schließt das Fenster.",
						"Угорі вікна — назва угоди. Значок олівця ([[crm.edit]]) перетворює її на поле введення: змініть назву й підтвердьте Enter або галочкою; скасування повертає стару назву. Кнопка [[ai.summary]] просить AI-асистента дати стислий опис угоди (хто це, поточний стан, відкриті питання, рекомендований наступний крок). Хрестик ([[crm.close]]) закриває вікно.",
					),
					t3(
						"Under the title is a row of arrows with all stages; the current one is highlighted. A click on another arrow moves the deal to that stage at once.",
						"Unter dem Titel steht eine Reihe von Pfeilen mit allen Phasen; die aktuelle ist hervorgehoben. Ein Klick auf einen anderen Pfeil verschiebt den Deal sofort in diese Phase.",
						"Під назвою — ряд стрілок з усіма етапами; поточний виділено. Натиск на іншу стрілку одразу переміщає угоду на цей етап.",
					),
					t3(
						"On the left are cards. The card [[crm.more]] shows [[crm.dealType]], [[crm.startDate]], [[crm.availableToAll]], [[crm.responsible]] and [[crm.utm]]. The button [[crm.edit]] in its header switches to input fields (the availability is a Yes/No list); [[crm.save]] stores the values and [[crm.cancel]] leaves without saving. [[crm.deleteSection]] clears all these values after a confirmation.",
						"Links stehen Karten. Die Karte [[crm.more]] zeigt [[crm.dealType]], [[crm.startDate]], [[crm.availableToAll]], [[crm.responsible]] und [[crm.utm]]. Die Schaltfläche [[crm.edit]] in ihrem Kopf schaltet auf Eingabefelder um (die Verfügbarkeit ist eine Ja/Nein-Liste); [[crm.save]] speichert die Werte, [[crm.cancel]] verlässt die Karte ohne Speichern. [[crm.deleteSection]] leert nach einer Bestätigung alle diese Werte.",
						"Ліворуч — картки. Картка [[crm.more]] показує [[crm.dealType]], [[crm.startDate]], [[crm.availableToAll]], [[crm.responsible]] і [[crm.utm]]. Кнопка [[crm.edit]] у її заголовку перемикає на поля введення (доступність — список Так/Ні); [[crm.save]] зберігає значення, [[crm.cancel]] виходить без збереження. [[crm.deleteSection]] очищує всі ці значення після підтвердження.",
					),
					t3(
						"The card [[crm.aboutDeal]] holds the main fields: [[crm.taskName]], [[crm.stage]] (a list of your stages), [[crm.startDate]], [[crm.contact]] (search by name, phone or e-mail; [[crm.addParticipant]] adds a further person after a comma) and [[crm.company]]. It opens in edit mode; [[crm.save]] stores the changes, and an empty name is refused with “[[crm.nameRequired]]”.",
						"Die Karte [[crm.aboutDeal]] enthält die Hauptfelder: [[crm.taskName]], [[crm.stage]] (Liste Ihrer Phasen), [[crm.startDate]], [[crm.contact]] (Suche nach Name, Telefon oder E-Mail; [[crm.addParticipant]] fügt nach einem Komma eine weitere Person hinzu) und [[crm.company]]. Sie öffnet sich im Bearbeitungsmodus; [[crm.save]] speichert die Änderungen, ein leerer Name wird mit „[[crm.nameRequired]]“ abgelehnt.",
						"Картка [[crm.aboutDeal]] містить основні поля: [[crm.taskName]], [[crm.stage]] (список ваших етапів), [[crm.startDate]], [[crm.contact]] (пошук за іменем, телефоном чи e-mail; [[crm.addParticipant]] додає ще одну особу через кому) і [[crm.company]]. Вона відкривається в режимі редагування; [[crm.save]] зберігає зміни, порожню назву відхиляє повідомленням «[[crm.nameRequired]]».",
					),
					t3(
						"The card [[crm.dealQuotes]] lists the quotes linked to this deal (number, status and amount) or says “[[crm.dealNoQuotes]]”. [[crm.dealCreateQuote]] opens Finance → Quotes with a new quote where the customer, contact and company of the deal are already filled in.",
						"Die Karte [[crm.dealQuotes]] listet die mit diesem Deal verknüpften Angebote (Nummer, Status und Betrag) oder sagt „[[crm.dealNoQuotes]]“. [[crm.dealCreateQuote]] öffnet Finanzen → Angebote mit einem neuen Angebot, in dem Kunde, Kontakt und Firma des Deals bereits ausgefüllt sind.",
						"Картка [[crm.dealQuotes]] перелічує пропозиції, пов’язані з цією угодою (номер, статус і сума), або каже «[[crm.dealNoQuotes]]». [[crm.dealCreateQuote]] відкриває Фінанси → Пропозиції з новою пропозицією, де клієнт, контакт і компанія угоди вже заповнені.",
					),
					t3(
						"The card [[crm.recurringDeal]] stores how often the deal repeats: [[crm.noSelection]], [[crm.recurDaily]], [[crm.recurWeekly]], [[crm.recurMonthly]] or [[crm.recurYearly]]. Choose with [[crm.edit]] and [[crm.save]]; [[crm.deleteSection]] resets it.",
						"Die Karte [[crm.recurringDeal]] speichert, wie oft sich der Deal wiederholt: [[crm.noSelection]], [[crm.recurDaily]], [[crm.recurWeekly]], [[crm.recurMonthly]] oder [[crm.recurYearly]]. Wählen Sie mit [[crm.edit]] und [[crm.save]]; [[crm.deleteSection]] setzt zurück.",
						"Картка [[crm.recurringDeal]] зберігає, як часто угода повторюється: [[crm.noSelection]], [[crm.recurDaily]], [[crm.recurWeekly]], [[crm.recurMonthly]] або [[crm.recurYearly]]. Оберіть через [[crm.edit]] і [[crm.save]]; [[crm.deleteSection]] скидає значення.",
					),
					t3(
						"The red link [[crm.deleteDeal]] at the end of the left column removes the deal after the question “[[crm.deleteDealText]]” is confirmed. This cannot be undone.",
						"Der rote Link [[crm.deleteDeal]] am Ende der linken Spalte entfernt den Deal, nachdem die Frage „[[crm.deleteDealText]]“ bestätigt wurde. Das lässt sich nicht rückgängig machen.",
						"Червоне посилання [[crm.deleteDeal]] унизу лівої колонки видаляє угоду після підтвердження запитання «[[crm.deleteDealText]]». Це не скасувати.",
					),
				],
			},
			{
				title: t3("Activity: comments, tasks and messages of a deal", "Aktivität: Kommentare, Aufgaben und Nachrichten eines Deals", "Активність: коментарі, завдання та повідомлення угоди"),
				steps: [
					t3(
						"On the right side of the deal window is the entry field with tabs: [[crm.tabActivity]], [[crm.tabComment]], [[crm.tabTask]], [[crm.tabSms]], [[crm.tabWhatsapp]], [[crm.tabTelegram]] and [[crm.tabEmail]]. Choose the type of entry with the tab, type the text and press [[crm.send]] (or Enter in the one-line tabs).",
						"Auf der rechten Seite des Deal-Fensters steht das Eingabefeld mit den Tabs [[crm.tabActivity]], [[crm.tabComment]], [[crm.tabTask]], [[crm.tabSms]], [[crm.tabWhatsapp]], [[crm.tabTelegram]] und [[crm.tabEmail]]. Wählen Sie die Art des Eintrags mit dem Tab, tippen Sie den Text und klicken Sie auf [[crm.send]] (oder Enter in den einzeiligen Tabs).",
						"Праворуч у вікні угоди — поле запису з вкладками: [[crm.tabActivity]], [[crm.tabComment]], [[crm.tabTask]], [[crm.tabSms]], [[crm.tabWhatsapp]], [[crm.tabTelegram]] і [[crm.tabEmail]]. Оберіть тип запису вкладкою, введіть текст і натисніть [[crm.send]] (або Enter в однорядкових вкладках).",
					),
					t3(
						"[[crm.tabActivity]] plans an activity (a call or meeting) and has an extra date field; [[crm.tabTask]] writes a to-do line. In the multi-line tabs [[crm.mention]] inserts an “@” sign at the cursor, [[crm.cancel]] clears the text. The buttons [[crm.file]] and [[crm.createDocument]] are shown greyed out with the hint “[[crm.soon]]”.",
						"[[crm.tabActivity]] plant eine Aktivität (Anruf oder Termin) und hat ein zusätzliches Datumsfeld; [[crm.tabTask]] schreibt eine To-do-Zeile. In den mehrzeiligen Tabs fügt [[crm.mention]] ein „@“ an der Cursorposition ein, [[crm.cancel]] leert den Text. Die Schaltflächen [[crm.file]] und [[crm.createDocument]] sind ausgegraut und tragen den Hinweis „[[crm.soon]]“.",
						"[[crm.tabActivity]] планує активність (дзвінок чи зустріч) і має додаткове поле дати; [[crm.tabTask]] записує рядок справи. У багаторядкових вкладках [[crm.mention]] вставляє знак «@» у місці курсора, [[crm.cancel]] очищує текст. Кнопки [[crm.file]] і [[crm.createDocument]] сірі, з підказкою «[[crm.soon]]».",
					),
					t3(
						"Important: entries in the tabs [[crm.tabSms]], [[crm.tabWhatsapp]], [[crm.tabTelegram]] and [[crm.tabEmail]] are saved as records in the deal history; the message itself is not sent from here. Send real messages in Collaboration → Chat and calls and Web mails.",
						"Wichtig: Einträge in den Tabs [[crm.tabSms]], [[crm.tabWhatsapp]], [[crm.tabTelegram]] und [[crm.tabEmail]] werden als Vermerke im Dealverlauf gespeichert; die Nachricht selbst wird von hier nicht versendet. Echte Nachrichten senden Sie unter Zusammenarbeit → Chat und Anrufe sowie Web-Mails.",
						"Важливо: записи у вкладках [[crm.tabSms]], [[crm.tabWhatsapp]], [[crm.tabTelegram]] і [[crm.tabEmail]] зберігаються як позначки в історії угоди; саме повідомлення звідси не надсилається. Справжні повідомлення надсилайте в «Співпраця» → «Чат і дзвінки» та «Веб-пошта».",
					),
					t3(
						"Below the field is the timeline, newest entries first. The link at its top switches the period: [[crm.allTime]] or [[crm.today]]. Every entry has a title by type ([[crm.typeComment]], [[crm.typeTask]], [[crm.typeEmail]] …); system entries “[[crm.dealCreated]]” and “[[crm.stageChanged]]” are written by the CRM itself. The bin icon ([[crm.deleteActivity]]) deletes your entry; system entries cannot be deleted. Without entries the timeline says “[[crm.notesEmpty]]”.",
						"Unter dem Feld steht die Zeitleiste, neueste Einträge zuerst. Der Link darüber wechselt den Zeitraum: [[crm.allTime]] oder [[crm.today]]. Jeder Eintrag hat einen Titel nach Art ([[crm.typeComment]], [[crm.typeTask]], [[crm.typeEmail]] …); die Systemeinträge „[[crm.dealCreated]]“ und „[[crm.stageChanged]]“ schreibt das CRM selbst. Das Papierkorbsymbol ([[crm.deleteActivity]]) löscht Ihren Eintrag; Systemeinträge lassen sich nicht löschen. Ohne Einträge steht in der Zeitleiste „[[crm.notesEmpty]]“.",
						"Під полем — стрічка, найновіші записи зверху. Посилання над нею перемикає період: [[crm.allTime]] або [[crm.today]]. Кожен запис має заголовок за типом ([[crm.typeComment]], [[crm.typeTask]], [[crm.typeEmail]] …); системні записи «[[crm.dealCreated]]» і «[[crm.stageChanged]]» пише сама CRM. Значок кошика ([[crm.deleteActivity]]) видаляє ваш запис; системні видалити не можна. Без записів стрічка каже «[[crm.notesEmpty]]».",
					),
				],
			},
			{
				title: t3("Contacts", "Kontakte", "Контакти"),
				steps: [
					t3(
						"The [[crm.contacts]] tab is a table with the columns [[crm.name]] (with round initials), [[crm.email]], [[crm.company]], [[crm.position]], [[crm.lastSeen]] and [[crm.percent]] (how completely the card is filled in: e-mail, phone, company, position, website and social links). Without contacts it says “[[crm.emptyContacts]]”.",
						"Der Tab [[crm.contacts]] ist eine Tabelle mit den Spalten [[crm.name]] (mit runden Initialen), [[crm.email]], [[crm.company]], [[crm.position]], [[crm.lastSeen]] und [[crm.percent]] (wie vollständig die Karte ausgefüllt ist: E-Mail, Telefon, Firma, Position, Website und Social-Links). Ohne Kontakte steht dort „[[crm.emptyContacts]]“.",
						"Вкладка [[crm.contacts]] — таблиця зі стовпцями [[crm.name]] (з круглими ініціалами), [[crm.email]], [[crm.company]], [[crm.position]], [[crm.lastSeen]] і [[crm.percent]] (наскільки повно заповнено картку: e-mail, телефон, компанія, посада, сайт і соцмережі). Без контактів там «[[crm.emptyContacts]]».",
					),
					t3(
						"Tick the boxes at the left of rows to select them; the box in the header selects all rows shown. Above the table: [[crm.addContact]] opens an empty card; [[crm.editContact]] is active only when exactly one row is ticked and opens that contact; “[[crm.deleteSelected]] (N)” appears when something is ticked and deletes the selected contacts after the question “[[crm.confirmDeleteContacts]]”.",
						"Setzen Sie links in den Zeilen Haken, um sie auszuwählen; das Kästchen in der Kopfzeile wählt alle angezeigten Zeilen. Über der Tabelle: [[crm.addContact]] öffnet eine leere Karte; [[crm.editContact]] ist nur aktiv, wenn genau eine Zeile angehakt ist, und öffnet diesen Kontakt; „[[crm.deleteSelected]] (N)“ erscheint, sobald etwas angehakt ist, und löscht die gewählten Kontakte nach der Frage „[[crm.confirmDeleteContacts]]“.",
						"Позначайте прапорцями рядки ліворуч; прапорець у заголовку вибирає всі показані рядки. Над таблицею: [[crm.addContact]] відкриває порожню картку; [[crm.editContact]] активна лише коли позначено рівно один рядок і відкриває цей контакт; «[[crm.deleteSelected]] (N)» з’являється, коли щось позначено, і видаляє вибрані контакти після запитання «[[crm.confirmDeleteContacts]]».",
					),
					t3(
						"The contact page has the fields [[crm.firstName]], [[crm.lastName]], [[crm.email]], [[crm.company]], [[crm.role]], [[crm.website]], [[crm.twitter]], [[crm.facebook]] and [[crm.phone]]. At least the first or the last name is required (otherwise “[[crm.nameRequired]]”). [[crm.save]] stores the contact and shows “[[crm.saved]]”; a new contact then opens on its own page. [[crm.back]] returns to the table (the same tab).",
						"Die Kontaktseite hat die Felder [[crm.firstName]], [[crm.lastName]], [[crm.email]], [[crm.company]], [[crm.role]], [[crm.website]], [[crm.twitter]], [[crm.facebook]] und [[crm.phone]]. Mindestens Vor- oder Nachname ist Pflicht (sonst „[[crm.nameRequired]]“). [[crm.save]] speichert den Kontakt und zeigt „[[crm.saved]]“; ein neuer Kontakt öffnet sich danach auf seiner eigenen Seite. [[crm.back]] führt zurück zur Tabelle (derselbe Tab).",
						"Сторінка контакту має поля [[crm.firstName]], [[crm.lastName]], [[crm.email]], [[crm.company]], [[crm.role]], [[crm.website]], [[crm.twitter]], [[crm.facebook]] і [[crm.phone]]. Потрібне принаймні ім’я або прізвище (інакше «[[crm.nameRequired]]»). [[crm.save]] зберігає контакт і показує «[[crm.saved]]»; новий контакт після цього відкривається на власній сторінці. [[crm.back]] повертає до таблиці (та сама вкладка).",
					),
					t3(
						"Under the fields is the history of the contact. Until the contact is saved for the first time it says “[[crm.saveFirst]]”. After that the tabs [[crm.newNote]], [[crm.emailTab]], [[crm.call]], [[crm.newActivity]], [[crm.createTask]] and [[crm.schedule]] add entries in the same way as in a deal; the timeline below can be deleted entry by entry. As in a deal, the e-mail and call entries are records and do not send or dial anything.",
						"Unter den Feldern steht der Verlauf des Kontakts. Bis der Kontakt zum ersten Mal gespeichert ist, steht dort „[[crm.saveFirst]]“. Danach fügen die Tabs [[crm.newNote]], [[crm.emailTab]], [[crm.call]], [[crm.newActivity]], [[crm.createTask]] und [[crm.schedule]] Einträge auf dieselbe Weise wie im Deal hinzu; die Zeitleiste darunter lässt sich Eintrag für Eintrag löschen. Wie im Deal sind die E-Mail- und Anruf-Einträge Vermerke und versenden oder wählen nichts.",
						"Під полями — історія контакту. Поки контакт не збережено вперше, там «[[crm.saveFirst]]». Після цього вкладки [[crm.newNote]], [[crm.emailTab]], [[crm.call]], [[crm.newActivity]], [[crm.createTask]] і [[crm.schedule]] додають записи так само, як в угоді; стрічку нижче можна видаляти запис за записом. Як і в угоді, записи пошти й дзвінка — це позначки, вони нічого не надсилають і не набирають.",
					),
					t3(
						"On the contact page the button [[ai.summary]] gives a short AI description of the customer: who it is, the history of communication, open points and the recommended next action.",
						"Auf der Kontaktseite gibt die Schaltfläche [[ai.summary]] eine kurze KI-Beschreibung des Kunden: wer es ist, Kommunikationsverlauf, offene Punkte und empfohlener nächster Schritt.",
						"На сторінці контакту кнопка [[ai.summary]] дає стислий AI-опис клієнта: хто це, історія спілкування, відкриті питання й рекомендований наступний крок.",
					),
				],
			},
			{
				title: t3("Companies", "Firmen", "Компанії"),
				steps: [
					t3(
						"The [[crm.companies]] tab works like the contacts: a table with [[crm.company]], [[crm.email]], [[crm.field]], [[crm.lastSeen]] and [[crm.percent]]; the same toolbar with [[crm.addCompany]], [[crm.editCompany]] and “[[crm.deleteSelected]] (N)” (the question is “[[crm.confirmDeleteCompanies]]”). An empty tab says “[[crm.emptyCompanies]]”.",
						"Der Tab [[crm.companies]] funktioniert wie die Kontakte: eine Tabelle mit [[crm.company]], [[crm.email]], [[crm.field]], [[crm.lastSeen]] und [[crm.percent]]; dieselbe Werkzeugleiste mit [[crm.addCompany]], [[crm.editCompany]] und „[[crm.deleteSelected]] (N)“ (die Frage lautet „[[crm.confirmDeleteCompanies]]“). Ein leerer Tab sagt „[[crm.emptyCompanies]]“.",
						"Вкладка [[crm.companies]] працює як контакти: таблиця з [[crm.company]], [[crm.email]], [[crm.field]], [[crm.lastSeen]] і [[crm.percent]]; та сама панель із [[crm.addCompany]], [[crm.editCompany]] і «[[crm.deleteSelected]] (N)» (запитання — «[[crm.confirmDeleteCompanies]]»). Порожня вкладка каже «[[crm.emptyCompanies]]».",
					),
					t3(
						"The company page has the fields [[crm.legalName]] (the name), [[crm.legalStatus]], [[crm.usreouCode]], [[crm.registrationDate]], [[crm.authorisedPerson]], [[crm.businessType]], [[crm.ownershipForm]], [[crm.companyContacts]] (address), [[crm.email]] and [[crm.field]] (area of business). [[crm.save]] stores the record and [[crm.back]] returns to the list.",
						"Die Firmenseite hat die Felder [[crm.legalName]] (der Name), [[crm.legalStatus]], [[crm.usreouCode]], [[crm.registrationDate]], [[crm.authorisedPerson]], [[crm.businessType]], [[crm.ownershipForm]], [[crm.companyContacts]] (Adresse), [[crm.email]] und [[crm.field]] (Tätigkeitsbereich). [[crm.save]] speichert den Eintrag, [[crm.back]] führt zur Liste zurück.",
						"Сторінка компанії має поля [[crm.legalName]] (назва), [[crm.legalStatus]], [[crm.usreouCode]], [[crm.registrationDate]], [[crm.authorisedPerson]], [[crm.businessType]], [[crm.ownershipForm]], [[crm.companyContacts]] (адреса), [[crm.email]] і [[crm.field]] (сфера діяльності). [[crm.save]] зберігає запис, [[crm.back]] повертає до списку.",
					),
					t3(
						"As on contacts, the history with notes and tasks appears after the first save, and [[ai.summary]] gives an AI description of the company. Companies created here appear as suggestions when you fill in the company of a deal or a contact.",
						"Wie bei Kontakten erscheint der Verlauf mit Notizen und Aufgaben nach dem ersten Speichern, und [[ai.summary]] gibt eine KI-Beschreibung der Firma. Hier angelegte Firmen erscheinen als Vorschläge, wenn Sie die Firma eines Deals oder Kontakts ausfüllen.",
						"Як і в контактів, історія з нотатками та завданнями з’являється після першого збереження, а [[ai.summary]] дає AI-опис компанії. Створені тут компанії з’являються підказками, коли ви заповнюєте компанію угоди чи контакту.",
					),
				],
			},
		],
	},
];
