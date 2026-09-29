import { t3 } from "../i18n";
import type { DocSection } from "./types";

export const COMPANY_DOCS: DocSection[] = [
	{
		id: "company",
		title: t3("My company: employees and knowledge base", "Meine Firma: Mitarbeiter und Wissensdatenbank", "Моя компанія: співробітники та база знань"),
		intro: t3(
			"[[navigation.company]] has two tabs: [[company.employeesTab]] (a directory of the people of your company) and [[company.knowledgeBase]] (articles for the team). The section is included from the Standard plan; it is available to the owner, administrators, managers and to anybody who has the “Company” access ticked in Team and access.",
			"[[navigation.company]] hat zwei Tabs: [[company.employeesTab]] (ein Verzeichnis der Menschen Ihrer Firma) und [[company.knowledgeBase]] (Artikel für das Team). Der Bereich ist ab dem Tarif Standard enthalten; er steht dem Inhaber, den Administratoren, den Managern und allen zur Verfügung, bei denen in Team und Zugriff der Zugriff „Firma“ gesetzt ist.",
			"[[navigation.company]] має дві вкладки: [[company.employeesTab]] (довідник людей вашої компанії) та [[company.knowledgeBase]] (статті для команди). Розділ входить у тариф Standard; він доступний власнику, адміністраторам, менеджерам і всім, кому в «Команді та доступі» ввімкнено доступ «Компанія».",
		),
		groups: [
			{
				title: t3("Employees tab: search and filters", "Tab Mitarbeiter: Suche und Filter", "Вкладка співробітників: пошук і фільтри"),
				steps: [
					t3(
						"Open [[navigation.company]] and stay on the first tab, [[company.employeesTab]]. The table lists the employee records of the current firm, newest first.",
						"Öffnen Sie [[navigation.company]] und bleiben Sie auf dem ersten Tab [[company.employeesTab]]. Die Tabelle listet die Mitarbeitereinträge der aktuellen Firma, die neuesten zuerst.",
						"Відкрийте [[navigation.company]] і залишайтеся на першій вкладці [[company.employeesTab]]. Таблиця показує записи співробітників поточної фірми, найновіші зверху.",
					),
					t3(
						"The field [[company.search]] searches the first name, last name and e-mail on the server. The search starts by itself 300 ms after you stop typing (no button to press), takes up to 100 characters and always returns to the first page. The small cross at the right end of the field clears the text and shows everybody again.",
						"Das Feld [[company.search]] durchsucht Vorname, Nachname und E-Mail auf dem Server. Die Suche startet von selbst 300 ms, nachdem Sie aufhören zu tippen (keine Schaltfläche nötig), nimmt bis zu 100 Zeichen und springt immer zurück auf die erste Seite. Das kleine Kreuz am rechten Ende des Feldes löscht den Text und zeigt wieder alle.",
						"Поле [[company.search]] шукає за іменем, прізвищем і e-mail на сервері. Пошук стартує сам через 300 мс після того, як ви перестали друкувати (кнопку тиснути не треба), приймає до 100 символів і завжди повертає на першу сторінку. Маленький хрестик у правому кінці поля стирає текст і знову показує всіх.",
					),
					t3(
						"The filter button next to the search (sliders icon) opens a small window. It shows a number on the button when filters are active. Inside are two lists: [[company.department]] (first entry [[company.allDepartments]]) and [[company.position]] (first entry [[company.allPositions]]). Choose a value and the table is filtered at once; the two filters combine, and the match must be exact. A link at the bottom of the window resets both filters. Note: the lists offer only the values that occur in the rows currently loaded on the page.",
						"Die Filter-Schaltfläche neben der Suche (Symbol mit Reglern) öffnet ein kleines Fenster. Bei aktiven Filtern zeigt die Schaltfläche eine Zahl. Darin stehen zwei Listen: [[company.department]] (erster Eintrag [[company.allDepartments]]) und [[company.position]] (erster Eintrag [[company.allPositions]]). Wählen Sie einen Wert, und die Tabelle wird sofort gefiltert; beide Filter werden kombiniert, und die Übereinstimmung muss exakt sein. Ein Link unten im Fenster setzt beide Filter zurück. Beachten Sie: Die Listen bieten nur Werte an, die in den aktuell geladenen Zeilen der Seite vorkommen.",
						"Кнопка фільтра поруч із пошуком (значок з повзунками) відкриває невелике вікно. Коли фільтри активні, на кнопці з’являється число. Усередині два списки: [[company.department]] (перший пункт [[company.allDepartments]]) та [[company.position]] (перший пункт [[company.allPositions]]). Оберіть значення — таблицю відфільтровано одразу; обидва фільтри поєднуються, а збіг має бути точним. Посилання внизу вікна скидає обидва фільтри. Зверніть увагу: списки пропонують лише значення, що трапляються в рядках, які зараз завантажено на сторінці.",
					),
				],
			},
			{
				title: t3("Adding an employee: the [[company.invite]] window", "Mitarbeiter hinzufügen: das Fenster [[company.invite]]", "Додавання співробітника: вікно [[company.invite]]"),
				steps: [
					t3(
						"Press the green button [[company.invite]] (with a plus) above the table. A window titled [[company.inviteTitle]] opens.",
						"Drücken Sie die grüne Schaltfläche [[company.invite]] (mit Plus) über der Tabelle. Ein Fenster mit dem Titel [[company.inviteTitle]] öffnet sich.",
						"Натисніть зелену кнопку [[company.invite]] (з плюсом) над таблицею. Відкривається вікно з заголовком [[company.inviteTitle]].",
					),
					t3(
						"Fill in the fields: [[company.firstname]] and [[company.lastname]] (both required, up to 100 characters), [[company.email]] (required, up to 200 characters), [[company.workPhone]], [[company.internalPhone]] (both accept a telephone number), [[company.position]], [[company.department]], [[company.contractType]] (a free text; the field shows a hint with an example) and [[company.contractStart]] (a date picker).",
						"Füllen Sie die Felder aus: [[company.firstname]] und [[company.lastname]] (beide Pflicht, bis 100 Zeichen), [[company.email]] (Pflicht, bis 200 Zeichen), [[company.workPhone]], [[company.internalPhone]] (beide nehmen eine Telefonnummer), [[company.position]], [[company.department]], [[company.contractType]] (freier Text; das Feld zeigt einen Beispiel-Hinweis) und [[company.contractStart]] (ein Datumsfeld).",
						"Заповніть поля: [[company.firstname]] і [[company.lastname]] (обидва обов’язкові, до 100 символів), [[company.email]] (обов’язкове, до 200 символів), [[company.workPhone]], [[company.internalPhone]] (обидва приймають номер телефону), [[company.position]], [[company.department]], [[company.contractType]] (вільний текст; у полі є підказка з прикладом) і [[company.contractStart]] (вибір дати).",
					),
					t3(
						"Press [[company.send]] to save, or [[company.cancel]] (or the cross at the top right) to close the window without saving. If the name or the e-mail is empty, the message “[[company.required]]” appears and the window stays open. After a successful save you see “[[company.invited]]”, the window closes and the person appears at the top of the table; a server failure shows “[[company.error]]”.",
						"Drücken Sie [[company.send]] zum Speichern oder [[company.cancel]] (oder das Kreuz oben rechts), um das Fenster ohne Speichern zu schließen. Sind Name oder E-Mail leer, erscheint „[[company.required]]“ und das Fenster bleibt offen. Nach dem erfolgreichen Speichern sehen Sie „[[company.invited]]“, das Fenster schließt sich und die Person erscheint oben in der Tabelle; ein Serverfehler zeigt „[[company.error]]“.",
						"Натисніть [[company.send]], щоб зберегти, або [[company.cancel]] (чи хрестик угорі праворуч), щоб закрити вікно без збереження. Якщо ім’я чи e-mail порожні, з’являється «[[company.required]]», а вікно лишається відкритим. Після успішного збереження ви бачите «[[company.invited]]», вікно закривається, і людина з’являється вгорі таблиці; помилка сервера показує «[[company.error]]».",
					),
					t3(
						"Important: by itself this only creates an entry in the directory, without an account. Owners and administrators also see a frame with a tick box [[company.grantAccess]] (with a note [[company.grantHint]]) and, once it is ticked, a list [[company.grantRole]] (Manager, Employee or Viewer). With the box ticked the person is added to the firm at the same time exactly as in [[settings.tabTeam]] (an existing account gets access at once, otherwise an invitation is stored) and you see “[[company.accessGranted]]”, or “[[company.accessGrantedMail]]” when an e-mail was also sent from the mailbox connected in [[navigation.web_mails]]. If the access cannot be given (for example the plan’s user limit is reached), the entry is still saved and a red message “Employee added to the directory, but access was not granted: …” names the reason.",
						"Wichtig: Für sich allein legt dies nur einen Verzeichniseintrag ohne Konto an. Inhaber und Administratoren sehen zusätzlich einen Rahmen mit dem Kästchen [[company.grantAccess]] (mit dem Hinweis [[company.grantHint]]) und, sobald es angehakt ist, eine Liste [[company.grantRole]] (Manager, Mitarbeiter oder Betrachter). Bei angehaktem Kästchen wird die Person gleichzeitig wie in [[settings.tabTeam]] zur Firma hinzugefügt (ein bestehendes Konto erhält sofort Zugriff, sonst wird eine Einladung gespeichert), und Sie sehen „[[company.accessGranted]]“ oder „[[company.accessGrantedMail]]“, wenn zusätzlich eine E-Mail aus dem in [[navigation.web_mails]] verbundenen Postfach gesendet wurde. Lässt sich der Zugriff nicht vergeben (zum Beispiel weil das Nutzerlimit des Tarifs erreicht ist), bleibt der Eintrag trotzdem gespeichert, und eine rote Meldung „Mitarbeiter im Verzeichnis angelegt, aber der Zugriff wurde nicht vergeben: …“ nennt den Grund.",
						"Важливо: саме по собі це лише створює запис у довіднику, без облікового запису. Власники й адміністратори бачать також рамку з прапорцем [[company.grantAccess]] (з приміткою [[company.grantHint]]) і, коли його відмічено, список [[company.grantRole]] (Менеджер, Співробітник або Спостерігач). З відміченим прапорцем людину одночасно додають до фірми так само, як у [[settings.tabTeam]] (наявний акаунт отримує доступ одразу, інакше зберігається запрошення), і ви бачите «[[company.accessGranted]]», або «[[company.accessGrantedMail]]», якщо ще й надіслано лист зі скриньки, підключеної в [[navigation.web_mails]]. Якщо доступ не вдалося надати (наприклад, вичерпано ліміт користувачів тарифу), запис усе одно збережено, а червоне повідомлення «Співробітника додано до довідника, але доступ не надано: …» називає причину.",
					),
				],
			},
			{
				title: t3("The table, the row menu and paging", "Die Tabelle, das Zeilenmenü und das Blättern", "Таблиця, меню рядка та сторінки"),
				steps: [
					t3(
						"The table has the columns: a gear icon (the row menu), [[company.photo]] (the picture, or a circle with the initials when there is none — a photo cannot be uploaded in this window), [[company.fullName]], [[company.email]], [[company.workPhone]], [[company.position]], [[company.department]] and [[company.internalPhone]]. It is at least 1040 px wide, so on a small screen you scroll it sideways.",
						"Die Tabelle hat die Spalten: ein Zahnrad-Symbol (das Zeilenmenü), [[company.photo]] (das Bild oder ein Kreis mit den Initialen, wenn keins da ist — ein Foto lässt sich in diesem Fenster nicht hochladen), [[company.fullName]], [[company.email]], [[company.workPhone]], [[company.position]], [[company.department]] und [[company.internalPhone]]. Sie ist mindestens 1040 px breit, auf einem kleinen Bildschirm scrollen Sie sie also seitwärts.",
						"Таблиця має стовпці: значок шестерні (меню рядка), [[company.photo]] (зображення або коло з ініціалами, якщо його немає — фото в цьому вікні завантажити не можна), [[company.fullName]], [[company.email]], [[company.workPhone]], [[company.position]], [[company.department]] та [[company.internalPhone]]. Вона завширшки щонайменше 1040 px, тож на малому екрані її прокручують убік.",
					),
					t3(
						"At the start of every row there is a three-dots button. It opens a menu with two entries. [[company.edit]] opens the same window as for adding, titled [[company.editTitle]], with the data filled in; its button is [[company.save]] and after saving you see “[[company.saved]]”. The red entry [[company.delete]] opens a confirmation window “Delete this employee?”; confirm it to remove the entry (the person’s account, if one exists, is not touched), or cancel.",
						"Am Anfang jeder Zeile steht eine Schaltfläche mit drei Punkten. Sie öffnet ein Menü mit zwei Einträgen. [[company.edit]] öffnet dasselbe Fenster wie beim Hinzufügen mit dem Titel [[company.editTitle]] und den ausgefüllten Daten; seine Schaltfläche heißt [[company.save]], und nach dem Speichern sehen Sie „[[company.saved]]“. Der rote Eintrag [[company.delete]] öffnet ein Bestätigungsfenster „Diesen Mitarbeiter löschen?“; bestätigen Sie, um den Eintrag zu entfernen (das Konto der Person, falls vorhanden, bleibt unberührt), oder brechen Sie ab.",
						"На початку кожного рядка є кнопка з трьома крапками. Вона відкриває меню з двома пунктами. [[company.edit]] відкриває те саме вікно, що й для додавання, із заголовком [[company.editTitle]] та заповненими даними; його кнопка — [[company.save]], а після збереження ви бачите «[[company.saved]]». Червоний пункт [[company.delete]] відкриває вікно підтвердження «Видалити цього співробітника?»; підтвердіть, щоб видалити запис (обліковий запис людини, якщо він є, не чіпається), або скасуйте.",
					),
					t3(
						"Twenty rows are shown per page. Under the table you see the total number of entries (“TOTAL”), the number of pages (“PAGES”) and the buttons [[company.previous]] and [[company.next]]; they are grey at the first and last page. When nothing is found the table shows “[[company.empty]]”.",
						"Pro Seite werden zwanzig Zeilen gezeigt. Unter der Tabelle stehen die Gesamtzahl der Einträge („TOTAL“), die Seitenzahl („PAGES“) und die Schaltflächen [[company.previous]] und [[company.next]]; auf der ersten und der letzten Seite sind sie grau. Wird nichts gefunden, zeigt die Tabelle „[[company.empty]]“.",
						"На сторінці показано двадцять рядків. Під таблицею — загальна кількість записів («TOTAL»), кількість сторінок («PAGES») і кнопки [[company.previous]] та [[company.next]]; на першій і останній сторінці вони сірі. Якщо нічого не знайдено, таблиця показує «[[company.empty]]».",
					),
					t3(
						"The same people are also shown in a compact form under [[settings.tabColleagues]] in the settings (see the section “Settings”).",
						"Dieselben Personen werden auch kompakt unter [[settings.tabColleagues]] in den Einstellungen gezeigt (siehe Abschnitt „Einstellungen“).",
						"Тих самих людей у компактному вигляді показано й у [[settings.tabColleagues]] в налаштуваннях (див. розділ «Налаштування»).",
					),
				],
			},
			{
				title: t3("Knowledge base tab", "Tab Wissensdatenbank", "Вкладка бази знань"),
				steps: [
					t3(
						"Open the second tab [[company.knowledgeBase]]. It works like the other list pages of the CRM (tabs, search, filters, [[crm.deleteSelected]], the record window) — all these mechanics are described in the section “Tables”. Here the record is an “article”, so the toolbar buttons are named “Add Article” and “Edit Article”.",
						"Öffnen Sie den zweiten Tab [[company.knowledgeBase]]. Er funktioniert wie die anderen Listen-Seiten des CRM (Tabs, Suche, Filter, [[crm.deleteSelected]], das Datensatz-Fenster) — diese Mechanik ist im Abschnitt „Tabellen“ beschrieben. Hier ist der Datensatz ein „Artikel“, die Schaltflächen heißen also „Add Article“ und „Edit Article“.",
						"Відкрийте другу вкладку [[company.knowledgeBase]]. Вона працює як інші сторінки-списки CRM (вкладки, пошук, фільтри, [[crm.deleteSelected]], вікно запису) — цю механіку описано в розділі «Таблиці». Тут запис — це «стаття», тож кнопки панелі мають назви «Add Article» та «Edit Article».",
					),
					t3(
						"Four sub-tabs group the articles: [[company.tab_general]], [[company.tab_sales]], [[company.tab_finance]] and [[company.tab_team]]. The window of an article has the fields [[company.f_title]] (required), [[company.f_category]] (a list; General: Process, Tools, Policy, Onboarding — Sales: Call script, Pricing, Objections, Process — Finance: Invoices, Taxes, Expenses, Deadlines — Team: Onboarding, Holidays, Contacts, Policy), [[company.f_body]] (a wide text field for the article text), [[company.f_author]] and [[company.f_updated]] (a date).",
						"Vier Unter-Tabs gruppieren die Artikel: [[company.tab_general]], [[company.tab_sales]], [[company.tab_finance]] und [[company.tab_team]]. Das Fenster eines Artikels hat die Felder [[company.f_title]] (Pflicht), [[company.f_category]] (eine Liste; Allgemein: Prozess, Werkzeuge, Richtlinie, Onboarding — Vertrieb: Gesprächsleitfaden, Preise, Einwände, Prozess — Finanzen: Rechnungen, Steuern, Ausgaben, Fristen — Team: Onboarding, Urlaub, Kontakte, Richtlinie), [[company.f_body]] (ein breites Textfeld für den Artikeltext), [[company.f_author]] und [[company.f_updated]] (ein Datum).",
						"Чотири підвкладки групують статті: [[company.tab_general]], [[company.tab_sales]], [[company.tab_finance]] та [[company.tab_team]]. Вікно статті має поля [[company.f_title]] (обов’язкове), [[company.f_category]] (список; Загальне: Процес, Інструменти, Політика, Онбординг — Продажі: Скрипт дзвінка, Ціни, Заперечення, Процес — Фінанси: Рахунки, Податки, Витрати, Терміни — Команда: Онбординг, Відпустки, Контакти, Політика), [[company.f_body]] (широке поле для тексту статті), [[company.f_author]] та [[company.f_updated]] (дата).",
					),
					t3(
						"Until your firm changes a sub-tab, it shows a few starter articles as examples (they are written in German in all languages). The first time you edit or delete one, all the examples of that sub-tab become ordinary records of your firm that you can change freely.",
						"Solange Ihre Firma einen Unter-Tab nicht ändert, zeigt er ein paar Start-Artikel als Beispiele (sie sind in allen Sprachen auf Deutsch). Sobald Sie einen davon zum ersten Mal ändern oder löschen, werden alle Beispiele dieses Unter-Tabs zu gewöhnlichen Datensätzen Ihrer Firma, die Sie frei ändern können.",
						"Поки ваша фірма не змінила підвкладку, вона показує кілька стартових статей як приклади (вони німецькою в усіх мовах). Коли ви вперше змінюєте чи видаляєте одну з них, усі приклади цієї підвкладки стають звичайними записами вашої фірми, які можна вільно змінювати.",
					),
				],
			},
		],
	},
];
