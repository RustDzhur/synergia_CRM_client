import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Firmspace AI: помощник в шапке (Ctrl/⌘ K) и кнопки ИИ в других разделах.
export const AI: DocSection[] = [
	{
		id: "ai",
		title: t3("Firmspace AI: the assistant", "Firmspace KI: der Assistent", "Firmspace AI: помічник"),
		intro: t3(
			"Firmspace AI is a chat assistant that looks things up in your CRM (customers, deals, tasks, employees, e-mails, uploaded PDF files) and prepares actions. It never changes anything by itself: every change is shown as a card that you must confirm. The assistant is part of the Professional plan; in other plans the button is not shown. It also needs an AI key on the server; if the site administrator has not added one, the assistant says so and the input stays disabled.",
			"Firmspace KI ist ein Chat-Assistent, der in Ihrem CRM nachschlägt (Kunden, Deals, Aufgaben, Mitarbeiter, E-Mails, hochgeladene PDF-Dateien) und Aktionen vorbereitet. Er ändert nie selbst etwas: Jede Änderung wird als Karte gezeigt, die Sie bestätigen müssen. Der Assistent gehört zum Tarif Professional; in anderen Tarifen wird die Schaltfläche nicht angezeigt. Er benötigt außerdem einen KI-Schlüssel auf dem Server; hat der Seitenadministrator keinen hinterlegt, sagt der Assistent das, und die Eingabe bleibt gesperrt.",
			"Firmspace AI — це чат-помічник, який шукає інформацію у вашій CRM (клієнти, угоди, завдання, співробітники, листи, завантажені PDF-файли) і готує дії. Він ніколи нічого не змінює сам: кожна зміна показується карткою, яку ви маєте підтвердити. Помічник входить до тарифу Professional; в інших тарифах кнопки немає. Йому також потрібен ключ ШІ на сервері; якщо адміністратор сайту його не додав, помічник про це скаже, а поле введення лишиться заблокованим.",
		),
		groups: [
			{
				title: t3("Opening and closing", "Öffnen und Schließen", "Відкриття й закриття"),
				steps: [
					t3(
						"Click the button with the sparkles icon in the header (its tooltip reads “Firmspace AI (Ctrl/⌘ K)”) or press Ctrl+K (⌘+K on Mac) on the keyboard. The same shortcut closes the window again.",
						"Klicken Sie im Header auf die Schaltfläche mit dem Funkelsymbol (Tooltip „Firmspace AI (Ctrl/⌘ K)“) oder drücken Sie Strg+K (⌘+K auf dem Mac). Dasselbe Tastenkürzel schließt das Fenster wieder.",
						"Натисніть кнопку зі значком іскор у шапці (підказка «Firmspace AI (Ctrl/⌘ K)») або клавіші Ctrl+K (⌘+K на Mac). Та сама комбінація закриває вікно.",
					),
					t3(
						"The assistant opens as a window at the top of the screen (up to 720 px wide). It closes with Esc, with a click outside the window or with the cross ([[ai.close]]) in the header.",
						"Der Assistent öffnet sich als Fenster am oberen Bildschirmrand (bis 720 px breit). Er schließt sich mit Esc, mit einem Klick außerhalb des Fensters oder mit dem Kreuz ([[ai.close]]) im Kopf.",
						"Помічник відкривається вікном угорі екрана (шириною до 720 px). Він закривається клавішею Esc, кліком поза вікном або хрестиком ([[ai.close]]) у шапці.",
					),
					t3(
						"The window header shows the title [[ai.title]], a counter with the number of requests left today (hidden on a phone), the button [[ai.newChat]] and the cross. [[ai.newChat]] is inactive while the chat is empty; pressing it clears the conversation.",
						"Der Fensterkopf zeigt den Titel [[ai.title]], einen Zähler mit den heute verbleibenden Anfragen (auf dem Smartphone ausgeblendet), die Schaltfläche [[ai.newChat]] und das Kreuz. [[ai.newChat]] ist inaktiv, solange der Chat leer ist; ein Klick leert die Unterhaltung.",
						"У шапці вікна — заголовок [[ai.title]], лічильник запитів, що лишилися сьогодні (на телефоні прихований), кнопка [[ai.newChat]] і хрестик. [[ai.newChat]] неактивна, поки чат порожній; натискання очищує розмову.",
					),
					t3(
						"The daily quota depends on the plan and is shared between the chat, the receipt scanner and the finance analysis in [[navigation.inventory_management]] and the AI action of [[navigation.automation]]. When it is used up, the assistant answers with an error that the daily limit of the plan is used up and resets tomorrow.",
						"Das Tageskontingent hängt vom Tarif ab und wird vom Chat, dem Belegscanner, der Finanzanalyse in [[navigation.inventory_management]] und der KI-Aktion in [[navigation.automation]] gemeinsam genutzt. Ist es aufgebraucht, antwortet der Assistent mit einer Fehlermeldung: Das Tageslimit des Tarifs ist verbraucht und wird morgen zurückgesetzt.",
						"Добова квота залежить від тарифу й спільна для чату, сканера чеків, аналізу фінансів у [[navigation.inventory_management]] та дії ШІ в [[navigation.automation]]. Коли її вичерпано, помічник відповідає помилкою: добовий ліміт тарифу вичерпано, він оновиться завтра.",
					),
				],
			},
			{
				title: t3("The empty window: hints and recent questions", "Das leere Fenster: Vorschläge und letzte Fragen", "Порожнє вікно: підказки й недавні запити"),
				steps: [
					t3(
						"An empty chat shows the introduction: “[[ai.intro]]”. If your role is read-only (Viewer), there is also the note “[[ai.readOnly]]”.",
						"Ein leerer Chat zeigt die Einleitung: „[[ai.intro]]“. Ist Ihre Rolle nur lesend (Betrachter), erscheint zusätzlich der Hinweis „[[ai.readOnly]]“.",
						"Порожній чат показує вступ: «[[ai.intro]]». Якщо ваша роль лише для читання (Глядач), з’являється ще й примітка «[[ai.readOnly]]».",
					),
					t3(
						"Under the introduction there are up to seven suggestion buttons; a button appears only if you have access to the data it needs. Five of them send the question at once: “[[ai.s_stale]]”, “[[ai.s_today]]”, “[[ai.s_overdue]]”, “[[ai.s_reply]]” and “[[ai.s_employees]]”. Two only fill the input and wait for you to finish the sentence: “[[ai.s_summary]]” (type the customer name) and “[[ai.s_task]]” (type the task).",
						"Unter der Einleitung stehen bis zu sieben Vorschlagsschaltflächen; eine Schaltfläche erscheint nur, wenn Sie Zugriff auf die benötigten Daten haben. Fünf davon senden die Frage sofort: „[[ai.s_stale]]“, „[[ai.s_today]]“, „[[ai.s_overdue]]“, „[[ai.s_reply]]“ und „[[ai.s_employees]]“. Zwei füllen nur das Eingabefeld und warten, dass Sie den Satz beenden: „[[ai.s_summary]]“ (Kundenname eintippen) und „[[ai.s_task]]“ (die Aufgabe eintippen).",
						"Під вступом — до семи кнопок-підказок; кнопка з’являється лише за наявності доступу до потрібних даних. П’ять із них одразу надсилають запит: «[[ai.s_stale]]», «[[ai.s_today]]», «[[ai.s_overdue]]», «[[ai.s_reply]]» і «[[ai.s_employees]]». Дві лише заповнюють поле й чекають, поки ви закінчите речення: «[[ai.s_summary]]» (введіть ім’я клієнта) і «[[ai.s_task]]» (введіть завдання).",
					),
					t3(
						"Below the suggestions the block [[ai.recent]] lists up to four of your latest questions (kept in this browser). A click puts the question into the input, marked with ↺, so you can send it again or change it.",
						"Unter den Vorschlägen listet der Block [[ai.recent]] bis zu vier Ihrer letzten Fragen (in diesem Browser gespeichert). Ein Klick setzt die Frage in das Eingabefeld, mit ↺ markiert, damit Sie sie erneut senden oder ändern können.",
						"Під підказками блок [[ai.recent]] показує до чотирьох ваших останніх запитів (зберігаються в цьому браузері). Клік вставляє запит у поле, позначений ↺, щоб надіслати знову або змінити.",
					),
				],
			},
			{
				title: t3("Asking a question", "Eine Frage stellen", "Запит до помічника"),
				steps: [
					t3(
						"Type in the input at the bottom (up to 2000 characters, the placeholder says “[[ai.placeholder]]”). Enter sends the message; Shift+Enter starts a new line. The button [[ai.ask]] does the same and is inactive while the field is empty or the assistant is working.",
						"Tippen Sie in das Eingabefeld unten (bis 2000 Zeichen, der Platzhalter lautet „[[ai.placeholder]]“). Enter sendet die Nachricht; Umschalt+Enter beginnt eine neue Zeile. Die Schaltfläche [[ai.ask]] tut dasselbe und ist inaktiv, solange das Feld leer ist oder der Assistent arbeitet.",
						"Введіть текст у поле внизу (до 2000 символів, підказка «[[ai.placeholder]]»). Enter надсилає повідомлення; Shift+Enter — новий рядок. Кнопка [[ai.ask]] робить те саме й неактивна, поки поле порожнє або помічник працює.",
					),
					t3(
						"Your message appears as a bubble on the right. While the assistant works you see “[[ai.thinking]]”. Its answer appears as a bubble on the left: first small “step” chips show what it looked at (for example “[[ai.step_search_contacts]]”, “[[ai.step_list_tasks]]”, “[[ai.step_search_mail]]”, “[[ai.step_read_document]]”), then the text of the answer with lists and bold highlights. An error is shown in red.",
						"Ihre Nachricht erscheint als Blase rechts. Während der Assistent arbeitet, sehen Sie „[[ai.thinking]]“. Seine Antwort erscheint als Blase links: zuerst kleine „Schritt“-Chips, was er angesehen hat (z. B. „[[ai.step_search_contacts]]“, „[[ai.step_list_tasks]]“, „[[ai.step_search_mail]]“, „[[ai.step_read_document]]“), dann der Antworttext mit Listen und Hervorhebungen. Ein Fehler wird rot angezeigt.",
						"Ваше повідомлення з’являється бульбашкою праворуч. Поки помічник працює, ви бачите «[[ai.thinking]]». Його відповідь — бульбашка ліворуч: спершу маленькі чипи «кроків» із тим, що він переглянув (наприклад, «[[ai.step_search_contacts]]», «[[ai.step_list_tasks]]», «[[ai.step_search_mail]]», «[[ai.step_read_document]]»), потім текст відповіді зі списками й виділеннями. Помилка показується червоним.",
					),
					t3(
						"The assistant can read: contacts, companies, deals and their stages and history, tasks, employees with their open and overdue tasks, e-mails and correspondence with one address, uploaded PDF files in [[navigation.online_documents]]. It only reads what your role and your plan allow: for example without access to [[navigation.web_mails]] it cannot search e-mails. A note under the input says: “[[ai.disclaimer]]”.",
						"Der Assistent kann lesen: Kontakte, Firmen, Deals samt Phasen und Historie, Aufgaben, Mitarbeiter mit ihren offenen und überfälligen Aufgaben, E-Mails und den Schriftverkehr mit einer Adresse sowie hochgeladene PDF-Dateien in [[navigation.online_documents]]. Er liest nur, was Ihre Rolle und Ihr Tarif erlauben: Ohne Zugriff auf [[navigation.web_mails]] kann er zum Beispiel keine E-Mails durchsuchen. Ein Hinweis unter dem Feld lautet: „[[ai.disclaimer]]“.",
						"Помічник може читати: контакти, компанії, угоди з їхніми етапами й історією, завдання, співробітників з їхніми відкритими й простроченими завданнями, листи та листування з однією адресою, завантажені PDF-файли в [[navigation.online_documents]]. Він читає лише те, що дозволяють ваша роль і тариф: наприклад, без доступу до [[navigation.web_mails]] він не може шукати листи. Примітка під полем каже: «[[ai.disclaimer]]».",
					),
				],
			},
			{
				title: t3("Action cards: confirm or cancel", "Aktionskarten: bestätigen oder abbrechen", "Картки дій: підтвердити або скасувати"),
				steps: [
					t3(
						"When you ask the assistant to do something, it does not do it. It shows a card with the proposed action and its data. Seven actions exist: [[ai.act_create_task]], [[ai.act_update_task]], [[ai.act_create_deal]], [[ai.act_create_contact]], [[ai.act_add_note]], [[ai.act_send_email]] and [[ai.act_save_employee_contract]] (it saves the type, the start date and a short note of an employment contract to the employee’s profile, after it has read the PDF).",
						"Bittet man den Assistenten, etwas zu tun, tut er es nicht sofort. Er zeigt eine Karte mit der vorgeschlagenen Aktion und ihren Daten. Es gibt sieben Aktionen: [[ai.act_create_task]], [[ai.act_update_task]], [[ai.act_create_deal]], [[ai.act_create_contact]], [[ai.act_add_note]], [[ai.act_send_email]] und [[ai.act_save_employee_contract]] (sie speichert Art, Beginn und eine kurze Notiz eines Arbeitsvertrags im Profil des Mitarbeiters, nachdem die PDF gelesen wurde).",
						"Коли ви просите помічника щось зробити, він цього не робить одразу. Він показує картку із запропонованою дією та її даними. Існує сім дій: [[ai.act_create_task]], [[ai.act_update_task]], [[ai.act_create_deal]], [[ai.act_create_contact]], [[ai.act_add_note]], [[ai.act_send_email]] і [[ai.act_save_employee_contract]] (зберігає тип, дату початку й коротку примітку трудового договору в профілі співробітника після прочитання PDF).",
					),
					t3(
						"The card lists the data line by line with captions such as [[ai.f_title]], [[ai.f_deadline]], [[ai.f_responsible]], [[ai.f_stage]], [[ai.f_email]]. For the e-mail card the fields [[ai.f_to]], [[ai.f_subject]] and [[ai.f_body]] are editable: correct the text before sending.",
						"Die Karte listet die Daten zeilenweise mit Beschriftungen wie [[ai.f_title]], [[ai.f_deadline]], [[ai.f_responsible]], [[ai.f_stage]], [[ai.f_email]]. Bei der E-Mail-Karte sind die Felder [[ai.f_to]], [[ai.f_subject]] und [[ai.f_body]] bearbeitbar: Korrigieren Sie den Text vor dem Senden.",
						"Картка перелічує дані по рядках з підписами на кшталт [[ai.f_title]], [[ai.f_deadline]], [[ai.f_responsible]], [[ai.f_stage]], [[ai.f_email]]. У картці листа поля [[ai.f_to]], [[ai.f_subject]] і [[ai.f_body]] можна редагувати: виправте текст перед надсиланням.",
					),
					t3(
						"Press [[ai.confirm]] (for the e-mail card the button is called [[ai.send]]) to perform the action, or [[ai.cancel]] to drop it. After a confirmation the card shows a green result line (for example a created task or “Note added”) and the button [[ai.open]]: it goes to the created or changed record and closes the assistant. After a cancel the card says [[ai.cancelled]]. If the action fails, a red message explains why.",
						"Klicken Sie auf [[ai.confirm]] (bei der E-Mail-Karte heißt die Schaltfläche [[ai.send]]), um die Aktion auszuführen, oder auf [[ai.cancel]], um sie zu verwerfen. Nach der Bestätigung zeigt die Karte eine grüne Ergebniszeile (z. B. eine angelegte Aufgabe oder „Notiz hinzugefügt“) und die Schaltfläche [[ai.open]]: Sie führt zum angelegten oder geänderten Eintrag und schließt den Assistenten. Nach dem Abbrechen steht auf der Karte [[ai.cancelled]]. Scheitert die Aktion, erklärt eine rote Meldung den Grund.",
						"Натисніть [[ai.confirm]] (у картці листа кнопка називається [[ai.send]]), щоб виконати дію, або [[ai.cancel]], щоб відкинути її. Після підтвердження картка показує зелений рядок результату (наприклад, створене завдання чи «Note added») і кнопку [[ai.open]]: вона веде до створеного чи зміненого запису й закриває помічник. Після скасування на картці написано [[ai.cancelled]]. Якщо дія не вдалася, червоне повідомлення пояснює причину.",
					),
					t3(
						"Which actions you get depends on your role: a Viewer sees none, because a card would change data. A person needs access to the module of the action: tasks for task actions, CRM for deals, contacts and notes, Web Mails for e-mails, My company for the employee contract.",
						"Welche Aktionen Sie erhalten, hängt von Ihrer Rolle ab: Ein Betrachter bekommt keine, denn eine Karte würde Daten ändern. Für die Aktion braucht man Zugriff auf das jeweilige Modul: Aufgaben für Aufgabenaktionen, CRM für Deals, Kontakte und Notizen, Web Mails für E-Mails, Meine Firma für den Mitarbeitervertrag.",
						"Які дії ви отримаєте, залежить від ролі: Глядач не отримає жодної, бо картка змінила б дані. Потрібен доступ до модуля дії: завдання — для дій із завданнями, CRM — для угод, контактів і нотаток, Web Mails — для листів, Моя компанія — для договору співробітника.",
					),
				],
			},
			{
				title: t3("AI buttons in other sections", "KI-Schaltflächen in anderen Bereichen", "Кнопки ШІ в інших розділах"),
				steps: [
					t3(
						"[[ai.summary]] on a deal card and on the edit pages of a contact and of a company: it opens the assistant and asks it at once for a summary — who this is, the current state, open points and the recommended next action.",
						"[[ai.summary]] an einer Deal-Karte sowie auf den Bearbeitungsseiten eines Kontakts und einer Firma: Sie öffnet den Assistenten und bittet ihn sofort um eine Zusammenfassung — wer das ist, aktueller Stand, offene Punkte und empfohlene nächste Aktion.",
						"[[ai.summary]] на картці угоди та на сторінках редагування контакту й компанії: відкриває помічник і одразу просить підсумок — хто це, поточний стан, відкриті питання й рекомендована наступна дія.",
					),
					t3(
						"[[ai.analyzeMail]] in the reader of an e-mail in [[navigation.web_mails]]: the assistant reads the message and tells whether it is a sales inquiry, a question or something else, names the priority and intent, gives a short summary and says whether it is worth creating a lead or a task.",
						"[[ai.analyzeMail]] im Lesefenster einer E-Mail in [[navigation.web_mails]]: Der Assistent liest die Nachricht und sagt, ob es eine Verkaufsanfrage, eine Frage oder etwas anderes ist, nennt Priorität und Absicht, fasst kurz zusammen und sagt, ob sich ein Lead oder eine Aufgabe lohnt.",
						"[[ai.analyzeMail]] у вікні читання листа в [[navigation.web_mails]]: помічник читає повідомлення й каже, чи це запит на продаж, питання чи щось інше, називає пріоритет і намір, коротко підсумовує та каже, чи варто створити лід або завдання.",
					),
					t3(
						"[[ai.analyzeDoc]] in [[navigation.online_documents]] on an uploaded PDF: the assistant reads the document, tells what it is and, if it looks like an employment contract, finds the employee and offers a card [[ai.act_save_employee_contract]].",
						"[[ai.analyzeDoc]] in [[navigation.online_documents]] bei einer hochgeladenen PDF: Der Assistent liest das Dokument, sagt, was es ist, und findet, falls es wie ein Arbeitsvertrag aussieht, den Mitarbeiter und bietet eine Karte [[ai.act_save_employee_contract]] an.",
						"[[ai.analyzeDoc]] у [[navigation.online_documents]] біля завантаженого PDF: помічник читає документ, каже, що це, і, якщо він схожий на трудовий договір, знаходить співробітника та пропонує картку [[ai.act_save_employee_contract]].",
					),
					t3(
						"These buttons are hidden if the AI is not switched on for the site, if your plan has no assistant or if you lack access to the data they need.",
						"Diese Schaltflächen sind ausgeblendet, wenn die KI für die Seite nicht eingeschaltet ist, wenn Ihr Tarif keinen Assistenten enthält oder wenn Ihnen der Zugriff auf die benötigten Daten fehlt.",
						"Ці кнопки приховані, якщо ШІ для сайту не ввімкнено, якщо у вашому тарифі немає помічника або якщо немає доступу до потрібних даних.",
					),
				],
			},
		],
	},
];
