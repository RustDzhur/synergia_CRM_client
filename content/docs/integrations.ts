import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const INTEGRATIONS_DOCS: DocSection[] = [
	{
		id: "integrations",
		title: t3("Integrations: connecting channels", "Integrationen: Kanäle verbinden", "Інтеграції: підключення каналів"),
		intro: t3(
			"The tab [[settings.tabIntegration]] of [[navigation.settings]] connects the channels through which your customers reach you: calls, SMS, Viber, Telegram, Messenger, WhatsApp and the chat on your website. Everything you connect appears in [[navigation.chat_and_calls]]. Only the owner and administrators can connect or disconnect a channel; other people who have the section see the cards but cannot change them. Passwords, tokens and secrets that you enter are stored encrypted and are never shown again. The tab has no plan lock of its own, but the channels work only where the plan includes “Chat and calls”.",
			"Der Tab [[settings.tabIntegration]] in [[navigation.settings]] verbindet die Kanäle, über die Ihre Kunden Sie erreichen: Anrufe, SMS, Viber, Telegram, Messenger, WhatsApp und den Chat auf Ihrer Website. Alles, was Sie verbinden, erscheint in [[navigation.chat_and_calls]]. Nur der Inhaber und die Administratoren können einen Kanal verbinden oder trennen; andere Personen mit Zugriff auf den Bereich sehen die Karten, können sie aber nicht ändern. Passwörter, Tokens und Geheimnisse, die Sie eingeben, werden verschlüsselt gespeichert und nie wieder angezeigt. Der Tab hat keine eigene Tarifsperre, aber die Kanäle funktionieren nur dort, wo der Tarif „Chat und Anrufe“ enthält.",
			"Вкладка [[settings.tabIntegration]] у [[navigation.settings]] підключає канали, якими клієнти зв’язуються з вами: дзвінки, SMS, Viber, Telegram, Messenger, WhatsApp і чат на вашому сайті. Усе підключене з’являється в [[navigation.chat_and_calls]]. Лише власник та адміністратори можуть підключати або відключати канал; інші люди з доступом до розділу бачать картки, але не можуть їх змінювати. Паролі, токени й секрети, які ви вводите, зберігаються зашифрованими й більше ніколи не показуються. Вкладка не має власного тарифного замка, але канали працюють лише там, де тариф містить «Чат і дзвінки».",
		),
		groups: [
			{
				title: t3("The cards", "Die Karten", "Картки"),
				steps: [
					t3(
						"The tab shows ten cards in a grid (two columns on a phone and tablet, three on a desktop); each has an icon and a name: [[settings.intCall]], [[settings.intSms]], [[settings.intViber]], [[settings.intTelegram]], [[settings.intMessenger]], [[settings.intWhatsapp]], [[settings.intComments]], [[settings.intChatBot]], [[settings.intOnlineChat]] and [[settings.intWidget]].",
						"Der Tab zeigt zehn Karten in einem Raster (zwei Spalten am Telefon und Tablet, drei am Desktop); jede hat ein Symbol und einen Namen: [[settings.intCall]], [[settings.intSms]], [[settings.intViber]], [[settings.intTelegram]], [[settings.intMessenger]], [[settings.intWhatsapp]], [[settings.intComments]], [[settings.intChatBot]], [[settings.intOnlineChat]] und [[settings.intWidget]].",
						"Вкладка показує десять карток у сітці (дві колонки на телефоні й планшеті, три на комп’ютері); кожна має значок і назву: [[settings.intCall]], [[settings.intSms]], [[settings.intViber]], [[settings.intTelegram]], [[settings.intMessenger]], [[settings.intWhatsapp]], [[settings.intComments]], [[settings.intChatBot]], [[settings.intOnlineChat]] та [[settings.intWidget]].",
					),
					t3(
						"The colour of a card is its state: green — the channel is connected; orange — it is connected but needs attention (for example a token was revoked, or the webhook is not registered); grey — not connected. Click a card to open its window.",
						"Die Farbe einer Karte zeigt ihren Zustand: grün — der Kanal ist verbunden; orange — er ist verbunden, braucht aber Aufmerksamkeit (zum Beispiel wurde ein Token widerrufen oder der Webhook ist nicht registriert); grau — nicht verbunden. Klicken Sie eine Karte an, um ihr Fenster zu öffnen.",
						"Колір картки — це її стан: зелений — канал підключено; помаранчевий — підключено, але потрібна увага (наприклад, токен відкликано або вебхук не зареєстровано); сірий — не підключено. Клацніть картку, щоб відкрити її вікно.",
					),
					t3(
						"[[settings.intComments]] and [[settings.intChatBot]] are demonstration switches: they only remember the position of the switch in your browser and connect nothing (the tooltip says “[[settings.intDemo]]”). [[settings.intOnlineChat]] and [[settings.intWidget]] both open the same dialog of the chat for your website. Mailboxes are not connected here but in [[navigation.web_mails]].",
						"[[settings.intComments]] und [[settings.intChatBot]] sind Demo-Schalter: Sie merken sich nur die Stellung des Schalters in Ihrem Browser und verbinden nichts (der Tooltip sagt „[[settings.intDemo]]“). [[settings.intOnlineChat]] und [[settings.intWidget]] öffnen beide denselben Dialog des Chats für Ihre Website. Postfächer werden nicht hier, sondern in [[navigation.web_mails]] verbunden.",
						"[[settings.intComments]] і [[settings.intChatBot]] — демонстраційні перемикачі: вони лише запам’ятовують положення перемикача у вашому браузері й нічого не підключають (підказка каже «[[settings.intDemo]]»). [[settings.intOnlineChat]] і [[settings.intWidget]] відкривають той самий діалог чату для вашого сайту. Скриньки підключають не тут, а в [[navigation.web_mails]].",
					),
				],
			},
			{
				title: t3("The dialog: buttons and messages", "Der Dialog: Schaltflächen und Meldungen", "Діалог: кнопки та повідомлення"),
				steps: [
					t3(
						"The window has the name of the card as its title and a cross ([[settings.intClose]]) at the top right. Under the title a grey help text explains what to prepare at the provider and where to find the data. Below are the fields of the channel; the fields for secrets do not show what is saved, so to change a secret enter it again.",
						"Das Fenster trägt den Namen der Karte als Titel und ein Kreuz ([[settings.intClose]]) oben rechts. Unter dem Titel erklärt ein grauer Hilfetext, was Sie beim Anbieter vorbereiten und wo Sie die Daten finden. Darunter stehen die Felder des Kanals; die Felder für Geheimnisse zeigen nicht, was gespeichert ist, zum Ändern geben Sie ein Geheimnis also neu ein.",
						"Вікно має назву картки як заголовок і хрестик ([[settings.intClose]]) угорі праворуч. Під заголовком сірий довідковий текст пояснює, що підготувати в провайдера й де знайти дані. Нижче — поля каналу; поля для секретів не показують, що збережено, тож щоб змінити секрет, введіть його заново.",
					),
					t3(
						"The main button is [[settings.intConnect]] (it shows “…” while the request runs). It first checks the data with the provider — a wrong key is reported right in the window in red and nothing is saved. On success the window closes and you see a message that the channel is connected; the card turns green.",
						"Die Hauptschaltfläche ist [[settings.intConnect]] (sie zeigt „…“, solange die Anfrage läuft). Sie prüft die Daten zuerst beim Anbieter — ein falscher Schlüssel wird direkt im Fenster in Rot gemeldet, und nichts wird gespeichert. Bei Erfolg schließt sich das Fenster, und Sie sehen die Meldung, dass der Kanal verbunden ist; die Karte wird grün.",
						"Головна кнопка — [[settings.intConnect]] (поки триває запит, вона показує «…»). Вона спершу перевіряє дані в провайдера — хибний ключ повідомляється просто у вікні червоним, і нічого не зберігається. У разі успіху вікно закривається, ви бачите повідомлення, що канал підключено; картка стає зеленою.",
					),
					t3(
						"Once a channel is connected, a green line at the top of the window shows “Connected” with the name of the account. If the state is “needs attention”, an orange line says so and shows the error text. The red button [[settings.intDisconnect]] at the left asks for a confirmation (all conversations of this channel will be deleted from the CRM!) and then disconnects it. For Telegram and Viber in the error state there is also the button [[settings.intRegisterWebhook]]; on success you see “[[settings.intWebhookOk]]”.",
						"Ist ein Kanal verbunden, zeigt eine grüne Zeile oben im Fenster „Connected“ mit dem Namen des Kontos. Ist der Zustand „braucht Aufmerksamkeit“, sagt das eine orange Zeile und zeigt den Fehlertext. Die rote Schaltfläche [[settings.intDisconnect]] links fragt nach einer Bestätigung (alle Gespräche dieses Kanals werden aus dem CRM gelöscht!) und trennt ihn dann. Bei Telegram und Viber im Fehlerzustand gibt es außerdem die Schaltfläche [[settings.intRegisterWebhook]]; bei Erfolg sehen Sie „[[settings.intWebhookOk]]“.",
						"Коли канал підключено, зелений рядок угорі вікна показує «Connected» з назвою акаунта. Якщо стан «потрібна увага», це каже помаранчевий рядок і показує текст помилки. Червона кнопка [[settings.intDisconnect]] ліворуч просить підтвердження (усі розмови цього каналу буде видалено з CRM!), а потім відключає його. Для Telegram і Viber у стані помилки є також кнопка [[settings.intRegisterWebhook]]; у разі успіху ви бачите «[[settings.intWebhookOk]]».",
					),
					t3(
						"Where a field has a value to copy (an address, a token, an embed code), a button [[settings.intCopy]] puts it into the clipboard; you see “[[settings.intCopied]]” or, if the browser refuses, “[[settings.intCopyFailed]]”.",
						"Wo ein Feld einen Wert zum Kopieren hat (eine Adresse, ein Token, ein Einbettungscode), legt die Schaltfläche [[settings.intCopy]] ihn in die Zwischenablage; Sie sehen „[[settings.intCopied]]“ oder, wenn der Browser ablehnt, „[[settings.intCopyFailed]]“.",
						"Де в полі є значення для копіювання (адреса, токен, код вбудовування), кнопка [[settings.intCopy]] кладе його в буфер обміну; ви бачите «[[settings.intCopied]]» або, якщо браузер відмовив, «[[settings.intCopyFailed]]».",
					),
				],
			},
			{
				title: t3("[[settings.intCall]] and [[settings.intSms]]", "[[settings.intCall]] und [[settings.intSms]]", "[[settings.intCall]] та [[settings.intSms]]"),
				steps: [
					t3(
						"These two cards first show a row of provider tiles. Click the tile of your provider. For calls: Twilio, Telnyx, Asterisk / FreePBX, FreeSWITCH and [[settings.provCustom]] (any operator or PBX with SIP over WebSocket, wss://). For SMS: Twilio, Vonage, Plivo and Telnyx. Until a tile is chosen, a hint “[[settings.intChooseProvider]]” is displayed (the SMS card has its own similar hint). If a provider is already connected, the window opens on its tile and the tile is highlighted.",
						"Diese zwei Karten zeigen zuerst eine Reihe von Anbieter-Kacheln. Klicken Sie die Kachel Ihres Anbieters an. Für Anrufe: Twilio, Telnyx, Asterisk / FreePBX, FreeSWITCH und [[settings.provCustom]] (jeder Betreiber oder jede Telefonanlage mit SIP über WebSocket, wss://). Für SMS: Twilio, Vonage, Plivo und Telnyx. Solange keine Kachel gewählt ist, steht ein Hinweis „[[settings.intChooseProvider]]“ (die SMS-Karte hat einen ähnlichen eigenen Hinweis). Ist bereits ein Anbieter verbunden, öffnet sich das Fenster auf seiner Kachel, und die Kachel ist hervorgehoben.",
						"Ці дві картки спершу показують ряд плиток провайдерів. Клацніть плитку свого провайдера. Для дзвінків: Twilio, Telnyx, Asterisk / FreePBX, FreeSWITCH та [[settings.provCustom]] (будь-який оператор чи АТС із SIP через WebSocket, wss://). Для SMS: Twilio, Vonage, Plivo і Telnyx. Поки плитку не вибрано, показується підказка «[[settings.intChooseProvider]]» (SMS-картка має власну схожу підказку). Якщо провайдера вже підключено, вікно відкривається на його плитці, і плитку виділено.",
					),
					t3(
						"Fields per provider. Twilio: Account SID, Auth Token, Phone number. Vonage: API key, API secret, Sender (a name or a number). Plivo: Auth ID, Auth Token, Phone number. Telnyx (SMS): API key, Phone number. Press [[settings.intConnect]]. For Twilio the incoming SMS and calls are set up automatically; calls from the browser need HTTPS and access to the microphone.",
						"Felder je Anbieter. Twilio: Account SID, Auth Token, Telefonnummer. Vonage: API-Schlüssel, API-Secret, Absender (ein Name oder eine Nummer). Plivo: Auth-ID, Auth Token, Telefonnummer. Telnyx (SMS): API-Schlüssel, Telefonnummer. Drücken Sie [[settings.intConnect]]. Bei Twilio werden eingehende SMS und Anrufe automatisch eingerichtet; Anrufe aus dem Browser brauchen HTTPS und Zugriff auf das Mikrofon.",
						"Поля за провайдерами. Twilio: Account SID, Auth Token, номер телефону. Vonage: ключ API, секрет API, відправник (ім’я або номер). Plivo: Auth ID, Auth Token, номер телефону. Telnyx (SMS): ключ API, номер телефону. Натисніть [[settings.intConnect]]. Для Twilio вхідні SMS і дзвінки налаштовуються автоматично; дзвінки з браузера потребують HTTPS і доступу до мікрофона.",
					),
					t3(
						"Note for SMS: incoming SMS are accepted only for Twilio for now; with Vonage, Plivo and Telnyx only sending works (the window shows the note “[[settings.intSmsInboundNote]]”).",
						"Hinweis zu SMS: Eingehende SMS werden derzeit nur für Twilio angenommen; mit Vonage, Plivo und Telnyx funktioniert nur das Senden (das Fenster zeigt den Hinweis „[[settings.intSmsInboundNote]]“).",
						"Примітка щодо SMS: вхідні SMS наразі приймаються лише для Twilio; з Vonage, Plivo і Telnyx працює лише надсилання (вікно показує примітку «[[settings.intSmsInboundNote]]»).",
					),
					t3(
						"SIP providers (Telnyx, Asterisk / FreePBX, FreeSWITCH, [[settings.provCustom]]) have these fields: [[settings.intfSipServer]] (a wss:// address), [[settings.intfSipDomain]], [[settings.intfSipUser]], [[settings.intfSipAuthUser]] (optional), [[settings.intfSipPassword]] and [[settings.intfSipName]] (optional). For Telnyx, Asterisk and FreeSWITCH the server and the domain are pre-filled or explained by a hint under the field. Press [[settings.intConnect]]: the button shows “[[settings.intSipTesting]]” while your browser itself tries to register with the provider, and only if that succeeds are the data saved. Calls are made and received in the browser and every call is recorded in the CRM; incoming calls ring only while a CRM tab is open.",
						"SIP-Anbieter (Telnyx, Asterisk / FreePBX, FreeSWITCH, [[settings.provCustom]]) haben diese Felder: [[settings.intfSipServer]] (eine wss://-Adresse), [[settings.intfSipDomain]], [[settings.intfSipUser]], [[settings.intfSipAuthUser]] (optional), [[settings.intfSipPassword]] und [[settings.intfSipName]] (optional). Bei Telnyx, Asterisk und FreeSWITCH sind Server und Domain vorausgefüllt oder durch einen Hinweis unter dem Feld erklärt. Drücken Sie [[settings.intConnect]]: Die Schaltfläche zeigt „[[settings.intSipTesting]]“, während Ihr Browser selbst versucht, sich beim Anbieter zu registrieren, und nur bei Erfolg werden die Daten gespeichert. Anrufe werden im Browser geführt und angenommen, und jeder Anruf wird im CRM protokolliert; eingehende Anrufe klingeln nur, solange ein CRM-Tab offen ist.",
						"SIP-провайдери (Telnyx, Asterisk / FreePBX, FreeSWITCH, [[settings.provCustom]]) мають такі поля: [[settings.intfSipServer]] (адреса wss://), [[settings.intfSipDomain]], [[settings.intfSipUser]], [[settings.intfSipAuthUser]] (необов’язково), [[settings.intfSipPassword]] та [[settings.intfSipName]] (необов’язково). Для Telnyx, Asterisk і FreeSWITCH сервер і домен заповнено наперед або пояснено підказкою під полем. Натисніть [[settings.intConnect]]: кнопка показує «[[settings.intSipTesting]]», поки ваш браузер сам намагається зареєструватися в провайдера, і лише за успіху дані зберігаються. Дзвінки робляться й приймаються в браузері, а кожен дзвінок записується в CRM; вхідні дзвінки дзвенять лише поки відкрита вкладка CRM.",
					),
					t3(
						"A user has one SIP connection at a time; choosing another tile replaces the existing connection (a warning says so). After connecting or disconnecting Twilio or SIP, the phone in [[navigation.chat_and_calls]] is initialised anew by itself.",
						"Ein Benutzer hat jeweils eine SIP-Verbindung; wählen Sie eine andere Kachel, ersetzt das die bestehende Verbindung (ein Hinweis sagt das). Nach dem Verbinden oder Trennen von Twilio oder SIP wird das Telefon in [[navigation.chat_and_calls]] von selbst neu initialisiert.",
						"Користувач має одне SIP-з’єднання одночасно; вибір іншої плитки замінює наявне з’єднання (попередження про це є). Після підключення чи відключення Twilio або SIP телефон у [[navigation.chat_and_calls]] ініціалізується наново сам.",
					),
				],
			},
			{
				title: t3("Telegram and Viber", "Telegram und Viber", "Telegram та Viber"),
				steps: [
					t3(
						"Telegram: in Telegram open the bot @BotFather, create a bot and copy its token. Open the card [[settings.intTelegram]], paste the token into the field [[settings.intfBotToken]] and press [[settings.intConnect]]. The CRM asks Telegram for the bot (getMe) and names the channel by its @username. The webhook is registered automatically on your public https address; if the site runs on localhost, the messages are instead fetched while [[navigation.chat_and_calls]] is open (the window says so).",
						"Telegram: Öffnen Sie in Telegram den Bot @BotFather, erstellen Sie einen Bot und kopieren Sie sein Token. Öffnen Sie die Karte [[settings.intTelegram]], fügen Sie das Token in das Feld [[settings.intfBotToken]] ein und drücken Sie [[settings.intConnect]]. Das CRM fragt Telegram nach dem Bot (getMe) und benennt den Kanal nach seinem @Benutzernamen. Der Webhook wird automatisch auf Ihrer öffentlichen https-Adresse registriert; läuft die Website auf localhost, werden die Nachrichten stattdessen abgeholt, solange [[navigation.chat_and_calls]] offen ist (das Fenster sagt das).",
						"Telegram: у Telegram відкрийте бота @BotFather, створіть бота й скопіюйте його токен. Відкрийте картку [[settings.intTelegram]], вставте токен у поле [[settings.intfBotToken]] і натисніть [[settings.intConnect]]. CRM запитує в Telegram бота (getMe) і називає канал за його @username. Вебхук реєструється автоматично на вашій публічній https-адресі; якщо сайт працює на localhost, повідомлення натомість підтягуються, поки відкрито [[navigation.chat_and_calls]] (вікно про це каже).",
					),
					t3(
						"If the site has no public https address, the error “[[settings.intErrNeedHttps]]” is displayed. Set it up, then press [[settings.intRegisterWebhook]] in the same window.",
						"Hat die Website keine öffentliche https-Adresse, erscheint der Fehler „[[settings.intErrNeedHttps]]“. Richten Sie sie ein und drücken Sie dann im selben Fenster [[settings.intRegisterWebhook]].",
						"Якщо в сайту немає публічної https-адреси, показується помилка «[[settings.intErrNeedHttps]]». Налаштуйте її, а потім натисніть у тому ж вікні [[settings.intRegisterWebhook]].",
					),
					t3(
						"Viber: create a bot account at partners.viber.com and copy its authentication token. Open [[settings.intViber]], paste it into [[settings.intfViberToken]] and press [[settings.intConnect]]. The webhook is registered automatically, with the same rule about the public https address as for Telegram.",
						"Viber: Erstellen Sie ein Bot-Konto auf partners.viber.com und kopieren Sie sein Authentifizierungs-Token. Öffnen Sie [[settings.intViber]], fügen Sie es in [[settings.intfViberToken]] ein und drücken Sie [[settings.intConnect]]. Der Webhook wird automatisch registriert, mit derselben Regel zur öffentlichen https-Adresse wie bei Telegram.",
						"Viber: створіть акаунт бота на partners.viber.com і скопіюйте його токен автентифікації. Відкрийте [[settings.intViber]], вставте його в [[settings.intfViberToken]] і натисніть [[settings.intConnect]]. Вебхук реєструється автоматично, з тим самим правилом про публічну https-адресу, що й для Telegram.",
					),
				],
			},
			{
				title: t3("Messenger and WhatsApp (via Facebook)", "Messenger und WhatsApp (über Facebook)", "Messenger та WhatsApp (через Facebook)"),
				steps: [
					t3(
						"Both channels belong to Meta. Their windows have a framed block [[settings.intFbTitle]] at the top and a manual form below it, separated by the line “[[settings.intFbOrManual]]”. Use the block first: it takes the tokens automatically.",
						"Beide Kanäle gehören zu Meta. Ihre Fenster haben oben einen umrahmten Block [[settings.intFbTitle]] und darunter ein manuelles Formular, getrennt durch die Zeile „[[settings.intFbOrManual]]“. Nutzen Sie zuerst den Block: Er übernimmt die Tokens automatisch.",
						"Обидва канали належать Meta. У їхніх вікнах угорі є рамка [[settings.intFbTitle]], а під нею — форма для ручного введення, відокремлена рядком «[[settings.intFbOrManual]]». Спершу користуйтеся рамкою: вона бере токени автоматично.",
					),
					t3(
						"If the platform’s Meta app is already set up on this site, the block shows only the note “[[settings.intFbSiteApp]]” and the button [[settings.intFbConnect]]. Otherwise it asks for the fields [[settings.intfAppId]] and [[settings.intfAppSecret]] (both required — the button stays inactive without them; take them from Meta → Settings → Basic) and shows a copyable “Return address”: add it in Meta → Facebook Login → Settings as a valid OAuth redirect URI.",
						"Ist die Meta-App der Plattform auf dieser Website schon eingerichtet, zeigt der Block nur den Hinweis „[[settings.intFbSiteApp]]“ und die Schaltfläche [[settings.intFbConnect]]. Sonst verlangt er die Felder [[settings.intfAppId]] und [[settings.intfAppSecret]] (beide Pflicht — ohne sie bleibt die Schaltfläche inaktiv; nehmen Sie sie aus Meta → Einstellungen → Allgemein) und zeigt eine kopierbare „Rückkehradresse“: Tragen Sie sie in Meta → Facebook Login → Einstellungen als gültige OAuth-Weiterleitungs-URI ein.",
						"Якщо застосунок Meta платформи вже налаштовано на цьому сайті, рамка показує лише примітку «[[settings.intFbSiteApp]]» і кнопку [[settings.intFbConnect]]. Інакше вона просить поля [[settings.intfAppId]] та [[settings.intfAppSecret]] (обидва обов’язкові — без них кнопка неактивна; беріть їх у Meta → Налаштування → Основні) і показує адресу повернення, яку можна скопіювати: додайте її в Meta → Facebook Login → Налаштування як дійсний OAuth redirect URI.",
					),
					t3(
						"Press [[settings.intFbConnect]]. The browser goes to Facebook; sign in and agree. Then you return to the CRM. If exactly one page (or number) was found, you see “[[settings.intFbReady]]” and the channel is connected. If there are several, you see “[[settings.intFbChoose]]” and a list of pages (Messenger) or numbers (WhatsApp) — click the one to connect. An error is shown as a message with its reason.",
						"Drücken Sie [[settings.intFbConnect]]. Der Browser geht zu Facebook; melden Sie sich an und stimmen Sie zu. Dann kehren Sie ins CRM zurück. Wurde genau eine Seite (oder Nummer) gefunden, sehen Sie „[[settings.intFbReady]]“, und der Kanal ist verbunden. Gibt es mehrere, sehen Sie „[[settings.intFbChoose]]“ und eine Liste von Seiten (Messenger) oder Nummern (WhatsApp) — klicken Sie die an, die verbunden werden soll. Ein Fehler wird als Meldung mit dem Grund gezeigt.",
						"Натисніть [[settings.intFbConnect]]. Браузер переходить до Facebook; увійдіть і погодьтеся. Потім ви повертаєтесь у CRM. Якщо знайдено рівно одну сторінку (або номер), ви бачите «[[settings.intFbReady]]», і канал підключено. Якщо їх кілька, ви бачите «[[settings.intFbChoose]]» і список сторінок (Messenger) чи номерів (WhatsApp) — клацніть ту, яку підключити. Помилка показується повідомленням з причиною.",
					),
					t3(
						"After connecting, the CRM subscribes the page (or WhatsApp account) and registers the webhook by itself. If that step fails, a warning shows the Callback URL and the Verify token to enter by hand in Meta.",
						"Nach dem Verbinden abonniert das CRM die Seite (oder das WhatsApp-Konto) und registriert den Webhook selbst. Schlägt dieser Schritt fehl, zeigt eine Warnung die Callback-URL und das Verify-Token zur manuellen Eingabe in Meta.",
						"Після підключення CRM сама підписується на сторінку (або акаунт WhatsApp) і реєструє вебхук. Якщо цей крок не вдався, попередження показує Callback URL і Verify token, які треба ввести вручну в Meta.",
					),
					t3(
						"Manual way — Messenger: [[settings.intfPageToken]] and [[settings.intfAppSecret]]. WhatsApp: [[settings.intfWaPhoneId]], [[settings.intfWaToken]], [[settings.intfAppSecret]] and, optionally, [[settings.intfWaWabaId]]. Press [[settings.intConnect]]. For WhatsApp the window then shows the [[settings.intCallbackUrl]] and the [[settings.intVerifyToken]] with copy buttons; enter both in the Meta app under WhatsApp → Configuration → Webhooks and subscribe to the field “messages”. Only after that do incoming messages appear in [[navigation.chat_and_calls]].",
						"Manueller Weg — Messenger: [[settings.intfPageToken]] und [[settings.intfAppSecret]]. WhatsApp: [[settings.intfWaPhoneId]], [[settings.intfWaToken]], [[settings.intfAppSecret]] und optional [[settings.intfWaWabaId]]. Drücken Sie [[settings.intConnect]]. Bei WhatsApp zeigt das Fenster danach die [[settings.intCallbackUrl]] und das [[settings.intVerifyToken]] mit Kopier-Schaltflächen; tragen Sie beide in der Meta-App unter WhatsApp → Konfiguration → Webhooks ein und abonnieren Sie das Feld „messages“. Erst danach erscheinen eingehende Nachrichten in [[navigation.chat_and_calls]].",
						"Ручний шлях — Messenger: [[settings.intfPageToken]] та [[settings.intfAppSecret]]. WhatsApp: [[settings.intfWaPhoneId]], [[settings.intfWaToken]], [[settings.intfAppSecret]] і, за бажання, [[settings.intfWaWabaId]]. Натисніть [[settings.intConnect]]. Для WhatsApp вікно потім показує [[settings.intCallbackUrl]] і [[settings.intVerifyToken]] з кнопками копіювання; введіть обидва в застосунку Meta у WhatsApp → Configuration → Webhooks і підпишіться на поле «messages». Лише після цього вхідні повідомлення з’являються в [[navigation.chat_and_calls]].",
					),
				],
			},
			{
				title: t3("Chat for your website", "Chat für Ihre Website", "Чат для вашого сайту"),
				steps: [
					t3(
						"Open [[settings.intOnlineChat]] (or [[settings.intWidget]] — it is the same window). Fill in: [[settings.intfChatTitle]], [[settings.intfGreeting]], [[settings.intfColor]] (a colour picker), the working hours [[settings.intfHoursFrom]] and [[settings.intfHoursTo]], the working days ([[settings.intfHoursDays]]; for example 1-5 means Monday to Friday) and, optionally, [[settings.intfCtaLabel]] and [[settings.intfCtaUrl]] for an extra button in the chat.",
						"Öffnen Sie [[settings.intOnlineChat]] (oder [[settings.intWidget]] — es ist dasselbe Fenster). Füllen Sie aus: [[settings.intfChatTitle]], [[settings.intfGreeting]], [[settings.intfColor]] (eine Farbauswahl), die Arbeitszeit [[settings.intfHoursFrom]] und [[settings.intfHoursTo]], die Arbeitstage ([[settings.intfHoursDays]]; zum Beispiel 1-5 bedeutet Montag bis Freitag) und optional [[settings.intfCtaLabel]] und [[settings.intfCtaUrl]] für eine zusätzliche Schaltfläche im Chat.",
						"Відкрийте [[settings.intOnlineChat]] (або [[settings.intWidget]] — це те саме вікно). Заповніть: [[settings.intfChatTitle]], [[settings.intfGreeting]], [[settings.intfColor]] (вибір кольору), робочі години [[settings.intfHoursFrom]] та [[settings.intfHoursTo]], робочі дні ([[settings.intfHoursDays]]; наприклад 1-5 означає з понеділка по п’ятницю) і, за бажання, [[settings.intfCtaLabel]] та [[settings.intfCtaUrl]] для додаткової кнопки в чаті.",
					),
					t3(
						"Press [[settings.intConnect]]. A block [[settings.intEmbedCode]] appears with a script line of the form <script src=…/widget.js data-token=… async> and a copy button. Paste it into the HTML of your website just before the closing body tag on every page where the chat should appear (see the help under the code: “[[settings.intEmbedHelp]]”). The chat button then shows on your site; what visitors write arrives in [[navigation.chat_and_calls]].",
						"Drücken Sie [[settings.intConnect]]. Es erscheint ein Block [[settings.intEmbedCode]] mit einer Skriptzeile der Form <script src=…/widget.js data-token=… async> und einer Kopier-Schaltfläche. Fügen Sie sie in das HTML Ihrer Website unmittelbar vor dem schließenden Body-Tag auf jeder Seite ein, auf der der Chat erscheinen soll (siehe Hilfe unter dem Code: „[[settings.intEmbedHelp]]“). Die Chat-Schaltfläche erscheint dann auf Ihrer Website; was Besucher schreiben, kommt in [[navigation.chat_and_calls]] an.",
						"Натисніть [[settings.intConnect]]. З’являється блок [[settings.intEmbedCode]] із рядком скрипта виду <script src=…/widget.js data-token=… async> і кнопкою копіювання. Вставте його в HTML вашого сайту перед закриваючим тегом body на кожній сторінці, де має з’явитися чат (див. довідку під кодом: «[[settings.intEmbedHelp]]»). Кнопка чату з’явиться на вашому сайті; те, що пишуть відвідувачі, надходить у [[navigation.chat_and_calls]].",
					),
					t3(
						"For an already connected chat the main button is [[settings.intSave]]: you can change the title, greeting, colour, hours and button at any time, and the change takes effect on the site at once, without touching the code. [[settings.intDisconnect]] removes the chat (and its conversations) from the CRM.",
						"Bei einem bereits verbundenen Chat heißt die Hauptschaltfläche [[settings.intSave]]: Titel, Begrüßung, Farbe, Zeiten und Schaltfläche können Sie jederzeit ändern, und die Änderung wirkt sofort auf der Website, ohne den Code anzufassen. [[settings.intDisconnect]] entfernt den Chat (und seine Gespräche) aus dem CRM.",
						"Для вже підключеного чату головна кнопка — [[settings.intSave]]: заголовок, привітання, колір, години й кнопку можна змінювати будь-коли, і зміна діє на сайті одразу, без чіпання коду. [[settings.intDisconnect]] прибирає чат (і його розмови) з CRM.",
					),
				],
			},
		],
	},
];
