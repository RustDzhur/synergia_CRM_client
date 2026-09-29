import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Начало работы: регистрация, устройство кабинета, шапка, меню, профиль; затем Dashboard.
export const START: DocSection[] = [
	{
		id: "start",
		title: t3("Getting started", "Erste Schritte", "Початок роботи"),
		intro: t3(
			"This page describes Firmspace CRM button by button. Names of buttons, tabs and fields are highlighted exactly as they are written in the cabinet in your language, so you can find them on screen at a glance. Some sections are available only on certain plans or to certain roles; if you do not see a section in the menu, see Plans and billing and Team and access.",
			"Diese Seite beschreibt Firmspace CRM Schaltfläche für Schaltfläche. Namen von Schaltflächen, Tabs und Feldern sind genau so hervorgehoben, wie sie im Kabinett in Ihrer Sprache stehen – so finden Sie sie auf dem Bildschirm sofort. Manche Bereiche gibt es nur in bestimmten Tarifen oder für bestimmte Rollen; sehen Sie einen Bereich nicht im Menü, lesen Sie Tarife und Abrechnung sowie Team und Zugriff.",
			"Ця сторінка описує Firmspace CRM кнопка за кнопкою. Назви кнопок, вкладок і полів виділено так, як вони написані в кабінеті вашою мовою, тож їх легко знайти на екрані. Деякі розділи доступні лише на певних тарифах або певним ролям; якщо розділу немає в меню, читайте «Тарифи та оплата» і «Команда та доступи».",
		),
		groups: [
			{
				title: t3("Registration and sign-in", "Registrierung und Anmeldung", "Реєстрація та вхід"),
				steps: [
					t3(
						"On the website press [[navWebsite.auth.signup]] in the top navigation. The form has two tabs: [[authForms.companyTab]] for a business and [[authForms.personalTab]] for a single person.",
						"Klicken Sie auf der Website in der oberen Navigation auf [[navWebsite.auth.signup]]. Das Formular hat zwei Tabs: [[authForms.companyTab]] für ein Unternehmen und [[authForms.personalTab]] für eine Einzelperson.",
						"На сайті натисніть [[navWebsite.auth.signup]] у верхній навігації. У формі дві вкладки: [[authForms.companyTab]] — для бізнесу й [[authForms.personalTab]] — для окремої людини.",
					),
					t3(
						"In the [[authForms.companyTab]] tab fill in [[authForms.companyname]], [[authForms.companyphone]], [[authForms.companyaddress]], [[authForms.taxnumber]], [[authForms.companyemail]] and [[authForms.companypassword]]. In the [[authForms.personalTab]] tab enter [[authForms.firstname]], [[authForms.lastname]], [[authForms.personalphone]], [[authForms.personalemail]], [[authForms.personaladdress]] and [[authForms.personalpassword]]. All fields are required.",
						"Im Tab [[authForms.companyTab]] füllen Sie [[authForms.companyname]], [[authForms.companyphone]], [[authForms.companyaddress]], [[authForms.taxnumber]], [[authForms.companyemail]] und [[authForms.companypassword]] aus. Im Tab [[authForms.personalTab]] geben Sie [[authForms.firstname]], [[authForms.lastname]], [[authForms.personalphone]], [[authForms.personalemail]], [[authForms.personaladdress]] und [[authForms.personalpassword]] ein. Alle Felder sind Pflicht.",
						"У вкладці [[authForms.companyTab]] заповніть [[authForms.companyname]], [[authForms.companyphone]], [[authForms.companyaddress]], [[authForms.taxnumber]], [[authForms.companyemail]] і [[authForms.companypassword]]. У вкладці [[authForms.personalTab]] введіть [[authForms.firstname]], [[authForms.lastname]], [[authForms.personalphone]], [[authForms.personalemail]], [[authForms.personaladdress]] і [[authForms.personalpassword]]. Усі поля обов’язкові.",
					),
					t3(
						"The eye icon at the right edge of a password field shows or hides the typed password. Tick [[authForms.agreement]] and press [[authForms.signup]].",
						"Das Augensymbol am rechten Rand eines Passwortfelds zeigt oder verbirgt das eingegebene Passwort. Setzen Sie den Haken bei [[authForms.agreement]] und klicken Sie auf [[authForms.signup]].",
						"Значок ока праворуч у полі пароля показує або ховає введений пароль. Поставте прапорець [[authForms.agreement]] і натисніть [[authForms.signup]].",
					),
					t3(
						"To come back later press [[navWebsite.auth.signin]], enter your e-mail in [[authForms.username]] and the [[authForms.password]], then press [[authForms.login]]. The cabinet opens on the Dashboard. The link under the form switches between registration and sign-in.",
						"Um später wiederzukommen, klicken Sie auf [[navWebsite.auth.signin]], geben Sie Ihre E-Mail bei [[authForms.username]] und das [[authForms.password]] ein und klicken Sie auf [[authForms.login]]. Das Kabinett öffnet sich auf der Übersicht. Der Link unter dem Formular wechselt zwischen Registrierung und Anmeldung.",
						"Щоб повернутися пізніше, натисніть [[navWebsite.auth.signin]], введіть e-mail у [[authForms.username]] і [[authForms.password]], потім натисніть [[authForms.login]]. Кабінет відкриється на інформаційній панелі. Посилання під формою перемикає між реєстрацією та входом.",
					),
					t3(
						"A new firm starts on the free plan, which includes the CRM and Tasks sections. Everything else can be unlocked in [[navigation.upgrade_plan]].",
						"Eine neue Firma startet im kostenlosen Tarif mit den Bereichen CRM und Tasks. Alles Weitere schalten Sie unter [[navigation.upgrade_plan]] frei.",
						"Нова фірма починає з безкоштовного тарифу з розділами CRM і Tasks. Решту можна відкрити в [[navigation.upgrade_plan]].",
					),
				],
			},
			{
				title: t3("What you see on screen", "Was Sie auf dem Bildschirm sehen", "Що ви бачите на екрані"),
				steps: [
					t3(
						"On the left is the sidebar with the menu. It is split under small headings: [[navigation.groups.workspace]], [[navigation.groups.collaboration]], [[navigation.groups.customers]], [[navigation.groups.organization]], [[navigation.groups.operations]] and [[navigation.groups.administration]].",
						"Links steht die Seitenleiste mit dem Menü. Sie ist unter kleinen Überschriften gegliedert: [[navigation.groups.workspace]], [[navigation.groups.collaboration]], [[navigation.groups.customers]], [[navigation.groups.organization]], [[navigation.groups.operations]] und [[navigation.groups.administration]].",
						"Ліворуч — бічна панель із меню. Її розбито під дрібними заголовками: [[navigation.groups.workspace]], [[navigation.groups.collaboration]], [[navigation.groups.customers]], [[navigation.groups.organization]], [[navigation.groups.operations]] і [[navigation.groups.administration]].",
					),
					t3(
						"Menu items: [[navigation.dashboard]], [[navigation.collaboration]] (with [[navigation.feed]], [[navigation.chat_and_calls]], [[navigation.calendar]], [[navigation.online_documents]], [[navigation.web_mails]]), [[navigation.crm]], [[navigation.company]], [[navigation.tasks_projects]], [[navigation.inventory_management]], [[navigation.marketing]], [[navigation.automation]], [[navigation.upgrade_plan]] and [[navigation.settings]]. A click on [[navigation.collaboration]] unfolds its five sub-items.",
						"Menüpunkte: [[navigation.dashboard]], [[navigation.collaboration]] (mit [[navigation.feed]], [[navigation.chat_and_calls]], [[navigation.calendar]], [[navigation.online_documents]], [[navigation.web_mails]]), [[navigation.crm]], [[navigation.company]], [[navigation.tasks_projects]], [[navigation.inventory_management]], [[navigation.marketing]], [[navigation.automation]], [[navigation.upgrade_plan]] und [[navigation.settings]]. Ein Klick auf [[navigation.collaboration]] klappt die fünf Unterpunkte auf.",
						"Пункти меню: [[navigation.dashboard]], [[navigation.collaboration]] (з [[navigation.feed]], [[navigation.chat_and_calls]], [[navigation.calendar]], [[navigation.online_documents]], [[navigation.web_mails]]), [[navigation.crm]], [[navigation.company]], [[navigation.tasks_projects]], [[navigation.inventory_management]], [[navigation.marketing]], [[navigation.automation]], [[navigation.upgrade_plan]] і [[navigation.settings]]. Натиск на [[navigation.collaboration]] розгортає п’ять вкладених пунктів.",
					),
					t3(
						"The menu shows only what you can use: an item disappears if your plan does not include the section or your role has no access to it. If you open a locked section by a direct link, you are taken to the plans page with a note that you must change the plan first.",
						"Das Menü zeigt nur, was Sie nutzen können: Ein Punkt verschwindet, wenn Ihr Tarif den Bereich nicht enthält oder Ihre Rolle keinen Zugriff hat. Öffnen Sie einen gesperrten Bereich über einen direkten Link, werden Sie zur Tarifseite geleitet – mit dem Hinweis, zuerst den Tarif zu wechseln.",
						"Меню показує лише те, чим ви можете користуватися: пункт зникає, якщо тариф не містить розділу або роль не має до нього доступу. Якщо відкрити закритий розділ за прямим посиланням, вас перекине на сторінку тарифів із поясненням, що спершу треба змінити тариф.",
					),
					t3(
						"The top bar (header) shows the path of the current page on the left. On the right are: the search field, the AI button, the language switcher, the notification bell and the green “[[navBar.protectedArea]]” chip. On a phone the sidebar is hidden: the header shows the brand mark and a menu button that opens the same list of sections.",
						"Die Kopfleiste zeigt links den Pfad der aktuellen Seite. Rechts stehen: das Suchfeld, die KI-Schaltfläche, der Sprachumschalter, die Benachrichtigungsglocke und der grüne Chip „[[navBar.protectedArea]]“. Auf dem Handy ist die Seitenleiste ausgeblendet: Die Kopfleiste zeigt das Markenzeichen und eine Menü-Schaltfläche, die dieselbe Liste der Bereiche öffnet.",
						"Верхня панель (шапка) ліворуч показує шлях поточної сторінки. Праворуч: поле пошуку, кнопка AI, перемикач мови, дзвіночок сповіщень і зелений чип «[[navBar.protectedArea]]». На телефоні бічну панель приховано: у шапці стоять знак бренду й кнопка меню, що відкриває той самий список розділів.",
					),
					t3(
						"The search field in the header is a placeholder for the future global search and does not return results yet; use the search field inside each section instead (CRM, Tasks, Marketing and so on).",
						"Das Suchfeld in der Kopfleiste ist ein Platzhalter für die künftige globale Suche und liefert noch keine Ergebnisse; nutzen Sie stattdessen das Suchfeld im jeweiligen Bereich (CRM, Tasks, Marketing usw.).",
						"Поле пошуку в шапці — заготовка майбутнього глобального пошуку й поки що нічого не знаходить; користуйтеся пошуком усередині розділу (CRM, Tasks, Marketing тощо).",
					),
				],
			},
			{
				title: t3("Language, firm and profile", "Sprache, Firma und Profil", "Мова, фірма й профіль"),
				steps: [
					t3(
						"The language switcher in the header offers three languages: [[navBar.lang.en]], [[navBar.lang.de]] and [[navBar.lang.ua]]. The choice changes the whole cabinet immediately and is kept in the address of the page.",
						"Der Sprachumschalter in der Kopfleiste bietet drei Sprachen: [[navBar.lang.en]], [[navBar.lang.de]] und [[navBar.lang.ua]]. Die Auswahl ändert das ganze Kabinett sofort und steht in der Adresse der Seite.",
						"Перемикач мови в шапці пропонує три мови: [[navBar.lang.en]], [[navBar.lang.de]] і [[navBar.lang.ua]]. Вибір одразу змінює весь кабінет і зберігається в адресі сторінки.",
					),
					t3(
						"At the top of the sidebar the card [[navBar.activeOrg]] shows the firm you are working in. A click opens the list of your firms; each row shows the name and your role there ([[navBar.role_owner]], [[navBar.role_admin]], [[navBar.role_manager]], [[navBar.role_employee]] or [[navBar.role_viewer]]). A tick marks the active firm; a click on another row switches to it and reloads all data of that firm.",
						"Oben in der Seitenleiste zeigt die Karte [[navBar.activeOrg]], in welcher Firma Sie arbeiten. Ein Klick öffnet die Liste Ihrer Firmen; jede Zeile zeigt den Namen und Ihre Rolle dort ([[navBar.role_owner]], [[navBar.role_admin]], [[navBar.role_manager]], [[navBar.role_employee]] oder [[navBar.role_viewer]]). Ein Haken markiert die aktive Firma; ein Klick auf eine andere Zeile wechselt dorthin und lädt alle Daten dieser Firma.",
						"Угорі бічної панелі картка [[navBar.activeOrg]] показує фірму, в якій ви працюєте. Натиск відкриває список ваших фірм; у кожному рядку — назва й ваша роль там ([[navBar.role_owner]], [[navBar.role_admin]], [[navBar.role_manager]], [[navBar.role_employee]] або [[navBar.role_viewer]]). Галочка позначає активну фірму; натиск на інший рядок перемикає на неї й перезавантажує всі її дані.",
					),
					t3(
						"To add another firm press [[navBar.newFirm]] in the same list, type the name in [[navBar.firmName]] and press [[navBar.create]]. Every firm has its own data, plan and team. Owners and administrators also see [[navBar.renameFirm]]: change the name and press [[navBar.save]].",
						"Um eine weitere Firma anzulegen, klicken Sie in derselben Liste auf [[navBar.newFirm]], tippen den Namen bei [[navBar.firmName]] und klicken auf [[navBar.create]]. Jede Firma hat eigene Daten, einen eigenen Tarif und ein eigenes Team. Inhaber und Administratoren sehen außerdem [[navBar.renameFirm]]: Namen ändern und [[navBar.save]] klicken.",
						"Щоб додати ще одну фірму, натисніть [[navBar.newFirm]] у тому ж списку, введіть назву в [[navBar.firmName]] і натисніть [[navBar.create]]. У кожної фірми свої дані, тариф і команда. Власники й адміністратори бачать також [[navBar.renameFirm]]: змініть назву й натисніть [[navBar.save]].",
					),
					t3(
						"At the bottom of the sidebar is your name with the photo. A click opens a small menu. [[navBar.currentUser.settings]] opens the [[profile.title]] window; [[navBar.currentUser.logout]] signs you out and returns you to the sign-in page.",
						"Unten in der Seitenleiste stehen Ihr Name und Ihr Foto. Ein Klick öffnet ein kleines Menü. [[navBar.currentUser.settings]] öffnet das Fenster [[profile.title]]; [[navBar.currentUser.logout]] meldet Sie ab und führt zur Anmeldeseite.",
						"Унизу бічної панелі — ваше ім’я з фото. Натиск відкриває невелике меню. [[navBar.currentUser.settings]] відкриває вікно [[profile.title]]; [[navBar.currentUser.logout]] виконує вихід і повертає на сторінку входу.",
					),
					t3(
						"In [[profile.title]] you can change [[profile.firstname]], [[profile.lastname]], [[profile.phone]], [[profile.position]], [[profile.city]] and [[profile.country]]; the e-mail is your login and is shown for information. [[profile.uploadPhoto]] picks an image up to 5 MB, [[profile.removePhoto]] deletes it. [[profile.save]] stores everything and shows “[[profile.saved]]”; [[profile.cancel]] closes the window without saving. First and last name cannot be empty.",
						"In [[profile.title]] ändern Sie [[profile.firstname]], [[profile.lastname]], [[profile.phone]], [[profile.position]], [[profile.city]] und [[profile.country]]; die E-Mail ist Ihr Login und wird nur angezeigt. [[profile.uploadPhoto]] wählt ein Bild bis 5 MB, [[profile.removePhoto]] löscht es. [[profile.save]] speichert alles und zeigt „[[profile.saved]]“; [[profile.cancel]] schließt das Fenster ohne Speichern. Vor- und Nachname dürfen nicht leer sein.",
						"У [[profile.title]] можна змінити [[profile.firstname]], [[profile.lastname]], [[profile.phone]], [[profile.position]], [[profile.city]] і [[profile.country]]; e-mail — це ваш логін, його лише показано. [[profile.uploadPhoto]] обирає зображення до 5 МБ, [[profile.removePhoto]] видаляє його. [[profile.save]] зберігає все й показує «[[profile.saved]]»; [[profile.cancel]] закриває вікно без збереження. Ім’я та прізвище не можуть бути порожніми.",
					),
					t3(
						"More personal settings (time zone, spoken languages, password, notifications) are on the [[navigation.settings]] page of the sidebar; see the section Settings below.",
						"Weitere persönliche Einstellungen (Zeitzone, Sprachen, Passwort, Benachrichtigungen) finden Sie auf der Seite [[navigation.settings]] in der Seitenleiste; siehe den Abschnitt Einstellungen weiter unten.",
						"Інші особисті налаштування (часовий пояс, мови, пароль, сповіщення) — на сторінці [[navigation.settings]] бічної панелі; див. розділ «Налаштування» нижче.",
					),
				],
			},
			{
				title: t3("Notification bell", "Benachrichtigungsglocke", "Дзвіночок сповіщень"),
				steps: [
					t3(
						"The bell in the header shows a badge with the number of unread items. A click opens the list [[notif.title]]; when it is empty it says “[[notif.empty]]”.",
						"Die Glocke in der Kopfleiste zeigt eine Zahl der ungelesenen Einträge. Ein Klick öffnet die Liste [[notif.title]]; ist sie leer, steht dort „[[notif.empty]]“.",
						"Дзвіночок у шапці показує значок із кількістю непрочитаних. Натиск відкриває список [[notif.title]]; коли він порожній, там написано «[[notif.empty]]».",
					),
					t3(
						"Notifications arrive for: new e-mail (several at once are combined into one line), a new lead created from an e-mail, a new message in a connected channel, a missed call, a message from a colleague, a calendar event reminder, and deadlines of tasks and deals (24 hours before, 1 hour before and when overdue).",
						"Benachrichtigungen kommen bei: neuer E-Mail (mehrere auf einmal werden zu einer Zeile zusammengefasst), neuem Lead aus einer E-Mail, neuer Nachricht in einem verbundenen Kanal, verpasstem Anruf, Nachricht eines Kollegen, Terminerinnerung im Kalender sowie Fristen von Aufgaben und Deals (24 Stunden vorher, 1 Stunde vorher und bei Überfälligkeit).",
						"Сповіщення приходять про: нову пошту (кілька листів зводяться в один рядок), новий лід із листа, нове повідомлення у підключеному каналі, пропущений дзвінок, повідомлення від колеги, нагадування про подію календаря та дедлайни завдань і угод (за 24 години, за 1 годину й коли прострочено).",
					),
					t3(
						"[[notif.open]] on a line jumps to the related page (a conversation, mailbox, task or deal). [[notif.dismiss]] removes the line. [[notif.markAll]] at the top marks everything as read at once.",
						"[[notif.open]] in einer Zeile springt zur passenden Seite (Gespräch, Postfach, Aufgabe oder Deal). [[notif.dismiss]] entfernt die Zeile. [[notif.markAll]] oben markiert alles auf einmal als gelesen.",
						"[[notif.open]] у рядку веде на відповідну сторінку (переписка, скринька, завдання чи угода). [[notif.dismiss]] прибирає рядок. [[notif.markAll]] угорі позначає все прочитаним одразу.",
					),
					t3(
						"Whether notifications also appear as browser pop-ups or e-mails, and when they are silenced, is set in [[navigation.settings]] → Notifications.",
						"Ob Benachrichtigungen zusätzlich als Browser-Pop-up oder E-Mail erscheinen und wann sie stummgeschaltet werden, stellen Sie unter [[navigation.settings]] → Benachrichtigungen ein.",
						"Чи з’являтимуться сповіщення ще й як спливні вікна браузера або листи, і коли їх вимикати, налаштовується в [[navigation.settings]] → Сповіщення.",
					),
				],
			},
			{
				title: t3("Your first day: a suggested order", "Ihr erster Tag: eine Reihenfolge", "Ваш перший день: рекомендований порядок"),
				steps: [
					t3(
						"Open [[navigation.settings]] and fill in your profile, then connect the channels you need (Settings → Integration).",
						"Öffnen Sie [[navigation.settings]] und füllen Sie Ihr Profil aus, dann verbinden Sie die benötigten Kanäle (Settings → Integration).",
						"Відкрийте [[navigation.settings]] і заповніть профіль, потім підключіть потрібні канали (Settings → Integration).",
					),
					t3(
						"In [[navigation.crm]] add your first [[crm.companies]] and [[crm.contacts]], then create a deal in the [[crm.deals]] tab.",
						"Legen Sie in [[navigation.crm]] Ihre ersten [[crm.companies]] und [[crm.contacts]] an und erstellen Sie dann im Tab [[crm.deals]] einen Deal.",
						"У [[navigation.crm]] додайте перші [[crm.companies]] та [[crm.contacts]], а потім створіть угоду у вкладці [[crm.deals]].",
					),
					t3(
						"Create tasks in [[navigation.tasks_projects]] and give them deadlines: they then appear on the Dashboard and in the calendar.",
						"Erstellen Sie Aufgaben in [[navigation.tasks_projects]] und geben Sie ihnen Fristen: Sie erscheinen dann im Dashboard und im Kalender.",
						"Створіть завдання в [[navigation.tasks_projects]] і задайте їм дедлайни: тоді вони з’являться на панелі й у календарі.",
					),
					t3(
						"Set up [[navigation.inventory_management]] (company data, tax, products) before the first quote or invoice, and invite colleagues in [[navigation.settings]] → Team and access.",
						"Richten Sie [[navigation.inventory_management]] (Firmendaten, Steuer, Produkte) vor dem ersten Angebot oder der ersten Rechnung ein und laden Sie Kollegen unter [[navigation.settings]] → Team und Zugriff ein.",
						"Налаштуйте [[navigation.inventory_management]] (дані фірми, податок, товари) до першої пропозиції чи рахунку й запросіть колег у [[navigation.settings]] → Команда та доступи.",
					),
				],
			},
		],
	},
	{
		id: "dashboard",
		title: t3("Dashboard", "Übersicht", "Інформаційна панель"),
		intro: t3(
			"The Dashboard is the day at a glance. It is read-mostly: it summarises the other sections and every card leads into its section.",
			"Die Übersicht ist der Tag auf einen Blick. Sie dient vor allem zum Lesen: Sie fasst die anderen Bereiche zusammen, und jede Karte führt in ihren Bereich.",
			"Панель — це день на одному екрані. Вона здебільшого для читання: підсумовує інші розділи, а кожна картка веде у свій розділ.",
		),
		groups: [
			{
				title: t3("Deals and tasks charts", "Diagramme Deals und Aufgaben", "Графіки угод і завдань"),
				steps: [
					t3(
						"The [[dashboard.dealsTitle]] card shows a chart of [[dashboard.closedDeals]]. The selector at the top right switches the period: [[dashboard.monthly]], [[dashboard.weekly]] or [[dashboard.yearly]]. Hover over a bar to see the exact number.",
						"Die Karte [[dashboard.dealsTitle]] zeigt ein Diagramm der [[dashboard.closedDeals]]. Der Umschalter oben rechts wechselt den Zeitraum: [[dashboard.monthly]], [[dashboard.weekly]] oder [[dashboard.yearly]]. Fahren Sie über einen Balken, um die genaue Zahl zu sehen.",
						"Картка [[dashboard.dealsTitle]] показує графік [[dashboard.closedDeals]]. Перемикач угорі праворуч змінює період: [[dashboard.monthly]], [[dashboard.weekly]] або [[dashboard.yearly]]. Наведіть курсор на стовпчик, щоб побачити точне число.",
					),
					t3(
						"The [[dashboard.tasksTitle]] card is a ring chart of tasks by status: [[dashboard.active]], [[dashboard.completed]] and [[dashboard.ended]] (overdue). Its selector switches between [[dashboard.thisMonth]], [[dashboard.thisWeek]] and [[dashboard.thisYear]]. The centre shows the total.",
						"Die Karte [[dashboard.tasksTitle]] ist ein Ringdiagramm der Aufgaben nach Status: [[dashboard.active]], [[dashboard.completed]] und [[dashboard.ended]] (überfällig). Ihr Umschalter wechselt zwischen [[dashboard.thisMonth]], [[dashboard.thisWeek]] und [[dashboard.thisYear]]. In der Mitte steht die Gesamtzahl.",
						"Картка [[dashboard.tasksTitle]] — кільцева діаграма завдань за станом: [[dashboard.active]], [[dashboard.completed]] і [[dashboard.ended]] (прострочені). Її перемикач обирає [[dashboard.thisMonth]], [[dashboard.thisWeek]] або [[dashboard.thisYear]]. У центрі — загальна кількість.",
					),
					t3(
						"When there is nothing to draw yet, the card says “[[dashboard.noData]]”.",
						"Gibt es noch nichts zu zeichnen, steht in der Karte „[[dashboard.noData]]“.",
						"Коли малювати ще нічого, у картці написано «[[dashboard.noData]]».",
					),
				],
			},
			{
				title: t3("Finance and ads cards", "Finanz- und Werbekarten", "Картки фінансів і реклами"),
				steps: [
					t3(
						"The [[finance.title]] card gives the money picture of the firm: [[finance.kpiRevenue]], [[finance.kpiOutstanding]], [[finance.kpiOverdue]], [[finance.kpiExpenses]] and [[finance.kpiProfit]]. [[finance.details]] opens the Finance section. Without invoices and expenses it says “[[finance.dashboardEmpty]]”.",
						"Die Karte [[finance.title]] zeigt das Geldbild der Firma: [[finance.kpiRevenue]], [[finance.kpiOutstanding]], [[finance.kpiOverdue]], [[finance.kpiExpenses]] und [[finance.kpiProfit]]. [[finance.details]] öffnet den Bereich Finanzen. Ohne Rechnungen und Ausgaben steht dort „[[finance.dashboardEmpty]]“.",
						"Картка [[finance.title]] показує грошову картину фірми: [[finance.kpiRevenue]], [[finance.kpiOutstanding]], [[finance.kpiOverdue]], [[finance.kpiExpenses]] і [[finance.kpiProfit]]. [[finance.details]] відкриває розділ «Фінанси». Без рахунків і витрат там написано «[[finance.dashboardEmpty]]».",
					),
					t3(
						"The [[ads.title]] card shows ad spend, clicks and conversions of the last days from connected platforms. [[ads.details]] opens the ad performance tab. If no platform is connected, the button [[ads.connectCta]] leads to the connection.",
						"Die Karte [[ads.title]] zeigt Ausgaben, Klicks und Conversions der letzten Tage aus verbundenen Plattformen. [[ads.details]] öffnet den Tab Anzeigenleistung. Ist keine Plattform verbunden, führt die Schaltfläche [[ads.connectCta]] zur Verbindung.",
						"Картка [[ads.title]] показує витрати, кліки й конверсії за останні дні з підключених платформ. [[ads.details]] відкриває вкладку ефективності реклами. Якщо жодної платформи не підключено, кнопка [[ads.connectCta]] веде до підключення.",
					),
					t3(
						"These two cards appear only if your plan and role give access to Finance and Marketing.",
						"Diese beiden Karten erscheinen nur, wenn Ihr Tarif und Ihre Rolle Zugriff auf Finanzen und Marketing geben.",
						"Ці дві картки з’являються лише якщо тариф і роль дають доступ до «Фінансів» і «Маркетингу».",
					),
				],
			},
			{
				title: t3("The day: week strip, tasks and events", "Der Tag: Wochenstreifen, Aufgaben und Termine", "День: смуга тижня, завдання й події"),
				steps: [
					t3(
						"Below the cards is the week strip with the line “{done} tasks completed out of {total}”. Click a day to select it, or use the field [[dashboard.date]] and the calendar icon ([[dashboard.pickDate]]) to jump to any date. Everything below shows exactly this day.",
						"Unter den Karten steht der Wochenstreifen mit der Zeile „{erledigt} Aufgaben von {gesamt} erledigt“. Klicken Sie auf einen Tag, um ihn zu wählen, oder springen Sie mit dem Feld [[dashboard.date]] und dem Kalendersymbol ([[dashboard.pickDate]]) zu einem beliebigen Datum. Alles darunter zeigt genau diesen Tag.",
						"Під картками — смуга тижня з рядком «виконано {done} завдань із {total}». Натисніть день, щоб обрати його, або скористайтеся полем [[dashboard.date]] і значком календаря ([[dashboard.pickDate]]), щоб перейти на будь-яку дату. Усе нижче показує саме цей день.",
					),
					t3(
						"The list of tasks of the chosen day has a search field [[dashboard.filterSearch]] (by title, responsible person and comments). If there are no tasks it says “[[dashboard.noTasks]]” with the hint “[[dashboard.createTaskHint]]”; the button [[dashboard.openTasks]] opens the Tasks section.",
						"Die Aufgabenliste des gewählten Tages hat ein Suchfeld [[dashboard.filterSearch]] (nach Titel, Verantwortlichem und Kommentaren). Gibt es keine Aufgaben, steht dort „[[dashboard.noTasks]]“ mit dem Hinweis „[[dashboard.createTaskHint]]“; die Schaltfläche [[dashboard.openTasks]] öffnet den Bereich Tasks.",
						"Список завдань обраного дня має поле пошуку [[dashboard.filterSearch]] (за назвою, відповідальним і коментарями). Якщо завдань немає, там «[[dashboard.noTasks]]» з підказкою «[[dashboard.createTaskHint]]»; кнопка [[dashboard.openTasks]] відкриває розділ Tasks.",
					),
					t3(
						"Each task card shows the title, the [[dashboard.responsiblePerson]] and the status. The menu [[dashboard.options]] contains: [[dashboard.pin]] / [[dashboard.unpin]] (a pinned task stays on top), [[dashboard.markDone]] / [[dashboard.markActive]] and [[dashboard.delete]] (the task is removed at once, without a confirmation).",
						"Jede Aufgabenkarte zeigt Titel, den [[dashboard.responsiblePerson]] und den Status. Das Menü [[dashboard.options]] enthält: [[dashboard.pin]] / [[dashboard.unpin]] (eine angeheftete Aufgabe bleibt oben), [[dashboard.markDone]] / [[dashboard.markActive]] und [[dashboard.delete]] (die Aufgabe wird sofort und ohne Rückfrage entfernt).",
						"На картці завдання видно назву, [[dashboard.responsiblePerson]] і стан. Меню [[dashboard.options]] містить: [[dashboard.pin]] / [[dashboard.unpin]] (закріплене завдання лишається вгорі), [[dashboard.markDone]] / [[dashboard.markActive]] і [[dashboard.delete]] (завдання видаляється одразу, без підтвердження).",
					),
					t3(
						"To discuss a task press [[dashboard.comment]] under it: type in the field and press [[dashboard.addComment]]. Under a comment [[dashboard.reply]] answers that comment, and [[dashboard.delete]] removes your own. Without comments the card says “[[dashboard.noComments]]”.",
						"Um eine Aufgabe zu besprechen, klicken Sie darunter auf [[dashboard.comment]]: Tippen Sie ins Feld und klicken Sie auf [[dashboard.addComment]]. Unter einem Kommentar antwortet [[dashboard.reply]] darauf, [[dashboard.delete]] entfernt Ihren eigenen. Ohne Kommentare steht in der Karte „[[dashboard.noComments]]“.",
						"Щоб обговорити завдання, натисніть [[dashboard.comment]] під ним: введіть текст у полі й натисніть [[dashboard.addComment]]. Під коментарем [[dashboard.reply]] відповідає на нього, а [[dashboard.delete]] видаляє ваш власний. Без коментарів картка каже «[[dashboard.noComments]]».",
					),
					t3(
						"The [[dashboard.eventsTitle]] card lists calendar events of the chosen day (“[[dashboard.noEvents]]” if none). [[dashboard.openCalendar]] opens the calendar.",
						"Die Karte [[dashboard.eventsTitle]] listet die Kalendertermine des gewählten Tages („[[dashboard.noEvents]]“, wenn keine). [[dashboard.openCalendar]] öffnet den Kalender.",
						"Картка [[dashboard.eventsTitle]] перелічує події календаря обраного дня («[[dashboard.noEvents]]», якщо немає). [[dashboard.openCalendar]] відкриває календар.",
					),
				],
			},
		],
	},
];
