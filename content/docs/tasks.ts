import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Задачи и проекты.
export const TASKS: DocSection[] = [
	{
		id: "tasks",
		title: t3("Tasks and projects", "Aufgaben und Projekte", "Завдання та проєкти"),
		intro: t3(
			"The [[navigation.tasks_projects]] section has two tabs at the top: [[tasks.tasks]] (single to-dos with a deadline) and [[tasks.projects]] (cards that show progress). The section is included in every plan, including Free.",
			"Der Bereich [[navigation.tasks_projects]] hat oben zwei Tabs: [[tasks.tasks]] (einzelne To-dos mit Frist) und [[tasks.projects]] (Karten mit Fortschritt). Der Bereich ist in jedem Tarif enthalten, auch in Free.",
			"Розділ [[navigation.tasks_projects]] має вгорі дві вкладки: [[tasks.tasks]] (окремі справи з терміном) і [[tasks.projects]] (картки з прогресом). Розділ входить до кожного тарифу, зокрема Free.",
		),
		groups: [
			{
				title: t3("Search and filters", "Suche und Filter", "Пошук і фільтри"),
				steps: [
					t3(
						"The search field at the top right filters the tasks as you type: it looks at the title, the responsible person and the author. The cross in the field ([[crm.clearSearch]]) clears the text.",
						"Das Suchfeld oben rechts filtert die Aufgaben beim Tippen: Es sucht im Titel, beim Verantwortlichen und beim Autor. Das Kreuz im Feld ([[crm.clearSearch]]) leert den Text.",
						"Поле пошуку вгорі праворуч фільтрує завдання під час введення: воно шукає за назвою, відповідальним і автором. Хрестик у полі ([[crm.clearSearch]]) очищує текст.",
					),
					t3(
						"The button with the sliders icon ([[crm.filters]]) next to the field opens a small panel with two lists: [[tasks.filterStatus]] ([[tasks.allStatuses]], [[tasks.statusActive]], [[tasks.statusCompleted]], [[tasks.statusEnded]]) and [[tasks.filterResponsible]] ([[tasks.allResponsibles]] or one of the people who appear in your tasks). When a filter is on, the button turns green and shows how many filters are active; [[crm.filtersReset]] in the panel switches them all off.",
						"Die Schaltfläche mit dem Reglersymbol ([[crm.filters]]) neben dem Feld öffnet ein kleines Panel mit zwei Listen: [[tasks.filterStatus]] ([[tasks.allStatuses]], [[tasks.statusActive]], [[tasks.statusCompleted]], [[tasks.statusEnded]]) und [[tasks.filterResponsible]] ([[tasks.allResponsibles]] oder eine der Personen, die in Ihren Aufgaben vorkommen). Ist ein Filter an, wird die Schaltfläche grün und zeigt die Zahl der aktiven Filter; [[crm.filtersReset]] im Panel schaltet alle aus.",
						"Кнопка зі значком повзунків ([[crm.filters]]) поруч із полем відкриває невелику панель із двома списками: [[tasks.filterStatus]] ([[tasks.allStatuses]], [[tasks.statusActive]], [[tasks.statusCompleted]], [[tasks.statusEnded]]) і [[tasks.filterResponsible]] ([[tasks.allResponsibles]] або одна з осіб, що трапляються у ваших завданнях). Коли фільтр увімкнено, кнопка стає зеленою й показує кількість активних фільтрів; [[crm.filtersReset]] у панелі вимикає їх усі.",
					),
					t3(
						"A task counts as [[tasks.statusEnded]] when its deadline has passed and it is not completed. The search and the filters apply to all three views of the [[tasks.tasks]] tab.",
						"Eine Aufgabe gilt als [[tasks.statusEnded]], wenn ihre Frist verstrichen und sie nicht erledigt ist. Suche und Filter gelten für alle drei Ansichten des Tabs [[tasks.tasks]].",
						"Завдання має статус [[tasks.statusEnded]], коли його термін минув і воно не виконане. Пошук і фільтри діють для всіх трьох подань вкладки [[tasks.tasks]].",
					),
				],
			},
			{
				title: t3("Adding and editing a task", "Eine Aufgabe anlegen und bearbeiten", "Додавання й редагування завдання"),
				steps: [
					t3(
						"Press the green button [[tasks.addTask]] in the row above the table. The window [[tasks.newTask]] opens.",
						"Klicken Sie auf die grüne Schaltfläche [[tasks.addTask]] in der Zeile über der Tabelle. Es öffnet sich das Fenster [[tasks.newTask]].",
						"Натисніть зелену кнопку [[tasks.addTask]] у рядку над таблицею. Відкриється вікно [[tasks.newTask]].",
					),
					t3(
						"Fill in [[tasks.title]] (required, up to 200 characters), [[tasks.description]] (up to 500 characters), [[tasks.deadline]] (a date and time picker; optional) and [[tasks.responsible]] (free text, up to 100 characters: type the name of the person). The cursor is already in the title field.",
						"Füllen Sie [[tasks.title]] (Pflicht, bis 200 Zeichen), [[tasks.description]] (bis 500 Zeichen), [[tasks.deadline]] (Datums- und Zeitauswahl; optional) und [[tasks.responsible]] (Freitext, bis 100 Zeichen: den Namen der Person eintippen) aus. Der Cursor steht bereits im Titelfeld.",
						"Заповніть [[tasks.title]] (обов’язково, до 200 символів), [[tasks.description]] (до 500 символів), [[tasks.deadline]] (вибір дати й часу; необов’язково) і [[tasks.responsible]] (вільний текст, до 100 символів: введіть ім’я особи). Курсор уже стоїть у полі назви.",
					),
					t3(
						"[[tasks.save]] stores the task and shows “[[tasks.saved]]”. Without a title you get “[[tasks.titleRequired]]” and nothing is saved; on a server problem “[[tasks.error]]” appears. [[tasks.cancel]], the cross in the corner, the Esc key and a click outside the window close it without saving.",
						"[[tasks.save]] speichert die Aufgabe und zeigt „[[tasks.saved]]“. Ohne Titel erscheint „[[tasks.titleRequired]]“, und nichts wird gespeichert; bei einem Serverproblem erscheint „[[tasks.error]]“. [[tasks.cancel]], das Kreuz in der Ecke, die Esc-Taste und ein Klick außerhalb des Fensters schließen es ohne Speichern.",
						"[[tasks.save]] зберігає завдання й показує «[[tasks.saved]]». Без назви з’явиться «[[tasks.titleRequired]]», і нічого не збережеться; при проблемі сервера — «[[tasks.error]]». [[tasks.cancel]], хрестик у куті, клавіша Esc і клацання поза вікном закривають його без збереження.",
					),
					t3(
						"To change a task click its title (in any view) or open the row menu and choose [[tasks.editTask]]. The same window opens with the current values. The author of the task and the change date are filled in by the CRM.",
						"Um eine Aufgabe zu ändern, klicken Sie auf ihren Titel (in jeder Ansicht) oder öffnen das Zeilenmenü und wählen [[tasks.editTask]]. Dasselbe Fenster öffnet sich mit den aktuellen Werten. Autor und Änderungsdatum trägt das CRM selbst ein.",
						"Щоб змінити завдання, клацніть його назву (у будь-якому поданні) або відкрийте меню рядка й оберіть [[tasks.editTask]]. Відкриється те саме вікно з поточними значеннями. Автора та дату зміни заповнює сама CRM.",
					),
					t3(
						"The window does not have a completion switch: to mark a task done use the bulk action [[tasks.actionDone]] (see below). Deleting a task from the window is not possible either; use the row menu or the bulk action.",
						"Das Fenster hat keinen Erledigt-Schalter: Um eine Aufgabe als erledigt zu markieren, nutzen Sie die Sammelaktion [[tasks.actionDone]] (siehe unten). Auch löschen lässt sich eine Aufgabe nicht aus dem Fenster; nutzen Sie das Zeilenmenü oder die Sammelaktion.",
						"У вікні немає перемикача виконання: щоб позначити завдання виконаним, скористайтеся груповою дією [[tasks.actionDone]] (див. нижче). Видалити завдання з вікна теж не можна; користуйтеся меню рядка або груповою дією.",
					),
				],
			},
			{
				title: t3("The [[tasks.list]] view", "Die Ansicht [[tasks.list]]", "Подання [[tasks.list]]"),
				steps: [
					t3(
						"Under the tabs there is a switch of three views: [[tasks.list]], [[tasks.deadlineTab]] and [[tasks.planner]]. To the right of it a line “[[tasks.myItems]]” shows two counters: [[tasks.overdue]] (how many tasks are late) and [[tasks.comments]] (how many comment entries exist in the tasks).",
						"Unter den Tabs schaltet ein Umschalter zwischen drei Ansichten: [[tasks.list]], [[tasks.deadlineTab]] und [[tasks.planner]]. Rechts davon zeigt die Zeile „[[tasks.myItems]]“ zwei Zähler: [[tasks.overdue]] (wie viele Aufgaben überfällig sind) und [[tasks.comments]] (wie viele Kommentar-Einträge es in den Aufgaben gibt).",
						"Під вкладками — перемикач трьох подань: [[tasks.list]], [[tasks.deadlineTab]] і [[tasks.planner]]. Праворуч від нього рядок «[[tasks.myItems]]» показує два лічильники: [[tasks.overdue]] (скільки завдань прострочено) і [[tasks.comments]] (скільки записів-коментарів є в завданнях).",
					),
					t3(
						"The table has the columns [[tasks.name]], the status column (its header reads [[tasks.status]] and, under it, the date of the last change of the task), [[tasks.deadline]], [[tasks.createdBy]] and [[tasks.responsible]]. Completed tasks have a crossed-out title; a task past its deadline shows a red badge with how long it is late; a completed task shows a green badge [[tasks.statusCompleted]]; without a deadline the cell says “[[tasks.noDeadline]]”.",
						"Die Tabelle hat die Spalten [[tasks.name]], die Statusspalte (ihre Überschrift lautet [[tasks.status]], darunter steht das Datum der letzten Änderung der Aufgabe), [[tasks.deadline]], [[tasks.createdBy]] und [[tasks.responsible]]. Erledigte Aufgaben haben einen durchgestrichenen Titel; eine überfällige Aufgabe zeigt ein rotes Kennzeichen mit der Dauer der Verspätung; eine erledigte Aufgabe ein grünes Kennzeichen [[tasks.statusCompleted]]; ohne Frist steht in der Zelle „[[tasks.noDeadline]]“.",
						"Таблиця має стовпці [[tasks.name]], стовпець статусу (його заголовок — [[tasks.status]], а під ним дата останньої зміни завдання), [[tasks.deadline]], [[tasks.createdBy]] і [[tasks.responsible]]. Виконані завдання мають закреслену назву; прострочене показує червону мітку з тривалістю запізнення; виконане — зелену мітку [[tasks.statusCompleted]]; без терміну в комірці «[[tasks.noDeadline]]».",
					),
					t3(
						"The header of the status column is a button with an arrow: it opens a list ([[tasks.allStatuses]], [[tasks.statusActive]], [[tasks.statusCompleted]], [[tasks.statusEnded]]) and filters the table by the chosen status. It is the same filter as in the panel [[crm.filters]].",
						"Die Kopfzeile der Statusspalte ist eine Schaltfläche mit Pfeil: Sie öffnet eine Liste ([[tasks.allStatuses]], [[tasks.statusActive]], [[tasks.statusCompleted]], [[tasks.statusEnded]]) und filtert die Tabelle nach dem gewählten Status. Es ist derselbe Filter wie im Panel [[crm.filters]].",
						"Заголовок стовпця статусу — кнопка зі стрілкою: вона відкриває список ([[tasks.allStatuses]], [[tasks.statusActive]], [[tasks.statusCompleted]], [[tasks.statusEnded]]) і фільтрує таблицю за вибраним статусом. Це той самий фільтр, що й у панелі [[crm.filters]].",
					),
					t3(
						"Next to a title are two small icons. The pin ([[tasks.pinned]]) fixes the task at the top of the list: click to turn it on (the icon turns green) and click again to turn it off. The crossed bell ([[tasks.muted]]) marks the task as muted in the same way. Both marks are saved at once and stay after a reload.",
						"Neben dem Titel stehen zwei kleine Symbole. Die Pinnnadel ([[tasks.pinned]]) heftet die Aufgabe oben an die Liste: Klick schaltet sie ein (das Symbol wird grün), ein weiterer Klick schaltet sie aus. Die durchgestrichene Glocke ([[tasks.muted]]) markiert die Aufgabe auf dieselbe Weise als stumm. Beide Markierungen werden sofort gespeichert und bleiben nach einem Neuladen erhalten.",
						"Поруч із назвою — два маленькі значки. Кнопка ([[tasks.pinned]]) закріплює завдання вгорі списку: клацніть, щоб увімкнути (значок стане зеленим), і ще раз, щоб вимкнути. Перекреслений дзвінок ([[tasks.muted]]) так само позначає завдання як безгучне. Обидві позначки зберігаються одразу й лишаються після перезавантаження.",
					),
					t3(
						"The three dots in the second column ([[tasks.options]]) open the row menu: [[tasks.editTask]] and, in red, [[tasks.actionDelete]]. Deleting asks “[[tasks.confirmDelete]]”; [[crm.continue]] deletes the task, [[crm.cancel]] keeps it.",
						"Die drei Punkte in der zweiten Spalte ([[tasks.options]]) öffnen das Zeilenmenü: [[tasks.editTask]] und in Rot [[tasks.actionDelete]]. Das Löschen fragt „[[tasks.confirmDelete]]“; [[crm.continue]] löscht die Aufgabe, [[crm.cancel]] behält sie.",
						"Три крапки у другому стовпці ([[tasks.options]]) відкривають меню рядка: [[tasks.editTask]] і червоним [[tasks.actionDelete]]. Видалення питає «[[tasks.confirmDelete]]»; [[crm.continue]] видаляє завдання, [[crm.cancel]] залишає.",
					),
					t3(
						"The footer of the table shows how many rows are selected and how many there are in total. Without tasks the table says “[[tasks.empty]]”.",
						"Die Fußzeile der Tabelle zeigt, wie viele Zeilen ausgewählt und wie viele insgesamt vorhanden sind. Ohne Aufgaben steht in der Tabelle „[[tasks.empty]]“.",
						"Підвал таблиці показує, скільки рядків вибрано й скільки їх усього. Без завдань таблиця каже «[[tasks.empty]]».",
					),
				],
			},
			{
				title: t3("Bulk actions", "Sammelaktionen", "Групові дії"),
				steps: [
					t3(
						"Tick the boxes at the left of the rows you need; the box in the header ([[tasks.selectAll]]) selects all rows that the filters currently show. The selected rows are highlighted.",
						"Setzen Sie links bei den gewünschten Zeilen Haken; das Kästchen in der Kopfzeile ([[tasks.selectAll]]) wählt alle Zeilen, die die Filter gerade zeigen. Die gewählten Zeilen werden hervorgehoben.",
						"Позначте прапорцями ліворуч потрібні рядки; прапорець у заголовку ([[tasks.selectAll]]) вибирає всі рядки, які зараз показують фільтри. Вибрані рядки підсвічуються.",
					),
					t3(
						"Under the table open the list [[tasks.selectAction]] and choose [[tasks.actionDone]], [[tasks.actionActive]] or, in red, [[tasks.actionDelete]]. The chosen action is written on the button.",
						"Öffnen Sie unter der Tabelle die Liste [[tasks.selectAction]] und wählen Sie [[tasks.actionDone]], [[tasks.actionActive]] oder in Rot [[tasks.actionDelete]]. Die gewählte Aktion steht auf der Schaltfläche.",
						"Під таблицею відкрийте список [[tasks.selectAction]] і оберіть [[tasks.actionDone]], [[tasks.actionActive]] або червоним [[tasks.actionDelete]]. Вибрану дію написано на кнопці.",
					),
					t3(
						"Press [[tasks.apply]] (it is active only when an action is chosen and at least one row is ticked). The first two actions change the tasks at once and show “[[tasks.saved]]”. [[tasks.actionDelete]] first asks “[[tasks.confirmDelete]]”, and only [[crm.continue]] removes the tasks.",
						"Klicken Sie auf [[tasks.apply]] (aktiv nur, wenn eine Aktion gewählt und mindestens eine Zeile angehakt ist). Die ersten beiden Aktionen ändern die Aufgaben sofort und zeigen „[[tasks.saved]]“. [[tasks.actionDelete]] fragt zuerst „[[tasks.confirmDelete]]“, und erst [[crm.continue]] entfernt die Aufgaben.",
						"Натисніть [[tasks.apply]] (активна лише коли вибрано дію й позначено щонайменше один рядок). Перші дві дії змінюють завдання одразу й показують «[[tasks.saved]]». [[tasks.actionDelete]] спершу питає «[[tasks.confirmDelete]]», і лише [[crm.continue]] видаляє завдання.",
					),
				],
			},
			{
				title: t3("The [[tasks.deadlineTab]] and [[tasks.planner]] views", "Die Ansichten [[tasks.deadlineTab]] und [[tasks.planner]]", "Подання [[tasks.deadlineTab]] і [[tasks.planner]]"),
				steps: [
					t3(
						"[[tasks.deadlineTab]] groups the tasks by urgency: [[tasks.overdue]], [[tasks.today]], [[tasks.upcoming]] and [[tasks.noDeadline]]. Every block has its own heading with the number of tasks; a group without tasks is not shown. A click on a title opens the task for editing; on the right you see the deadline or the badge of the status.",
						"[[tasks.deadlineTab]] gruppiert die Aufgaben nach Dringlichkeit: [[tasks.overdue]], [[tasks.today]], [[tasks.upcoming]] und [[tasks.noDeadline]]. Jeder Block hat eine eigene Überschrift mit der Zahl der Aufgaben; eine Gruppe ohne Aufgaben wird nicht angezeigt. Ein Klick auf einen Titel öffnet die Aufgabe zur Bearbeitung; rechts steht die Frist oder das Statuskennzeichen.",
						"[[tasks.deadlineTab]] групує завдання за терміновістю: [[tasks.overdue]], [[tasks.today]], [[tasks.upcoming]] і [[tasks.noDeadline]]. Кожен блок має власний заголовок із кількістю завдань; група без завдань не показується. Натиск на назву відкриває завдання для редагування; праворуч — термін або мітка статусу.",
					),
					t3(
						"[[tasks.planner]] shows 14 days starting from today as small day cards. A card has the weekday and date, a number chip with the count of tasks and a thin load bar (its tooltip says how many tasks fall on this day). Today has a green frame, weekends are slightly tinted. Under the bar the tasks of the day are listed with a coloured dot (amber active, green completed, red late) and the time; a click opens the task. An empty day says “[[tasks.plannerFree]]”.",
						"[[tasks.planner]] zeigt 14 Tage ab heute als kleine Tageskarten. Eine Karte hat Wochentag und Datum, einen Zähler-Chip mit der Zahl der Aufgaben und einen dünnen Auslastungsbalken (sein Tooltip nennt, wie viele Aufgaben auf diesen Tag fallen). Heute hat einen grünen Rahmen, Wochenenden sind leicht abgesetzt. Unter dem Balken stehen die Aufgaben des Tages mit einem farbigen Punkt (gelb aktiv, grün erledigt, rot überfällig) und der Uhrzeit; ein Klick öffnet die Aufgabe. Ein leerer Tag zeigt „[[tasks.plannerFree]]“.",
						"[[tasks.planner]] показує 14 днів від сьогодні маленькими картками днів. Картка має день тижня й дату, мітку-лічильник кількості завдань і тонку смугу навантаження (її підказка каже, скільки завдань припадає на цей день). Сьогодні має зелену рамку, вихідні трохи затемнені. Під смугою перелічено завдання дня з кольоровою крапкою (бурштинова — активне, зелена — виконане, червона — прострочене) та часом; натиск відкриває завдання. Порожній день каже «[[tasks.plannerFree]]».",
					),
					t3(
						"Above the cards you see the range of dates and how many tasks fall in it. The buttons ← and → shift the range by one week, [[tasks.plannerToday]] returns to the current week. If tasks are overdue, a block [[tasks.overdue]] with the first 12 of them is shown above the days.",
						"Über den Karten stehen der Datumsbereich und die Zahl der darin liegenden Aufgaben. Die Schaltflächen ← und → verschieben den Bereich um eine Woche, [[tasks.plannerToday]] kehrt zur aktuellen Woche zurück. Sind Aufgaben überfällig, steht über den Tagen ein Block [[tasks.overdue]] mit den ersten 12 davon.",
						"Над картками — діапазон дат і кількість завдань у ньому. Кнопки ← і → зсувають діапазон на тиждень, [[tasks.plannerToday]] повертає до поточного тижня. Якщо є прострочені завдання, над днями показано блок [[tasks.overdue]] із перших 12 з них.",
					),
				],
			},
			{
				title: t3("Projects", "Projekte", "Проєкти"),
				steps: [
					t3(
						"Open the tab [[tasks.projects]]. It shows the projects as cards. Without projects the page says “[[tasks.projectEmpty]]”.",
						"Öffnen Sie den Tab [[tasks.projects]]. Er zeigt die Projekte als Karten. Ohne Projekte steht auf der Seite „[[tasks.projectEmpty]]“.",
						"Відкрийте вкладку [[tasks.projects]]. Вона показує проєкти картками. Без проєктів на сторінці «[[tasks.projectEmpty]]».",
					),
					t3(
						"Press [[tasks.projectNew]] on the right. In the window fill in [[tasks.projectName]] (required, up to 200 characters), [[tasks.projectDescription]] (up to 2000 characters), [[tasks.projectStatus]] ([[tasks.projectStatus_planned]], [[tasks.projectStatus_active]], [[tasks.projectStatus_paused]], [[tasks.projectStatus_done]]), [[tasks.filterResponsible]] (free text), [[tasks.projectStart]] and [[tasks.projectEnd]] (dates) and choose a colour from six ready circles; the chosen circle gets a light ring.",
						"Klicken Sie rechts auf [[tasks.projectNew]]. Füllen Sie im Fenster [[tasks.projectName]] (Pflicht, bis 200 Zeichen), [[tasks.projectDescription]] (bis 2000 Zeichen), [[tasks.projectStatus]] ([[tasks.projectStatus_planned]], [[tasks.projectStatus_active]], [[tasks.projectStatus_paused]], [[tasks.projectStatus_done]]), [[tasks.filterResponsible]] (Freitext), [[tasks.projectStart]] und [[tasks.projectEnd]] (Datumsangaben) aus und wählen Sie eine Farbe aus sechs fertigen Kreisen; der gewählte Kreis bekommt einen hellen Ring.",
						"Натисніть [[tasks.projectNew]] праворуч. У вікні заповніть [[tasks.projectName]] (обов’язково, до 200 символів), [[tasks.projectDescription]] (до 2000 символів), [[tasks.projectStatus]] ([[tasks.projectStatus_planned]], [[tasks.projectStatus_active]], [[tasks.projectStatus_paused]], [[tasks.projectStatus_done]]), [[tasks.filterResponsible]] (вільний текст), [[tasks.projectStart]] і [[tasks.projectEnd]] (дати) та оберіть колір із шести готових кружків; вибраний кружок отримує світле кільце.",
					),
					t3(
						"[[tasks.save]] creates the project and shows “[[tasks.projectSaved]]”. An empty name gives “[[tasks.projectNameRequired]]”, and an end date earlier than the start date gives “[[tasks.projectDatesInvalid]]”; the window stays open with the message at the bottom.",
						"[[tasks.save]] legt das Projekt an und zeigt „[[tasks.projectSaved]]“. Ein leerer Name führt zu „[[tasks.projectNameRequired]]“, ein Ende vor dem Beginn zu „[[tasks.projectDatesInvalid]]“; das Fenster bleibt offen, die Meldung steht unten.",
						"[[tasks.save]] створює проєкт і показує «[[tasks.projectSaved]]». Порожня назва дає «[[tasks.projectNameRequired]]», а кінець раніше за початок — «[[tasks.projectDatesInvalid]]»; вікно лишається відкритим, повідомлення внизу.",
					),
					t3(
						"A project card shows a colour dot, the name, the status, a two-line description, the owner and the period, and a progress bar with “done/total · percent” (or “[[tasks.projectNoTasks]]”). The pencil ([[tasks.projectEdit]]) opens the same window for editing.",
						"Eine Projektkarte zeigt einen Farbpunkt, den Namen, den Status, eine zweizeilige Beschreibung, den Verantwortlichen und den Zeitraum sowie einen Fortschrittsbalken mit „erledigt/gesamt · Prozent“ (oder „[[tasks.projectNoTasks]]“). Der Stift ([[tasks.projectEdit]]) öffnet dasselbe Fenster zum Bearbeiten.",
						"Картка проєкту показує кольорову крапку, назву, статус, двохрядковий опис, відповідального й період та смугу прогресу з «виконано/усього · відсоток» (або «[[tasks.projectNoTasks]]»). Олівець ([[tasks.projectEdit]]) відкриває те саме вікно для редагування.",
					),
					t3(
						"A click on the project name opens under the cards a panel with the tasks of this project (title, a dot for the state and the date); a click on a task opens it for editing; [[tasks.projectClose]] closes the panel.",
						"Ein Klick auf den Projektnamen öffnet unter den Karten ein Panel mit den Aufgaben dieses Projekts (Titel, Punkt für den Zustand und Datum); ein Klick auf eine Aufgabe öffnet sie zum Bearbeiten; [[tasks.projectClose]] schließt das Panel.",
						"Натиск на назву проєкту відкриває під картками панель із завданнями цього проєкту (назва, крапка стану й дата); натиск на завдання відкриває його для редагування; [[tasks.projectClose]] закриває панель.",
					),
					t3(
						"At the bottom of a card: [[tasks.projectArchive]] moves the project to the archive, [[tasks.delete]] deletes it after a confirmation question (the tasks are kept and only lose the link to the project).",
						"Unten an der Karte: [[tasks.projectArchive]] verschiebt das Projekt ins Archiv, [[tasks.delete]] löscht es nach einer Rückfrage (die Aufgaben bleiben erhalten und verlieren nur die Zuordnung).",
						"Унизу картки: [[tasks.projectArchive]] переносить проєкт в архів, [[tasks.delete]] видаляє його після запиту підтвердження (завдання зберігаються й лише втрачають прив’язку).",
					),
					t3(
						"The button [[tasks.projectArchived]] at the left toggles between active and archived projects (a pressed button is green). In the archive the link on a card reads [[tasks.projectUnarchive]] and returns the project to the active list. An empty archive says “[[tasks.projectNoArchived]]”.",
						"Die Schaltfläche [[tasks.projectArchived]] links schaltet zwischen aktiven und archivierten Projekten um (gedrückt ist sie grün). Im Archiv heißt der Link auf einer Karte [[tasks.projectUnarchive]] und bringt das Projekt in die aktive Liste zurück. Ein leeres Archiv sagt „[[tasks.projectNoArchived]]“.",
						"Кнопка [[tasks.projectArchived]] ліворуч перемикає між активними й архівними проєктами (натиснута — зелена). В архіві посилання на картці називається [[tasks.projectUnarchive]] і повертає проєкт до активних. Порожній архів каже «[[tasks.projectNoArchived]]».",
					),
					t3(
						"Note: the progress of a project is counted from the tasks that are linked to it. At the moment the task window has no field for choosing a project, so the progress bar stays empty until tasks are linked by other means.",
						"Hinweis: Der Fortschritt eines Projekts wird aus den Aufgaben berechnet, die ihm zugeordnet sind. Derzeit hat das Aufgabenfenster kein Feld zur Projektauswahl, deshalb bleibt der Fortschrittsbalken leer, bis Aufgaben auf anderem Weg zugeordnet werden.",
						"Примітка: прогрес проєкту рахується із завдань, прив’язаних до нього. Наразі у вікні завдання немає поля вибору проєкту, тож смуга прогресу лишається порожньою, доки завдання не прив’язані іншим способом.",
					),
				],
			},
		],
	},
];
