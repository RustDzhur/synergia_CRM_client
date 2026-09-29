import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const SETTINGS_DOCS: DocSection[] = [
	{
		id: "settings",
		title: t3("Settings: tabs, colleagues, team and access", "Einstellungen: Tabs, Kollegen, Team und Zugriff", "Налаштування: вкладки, колеги, команда та доступ"),
		intro: t3(
			"[[navigation.settings]] is opened from the menu on the left. On the left of the page a card lists five tabs; the active one is green and every tab has its own address, so you can bookmark it: [[settings.tabAccount]], [[settings.tabNotifications]], [[settings.tabIntegration]], [[settings.tabColleagues]] and [[settings.tabTeam]]. The first two are described in the section “Account and notifications”, the third in “Integrations”, the last two below. [[settings.tabColleagues]] and [[settings.tabTeam]] belong to the “multi-user” feature and need the Standard plan or higher.",
			"[[navigation.settings]] öffnen Sie im Menü links. Links auf der Seite listet eine Karte fünf Tabs; der aktive ist grün, und jeder Tab hat eine eigene Adresse, Sie können ihn also als Lesezeichen speichern: [[settings.tabAccount]], [[settings.tabNotifications]], [[settings.tabIntegration]], [[settings.tabColleagues]] und [[settings.tabTeam]]. Die ersten beiden sind im Abschnitt „Konto und Benachrichtigungen“ beschrieben, der dritte in „Integrationen“, die letzten beiden unten. [[settings.tabColleagues]] und [[settings.tabTeam]] gehören zur Funktion „Mehrbenutzer“ und brauchen den Tarif Standard oder höher.",
			"[[navigation.settings]] відкривають із меню ліворуч. Ліворуч на сторінці картка перелічує п’ять вкладок; активна — зелена, і кожна вкладка має власну адресу, тож її можна додати в закладки: [[settings.tabAccount]], [[settings.tabNotifications]], [[settings.tabIntegration]], [[settings.tabColleagues]] та [[settings.tabTeam]]. Перші дві описано в розділі «Акаунт і сповіщення», третю — в «Інтеграціях», останні дві — нижче. [[settings.tabColleagues]] і [[settings.tabTeam]] належать до функції «кілька користувачів» і потребують тарифу Standard або вищого.",
		),
		groups: [
			{
				title: t3("Colleagues tab", "Tab Kollegen", "Вкладка колег"),
				steps: [
					t3(
						"[[settings.tabColleagues]] shows the same employee directory as [[navigation.company]] → [[company.employeesTab]], only more compactly, and both pages edit the same records. Above the table: the field [[settings.search]] (with the same filters [[settings.allDepartments]] and [[settings.allPositions]] behind the filter button) and the green button [[settings.addEmployee]], which opens the same window as in [[navigation.company]] (fields, required name and e-mail, messages — see the section “My company”).",
						"[[settings.tabColleagues]] zeigt dasselbe Mitarbeiterverzeichnis wie [[navigation.company]] → [[company.employeesTab]], nur kompakter, und beide Seiten bearbeiten dieselben Einträge. Über der Tabelle: das Feld [[settings.search]] (mit denselben Filtern [[settings.allDepartments]] und [[settings.allPositions]] hinter der Filter-Schaltfläche) und die grüne Schaltfläche [[settings.addEmployee]], die dasselbe Fenster wie in [[navigation.company]] öffnet (Felder, Pflichtangaben Name und E-Mail, Meldungen — siehe Abschnitt „Meine Firma“).",
						"[[settings.tabColleagues]] показує той самий довідник співробітників, що й [[navigation.company]] → [[company.employeesTab]], тільки компактніше, і обидві сторінки редагують ті самі записи. Над таблицею: поле [[settings.search]] (з тими самими фільтрами [[settings.allDepartments]] та [[settings.allPositions]] за кнопкою фільтра) і зелена кнопка [[settings.addEmployee]], що відкриває те саме вікно, що й у [[navigation.company]] (поля, обов’язкові ім’я та e-mail, повідомлення — див. розділ «Моя компанія»).",
					),
					t3(
						"The table has a checkbox in the header ([[settings.selectAll]]) and a checkbox in every row. As soon as at least one row is ticked, a red text [[settings.deleteSelected]] with the number appears above the table; it asks for a confirmation for the selected employees and deletes them together.",
						"Die Tabelle hat eine Checkbox in der Kopfzeile ([[settings.selectAll]]) und eine in jeder Zeile. Sobald mindestens eine Zeile angekreuzt ist, erscheint über der Tabelle ein roter Text [[settings.deleteSelected]] mit der Anzahl; er fragt nach einer Bestätigung für die ausgewählten Mitarbeiter und löscht sie gemeinsam.",
						"У таблиці є прапорець у шапці ([[settings.selectAll]]) і прапорець у кожному рядку. Щойно відмічено хоча б один рядок, над таблицею з’являється червоний текст [[settings.deleteSelected]] з кількістю; він просить підтвердження для вибраних співробітників і видаляє їх разом.",
					),
					t3(
						"Columns: [[settings.name]] (the picture or initials, the name, the position below it, a green dot with the tooltip “[[settings.active]]”, then a red cross [[settings.remove]] that deletes just this person after a confirmation, and a pencil [[settings.edit]] that opens the edit window), [[settings.position]], [[settings.colDepartment]], [[settings.colPhone]] and [[settings.colEmail]]. While loading the table says “[[settings.loading]]”, when there is nobody “[[settings.empty]]”.",
						"Spalten: [[settings.name]] (das Bild oder die Initialen, der Name, darunter die Position, ein grüner Punkt mit dem Tooltip „[[settings.active]]“, dann ein rotes Kreuz [[settings.remove]], das nur diese Person nach einer Bestätigung löscht, und ein Stift [[settings.edit]], der das Bearbeiten-Fenster öffnet), [[settings.position]], [[settings.colDepartment]], [[settings.colPhone]] und [[settings.colEmail]]. Beim Laden steht in der Tabelle „[[settings.loading]]“, ohne Personen „[[settings.empty]]“.",
						"Стовпці: [[settings.name]] (зображення чи ініціали, ім’я, під ним посада, зелена крапка з підказкою «[[settings.active]]», далі червоний хрестик [[settings.remove]], що видаляє лише цю людину після підтвердження, і олівець [[settings.edit]], що відкриває вікно редагування), [[settings.position]], [[settings.colDepartment]], [[settings.colPhone]] та [[settings.colEmail]]. Під час завантаження таблиця каже «[[settings.loading]]», коли нікого немає — «[[settings.empty]]».",
					),
					t3(
						"Two limits of this page: the green dot is always shown (it does not tell whether the person is really online), and there is no paging — only the first 20 people are listed. For a long list use the search here or the paged table in [[navigation.company]].",
						"Zwei Grenzen dieser Seite: Der grüne Punkt wird immer gezeigt (er sagt nicht, ob die Person wirklich online ist), und es gibt kein Blättern — nur die ersten 20 Personen werden aufgelistet. Für eine lange Liste nutzen Sie hier die Suche oder die Tabelle mit Seiten in [[navigation.company]].",
						"Два обмеження цієї сторінки: зелена крапка показується завжди (вона не каже, чи людина справді онлайн), а сторінок немає — перелічено лише перших 20 людей. Для довгого списку користуйтеся пошуком тут або таблицею зі сторінками в [[navigation.company]].",
					),
				],
			},
			{
				title: t3("Team and access tab: adding a person", "Tab Team und Zugriff: eine Person hinzufügen", "Вкладка команди та доступу: додавання людини"),
				steps: [
					t3(
						"Open [[settings.tabTeam]]. This is where people receive a real login to the CRM of your firm. The tab is meant for the owner and administrators; everybody else sees the text “[[settings.teamNoAccess]]”. The heading of the page is the name of the firm and a grey help text [[settings.teamHelp]] explains what the tab does.",
						"Öffnen Sie [[settings.tabTeam]]. Hier bekommen Menschen einen echten Zugang zum CRM Ihrer Firma. Der Tab ist für den Inhaber und die Administratoren gedacht; alle anderen sehen den Text „[[settings.teamNoAccess]]“. Die Überschrift der Seite ist der Firmenname, und ein grauer Hilfetext [[settings.teamHelp]] erklärt, was der Tab tut.",
						"Відкрийте [[settings.tabTeam]]. Саме тут люди отримують справжній вхід у CRM вашої фірми. Вкладка призначена для власника й адміністраторів; усі інші бачать текст «[[settings.teamNoAccess]]». Заголовок сторінки — назва фірми, а сірий довідковий текст [[settings.teamHelp]] пояснює, що робить вкладка.",
					),
					t3(
						"The card [[settings.teamAdd]] has: an e-mail field (required; the hint shows colleague@example.com), a list [[settings.teamRole]] and the button [[settings.teamInvite]]. In the list you choose [[settings.role_manager]], [[settings.role_employee]] or [[settings.role_viewer]]; the entry [[settings.role_admin]] is offered only to the owner. The owner role cannot be given to anybody.",
						"Die Karte [[settings.teamAdd]] enthält: ein E-Mail-Feld (Pflicht; der Hinweis zeigt colleague@example.com), eine Liste [[settings.teamRole]] und die Schaltfläche [[settings.teamInvite]]. In der Liste wählen Sie [[settings.role_manager]], [[settings.role_employee]] oder [[settings.role_viewer]]; der Eintrag [[settings.role_admin]] wird nur dem Inhaber angeboten. Die Rolle Inhaber kann niemandem gegeben werden.",
						"Картка [[settings.teamAdd]] містить: поле e-mail (обов’язкове; підказка показує colleague@example.com), список [[settings.teamRole]] і кнопку [[settings.teamInvite]]. У списку ви обираєте [[settings.role_manager]], [[settings.role_employee]] або [[settings.role_viewer]]; пункт [[settings.role_admin]] пропонується лише власнику. Роль власника нікому дати не можна.",
					),
					t3(
						"Under the fields there is a frame [[settings.teamModulesHint]] with tick boxes for the sections: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_company]], [[settings.module_collab]], [[settings.module_mail]], [[settings.module_marketing]], [[settings.module_inventory]] and [[settings.module_automation]] (the frame is hidden for the role [[settings.role_admin]], who sees everything). If nothing is ticked, the person gets the standard sections of the role (see the table below). If you tick at least one box, exactly the ticked sections are given and the role’s standard sections no longer apply. A grey note [[settings.teamInviteNote]] under the button repeats how this works.",
						"Unter den Feldern steht ein Rahmen [[settings.teamModulesHint]] mit Kästchen für die Bereiche: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_company]], [[settings.module_collab]], [[settings.module_mail]], [[settings.module_marketing]], [[settings.module_inventory]] und [[settings.module_automation]] (für die Rolle [[settings.role_admin]] wird der Rahmen ausgeblendet, sie sieht alles). Ist nichts angekreuzt, erhält die Person die Standardbereiche der Rolle (siehe Tabelle unten). Kreuzen Sie mindestens ein Kästchen an, werden genau die angekreuzten Bereiche vergeben, und die Standardbereiche der Rolle gelten nicht mehr. Eine graue Notiz [[settings.teamInviteNote]] unter der Schaltfläche wiederholt, wie das funktioniert.",
						"Під полями є рамка [[settings.teamModulesHint]] з прапорцями розділів: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_company]], [[settings.module_collab]], [[settings.module_mail]], [[settings.module_marketing]], [[settings.module_inventory]] та [[settings.module_automation]] (для ролі [[settings.role_admin]] рамку приховано, вона бачить усе). Якщо нічого не відмічено, людина отримує стандартні розділи ролі (див. таблицю нижче). Якщо відмітити хоча б один прапорець, видаються рівно відмічені розділи, а стандартні розділи ролі більше не діють. Сіра примітка [[settings.teamInviteNote]] під кнопкою повторює, як це працює.",
					),
					t3(
						"Press [[settings.teamInvite]]. The server checks: the e-mail must be valid; only the owner can add an administrator; the plan’s seat limit counts the members plus the open invitations (Free: 1 person, Standard: 50, Professional: no limit) — beyond it you get a message “Your plan allows N team members. Upgrade the plan…”; a person who is already in the firm gives “This person is already in the firm”.",
						"Drücken Sie [[settings.teamInvite]]. Der Server prüft: Die E-Mail muss gültig sein; nur der Inhaber kann einen Administrator hinzufügen; das Platzlimit des Tarifs zählt die Mitglieder plus die offenen Einladungen (Free: 1 Person, Standard: 50, Professional: unbegrenzt) — darüber erhalten Sie die Meldung „Your plan allows N team members. Upgrade the plan…“; eine Person, die schon in der Firma ist, ergibt „This person is already in the firm“.",
						"Натисніть [[settings.teamInvite]]. Сервер перевіряє: e-mail має бути дійсним; лише власник може додати адміністратора; ліміт місць тарифу враховує учасників плюс відкриті запрошення (Free: 1 людина, Standard: 50, Professional: без обмежень) — понад ліміт ви отримаєте повідомлення «Your plan allows N team members. Upgrade the plan…»; людина, що вже є у фірмі, дає «This person is already in the firm».",
					),
					t3(
						"Two outcomes are possible. If a Firmspace account with this e-mail already exists, the person is added at once and you see “[[settings.teamAdded]]”; the firm appears in their firm switcher. If there is no such account, an invitation is stored for 30 days and you see “[[settings.teamInvited]]”; it is applied automatically when a person registers with exactly this e-mail. If a mailbox is connected in [[navigation.web_mails]], a short e-mail with the way to sign in or register is also sent from it, and you see “[[settings.teamAddedMail]]” or “[[settings.teamInvitedMail]]” instead. Without a connected mailbox the CRM sends nothing, so tell the person to register (or sign in) with the address you entered.",
						"Zwei Ergebnisse sind möglich. Existiert bereits ein Firmspace-Konto mit dieser E-Mail, wird die Person sofort hinzugefügt, und Sie sehen „[[settings.teamAdded]]“; die Firma erscheint in ihrer Firmen-Auswahl. Gibt es kein solches Konto, wird eine Einladung 30 Tage gespeichert, und Sie sehen „[[settings.teamInvited]]“; sie wird automatisch angewendet, wenn sich jemand mit genau dieser E-Mail registriert. Ist in [[navigation.web_mails]] ein Postfach verbunden, wird aus diesem außerdem eine kurze E-Mail mit dem Weg zur Anmeldung oder Registrierung gesendet, und Sie sehen stattdessen „[[settings.teamAddedMail]]“ oder „[[settings.teamInvitedMail]]“. Ohne verbundenes Postfach sendet das CRM nichts; sagen Sie der Person also, dass sie sich mit der eingegebenen Adresse registrieren (oder anmelden) soll.",
						"Можливі два результати. Якщо акаунт Firmspace із цим e-mail уже існує, людину додано одразу, і ви бачите «[[settings.teamAdded]]»; фірма з’являється в її перемикачі фірм. Якщо такого акаунта немає, запрошення зберігається на 30 днів, і ви бачите «[[settings.teamInvited]]»; воно застосовується автоматично, коли хтось реєструється саме з цим e-mail. Якщо в [[navigation.web_mails]] підключено скриньку, з неї додатково надсилається короткий лист зі шляхом входу чи реєстрації, і ви бачите «[[settings.teamAddedMail]]» або «[[settings.teamInvitedMail]]». Без підключеної скриньки CRM нічого не надсилає, тож скажіть людині зареєструватися (або увійти) з адресою, яку ви ввели.",
					),
				],
			},
			{
				title: t3("Team and access tab: the list of people", "Tab Team und Zugriff: die Liste der Personen", "Вкладка команди та доступу: список людей"),
				steps: [
					t3(
						"Below the card the members of the firm are listed: the name (your own row has “[[settings.teamYou]]” after it) and the e-mail. The owner has a green chip [[settings.role_owner]]; the owner’s role can be neither changed nor removed.",
						"Unter der Karte stehen die Mitglieder der Firma: der Name (in Ihrer eigenen Zeile folgt „[[settings.teamYou]]“) und die E-Mail. Der Inhaber hat einen grünen Chip [[settings.role_owner]]; seine Rolle lässt sich weder ändern noch entfernen.",
						"Під карткою перелічено учасників фірми: ім’я (у вашому рядку далі йде «[[settings.teamYou]]») і e-mail. Власник має зелений чип [[settings.role_owner]]; його роль не можна ні змінити, ні прибрати.",
					),
					t3(
						"For all other people the row has a list of roles: choose another role and it is saved at once (no button). A red cross [[settings.teamRemove]] removes the person after a confirmation “Remove … from the firm? They will lose access to its data.” Only the owner can change or remove an administrator.",
						"Bei allen anderen Personen hat die Zeile eine Rollenliste: Wählen Sie eine andere Rolle, und sie wird sofort gespeichert (ohne Schaltfläche). Ein rotes Kreuz [[settings.teamRemove]] entfernt die Person nach der Bestätigung „Remove … from the firm? They will lose access to its data.“ Nur der Inhaber kann einen Administrator ändern oder entfernen.",
						"Для всіх інших людей у рядку є список ролей: оберіть іншу роль — і її збережено одразу (без кнопки). Червоний хрестик [[settings.teamRemove]] прибирає людину після підтвердження «Remove … from the firm? They will lose access to its data.» Лише власник може змінити чи прибрати адміністратора.",
					),
					t3(
						"For everybody except the owner and administrators, a row of tick boxes with the sections is shown under the name. It displays the access the person really has now (the role’s standard sections, or the ones you ticked). A tick or an un-tick is saved at once. The first click starts from the role’s standard sections. If you un-tick the very last section, the person really has no sections at all. A blue link [[settings.teamResetModules]] (shown as soon as the access is customised) returns the person to the role’s standard sections.",
						"Bei allen außer dem Inhaber und den Administratoren steht unter dem Namen eine Reihe von Kästchen mit den Bereichen. Sie zeigt den Zugriff, den die Person jetzt wirklich hat (die Standardbereiche der Rolle oder die von Ihnen angekreuzten). Ein Anhaken oder Abhaken wird sofort gespeichert. Der erste Klick geht von den Standardbereichen der Rolle aus. Nehmen Sie den allerletzten Bereich weg, hat die Person wirklich keinen Bereich mehr. Ein Link [[settings.teamResetModules]] (erscheint, sobald der Zugriff angepasst ist) setzt die Person auf die Standardbereiche der Rolle zurück.",
						"Для всіх, крім власника й адміністраторів, під іменем показано ряд прапорців із розділами. Він відображає доступ, який людина справді має зараз (стандартні розділи ролі або ті, що ви відмітили). Позначення чи зняття зберігається одразу. Перший клік виходить зі стандартних розділів ролі. Якщо зняти найостанніший розділ, людина справді лишається без жодного розділу. Посилання [[settings.teamResetModules]] (з’являється, щойно доступ змінено) повертає людину до стандартних розділів ролі.",
					),
					t3(
						"The list [[settings.teamPending]] shows the invitations that are still waiting (the e-mail, the role and a cross to cancel the invitation). An invitation disappears from it when the person registers.",
						"Die Liste [[settings.teamPending]] zeigt die noch wartenden Einladungen (die E-Mail, die Rolle und ein Kreuz zum Zurückziehen der Einladung). Eine Einladung verschwindet daraus, wenn sich die Person registriert.",
						"Список [[settings.teamPending]] показує запрошення, що ще чекають (e-mail, роль і хрестик для скасування запрошення). Запрошення зникає з нього, коли людина реєструється.",
					),
				],
			},
			{
				title: t3("Roles and what each one sees", "Rollen und was jede sieht", "Ролі та що бачить кожна"),
				steps: [
					t3(
						"[[settings.role_owner]] (the person who created the firm): all sections, including [[navigation.upgrade_plan]] (payments) and the team. Only the owner can pay, change the plan and assign administrators.",
						"[[settings.role_owner]] (die Person, die die Firma angelegt hat): alle Bereiche, einschließlich [[navigation.upgrade_plan]] (Zahlungen) und des Teams. Nur der Inhaber kann bezahlen, den Tarif ändern und Administratoren vergeben.",
						"[[settings.role_owner]] (людина, яка створила фірму): усі розділи, зокрема [[navigation.upgrade_plan]] (платежі) і команда. Лише власник може платити, змінювати тариф і призначати адміністраторів.",
					),
					t3(
						"[[settings.role_admin]]: all sections except the payments; can manage integrations and the team (add, change and remove people, but not other administrators).",
						"[[settings.role_admin]]: alle Bereiche außer den Zahlungen; kann Integrationen und das Team verwalten (Personen hinzufügen, ändern und entfernen, aber keine anderen Administratoren).",
						"[[settings.role_admin]]: усі розділи, крім платежів; може керувати інтеграціями та командою (додавати, змінювати й прибирати людей, але не інших адміністраторів).",
					),
					t3(
						"[[settings.role_manager]]: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_company]], [[settings.module_collab]], [[settings.module_mail]], [[settings.module_marketing]] and [[settings.module_inventory]]. Not: automation, integrations, payments, team.",
						"[[settings.role_manager]]: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_company]], [[settings.module_collab]], [[settings.module_mail]], [[settings.module_marketing]] und [[settings.module_inventory]]. Nicht: Automatisierung, Integrationen, Zahlungen, Team.",
						"[[settings.role_manager]]: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_company]], [[settings.module_collab]], [[settings.module_mail]], [[settings.module_marketing]] та [[settings.module_inventory]]. Не мають: автоматизації, інтеграцій, платежів, команди.",
					),
					t3(
						"[[settings.role_employee]]: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_collab]] and [[settings.module_mail]].",
						"[[settings.role_employee]]: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_collab]] und [[settings.module_mail]].",
						"[[settings.role_employee]]: [[settings.module_crm]], [[settings.module_tasks]], [[settings.module_collab]] та [[settings.module_mail]].",
					),
					t3(
						"[[settings.role_viewer]]: the same sections as an employee, but read-only — the person can open and read everything, while every attempt to create, change or delete is refused by the server.",
						"[[settings.role_viewer]]: dieselben Bereiche wie ein Mitarbeiter, aber nur lesend — die Person kann alles öffnen und lesen, jeder Versuch zu erstellen, zu ändern oder zu löschen wird vom Server abgelehnt.",
						"[[settings.role_viewer]]: ті самі розділи, що й у працівника, але лише для читання — людина може відкривати й читати все, а будь-яку спробу створити, змінити чи видалити сервер відхиляє.",
					),
					t3(
						"Two independent conditions decide whether a section opens: the person’s role or ticks (above) and the plan of the firm (see the section “Plans and billing”). If either is missing, the section is hidden in the menu; a direct link to a section that the plan does not include leads to [[navigation.upgrade_plan]] with an explanation, while for a section that the role does not include the server refuses the data even if the address is typed by hand.",
						"Zwei unabhängige Bedingungen entscheiden, ob sich ein Bereich öffnet: die Rolle oder die Häkchen der Person (oben) und der Tarif der Firma (siehe Abschnitt „Tarife und Abrechnung“). Fehlt eine davon, ist der Bereich im Menü ausgeblendet; ein direkter Link auf einen Bereich, den der Tarif nicht enthält, führt zu [[navigation.upgrade_plan]] mit einer Erklärung, bei einem Bereich, den die Rolle nicht enthält, verweigert der Server die Daten, auch wenn die Adresse von Hand eingegeben wird.",
						"Два незалежні умови вирішують, чи відкриється розділ: роль або позначки людини (вище) і тариф фірми (див. розділ «Тарифи та оплата»). Якщо бракує будь-якого, розділ приховано в меню; пряме посилання на розділ, якого немає в тарифі, веде до [[navigation.upgrade_plan]] з поясненням, а для розділу, якого немає в ролі, сервер відмовляє в даних, навіть якщо адресу набрано вручну.",
					),
				],
			},
		],
	},
	{
		id: "account",
		title: t3("Account and notifications", "Konto und Benachrichtigungen", "Акаунт і сповіщення"),
		intro: t3(
			"The first two tabs of [[navigation.settings]] belong to you personally, whichever firm you work in: [[settings.tabAccount]] (your profile, picture and password) and [[settings.tabNotifications]].",
			"Die ersten beiden Tabs von [[navigation.settings]] gehören Ihnen persönlich, egal in welcher Firma Sie arbeiten: [[settings.tabAccount]] (Ihr Profil, Bild und Passwort) und [[settings.tabNotifications]].",
			"Перші дві вкладки [[navigation.settings]] належать особисто вам, у якій би фірмі ви не працювали: [[settings.tabAccount]] (ваш профіль, зображення й пароль) та [[settings.tabNotifications]].",
		),
		groups: [
			{
				title: t3("Profile picture", "Profilbild", "Зображення профілю"),
				steps: [
					t3(
						"At the top of [[settings.tabAccount]] you see your round picture (or the initials of your name if you have none). A small camera button on it ([[settings.uploadPhoto]]) opens the file dialog of your device, filtered to images.",
						"Oben in [[settings.tabAccount]] sehen Sie Ihr rundes Bild (oder die Initialen Ihres Namens, wenn Sie keins haben). Eine kleine Kamera-Schaltfläche darauf ([[settings.uploadPhoto]]) öffnet den Dateidialog Ihres Geräts, gefiltert auf Bilder.",
						"Угорі [[settings.tabAccount]] ви бачите своє кругле зображення (або ініціали вашого імені, якщо його немає). Маленька кнопка з камерою на ньому ([[settings.uploadPhoto]]) відкриває файловий діалог вашого пристрою з фільтром на зображення.",
					),
					t3(
						"Choose a picture. If the file is not an image you see “[[settings.notImage]]”; if it is larger than 5 MB, “[[settings.tooBig]]”. Otherwise the picture is cropped in the centre to a square, reduced and saved immediately — there is no separate save button — and “[[settings.saved]]” appears. The new picture shows in the header and in every list where you appear.",
						"Wählen Sie ein Bild. Ist die Datei kein Bild, sehen Sie „[[settings.notImage]]“; ist sie größer als 5 MB, „[[settings.tooBig]]“. Sonst wird das Bild in der Mitte quadratisch zugeschnitten, verkleinert und sofort gespeichert — es gibt keine eigene Speichern-Schaltfläche — und „[[settings.saved]]“ erscheint. Das neue Bild zeigt sich in der Kopfzeile und in allen Listen, in denen Sie vorkommen.",
						"Оберіть зображення. Якщо файл не є зображенням, ви бачите «[[settings.notImage]]»; якщо він більший за 5 МБ — «[[settings.tooBig]]». Інакше зображення обрізається по центру до квадрата, зменшується й зберігається одразу — окремої кнопки збереження немає — і з’являється «[[settings.saved]]». Нове зображення видно в шапці та в усіх списках, де ви фігуруєте.",
					),
				],
			},
			{
				title: t3("Personal data", "Persönliche Daten", "Особисті дані"),
				steps: [
					t3(
						"The block [[settings.basicInfo]] has the fields [[settings.firstName]] and [[settings.lastName]] (both required — without them the message “[[settings.nameRequired]]” appears), [[settings.email]] (locked: it is your login and cannot be edited; the tooltip says “[[settings.emailLocked]]”), [[settings.phone]], [[settings.role]] (your job title as a free text), [[settings.department]], [[settings.postCode]], [[settings.languages]] and [[settings.timezone]] (a free text). Every field takes up to 100 characters.",
						"Der Block [[settings.basicInfo]] hat die Felder [[settings.firstName]] und [[settings.lastName]] (beide Pflicht — ohne sie erscheint „[[settings.nameRequired]]“), [[settings.email]] (gesperrt: Sie ist Ihr Login und lässt sich nicht bearbeiten; der Tooltip sagt „[[settings.emailLocked]]“), [[settings.phone]], [[settings.role]] (Ihre Berufsbezeichnung als freier Text), [[settings.department]], [[settings.postCode]], [[settings.languages]] und [[settings.timezone]] (ein freier Text). Jedes Feld nimmt bis zu 100 Zeichen.",
						"Блок [[settings.basicInfo]] має поля [[settings.firstName]] і [[settings.lastName]] (обидва обов’язкові — без них з’являється «[[settings.nameRequired]]»), [[settings.email]] (заблоковане: це ваш логін, його не можна редагувати; підказка каже «[[settings.emailLocked]]»), [[settings.phone]], [[settings.role]] (ваша посада вільним текстом), [[settings.department]], [[settings.postCode]], [[settings.languages]] та [[settings.timezone]] (вільний текст). Кожне поле приймає до 100 символів.",
					),
					t3(
						"The block [[settings.additionalInfo]] has [[settings.city]], [[settings.state]] and [[settings.country]]; the block [[settings.job]] has the field [[settings.company]]. On a desktop the blocks stand in three columns, on a phone under each other.",
						"Der Block [[settings.additionalInfo]] hat [[settings.city]], [[settings.state]] und [[settings.country]]; der Block [[settings.job]] hat das Feld [[settings.company]]. Am Desktop stehen die Blöcke in drei Spalten, am Telefon untereinander.",
						"Блок [[settings.additionalInfo]] має [[settings.city]], [[settings.state]] і [[settings.country]]; блок [[settings.job]] має поле [[settings.company]]. На комп’ютері блоки стоять у три колонки, на телефоні — один під одним.",
					),
					t3(
						"The button [[settings.save]] is not visible until you change something. Once a field differs from the saved value, it appears at the bottom; press it to save all the fields of both blocks at once. You see “[[settings.saved]]” or, if the server refused, “[[settings.error]]”.",
						"Die Schaltfläche [[settings.save]] ist erst sichtbar, wenn Sie etwas ändern. Sobald ein Feld vom gespeicherten Wert abweicht, erscheint sie unten; drücken Sie sie, um alle Felder beider Blöcke auf einmal zu speichern. Sie sehen „[[settings.saved]]“ oder, wenn der Server abgelehnt hat, „[[settings.error]]“.",
						"Кнопка [[settings.save]] невидима, доки ви нічого не змінили. Щойно якесь поле відрізняється від збереженого значення, вона з’являється внизу; натисніть її, щоб зберегти всі поля обох блоків одразу. Ви бачите «[[settings.saved]]» або, якщо сервер відмовив, «[[settings.error]]».",
					),
				],
			},
			{
				title: t3("Changing the password", "Passwort ändern", "Зміна пароля"),
				steps: [
					t3(
						"The block [[settings.changePassword]] is a separate form with its own button; it is independent of the profile fields. Enter [[settings.previousPassword]], [[settings.newPassword]] and [[settings.confirmPassword]] (up to 128 characters each), then press the button of the block.",
						"Der Block [[settings.changePassword]] ist ein eigenes Formular mit eigener Schaltfläche; er ist unabhängig von den Profilfeldern. Geben Sie [[settings.previousPassword]], [[settings.newPassword]] und [[settings.confirmPassword]] ein (je bis 128 Zeichen) und drücken Sie die Schaltfläche des Blocks.",
						"Блок [[settings.changePassword]] — окрема форма з власною кнопкою; вона не залежить від полів профілю. Введіть [[settings.previousPassword]], [[settings.newPassword]] і [[settings.confirmPassword]] (до 128 символів кожне), потім натисніть кнопку блоку.",
					),
					t3(
						"The checks run in this order and stop at the first failure: an empty field gives “[[settings.passwordFill]]”; different new passwords give “[[settings.passwordMismatch]]”; a new password shorter than 8 characters gives “[[settings.passwordWeak]]”; a wrong old password (checked by the server) gives “[[settings.passwordWrong]]”. On success you see “[[settings.passwordChanged]]” and the three fields are emptied.",
						"Die Prüfungen laufen in dieser Reihenfolge und enden beim ersten Fehler: ein leeres Feld ergibt „[[settings.passwordFill]]“; unterschiedliche neue Passwörter ergeben „[[settings.passwordMismatch]]“; ein neues Passwort mit weniger als 8 Zeichen ergibt „[[settings.passwordWeak]]“; ein falsches altes Passwort (vom Server geprüft) ergibt „[[settings.passwordWrong]]“. Bei Erfolg sehen Sie „[[settings.passwordChanged]]“, und die drei Felder werden geleert.",
						"Перевірки йдуть у такому порядку й зупиняються на першій невдалій: порожнє поле дає «[[settings.passwordFill]]»; різні нові паролі дають «[[settings.passwordMismatch]]»; новий пароль коротший за 8 символів дає «[[settings.passwordWeak]]»; хибний старий пароль (перевіряє сервер) дає «[[settings.passwordWrong]]». У разі успіху ви бачите «[[settings.passwordChanged]]», і три поля очищаються.",
					),
				],
			},
			{
				title: t3("Notifications tab", "Tab Benachrichtigungen", "Вкладка сповіщень"),
				steps: [
					t3(
						"[[settings.tabNotifications]] (heading [[settings.notifTitle]]) has three settings. The tick box [[settings.notifBrowser]] turns on system notifications of the browser. When you tick it for the first time, the browser asks for permission — allow it. Such a notification (titled “Firmspace CRM”) appears only while the CRM tab is hidden, so it does not duplicate what you already see on the screen.",
						"[[settings.tabNotifications]] (Überschrift [[settings.notifTitle]]) hat drei Einstellungen. Das Kästchen [[settings.notifBrowser]] schaltet die System-Benachrichtigungen des Browsers ein. Beim ersten Anhaken fragt der Browser nach der Erlaubnis — erlauben Sie sie. Eine solche Benachrichtigung (mit dem Titel „Firmspace CRM“) erscheint nur, solange der CRM-Tab verborgen ist, sie wiederholt also nicht, was Sie schon auf dem Bildschirm sehen.",
						"[[settings.tabNotifications]] (заголовок [[settings.notifTitle]]) має три налаштування. Прапорець [[settings.notifBrowser]] вмикає системні сповіщення браузера. Коли ви відмічаєте його вперше, браузер просить дозволу — дозвольте. Таке сповіщення (із заголовком «Firmspace CRM») з’являється лише тоді, коли вкладка CRM прихована, тож воно не дублює те, що ви вже бачите на екрані.",
					),
					t3(
						"The tick box [[settings.notifEmail]] allows e-mails. At present the e-mails cover reminders of calendar events. They are sent through the mailbox that your firm has connected in [[navigation.web_mails]], so nothing is sent while no mailbox is connected. The entry in the notification bell (see the section “Getting started”) is created in any case.",
						"Das Kästchen [[settings.notifEmail]] erlaubt E-Mails. Derzeit betreffen die E-Mails Erinnerungen an Kalendertermine. Sie werden über das Postfach gesendet, das Ihre Firma in [[navigation.web_mails]] verbunden hat; solange kein Postfach verbunden ist, wird nichts gesendet. Der Eintrag in der Benachrichtigungsglocke (siehe Abschnitt „Erste Schritte“) entsteht in jedem Fall.",
						"Прапорець [[settings.notifEmail]] дозволяє листи. Наразі листи стосуються нагадувань про події календаря. Їх надсилають через скриньку, яку ваша фірма підключила в [[navigation.web_mails]], тож поки скриньку не підключено, нічого не надсилається. Запис у дзвіночку сповіщень (див. розділ «Початок роботи») створюється в будь-якому разі.",
					),
					t3(
						"The third line is the quiet hours: a text [[settings.notifMute]] with two time fields [[settings.from]] and [[settings.to]] and a tick box [[settings.notifMute]]. When the box is ticked, no e-mail is sent between the two times; the interval may cross midnight (for example 22:00 – 07:00). The default is 10:00 – 10:00, which means no effect. The time is the time of the server, not your local time zone. Quiet hours concern e-mails only.",
						"Die dritte Zeile sind die Ruhezeiten: ein Text [[settings.notifMute]] mit zwei Zeitfeldern [[settings.from]] und [[settings.to]] und einem Kästchen [[settings.notifMute]]. Ist das Kästchen angehakt, wird zwischen den beiden Zeiten keine E-Mail gesendet; das Intervall darf über Mitternacht gehen (zum Beispiel 22:00 – 07:00). Standard ist 10:00 – 10:00, das bedeutet keine Wirkung. Die Zeit ist die Serverzeit, nicht Ihre lokale Zeitzone. Ruhezeiten betreffen nur E-Mails.",
						"Третій рядок — тихі години: текст [[settings.notifMute]] із двома полями часу [[settings.from]] і [[settings.to]] та прапорцем [[settings.notifMute]]. Коли прапорець відмічено, між двома моментами листи не надсилаються; інтервал може перетинати північ (наприклад 22:00 – 07:00). За замовчуванням 10:00 – 10:00, тобто без дії. Час — це час сервера, а не ваш місцевий часовий пояс. Тихі години стосуються лише листів.",
					),
					t3(
						"Press [[settings.notifSave]] to store the three settings; you see “[[settings.notifSaved]]” (or “[[settings.error]]”). Nothing on this tab is saved before you press it.",
						"Drücken Sie [[settings.notifSave]], um die drei Einstellungen zu speichern; Sie sehen „[[settings.notifSaved]]“ (oder „[[settings.error]]“). Nichts auf diesem Tab wird gespeichert, bevor Sie sie drücken.",
						"Натисніть [[settings.notifSave]], щоб зберегти три налаштування; ви бачите «[[settings.notifSaved]]» (або «[[settings.error]]»). Нічого на цій вкладці не зберігається, доки ви не натиснули її.",
					),
				],
			},
		],
	},
];
