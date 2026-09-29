import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const COLLAB_CHAT: DocSection[] = [
	{
		id: "chat_and_calls",
		title: t3("Chat and Calls: customer conversations and the phone", "Chat und Anrufe: Kundengespräche und das Telefon", "Чат і дзвінки: розмови з клієнтами та телефон"),
		intro: t3(
			"[[navigation.chat_and_calls]] is the inbox for conversations with customers from the channels that you connected in [[navigation.settings]] → Integration (Telegram, Viber, Messenger, WhatsApp, SMS providers, SIP phone and the chat on your website). A conversation is created by the customer: as soon as somebody writes to your bot, page, number or website chat, it appears in the list. You cannot start a conversation from here; you answer the ones that arrived. The section belongs to the feature “channels” of the plan.",
			"[[navigation.chat_and_calls]] ist der Posteingang für Gespräche mit Kunden aus den Kanälen, die Sie in [[navigation.settings]] → Integration verbunden haben (Telegram, Viber, Messenger, WhatsApp, SMS-Anbieter, SIP-Telefon und der Chat auf Ihrer Website). Ein Gespräch entsteht durch den Kunden: Sobald jemand Ihrem Bot, Ihrer Seite, Nummer oder dem Website-Chat schreibt, erscheint es in der Liste. Von hier aus können Sie kein Gespräch beginnen; Sie beantworten die eingegangenen. Der Bereich gehört zur Funktion „Kanäle“ des Tarifs.",
			"[[navigation.chat_and_calls]] — вхідні розмови з клієнтами з каналів, які ви підключили в [[navigation.settings]] → Integration (Telegram, Viber, Messenger, WhatsApp, SMS-провайдери, SIP-телефон і чат на вашому сайті). Розмову створює клієнт: щойно хтось пише вашому боту, сторінці, номеру чи чату на сайті, вона з’являється в списку. Розпочати розмову звідси не можна; ви відповідаєте на ті, що прийшли. Розділ належить до функції «канали» тарифу.",
		),
		groups: [
			{
				title: t3("The screen while there are no conversations", "Der Bildschirm ohne Gespräche", "Екран, поки розмов немає"),
				steps: [
					t3(
						"Until the first customer writes, the page shows a chat icon and the text “[[collab.chatsEmpty]]”.",
						"Solange noch kein Kunde geschrieben hat, zeigt die Seite ein Chat-Symbol und den Text „[[collab.chatsEmpty]]“.",
						"Поки жоден клієнт не написав, сторінка показує значок чату й текст «[[collab.chatsEmpty]]».",
					),
					t3(
						"If no channel is connected yet, under the text you see the explanation “[[collab.chatsEmptyHint]]” and the button [[collab.goIntegration]], which opens Settings → Integration.",
						"Ist noch kein Kanal verbunden, sehen Sie unter dem Text die Erklärung „[[collab.chatsEmptyHint]]“ und die Schaltfläche [[collab.goIntegration]], die Einstellungen → Integration öffnet.",
						"Якщо жоден канал ще не підключено, під текстом пояснення «[[collab.chatsEmptyHint]]» і кнопка [[collab.goIntegration]], яка відкриває Settings → Integration.",
					),
					t3(
						"If channels are connected, the page says “[[collab.chatsWaitingHint]]” and lists each channel as a card: the icon in the brand colour of the channel, the name of the channel and of your bot or number, and a status at the right — [[collab.chStatusOn]] (green) or [[collab.chStatusWarn]] (orange). Under the name there is a short instruction what to do to start a conversation, for example for Telegram: write any message to your bot; for the website chat: put the code from Settings → Integration → Online Chat on your website and send a test message from the chat bubble.",
						"Sind Kanäle verbunden, steht auf der Seite „[[collab.chatsWaitingHint]]“ und jeder Kanal erscheint als Karte: das Symbol in der Markenfarbe des Kanals, der Name des Kanals und Ihres Bots oder Ihrer Nummer sowie rechts ein Status — [[collab.chStatusOn]] (grün) oder [[collab.chStatusWarn]] (orange). Unter dem Namen steht eine kurze Anleitung, was zu tun ist, um ein Gespräch zu starten, etwa bei Telegram: eine beliebige Nachricht an Ihren Bot schreiben; beim Website-Chat: den Code aus Einstellungen → Integration → Online-Chat auf Ihrer Website einbauen und eine Testnachricht aus der Chat-Blase senden.",
						"Якщо канали підключено, сторінка пише «[[collab.chatsWaitingHint]]» і показує кожен канал карткою: значок у фірмовому кольорі каналу, назва каналу й вашого бота чи номера та статус праворуч — [[collab.chStatusOn]] (зелений) або [[collab.chStatusWarn]] (помаранчевий). Під назвою коротка інструкція, що зробити, щоб з’явилась розмова, наприклад для Telegram: напишіть будь-яке повідомлення вашому боту; для чату на сайті: вставте код із Settings → Integration → Online Chat на сайт і надішліть тестове повідомлення з бульбашки чату.",
					),
					t3(
						"On opening the page the CRM also checks Telegram (are messages reaching us?) and WhatsApp (does the number still answer to the saved token?). If a channel has a problem, an orange box with the reason appears under its card. The known reason “webhooks need a public https address” is translated; other texts come from the provider as they are. For a Telegram bot in local mode a note explains that new messages are fetched while the page is open (“[[collab.chPollingInfo]]”).",
						"Beim Öffnen der Seite prüft das CRM außerdem Telegram (kommen Nachrichten an?) und WhatsApp (antwortet die Nummer noch auf den gespeicherten Token?). Hat ein Kanal ein Problem, erscheint unter seiner Karte ein oranger Kasten mit dem Grund. Der bekannte Grund „Webhooks brauchen eine öffentliche https-Adresse“ ist übersetzt; andere Texte kommen unverändert vom Anbieter. Bei einem Telegram-Bot im lokalen Modus erklärt ein Hinweis, dass neue Nachrichten geholt werden, solange die Seite offen ist („[[collab.chPollingInfo]]“).",
						"Під час відкриття сторінки CRM також перевіряє Telegram (чи доходять повідомлення?) і WhatsApp (чи номер ще відповідає на збережений токен?). Якщо в каналу проблема, під його карткою з’являється помаранчевий блок із причиною. Відому причину «вебхукам потрібна публічна https-адреса» перекладено; інші тексти приходять від провайдера як є. Для Telegram-бота в локальному режимі примітка пояснює, що нові повідомлення підтягуються, поки сторінка відкрита («[[collab.chPollingInfo]]»).",
					),
					t3(
						"The button [[collab.goIntegrationFix]] at the bottom opens Settings → Integration, where you can fix the channels.",
						"Die Schaltfläche [[collab.goIntegrationFix]] unten öffnet Einstellungen → Integration, wo Sie die Kanäle reparieren können.",
						"Кнопка [[collab.goIntegrationFix]] унизу відкриває Settings → Integration, де можна виправити канали.",
					),
				],
			},
			{
				title: t3("The list of conversations", "Die Gesprächsliste", "Список розмов"),
				steps: [
					t3(
						"On a wide screen the list stands in a column at the left and the open conversation at the right. On a tablet only the conversation is shown, and the list slides in from the right when you click the messages icon ([[collab.conversations]]) in the header of the conversation; a click outside the panel closes it. On a phone the list is a separate screen: a tap on a conversation opens it, and the arrow [[collab.back]] in its header returns to the list.",
						"Auf einem breiten Bildschirm steht die Liste in einer Spalte links und das geöffnete Gespräch rechts. Auf einem Tablet wird nur das Gespräch gezeigt; die Liste fährt von rechts ein, wenn Sie im Kopf des Gesprächs auf das Nachrichtensymbol ([[collab.conversations]]) klicken; ein Klick außerhalb des Panels schließt sie. Auf einem Smartphone ist die Liste ein eigener Bildschirm: Ein Tipp auf ein Gespräch öffnet es, der Pfeil [[collab.back]] in seinem Kopf führt zurück zur Liste.",
						"На широкому екрані список стоїть у стовпці ліворуч, а відкрита розмова — праворуч. На планшеті показано лише розмову, а список висувається праворуч, коли клацнути значок повідомлень ([[collab.conversations]]) у шапці розмови; клік поза панеллю закриває її. На телефоні список — окремий екран: дотик до розмови відкриває її, а стрілка [[collab.back]] у шапці повертає до списку.",
					),
					t3(
						"Each row shows an avatar with initials, a small icon of the channel, the name of the person (or the phone number), the time of the last message (on a tablet it is hidden) and the beginning of the last message. A green round counter is the number of unread incoming messages. The conversation that is open is highlighted. When you open the page on a wide screen, the first conversation is opened at once.",
						"Jede Zeile zeigt einen Avatar mit Initialen, ein kleines Symbol des Kanals, den Namen der Person (oder die Telefonnummer), die Zeit der letzten Nachricht (auf dem Tablet ausgeblendet) und den Anfang der letzten Nachricht. Ein grüner runder Zähler ist die Zahl ungelesener eingehender Nachrichten. Das geöffnete Gespräch ist hervorgehoben. Öffnen Sie die Seite auf einem breiten Bildschirm, wird das erste Gespräch sofort geöffnet.",
						"Кожен рядок показує аватар з ініціалами, маленький значок каналу, ім’я людини (або номер телефону), час останнього повідомлення (на планшеті сховано) і початок останнього повідомлення. Зелений круглий лічильник — кількість непрочитаних вхідних повідомлень. Відкриту розмову підсвічено. Коли ви відкриваєте сторінку на широкому екрані, перша розмова відкривається одразу.",
					),
					t3(
						"The list is refreshed every 6 seconds and the open conversation every 3 seconds, so new messages appear by themselves. A conversation counts as read only when you actually open it (on a phone — when you tap it), and its counter is reset.",
						"Die Liste wird alle 6 Sekunden aktualisiert und das geöffnete Gespräch alle 3 Sekunden, neue Nachrichten erscheinen also von selbst. Ein Gespräch gilt erst als gelesen, wenn Sie es tatsächlich öffnen (auf dem Smartphone — wenn Sie darauf tippen), und sein Zähler wird zurückgesetzt.",
						"Список оновлюється кожні 6 секунд, а відкрита розмова — кожні 3 секунди, тож нові повідомлення з’являються самі. Розмова вважається прочитаною, лише коли ви її справді відкрили (на телефоні — торкнулися), і її лічильник скидається.",
					),
				],
			},
			{
				title: t3("Reading and answering", "Lesen und Antworten", "Читання й відповіді"),
				steps: [
					t3(
						"The header of a conversation shows the name of the person and the icon of the channel. The messages go one under another: your outgoing ones on the right with a green tint and the label “[[collab.you]]”, incoming ones on the left with the name of the person; next to each one is the time. The view scrolls to the last message by itself.",
						"Der Kopf eines Gesprächs zeigt den Namen der Person und das Symbol des Kanals. Die Nachrichten stehen untereinander: Ihre ausgehenden rechts mit grünem Schimmer und der Kennzeichnung „[[collab.you]]“, eingehende links mit dem Namen der Person; daneben jeweils die Uhrzeit. Die Ansicht scrollt selbst zur letzten Nachricht.",
						"У шапці розмови — ім’я людини та значок каналу. Повідомлення йдуть одне під одним: ваші вихідні праворуч із зеленуватим відтінком і підписом «[[collab.you]]», вхідні ліворуч з іменем людини; поруч із кожним — час. Вікно саме прокручується до останнього повідомлення.",
					),
					t3(
						"Type your answer into the line at the bottom (“[[collab.writeMessage]]”, up to 2000 characters) and press Enter. There is no send button: Enter is the only way. The message goes to the customer through the same channel — Telegram, Viber, Messenger, WhatsApp or an SMS provider. In the chat of the website the visitor picks the message up at the next poll of the bubble.",
						"Tippen Sie Ihre Antwort in die Zeile unten („[[collab.writeMessage]]“, bis 2000 Zeichen) und drücken Sie die Eingabetaste. Eine Senden-Schaltfläche gibt es nicht: Die Eingabetaste ist der einzige Weg. Die Nachricht geht über denselben Kanal an den Kunden — Telegram, Viber, Messenger, WhatsApp oder einen SMS-Anbieter. Im Website-Chat holt der Besucher die Nachricht bei der nächsten Abfrage der Chat-Blase ab.",
						"Введіть відповідь у рядок унизу («[[collab.writeMessage]]», до 2000 символів) і натисніть Enter. Кнопки надсилання немає: Enter — єдиний спосіб. Повідомлення йде клієнту тим самим каналом — Telegram, Viber, Messenger, WhatsApp чи SMS-провайдером. У чаті на сайті відвідувач забирає повідомлення під час наступного опитування бульбашки.",
					),
					t3(
						"If the channel refuses (for example, the token is wrong or the customer has blocked the bot), a red message appears (its text is the reason of the provider, or “[[collab.sendFailed]]”), and your text stays in the line so that you can send it again.",
						"Lehnt der Kanal ab (z. B. falscher Token oder der Kunde hat den Bot blockiert), erscheint eine rote Meldung (ihr Text ist der Grund des Anbieters oder „[[collab.sendFailed]]“), und Ihr Text bleibt in der Zeile, damit Sie ihn erneut senden können.",
						"Якщо канал відмовляє (наприклад, хибний токен або клієнт заблокував бота), з’являється червоне повідомлення (його текст — причина від провайдера або «[[collab.sendFailed]]»), а ваш текст лишається в рядку, щоб надіслати його ще раз.",
					),
					t3(
						"For a conversation of the channel [[collab.ch_sip]] the line at the bottom is replaced by the note “[[collab.callsOnly]]”: this provider works with calls only.",
						"Bei einem Gespräch des Kanals [[collab.ch_sip]] wird die Zeile unten durch den Hinweis „[[collab.callsOnly]]“ ersetzt: Dieser Anbieter arbeitet nur mit Anrufen.",
						"Для розмови каналу [[collab.ch_sip]] рядок унизу замінено приміткою «[[collab.callsOnly]]»: цей провайдер працює лише з дзвінками.",
					),
				],
			},
			{
				title: t3("Files, photos and voice messages", "Dateien, Fotos und Sprachnachrichten", "Файли, фото й голосові повідомлення"),
				steps: [
					t3(
						"Only in conversations of Telegram and Viber, two more buttons appear at the right end of the input line: the microphone ([[collab.recordVoice]]) and the paper clip ([[collab.attach]]). In other channels they are not shown.",
						"Nur in Gesprächen von Telegram und Viber erscheinen am rechten Ende der Eingabezeile zwei weitere Schaltflächen: das Mikrofon ([[collab.recordVoice]]) und die Büroklammer ([[collab.attach]]). In anderen Kanälen werden sie nicht angezeigt.",
						"Лише в розмовах Telegram і Viber на правому краї рядка введення з’являються ще дві кнопки: мікрофон ([[collab.recordVoice]]) і скріпка ([[collab.attach]]). В інших каналах їх не показано.",
					),
					t3(
						"The paper clip opens the file dialog of your computer. Choose a photo or a file (up to 4 MB): it is first saved in the storage of your company and then sent to the customer. If you have typed some text in the line before, that text goes as the caption of the file (in Viber the caption goes as a separate message). If file storage is not connected on the server, an error appears instead.",
						"Die Büroklammer öffnet den Dateidialog Ihres Computers. Wählen Sie ein Foto oder eine Datei (bis 4 MB): Sie wird zuerst im Speicher Ihrer Firma abgelegt und dann an den Kunden gesendet. Haben Sie zuvor Text in die Zeile getippt, geht dieser Text als Bildunterschrift der Datei mit (bei Viber als eigene Nachricht). Ist auf dem Server kein Dateispeicher verbunden, erscheint stattdessen ein Fehler.",
						"Скріпка відкриває файловий діалог вашого комп’ютера. Виберіть фото чи файл (до 4 МБ): спершу його зберігають у сховищі вашої компанії, потім надсилають клієнту. Якщо ви перед цим ввели текст у рядок, цей текст іде як підпис до файлу (у Viber підпис іде окремим повідомленням). Якщо на сервері не підключено сховище файлів, замість цього з’являється помилка.",
					),
					t3(
						"The microphone starts a voice recording (the browser asks for permission for the microphone the first time; if it is denied or missing, the message “[[collab.micDenied]]” appears). While recording the button is red, pulsing and turns into a stop square ([[collab.stopRecording]]). A click on it stops the recording and sends the voice message at once as an audio file. In Telegram it is converted into the voice format of Telegram.",
						"Das Mikrofon startet eine Sprachaufnahme (der Browser fragt beim ersten Mal nach der Erlaubnis für das Mikrofon; ist sie verweigert oder fehlt das Gerät, erscheint die Meldung „[[collab.micDenied]]“). Während der Aufnahme ist die Schaltfläche rot, pulsiert und wird zum Stopp-Quadrat ([[collab.stopRecording]]). Ein Klick beendet die Aufnahme und sendet die Sprachnachricht sofort als Audiodatei. In Telegram wird sie in das Sprachformat von Telegram umgewandelt.",
						"Мікрофон запускає запис голосу (браузер уперше просить дозвіл на мікрофон; якщо його відхилено чи мікрофона немає, з’являється повідомлення «[[collab.micDenied]]»). Під час запису кнопка червона, пульсує й перетворюється на квадрат зупинки ([[collab.stopRecording]]). Клік зупиняє запис і одразу надсилає голосове повідомлення як аудіофайл. У Telegram його перетворюють на голосовий формат Telegram.",
					),
					t3(
						"Incoming and outgoing attachments are shown in the conversation: a photo as a picture (a click opens it in a new tab), a voice message as a player with the usual audio controls, any other file as a card with an icon, the file name and the size, which downloads the file on a click. While the file is being prepared the bubble shows “[[collab.attachmentLoading]]”.",
						"Ein- und ausgehende Anhänge werden im Gespräch angezeigt: ein Foto als Bild (ein Klick öffnet es in einem neuen Tab), eine Sprachnachricht als Player mit den üblichen Audio-Bedienelementen, jede andere Datei als Karte mit Symbol, Dateiname und Größe, die beim Klick die Datei herunterlädt. Während die Datei vorbereitet wird, zeigt die Blase „[[collab.attachmentLoading]]“.",
						"Вхідні й вихідні вкладення показуються в розмові: фото — зображенням (клік відкриває його в новій вкладці), голосове — програвачем зі звичайними елементами керування звуком, будь-який інший файл — карткою зі значком, іменем і розміром, що завантажує файл по кліку. Поки файл готується, у бульбашці «[[collab.attachmentLoading]]».",
					),
				],
			},
			{
				title: t3("Calls from a conversation and deleting", "Anrufe aus dem Gespräch und Löschen", "Дзвінки з розмови та видалення"),
				steps: [
					t3(
						"In conversations of the channels [[collab.ch_twilio]] and [[collab.ch_sip]] the header has a phone icon ([[collab.call]]). It starts a call to the number of the customer through the phone widget (see the next block). If the phone is not connected, the message “[[collab.phoneNotReady]]” appears; if a call is already going on, the click does nothing. When the provider of the conversation differs from the one that is chosen in the phone, the phone switches to the provider of this conversation first.",
						"In Gesprächen der Kanäle [[collab.ch_twilio]] und [[collab.ch_sip]] hat der Kopf ein Telefonsymbol ([[collab.call]]). Es startet über das Telefon-Widget einen Anruf an die Nummer des Kunden (siehe nächster Block). Ist das Telefon nicht verbunden, erscheint die Meldung „[[collab.phoneNotReady]]“; läuft schon ein Anruf, bewirkt der Klick nichts. Unterscheidet sich der Anbieter des Gesprächs von dem im Telefon gewählten, wechselt das Telefon zuerst zum Anbieter dieses Gesprächs.",
						"У розмовах каналів [[collab.ch_twilio]] і [[collab.ch_sip]] у шапці є значок телефона ([[collab.call]]). Він запускає дзвінок на номер клієнта через віджет телефона (див. наступний блок). Якщо телефон не підключено, з’являється повідомлення «[[collab.phoneNotReady]]»; якщо дзвінок уже триває, клік нічого не робить. Коли провайдер розмови відрізняється від обраного в телефоні, телефон спершу перемикається на провайдера цієї розмови.",
					),
					t3(
						"Every call — incoming, outgoing, missed — leaves a line in the conversation, centred between the messages: the direction icon, the result and the time. Texts of the result: “Incoming call · duration”, “[[collab.callLogMissed]]”, “Outgoing call · duration”, “[[collab.callLogNoAnswer]]”, “[[collab.callLogBusy]]”, “[[collab.callLogFailed]]”. The icon is green for a completed call and red otherwise.",
						"Jeder Anruf — eingehend, ausgehend, verpasst — hinterlässt eine Zeile im Gespräch, zentriert zwischen den Nachrichten: das Richtungssymbol, das Ergebnis und die Uhrzeit. Texte des Ergebnisses: „Eingehender Anruf · Dauer“, „[[collab.callLogMissed]]“, „Ausgehender Anruf · Dauer“, „[[collab.callLogNoAnswer]]“, „[[collab.callLogBusy]]“, „[[collab.callLogFailed]]“. Das Symbol ist bei einem beendeten Gespräch grün, sonst rot.",
						"Кожен дзвінок — вхідний, вихідний, пропущений — залишає рядок у розмові, по центру між повідомленнями: значок напрямку, результат і час. Тексти результату: «Вхідний дзвінок · тривалість», «[[collab.callLogMissed]]», «Вихідний дзвінок · тривалість», «[[collab.callLogNoAnswer]]», «[[collab.callLogBusy]]», «[[collab.callLogFailed]]». Значок зелений для завершеного дзвінка й червоний в інших випадках.",
					),
					t3(
						"The three-dot button ([[collab.more]]) at the right of the header opens a menu with the red item [[collab.deleteChat]]. A dialog asks “[[collab.confirmDeleteChat]]”. After the confirmation the conversation and all its messages are deleted from the CRM and the view goes back to the list (on the mobile). The conversation on the side of the messenger is not touched. If the customer writes again, a new conversation appears.",
						"Die Drei-Punkte-Schaltfläche ([[collab.more]]) rechts im Kopf öffnet ein Menü mit dem roten Eintrag [[collab.deleteChat]]. Ein Dialog fragt „[[collab.confirmDeleteChat]]“. Nach der Bestätigung werden das Gespräch und alle seine Nachrichten aus dem CRM gelöscht und die Ansicht geht zur Liste zurück (auf dem Smartphone). Das Gespräch auf Seiten des Messengers bleibt unberührt. Schreibt der Kunde erneut, entsteht ein neues Gespräch.",
						"Кнопка з трьома крапками ([[collab.more]]) праворуч у шапці відкриває меню з червоним пунктом [[collab.deleteChat]]. Діалог питає «[[collab.confirmDeleteChat]]». Після підтвердження розмову та всі її повідомлення видаляють із CRM, а вигляд повертається до списку (на мобільному). Розмова на боці месенджера не зачіпається. Якщо клієнт напише знову, з’явиться нова розмова.",
					),
				],
			},
			{
				title: t3("The phone widget (bottom right)", "Das Telefon-Widget (unten rechts)", "Віджет телефона (унизу праворуч)"),
				steps: [
					t3(
						"The phone is not a part of the page [[navigation.chat_and_calls]]: it is attached once to the whole CRM, so it is available on every page, and a running call is not interrupted when you go to another page. It is started only if the plan includes the feature “channels”. The round green button with a dial pad at the bottom right ([[collab.dialerOpen]]) opens it; a small dot on it shows the connection: green — [[collab.linkReady]], orange — [[collab.linkConnecting]], grey — [[collab.linkOffline]].",
						"Das Telefon ist kein Teil der Seite [[navigation.chat_and_calls]]: Es ist einmal an das gesamte CRM angehängt und daher auf jeder Seite verfügbar; ein laufender Anruf wird beim Wechsel auf eine andere Seite nicht unterbrochen. Es wird nur gestartet, wenn der Tarif die Funktion „Kanäle“ enthält. Die runde grüne Schaltfläche mit Wähltastatur unten rechts ([[collab.dialerOpen]]) öffnet es; ein kleiner Punkt darauf zeigt die Verbindung: grün — [[collab.linkReady]], orange — [[collab.linkConnecting]], grau — [[collab.linkOffline]].",
						"Телефон — не частина сторінки [[navigation.chat_and_calls]]: його підключено один раз до всієї CRM, тому він доступний на кожній сторінці, а дзвінок, що триває, не переривається під час переходу на іншу сторінку. Його запускають, лише якщо тариф містить функцію «канали». Кругла зелена кнопка з номеронабирачем унизу праворуч ([[collab.dialerOpen]]) відкриває його; маленька крапка на ній показує зв’язок: зелена — [[collab.linkReady]], помаранчева — [[collab.linkConnecting]], сіра — [[collab.linkOffline]].",
					),
					t3(
						"If no phone provider is connected, the panel shows “[[collab.dialerConnectTitle]]”, the text “[[collab.dialerNoProvider]]” and the button [[collab.dialerConnectButton]], which leads to Settings → Integration. The dialling appears after a provider is connected. The cross at the top right ([[collab.dialerClose]]) closes the panel.",
						"Ist kein Telefonanbieter verbunden, zeigt das Panel „[[collab.dialerConnectTitle]]“, den Text „[[collab.dialerNoProvider]]“ und die Schaltfläche [[collab.dialerConnectButton]], die zu Einstellungen → Integration führt. Die Wahl erscheint, nachdem ein Anbieter verbunden ist. Das Kreuz oben rechts ([[collab.dialerClose]]) schließt das Panel.",
						"Якщо жодного телефонного провайдера не підключено, панель показує «[[collab.dialerConnectTitle]]», текст «[[collab.dialerNoProvider]]» і кнопку [[collab.dialerConnectButton]], що веде в Settings → Integration. Набір номера з’явиться після підключення провайдера. Хрестик угорі праворуч ([[collab.dialerClose]]) закриває панель.",
					),
					t3(
						"The header of the panel shows the provider. If several providers are connected, it is a drop-down list ([[collab.dialerProvider]]) where you choose the provider for the next call; during a call it is locked. Below there are two tabs: [[collab.dialerKeypad]] and [[collab.dialerRecent]].",
						"Der Kopf des Panels zeigt den Anbieter. Sind mehrere Anbieter verbunden, ist es eine Auswahlliste ([[collab.dialerProvider]]), in der Sie den Anbieter für den nächsten Anruf wählen; während eines Anrufs ist sie gesperrt. Darunter liegen zwei Tabs: [[collab.dialerKeypad]] und [[collab.dialerRecent]].",
						"У шапці панелі — провайдер. Якщо підключено кількох, це випадний список ([[collab.dialerProvider]]), де ви обираєте провайдера для наступного дзвінка; під час дзвінка його заблоковано. Нижче дві вкладки: [[collab.dialerKeypad]] і [[collab.dialerRecent]].",
					),
					t3(
						"[[collab.dialerKeypad]]: the field “[[collab.dialerNumber]]” accepts digits, +, * and #; any other characters you type are removed at once. The 12 keys work like on a phone (digits with letters under them). The backspace icon ([[collab.dialerBackspace]]) deletes the last symbol. The green round button ([[collab.dialerCall]]) starts the call; Enter in the field does the same. It is inactive while the number is empty or the phone is offline; in the latter case the red text “[[collab.linkOffline]]” is shown under the keys.",
						"[[collab.dialerKeypad]]: Das Feld „[[collab.dialerNumber]]“ nimmt Ziffern, +, * und # an; alle anderen eingegebenen Zeichen werden sofort entfernt. Die 12 Tasten funktionieren wie am Telefon (Ziffern mit Buchstaben darunter). Das Rücktaste-Symbol ([[collab.dialerBackspace]]) löscht das letzte Zeichen. Die grüne runde Schaltfläche ([[collab.dialerCall]]) startet den Anruf; die Eingabetaste im Feld tut dasselbe. Sie ist inaktiv, solange die Nummer leer oder das Telefon offline ist; im letzteren Fall steht unter den Tasten der rote Text „[[collab.linkOffline]]“.",
						"[[collab.dialerKeypad]]: поле «[[collab.dialerNumber]]» приймає цифри, +, * і #; будь-які інші символи одразу видаляються. 12 клавіш працюють як на телефоні (цифри з літерами під ними). Значок backspace ([[collab.dialerBackspace]]) видаляє останній символ. Зелена кругла кнопка ([[collab.dialerCall]]) починає дзвінок; Enter у полі робить те саме. Вона неактивна, поки номер порожній або телефон офлайн; у другому випадку під клавішами червоний текст «[[collab.linkOffline]]».",
					),
					t3(
						"[[collab.dialerRecent]]: the list of recent calls with a phone arrow for the direction, the name (if the number is known) or the number, the result (duration, “[[collab.dialerMissed]]”, “[[collab.dialerNoAnswer]]”, “[[collab.dialerBusy]]”, “[[collab.dialerFailed]]”) and the time. A click on a line puts the number into the keypad and switches to the keypad, so that you can call back at once. An empty list says “[[collab.dialerNoCalls]]”.",
						"[[collab.dialerRecent]]: die Liste der letzten Anrufe mit einem Telefonpfeil für die Richtung, dem Namen (wenn die Nummer bekannt ist) oder der Nummer, dem Ergebnis (Dauer, „[[collab.dialerMissed]]“, „[[collab.dialerNoAnswer]]“, „[[collab.dialerBusy]]“, „[[collab.dialerFailed]]“) und der Uhrzeit. Ein Klick auf eine Zeile übernimmt die Nummer in die Tastatur und wechselt zur Tastatur, sodass Sie sofort zurückrufen können. Eine leere Liste zeigt „[[collab.dialerNoCalls]]“.",
						"[[collab.dialerRecent]]: список останніх дзвінків зі стрілкою телефона для напрямку, іменем (якщо номер відомий) або номером, результатом (тривалість, «[[collab.dialerMissed]]», «[[collab.dialerNoAnswer]]», «[[collab.dialerBusy]]», «[[collab.dialerFailed]]») і часом. Клік по рядку кладе номер у клавіатуру й перемикає на клавіатуру, щоб одразу передзвонити. Порожній список показує «[[collab.dialerNoCalls]]».",
					),
					t3(
						"An outgoing call: the panel changes to the call view — “[[collab.callDialing]]” with the number. When the other side answers, the status becomes “[[collab.callActive]]” and a timer runs. During the call three round buttons are available: the microphone ([[collab.callMute]], grey when muted), the dial pad (opens a keypad to send digits into the call, for example to pass a voice menu; the digits you sent are shown above it) and the red handset ([[collab.callHangup]]).",
						"Ein ausgehender Anruf: Das Panel wechselt zur Anrufansicht — „[[collab.callDialing]]“ mit der Nummer. Nimmt die Gegenseite ab, wird der Status zu „[[collab.callActive]]“ und ein Timer läuft. Während des Anrufs stehen drei runde Schaltflächen zur Verfügung: das Mikrofon ([[collab.callMute]], grau bei Stummschaltung), die Wähltastatur (öffnet eine Tastatur zum Senden von Ziffern in den Anruf, z. B. für ein Sprachmenü; die gesendeten Ziffern stehen darüber) und der rote Hörer ([[collab.callHangup]]).",
						"Вихідний дзвінок: панель змінюється на вигляд дзвінка — «[[collab.callDialing]]» з номером. Коли співрозмовник відповідає, статус стає «[[collab.callActive]]» і біжить таймер. Під час дзвінка доступні три круглі кнопки: мікрофон ([[collab.callMute]], сірий, коли вимкнено), номеронабирач (відкриває клавіатуру для надсилання цифр у дзвінок, наприклад для голосового меню; надіслані цифри показано над нею) і червона слухавка ([[collab.callHangup]]).",
					),
					t3(
						"An incoming call: the panel opens by itself, even if it was closed, and plays a ringtone (two short beeps every 3 seconds; the browser may keep the sound off until you have clicked on the page once, but the panel still appears). It shows “[[collab.callIncoming]]” and the number. The red button [[collab.callDecline]] rejects it, the green one [[collab.callAnswer]] takes it; after that the call runs as described above.",
						"Ein eingehender Anruf: Das Panel öffnet sich von selbst, auch wenn es geschlossen war, und spielt einen Klingelton (zwei kurze Signaltöne alle 3 Sekunden; der Browser kann den Ton stumm lassen, bis Sie einmal auf die Seite geklickt haben, das Panel erscheint trotzdem). Es zeigt „[[collab.callIncoming]]“ und die Nummer. Die rote Schaltfläche [[collab.callDecline]] lehnt ab, die grüne [[collab.callAnswer]] nimmt an; danach läuft der Anruf wie oben beschrieben.",
						"Вхідний дзвінок: панель відкривається сама, навіть якщо була закрита, і грає мелодію (два короткі сигнали кожні 3 секунди; браузер може тримати звук вимкненим, доки ви не клацнули по сторінці бодай раз, але панель усе одно з’являється). Вона показує «[[collab.callIncoming]]» і номер. Червона кнопка [[collab.callDecline]] відхиляє, зелена [[collab.callAnswer]] відповідає; далі дзвінок іде, як описано вище.",
					),
					t3(
						"For calls the browser needs access to the microphone. If it is refused, the message “[[collab.phoneMicError]]” appears. If the provider rejects the keys (Twilio), the message “[[collab.phoneAuthError]]” appears.",
						"Für Anrufe braucht der Browser Zugriff auf das Mikrofon. Wird er verweigert, erscheint die Meldung „[[collab.phoneMicError]]“. Lehnt der Anbieter die Schlüssel ab (Twilio), erscheint die Meldung „[[collab.phoneAuthError]]“.",
						"Для дзвінків браузеру потрібен доступ до мікрофона. Якщо його відхилено, з’являється повідомлення «[[collab.phoneMicError]]». Якщо провайдер відхиляє ключі (Twilio), з’являється повідомлення «[[collab.phoneAuthError]]».",
					),
				],
			},
		],
	},
];
