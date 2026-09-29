import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const COLLAB_MAIL: DocSection[] = [
	{
		id: "web_mails",
		title: t3("Web mail: your mailbox inside the CRM", "Web-Mail: Ihr Postfach im CRM", "Web-пошта: ваша скринька всередині CRM"),
		intro: t3(
			"[[navigation.web_mails]] ([[navigation.collaboration]] → [[navigation.web_mails]]) connects the company mailbox (Gmail, Outlook, Office 365, Yahoo, iCloud or any IMAP mailbox) so that you read and write e-mails without leaving the CRM, and so that new senders become leads. The mailbox belongs to the whole company: everybody who has access to the section sees the same letters. The section is included in the Professional plan.",
			"[[navigation.web_mails]] ([[navigation.collaboration]] → [[navigation.web_mails]]) verbindet das Firmenpostfach (Gmail, Outlook, Office 365, Yahoo, iCloud oder ein beliebiges IMAP-Postfach), damit Sie E-Mails lesen und schreiben, ohne das CRM zu verlassen, und damit neue Absender zu Leads werden. Das Postfach gehört der ganzen Firma: Alle mit Zugriff auf den Bereich sehen dieselben Mails. Der Bereich ist im Tarif Professional enthalten.",
			"[[navigation.web_mails]] ([[navigation.collaboration]] → [[navigation.web_mails]]) підключає поштову скриньку компанії (Gmail, Outlook, Office 365, Yahoo, iCloud або будь-яку IMAP-скриньку), щоб ви читали й писали листи, не виходячи з CRM, а нові відправники ставали лідами. Скринька належить усій компанії: усі, хто має доступ до розділу, бачать ті самі листи. Розділ входить у тариф Professional.",
		),
		groups: [
			{
				title: t3("Connecting a mailbox", "Postfach verbinden", "Підключення скриньки"),
				steps: [
					t3(
						"While no mailbox is connected, the page shows a grid of provider tiles: Outlook, Google Mail, Yahoo, iCloud, Office 365 and IMAP (Yahoo and iCloud appear twice; both tiles do the same). Click the tile of your provider — a window with its name opens. The cross at the top right (or a click outside) closes it.",
						"Solange kein Postfach verbunden ist, zeigt die Seite ein Raster mit Anbieter-Kacheln: Outlook, Google Mail, Yahoo, iCloud, Office 365 und IMAP (Yahoo und iCloud erscheinen doppelt; beide Kacheln tun dasselbe). Klicken Sie die Kachel Ihres Anbieters an — ein Fenster mit seinem Namen öffnet sich. Das Kreuz oben rechts (oder ein Klick daneben) schließt es.",
						"Поки жодної скриньки не підключено, сторінка показує сітку плиток провайдерів: Outlook, Google Mail, Yahoo, iCloud, Office 365 та IMAP (Yahoo й iCloud показано двічі; обидві плитки роблять те саме). Клацніть плитку свого провайдера — відкривається вікно з його назвою. Хрестик угорі праворуч (або клік поза вікном) закриває його.",
					),
					t3(
						"At the top of the window a grey text explains the way for this provider. For Gmail: sign in with Google, or turn on 2-step verification in your Google account, create an app password and enter it. For Outlook and Office 365: sign in with Microsoft, or enter an app password if the account allows it. For Yahoo, iCloud and IMAP an app password is needed (for iCloud it is created at appleid.apple.com, your usual Apple ID password will not work).",
						"Oben im Fenster erklärt ein grauer Text den Weg für diesen Anbieter. Für Gmail: mit Google anmelden oder in Ihrem Google-Konto die 2-Faktor-Bestätigung einschalten, ein App-Passwort erstellen und eingeben. Für Outlook und Office 365: mit Microsoft anmelden oder ein App-Passwort eingeben, wenn das Konto es erlaubt. Für Yahoo, iCloud und IMAP wird ein App-Passwort benötigt (bei iCloud wird es auf appleid.apple.com erstellt, Ihr gewohntes Apple-ID-Passwort funktioniert nicht).",
						"Угорі вікна сірий текст пояснює шлях для цього провайдера. Для Gmail: увійдіть через Google або ввімкніть у своєму акаунті Google двоетапну перевірку, створіть пароль застосунку й введіть його. Для Outlook і Office 365: увійдіть через Microsoft або введіть пароль застосунку, якщо акаунт це дозволяє. Для Yahoo, iCloud та IMAP потрібен пароль застосунку (для iCloud його створюють на appleid.apple.com, звичайний пароль Apple ID не підійде).",
					),
					t3(
						"For Gmail, Yahoo and iCloud a green link [[collab.mailCreateAppPassword]] opens the page of the provider where you create the app password (in a new tab).",
						"Bei Gmail, Yahoo und iCloud öffnet ein grüner Link [[collab.mailCreateAppPassword]] die Seite des Anbieters, auf der Sie das App-Passwort erstellen (in einem neuen Tab).",
						"Для Gmail, Yahoo й iCloud зелене посилання [[collab.mailCreateAppPassword]] відкриває сторінку провайдера, де створюють пароль застосунку (в новій вкладці).",
					),
					t3(
						"Gmail, Outlook and Office 365, when the site has the sign-in keys of Google or Microsoft: a green button [[collab.mailSignInGoogle]] / [[collab.mailSignInMicrosoft]]. It takes you to the sign-in page of the provider in the same tab. After you agree, you return to [[navigation.web_mails]] with the message “[[collab.mailConnectedOk]]” and the new mailbox is selected. If you cancel there, the message “[[collab.mailOauthDenied]]” appears; another failure gives a red message “Sign-in failed” with the reason. The link [[collab.mailUsePassword]] under the button shows the password form instead.",
						"Gmail, Outlook und Office 365, wenn die Website die Anmeldeschlüssel von Google oder Microsoft hat: eine grüne Schaltfläche [[collab.mailSignInGoogle]] / [[collab.mailSignInMicrosoft]]. Sie führt im selben Tab zur Anmeldeseite des Anbieters. Nach Ihrer Zustimmung kehren Sie mit der Meldung „[[collab.mailConnectedOk]]“ zu [[navigation.web_mails]] zurück, und das neue Postfach ist ausgewählt. Brechen Sie dort ab, erscheint „[[collab.mailOauthDenied]]“; ein anderer Fehler ergibt eine rote Meldung „Anmeldung fehlgeschlagen“ mit dem Grund. Der Link [[collab.mailUsePassword]] unter der Schaltfläche zeigt stattdessen das Passwortformular.",
						"Gmail, Outlook і Office 365, коли на сайті є ключі входу Google чи Microsoft: зелена кнопка [[collab.mailSignInGoogle]] / [[collab.mailSignInMicrosoft]]. Вона веде на сторінку входу провайдера в тій самій вкладці. Після вашої згоди ви повертаєтесь у [[navigation.web_mails]] з повідомленням «[[collab.mailConnectedOk]]», і нову скриньку вибрано. Якщо ви там скасували, з’являється «[[collab.mailOauthDenied]]»; інша помилка дає червоне повідомлення «Вхід не вдався» з причиною. Посилання [[collab.mailUsePassword]] під кнопкою натомість показує форму з паролем.",
					),
					t3(
						"The password form has the fields [[collab.mailEmail]] and [[collab.mailAppPassword]] (both required; up to 200 characters; spaces in an app password are removed automatically, so you can paste “abcd efgh ijkl mnop”). The password is sent to the server and stored encrypted. Press [[collab.mailConnect]]: the server first checks the connection, and only if it works, the mailbox is saved. A wrong password or an unreachable server is shown in red under the form and nothing is saved.",
						"Das Passwortformular hat die Felder [[collab.mailEmail]] und [[collab.mailAppPassword]] (beide Pflicht; bis 200 Zeichen; Leerzeichen in einem App-Passwort werden automatisch entfernt, Sie können also „abcd efgh ijkl mnop“ einfügen). Das Passwort wird an den Server gesendet und verschlüsselt gespeichert. Drücken Sie [[collab.mailConnect]]: Der Server prüft zuerst die Verbindung, und nur wenn sie funktioniert, wird das Postfach gespeichert. Ein falsches Passwort oder ein nicht erreichbarer Server wird rot unter dem Formular gezeigt, und nichts wird gespeichert.",
						"Форма з паролем має поля [[collab.mailEmail]] і [[collab.mailAppPassword]] (обидва обов’язкові; до 200 символів; пробіли в паролі застосунку прибираються автоматично, тож можна вставити «abcd efgh ijkl mnop»). Пароль надсилається на сервер і зберігається зашифрованим. Натисніть [[collab.mailConnect]]: сервер спершу перевіряє з’єднання, і лише якщо воно працює, скриньку зберігають. Хибний пароль або недоступний сервер показано червоним під формою, і нічого не зберігається.",
					),
					t3(
						"For the tile IMAP the form has four more fields: [[collab.mailImapHost]] and its [[collab.mailPort]] (default 993), [[collab.mailSmtpHost]] and its [[collab.mailPort]] (default 465); the hints show imap.example.com and smtp.example.com. Yahoo, iCloud and the others use ready settings. Server addresses that point inside a private network (localhost, 10.x, 192.168.x and the like) are refused for safety.",
						"Für die Kachel IMAP hat das Formular vier weitere Felder: [[collab.mailImapHost]] und dessen [[collab.mailPort]] (Standard 993), [[collab.mailSmtpHost]] und dessen [[collab.mailPort]] (Standard 465); die Hinweise zeigen imap.example.com und smtp.example.com. Yahoo, iCloud und die anderen nutzen fertige Einstellungen. Serveradressen, die in ein privates Netz zeigen (localhost, 10.x, 192.168.x und ähnliche), werden aus Sicherheitsgründen abgelehnt.",
						"Для плитки IMAP форма має ще чотири поля: [[collab.mailImapHost]] та його [[collab.mailPort]] (за замовчуванням 993), [[collab.mailSmtpHost]] та його [[collab.mailPort]] (за замовчуванням 465); підказки показують imap.example.com і smtp.example.com. Yahoo, iCloud та інші використовують готові налаштування. Адреси серверів, що вказують у приватну мережу (localhost, 10.x, 192.168.x тощо), з міркувань безпеки відхиляються.",
					),
					t3(
						"After a successful connection by password the window closes, the new mailbox is selected and a green message with its address appears (the tail of this message, which mentions a demo, is a leftover text and can be ignored — the mailbox is real).",
						"Nach erfolgreicher Verbindung per Passwort schließt sich das Fenster, das neue Postfach ist ausgewählt und eine grüne Meldung mit seiner Adresse erscheint (der Schluss dieser Meldung, der eine Demo erwähnt, ist ein Überbleibsel und kann ignoriert werden — das Postfach ist echt).",
						"Після успішного підключення за паролем вікно закривається, нову скриньку вибрано й з’являється зелене повідомлення з її адресою (кінець цього повідомлення, що згадує демо, — залишок тексту, його можна ігнорувати: скринька справжня).",
					),
				],
			},
			{
				title: t3("The mailbox screen", "Der Postfach-Bildschirm", "Екран скриньки"),
				steps: [
					t3(
						"On the left there is the list of folders: [[collab.folder_inbox]] (with the number of unread letters on the right), [[collab.folder_starred]], [[collab.folder_snoozed]], [[collab.folder_sent]] and [[collab.folder_draft]]. A click switches the folder and clears the selection of letters. The current folder is green. On a narrow screen the list stands above the table.",
						"Links steht die Liste der Ordner: [[collab.folder_inbox]] (rechts mit der Zahl ungelesener Mails), [[collab.folder_starred]], [[collab.folder_snoozed]], [[collab.folder_sent]] und [[collab.folder_draft]]. Ein Klick wechselt den Ordner und hebt die Auswahl der Mails auf. Der aktuelle Ordner ist grün. Auf einem schmalen Bildschirm steht die Liste über der Tabelle.",
						"Ліворуч список тек: [[collab.folder_inbox]] (праворуч кількість непрочитаних листів), [[collab.folder_starred]], [[collab.folder_snoozed]], [[collab.folder_sent]] і [[collab.folder_draft]]. Клік перемикає теку й знімає виділення листів. Поточна тека зелена. На вузькому екрані список стоїть над таблицею.",
					),
					t3(
						"[[collab.folder_inbox]] shows the received letters that are not snoozed; [[collab.folder_starred]] all starred letters of any folder; [[collab.folder_snoozed]] the snoozed letters; [[collab.folder_sent]] the letters you sent (including those you sent from the CRM); [[collab.folder_draft]] the drafts that are stored in the CRM.",
						"[[collab.folder_inbox]] zeigt die empfangenen Mails, die nicht zurückgestellt sind; [[collab.folder_starred]] alle markierten Mails aus jedem Ordner; [[collab.folder_snoozed]] die zurückgestellten Mails; [[collab.folder_sent]] die von Ihnen gesendeten Mails (auch die aus dem CRM gesendeten); [[collab.folder_draft]] die im CRM gespeicherten Entwürfe.",
						"[[collab.folder_inbox]] показує отримані листи, які не відкладені; [[collab.folder_starred]] — усі листи з зіркою з будь-якої теки; [[collab.folder_snoozed]] — відкладені листи; [[collab.folder_sent]] — листи, які ви надіслали (зокрема з CRM); [[collab.folder_draft]] — чернетки, що зберігаються в CRM.",
					),
					t3(
						"Above the table there is a line “[[collab.mailAccount]]:” with the address of the mailbox and the provider in brackets. When several mailboxes are connected, it becomes a drop-down where you choose the one to work with. Next to it: the circular arrows ([[collab.mailRefresh]]) check for new letters at once (they turn while it works; a failure is shown in a red message), the link [[collab.mailAddAccount]] returns to the provider tiles (the link “← [[collab.back]]” above them brings you back), and the link [[collab.mailDisconnect]] with a cross.",
						"Über der Tabelle steht eine Zeile „[[collab.mailAccount]]:“ mit der Adresse des Postfachs und dem Anbieter in Klammern. Sind mehrere Postfächer verbunden, wird daraus eine Auswahlliste, in der Sie das Postfach wählen. Daneben: die kreisförmigen Pfeile ([[collab.mailRefresh]]) prüfen sofort auf neue Mails (sie drehen sich währenddessen; ein Fehler wird in einer roten Meldung gezeigt), der Link [[collab.mailAddAccount]] führt zurück zu den Anbieter-Kacheln (der Link „← [[collab.back]]“ über ihnen bringt Sie zurück) und der Link [[collab.mailDisconnect]] mit Kreuz.",
						"Над таблицею є рядок «[[collab.mailAccount]]:» з адресою скриньки та провайдером у дужках. Коли підключено кілька скриньок, це стає випадним списком, де обирають ту, з якою працювати. Поруч: кругові стрілки ([[collab.mailRefresh]]) одразу перевіряють нові листи (крутяться, поки працюють; збій показано червоним повідомленням), посилання [[collab.mailAddAccount]] повертає до плиток провайдерів (посилання «← [[collab.back]]» над ними повертає назад) і посилання [[collab.mailDisconnect]] з хрестиком.",
					),
					t3(
						"[[collab.mailDisconnect]] asks for confirmation: the question names the address and says that the letters will be removed from the CRM while on the mail server they stay. After the confirmation the mailbox and its letters disappear from the CRM; if it was the last one, the provider tiles are shown again.",
						"[[collab.mailDisconnect]] verlangt eine Bestätigung: Die Frage nennt die Adresse und sagt, dass die Mails aus dem CRM entfernt werden, auf dem Mailserver aber bleiben. Nach der Bestätigung verschwinden das Postfach und seine Mails aus dem CRM; war es das letzte, werden wieder die Anbieter-Kacheln gezeigt.",
						"[[collab.mailDisconnect]] просить підтвердження: у запитанні названо адресу й сказано, що листи буде видалено з CRM, а на поштовому сервері вони лишаться. Після підтвердження скринька та її листи зникають із CRM; якщо це була остання, знову показуються плитки провайдерів.",
					),
					t3(
						"When the server cannot load the mailbox (a changed password, a revoked consent), a red frame appears above the search with the text “Could not load the mailbox” and the reason. Fix it by disconnecting and connecting the mailbox again.",
						"Kann der Server das Postfach nicht laden (geändertes Passwort, widerrufene Zustimmung), erscheint über der Suche ein roter Rahmen mit dem Text „Postfach konnte nicht geladen werden“ und dem Grund. Beheben Sie es, indem Sie das Postfach trennen und neu verbinden.",
						"Коли сервер не може завантажити скриньку (змінений пароль, відкликана згода), над пошуком з’являється червона рамка з текстом «Не вдалося завантажити скриньку» і причиною. Виправте це, відключивши скриньку й підключивши її знову.",
					),
					t3(
						"New letters are fetched automatically once a minute while the page is open, and at once when you press the arrows. Each check takes the latest 30 letters of the folders Inbox and Sent (for Gmail and Outlook) or the latest 40 (for other IMAP mailboxes); the table shows up to the latest 300 letters. Letters that were already loaded are never overwritten: read marks, stars and snoozing are kept only in the CRM, they are not sent back to the mail server.",
						"Neue Mails werden automatisch einmal pro Minute geholt, solange die Seite offen ist, und sofort, wenn Sie die Pfeile drücken. Jede Prüfung holt die letzten 30 Mails der Ordner Posteingang und Gesendet (bei Gmail und Outlook) oder die letzten 40 (bei anderen IMAP-Postfächern); die Tabelle zeigt bis zu den letzten 300 Mails. Bereits geladene Mails werden nie überschrieben: Gelesen-Markierungen, Sterne und Zurückstellen bleiben nur im CRM, sie gehen nicht zurück an den Mailserver.",
						"Нові листи підтягуються автоматично раз на хвилину, поки сторінка відкрита, і одразу, коли натиснути стрілки. Кожна перевірка бере останні 30 листів тек Вхідні та Надіслані (для Gmail і Outlook) або останні 40 (для інших IMAP-скриньок); таблиця показує до останніх 300 листів. Уже завантажені листи ніколи не перезаписуються: позначки прочитаного, зірки й відкладення зберігаються лише в CRM, назад на поштовий сервер вони не йдуть.",
					),
					t3(
						"The search field “[[collab.filterSearchMail]]” looks (after a short pause of 0.3 s) in the subject, the sender, the recipient and the text of the letters of the selected mailbox; up to 100 characters.",
						"Das Suchfeld „[[collab.filterSearchMail]]“ sucht (nach kurzer Pause von 0,3 s) im Betreff, im Absender, im Empfänger und im Text der Mails des gewählten Postfachs; bis 100 Zeichen.",
						"Поле пошуку «[[collab.filterSearchMail]]» шукає (після короткої паузи 0,3 с) у темі, відправнику, одержувачі й тексті листів вибраної скриньки; до 100 символів.",
					),
					t3(
						"The table has three columns: a check box, [[collab.mailName]] and [[collab.mailDate]]. In the column [[collab.mailName]] there are a star and the line “sender — subject” (in the folders Sent and Draft the recipient instead of the sender; a letter without a subject shows “[[collab.noSubject]]”). Unread letters are white and bold, read letters grey. When there is nothing to show, the table says “[[collab.mailEmpty]]”, and while the mailbox is loading — “[[collab.mailSyncing]]”.",
						"Die Tabelle hat drei Spalten: ein Kontrollkästchen, [[collab.mailName]] und [[collab.mailDate]]. In der Spalte [[collab.mailName]] stehen ein Stern und die Zeile „Absender — Betreff“ (in den Ordnern Gesendet und Entwurf statt des Absenders der Empfänger; eine Mail ohne Betreff zeigt „[[collab.noSubject]]“). Ungelesene Mails sind weiß und fett, gelesene grau. Gibt es nichts zu zeigen, steht in der Tabelle „[[collab.mailEmpty]]“, und beim Laden des Postfachs — „[[collab.mailSyncing]]“.",
						"Таблиця має три колонки: прапорець, [[collab.mailName]] і [[collab.mailDate]]. У колонці [[collab.mailName]] є зірка та рядок «відправник — тема» (у теках Надіслані й Чернетки замість відправника — одержувач; лист без теми показує «[[collab.noSubject]]»). Непрочитані листи білі й жирні, прочитані сірі. Коли показувати нічого, таблиця каже «[[collab.mailEmpty]]», а під час завантаження скриньки — «[[collab.mailSyncing]]».",
					),
				],
			},
			{
				title: t3("Reading, writing and organising letters", "Mails lesen, schreiben und ordnen", "Читання, написання й упорядкування листів"),
				steps: [
					t3(
						"Click the line of a letter: a window opens with the subject, the line “sender → recipient · date and time” and the text (plain text, line breaks are kept). The letter is marked as read at once (the unread number of the Inbox goes down). The cross closes the window. A link with a spark, [[ai.analyzeMail]], is next to the cross: it opens [[ai.title]] and asks it whether the letter is an enquiry, a question or something else, with priority, a short summary and a suggestion to create a lead or a task. It is shown only when the assistant is switched on for your plan and your role may search mail.",
						"Klicken Sie auf die Zeile einer Mail: Ein Fenster öffnet sich mit dem Betreff, der Zeile „Absender → Empfänger · Datum und Uhrzeit“ und dem Text (Klartext, Zeilenumbrüche bleiben erhalten). Die Mail wird sofort als gelesen markiert (die Zahl ungelesener im Posteingang sinkt). Das Kreuz schließt das Fenster. Neben dem Kreuz steht ein Link mit Funke, [[ai.analyzeMail]]: Er öffnet [[ai.title]] und fragt, ob die Mail eine Anfrage, eine Frage oder etwas anderes ist, mit Priorität, kurzer Zusammenfassung und dem Vorschlag, einen Lead oder eine Aufgabe anzulegen. Er erscheint nur, wenn der Assistent für Ihren Tarif eingeschaltet ist und Ihre Rolle Mails durchsuchen darf.",
						"Клацніть рядок листа: відкривається вікно з темою, рядком «відправник → одержувач · дата й час» і текстом (звичайний текст, розриви рядків зберігаються). Лист одразу позначається прочитаним (число непрочитаних у Вхідних зменшується). Хрестик закриває вікно. Поруч із хрестиком є посилання з іскрою, [[ai.analyzeMail]]: воно відкриває [[ai.title]] і питає, чи лист — запит, питання чи щось інше, з пріоритетом, коротким підсумком і пропозицією створити лід або завдання. Воно показується лише коли асистент увімкнено для вашого тарифу й ваша роль може шукати пошту.",
					),
					t3(
						"The star at the left of a row ([[collab.markStar]]) toggles the star of this letter at once: yellow when set. The starred letters are collected in the folder [[collab.folder_starred]].",
						"Der Stern links in einer Zeile ([[collab.markStar]]) schaltet den Stern dieser Mail sofort um: gelb, wenn gesetzt. Die markierten Mails werden im Ordner [[collab.folder_starred]] gesammelt.",
						"Зірка ліворуч у рядку ([[collab.markStar]]) одразу перемикає зірку цього листа: жовта, коли встановлена. Листи із зірками збираються в теці [[collab.folder_starred]].",
					),
					t3(
						"The check box in a row selects letters; the check box in the header ([[collab.selectAll]]) selects all letters shown. As soon as at least one is selected, three actions appear at the left of the button [[collab.newEmail]]: [[collab.markStar]] (sets the star on all selected), [[collab.snooze]] (moves the selected letters to [[collab.folder_snoozed]], they disappear from the Inbox) — inside the folder [[collab.folder_snoozed]] the same button reads [[collab.unsnooze]] and returns them to the Inbox — and the red [[collab.delete]] with the number of letters.",
						"Das Kontrollkästchen in einer Zeile wählt Mails aus; das Kontrollkästchen in der Kopfzeile ([[collab.selectAll]]) wählt alle angezeigten Mails aus. Sobald mindestens eine ausgewählt ist, erscheinen links von der Schaltfläche [[collab.newEmail]] drei Aktionen: [[collab.markStar]] (setzt den Stern bei allen ausgewählten), [[collab.snooze]] (verschiebt die ausgewählten Mails nach [[collab.folder_snoozed]], sie verschwinden aus dem Posteingang) — im Ordner [[collab.folder_snoozed]] heißt dieselbe Schaltfläche [[collab.unsnooze]] und bringt sie in den Posteingang zurück — und das rote [[collab.delete]] mit der Zahl der Mails.",
						"Прапорець у рядку виділяє листи; прапорець у заголовку ([[collab.selectAll]]) виділяє всі показані листи. Щойно виділено хоча б один, ліворуч від кнопки [[collab.newEmail]] з’являються три дії: [[collab.markStar]] (ставить зірку всім виділеним), [[collab.snooze]] (переносить виділені листи в [[collab.folder_snoozed]], вони зникають із Вхідних) — у теці [[collab.folder_snoozed]] та сама кнопка називається [[collab.unsnooze]] і повертає їх у Вхідні — і червоне [[collab.delete]] з кількістю листів.",
					),
					t3(
						"[[collab.delete]] asks “Delete N e-mails?” first. After the confirmation the letters disappear from the CRM only; on the mail server they stay. The bulk star can only set stars: to remove a star, click the star of the row.",
						"[[collab.delete]] fragt zuerst „N E-Mails löschen?“. Nach der Bestätigung verschwinden die Mails nur aus dem CRM; auf dem Mailserver bleiben sie. Der Sammel-Stern kann nur Sterne setzen: Zum Entfernen eines Sterns klicken Sie auf den Stern der Zeile.",
						"[[collab.delete]] спершу питає «Видалити N листів?». Після підтвердження листи зникають лише з CRM; на поштовому сервері вони лишаються. Масова зірка може лише ставити зірки: щоб зняти зірку, клацніть зірку в рядку.",
					),
					t3(
						"The green button [[collab.newEmail]] opens the window “[[collab.newEmail]]” with three fields: [[collab.mailTo]] (up to 300 characters; several addresses are separated by a comma or a semicolon, at most 20), [[collab.mailSubject]] (up to 200) and “[[collab.mailBody]]” (up to 5000 characters, plain text, no attachments). Below: [[collab.cancel]], [[collab.saveDraft]] and [[collab.send]] (Enter in a field does not send).",
						"Die grüne Schaltfläche [[collab.newEmail]] öffnet das Fenster „[[collab.newEmail]]“ mit drei Feldern: [[collab.mailTo]] (bis 300 Zeichen; mehrere Adressen werden durch Komma oder Semikolon getrennt, höchstens 20), [[collab.mailSubject]] (bis 200) und „[[collab.mailBody]]“ (bis 5000 Zeichen, Klartext, keine Anhänge). Unten: [[collab.cancel]], [[collab.saveDraft]] und [[collab.send]].",
						"Зелена кнопка [[collab.newEmail]] відкриває вікно «[[collab.newEmail]]» з трьома полями: [[collab.mailTo]] (до 300 символів; кілька адрес розділяють комою або крапкою з комою, щонайбільше 20), [[collab.mailSubject]] (до 200) і «[[collab.mailBody]]» (до 5000 символів, звичайний текст, без вкладень). Унизу: [[collab.cancel]], [[collab.saveDraft]] і [[collab.send]].",
					),
					t3(
						"[[collab.send]] checks the address (if it is wrong: “[[collab.mailToInvalid]]”), sends the letter from the selected mailbox (through the API of Google/Microsoft or through SMTP), shows “[[collab.mailSent]]”, closes the window and opens the folder [[collab.folder_sent]]. When the sending fails, the message “[[collab.mailSendFailed]]” (or the reason) appears and the window stays open with your text.",
						"[[collab.send]] prüft die Adresse (ist sie falsch: „[[collab.mailToInvalid]]“), sendet die Mail aus dem gewählten Postfach (über die API von Google/Microsoft oder über SMTP), zeigt „[[collab.mailSent]]“, schließt das Fenster und öffnet den Ordner [[collab.folder_sent]]. Scheitert das Senden, erscheint die Meldung „[[collab.mailSendFailed]]“ (oder der Grund), und das Fenster bleibt mit Ihrem Text offen.",
						"[[collab.send]] перевіряє адресу (якщо хибна: «[[collab.mailToInvalid]]»), надсилає лист із вибраної скриньки (через API Google/Microsoft або через SMTP), показує «[[collab.mailSent]]», закриває вікно й відкриває теку [[collab.folder_sent]]. Якщо надсилання не вдалося, з’являється повідомлення «[[collab.mailSendFailed]]» (або причина), а вікно лишається з вашим текстом.",
					),
					t3(
						"[[collab.saveDraft]] stores the letter as a draft in the CRM without sending it (the address is not checked), shows “[[collab.mailDraftSaved]]” and opens the folder [[collab.folder_draft]]. A click on a draft opens the same window with the saved fields; if you send it, the draft is removed, if you save it again, it is updated (no second copy is created). [[collab.cancel]] closes the window without saving.",
						"[[collab.saveDraft]] legt die Mail als Entwurf im CRM ab, ohne sie zu senden (die Adresse wird nicht geprüft), zeigt „[[collab.mailDraftSaved]]“ und öffnet den Ordner [[collab.folder_draft]]. Ein Klick auf einen Entwurf öffnet dasselbe Fenster mit den gespeicherten Feldern; senden Sie ihn, wird der Entwurf entfernt, speichern Sie ihn erneut, wird er aktualisiert (es entsteht keine zweite Kopie). [[collab.cancel]] schließt das Fenster ohne Speichern.",
						"[[collab.saveDraft]] зберігає лист як чернетку в CRM, не надсилаючи його (адресу не перевіряють), показує «[[collab.mailDraftSaved]]» і відкриває теку [[collab.folder_draft]]. Клік по чернетці відкриває те саме вікно зі збереженими полями; якщо надіслати її, чернетку видаляють, якщо зберегти знову — оновлюють (другої копії не створюється). [[collab.cancel]] закриває вікно без збереження.",
					),
				],
			},
			{
				title: t3("Leads from incoming mail", "Leads aus eingehender Post", "Ліди з вхідної пошти"),
				steps: [
					t3(
						"The check box [[collab.mailAutoLeads]] in the line above the table (it is on by default; a hint under the mouse explains it) makes the CRM turn new senders into leads. The setting belongs to the selected mailbox and is saved at once; if saving fails, the box returns to its old state and a red message appears.",
						"Das Kontrollkästchen [[collab.mailAutoLeads]] in der Zeile über der Tabelle (standardmäßig eingeschaltet; ein Hinweis unter der Maus erklärt es) lässt das CRM neue Absender zu Leads machen. Die Einstellung gehört zum gewählten Postfach und wird sofort gespeichert; scheitert das Speichern, springt das Kästchen zurück und eine rote Meldung erscheint.",
						"Прапорець [[collab.mailAutoLeads]] у рядку над таблицею (за замовчуванням увімкнено; підказка під мишею пояснює його) змушує CRM перетворювати нових відправників на ліди. Налаштування належить вибраній скриньці й зберігається одразу; якщо зберегти не вдалося, прапорець повертається й з’являється червоне повідомлення.",
					),
					t3(
						"How it works: for each new letter from a person who is not yet in [[navigation.contacts]], the CRM creates a contact (source “email”) and a card in the first column of the deal board of [[navigation.crm]] (the title of the card is the subject of the letter). If the sender is already a contact, the letter is just added to the activity of that contact. One sender gives one lead per check.",
						"So funktioniert es: Für jede neue Mail von einer Person, die noch nicht in [[navigation.contacts]] ist, legt das CRM einen Kontakt an (Quelle „email“) und eine Karte in der ersten Spalte der Deal-Tafel von [[navigation.crm]] (der Titel der Karte ist der Betreff der Mail). Ist der Absender schon ein Kontakt, wird die Mail nur zur Aktivität dieses Kontakts hinzugefügt. Ein Absender ergibt pro Prüfung einen Lead.",
						"Як це працює: для кожного нового листа від людини, якої ще немає в [[navigation.contacts]], CRM створює контакт (джерело «email») і картку в першій колонці дошки угод [[navigation.crm]] (назва картки — тема листа). Якщо відправник уже є контактом, лист просто додається до активності цього контакту. Один відправник дає один лід за перевірку.",
					),
					t3(
						"Not counted as leads: newsletters and automatic replies (letters with unsubscribe headers or marked as bulk), addresses of robots (no-reply, notifications, mailer-daemon and the like), letters from the mailbox itself, and old letters — the first check after the connection only remembers the moment, so that your old correspondence does not become hundreds of leads. If a card or a contact appears by mistake, delete it by hand.",
						"Nicht als Leads gezählt werden: Newsletter und automatische Antworten (Mails mit Abmelde-Kopfzeilen oder als Massenmail markiert), Adressen von Robotern (no-reply, notifications, mailer-daemon und ähnliche), Mails vom Postfach selbst und alte Mails — die erste Prüfung nach der Verbindung merkt sich nur den Zeitpunkt, damit aus Ihrer alten Korrespondenz nicht Hunderte Leads werden. Entsteht versehentlich eine Karte oder ein Kontakt, löschen Sie ihn von Hand.",
						"Не вважаються лідами: розсилки й автовідповіді (листи із заголовками відписки чи позначені як масові), адреси роботів (no-reply, notifications, mailer-daemon тощо), листи від самої скриньки та старі листи — перша перевірка після підключення лише запам’ятовує момент, щоб ваше старе листування не стало сотнями лідів. Якщо картка чи контакт з’явилися помилково, видаліть їх вручну.",
					),
					t3(
						"After a check that created leads, a green message “New leads from e-mail: N” appears. The event also starts the automation trigger “new lead” (see [[navigation.automation]]) and creates a notification in the bell; with the check box on you also get a bell notification for each new incoming letter (at most five at once, then one summary).",
						"Nach einer Prüfung, die Leads angelegt hat, erscheint eine grüne Meldung „Neue Leads aus E-Mails: N“. Das Ereignis startet außerdem den Automatisierungs-Auslöser „neuer Lead“ (siehe [[navigation.automation]]) und erzeugt eine Benachrichtigung in der Glocke; bei eingeschaltetem Kontrollkästchen erhalten Sie außerdem für jede neue eingehende Mail eine Glocken-Benachrichtigung (höchstens fünf auf einmal, danach eine Sammelmeldung).",
						"Після перевірки, що створила ліди, з’являється зелене повідомлення «Нові ліди з пошти: N». Подія також запускає тригер автоматизації «новий лід» (див. [[navigation.automation]]) і створює сповіщення в дзвіночку; з увімкненим прапорцем ви також отримуєте сповіщення в дзвіночку про кожен новий вхідний лист (щонайбільше п’ять одразу, далі одне зведене).",
					),
					t3(
						"The same connected mailbox is used by the CRM to send e-mails on its own: reminders of the calendar to people who switched on e-mail notifications, and invoices and quotes that you send from [[navigation.inventory_management]]. Without a connected mailbox these e-mails are not sent.",
						"Dasselbe verbundene Postfach nutzt das CRM, um selbst E-Mails zu senden: Erinnerungen des Kalenders an Personen, die E-Mail-Benachrichtigungen eingeschaltet haben, sowie Rechnungen und Angebote, die Sie aus [[navigation.inventory_management]] senden. Ohne verbundenes Postfach werden diese E-Mails nicht versendet.",
						"Ту саму підключену скриньку CRM використовує, щоб самостійно надсилати листи: нагадування календаря людям, які ввімкнули e-mail-сповіщення, а також рахунки й пропозиції, які ви надсилаєте з [[navigation.inventory_management]]. Без підключеної скриньки ці листи не надсилаються.",
					),
				],
			},
		],
	},
];
