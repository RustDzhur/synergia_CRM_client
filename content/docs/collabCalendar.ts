import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const COLLAB_CALENDAR: DocSection[] = [
	{
		id: "calendar",
		title: t3("Calendar: events, reminders and Google / iCloud", "Kalender: Termine, Erinnerungen und Google / iCloud", "Календар: події, нагадування та Google / iCloud"),
		intro: t3(
			"[[navigation.calendar]] ([[navigation.collaboration]] → [[navigation.calendar]]) shows a month or a week with your events and with the deadlines of your tasks. There are two calendars: [[collab.myCalendar]] is private, only its author sees the events; [[collab.companyCalendar]] is shared, every member of the company sees the events.",
			"[[navigation.calendar]] ([[navigation.collaboration]] → [[navigation.calendar]]) zeigt einen Monat oder eine Woche mit Ihren Terminen und den Fristen Ihrer Aufgaben. Es gibt zwei Kalender: [[collab.myCalendar]] ist privat, nur der Autor sieht die Termine; [[collab.companyCalendar]] ist gemeinsam, jedes Mitglied der Firma sieht die Termine.",
			"[[navigation.calendar]] ([[navigation.collaboration]] → [[navigation.calendar]]) показує місяць або тиждень із вашими подіями та термінами ваших завдань. Є два календарі: [[collab.myCalendar]] — приватний, події бачить лише автор; [[collab.companyCalendar]] — спільний, події бачить кожен учасник компанії.",
		),
		groups: [
			{
				title: t3("The page: tabs, views and navigation", "Die Seite: Tabs, Ansichten und Navigation", "Сторінка: вкладки, вигляди й навігація"),
				steps: [
					t3(
						"At the top left two tabs switch the calendar: [[collab.myCalendar]] and [[collab.companyCalendar]]. Tasks with a deadline are shown only in [[collab.myCalendar]].",
						"Oben links wechseln zwei Tabs den Kalender: [[collab.myCalendar]] und [[collab.companyCalendar]]. Aufgaben mit Frist werden nur in [[collab.myCalendar]] angezeigt.",
						"Угорі ліворуч дві вкладки перемикають календар: [[collab.myCalendar]] і [[collab.companyCalendar]]. Завдання з терміном показуються лише в [[collab.myCalendar]].",
					),
					t3(
						"The field “[[collab.searchCalendar]]” filters the events and the tasks by title as you type.",
						"Das Feld „[[collab.searchCalendar]]“ filtert Termine und Aufgaben beim Tippen nach dem Titel.",
						"Поле «[[collab.searchCalendar]]» фільтрує події й завдання за назвою під час введення.",
					),
					t3(
						"The list [[collab.month]] / [[collab.week]] chooses the view. In the month view you see the full weeks that cover the month; in the week view seven days around the chosen date, with much more room per day. The week always starts on Monday. Above the grid on a wide screen the current date is written as a heading.",
						"Die Liste [[collab.month]] / [[collab.week]] wählt die Ansicht. In der Monatsansicht sehen Sie die vollen Wochen, die den Monat abdecken; in der Wochenansicht sieben Tage um das gewählte Datum, mit viel mehr Platz pro Tag. Die Woche beginnt immer am Montag. Über dem Raster steht auf einem breiten Bildschirm das aktuelle Datum als Überschrift.",
						"Список [[collab.month]] / [[collab.week]] обирає вигляд. У місячному вигляді видно повні тижні, що покривають місяць; у тижневому — сім днів навколо обраної дати, з набагато більшим місцем на день. Тиждень завжди починається з понеділка. Над сіткою на широкому екрані поточну дату написано заголовком.",
					),
					t3(
						"The arrows [[collab.previous]] and [[collab.next]] move by one month (or by seven days in the week view); the word [[collab.today]] between them jumps back to today. Today is marked with a green frame and, on a wide screen, a green number.",
						"Die Pfeile [[collab.previous]] und [[collab.next]] springen um einen Monat (in der Wochenansicht um sieben Tage); das Wort [[collab.today]] dazwischen springt zurück auf heute. Heute ist mit grünem Rahmen und, auf einem breiten Bildschirm, grüner Zahl markiert.",
						"Стрілки [[collab.previous]] і [[collab.next]] переходять на місяць (у тижневому вигляді — на сім днів); слово [[collab.today]] між ними повертає на сьогодні. Сьогодні позначено зеленою рамкою і, на широкому екрані, зеленим числом.",
					),
					t3(
						"Every event is a coloured bar with the start time and the title. A month cell fits three bars; when there are more, a small “+ number” shows how many are hidden (switch to the week view to see all). Tasks with a deadline are blue bars with the time and the title; a completed task is grey and struck through.",
						"Jeder Termin ist ein farbiger Balken mit Startzeit und Titel. In eine Monatszelle passen drei Balken; sind es mehr, zeigt ein kleines „+ Zahl“, wie viele verborgen sind (wechseln Sie zur Wochenansicht, um alle zu sehen). Aufgaben mit Frist sind blaue Balken mit Uhrzeit und Titel; eine erledigte Aufgabe ist grau und durchgestrichen.",
						"Кожна подія — кольорова смужка з часом початку й назвою. У клітинку місяця вміщаються три смужки; якщо їх більше, маленьке «+ число» показує, скільки сховано (перейдіть до тижневого вигляду, щоб побачити всі). Завдання з терміном — сині смужки з часом і назвою; виконане завдання сіре й закреслене.",
					),
					t3(
						"On a phone the grid shows only coloured dots. A tap on a day selects it, and under the grid you see the date, the button [[collab.addEvent]] and the list of events and tasks of this day (or “[[collab.noEvents]]”). On a tablet and a computer a click on an empty place of a day opens the window of a new event at once, and a click on a bar opens the existing event (or the task).",
						"Auf dem Smartphone zeigt das Raster nur farbige Punkte. Ein Tipp auf einen Tag wählt ihn aus, unter dem Raster sehen Sie das Datum, die Schaltfläche [[collab.addEvent]] und die Liste der Termine und Aufgaben dieses Tages (oder „[[collab.noEvents]]“). Auf Tablet und Computer öffnet ein Klick auf eine freie Stelle eines Tages sofort das Fenster eines neuen Termins, ein Klick auf einen Balken öffnet den vorhandenen Termin (oder die Aufgabe).",
						"На телефоні сітка показує лише кольорові крапки. Дотик до дня обирає його, а під сіткою видно дату, кнопку [[collab.addEvent]] і список подій та завдань цього дня (або «[[collab.noEvents]]»). На планшеті й комп’ютері клік по вільному місцю дня одразу відкриває вікно нової події, а клік по смужці відкриває наявну подію (або завдання).",
					),
				],
			},
			{
				title: t3("Creating and editing an event", "Termin anlegen und bearbeiten", "Створення й редагування події"),
				steps: [
					t3(
						"Click a day (or on a phone the button [[collab.addEvent]]). The window opens with default values: the chosen day, 09:00 – 10:00, the calendar you are currently in, no reminder. To edit an event, click its bar; the same window opens with its data. On a phone the window covers the whole screen.",
						"Klicken Sie auf einen Tag (auf dem Smartphone auf die Schaltfläche [[collab.addEvent]]). Das Fenster öffnet sich mit Vorgaben: der gewählte Tag, 09:00 – 10:00, der Kalender, in dem Sie gerade sind, keine Erinnerung. Zum Bearbeiten klicken Sie auf den Balken des Termins; dasselbe Fenster öffnet sich mit seinen Daten. Auf dem Smartphone füllt das Fenster den ganzen Bildschirm.",
						"Клацніть день (на телефоні — кнопку [[collab.addEvent]]). Вікно відкривається зі значеннями за замовчуванням: обраний день, 09:00 – 10:00, календар, у якому ви зараз, без нагадування. Щоб змінити подію, клацніть її смужку; те саме вікно відкривається з її даними. На телефоні вікно займає весь екран.",
					),
					t3(
						"The first line is the title ([[collab.eventName]], up to 100 characters, required). At its right there is a colour square with an arrow ([[collab.eventColor]]): it opens a palette of six colours (orange, blue, turquoise, red, violet, light blue); a click on a colour applies it and closes the palette. The cross closes the window without saving. Escape closes the palette first and only the second Escape closes the window, so you do not lose the typed event.",
						"Die erste Zeile ist der Titel ([[collab.eventName]], bis 100 Zeichen, Pflicht). Rechts davon sitzt ein Farbquadrat mit Pfeil ([[collab.eventColor]]): Es öffnet eine Palette mit sechs Farben (Orange, Blau, Türkis, Rot, Violett, Hellblau); ein Klick auf eine Farbe übernimmt sie und schließt die Palette. Das Kreuz schließt das Fenster ohne Speichern. Escape schließt zuerst die Palette, erst das zweite Escape das Fenster, damit Sie den eingegebenen Termin nicht verlieren.",
						"Перший рядок — назва ([[collab.eventName]], до 100 символів, обов’язкова). Праворуч від нього квадрат кольору зі стрілкою ([[collab.eventColor]]): він відкриває палітру з шести кольорів (помаранчевий, синій, бірюзовий, червоний, фіолетовий, блакитний); клік по кольору застосовує його й закриває палітру. Хрестик закриває вікно без збереження. Escape спершу закриває палітру, і лише другий Escape — вікно, щоб ви не втратили введену подію.",
					),
					t3(
						"[[collab.eventDescription]] (up to 2000 characters) is a free field for the agenda, participants and links; the field can be stretched in height.",
						"[[collab.eventDescription]] (bis 2000 Zeichen) ist ein freies Feld für Agenda, Teilnehmer und Links; das Feld lässt sich in der Höhe aufziehen.",
						"[[collab.eventDescription]] (до 2000 символів) — вільне поле для порядку денного, учасників і посилань; поле можна розтягнути по висоті.",
					),
					t3(
						"“[[collab.calendarLabel]]:” is a list with [[collab.myCalendar]] and [[collab.companyCalendar]]. It decides who sees the event: only you, or the whole company. You can move an event from one calendar to the other later by editing it.",
						"„[[collab.calendarLabel]]:“ ist eine Liste mit [[collab.myCalendar]] und [[collab.companyCalendar]]. Sie entscheidet, wer den Termin sieht: nur Sie oder die ganze Firma. Sie können einen Termin später durch Bearbeiten von einem Kalender in den anderen verschieben.",
						"«[[collab.calendarLabel]]:» — список із [[collab.myCalendar]] та [[collab.companyCalendar]]. Він визначає, хто бачить подію: лише ви чи вся компанія. Пізніше подію можна перенести з одного календаря в інший, відредагувавши її.",
					),
					t3(
						"The row of four fields sets the time: the start date ([[collab.startDate]]), the start time ([[collab.startTime]]), the end time ([[collab.endTime]]) and the end date ([[collab.endDate]]). A click on a field opens the picker of the browser. If the end is earlier than the start, the save is refused with the message “[[collab.eventEndBefore]]”. An event may last several days.",
						"Die Reihe aus vier Feldern legt die Zeit fest: Startdatum ([[collab.startDate]]), Startzeit ([[collab.startTime]]), Endzeit ([[collab.endTime]]) und Enddatum ([[collab.endDate]]). Ein Klick auf ein Feld öffnet die Auswahl des Browsers. Liegt das Ende vor dem Start, wird das Speichern mit der Meldung „[[collab.eventEndBefore]]“ abgelehnt. Ein Termin darf mehrere Tage dauern.",
						"Рядок із чотирьох полів задає час: дата початку ([[collab.startDate]]), час початку ([[collab.startTime]]), час завершення ([[collab.endTime]]) і дата завершення ([[collab.endDate]]). Клік по полю відкриває вибір браузера. Якщо кінець раніше за початок, збереження відхиляється з повідомленням «[[collab.eventEndBefore]]». Подія може тривати кілька днів.",
					),
					t3(
						"[[collab.attendees]] is a free text line (up to 200 characters, the grey hint says “[[collab.change]]”): write the names of the participants as you like. This is only a note; nobody gets an invitation from it. The link [[collab.openChat]] at the right leads to [[navigation.chat_and_calls]].",
						"[[collab.attendees]] ist eine freie Textzeile (bis 200 Zeichen, der graue Hinweis lautet „[[collab.change]]“): Schreiben Sie die Namen der Teilnehmer, wie Sie möchten. Das ist nur eine Notiz; niemand erhält daraus eine Einladung. Der Link [[collab.openChat]] rechts führt zu [[navigation.chat_and_calls]].",
						"[[collab.attendees]] — вільний текстовий рядок (до 200 символів, сіра підказка «[[collab.change]]»): напишіть імена учасників як завгодно. Це лише нотатка; жодного запрошення з неї ніхто не отримує. Посилання [[collab.openChat]] праворуч веде до [[navigation.chat_and_calls]].",
					),
					t3(
						"[[collab.location]] is another free line (up to 200 characters; the hint says “[[collab.add]]”).",
						"[[collab.location]] ist eine weitere freie Zeile (bis 200 Zeichen; der Hinweis lautet „[[collab.add]]“).",
						"[[collab.location]] — ще один вільний рядок (до 200 символів; підказка «[[collab.add]]»).",
					),
					t3(
						"[[collab.reminder]]: the word [[collab.add]] is a list with four choices — 5, 15, 30 or 60 minutes before the start. The chosen value is shown in green with a small cross ([[collab.removeReminder]]) that removes it. There can be one reminder per event.",
						"[[collab.reminder]]: Das Wort [[collab.add]] ist eine Liste mit vier Optionen — 5, 15, 30 oder 60 Minuten vor dem Start. Der gewählte Wert steht grün mit einem kleinen Kreuz ([[collab.removeReminder]]), das ihn entfernt. Pro Termin gibt es eine Erinnerung.",
						"[[collab.reminder]]: слово [[collab.add]] — список із чотирма варіантами: за 5, 15, 30 або 60 хвилин до початку. Обране значення показано зеленим із маленьким хрестиком ([[collab.removeReminder]]), що його прибирає. На подію є одне нагадування.",
					),
					t3(
						"At the bottom: [[collab.cancel]] closes without saving, [[collab.create]] (for a new event) or [[collab.save]] (for an existing one) saves it. An empty title gives “[[collab.eventNameRequired]]”. After success the message “[[collab.eventSaved]]” appears and the window closes; if the server fails, the window stays open with what you typed so that you can try again.",
						"Unten: [[collab.cancel]] schließt ohne Speichern, [[collab.create]] (bei einem neuen Termin) oder [[collab.save]] (bei einem vorhandenen) speichert. Ein leerer Titel ergibt „[[collab.eventNameRequired]]“. Bei Erfolg erscheint die Meldung „[[collab.eventSaved]]“ und das Fenster schließt sich; scheitert der Server, bleibt das Fenster mit Ihren Eingaben offen, damit Sie es erneut versuchen können.",
						"Унизу: [[collab.cancel]] закриває без збереження, [[collab.create]] (для нової події) або [[collab.save]] (для наявної) зберігає. Порожня назва дає «[[collab.eventNameRequired]]». Після успіху з’являється повідомлення «[[collab.eventSaved]]» і вікно закривається; якщо сервер збоїть, вікно лишається відкритим із введеним, щоб можна було повторити.",
					),
					t3(
						"When you edit an existing event, a red word [[collab.deleteEvent]] appears at the left of the bottom row (on a phone — below the buttons). It deletes the event at once, without a further question, and shows “[[collab.eventDeleted]]”.",
						"Beim Bearbeiten eines vorhandenen Termins erscheint links in der unteren Reihe das rote Wort [[collab.deleteEvent]] (auf dem Smartphone unter den Schaltflächen). Es löscht den Termin sofort, ohne weitere Rückfrage, und zeigt „[[collab.eventDeleted]]“.",
						"Під час редагування наявної події зліва в нижньому рядку з’являється червоне слово [[collab.deleteEvent]] (на телефоні — під кнопками). Воно одразу, без додаткового запитання, видаляє подію й показує «[[collab.eventDeleted]]».",
					),
					t3(
						"If Google Calendar is connected (see below) and the event is in [[collab.companyCalendar]], it is also written to Google. If that fails, the event stays saved in the CRM, and a red message names the reason (the event is saved but not transferred) for 7 seconds; the same holds for deleting (the event is deleted, but not in the external calendar).",
						"Ist Google Kalender verbunden (siehe unten) und liegt der Termin im [[collab.companyCalendar]], wird er auch nach Google geschrieben. Scheitert das, bleibt der Termin im CRM gespeichert, und eine rote Meldung nennt 7 Sekunden lang den Grund (Termin gespeichert, aber nicht übertragen); dasselbe gilt beim Löschen (Termin gelöscht, aber nicht im externen Kalender).",
						"Якщо підключено Google Calendar (див. нижче), а подія в [[collab.companyCalendar]], її також записують у Google. Якщо не вдалося, подія лишається збереженою в CRM, а червоне повідомлення 7 секунд називає причину (подію збережено, але не передано); те саме під час видалення (подію видалено, але не у зовнішньому календарі).",
					),
				],
			},
			{
				title: t3("Reminders", "Erinnerungen", "Нагадування"),
				steps: [
					t3(
						"When the reminder time comes, a notification of the type “event” is created (the bell in the header): for an event of [[collab.myCalendar]] only for its author, for [[collab.companyCalendar]] for all members. The link of the notification leads to the calendar. A reminder is created exactly once per event and value.",
						"Erreicht die Erinnerungszeit, wird eine Benachrichtigung der Art „Termin“ erzeugt (die Glocke im Kopf): bei einem Termin des [[collab.myCalendar]] nur für den Autor, beim [[collab.companyCalendar]] für alle Mitglieder. Der Link der Benachrichtigung führt zum Kalender. Eine Erinnerung wird pro Termin und Wert genau einmal erzeugt.",
						"Коли настає час нагадування, створюється сповіщення типу «подія» (дзвіночок у шапці): для події [[collab.myCalendar]] лише для автора, для [[collab.companyCalendar]] — для всіх учасників. Посилання сповіщення веде до календаря. Нагадування створюється рівно один раз на подію й значення.",
					),
					t3(
						"The same reminder goes by e-mail to those people who switched on e-mail notifications in their profile, if a mailbox of the company is connected in [[navigation.web_mails]]. The e-mail text is in German.",
						"Dieselbe Erinnerung geht per E-Mail an die Personen, die in ihrem Profil E-Mail-Benachrichtigungen eingeschaltet haben, sofern in [[navigation.web_mails]] ein Postfach der Firma verbunden ist. Der Text der E-Mail ist auf Deutsch.",
						"Те саме нагадування йде електронною поштою тим людям, які ввімкнули e-mail-сповіщення в профілі, якщо в [[navigation.web_mails]] підключено поштову скриньку компанії. Текст листа німецькою.",
					),
					t3(
						"Important: the reminder is checked every 30 seconds while somebody from your company keeps the CRM open in a browser, and once a day by the server. If the CRM is closed for everybody, a reminder that should come in the minutes before the event may come late; a delayed reminder is still delivered while the event is running (and for one more hour after it), but not later.",
						"Wichtig: Die Erinnerung wird alle 30 Sekunden geprüft, solange jemand aus Ihrer Firma das CRM im Browser geöffnet hat, und einmal täglich vom Server. Ist das CRM bei allen geschlossen, kann eine Erinnerung, die in den Minuten vor dem Termin kommen soll, verspätet eintreffen; eine verspätete Erinnerung wird noch zugestellt, solange der Termin läuft (und eine weitere Stunde danach), aber nicht später.",
						"Важливо: нагадування перевіряють кожні 30 секунд, поки хтось із вашої компанії тримає CRM відкритою в браузері, і раз на добу — сервер. Якщо CRM закрита в усіх, нагадування, яке мало прийти за хвилини до події, може спізнитися; запізнене нагадування ще доставляється, поки подія триває (і ще годину після неї), але не пізніше.",
					),
				],
			},
			{
				title: t3("Tasks in the calendar", "Aufgaben im Kalender", "Завдання в календарі"),
				steps: [
					t3(
						"In [[collab.myCalendar]] every task of [[navigation.tasks_projects]] that has a deadline is drawn on the day of the deadline as a blue bar with the time of the deadline. A click opens the preview window of the task.",
						"Im [[collab.myCalendar]] wird jede Aufgabe aus [[navigation.tasks_projects]] mit Frist am Tag der Frist als blauer Balken mit der Uhrzeit der Frist gezeichnet. Ein Klick öffnet das Vorschaufenster der Aufgabe.",
						"У [[collab.myCalendar]] кожне завдання з [[navigation.tasks_projects]], що має термін, малюється в день терміну синьою смужкою з часом терміну. Клік відкриває вікно перегляду завдання.",
					),
					t3(
						"The window shows the title, the line “Task #N – status” (N is the position in the list) with the status — [[collab.statusInProgress]] (green), [[collab.statusOverdue]] (red) or [[collab.statusCompleted]] (green) —, the description (or the title if there is no description) and, if set, “[[collab.responsible]]” with the person. The number is the position of the task in the list. The star at the right of the description ([[collab.pin]]) marks the task as important for you: it turns orange; a second click removes it.",
						"Das Fenster zeigt den Titel, die Zeile „Aufgabe #N – Status“ (N ist die Position in der Liste) mit dem Status — [[collab.statusInProgress]] (grün), [[collab.statusOverdue]] (rot) oder [[collab.statusCompleted]] (grün) —, die Beschreibung (oder den Titel, falls keine Beschreibung da ist) und, falls gesetzt, „[[collab.responsible]]“ mit der Person. Die Nummer ist die Position der Aufgabe in der Liste. Der Stern rechts neben der Beschreibung ([[collab.pin]]) markiert die Aufgabe als wichtig für Sie: Er wird orange; ein zweiter Klick nimmt ihn zurück.",
						"Вікно показує назву, рядок «Завдання №N – статус» (N — позиція у списку) зі статусом — [[collab.statusInProgress]] (зелений), [[collab.statusOverdue]] (червоний) або [[collab.statusCompleted]] (зелений), — опис (або назву, якщо опису немає) і, якщо задано, «[[collab.responsible]]» з людиною. Номер — позиція завдання у списку. Зірка праворуч від опису ([[collab.pin]]) позначає завдання як важливе для вас: вона стає помаранчевою; другий клік знімає позначку.",
					),
					t3(
						"The button [[collab.edit]] leads to the page [[navigation.tasks_projects]] (it opens the task list, not the task itself). The button [[collab.finish]] (hidden for a completed task) marks the task as completed, shows “[[collab.taskFinished]]” and closes the window; on an error a red message appears and the window stays open.",
						"Die Schaltfläche [[collab.edit]] führt zur Seite [[navigation.tasks_projects]] (sie öffnet die Aufgabenliste, nicht die Aufgabe selbst). Die Schaltfläche [[collab.finish]] (bei einer erledigten Aufgabe ausgeblendet) markiert die Aufgabe als erledigt, zeigt „[[collab.taskFinished]]“ und schließt das Fenster; bei einem Fehler erscheint eine rote Meldung und das Fenster bleibt offen.",
						"Кнопка [[collab.edit]] веде на сторінку [[navigation.tasks_projects]] (відкриває список завдань, а не саме завдання). Кнопка [[collab.finish]] (приховано для виконаного завдання) позначає завдання виконаним, показує «[[collab.taskFinished]]» і закриває вікно; за помилки з’являється червоне повідомлення, а вікно лишається відкритим.",
					),
				],
			},
			{
				title: t3("Google Calendar and iCloud", "Google Kalender und iCloud", "Google Calendar та iCloud"),
				steps: [
					t3(
						"The button [[collab.calButton]] at the top right (its outline is green as soon as at least one external calendar is connected) opens the window “[[collab.calTitle]]”. The text at its top explains the rules: events from Google appear in the Firmspace calendar; events of the company calendar are written to Google and deleted there as well; private events (“My calendar”) stay in Firmspace; iCloud is read-only.",
						"Die Schaltfläche [[collab.calButton]] oben rechts (ihr Rahmen ist grün, sobald mindestens ein externer Kalender verbunden ist) öffnet das Fenster „[[collab.calTitle]]“. Der Text oben erklärt die Regeln: Termine aus Google erscheinen im Firmspace-Kalender; Termine des Firmenkalenders werden nach Google geschrieben und dort auch gelöscht; private Termine („Mein Kalender“) bleiben in Firmspace; iCloud wird nur gelesen.",
						"Кнопка [[collab.calButton]] угорі праворуч (її обведення зелене, щойно підключено хоча б один зовнішній календар) відкриває вікно «[[collab.calTitle]]». Текст угорі пояснює правила: події з Google з’являються в календарі Firmspace; події календаря компанії записуються в Google і там же видаляються; особисті події («Мій календар») лишаються у Firmspace; iCloud — лише читання.",
					),
					t3(
						"Google Calendar, not connected: the button [[collab.calConnect]]. It is inactive if Google sign-in keys are missing on the server. A click takes you to the consent page of Google in the same tab; after the consent Google brings you back to the calendar with the message “[[collab.calConnected]]”; if you decline, the window shows “[[collab.calDenied]]”.",
						"Google Kalender, nicht verbunden: die Schaltfläche [[collab.calConnect]]. Sie ist inaktiv, wenn auf dem Server die Google-Anmeldeschlüssel fehlen. Ein Klick führt Sie im selben Tab zur Zustimmungsseite von Google; nach der Zustimmung bringt Google Sie mit der Meldung „[[collab.calConnected]]“ zurück in den Kalender; lehnen Sie ab, zeigt das Fenster „[[collab.calDenied]]“.",
						"Google Calendar, не підключено: кнопка [[collab.calConnect]]. Вона неактивна, якщо на сервері немає ключів входу через Google. Клік веде на сторінку згоди Google у тій самій вкладці; після згоди Google повертає вас у календар із повідомленням «[[collab.calConnected]]»; якщо ви відмовили, вікно показує «[[collab.calDenied]]».",
					),
					t3(
						"Google Calendar, connected: at the right of the title a green chip with your Google e-mail. Under it the list of your Google calendars with checkboxes — only ticked calendars are imported. If the list is empty, the link [[collab.calLoadList]] loads it. The list [[collab.calTarget]] chooses into which Google calendar events created in the CRM are written; the first choice is [[collab.calTargetPrimary]].",
						"Google Kalender, verbunden: rechts vom Titel ein grüner Chip mit Ihrer Google-E-Mail. Darunter die Liste Ihrer Google-Kalender mit Kontrollkästchen — nur angehakte Kalender werden importiert. Ist die Liste leer, lädt der Link [[collab.calLoadList]] sie. Die Liste [[collab.calTarget]] wählt, in welchen Google-Kalender im CRM angelegte Termine geschrieben werden; die erste Auswahl ist [[collab.calTargetPrimary]].",
						"Google Calendar, підключено: праворуч від заголовка зелений чип з вашою Google-поштою. Під ним список ваших календарів Google з прапорцями — імпортуються лише позначені календарі. Якщо список порожній, посилання [[collab.calLoadList]] його завантажує. Список [[collab.calTarget]] обирає, у який календар Google записуються події, створені в CRM; перший варіант — [[collab.calTargetPrimary]].",
					),
					t3(
						"An old connection that was given only read rights shows the orange note “[[collab.calReadOnly]]” with the link [[collab.calReconnect]]: click it and give the consent again, otherwise events from the CRM will not reach Google.",
						"Eine alte Verbindung, die nur Leserechte erhalten hat, zeigt den orangen Hinweis „[[collab.calReadOnly]]“ mit dem Link [[collab.calReconnect]]: Klicken Sie darauf und erteilen Sie die Zustimmung erneut, sonst gelangen Termine aus dem CRM nicht nach Google.",
						"Старе підключення, якому дали лише права читання, показує помаранчеву примітку «[[collab.calReadOnly]]» з посиланням [[collab.calReconnect]]: клацніть його й дайте згоду знову, інакше події з CRM не потраплять у Google.",
					),
					t3(
						"The button [[collab.calSyncNow]] fetches the events at once (the message “[[collab.calSynced]]”, the arrows turn meanwhile). Otherwise the exchange runs by itself, at most every 15 minutes, while somebody uses the CRM and by the schedule of the server. Only the window from one month back to six months ahead is exchanged. The grey link [[collab.calDisconnect]] disconnects the calendar. An error of the connection is shown under the title in orange.",
						"Die Schaltfläche [[collab.calSyncNow]] holt die Termine sofort ab (die Meldung „[[collab.calSynced]]“, die Pfeile drehen sich währenddessen). Sonst läuft der Austausch von selbst, höchstens alle 15 Minuten, solange jemand das CRM nutzt, sowie nach dem Zeitplan des Servers. Ausgetauscht wird nur das Fenster von einem Monat zurück bis sechs Monate voraus. Der graue Link [[collab.calDisconnect]] trennt den Kalender. Ein Verbindungsfehler wird unter dem Titel orange angezeigt.",
						"Кнопка [[collab.calSyncNow]] одразу забирає події (повідомлення «[[collab.calSynced]]», стрілки тим часом крутяться). Інакше обмін іде сам, не частіше ніж раз на 15 хвилин, поки хтось користується CRM, і за розкладом сервера. Обмінюється лише вікно від одного місяця назад до шести місяців уперед. Сіре посилання [[collab.calDisconnect]] відключає календар. Помилку підключення показано під заголовком помаранчевим.",
					),
					t3(
						"iCloud: Apple does not offer a sign-in dialog for calendars, so the block shows the hint “[[collab.calAppleHint]]” and two fields, [[collab.calAppleId]] and [[collab.calApplePass]] (both required). Create an app-specific password at appleid.apple.com, enter it and click [[collab.calConnect]] (while it works, “[[collab.calConnecting]]”). After success the message “[[collab.calConnected]]” appears, the password is cleared, and you see the list of iCloud calendars with checkboxes, the buttons [[collab.calSyncNow]] and [[collab.calDisconnect]]. iCloud events only come into the CRM (into the company calendar); nothing is written back to iCloud.",
						"iCloud: Apple bietet für Kalender keinen Anmeldedialog, darum zeigt der Block den Hinweis „[[collab.calAppleHint]]“ und zwei Felder, [[collab.calAppleId]] und [[collab.calApplePass]] (beide Pflicht). Erstellen Sie ein app-spezifisches Passwort auf appleid.apple.com, geben Sie es ein und klicken Sie auf [[collab.calConnect]] (während es arbeitet, „[[collab.calConnecting]]“). Bei Erfolg erscheint die Meldung „[[collab.calConnected]]“, das Passwort wird gelöscht, und Sie sehen die Liste der iCloud-Kalender mit Kontrollkästchen, die Schaltflächen [[collab.calSyncNow]] und [[collab.calDisconnect]]. iCloud-Termine kommen nur ins CRM (in den Firmenkalender); nichts wird nach iCloud zurückgeschrieben.",
						"iCloud: Apple не пропонує діалогу входу для календарів, тому блок показує підказку «[[collab.calAppleHint]]» і два поля, [[collab.calAppleId]] та [[collab.calApplePass]] (обидва обов’язкові). Створіть пароль застосунку на appleid.apple.com, введіть його й клацніть [[collab.calConnect]] (поки працює — «[[collab.calConnecting]]»). Після успіху з’являється повідомлення «[[collab.calConnected]]», пароль очищується, і ви бачите список календарів iCloud з прапорцями, кнопки [[collab.calSyncNow]] і [[collab.calDisconnect]]. Події iCloud лише надходять у CRM (у календар компанії); назад в iCloud нічого не записується.",
					),
				],
			},
		],
	},
];
