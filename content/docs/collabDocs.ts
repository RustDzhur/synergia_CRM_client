import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const COLLAB_DOCS: DocSection[] = [
	{
		id: "online_documents",
		title: t3("Online documents: Google Docs, files and folders", "Online-Dokumente: Google Docs, Dateien und Ordner", "Онлайн-документи: Google Docs, файли й теки"),
		intro: t3(
			"[[navigation.online_documents]] ([[navigation.collaboration]] → [[navigation.online_documents]]) keeps the documents of the company in one place, in folders. There are two kinds of things here: Google documents (text, spreadsheet, presentation), which are created in the Google Drive of the company and edited in Google, and ordinary files and photos, which are uploaded and stored by Firmspace itself. The section is included in the Professional plan.",
			"[[navigation.online_documents]] ([[navigation.collaboration]] → [[navigation.online_documents]]) hält die Dokumente der Firma an einem Ort, in Ordnern. Es gibt hier zwei Arten: Google-Dokumente (Text, Tabelle, Präsentation), die im Google Drive der Firma angelegt und in Google bearbeitet werden, und gewöhnliche Dateien und Fotos, die Firmspace selbst hochlädt und speichert. Der Bereich ist im Tarif Professional enthalten.",
			"[[navigation.online_documents]] ([[navigation.collaboration]] → [[navigation.online_documents]]) зберігає документи компанії в одному місці, по теках. Тут два види речей: документи Google (текст, таблиця, презентація), які створюються в Google Drive компанії й редагуються в Google, та звичайні файли й фото, які Firmspace сам завантажує й зберігає. Розділ входить у тариф Professional.",
		),
		groups: [
			{
				title: t3("Connecting Google Drive", "Google Drive verbinden", "Підключення Google Drive"),
				steps: [
					t3(
						"Google documents can be created only after Google Drive is connected. While it is not connected, a card “[[collab.driveConnectTitle]]” is shown above the tiles. It explains that Docs, Sheets and Slides are created in your own Drive and open in the editor of Google, and that the CRM can also bring in the files you already keep there.",
						"Google-Dokumente lassen sich erst anlegen, wenn Google Drive verbunden ist. Solange es nicht verbunden ist, steht über den Kacheln eine Karte „[[collab.driveConnectTitle]]“. Sie erklärt, dass Docs, Sheets und Slides in Ihrem eigenen Drive angelegt werden und im Editor von Google öffnen und dass das CRM auch die Dateien übernehmen kann, die Sie dort schon haben.",
						"Документи Google можна створювати лише після підключення Google Drive. Поки його не підключено, над плитками показано картку «[[collab.driveConnectTitle]]». Вона пояснює, що Docs, Sheets і Slides створюються у вашому власному Drive й відкриваються в редакторі Google, а CRM також може підтягнути файли, які ви вже там зберігаєте.",
					),
					t3(
						"Click [[collab.driveConnectButton]]. The browser goes to the consent page of Google in the same tab; give the two rights it asks (to create and change the files the CRM made, and to read the files of your Drive for the import). After the consent you return to the page and see “[[collab.driveConnectedToast]]”. If you decline, the message “[[collab.driveDenied]]” appears; on another error a red message names the reason.",
						"Klicken Sie auf [[collab.driveConnectButton]]. Der Browser wechselt im selben Tab zur Zustimmungsseite von Google; erteilen Sie die beiden verlangten Rechte (Dateien, die das CRM angelegt hat, zu erstellen und zu ändern, und die Dateien Ihres Drive für den Import zu lesen). Nach der Zustimmung kehren Sie zur Seite zurück und sehen „[[collab.driveConnectedToast]]“. Lehnen Sie ab, erscheint „[[collab.driveDenied]]“; bei einem anderen Fehler nennt eine rote Meldung den Grund.",
						"Клацніть [[collab.driveConnectButton]]. Браузер переходить на сторінку згоди Google у тій самій вкладці; надайте два права, які вона просить (створювати й змінювати файли, зроблені CRM, і читати файли вашого Drive для імпорту). Після згоди ви повертаєтесь на сторінку й бачите «[[collab.driveConnectedToast]]». Якщо відмовили, з’являється «[[collab.driveDenied]]»; за іншої помилки червоне повідомлення називає причину.",
					),
					t3(
						"If the site has no Google sign-in keys, the card says “[[collab.driveNotConfigured]]” and has no button: this must be fixed by the administrator of the site, not by you.",
						"Hat die Website keine Google-Anmeldeschlüssel, steht auf der Karte „[[collab.driveNotConfigured]]“ und es gibt keine Schaltfläche: Das muss der Administrator der Website beheben, nicht Sie.",
						"Якщо на сайті немає ключів входу через Google, на картці написано «[[collab.driveNotConfigured]]» і кнопки немає: це має виправити адміністратор сайту, а не ви.",
					),
					t3(
						"When Drive is connected, the card is replaced by a thin line “Google Drive connected as <your Google e-mail>” with three controls: the button [[collab.driveImportButton]], and the links [[collab.driveReconnect]] and [[collab.driveDisconnect]]. The connection belongs to the whole company: one Google account serves everybody.",
						"Ist Drive verbunden, ersetzt eine dünne Zeile „Google Drive verbunden als <Ihre Google-E-Mail>“ die Karte, mit drei Bedienelementen: der Schaltfläche [[collab.driveImportButton]] und den Links [[collab.driveReconnect]] und [[collab.driveDisconnect]]. Die Verbindung gehört der ganzen Firma: Ein Google-Konto bedient alle.",
						"Коли Drive підключено, картку замінює тонкий рядок «Google Drive підключено як <ваша пошта Google>» із трьома елементами: кнопкою [[collab.driveImportButton]] та посиланнями [[collab.driveReconnect]] і [[collab.driveDisconnect]]. Підключення належить усій компанії: один обліковий запис Google обслуговує всіх.",
					),
					t3(
						"[[collab.driveReconnect]] repeats the consent (use it when the import asks you to reconnect, or to switch to another Google account). [[collab.driveDisconnect]] disconnects Drive at once: the documents already in the list stay, but new Google documents cannot be created until you connect again.",
						"[[collab.driveReconnect]] wiederholt die Zustimmung (nutzen Sie es, wenn der Import zum erneuten Verbinden auffordert, oder um zu einem anderen Google-Konto zu wechseln). [[collab.driveDisconnect]] trennt Drive sofort: Die Dokumente in der Liste bleiben, aber neue Google-Dokumente lassen sich erst nach erneutem Verbinden anlegen.",
						"[[collab.driveReconnect]] повторює згоду (скористайтеся, коли імпорт просить підключити заново, або щоб перейти на інший обліковий запис Google). [[collab.driveDisconnect]] одразу відключає Drive: документи, що вже є у списку, лишаються, але нові документи Google не можна створювати, доки ви не підключите знову.",
					),
					t3(
						"[[collab.driveImportButton]] brings in the files that already lie in your Drive: the button changes to “[[collab.driveImportRunning]]” and is inactive while it works. One run takes up to 200 new files; press it again to get the next ones, nothing is duplicated. Folders and shortcuts of Drive are not imported, and the imported files land in the root folder [[collab.rootFolder]] (the folders of the CRM and of Drive are not linked). A message tells how many files were imported, or “[[collab.driveImportEmpty]]”. If Drive was connected long ago with narrower rights, a message with the button [[collab.driveReconnect]] appears for 10 seconds: press it and give the consent again.",
						"[[collab.driveImportButton]] holt die Dateien, die schon in Ihrem Drive liegen: Die Schaltfläche wechselt zu „[[collab.driveImportRunning]]“ und ist währenddessen inaktiv. Ein Lauf übernimmt bis zu 200 neue Dateien; drücken Sie erneut, um die nächsten zu holen, nichts wird doppelt angelegt. Ordner und Verknüpfungen von Drive werden nicht importiert, und die importierten Dateien landen im Stammordner [[collab.rootFolder]] (die Ordner des CRM und von Drive sind nicht verknüpft). Eine Meldung nennt, wie viele Dateien importiert wurden, oder „[[collab.driveImportEmpty]]“. Wurde Drive vor langer Zeit mit engeren Rechten verbunden, erscheint 10 Sekunden lang eine Meldung mit der Schaltfläche [[collab.driveReconnect]]: Drücken Sie sie und erteilen Sie die Zustimmung erneut.",
						"[[collab.driveImportButton]] підтягує файли, що вже лежать у вашому Drive: кнопка змінюється на «[[collab.driveImportRunning]]» і поки працює, неактивна. Один запуск бере до 200 нових файлів; натисніть знову, щоб отримати наступні, нічого не дублюється. Теки й ярлики Drive не імпортуються, а імпортовані файли потрапляють у кореневу теку [[collab.rootFolder]] (теки CRM і Drive не пов’язані). Повідомлення каже, скільки файлів імпортовано, або «[[collab.driveImportEmpty]]». Якщо Drive підключали давно з вужчими правами, на 10 секунд з’являється повідомлення з кнопкою [[collab.driveReconnect]]: натисніть її й дайте згоду знову.",
					),
				],
			},
			{
				title: t3("Creating a Google document", "Google-Dokument anlegen", "Створення документа Google"),
				steps: [
					t3(
						"Under the toolbar there is a row of square tiles: three Google types ([[collab.kind_gdoc]], [[collab.kind_gsheet]], [[collab.kind_gslide]]) and the tile [[collab.uploadFile]]. The tiles are dimmed when the thing is not available (Drive is not connected, or file storage is off), but they can still be clicked and explain what is missing.",
						"Unter der Werkzeugleiste steht eine Reihe quadratischer Kacheln: drei Google-Typen ([[collab.kind_gdoc]], [[collab.kind_gsheet]], [[collab.kind_gslide]]) und die Kachel [[collab.uploadFile]]. Die Kacheln sind abgedunkelt, wenn etwas nicht verfügbar ist (Drive nicht verbunden oder Dateispeicher aus), lassen sich aber trotzdem anklicken und erklären, was fehlt.",
						"Під панеллю інструментів є ряд квадратних плиток: три типи Google ([[collab.kind_gdoc]], [[collab.kind_gsheet]], [[collab.kind_gslide]]) і плитка [[collab.uploadFile]]. Плитки затемнені, коли щось недоступне (Drive не підключено або сховище файлів вимкнене), але їх усе одно можна клацнути, і вони пояснять, чого бракує.",
					),
					t3(
						"Click a Google tile. Without Drive a message for 10 seconds says “[[collab.driveConnectFirst]]” and offers the button [[collab.driveConnectButton]] right in the message. With Drive a window “[[collab.newDocument]]” opens: the name field is already filled with “[[collab.newDocument]]” and focused (up to 100 characters), under it a hint that the document opens in Google in a new tab, edited there, saved by Google automatically and stays in the list.",
						"Klicken Sie eine Google-Kachel an. Ohne Drive weist eine Meldung 10 Sekunden lang auf „[[collab.driveConnectFirst]]“ hin und bietet gleich in der Meldung die Schaltfläche [[collab.driveConnectButton]] an. Mit Drive öffnet sich ein Fenster „[[collab.newDocument]]“: Das Namensfeld ist schon mit „[[collab.newDocument]]“ gefüllt und fokussiert (bis 100 Zeichen), darunter ein Hinweis, dass das Dokument in Google in einem neuen Tab öffnet, dort bearbeitet, von Google automatisch gespeichert wird und in der Liste bleibt.",
						"Клацніть плитку Google. Без Drive повідомлення на 10 секунд каже «[[collab.driveConnectFirst]]» і одразу в повідомленні пропонує кнопку [[collab.driveConnectButton]]. З Drive відкривається вікно «[[collab.newDocument]]»: поле назви вже заповнене «[[collab.newDocument]]» і у фокусі (до 100 символів), під ним підказка, що документ відкривається в Google в новій вкладці, редагується там, Google зберігає сам, а в списку він лишається.",
					),
					t3(
						"Type the name and press [[collab.create]] (or Enter). An empty name gives “[[collab.nameRequired]]”. The browser opens the new Google document in a new tab at once; in the CRM the message “[[collab.docCreated]]” appears and the window closes. If the browser blocks the new tab, the message “[[collab.docCreatedOpen]]” tells you to open the document from the list.",
						"Geben Sie den Namen ein und drücken Sie [[collab.create]] (oder Enter). Ein leerer Name ergibt „[[collab.nameRequired]]“. Der Browser öffnet das neue Google-Dokument sofort in einem neuen Tab; im CRM erscheint die Meldung „[[collab.docCreated]]“ und das Fenster schließt sich. Blockiert der Browser den neuen Tab, sagt die Meldung „[[collab.docCreatedOpen]]“, dass Sie das Dokument aus der Liste öffnen sollen.",
						"Введіть назву й натисніть [[collab.create]] (або Enter). Порожня назва дає «[[collab.nameRequired]]». Браузер одразу відкриває новий документ Google у новій вкладці; у CRM з’являється повідомлення «[[collab.docCreated]]», і вікно закривається. Якщо браузер блокує нову вкладку, повідомлення «[[collab.docCreatedOpen]]» каже відкрити документ зі списку.",
					),
					t3(
						"The document is created in the folder you are currently in (see the folder path below) and in the matching folder of your Drive. Edit it in Google as usual; you do not have to save. Names, changes and the modified date come back to the CRM when the page is opened or refreshed. A document you moved to the trash in Google disappears from the CRM list at the next refresh.",
						"Das Dokument wird im Ordner angelegt, in dem Sie gerade sind (siehe Ordnerpfad unten), und im passenden Ordner Ihres Drive. Bearbeiten Sie es wie gewohnt in Google; Sie müssen nicht speichern. Namen, Änderungen und das Änderungsdatum kommen ins CRM zurück, wenn die Seite geöffnet oder aktualisiert wird. Ein Dokument, das Sie in Google in den Papierkorb verschieben, verschwindet beim nächsten Aktualisieren aus der CRM-Liste.",
						"Документ створюється в теці, у якій ви зараз (див. шлях тек нижче), і у відповідній теці вашого Drive. Редагуйте його в Google як завжди; зберігати не треба. Назви, зміни й дата зміни повертаються в CRM, коли сторінку відкривають або оновлюють. Документ, який ви перенесли в кошик у Google, зникає зі списку CRM під час наступного оновлення.",
					),
				],
			},
			{
				title: t3("Uploading files and photos", "Dateien und Fotos hochladen", "Завантаження файлів і фото"),
				steps: [
					t3(
						"Click the tile [[collab.uploadFile]] — the file picker of your device opens; you can choose several files at once. If the file storage is not connected on the site, the message “[[collab.storageNotConfigured]]” appears instead.",
						"Klicken Sie auf die Kachel [[collab.uploadFile]] — die Dateiauswahl Ihres Geräts öffnet sich; Sie können mehrere Dateien gleichzeitig wählen. Ist der Dateispeicher auf der Website nicht verbunden, erscheint stattdessen die Meldung „[[collab.storageNotConfigured]]“.",
						"Клацніть плитку [[collab.uploadFile]] — відкривається вибір файлів вашого пристрою; можна обрати кілька файлів одразу. Якщо сховище файлів на сайті не підключено, натомість з’являється повідомлення «[[collab.storageNotConfigured]]».",
					),
					t3(
						"The files go one after another; for each one a message “Uploading <name>” is shown, then a red message names a failure. When the series is finished a green message tells how many files were uploaded. Big photos are reduced in size before they are sent. A single file may be at most 4 MB.",
						"Die Dateien werden nacheinander hochgeladen; für jede erscheint die Meldung „<Name> wird hochgeladen“, ein Fehler wird rot gemeldet. Ist die Reihe fertig, nennt eine grüne Meldung die Zahl der hochgeladenen Dateien. Große Fotos werden vor dem Senden verkleinert. Eine einzelne Datei darf höchstens 4 MB groß sein.",
						"Файли завантажуються по черзі; для кожного показується повідомлення «Завантаження <назва>», а збій називає червоне повідомлення. Коли серію завершено, зелене повідомлення каже, скільки файлів завантажено. Великі фото перед надсиланням зменшуються. Один файл може бути не більшим за 4 МБ.",
					),
					t3(
						"The whole company has a total storage limit that depends on the plan (Free 500 MB, Standard 2000 MB, Professional 10000 MB). When it is full, the upload is refused with the advice to upgrade the plan (see [[navigation.upgrade_plan]]). The file goes into the current folder.",
						"Die ganze Firma hat ein Gesamtlimit für den Speicher, das vom Tarif abhängt (Free 500 MB, Standard 2000 MB, Professional 10000 MB). Ist er voll, wird der Upload mit dem Rat abgelehnt, den Tarif zu erhöhen (siehe [[navigation.upgrade_plan]]). Die Datei kommt in den aktuellen Ordner.",
						"У всієї компанії є загальний ліміт сховища, що залежить від тарифу (Free 500 МБ, Standard 2000 МБ, Professional 10000 МБ). Коли він заповнений, завантаження відхиляється з порадою підвищити тариф (див. [[navigation.upgrade_plan]]). Файл потрапляє в поточну теку.",
					),
				],
			},
			{
				title: t3("The toolbar, views, search and folders", "Werkzeugleiste, Ansichten, Suche und Ordner", "Панель інструментів, вигляди, пошук і теки"),
				steps: [
					t3(
						"At the top left three tabs switch the look of the list: [[collab.list]] (a table), [[collab.grid]] (small cards in up to six columns) and [[collab.tile]] (wide cards in up to three columns). The choice is not remembered after you leave the page.",
						"Oben links schalten drei Tabs das Aussehen der Liste um: [[collab.list]] (eine Tabelle), [[collab.grid]] (kleine Karten in bis zu sechs Spalten) und [[collab.tile]] (breite Karten in bis zu drei Spalten). Die Wahl wird nach dem Verlassen der Seite nicht gemerkt.",
						"Угорі ліворуч три вкладки перемикають вигляд списку: [[collab.list]] (таблиця), [[collab.grid]] (малі картки до шести колонок) і [[collab.tile]] (широкі картки до трьох колонок). Вибір не запам’ятовується після виходу зі сторінки.",
					),
					t3(
						"The search field “[[collab.filterSearch]]” looks for folders and files by name as you type. Its filter menu narrows the files: [[collab.fileKind]] (all, Google Docs, Google Sheets, Google Slides or file), [[collab.fileSource]] (all, [[collab.fileFromDrive]] or [[collab.fileInCrm]]) and [[collab.createdBy]] (a person who made a file; the choice appears only when there are authors).",
						"Das Suchfeld „[[collab.filterSearch]]“ sucht beim Tippen Ordner und Dateien nach dem Namen. Sein Filtermenü grenzt die Dateien ein: [[collab.fileKind]] (alle, Google Docs, Google Sheets, Google Slides oder Datei), [[collab.fileSource]] (alle, [[collab.fileFromDrive]] oder [[collab.fileInCrm]]) und [[collab.createdBy]] (eine Person, die eine Datei angelegt hat; die Auswahl erscheint nur, wenn es Autoren gibt).",
						"Поле пошуку «[[collab.filterSearch]]» шукає теки й файли за назвою під час введення. Його меню фільтрів звужує файли: [[collab.fileKind]] (усі, Google Docs, Google Sheets, Google Slides або файл), [[collab.fileSource]] (усі, [[collab.fileFromDrive]] або [[collab.fileInCrm]]) і [[collab.createdBy]] (людина, що створила файл; вибір з’являється лише коли є автори).",
					),
					t3(
						"The circular arrows ([[collab.refresh]]) reload the list and, when Drive is connected, pull the new names, dates and deleted documents from Google; they turn while it works. The button [[collab.folderNew]] opens the window “[[collab.folderNew]]” with a name field (“[[collab.folderName]]”, up to 100 characters; the server keeps 80) — press [[collab.create]] or Enter. A folder with the same name in the same place is refused. The green message “[[collab.saved]]” confirms it.",
						"Die kreisförmigen Pfeile ([[collab.refresh]]) laden die Liste neu und holen, wenn Drive verbunden ist, neue Namen, Daten und gelöschte Dokumente von Google; sie drehen sich währenddessen. Die Schaltfläche [[collab.folderNew]] öffnet das Fenster „[[collab.folderNew]]“ mit einem Namensfeld („[[collab.folderName]]“, bis 100 Zeichen; der Server behält 80) — drücken Sie [[collab.create]] oder Enter. Ein Ordner mit demselben Namen an derselben Stelle wird abgelehnt. Die grüne Meldung „[[collab.saved]]“ bestätigt es.",
						"Кругові стрілки ([[collab.refresh]]) перезавантажують список і, якщо Drive підключено, підтягують з Google нові назви, дати й видалені документи; вони крутяться, поки працює. Кнопка [[collab.folderNew]] відкриває вікно «[[collab.folderNew]]» з полем назви («[[collab.folderName]]», до 100 символів; сервер лишає 80) — натисніть [[collab.create]] або Enter. Теку з такою самою назвою на тому самому місці буде відхилено. Зелене повідомлення «[[collab.saved]]» підтверджує створення.",
					),
					t3(
						"The line “[[collab.breadcrumbs]]” under the tiles is the path: the first word [[collab.rootFolder]] is the top level, then every folder you went into. Click any part of the path to jump back there; the last part (where you are) is white and not clickable. Folders can be nested; create a new folder inside the folder you are in.",
						"Die Zeile „[[collab.breadcrumbs]]“ unter den Kacheln ist der Pfad: Das erste Wort [[collab.rootFolder]] ist die oberste Ebene, dann folgt jeder Ordner, in den Sie gegangen sind. Klicken Sie auf einen Teil des Pfads, um dorthin zurückzuspringen; der letzte Teil (wo Sie sind) ist weiß und nicht klickbar. Ordner lassen sich verschachteln; legen Sie einen neuen Ordner in dem Ordner an, in dem Sie sind.",
						"Рядок «[[collab.breadcrumbs]]» під плитками — це шлях: перше слово [[collab.rootFolder]] — верхній рівень, далі кожна тека, у яку ви зайшли. Клацніть будь-яку частину шляху, щоб повернутися туди; остання частина (де ви) біла й не клікабельна. Теки можуть бути вкладеними; створюйте нову теку всередині тієї, у якій ви.",
					),
					t3(
						"The area under the path shows first the folders (with a folder icon), then the files. An empty section says “[[collab.docsEmpty]]”, an empty folder “[[collab.folderEmpty]]”.",
						"Der Bereich unter dem Pfad zeigt zuerst die Ordner (mit Ordnersymbol), dann die Dateien. Ein leerer Bereich sagt „[[collab.docsEmpty]]“, ein leerer Ordner „[[collab.folderEmpty]]“.",
						"Ділянка під шляхом показує спершу теки (зі значком теки), потім файли. Порожній розділ каже «[[collab.docsEmpty]]», порожня тека — «[[collab.folderEmpty]]».",
					),
				],
			},
			{
				title: t3("Working with folders and files", "Arbeit mit Ordnern und Dateien", "Робота з теками й файлами"),
				steps: [
					t3(
						"In the [[collab.list]] view the columns are: [[collab.fileName]] (with an icon of the type and, under the name, the type or the size or “[[collab.fileFromDrive]]”), a status column, [[collab.createdBy]] and [[collab.modified]]. A click on the header [[collab.fileName]] sorts the names A→Z / Z→A (the arrow shows the direction). For folders the status column says [[collab.folder]], and the author and date are dashes.",
						"In der Ansicht [[collab.list]] lauten die Spalten: [[collab.fileName]] (mit Typsymbol und unter dem Namen dem Typ oder der Größe oder „[[collab.fileFromDrive]]“), eine Statusspalte, [[collab.createdBy]] und [[collab.modified]]. Ein Klick auf die Überschrift [[collab.fileName]] sortiert die Namen A→Z / Z→A (der Pfeil zeigt die Richtung). Bei Ordnern steht in der Statusspalte [[collab.folder]], Autor und Datum sind Striche.",
						"У вигляді [[collab.list]] колонки такі: [[collab.fileName]] (зі значком типу й під назвою типом, розміром або «[[collab.fileFromDrive]]»), колонка статусу, [[collab.createdBy]] і [[collab.modified]]. Клік по заголовку [[collab.fileName]] сортує назви А→Я / Я→А (стрілка показує напрям). Для тек у колонці статусу написано [[collab.folder]], а автор і дата — риски.",
					),
					t3(
						"The header of the status column is a drop-down. Choose [[collab.active]] (the default), [[collab.archived]] or [[collab.all]] — archived files are hidden from the normal view, so this filter is the way to find them again. The filter works only in the list view.",
						"Die Überschrift der Statusspalte ist eine Auswahlliste. Wählen Sie [[collab.active]] (Standard), [[collab.archived]] oder [[collab.all]] — archivierte Dateien sind in der normalen Ansicht ausgeblendet, dieser Filter ist also der Weg, sie wiederzufinden. Der Filter wirkt nur in der Listenansicht.",
						"Заголовок колонки статусу — це випадний список. Оберіть [[collab.active]] (за замовчуванням), [[collab.archived]] або [[collab.all]] — архівні файли приховано зі звичайного вигляду, тож цей фільтр — спосіб знайти їх знову. Фільтр працює лише у вигляді списку.",
					),
					t3(
						"A click on the name of a folder goes into it. A click on the name of a file opens it: a Google document or an imported Drive file opens in Google in a new tab; a photo or PDF you uploaded opens in a new tab of the browser; any other uploaded file is downloaded. If it fails, the message “[[collab.fileOpenFailed]]” appears.",
						"Ein Klick auf den Namen eines Ordners öffnet ihn. Ein Klick auf den Namen einer Datei öffnet sie: Ein Google-Dokument oder eine importierte Drive-Datei öffnet in Google in einem neuen Tab; ein hochgeladenes Foto oder PDF öffnet in einem neuen Browser-Tab; jede andere hochgeladene Datei wird heruntergeladen. Scheitert es, erscheint „[[collab.fileOpenFailed]]“.",
						"Клік по назві теки заходить у неї. Клік по назві файлу відкриває його: документ Google або імпортований файл Drive відкривається в Google у новій вкладці; завантажене фото чи PDF відкривається в новій вкладці браузера; будь-який інший завантажений файл скачується. Якщо не вдалося, з’являється «[[collab.fileOpenFailed]]».",
					),
					t3(
						"At the right end of each row (or card) there are three dots ([[collab.more]]). For a folder the menu has: [[collab.open]], [[collab.rename]], [[collab.moveTo]] and, separated by a line and red, [[collab.delete]].",
						"Am rechten Ende jeder Zeile (oder Karte) stehen drei Punkte ([[collab.more]]). Für einen Ordner enthält das Menü: [[collab.open]], [[collab.rename]], [[collab.moveTo]] und, durch eine Linie getrennt und rot, [[collab.delete]].",
						"На правому краю кожного рядка (або картки) три крапки ([[collab.more]]). Для теки меню має: [[collab.open]], [[collab.rename]], [[collab.moveTo]] і, відокремлене лінією та червоне, [[collab.delete]].",
					),
					t3(
						"For a file the menu has: [[collab.openInGoogle]] (for Google documents and imported Drive files) or [[collab.openFile]] (for uploaded files), then [[collab.rename]], [[collab.moveTo]], [[collab.archive]] (or [[collab.restore]] for an archived file) and the red [[collab.delete]]. For a PDF you uploaded there is one more item, [[ai.analyzeDoc]]: it opens the assistant [[ai.title]] and asks it to read the document and say what it is; if it is an employment contract, the assistant offers to save the contract type, the start date and a note in the profile of the matching employee. It appears only when the assistant is switched on for your plan.",
						"Für eine Datei enthält das Menü: [[collab.openInGoogle]] (bei Google-Dokumenten und importierten Drive-Dateien) oder [[collab.openFile]] (bei hochgeladenen Dateien), dann [[collab.rename]], [[collab.moveTo]], [[collab.archive]] (oder [[collab.restore]] bei einer archivierten Datei) und das rote [[collab.delete]]. Bei einem hochgeladenen PDF gibt es einen weiteren Punkt, [[ai.analyzeDoc]]: Er öffnet den Assistenten [[ai.title]] und bittet ihn, das Dokument zu lesen und zu sagen, was es ist; ist es ein Arbeitsvertrag, bietet der Assistent an, Vertragsart, Startdatum und eine Notiz im Profil des passenden Mitarbeiters zu speichern. Er erscheint nur, wenn der Assistent für Ihren Tarif eingeschaltet ist.",
						"Для файлу меню має: [[collab.openInGoogle]] (для документів Google та імпортованих файлів Drive) або [[collab.openFile]] (для завантажених файлів), далі [[collab.rename]], [[collab.moveTo]], [[collab.archive]] (або [[collab.restore]] для архівного файлу) і червоне [[collab.delete]]. Для завантаженого PDF є ще один пункт, [[ai.analyzeDoc]]: він відкриває асистента [[ai.title]] і просить його прочитати документ та сказати, що це; якщо це трудовий договір, асистент пропонує зберегти тип договору, дату початку й нотатку в профілі відповідного працівника. Він з’являється лише коли асистент увімкнено для вашого тарифу.",
					),
					t3(
						"[[collab.rename]] opens a window with the current name (up to 100 characters); press [[collab.save]]. For a Google document made by the CRM, the new name is also written to Drive; for an imported Drive file the name changes only in the CRM. An empty name gives “[[collab.nameRequired]]”.",
						"[[collab.rename]] öffnet ein Fenster mit dem aktuellen Namen (bis 100 Zeichen); drücken Sie [[collab.save]]. Bei einem vom CRM angelegten Google-Dokument wird der neue Name auch nach Drive geschrieben; bei einer importierten Drive-Datei ändert sich der Name nur im CRM. Ein leerer Name ergibt „[[collab.nameRequired]]“.",
						"[[collab.rename]] відкриває вікно з поточною назвою (до 100 символів); натисніть [[collab.save]]. Для документа Google, створеного CRM, нову назву також записують у Drive; для імпортованого файлу Drive назва змінюється лише в CRM. Порожня назва дає «[[collab.nameRequired]]».",
					),
					t3(
						"[[collab.moveTo]] opens a window with the name of the item and a list of all folders: the top item [[collab.rootFolder]], then the folders with an indentation and an arrow for each level of nesting (a folder cannot be moved into itself or into its own subfolders, so they are missing from the list). Choose the target and press [[collab.moveHere]]; the message “[[collab.moved]]” confirms it. Google documents of the CRM are also moved in Drive.",
						"[[collab.moveTo]] öffnet ein Fenster mit dem Namen des Elements und einer Liste aller Ordner: oben [[collab.rootFolder]], dann die Ordner mit Einrückung und Pfeil für jede Verschachtelungsebene (ein Ordner lässt sich nicht in sich selbst oder in eigene Unterordner verschieben, darum fehlen sie in der Liste). Wählen Sie das Ziel und drücken Sie [[collab.moveHere]]; die Meldung „[[collab.moved]]“ bestätigt es. Google-Dokumente des CRM werden auch in Drive verschoben.",
						"[[collab.moveTo]] відкриває вікно з назвою елемента й списком усіх тек: угорі [[collab.rootFolder]], далі теки з відступом і стрілкою для кожного рівня вкладеності (теку не можна перенести в саму себе чи в її підтеки, тому їх у списку немає). Оберіть ціль і натисніть [[collab.moveHere]]; повідомлення «[[collab.moved]]» підтверджує. Документи Google CRM також переносяться в Drive.",
					),
					t3(
						"[[collab.archive]] hides a file from the normal list without deleting anything; [[collab.restore]] (in the status filter [[collab.archived]] or [[collab.all]]) brings it back. It happens at once, without a question.",
						"[[collab.archive]] blendet eine Datei aus der normalen Liste aus, ohne etwas zu löschen; [[collab.restore]] (im Statusfilter [[collab.archived]] oder [[collab.all]]) holt sie zurück. Es geschieht sofort, ohne Rückfrage.",
						"[[collab.archive]] ховає файл зі звичайного списку, нічого не видаляючи; [[collab.restore]] (у фільтрі статусу [[collab.archived]] або [[collab.all]]) повертає його. Це відбувається одразу, без запитання.",
					),
					t3(
						"[[collab.delete]] always asks first. For a folder: “[[collab.confirmDeleteFolder]]” — only an empty folder can be deleted; if it still holds folders or files, the server refuses and asks you to move or delete the contents first. For a Google document: “[[collab.confirmDeleteDoc]]” — it goes to the trash of your Drive as well. For an uploaded file: “[[collab.confirmDeleteFile]]”. An imported Drive file is removed only from the CRM; the file itself stays in your Drive.",
						"[[collab.delete]] fragt immer zuerst nach. Bei einem Ordner: „[[collab.confirmDeleteFolder]]“ — nur ein leerer Ordner lässt sich löschen; enthält er noch Ordner oder Dateien, lehnt der Server ab und bittet, den Inhalt zuerst zu verschieben oder zu löschen. Bei einem Google-Dokument: „[[collab.confirmDeleteDoc]]“ — es kommt auch in den Papierkorb Ihres Drive. Bei einer hochgeladenen Datei: „[[collab.confirmDeleteFile]]“. Eine importierte Drive-Datei wird nur aus dem CRM entfernt; die Datei selbst bleibt in Ihrem Drive.",
						"[[collab.delete]] завжди питає спершу. Для теки: «[[collab.confirmDeleteFolder]]» — видалити можна лише порожню теку; якщо в ній ще є теки чи файли, сервер відмовляє й просить спершу перенести або видалити вміст. Для документа Google: «[[collab.confirmDeleteDoc]]» — він потрапляє і в кошик вашого Drive. Для завантаженого файлу: «[[collab.confirmDeleteFile]]». Імпортований файл Drive видаляється лише з CRM; сам файл лишається у вашому Drive.",
					),
					t3(
						"In the [[collab.grid]] and [[collab.tile]] views the same actions are available: a click on the card opens the folder or the file, the three dots give the menu described above. The column filters and the archive filter of the table do not exist in these views (the archive shows only active files there).",
						"In den Ansichten [[collab.grid]] und [[collab.tile]] stehen dieselben Aktionen zur Verfügung: Ein Klick auf die Karte öffnet Ordner oder Datei, die drei Punkte geben das oben beschriebene Menü. Die Spaltenfilter und der Archivfilter der Tabelle gibt es in diesen Ansichten nicht (das Archiv zeigt dort nur aktive Dateien).",
						"У виглядах [[collab.grid]] і [[collab.tile]] доступні ті самі дії: клік по картці відкриває теку чи файл, три крапки дають описане вище меню. Фільтра статусу й сортування за заголовком таблиці в цих виглядах немає (архів там показує лише активні файли).",
					),
				],
			},
		],
	},
];
