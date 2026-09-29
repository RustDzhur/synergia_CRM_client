import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const COLLAB_FEED: DocSection[] = [
	{
		id: "feed",
		title: t3("Feed: posts, news and task cards of the team", "Feed: Beiträge, News und Aufgabenkarten des Teams", "Стрічка: дописи, новини й картки завдань команди"),
		intro: t3(
			"The feed ([[navigation.collaboration]] → [[collab.feedTitle]]) is the shared wall of your company. Colleagues write short posts, publish news and see the cards of tasks that somebody created in [[navigation.tasks_projects]]. The page asks the server for news every 20 seconds, so posts of colleagues appear without reloading. The feed shows the 100 latest entries.",
			"Der Feed ([[navigation.collaboration]] → [[collab.feedTitle]]) ist die gemeinsame Pinnwand Ihrer Firma. Kollegen schreiben kurze Beiträge, veröffentlichen News und sehen die Karten von Aufgaben, die jemand in [[navigation.tasks_projects]] angelegt hat. Die Seite fragt den Server alle 20 Sekunden nach Neuem, Beiträge von Kollegen erscheinen also ohne Neuladen. Der Feed zeigt die 100 neuesten Einträge.",
			"Стрічка ([[navigation.collaboration]] → [[collab.feedTitle]]) — спільна стіна вашої компанії. Колеги пишуть короткі дописи, публікують новини й бачать картки завдань, які хтось створив у [[navigation.tasks_projects]]. Сторінка опитує сервер кожні 20 секунд, тож дописи колег з’являються без перезавантаження. У стрічці показано 100 останніх записів.",
		),
		groups: [
			{
				title: t3("Writing and publishing a post", "Beitrag schreiben und veröffentlichen", "Написання й публікація допису"),
				steps: [
					t3(
						"Click into the large text field “[[collab.feedPostPlaceholder]]” and type your text. A post can have up to 2000 characters; line breaks are kept. The button [[collab.feedPublish]] stays grey while the field is empty (spaces alone do not count).",
						"Klicken Sie in das große Textfeld „[[collab.feedPostPlaceholder]]“ und tippen Sie Ihren Text. Ein Beitrag darf bis zu 2000 Zeichen haben; Zeilenumbrüche bleiben erhalten. Die Schaltfläche [[collab.feedPublish]] bleibt grau, solange das Feld leer ist (Leerzeichen allein zählen nicht).",
						"Клацніть у велике текстове поле «[[collab.feedPostPlaceholder]]» і введіть текст. Допис може мати до 2000 символів; переноси рядків зберігаються. Кнопка [[collab.feedPublish]] сіра, доки поле порожнє (самі пробіли не рахуються).",
					),
					t3(
						"The date field next to the text (calendar icon, hint “[[collab.dueDate]]”) is optional. Choose a date and time if the post is about something with a deadline. The date is shown as a small chip under the post text, and if you later turn the post into a task it becomes the task deadline.",
						"Das Datumsfeld neben dem Text (Kalendersymbol, Hinweis „[[collab.dueDate]]“) ist optional. Wählen Sie Datum und Uhrzeit, wenn der Beitrag etwas mit Frist betrifft. Das Datum steht als kleiner Chip unter dem Beitragstext; machen Sie den Beitrag später zur Aufgabe, wird es zur Aufgabenfrist.",
						"Поле дати поруч із текстом (значок календаря, підказка «[[collab.dueDate]]») необов’язкове. Оберіть дату й час, якщо допис стосується чогось із терміном. Дата показується маленьким чипом під текстом допису, а якщо ви потім зробите допис завданням, вона стане терміном завдання.",
					),
					t3(
						"The button [[collab.pickRecipients]] chooses who gets the post. By default it goes to everyone in the team. Click it to open a list: the first line [[collab.everyone]] resets the choice; below it every colleague has a checkbox. The list is loaded when you open it for the first time and contains the company members with a login and the employees of the directory [[navigation.company]] (the latter are marked “[[collab.employeeNoAccount]]”; they can be named as recipients, but without a login they cannot get a notification). If nobody is there, the list says “[[collab.noColleagues]]”. After you tick people, the button shows “[[collab.toWhom]]” and their number, and a second button [[collab.everyone]] with a cross appears next to it, which clears the choice.",
						"Die Schaltfläche [[collab.pickRecipients]] bestimmt, wer den Beitrag erhält. Standardmäßig geht er an alle im Team. Klicken Sie darauf, öffnet sich eine Liste: Die erste Zeile [[collab.everyone]] setzt die Auswahl zurück; darunter hat jeder Kollege ein Kontrollkästchen. Die Liste wird beim ersten Öffnen geladen und enthält die Firmenmitglieder mit Login sowie die Mitarbeiter des Verzeichnisses [[navigation.company]] (diese sind mit „[[collab.employeeNoAccount]]“ markiert; sie lassen sich als Empfänger nennen, ohne Login kann ihnen aber keine Benachrichtigung zugestellt werden). Ist niemand da, steht dort „[[collab.noColleagues]]“. Nach dem Ankreuzen zeigt die Schaltfläche „[[collab.toWhom]]“ und die Anzahl, daneben erscheint eine zweite Schaltfläche [[collab.everyone]] mit Kreuz, die die Auswahl löscht.",
						"Кнопка [[collab.pickRecipients]] обирає, хто отримає допис. За замовчуванням — усі в команді. Клацніть, щоб відкрити список: перший рядок [[collab.everyone]] скидає вибір; нижче в кожного колеги є прапорець. Список завантажується під час першого відкриття й містить учасників компанії з логіном та співробітників довідника [[navigation.company]] (їх позначено «[[collab.employeeNoAccount]]»; їх можна вказати адресатами, але без логіна сповіщення їм прийти не може). Якщо нікого немає, у списку «[[collab.noColleagues]]». Після вибору людей кнопка показує «[[collab.toWhom]]» і їхню кількість, а поруч з’являється друга кнопка [[collab.everyone]] з хрестиком, яка очищує вибір.",
					),
					t3(
						"The smiley button [[collab.emoji]] opens a picker with three tabs — [[collab.emoji_smileys]], [[collab.emoji_work]] and [[collab.emoji_marks]]. A click on a symbol inserts it at the place of the text cursor (not at the end), so you can put an emoji in the middle of a sentence.",
						"Die Smiley-Schaltfläche [[collab.emoji]] öffnet eine Auswahl mit drei Tabs — [[collab.emoji_smileys]], [[collab.emoji_work]] und [[collab.emoji_marks]]. Ein Klick auf ein Symbol fügt es an der Position des Textcursors ein (nicht am Ende), Sie können ein Emoji also mitten in einen Satz setzen.",
						"Кнопка зі смайликом [[collab.emoji]] відкриває вибір із трьома вкладками — [[collab.emoji_smileys]], [[collab.emoji_work]] і [[collab.emoji_marks]]. Клік по символу вставляє його там, де стоїть курсор (а не в кінець), тож смайлик можна поставити всередині речення.",
					),
					t3(
						"The toggle [[collab.news]] marks the post as news. When it is on, the button is highlighted green. A news post is shown in the feed with the label “[[collab.news]]” and can be found with the filter of the same name.",
						"Der Schalter [[collab.news]] markiert den Beitrag als News. Ist er an, leuchtet die Schaltfläche grün. Ein News-Beitrag wird im Feed mit der Kennzeichnung „[[collab.news]]“ angezeigt und lässt sich mit dem gleichnamigen Filter finden.",
						"Перемикач [[collab.news]] позначає допис як новину. Коли він увімкнений, кнопка підсвічена зеленим. Новина показується в стрічці з міткою «[[collab.news]]» і знаходиться однойменним фільтром.",
					),
					t3(
						"Click [[collab.feedPublish]]. The post appears at the top of the feed, the field is emptied, and the date, the recipients and the news switch are reset. If the server refuses (for example, because of the plan or an error), a red message appears and the text stays in the field. All colleagues (or only the chosen recipients) get a notification “team”, except you.",
						"Klicken Sie auf [[collab.feedPublish]]. Der Beitrag erscheint oben im Feed, das Feld wird geleert, Datum, Empfänger und der News-Schalter werden zurückgesetzt. Lehnt der Server ab (z. B. wegen des Tarifs oder eines Fehlers), erscheint eine rote Meldung und der Text bleibt im Feld. Alle Kollegen (oder nur die gewählten Empfänger) erhalten außer Ihnen eine „Team“-Benachrichtigung.",
						"Натисніть [[collab.feedPublish]]. Допис з’являється вгорі стрічки, поле очищується, а дата, адресати й перемикач новини скидаються. Якщо сервер відхиляє (наприклад, через тариф чи помилку), з’являється червоне повідомлення, а текст лишається в полі. Усі колеги (або лише обрані адресати), крім вас, отримують сповіщення типу «команда».",
					),
				],
			},
			{
				title: t3("Search and filters of the feed", "Suche und Filter des Feeds", "Пошук і фільтри стрічки"),
				steps: [
					t3(
						"The field “[[collab.filterSearch]]” at the top right filters the posts as you type. It looks in the author name, the post text, the task title, the responsible person, the names of the recipients and in all comments of the post.",
						"Das Feld „[[collab.filterSearch]]“ oben rechts filtert die Beiträge beim Tippen. Es durchsucht den Autorennamen, den Beitragstext, den Aufgabentitel, den Verantwortlichen, die Namen der Empfänger und alle Kommentare des Beitrags.",
						"Поле «[[collab.filterSearch]]» угорі праворуч фільтрує дописи під час введення. Воно шукає в імені автора, тексті допису, назві завдання, відповідальному, іменах адресатів і в усіх коментарях допису.",
					),
					t3(
						"Under the composer there are three chips: [[collab.all]], [[collab.news]] and [[collab.task]]. The active chip is highlighted. [[collab.news]] shows only news, [[collab.task]] only task cards, [[collab.all]] everything. Search and chip work together.",
						"Unter dem Eingabefeld gibt es drei Chips: [[collab.all]], [[collab.news]] und [[collab.task]]. Der aktive Chip ist hervorgehoben. [[collab.news]] zeigt nur News, [[collab.task]] nur Aufgabenkarten, [[collab.all]] alles. Suche und Chip wirken zusammen.",
						"Під полем введення три чипи: [[collab.all]], [[collab.news]] і [[collab.task]]. Активний чип підсвічено. [[collab.news]] показує лише новини, [[collab.task]] — лише картки завдань, [[collab.all]] — усе. Пошук і чип працюють разом.",
					),
					t3(
						"Pinned posts are always at the top, then the other posts in the order of publishing (newest first). If nothing matches, the feed shows “[[collab.feedEmpty]]”.",
						"Angeheftete Beiträge stehen immer oben, danach die übrigen in der Reihenfolge der Veröffentlichung (neueste zuerst). Passt nichts, zeigt der Feed „[[collab.feedEmpty]]“.",
						"Закріплені дописи завжди вгорі, далі решта в порядку публікації (найновіші першими). Якщо нічого не підходить, стрічка показує «[[collab.feedEmpty]]».",
					),
				],
			},
			{
				title: t3("A post and what you can do with it", "Ein Beitrag und was Sie damit tun können", "Допис і що з ним можна робити"),
				steps: [
					t3(
						"The head of a post shows the avatar, the author and the date. A post of the kind “task” is a card created automatically when somebody creates a task in [[navigation.tasks_projects]]: it shows the chip “[[collab.task]]”, the title after “[[collab.taskLabel]]” and the line “[[collab.responsible]]” with the responsible person.",
						"Der Kopf eines Beitrags zeigt Avatar, Autor und Datum. Ein Beitrag der Art „Aufgabe“ ist eine Karte, die automatisch entsteht, wenn jemand in [[navigation.tasks_projects]] eine Aufgabe anlegt: Sie zeigt den Chip „[[collab.task]]“, den Titel nach „[[collab.taskLabel]]“ und die Zeile „[[collab.responsible]]“ mit dem Verantwortlichen.",
						"У шапці допису — аватар, автор і дата. Допис типу «завдання» — це картка, що створюється автоматично, коли хтось створює завдання в [[navigation.tasks_projects]]: на ній чип «[[collab.task]]», назва після «[[collab.taskLabel]]» і рядок «[[collab.responsible]]» з відповідальним.",
					),
					t3(
						"The pin icon at the top right of a post pins the post to the top of the feed for everybody; the icon turns green and tilts. A second click unpins it. Any member may pin or unpin.",
						"Das Pin-Symbol oben rechts an einem Beitrag heftet ihn für alle oben im Feed an; das Symbol wird grün und kippt. Ein zweiter Klick löst ihn wieder. Jedes Mitglied darf anheften oder lösen.",
						"Значок кнопки-шпильки вгорі праворуч у дописі закріплює його вгорі стрічки для всіх; значок стає зеленим і нахиляється. Другий клік відкріплює. Закріплювати й відкріплювати може будь-який учасник.",
					),
					t3(
						"The three-dot button ([[collab.more]]) opens a small menu with one item, [[collab.deletePost]] (red). The post is removed from the list at once. Only the author of the post, the owner and administrators can delete; for anybody else the server refuses and the post comes back.",
						"Die Drei-Punkte-Schaltfläche ([[collab.more]]) öffnet ein kleines Menü mit einem Eintrag, [[collab.deletePost]] (rot). Der Beitrag verschwindet sofort aus der Liste. Löschen dürfen nur der Autor, der Inhaber und Administratoren; für alle anderen lehnt der Server ab und der Beitrag kehrt zurück.",
						"Кнопка з трьома крапками ([[collab.more]]) відкриває маленьке меню з одним пунктом [[collab.deletePost]] (червоний). Допис одразу зникає зі списку. Видаляти можуть лише автор допису, власник і адміністратори; для інших сервер відмовить, і допис повернеться.",
					),
					t3(
						"Under the text there is a row of actions. The grey label at the left is the kind of the post ([[collab.kindPost]], [[collab.news]] or [[collab.task]]). Then: [[collab.comment]] puts the cursor into the comment field of this post; [[collab.follow]] subscribes you to the post (the button is green and reads [[collab.unfollow]] while you follow it); [[collab.more]] opens the same menu as the three dots.",
						"Unter dem Text steht eine Reihe von Aktionen. Die graue Angabe links ist die Art des Beitrags ([[collab.kindPost]], [[collab.news]] oder [[collab.task]]). Dann: [[collab.comment]] setzt den Cursor in das Kommentarfeld dieses Beitrags; [[collab.follow]] abonniert den Beitrag (die Schaltfläche ist grün und heißt [[collab.unfollow]], solange Sie ihm folgen); [[collab.more]] öffnet dasselbe Menü wie die drei Punkte.",
						"Під текстом рядок дій. Сіра мітка ліворуч — вид допису ([[collab.kindPost]], [[collab.news]] або [[collab.task]]). Далі: [[collab.comment]] ставить курсор у поле коментаря цього допису; [[collab.follow]] підписує вас на допис (кнопка зелена й називається [[collab.unfollow]], доки ви стежите); [[collab.more]] відкриває те саме меню, що й три крапки.",
					),
					t3(
						"[[collab.toTask]] appears on posts that are not task cards. It creates a real task in [[navigation.tasks_projects]]: the title is the first line of the post (up to 200 characters), the description is the whole text, the deadline is the date of the post. On success the message “[[collab.taskCreated]]” appears and the card of the new task shows up in the feed. The original post stays.",
						"[[collab.toTask]] erscheint bei Beiträgen, die keine Aufgabenkarten sind. Es legt eine echte Aufgabe in [[navigation.tasks_projects]] an: Der Titel ist die erste Zeile des Beitrags (bis 200 Zeichen), die Beschreibung der ganze Text, die Frist das Datum des Beitrags. Bei Erfolg erscheint die Meldung „[[collab.taskCreated]]“ und die Karte der neuen Aufgabe im Feed. Der ursprüngliche Beitrag bleibt.",
						"[[collab.toTask]] є на дописах, які не є картками завдань. Воно створює справжнє завдання в [[navigation.tasks_projects]]: назва — перший рядок допису (до 200 символів), опис — увесь текст, термін — дата допису. Після успіху з’являється повідомлення «[[collab.taskCreated]]» і в стрічці — картка нового завдання. Початковий допис лишається.",
					),
					t3(
						"[[collab.toNews]] appears on posts that are not news. It changes the kind of the post to news and shows “[[collab.newsPublished]]”. This is allowed to the author, the owner and administrators; for others the server refuses and the post silently returns to its old kind (the message still appears).",
						"[[collab.toNews]] erscheint bei Beiträgen, die keine News sind. Es ändert die Art des Beitrags auf News und zeigt „[[collab.newsPublished]]“. Das dürfen der Autor, der Inhaber und Administratoren; bei anderen lehnt der Server ab und der Beitrag springt stillschweigend auf die alte Art zurück (die Meldung erscheint trotzdem).",
						"[[collab.toNews]] є на дописах, які не є новинами. Воно змінює вид допису на новину й показує «[[collab.newsPublished]]». Це дозволено автору, власнику й адміністраторам; для інших сервер відмовить, і допис тихо повернеться до старого виду (повідомлення все одно з’явиться).",
					),
					t3(
						"A row of six reaction buttons follows: 👍 ❤️ 😄 🎉 👏 🚀. A click puts your reaction (it turns green, the number next to it grows); a second click on the same one takes it back. One person can give each of the six reactions once. The counter shows how many people gave it.",
						"Danach folgt eine Reihe aus sechs Reaktions-Schaltflächen: 👍 ❤️ 😄 🎉 👏 🚀. Ein Klick setzt Ihre Reaktion (sie wird grün, die Zahl daneben steigt); ein zweiter Klick auf dieselbe nimmt sie zurück. Jede Person kann jede der sechs Reaktionen einmal vergeben. Der Zähler zeigt, wie viele Personen sie gegeben haben.",
						"Далі — рядок із шести кнопок реакцій: 👍 ❤️ 😄 🎉 👏 🚀. Клік ставить вашу реакцію (вона стає зеленою, число поруч зростає); другий клік по ній знімає. Кожну з шести реакцій людина може поставити один раз. Лічильник показує, скільки людей її поставили.",
					),
				],
			},
			{
				title: t3("Comments and notifications", "Kommentare und Benachrichtigungen", "Коментарі та сповіщення"),
				steps: [
					t3(
						"Under the reactions the existing comments are listed: avatar, name, date and text. Below them is the comment field “[[collab.addComment]]”. Type up to 500 characters and press Enter — the comment is added at once. There is no separate button and no editing or deleting of comments.",
						"Unter den Reaktionen stehen die vorhandenen Kommentare: Avatar, Name, Datum und Text. Darunter liegt das Kommentarfeld „[[collab.addComment]]“. Tippen Sie bis zu 500 Zeichen und drücken Sie die Eingabetaste — der Kommentar wird sofort hinzugefügt. Es gibt keine eigene Schaltfläche und kein Bearbeiten oder Löschen von Kommentaren.",
						"Під реакціями перелічено наявні коментарі: аватар, ім’я, дата й текст. Нижче поле коментаря «[[collab.addComment]]». Введіть до 500 символів і натисніть Enter — коментар додається одразу. Окремої кнопки, а також редагування чи видалення коментарів немає.",
					),
					t3(
						"A new comment is sent as a notification to: the author of the post, everybody who follows the post ([[collab.follow]]) and everybody who has already commented in this thread — but never to the author of the new comment.",
						"Ein neuer Kommentar geht als Benachrichtigung an: den Autor des Beitrags, alle, die dem Beitrag folgen ([[collab.follow]]) und alle, die in diesem Verlauf schon kommentiert haben — nie aber an den Autor des neuen Kommentars.",
						"Новий коментар надсилається як сповіщення: автору допису, усім, хто стежить за дописом ([[collab.follow]]), і всім, хто вже коментував цю гілку — але ніколи автору самого коментаря.",
					),
				],
			},
		],
	},
];
