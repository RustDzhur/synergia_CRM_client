import { t3 } from "../i18n";
import type { DocSection } from "./types";

// Маркетинг (вкладки Start, Campaigns, Ads, Segments, Sales Boost, My Templates) и рекламная статистика (Ad performance).
export const MARKETING_DOCS: DocSection[] = [
	{
		id: "marketing",
		title: t3("Marketing: channels, campaigns, segments", "Marketing: Kanäle, Kampagnen, Segmente", "Маркетинг: канали, кампанії, сегменти"),
		intro: t3(
			"The [[navigation.marketing]] section is included in the Professional plan. For a Manager it is open by default; an Employee or a Viewer gets it only if the owner or an admin opens it for them. The tabs are: [[marketing.tab_start]], [[marketing.tab_campaigns]], [[marketing.tab_ads]], [[marketing.tab_performance]], [[marketing.tab_segments]], [[marketing.tab_boost]] and [[marketing.tab_templates]]. Important to know: the tables [[marketing.tab_campaigns]], [[marketing.tab_ads]], [[marketing.tab_segments]], [[marketing.tab_boost]] and [[marketing.tab_templates]] are registers for planning and record keeping. The CRM does not send mailings or place advertisements from them by itself; the only live part is the tab [[marketing.tab_performance]] (real statistics from Google Ads and Meta Ads).",
			"Der Bereich [[navigation.marketing]] ist im Tarif Professional enthalten. Für einen Manager ist er standardmäßig offen; ein Mitarbeiter oder Betrachter bekommt ihn nur, wenn Inhaber oder Admin ihn freigeben. Die Tabs: [[marketing.tab_start]], [[marketing.tab_campaigns]], [[marketing.tab_ads]], [[marketing.tab_performance]], [[marketing.tab_segments]], [[marketing.tab_boost]] und [[marketing.tab_templates]]. Wichtig zu wissen: Die Tabellen [[marketing.tab_campaigns]], [[marketing.tab_ads]], [[marketing.tab_segments]], [[marketing.tab_boost]] und [[marketing.tab_templates]] sind Register zur Planung und Dokumentation. Das CRM versendet daraus nicht selbst Mailings und schaltet keine Anzeigen; live ist nur der Tab [[marketing.tab_performance]] (echte Statistiken aus Google Ads und Meta Ads).",
			"Розділ [[navigation.marketing]] входить до тарифу Professional. Для менеджера він відкритий за замовчуванням; співробітник чи глядач отримує його лише якщо власник або адміністратор відкрив доступ. Вкладки: [[marketing.tab_start]], [[marketing.tab_campaigns]], [[marketing.tab_ads]], [[marketing.tab_performance]], [[marketing.tab_segments]], [[marketing.tab_boost]] і [[marketing.tab_templates]]. Важливо знати: таблиці [[marketing.tab_campaigns]], [[marketing.tab_ads]], [[marketing.tab_segments]], [[marketing.tab_boost]] і [[marketing.tab_templates]] — це реєстри для планування та обліку. CRM сама не розсилає листи й не запускає рекламу з них; «живою» є лише вкладка [[marketing.tab_performance]] (справжня статистика Google Ads і Meta Ads).",
		),
		groups: [
			{
				title: t3("The Start tab: choose a channel", "Der Tab Start: einen Kanal wählen", "Вкладка Start: вибір каналу"),
				steps: [
					t3(
						"[[marketing.tab_start]] opens first. It shows the heading [[marketing.createCampaign]] and a grid of ten cards: [[marketing.card_email_campaign]], [[marketing.card_sms]], [[marketing.card_messengers]], [[marketing.card_voice]], [[marketing.card_audio_call]], [[marketing.card_facebook]], [[marketing.card_google]], [[marketing.card_linkedin]], [[marketing.card_twitter]] and [[marketing.card_email]]. The search field of the page filters the cards by their names; if none matches, the page says [[records.nothingFound]].",
						"[[marketing.tab_start]] öffnet sich zuerst. Er zeigt die Überschrift [[marketing.createCampaign]] und ein Raster aus zehn Karten: [[marketing.card_email_campaign]], [[marketing.card_sms]], [[marketing.card_messengers]], [[marketing.card_voice]], [[marketing.card_audio_call]], [[marketing.card_facebook]], [[marketing.card_google]], [[marketing.card_linkedin]], [[marketing.card_twitter]] und [[marketing.card_email]]. Das Suchfeld der Seite filtert die Karten nach ihren Namen; passt keine, sagt die Seite [[records.nothingFound]].",
						"Першою відкривається [[marketing.tab_start]]. Вона показує заголовок [[marketing.createCampaign]] і сітку з десяти карток: [[marketing.card_email_campaign]], [[marketing.card_sms]], [[marketing.card_messengers]], [[marketing.card_voice]], [[marketing.card_audio_call]], [[marketing.card_facebook]], [[marketing.card_google]], [[marketing.card_linkedin]], [[marketing.card_twitter]] і [[marketing.card_email]]. Поле пошуку сторінки фільтрує картки за назвами; якщо жодна не підходить, сторінка пише [[records.nothingFound]].",
					),
					t3(
						"The four advertising cards ([[marketing.card_facebook]], [[marketing.card_google]], [[marketing.card_linkedin]], [[marketing.card_twitter]]) open at once the window of a new record of the tab [[marketing.tab_ads]] with the platform already chosen.",
						"Die vier Werbekarten ([[marketing.card_facebook]], [[marketing.card_google]], [[marketing.card_linkedin]], [[marketing.card_twitter]]) öffnen sofort das Fenster eines neuen Eintrags im Tab [[marketing.tab_ads]] mit bereits gewählter Plattform.",
						"Чотири рекламні картки ([[marketing.card_facebook]], [[marketing.card_google]], [[marketing.card_linkedin]], [[marketing.card_twitter]]) одразу відкривають вікно нового запису вкладки [[marketing.tab_ads]] з уже обраною платформою.",
					),
					t3(
						"The other six cards (the channels of a mailing) open a channel window first. It has the card name as a title and the hint “[[marketing.chHint]]”.",
						"Die übrigen sechs Karten (die Kanäle einer Aussendung) öffnen zuerst ein Kanalfenster. Es trägt den Kartennamen als Titel und den Hinweis „[[marketing.chHint]]“.",
						"Решта шість карток (канали розсилки) спершу відкривають вікно каналу. Його заголовок — назва картки, а під ним підказка «[[marketing.chHint]]».",
					),
					t3(
						"The window lists the integrations that the channel needs, each with its state: [[marketing.chConnected]] (green with a tick), [[marketing.chNone]] or [[marketing.chError]] (red). Under the state, the connected mailboxes, numbers or bots are listed line by line. The integrations by channel: e-mail campaign and e-mail — mailboxes; SMS — the SMS providers Twilio, Vonage, Plivo, Telnyx; voice broadcasting and audio call — Twilio or a SIP provider; messengers — Telegram, Viber, WhatsApp, Messenger and online chat.",
						"Das Fenster listet die Integrationen, die der Kanal braucht, jeweils mit ihrem Zustand: [[marketing.chConnected]] (grün mit Haken), [[marketing.chNone]] oder [[marketing.chError]] (rot). Unter dem Zustand stehen die verbundenen Postfächer, Nummern oder Bots zeilenweise. Die Integrationen je Kanal: E-Mail-Kampagne und E-Mail — Postfächer; SMS — die SMS-Anbieter Twilio, Vonage, Plivo, Telnyx; Sprachrundruf und Audioanruf — Twilio oder ein SIP-Anbieter; Messenger — Telegram, Viber, WhatsApp, Messenger und Online-Chat.",
						"Вікно перелічує інтеграції, потрібні каналу, кожну зі станом: [[marketing.chConnected]] (зелений із галочкою), [[marketing.chNone]] або [[marketing.chError]] (червоний). Під станом по рядках показано підключені скриньки, номери чи боти. Інтеграції за каналами: e-mail-кампанія й e-mail — поштові скриньки; SMS — SMS-провайдери Twilio, Vonage, Plivo, Telnyx; голосова розсилка й аудіодзвінок — Twilio або SIP-провайдер; месенджери — Telegram, Viber, WhatsApp, Messenger та онлайн-чат.",
					),
					t3(
						"For the mailbox line there is a link [[marketing.chMail]] that goes to [[navigation.web_mails]]. For the other integrations there is a button: [[settings.intConnect]] (if nothing is connected yet) or [[marketing.chSetup]]. It opens the same window for the access data as in [[navigation.settings]] → Integration, so the keys are entered once and in one place.",
						"Bei der Postfachzeile gibt es einen Link [[marketing.chMail]], der zu [[navigation.web_mails]] führt. Bei den übrigen Integrationen gibt es eine Schaltfläche: [[settings.intConnect]] (wenn noch nichts verbunden ist) oder [[marketing.chSetup]]. Sie öffnet dasselbe Fenster für die Zugangsdaten wie in [[navigation.settings]] → Integration, die Schlüssel werden also einmal und an einer Stelle eingegeben.",
						"Для рядка скриньок є посилання [[marketing.chMail]], що веде до [[navigation.web_mails]]. Для решти інтеграцій є кнопка: [[settings.intConnect]] (якщо ще нічого не підключено) або [[marketing.chSetup]]. Вона відкриває те саме вікно даних доступу, що й у [[navigation.settings]] → Integration, тож ключі вводяться один раз і в одному місці.",
					),
					t3(
						"At the bottom: the link [[marketing.chAll]] (to Settings → Integration), the button [[settings.intClose]] and the main button [[marketing.createCampaign]]. When no integration of the channel is connected, the main button is pale and a note says “[[marketing.chNoIntegration]]”; it still works. It closes the window and opens a new record of the tab [[marketing.tab_campaigns]] with the channel already chosen.",
						"Unten: der Link [[marketing.chAll]] (zu Einstellungen → Integration), die Schaltfläche [[settings.intClose]] und die Hauptschaltfläche [[marketing.createCampaign]]. Ist keine Integration des Kanals verbunden, ist die Hauptschaltfläche blass, und ein Hinweis sagt „[[marketing.chNoIntegration]]“; sie funktioniert trotzdem. Sie schließt das Fenster und öffnet einen neuen Eintrag im Tab [[marketing.tab_campaigns]] mit bereits gewähltem Kanal.",
						"Унизу: посилання [[marketing.chAll]] (до Settings → Integration), кнопка [[settings.intClose]] і головна кнопка [[marketing.createCampaign]]. Коли жодної інтеграції каналу не підключено, головна кнопка бліда, а примітка каже «[[marketing.chNoIntegration]]»; кнопка все одно працює. Вона закриває вікно й відкриває новий запис вкладки [[marketing.tab_campaigns]] з уже обраним каналом.",
					),
				],
			},
			{
				title: t3("Campaigns, Ads, Segments, Sales Boost, My Templates", "Kampagnen, Anzeigen, Segmente, Sales-Boost, Meine Vorlagen", "Кампанії, Реклама, Сегменти, Sales Boost, Мої шаблони"),
				steps: [
					t3(
						"These five tabs are ordinary tables; the toolbar, search, sorting, column list, row selection, record window and deletion are described in the section “Tables” below. Here are the fields of each table.",
						"Diese fünf Tabs sind gewöhnliche Tabellen; Werkzeugleiste, Suche, Sortierung, Spaltenliste, Zeilenauswahl, Eintragsfenster und Löschen sind im Abschnitt „Tabellen“ weiter unten beschrieben. Hier die Felder jeder Tabelle.",
						"Ці п’ять вкладок — звичайні таблиці; панель, пошук, сортування, список стовпців, вибір рядків, вікно запису й видалення описано в розділі «Таблиці» нижче. Ось поля кожної таблиці.",
					),
					t3(
						"[[marketing.tab_campaigns]] (record type “[[marketing.s_campaigns]]”): [[marketing.f_name]] (required), [[marketing.f_channel]] ([[marketing.o_email_campaign]], [[marketing.o_sms]], [[marketing.o_messengers]], [[marketing.o_voice]], [[marketing.o_audio_call]] or [[marketing.o_email]]), [[marketing.f_segment]] (free text), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_scheduled]] or [[marketing.o_sent]]), [[marketing.f_date]] and [[marketing.f_recipients]] (a number).",
						"[[marketing.tab_campaigns]] (Eintragsart „[[marketing.s_campaigns]]“): [[marketing.f_name]] (Pflicht), [[marketing.f_channel]] ([[marketing.o_email_campaign]], [[marketing.o_sms]], [[marketing.o_messengers]], [[marketing.o_voice]], [[marketing.o_audio_call]] oder [[marketing.o_email]]), [[marketing.f_segment]] (Freitext), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_scheduled]] oder [[marketing.o_sent]]), [[marketing.f_date]] und [[marketing.f_recipients]] (eine Zahl).",
						"[[marketing.tab_campaigns]] (тип запису «[[marketing.s_campaigns]]»): [[marketing.f_name]] (обов’язкове), [[marketing.f_channel]] ([[marketing.o_email_campaign]], [[marketing.o_sms]], [[marketing.o_messengers]], [[marketing.o_voice]], [[marketing.o_audio_call]] або [[marketing.o_email]]), [[marketing.f_segment]] (довільний текст), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_scheduled]] або [[marketing.o_sent]]), [[marketing.f_date]] і [[marketing.f_recipients]] (число).",
					),
					t3(
						"[[marketing.tab_ads]] (record type “[[marketing.s_ads]]”): [[marketing.f_name]] (required), [[marketing.f_platform]] ([[marketing.o_facebook]], [[marketing.o_google]], [[marketing.o_linkedin]] or [[marketing.o_twitter]]), [[marketing.f_budget]] (a number), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_active]], [[marketing.o_paused]] or [[marketing.o_finished]]), [[marketing.f_start]] and [[marketing.f_end]] (dates).",
						"[[marketing.tab_ads]] (Eintragsart „[[marketing.s_ads]]“): [[marketing.f_name]] (Pflicht), [[marketing.f_platform]] ([[marketing.o_facebook]], [[marketing.o_google]], [[marketing.o_linkedin]] oder [[marketing.o_twitter]]), [[marketing.f_budget]] (eine Zahl), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_active]], [[marketing.o_paused]] oder [[marketing.o_finished]]), [[marketing.f_start]] und [[marketing.f_end]] (Daten).",
						"[[marketing.tab_ads]] (тип запису «[[marketing.s_ads]]»): [[marketing.f_name]] (обов’язкове), [[marketing.f_platform]] ([[marketing.o_facebook]], [[marketing.o_google]], [[marketing.o_linkedin]] або [[marketing.o_twitter]]), [[marketing.f_budget]] (число), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_active]], [[marketing.o_paused]] або [[marketing.o_finished]]), [[marketing.f_start]] і [[marketing.f_end]] (дати).",
					),
					t3(
						"[[marketing.tab_segments]] (record type “[[marketing.s_segments]]”): [[marketing.f_name]] (required), [[marketing.f_description]] (a wide field), [[marketing.f_contacts]] (a number) and [[marketing.f_updated]] (a date). A segment is a note about a group of customers; the numbers are entered by hand.",
						"[[marketing.tab_segments]] (Eintragsart „[[marketing.s_segments]]“): [[marketing.f_name]] (Pflicht), [[marketing.f_description]] (ein breites Feld), [[marketing.f_contacts]] (eine Zahl) und [[marketing.f_updated]] (ein Datum). Ein Segment ist eine Notiz über eine Kundengruppe; die Zahlen werden von Hand eingetragen.",
						"[[marketing.tab_segments]] (тип запису «[[marketing.s_segments]]»): [[marketing.f_name]] (обов’язкове), [[marketing.f_description]] (широке поле), [[marketing.f_contacts]] (число) і [[marketing.f_updated]] (дата). Сегмент — це нотатка про групу клієнтів; числа вводяться вручну.",
					),
					t3(
						"[[marketing.tab_boost]] (record type “[[marketing.s_boost]]”): [[marketing.f_name]] (required), [[marketing.f_type]] ([[marketing.o_discount]], [[marketing.o_bundle]], [[marketing.o_loyalty]] or [[marketing.o_upsell]]), [[marketing.f_value]] (a number), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_active]] or [[marketing.o_finished]]), [[marketing.f_start]] and [[marketing.f_end]] (dates).",
						"[[marketing.tab_boost]] (Eintragsart „[[marketing.s_boost]]“): [[marketing.f_name]] (Pflicht), [[marketing.f_type]] ([[marketing.o_discount]], [[marketing.o_bundle]], [[marketing.o_loyalty]] oder [[marketing.o_upsell]]), [[marketing.f_value]] (eine Zahl), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_active]] oder [[marketing.o_finished]]), [[marketing.f_start]] und [[marketing.f_end]] (Daten).",
						"[[marketing.tab_boost]] (тип запису «[[marketing.s_boost]]»): [[marketing.f_name]] (обов’язкове), [[marketing.f_type]] ([[marketing.o_discount]], [[marketing.o_bundle]], [[marketing.o_loyalty]] або [[marketing.o_upsell]]), [[marketing.f_value]] (число), [[marketing.f_status]] ([[marketing.o_draft]], [[marketing.o_active]] або [[marketing.o_finished]]), [[marketing.f_start]] і [[marketing.f_end]] (дати).",
					),
					t3(
						"[[marketing.tab_templates]] (record type “[[marketing.s_templates]]”): [[marketing.f_name]] (required), [[marketing.f_channel]] (the same list as for campaigns), [[marketing.f_author]] (free text) and [[marketing.f_updated]] (a date).",
						"[[marketing.tab_templates]] (Eintragsart „[[marketing.s_templates]]“): [[marketing.f_name]] (Pflicht), [[marketing.f_channel]] (dieselbe Liste wie bei Kampagnen), [[marketing.f_author]] (Freitext) und [[marketing.f_updated]] (ein Datum).",
						"[[marketing.tab_templates]] (тип запису «[[marketing.s_templates]]»): [[marketing.f_name]] (обов’язкове), [[marketing.f_channel]] (той самий список, що й для кампаній), [[marketing.f_author]] (довільний текст) і [[marketing.f_updated]] (дата).",
					),
				],
			},
		],
	},
	{
		id: "ads",
		title: t3("Ad performance: Google Ads and Meta Ads", "Werbeleistung: Google Ads und Meta Ads", "Ad performance: Google Ads і Meta Ads"),
		intro: t3(
			"The tab [[marketing.tab_performance]] of [[navigation.marketing]] connects your Google Ads and Meta Ads (Facebook and Instagram) accounts and shows real spend, clicks and conversions. It reads the data only; your campaigns on the platform are never changed. The feature is included in the Professional plan. In addition the site administrator has to set up the platform keys; otherwise the platform card says “[[ads.notConfigured]]”.",
			"Der Tab [[marketing.tab_performance]] in [[navigation.marketing]] verbindet Ihre Konten bei Google Ads und Meta Ads (Facebook und Instagram) und zeigt echte Ausgaben, Klicks und Conversions. Er liest nur Daten; Ihre Kampagnen auf der Plattform werden nie verändert. Die Funktion gehört zum Tarif Professional. Zusätzlich muss der Seitenadministrator die Plattformschlüssel einrichten; sonst sagt die Plattformkarte „[[ads.notConfigured]]“.",
			"Вкладка [[marketing.tab_performance]] розділу [[navigation.marketing]] підключає ваші акаунти Google Ads і Meta Ads (Facebook та Instagram) і показує справжні витрати, кліки й конверсії. Вона лише читає дані; ваші кампанії на платформі ніколи не змінюються. Функція входить до тарифу Professional. Крім того, адміністратор сайту має налаштувати ключі платформ; інакше картка платформи пише «[[ads.notConfigured]]».",
		),
		groups: [
			{
				title: t3("Connecting a platform", "Eine Plattform verbinden", "Підключення платформи"),
				steps: [
					t3(
						"Open [[marketing.tab_performance]]. Under the heading [[ads.platforms]] there are two cards: [[ads.google]] and [[ads.meta]]. Each card has the platform logo above it.",
						"Öffnen Sie [[marketing.tab_performance]]. Unter der Überschrift [[ads.platforms]] stehen zwei Karten: [[ads.google]] und [[ads.meta]]. Über jeder Karte steht das Logo der Plattform.",
						"Відкрийте [[marketing.tab_performance]]. Під заголовком [[ads.platforms]] дві картки: [[ads.google]] і [[ads.meta]]. Над кожною карткою — логотип платформи.",
					),
					t3(
						"Press [[ads.connect]] on the platform card. Your browser goes to the login page of Google or Meta; sign in and allow access. You return to the tab with the message “[[ads.connectedOk]]”. If you refuse access, you see “[[ads.denied]]”; if something else fails, “[[ads.failed]]” or the explanation of the platform.",
						"Klicken Sie auf der Plattformkarte auf [[ads.connect]]. Ihr Browser wechselt zur Anmeldeseite von Google oder Meta; melden Sie sich an und erlauben Sie den Zugriff. Sie kehren mit der Meldung „[[ads.connectedOk]]“ zum Tab zurück. Verweigern Sie den Zugriff, sehen Sie „[[ads.denied]]“; scheitert etwas anderes, „[[ads.failed]]“ oder die Erklärung der Plattform.",
						"Натисніть [[ads.connect]] на картці платформи. Браузер переходить на сторінку входу Google або Meta; увійдіть і дозвольте доступ. Ви повертаєтеся на вкладку з повідомленням «[[ads.connectedOk]]». Якщо відмовити в доступі, побачите «[[ads.denied]]»; якщо не вдалося щось інше — «[[ads.failed]]» або пояснення платформи.",
					),
					t3(
						"The button is inactive if the platform keys are not set up on the site (the card says so) or if your plan does not allow advertising.",
						"Die Schaltfläche ist inaktiv, wenn die Plattformschlüssel auf der Seite nicht eingerichtet sind (die Karte sagt es) oder wenn Ihr Tarif Werbung nicht erlaubt.",
						"Кнопка неактивна, якщо ключі платформи на сайті не налаштовано (картка про це каже) або якщо ваш тариф не дозволяє рекламу.",
					),
					t3(
						"After the connection the card shows a status line: green “[[ads.connected]]”, for Meta “Connected · access valid until” followed by a date, or red “[[ads.expired]]” (press [[ads.reconnect]]). If the platform reports an error, its text is shown in red.",
						"Nach der Verbindung zeigt die Karte eine Statuszeile: grün „[[ads.connected]]“, bei Meta „Verbunden · Zugriff gültig bis“ mit einem Datum, oder rot „[[ads.expired]]“ (klicken Sie auf [[ads.reconnect]]). Meldet die Plattform einen Fehler, wird ihr Text rot angezeigt.",
						"Після підключення картка показує рядок стану: зелений «[[ads.connected]]», для Meta — «Підключено · доступ діє до» з датою, або червоний «[[ads.expired]]» (натисніть [[ads.reconnect]]). Якщо платформа повідомляє помилку, її текст показується червоним.",
					),
					t3(
						"The list [[ads.account]] under the status selects which of your ad accounts is shown (name and currency); while none is chosen, the list says [[ads.chooseAccount]]. The choice is saved at once.",
						"Die Liste [[ads.account]] unter dem Status wählt, welches Ihrer Werbekonten angezeigt wird (Name und Währung); solange keines gewählt ist, steht in der Liste [[ads.chooseAccount]]. Die Auswahl wird sofort gespeichert.",
						"Список [[ads.account]] під станом обирає, який із ваших рекламних акаунтів показувати (назва й валюта); поки жоден не обрано, у списку написано [[ads.chooseAccount]]. Вибір зберігається одразу.",
					),
					t3(
						"[[ads.reconnect]] (in place of [[ads.connect]] once connected) repeats the login. [[ads.disconnect]] asks for a confirmation (“Disconnect the platform? Your campaigns stay untouched on the platform.”) and removes the connection from the CRM.",
						"[[ads.reconnect]] (anstelle von [[ads.connect]], sobald verbunden) wiederholt die Anmeldung. [[ads.disconnect]] fragt nach („Plattform trennen? Ihre Kampagnen auf der Plattform bleiben unverändert.“) und entfernt die Verbindung aus dem CRM.",
						"[[ads.reconnect]] (замість [[ads.connect]] після підключення) повторює вхід. [[ads.disconnect]] просить підтвердження («Відключити платформу? Ваші кампанії на платформі лишаться без змін.») і прибирає підключення з CRM.",
					),
				],
			},
			{
				title: t3("Reading the statistics", "Die Statistik lesen", "Читання статистики"),
				steps: [
					t3(
						"Once an account is connected and chosen, the block [[ads.performance]] appears with a list [[ads.period]] at the top right with the options “Last 7 days”, “Last 30 days” and “Last 90 days”. Changing the period reloads the figures.",
						"Sobald ein Konto verbunden und gewählt ist, erscheint der Block [[ads.performance]] mit einer Liste [[ads.period]] oben rechts mit den Optionen „Letzte 7 Tage“, „Letzte 30 Tage“ und „Letzte 90 Tage“. Ein Wechsel des Zeitraums lädt die Zahlen neu.",
						"Щойно акаунт підключено й обрано, з’являється блок [[ads.performance]] зі списком [[ads.period]] угорі праворуч із варіантами «Останні 7 днів», «Останні 30 днів» і «Останні 90 днів». Зміна періоду перезавантажує цифри.",
					),
					t3(
						"For every connected account there is a card with the platform and the account name. At the top six figures: [[ads.spend]], [[ads.clicks]], [[ads.impressions]], [[ads.conversions]], [[ads.ctr]] (clicks divided by impressions, in percent) and [[ads.cpc]] (spend divided by clicks). They are totals of the chosen period.",
						"Für jedes verbundene Konto gibt es eine Karte mit Plattform und Kontoname. Oben sechs Kennzahlen: [[ads.spend]], [[ads.clicks]], [[ads.impressions]], [[ads.conversions]], [[ads.ctr]] (Klicks geteilt durch Impressionen, in Prozent) und [[ads.cpc]] (Ausgaben geteilt durch Klicks). Es sind Summen des gewählten Zeitraums.",
						"Для кожного підключеного акаунта є картка з платформою й назвою акаунта. Угорі шість показників: [[ads.spend]], [[ads.clicks]], [[ads.impressions]], [[ads.conversions]], [[ads.ctr]] (кліки, поділені на покази, у відсотках) і [[ads.cpc]] (витрати, поділені на кліки). Це підсумки за обраний період.",
					),
					t3(
						"Under the figures a bar chart shows the spend by day. Move the mouse over a bar: the top line of the chart shows the date, the spend and the clicks of that day. Without hovering, the day with the highest spend is highlighted.",
						"Unter den Kennzahlen zeigt ein Balkendiagramm die Ausgaben pro Tag. Fahren Sie mit der Maus über einen Balken: Die obere Zeile des Diagramms zeigt Datum, Ausgaben und Klicks dieses Tages. Ohne Berührung ist der Tag mit den höchsten Ausgaben hervorgehoben.",
						"Під показниками стовпчикова діаграма показує витрати по днях. Наведіть мишу на стовпчик: верхній рядок діаграми покаже дату, витрати й кліки цього дня. Без наведення виділено день із найбільшими витратами.",
					),
					t3(
						"Below the chart a table lists the campaigns with the columns [[ads.campaign]], [[ads.status]], [[ads.spend]], [[ads.clicks]] and [[ads.conversions]]. If there were none in the period, the table says [[ads.noData]]. On a narrow screen the table scrolls sideways.",
						"Unter dem Diagramm listet eine Tabelle die Kampagnen mit den Spalten [[ads.campaign]], [[ads.status]], [[ads.spend]], [[ads.clicks]] und [[ads.conversions]]. Gab es im Zeitraum keine, steht in der Tabelle [[ads.noData]]. Auf einem schmalen Bildschirm scrollt die Tabelle seitwärts.",
						"Під діаграмою таблиця перелічує кампанії зі стовпцями [[ads.campaign]], [[ads.status]], [[ads.spend]], [[ads.clicks]] і [[ads.conversions]]. Якщо за період кампаній не було, таблиця пише [[ads.noData]]. На вузькому екрані таблиця прокручується вбік.",
					),
					t3(
						"When no platform is connected, only the two cards are shown. If the platform returns an error for an account (for example the access has expired), the card shows the error text in red instead of the figures.",
						"Ist keine Plattform verbunden, werden nur die zwei Karten angezeigt. Gibt die Plattform für ein Konto einen Fehler zurück (z. B. der Zugriff ist abgelaufen), zeigt die Karte statt der Zahlen den Fehlertext in Rot.",
						"Коли жодну платформу не підключено, показуються лише дві картки. Якщо платформа повертає помилку для акаунта (наприклад, доступ прострочено), картка замість цифр показує текст помилки червоним.",
					),
				],
			},
		],
	},
];
