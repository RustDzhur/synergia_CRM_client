import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Раздел «Автоматизация»: правила, окно правила, события и действия, подстановки, запуск и журнал.
export const AUTOMATION: DocSection[] = [
	{
		id: "automation",
		title: t3("Automation: rules that work for you", "Automatisierung: Regeln, die für Sie arbeiten", "Автоматизація: правила, що працюють за вас"),
		intro: t3(
			"The [[navigation.automation]] section lets the CRM react to events by itself: “when a deal reaches a stage, create a task”, “when an invoice is paid, notify the team”. It is included in the Professional plan. For the roles Manager, Employee and Viewer the section is closed by default; the owner or an admin can open it for a person in [[navigation.settings]] → team and access. The section has four tabs: [[automation.tab_rules]], [[automation.tab_variables]], [[automation.tab_constants]] and [[automation.tab_logs]].",
			"Im Bereich [[navigation.automation]] reagiert das CRM von selbst auf Ereignisse: „Wenn ein Deal eine Phase erreicht, lege eine Aufgabe an“, „Wenn eine Rechnung bezahlt ist, benachrichtige das Team“. Er ist im Tarif Professional enthalten. Für die Rollen Manager, Mitarbeiter und Betrachter ist der Bereich standardmäßig gesperrt; Inhaber oder Admin können ihn in [[navigation.settings]] → Team und Zugriff für eine Person öffnen. Der Bereich hat vier Tabs: [[automation.tab_rules]], [[automation.tab_variables]], [[automation.tab_constants]] und [[automation.tab_logs]].",
			"Розділ [[navigation.automation]] дозволяє CRM реагувати на події самостійно: «коли угода дійшла до етапу — створи завдання», «коли рахунок оплачено — повідом команду». Він входить до тарифу Professional. Для ролей Менеджер, Співробітник і Глядач розділ за замовчуванням закритий; власник або адміністратор може відкрити його для людини в [[navigation.settings]] → команда та доступ. У розділі чотири вкладки: [[automation.tab_rules]], [[automation.tab_variables]], [[automation.tab_constants]] і [[automation.tab_logs]].",
		),
		groups: [
			{
				title: t3("The rules tab: what you see", "Der Tab Regeln: was Sie sehen", "Вкладка правил: що ви бачите"),
				steps: [
					t3(
						"Open [[navigation.automation]] in the left menu. The first tab, [[automation.tab_rules]], opens. Under the tab bar there is a short help text: rules run on the server when something happens in the CRM, and you choose the event, the delay and the action.",
						"Öffnen Sie [[navigation.automation]] im linken Menü. Der erste Tab, [[automation.tab_rules]], öffnet sich. Unter der Tab-Leiste steht ein kurzer Hilfetext: Regeln laufen auf dem Server, wenn im CRM etwas passiert; Sie wählen Ereignis, Verzögerung und Aktion.",
						"Відкрийте [[navigation.automation]] у лівому меню. Відкриється перша вкладка — [[automation.tab_rules]]. Під смугою вкладок є короткий довідковий текст: правила виконуються на сервері, коли в CRM щось відбувається, а ви обираєте подію, затримку й дію.",
					),
					t3(
						"Below the help there is a plan banner. It tells how many rules your plan allows and shows the name of the plan as a small chip and a counter “used / limit”. If your plan has no automation at all, the banner says that automation is not included and, instead of the counter, there is the link [[upgrade.changePlan]] that leads to the plans page.",
						"Darunter steht ein Tarif-Banner. Er nennt, wie viele Regeln Ihr Tarif erlaubt, und zeigt den Tarifnamen als kleinen Chip sowie einen Zähler „verwendet / Limit“. Enthält Ihr Tarif keine Automatisierung, sagt der Banner das, und statt des Zählers steht der Link [[upgrade.changePlan]], der zur Tarifseite führt.",
						"Нижче — банер тарифу. Він повідомляє, скільки правил дозволяє ваш тариф, і показує назву тарифу маленьким чипом та лічильник «використано / ліміт». Якщо у вашому тарифі автоматизації немає зовсім, банер про це каже, а замість лічильника є посилання [[upgrade.changePlan]], що веде на сторінку тарифів.",
					),
					t3(
						"The green button [[automation.r_addRule]] creates a rule. When the limit of your plan is reached (or is 0), the button is inactive: delete a rule you do not need or change the plan.",
						"Die grüne Schaltfläche [[automation.r_addRule]] legt eine Regel an. Ist das Limit Ihres Tarifs erreicht (oder 0), ist die Schaltfläche inaktiv: Löschen Sie eine nicht benötigte Regel oder wechseln Sie den Tarif.",
						"Зелена кнопка [[automation.r_addRule]] створює правило. Коли ліміт тарифу вичерпано (або він дорівнює 0), кнопка неактивна: видаліть непотрібне правило або змініть тариф.",
					),
					t3(
						"While there are no rules, an empty state appears with an example: “[[automation.r_empty]]”",
						"Solange es keine Regeln gibt, erscheint ein Leerzustand mit einem Beispiel: „[[automation.r_empty]]“",
						"Поки правил немає, показується порожній стан із прикладом: «[[automation.r_empty]]»",
					),
					t3(
						"Every rule is a card (two columns on a wide screen). The card shows the rule name, one line “event · stage → timing → action”, the message text of the rule, the checkbox [[automation.r_enabled]] and three buttons: [[automation.r_test]], [[automation.r_edit]], [[automation.r_delete]]. A switched-off rule is shown dimmed.",
						"Jede Regel ist eine Karte (auf breitem Bildschirm zwei Spalten). Die Karte zeigt den Regelnamen, eine Zeile „Ereignis · Phase → Zeitpunkt → Aktion“, den Nachrichtentext der Regel, das Kontrollkästchen [[automation.r_enabled]] und drei Schaltflächen: [[automation.r_test]], [[automation.r_edit]], [[automation.r_delete]]. Eine ausgeschaltete Regel wird abgedunkelt dargestellt.",
						"Кожне правило — картка (на широкому екрані у дві колонки). На картці видно назву правила, рядок «подія · етап → час → дія», текст повідомлення правила, прапорець [[automation.r_enabled]] і три кнопки: [[automation.r_test]], [[automation.r_edit]], [[automation.r_delete]]. Вимкнене правило показано притемненим.",
					),
					t3(
						"The checkbox [[automation.r_enabled]] saves at once, without any other button: untick it to pause the rule, tick it to start it again.",
						"Das Kontrollkästchen [[automation.r_enabled]] speichert sofort, ohne weitere Schaltfläche: Entfernen Sie den Haken, um die Regel zu pausieren; setzen Sie ihn, um sie wieder zu starten.",
						"Прапорець [[automation.r_enabled]] зберігається одразу, без жодної іншої кнопки: зніміть його, щоб призупинити правило, поставте, щоб запустити знову.",
					),
					t3(
						"[[automation.r_delete]] opens a confirmation window with the rule name. Confirm to delete the rule for good; cancel to keep it.",
						"[[automation.r_delete]] öffnet ein Bestätigungsfenster mit dem Regelnamen. Bestätigen löscht die Regel endgültig; Abbrechen behält sie.",
						"[[automation.r_delete]] відкриває вікно підтвердження з назвою правила. Підтвердьте, щоб видалити правило остаточно; скасуйте, щоб залишити.",
					),
				],
			},
			{
				title: t3("Creating and editing a rule", "Eine Regel anlegen und bearbeiten", "Створення й редагування правила"),
				steps: [
					t3(
						"Press [[automation.r_addRule]] (or [[automation.r_edit]] on an existing card). A window opens with the rule form. Fill in the fields from top to bottom.",
						"Klicken Sie auf [[automation.r_addRule]] (oder [[automation.r_edit]] an einer vorhandenen Karte). Es öffnet sich ein Fenster mit dem Regelformular. Füllen Sie die Felder von oben nach unten aus.",
						"Натисніть [[automation.r_addRule]] (або [[automation.r_edit]] на наявній картці). Відкриється вікно з формою правила. Заповнюйте поля згори вниз.",
					),
					t3(
						"[[automation.r_name]] — a short name of the rule (up to 100 characters). It is required and is shown on the card, in the notification title of some actions and in the log.",
						"[[automation.r_name]] — ein kurzer Name der Regel (bis 100 Zeichen). Pflichtfeld; er erscheint auf der Karte, im Titel mancher Aktionen und im Protokoll.",
						"[[automation.r_name]] — коротка назва правила (до 100 символів). Обов’язкове поле; його видно на картці, у заголовку деяких дій і в журналі.",
					),
					t3(
						"[[automation.r_when]] — the event that starts the rule. Choose from the list of 18 events (they are described in the next block).",
						"[[automation.r_when]] — das Ereignis, das die Regel startet. Wählen Sie aus der Liste mit 18 Ereignissen (sie sind im nächsten Block beschrieben).",
						"[[automation.r_when]] — подія, що запускає правило. Оберіть зі списку з 18 подій (їх описано в наступному блоці).",
					),
					t3(
						"[[automation.r_stage]] — this field appears only for the two deal events ([[automation.ev_deal_created]] and [[automation.ev_deal_stage]]). Choose the stage of the deals board that the rule watches, or leave [[automation.anyStage]] to react to every stage. If you have not created any deal stages, the window says so: rules are attached to stages, so create them first in [[navigation.crm]].",
						"[[automation.r_stage]] — dieses Feld erscheint nur bei den beiden Deal-Ereignissen ([[automation.ev_deal_created]] und [[automation.ev_deal_stage]]). Wählen Sie die Phase der Deal-Tafel, auf die die Regel achtet, oder lassen Sie [[automation.anyStage]], um auf jede Phase zu reagieren. Haben Sie noch keine Deal-Phasen angelegt, weist das Fenster darauf hin: Regeln hängen an Phasen, legen Sie sie also zuerst in [[navigation.crm]] an.",
						"[[automation.r_stage]] — це поле з’являється лише для двох подій угод ([[automation.ev_deal_created]] і [[automation.ev_deal_stage]]). Оберіть етап дошки угод, за яким стежить правило, або залиште [[automation.anyStage]], щоб реагувати на кожен етап. Якщо етапів угод ще немає, вікно про це скаже: правила прив’язані до етапів, тож спершу створіть їх у [[navigation.crm]].",
					),
					t3(
						"[[automation.r_after]] — when to run: [[automation.o_immediately]], [[automation.o_after_1h]], [[automation.o_after_1d]] or [[automation.o_after_3d]]. With a delay the action is queued and performed later (see the block “When and how the rules run”).",
						"[[automation.r_after]] — wann ausgeführt wird: [[automation.o_immediately]], [[automation.o_after_1h]], [[automation.o_after_1d]] oder [[automation.o_after_3d]]. Bei einer Verzögerung wird die Aktion eingereiht und später ausgeführt (siehe Block „Wann und wie die Regeln laufen“).",
						"[[automation.r_after]] — коли виконувати: [[automation.o_immediately]], [[automation.o_after_1h]], [[automation.o_after_1d]] або [[automation.o_after_3d]]. Із затримкою дія ставиться в чергу й виконується пізніше (див. блок «Коли й як виконуються правила»).",
					),
					t3(
						"[[automation.r_do]] — the action. Seven actions are available; they are described below. After you choose one, extra fields appear under it.",
						"[[automation.r_do]] — die Aktion. Es gibt sieben Aktionen, sie sind unten beschrieben. Nach der Auswahl erscheinen darunter zusätzliche Felder.",
						"[[automation.r_do]] — дія. Доступно сім дій, їх описано нижче. Після вибору під полем з’являються додаткові поля.",
					),
					t3(
						"The large text field is the message of the action (up to 1000 characters). Its label depends on the action: [[automation.r_text]] for a notification and a note, [[automation.r_message]] for the other actions, [[automation.r_instruction]] for the AI action. Under the field the block [[automation.r_variables]] lists the placeholders you can insert (see “Placeholders in texts”).",
						"Das große Textfeld ist die Nachricht der Aktion (bis 1000 Zeichen). Seine Beschriftung hängt von der Aktion ab: [[automation.r_text]] bei Benachrichtigung und Notiz, [[automation.r_message]] bei den übrigen Aktionen, [[automation.r_instruction]] bei der KI-Aktion. Unter dem Feld listet der Block [[automation.r_variables]] die Platzhalter, die Sie einfügen können (siehe „Platzhalter in Texten“).",
						"Велике текстове поле — це повідомлення дії (до 1000 символів). Його підпис залежить від дії: [[automation.r_text]] для сповіщення й нотатки, [[automation.r_message]] для інших дій, [[automation.r_instruction]] для дії ШІ. Під полем блок [[automation.r_variables]] перелічує підстановки, які можна вставити (див. «Підстановки в текстах»).",
					),
					t3(
						"Press [[automation.r_save]]. Before saving the form checks: the name must be filled (“[[automation.r_nameRequired]]”), for the action [[automation.ac_move_stage]] a stage must be chosen (“[[automation.r_moveRequired]]”), for [[automation.ac_webhook]] the address must start with https:// (“[[automation.r_urlRequired]]”), for the AI action the instruction must be filled (“[[automation.r_instructionRequired]]”). A red message with the problem appears and the window stays open.",
						"Klicken Sie auf [[automation.r_save]]. Vor dem Speichern prüft das Formular: Der Name muss ausgefüllt sein („[[automation.r_nameRequired]]“), bei [[automation.ac_move_stage]] muss eine Phase gewählt sein („[[automation.r_moveRequired]]“), bei [[automation.ac_webhook]] muss die Adresse mit https:// beginnen („[[automation.r_urlRequired]]“), bei der KI-Aktion muss die Anweisung ausgefüllt sein („[[automation.r_instructionRequired]]“). Eine rote Meldung nennt das Problem, das Fenster bleibt offen.",
						"Натисніть [[automation.r_save]]. Перед збереженням форма перевіряє: назва має бути заповнена («[[automation.r_nameRequired]]»), для дії [[automation.ac_move_stage]] має бути обраний етап («[[automation.r_moveRequired]]»), для [[automation.ac_webhook]] адреса має починатися з https:// («[[automation.r_urlRequired]]»), для дії ШІ інструкція має бути заповнена («[[automation.r_instructionRequired]]»). З’являється червоне повідомлення про проблему, вікно лишається відкритим.",
					),
					t3(
						"On success the window closes and the message “[[automation.r_saved]]” appears. If the server refuses (for example because the rule limit of the plan is reached), you see “[[automation.r_saveFailed]]” or the server’s own explanation and the window stays open so that nothing you typed is lost. [[automation.r_cancel]] closes the window without saving.",
						"Bei Erfolg schließt sich das Fenster und die Meldung „[[automation.r_saved]]“ erscheint. Lehnt der Server ab (z. B. weil das Regellimit des Tarifs erreicht ist), sehen Sie „[[automation.r_saveFailed]]“ oder die Erklärung des Servers, und das Fenster bleibt offen, damit nichts von Ihrer Eingabe verloren geht. [[automation.r_cancel]] schließt das Fenster ohne Speichern.",
						"У разі успіху вікно закривається й з’являється повідомлення «[[automation.r_saved]]». Якщо сервер відмовляє (наприклад, ліміт правил тарифу вичерпано), ви бачите «[[automation.r_saveFailed]]» або власне пояснення сервера, а вікно лишається відкритим, щоб нічого з введеного не втратилося. [[automation.r_cancel]] закриває вікно без збереження.",
					),
				],
			},
			{
				title: t3("The 18 events", "Die 18 Ereignisse", "18 подій"),
				steps: [
					t3(
						"Deals: [[automation.ev_deal_created]] and [[automation.ev_deal_stage]]. For both you can choose the stage. With [[automation.ev_deal_stage]] the rule fires when a deal is moved into the chosen stage (by drag and drop, by the deal card or by another automation action).",
						"Deals: [[automation.ev_deal_created]] und [[automation.ev_deal_stage]]. Bei beiden können Sie die Phase wählen. Bei [[automation.ev_deal_stage]] wird die Regel ausgelöst, wenn ein Deal in die gewählte Phase verschoben wird (per Drag-and-drop, über die Deal-Karte oder durch eine andere Automatisierungsaktion).",
						"Угоди: [[automation.ev_deal_created]] і [[automation.ev_deal_stage]]. Для обох можна обрати етап. Для [[automation.ev_deal_stage]] правило спрацьовує, коли угоду переміщено в обраний етап (перетягуванням, через картку угоди або іншою дією автоматизації).",
					),
					t3(
						"Contacts and inbound: [[automation.ev_contact_created]], [[automation.ev_lead_created]] (a lead created from an incoming e-mail), [[automation.ev_message_received]] (a message arrives in a connected channel), [[automation.ev_call_missed]].",
						"Kontakte und Eingang: [[automation.ev_contact_created]], [[automation.ev_lead_created]] (ein Lead, der aus einer eingehenden E-Mail entsteht), [[automation.ev_message_received]] (eine Nachricht kommt in einem verbundenen Kanal an), [[automation.ev_call_missed]].",
						"Контакти та вхідні: [[automation.ev_contact_created]], [[automation.ev_lead_created]] (лід, створений із вхідного листа), [[automation.ev_message_received]] (повідомлення надійшло в підключений канал), [[automation.ev_call_missed]].",
					),
					t3(
						"Tasks: [[automation.ev_task_created]] and [[automation.ev_deadline]]. The deadline event fires once per threshold for tasks and deals: 24 hours before, 1 hour before and when the deadline is overdue. It is detected in the browser of a person who has the CRM open, so it works only while someone from your firm is working in the CRM.",
						"Aufgaben: [[automation.ev_task_created]] und [[automation.ev_deadline]]. Das Fristereignis wird für Aufgaben und Deals je Schwelle einmal ausgelöst: 24 Stunden vorher, 1 Stunde vorher und bei überschrittener Frist. Es wird im Browser einer Person erkannt, die das CRM geöffnet hat, funktioniert also nur, solange jemand aus Ihrer Firma im CRM arbeitet.",
						"Завдання: [[automation.ev_task_created]] і [[automation.ev_deadline]]. Подія про термін спрацьовує один раз на кожен поріг для завдань і угод: за 24 години, за 1 годину й коли термін прострочено. Її виявляє браузер людини, у якої відкрито CRM, тож вона працює лише поки хтось із вашої фірми працює в CRM.",
					),
					t3(
						"Finance: [[automation.ev_order_created]], [[automation.ev_order_status]], [[automation.ev_quote_sent]], [[automation.ev_contract_signed]], [[automation.ev_invoice_sent]], [[automation.ev_invoice_paid]], [[automation.ev_invoice_overdue]], [[automation.ev_invoice_credit_note_created]], [[automation.ev_invoice_recurring_created]], [[automation.ev_invoice_reminder]].",
						"Finanzen: [[automation.ev_order_created]], [[automation.ev_order_status]], [[automation.ev_quote_sent]], [[automation.ev_contract_signed]], [[automation.ev_invoice_sent]], [[automation.ev_invoice_paid]], [[automation.ev_invoice_overdue]], [[automation.ev_invoice_credit_note_created]], [[automation.ev_invoice_recurring_created]], [[automation.ev_invoice_reminder]].",
						"Фінанси: [[automation.ev_order_created]], [[automation.ev_order_status]], [[automation.ev_quote_sent]], [[automation.ev_contract_signed]], [[automation.ev_invoice_sent]], [[automation.ev_invoice_paid]], [[automation.ev_invoice_overdue]], [[automation.ev_invoice_credit_note_created]], [[automation.ev_invoice_recurring_created]], [[automation.ev_invoice_reminder]].",
					),
					t3(
						"Invoice events carry the customer name, the invoice number and the invoice itself, but not an e-mail address. Therefore the action [[automation.ac_send_email]] addressed to the client cannot find an address for them; use a notification or the e-mail to the firm owner instead.",
						"Rechnungsereignisse enthalten den Kundennamen, die Rechnungsnummer und die Rechnung selbst, aber keine E-Mail-Adresse. Deshalb findet die Aktion [[automation.ac_send_email]] an den Kunden dafür keine Adresse; nutzen Sie stattdessen eine Benachrichtigung oder die E-Mail an den Firmeninhaber.",
						"Події рахунків містять ім’я клієнта, номер рахунку й сам рахунок, але не адресу e-mail. Тому дія [[automation.ac_send_email]] клієнту не знаходить для них адресу; замість неї використайте сповіщення або лист власнику фірми.",
					),
				],
			},
			{
				title: t3("The 7 actions", "Die 7 Aktionen", "7 дій"),
				steps: [
					t3(
						"[[automation.ac_notify]] — sends a notification to the team with your text. In the notification bell it has a link that leads to the relevant section: deals to [[navigation.crm]], tasks to [[navigation.tasks_projects]], invoices, orders, quotes and contracts to the matching tab of [[navigation.inventory_management]], contacts to [[navigation.contacts]]; for other events it leads to the chat.",
						"[[automation.ac_notify]] — sendet dem Team eine Benachrichtigung mit Ihrem Text. In der Benachrichtigungsglocke hat sie einen Link zum passenden Bereich: Deals zu [[navigation.crm]], Aufgaben zu [[navigation.tasks_projects]], Rechnungen, Aufträge, Angebote und Verträge zum passenden Tab von [[navigation.inventory_management]], Kontakte zu [[navigation.contacts]]; bei anderen Ereignissen zum Chat.",
						"[[automation.ac_notify]] — надсилає команді сповіщення з вашим текстом. У дзвінку сповіщень є посилання на відповідний розділ: угоди — до [[navigation.crm]], завдання — до [[navigation.tasks_projects]], рахунки, замовлення, пропозиції й договори — на відповідну вкладку [[navigation.inventory_management]], контакти — до [[navigation.contacts]]; для інших подій — до чату.",
					),
					t3(
						"[[automation.ac_create_task]] — creates a task. The title is your message text (or the rule name if the text is empty), the author is shown as “Automation”. The extra field [[automation.r_assignee]] chooses who is responsible: [[automation.o_manager]] (the first name of the firm owner) or [[automation.o_responsible]] (the person responsible for the event; if there is none, the owner).",
						"[[automation.ac_create_task]] — legt eine Aufgabe an. Der Titel ist Ihr Nachrichtentext (oder der Regelname, wenn der Text leer ist), als Autor erscheint „Automation“. Das Zusatzfeld [[automation.r_assignee]] bestimmt den Verantwortlichen: [[automation.o_manager]] (der Vorname des Firmeninhabers) oder [[automation.o_responsible]] (die für das Ereignis verantwortliche Person; gibt es keine, der Inhaber).",
						"[[automation.ac_create_task]] — створює завдання. Назва — текст вашого повідомлення (або назва правила, якщо текст порожній), автор показаний як «Automation». Додаткове поле [[automation.r_assignee]] обирає відповідального: [[automation.o_manager]] (ім’я власника фірми) або [[automation.o_responsible]] (відповідальний за подію; якщо його немає — власник).",
					),
					t3(
						"[[automation.ac_add_note]] — adds a note with your text to the history: to the deal if the event has one, otherwise to the contact. If the event has neither, the action fails and the log says that there is nothing to attach the note to.",
						"[[automation.ac_add_note]] — fügt der Historie eine Notiz mit Ihrem Text hinzu: beim Deal, falls das Ereignis einen hat, sonst beim Kontakt. Hat das Ereignis keines von beiden, schlägt die Aktion fehl, und das Protokoll vermerkt, dass es nichts gibt, woran die Notiz angehängt werden kann.",
						"[[automation.ac_add_note]] — додає в історію нотатку з вашим текстом: до угоди, якщо в події вона є, інакше до контакту. Якщо в події немає ні того, ні іншого, дія завершується помилкою, а в журналі сказано, що нотатку нікуди прикріпити.",
					),
					t3(
						"[[automation.ac_move_stage]] — moves the deal to the stage chosen in the extra field [[automation.r_moveTo]]. It works only for events that have a deal. If the stage or the deal no longer exists, the action ends with an error in the log.",
						"[[automation.ac_move_stage]] — verschiebt den Deal in die Phase, die im Zusatzfeld [[automation.r_moveTo]] gewählt ist. Es funktioniert nur bei Ereignissen mit einem Deal. Gibt es die Phase oder den Deal nicht mehr, endet die Aktion mit einem Fehler im Protokoll.",
						"[[automation.ac_move_stage]] — переміщує угоду на етап, обраний у додатковому полі [[automation.r_moveTo]]. Працює лише для подій, у яких є угода. Якщо етапу чи угоди вже немає, дія завершується помилкою в журналі.",
					),
					t3(
						"[[automation.ac_send_email]] — sends an e-mail from the first mailbox connected in [[navigation.web_mails]]. The extra field [[automation.r_recipient]] chooses the recipient: [[automation.r_toClient]] or [[automation.r_toOwner]]. The subject is the rule name, the body is your message text. Errors: no mailbox is connected, or no address could be found for the client.",
						"[[automation.ac_send_email]] — sendet eine E-Mail vom ersten in [[navigation.web_mails]] verbundenen Postfach. Das Zusatzfeld [[automation.r_recipient]] bestimmt den Empfänger: [[automation.r_toClient]] oder [[automation.r_toOwner]]. Betreff ist der Regelname, Text ist Ihre Nachricht. Fehler: kein Postfach verbunden oder keine Adresse des Kunden gefunden.",
						"[[automation.ac_send_email]] — надсилає лист з першої поштової скриньки, підключеної в [[navigation.web_mails]]. Додаткове поле [[automation.r_recipient]] обирає одержувача: [[automation.r_toClient]] або [[automation.r_toOwner]]. Тема — назва правила, тіло — ваш текст. Помилки: не підключено жодної скриньки або не вдалося знайти адресу клієнта.",
					),
					t3(
						"[[automation.ac_webhook]] — sends a POST request with JSON (the rule, the event, its data and the text) to the address in the extra field [[automation.r_url]]. Only https addresses of public hosts are allowed; the action is an error if the other side does not answer with a success code.",
						"[[automation.ac_webhook]] — sendet eine POST-Anfrage mit JSON (Regel, Ereignis, dessen Daten und Text) an die Adresse im Zusatzfeld [[automation.r_url]]. Erlaubt sind nur https-Adressen öffentlicher Hosts; die Aktion gilt als Fehler, wenn die Gegenseite nicht mit einem Erfolgscode antwortet.",
						"[[automation.ac_webhook]] — надсилає POST-запит із JSON (правило, подія, її дані й текст) на адресу з додаткового поля [[automation.r_url]]. Дозволені лише https-адреси публічних хостів; дія вважається помилкою, якщо інша сторона не відповідає кодом успіху.",
					),
					t3(
						"[[automation.ac_ai_action]] — the AI reads the event and decides on ONE action that fits your instruction (a task, a note, a deal, an e-mail…) and performs it without asking for confirmation. Under the field [[automation.r_instruction]] a warning says exactly this, and a hint explains that the AI can use everything it can read in the CRM, so no placeholders are needed. The action needs the AI feature of the Professional plan and spends the same daily AI quota as the Firmspace AI chat, receipt scanning and finance analysis.",
						"[[automation.ac_ai_action]] — die KI liest das Ereignis, entscheidet sich für EINE zu Ihrer Anweisung passende Aktion (Aufgabe, Notiz, Deal, E-Mail …) und führt sie ohne Rückfrage aus. Unter dem Feld [[automation.r_instruction]] steht genau diese Warnung sowie ein Hinweis, dass die KI alles nutzen kann, was sie im CRM lesen darf, Platzhalter also nicht nötig sind. Die Aktion erfordert die KI-Funktion des Tarifs Professional und verbraucht dasselbe tägliche KI-Kontingent wie der KI-Chat, das Belegscannen und die Finanzanalyse.",
						"[[automation.ac_ai_action]] — ШІ читає подію, вирішує зробити ОДНУ дію, що відповідає вашій інструкції (завдання, нотатку, угоду, лист…), і виконує її без запиту підтвердження. Під полем [[automation.r_instruction]] стоїть саме таке попередження та підказка, що ШІ може користуватися всім, що бачить у CRM, тож підстановки не потрібні. Дія потребує функції ШІ тарифу Professional і витрачає ту саму добову квоту ШІ, що й чат ШІ, сканування чеків та аналіз фінансів.",
					),
				],
			},
			{
				title: t3("Placeholders in texts", "Platzhalter in Texten", "Підстановки в текстах"),
				steps: [
					t3(
						"Under the text field the block [[automation.r_variables]] shows small clickable tokens. A click copies the token to the clipboard and shows the message “[[automation.copied]]”; paste it into the text with Ctrl/⌘+V. If copying is not possible in your browser, a message asks you to select the token and copy it manually.",
						"Unter dem Textfeld zeigt der Block [[automation.r_variables]] kleine anklickbare Tokens. Ein Klick kopiert das Token in die Zwischenablage und zeigt die Meldung „[[automation.copied]]“; fügen Sie es mit Strg/⌘+V in den Text ein. Ist Kopieren im Browser nicht möglich, bittet eine Meldung darum, das Token zu markieren und manuell zu kopieren.",
						"Під текстовим полем блок [[automation.r_variables]] показує маленькі клікабельні токени. Клік копіює токен у буфер і показує повідомлення «[[automation.copied]]»; вставте його в текст через Ctrl/⌘+V. Якщо копіювання в браузері неможливе, повідомлення просить виділити токен і скопіювати вручну.",
					),
					t3(
						"When the rule runs, the server replaces the tokens with real values: {{deal.name}} (deal name), {{deal.stageName}} (the stage the deal moves to), {{deal.contactName}} (contact person of the deal), {{contact.name}} and {{contact.email}} (client), {{message.text}} and {{message.from}} (an incoming message and its sender), {{task.title}} (task title), {{constants.NAME}} (the value of a constant with this name) and {{variables.name}} (the value of a variable with this name).",
						"Beim Ausführen der Regel ersetzt der Server die Tokens durch echte Werte: {{deal.name}} (Dealname), {{deal.stageName}} (die Phase, in die der Deal wechselt), {{deal.contactName}} (Kontaktperson des Deals), {{contact.name}} und {{contact.email}} (Kunde), {{message.text}} und {{message.from}} (eingehende Nachricht und ihr Absender), {{task.title}} (Aufgabentitel), {{constants.NAME}} (Wert der Konstante mit diesem Namen) und {{variables.name}} (Wert der Variable mit diesem Namen).",
						"Коли правило виконується, сервер замінює токени справжніми значеннями: {{deal.name}} (назва угоди), {{deal.stageName}} (етап, на який переходить угода), {{deal.contactName}} (контактна особа угоди), {{contact.name}} і {{contact.email}} (клієнт), {{message.text}} і {{message.from}} (вхідне повідомлення та його відправник), {{task.title}} (назва завдання), {{constants.NAME}} (значення константи з такою назвою) і {{variables.name}} (значення змінної з такою назвою).",
					),
					t3(
						"The block is not shown for the AI action: there the AI reads the data itself.",
						"Für die KI-Aktion wird der Block nicht angezeigt: Dort liest die KI die Daten selbst.",
						"Для дії ШІ блок не показується: там ШІ читає дані сама.",
					),
				],
			},
			{
				title: t3("Testing a rule and the log", "Eine Regel testen und das Protokoll", "Тестування правила й журнал"),
				steps: [
					t3(
						"Press [[automation.r_test]] on a rule card. The action is performed right now on sample data (a deal “Test deal”, a client “Test Client” and similar), so you can see what your text and the action look like. A toast “[[automation.r_testResult]]: …” shows the result.",
						"Klicken Sie an einer Regelkarte auf [[automation.r_test]]. Die Aktion wird sofort mit Beispieldaten ausgeführt (ein Deal „Test deal“, ein Kunde „Test Client“ und Ähnliches); so sehen Sie, wie Ihr Text und die Aktion aussehen. Ein Hinweis „[[automation.r_testResult]]: …“ zeigt das Ergebnis.",
						"Натисніть [[automation.r_test]] на картці правила. Дія виконується просто зараз на зразкових даних (угода «Test deal», клієнт «Test Client» тощо), тож ви бачите, як виглядають ваш текст і дія. Повідомлення «[[automation.r_testResult]]: …» показує результат.",
					),
					t3(
						"Attention: a test really performs the action. A test of [[automation.ac_create_task]] creates a real task, a test of [[automation.ac_send_email]] really sends an e-mail (to the owner or to the address it finds), a test of [[automation.ac_webhook]] really calls the address. The result of every test and of every real run is written to the tab [[automation.tab_logs]].",
						"Achtung: Ein Test führt die Aktion wirklich aus. Ein Test von [[automation.ac_create_task]] legt eine echte Aufgabe an, ein Test von [[automation.ac_send_email]] versendet wirklich eine E-Mail (an den Inhaber oder an die gefundene Adresse), ein Test von [[automation.ac_webhook]] ruft die Adresse tatsächlich auf. Das Ergebnis jedes Tests und jedes echten Laufs wird in den Tab [[automation.tab_logs]] geschrieben.",
						"Увага: тест справді виконує дію. Тест [[automation.ac_create_task]] створює справжнє завдання, тест [[automation.ac_send_email]] справді надсилає лист (власнику або на знайдену адресу), тест [[automation.ac_webhook]] справді звертається за адресою. Результат кожного тесту й кожного справжнього запуску записується у вкладку [[automation.tab_logs]].",
					),
				],
			},
			{
				title: t3("When and how the rules run", "Wann und wie die Regeln laufen", "Коли й як виконуються правила"),
				steps: [
					t3(
						"When an event happens, the server looks for enabled rules with this event (and, for deal events, this stage). Rules with [[automation.o_immediately]] run at once. Rules with a delay put a job into a queue.",
						"Tritt ein Ereignis ein, sucht der Server aktivierte Regeln mit diesem Ereignis (bei Deal-Ereignissen mit dieser Phase). Regeln mit [[automation.o_immediately]] laufen sofort. Regeln mit Verzögerung stellen einen Auftrag in eine Warteschlange.",
						"Коли трапляється подія, сервер шукає ввімкнені правила з цією подією (для подій угод — і цим етапом). Правила з [[automation.o_immediately]] виконуються одразу. Правила із затримкою ставлять завдання в чергу.",
					),
					t3(
						"Queued jobs are performed when they are due: while someone from your firm works in the CRM (the browser checks for new notifications about every 20 seconds and that also runs due jobs), and by a daily background run on the server. So a delay of 1 hour is exact only while the CRM is open; otherwise the job waits for the daily run.",
						"Eingereihte Aufträge werden ausgeführt, sobald sie fällig sind: solange jemand aus Ihrer Firma im CRM arbeitet (der Browser prüft etwa alle 20 Sekunden auf neue Benachrichtigungen, und das führt auch fällige Aufträge aus) sowie durch einen täglichen Hintergrundlauf auf dem Server. Eine Verzögerung von 1 Stunde ist also nur bei geöffnetem CRM genau; sonst wartet der Auftrag auf den täglichen Lauf.",
						"Поставлені в чергу завдання виконуються, коли настає їхній час: поки хтось із вашої фірми працює в CRM (браузер приблизно раз на 20 секунд перевіряє нові сповіщення, і це також запускає завдання, чий час настав), а також щоденним фоновим запуском на сервері. Тож затримка в 1 годину точна лише при відкритому CRM; інакше завдання чекає щоденного запуску.",
					),
					t3(
						"A delayed rule of a deal event is skipped if by the time of the run the deal has already left the stage; the log then says “Skipped: the deal left this stage”. If the rule was deleted or switched off while waiting, the job is dropped.",
						"Eine verzögerte Regel eines Deal-Ereignisses wird übersprungen, wenn der Deal zum Ausführungszeitpunkt die Phase schon verlassen hat; das Protokoll vermerkt dann „Skipped: the deal left this stage“. Wurde die Regel während des Wartens gelöscht oder ausgeschaltet, wird der Auftrag verworfen.",
						"Відкладене правило події угоди пропускається, якщо на момент запуску угода вже залишила етап; у журналі тоді запис «Skipped: the deal left this stage». Якщо правило видалили або вимкнули, поки воно чекало, завдання відкидається.",
					),
					t3(
						"Loop protection: what an automation itself changes (for example a task that it created, or a deal that it moved) does not start further rules. This prevents endless chains.",
						"Schleifenschutz: Was eine Automatisierung selbst verändert (etwa eine von ihr angelegte Aufgabe oder ein von ihr verschobener Deal), löst keine weiteren Regeln aus. So entstehen keine Endlosketten.",
						"Захист від циклів: те, що змінює сама автоматизація (наприклад, створене нею завдання чи переміщена угода), не запускає інші правила. Це запобігає нескінченним ланцюжкам.",
					),
				],
			},
			{
				title: t3("The tabs Variables, Constants and Test Logs", "Die Tabs Variablen, Konstanten und Test-Protokoll", "Вкладки «Змінні», «Константи» й «Тестові журнали»"),
				steps: [
					t3(
						"These three tabs are ordinary tables (how they work — search, sorting, columns, adding — is described in the section “Tables” below). Their content is real data of your firm; the automation reads it through the tokens {{constants.NAME}} and {{variables.name}}.",
						"Diese drei Tabs sind gewöhnliche Tabellen (wie sie funktionieren — Suche, Sortierung, Spalten, Hinzufügen — steht im Abschnitt „Tabellen“ weiter unten). Ihr Inhalt sind echte Daten Ihrer Firma; die Automatisierung liest sie über die Tokens {{constants.NAME}} und {{variables.name}}.",
						"Ці три вкладки — звичайні таблиці (як вони працюють — пошук, сортування, стовпці, додавання — описано в розділі «Таблиці» нижче). Їхній вміст — справжні дані вашої фірми; автоматизація читає його через токени {{constants.NAME}} і {{variables.name}}.",
					),
					t3(
						"[[automation.tab_variables]]: fields [[automation.f_name]] (required), [[automation.f_value]], [[automation.f_type]] ([[automation.o_text]], [[automation.o_number]] or [[automation.o_date]]) and [[automation.f_description]]. Use a variable for a value that changes: for example a name of the person on duty.",
						"[[automation.tab_variables]]: Felder [[automation.f_name]] (Pflicht), [[automation.f_value]], [[automation.f_type]] ([[automation.o_text]], [[automation.o_number]] oder [[automation.o_date]]) und [[automation.f_description]]. Nutzen Sie eine Variable für einen Wert, der sich ändert, etwa den Namen der diensthabenden Person.",
						"[[automation.tab_variables]]: поля [[automation.f_name]] (обов’язкове), [[automation.f_value]], [[automation.f_type]] ([[automation.o_text]], [[automation.o_number]] або [[automation.o_date]]) і [[automation.f_description]]. Використовуйте змінну для значення, що змінюється, наприклад імені чергового.",
					),
					t3(
						"[[automation.tab_constants]]: fields [[automation.f_name]] (required), [[automation.f_value]] and [[automation.f_description]]. Use a constant for a value that stays the same, for example a phone number or a link that you insert in many rule texts.",
						"[[automation.tab_constants]]: Felder [[automation.f_name]] (Pflicht), [[automation.f_value]] und [[automation.f_description]]. Nutzen Sie eine Konstante für einen gleichbleibenden Wert, etwa eine Telefonnummer oder einen Link, den Sie in vielen Regeltexten verwenden.",
						"[[automation.tab_constants]]: поля [[automation.f_name]] (обов’язкове), [[automation.f_value]] і [[automation.f_description]]. Використовуйте константу для незмінного значення, наприклад номера телефону чи посилання, які ви вставляєте в багато текстів правил.",
					),
					t3(
						"[[automation.tab_logs]]: columns [[automation.f_name]] (the rule), [[automation.f_date]], [[automation.f_status]] ([[automation.o_success]] with a green dot or [[automation.o_error]] with a red dot) and [[automation.f_message]] (what was done or why it failed). The engine keeps the latest 200 entries. This is the first place to look when a rule “does nothing”.",
						"[[automation.tab_logs]]: Spalten [[automation.f_name]] (die Regel), [[automation.f_date]], [[automation.f_status]] ([[automation.o_success]] mit grünem Punkt oder [[automation.o_error]] mit rotem Punkt) und [[automation.f_message]] (was getan wurde oder warum es scheiterte). Das System behält die letzten 200 Einträge. Hier schauen Sie zuerst nach, wenn eine Regel „nichts tut“.",
						"[[automation.tab_logs]]: стовпці [[automation.f_name]] (правило), [[automation.f_date]], [[automation.f_status]] ([[automation.o_success]] із зеленою крапкою або [[automation.o_error]] з червоною) і [[automation.f_message]] (що зроблено або чому не вийшло). Система зберігає останні 200 записів. Це перше місце, куди дивитися, коли правило «нічого не робить».",
					),
				],
			},
		],
	},
];
