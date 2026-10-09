import { isHtmlBody, tokensInHtml } from "./contractHtml";

// Каталог полей договора (docs/CONTRACT_FIELDS.md): что юрист может перетащить в шаблон и что подставляется само.
// Три источника значений:
//  • customer* — данные клиента: карточка контакта и компании CRM (стандартные колонки + произвольные реквизиты в extra);
//  • firm* — данные вашей фирмы: настройки бухгалтерии + раздел «Реквизиты фирмы для договоров»;
//  • договор — номер, дата, сумма, сроки (подставляются сами) и «условия» (город, предмет, срок аренды, оклад…): вводятся в форме договора.
// Файл чистый (без базы и React): те же функции нужны в браузере (палитра, предпросмотр) и на сервере (PDF).

export type Lang = "en" | "de" | "ua" | "uz";
export type Country = "DE" | "UA" | "UZ";
export type FieldType = "text" | "date" | "number" | "money";
export type Side = "customer" | "firm" | "contract";
export type GroupId = "person" | "idDoc" | "taxReg" | "address" | "contact" | "bank" | "company" | "representative" | "contract" | "terms" | "rent" | "work" | "sale" | "loan" | "vehicle";

export interface CatalogField {
	key: string; // имя подстановки {{key}}
	base: string; // имя в карточке (extra[base]); у полей договора = key
	side: Side;
	group: GroupId;
	type: FieldType;
	countries: Country[] | "all";
	label: Record<Lang, string>;
	/** вычисляется из других полей (ФИО, паспорт целиком) — вручную не вводится */
	computed?: boolean;
	/** подставляется системой (номер, дата, сумма) — вручную не вводится */
	system?: boolean;
	/** ручное поле договора — вводится в форме договора */
	manual?: boolean;
}

// ── реквизиты стороны (клиента и фирмы): один список, два набора ключей ──────────────────────────────
// [base, group, type, countries, en, ua, de, uz, flags]
type Row = [string, GroupId, FieldType, Country[] | "all", string, string, string, string, string?];
const ALL = "all" as const;
const PARTY: Row[] = [
	["lastName", "person", "text", ALL, "Last name", "Прізвище", "Nachname", "Familiya"],
	["firstName", "person", "text", ALL, "First name", "Ім’я", "Vorname", "Ism"],
	["middleName", "person", "text", ALL, "Patronymic / middle name", "По батькові", "Vatersname / zweiter Vorname", "Otasining ismi"],
	["fullName", "person", "text", ALL, "Full name (last, first, middle)", "ПІБ повністю", "Vollständiger Name", "To‘liq F.I.Sh.", "c"],
	["initials", "person", "text", ALL, "Last name and initials", "Прізвище та ініціали", "Nachname und Initialen", "Familiya va initsiallar", "c"],
	["birthDate", "person", "date", ALL, "Date of birth", "Дата народження", "Geburtsdatum", "Tug‘ilgan sana"],
	["birthPlace", "person", "text", ALL, "Place of birth", "Місце народження", "Geburtsort", "Tug‘ilgan joyi"],
	["gender", "person", "text", ALL, "Gender", "Стать", "Geschlecht", "Jinsi"],
	["citizenship", "person", "text", ALL, "Citizenship", "Громадянство", "Staatsangehörigkeit", "Fuqarolik"],
	["maritalStatus", "person", "text", ALL, "Marital status", "Сімейний стан", "Familienstand", "Oilaviy holati"],
	["idDocType", "idDoc", "text", ALL, "Type of ID document", "Вид документа, що посвідчує особу", "Art des Ausweisdokuments", "Shaxsni tasdiqlovchi hujjat turi"],
	["passportSeries", "idDoc", "text", ALL, "Passport series", "Серія паспорта", "Passserie", "Pasport seriyasi"],
	["passportNumber", "idDoc", "text", ALL, "Passport number", "Номер паспорта", "Passnummer", "Pasport raqami"],
	["passportFull", "idDoc", "text", ALL, "Passport (series and number)", "Паспорт (серія та номер)", "Pass (Serie und Nummer)", "Pasport (seriya va raqam)", "c"],
	["passportIssuedBy", "idDoc", "text", ALL, "Passport issued by", "Ким виданий паспорт", "Ausgestellt von", "Pasportni bergan organ"],
	["passportIssueDate", "idDoc", "date", ALL, "Passport issue date", "Дата видачі паспорта", "Ausstellungsdatum", "Pasport berilgan sana"],
	["passportExpiryDate", "idDoc", "date", ALL, "Passport valid until", "Паспорт дійсний до", "Gültig bis", "Pasport amal qilish muddati"],
	["idCardNumber", "idDoc", "text", ["UA", "DE"], "ID card number", "Номер ID-картки", "Personalausweisnummer", "ID-karta raqami"],
	["unzr", "idDoc", "text", ["UA"], "UNZR (record number in the register)", "УНЗР (запис у реєстрі)", "UNZR (Registereintrag)", "UNZR (reyestrdagi yozuv)"],
	["residencePermit", "idDoc", "text", ALL, "Residence permit number", "Номер посвідки на проживання", "Aufenthaltstitel-Nummer", "Yashash guvohnomasi raqami"],
	["taxId", "taxReg", "text", ALL, "Tax / registration code (EDRPOU, TIN, STIR, Steuernummer)", "Код (ЄДРПОУ / ІПН / STIR / Steuernummer)", "Steuer-/Registernummer", "Soliq / ro‘yxat kodi (STIR, EDRPOU …)"],
	["rnokpp", "taxReg", "text", ["UA"], "RNOKPP (individual tax number)", "РНОКПП (ІПН фізичної особи)", "RNOKPP (Steuernummer natürliche Person, UA)", "RNOKPP (jismoniy shaxs soliq raqami, UA)"],
	["edrpou", "taxReg", "text", ["UA"], "EDRPOU code", "Код ЄДРПОУ", "EDRPOU-Code", "EDRPOU kodi"],
	["pinfl", "taxReg", "text", ["UZ"], "PINFL (personal ID number)", "ПІНФЛ (персональний номер, UZ)", "PINFL (persönliche Kennnummer, UZ)", "JShShIR (PINFL)"],
	["stir", "taxReg", "text", ["UZ"], "STIR / INN (taxpayer ID)", "СТІР / ІПН (UZ)", "STIR / INN (Steuerzahler-ID, UZ)", "STIR (INN)"],
	["steuerId", "taxReg", "text", ["DE"], "Tax ID (Steuer-ID)", "Податковий ID (Steuer-ID, DE)", "Steuer-ID", "Soliq ID (Steuer-ID, DE)"],
	["steuernummer", "taxReg", "text", ["DE"], "Tax number (Steuernummer)", "Податковий номер (Steuernummer, DE)", "Steuernummer", "Soliq raqami (Steuernummer, DE)"],
	["vatId", "taxReg", "text", ALL, "VAT ID", "ІПН платника ПДВ / VAT ID", "USt-IdNr.", "QQS to‘lovchi raqami (VAT ID)"],
	["registerNumber", "taxReg", "text", ALL, "Commercial register number (HRB, state registration)", "Номер державної реєстрації / реєстру", "Handelsregisternummer (HRB)", "Davlat ro‘yxatidan o‘tish raqami"],
	["registerCourt", "taxReg", "text", ["DE"], "Register court", "Реєстровий суд (DE)", "Registergericht", "Reyestr sudi (DE)"],
	["registrationDate", "taxReg", "date", ALL, "Registration date", "Дата реєстрації", "Eintragungsdatum", "Ro‘yxatdan o‘tgan sana"],
	["kved", "taxReg", "text", ["UA"], "KVED (activity code)", "КВЕД", "KVED (Tätigkeitsschlüssel, UA)", "KVED (UA)"],
	["oked", "taxReg", "text", ["UZ"], "OKED (activity code)", "ОКЕД (UZ)", "OKED (Tätigkeitsschlüssel, UZ)", "IFUT (OKED)"],
	["taxOffice", "taxReg", "text", ALL, "Tax office", "Податкова інспекція", "Finanzamt", "Soliq inspeksiyasi"],
	["socialNumber", "taxReg", "text", ALL, "Social insurance number", "Номер соціального страхування", "Sozialversicherungsnummer", "Ijtimoiy sug‘urta raqami"],
	["address", "address", "text", ALL, "Address", "Адреса", "Anschrift", "Manzil"],
	["registeredAddress", "address", "text", ALL, "Registered address (legal / residence registration)", "Юридична адреса / місце реєстрації", "Meldeadresse / Sitz", "Ro‘yxatdagi manzil (yuridik / propiska)"],
	["actualAddress", "address", "text", ALL, "Actual / mailing address", "Фактична / поштова адреса", "Tatsächliche / Postanschrift", "Haqiqiy / pochta manzili"],
	["country", "address", "text", ALL, "Country", "Країна", "Land", "Davlat"],
	["region", "address", "text", ALL, "Region / state", "Область / регіон", "Bundesland / Region", "Viloyat"],
	["city", "address", "text", ALL, "City", "Місто", "Stadt", "Shahar"],
	["district", "address", "text", ALL, "District", "Район", "Bezirk / Kreis", "Tuman"],
	["street", "address", "text", ALL, "Street", "Вулиця", "Straße", "Ko‘cha"],
	["house", "address", "text", ALL, "House number", "Номер будинку", "Hausnummer", "Uy raqami"],
	["apartment", "address", "text", ALL, "Apartment / office", "Квартира / офіс", "Wohnung / Büro", "Kvartira / ofis"],
	["postalCode", "address", "text", ALL, "Postal code", "Поштовий індекс", "Postleitzahl", "Pochta indeksi"],
	["phone", "contact", "text", ALL, "Phone", "Телефон", "Telefon", "Telefon"],
	["mobilePhone", "contact", "text", ALL, "Mobile phone", "Мобільний телефон", "Mobiltelefon", "Mobil telefon"],
	["fax", "contact", "text", ALL, "Fax", "Факс", "Fax", "Faks"],
	["email", "contact", "text", ALL, "E-mail", "E-mail", "E-Mail", "E-mail"],
	["website", "contact", "text", ALL, "Website", "Сайт", "Webseite", "Sayt"],
	["telegram", "contact", "text", ALL, "Telegram", "Telegram", "Telegram", "Telegram"],
	["bank", "bank", "text", ALL, "Bank name", "Назва банку", "Bankname", "Bank nomi"],
	["iban", "bank", "text", ALL, "IBAN", "IBAN", "IBAN", "IBAN"],
	["bic", "bank", "text", ALL, "BIC / SWIFT", "BIC / SWIFT", "BIC / SWIFT", "BIC / SWIFT"],
	["mfo", "bank", "text", ["UA", "UZ"], "Bank code (MFO)", "МФО банку", "Bankleitzahl (MFO)", "Bank MFO kodi"],
	["accountNumber", "bank", "text", ["UA", "UZ"], "Settlement account number", "Розрахунковий рахунок", "Kontonummer", "Hisob raqami (h/r)"],
	["companyName", "company", "text", ALL, "Legal name of the company", "Повна назва юридичної особи", "Firmenname laut Register", "Yuridik shaxsning to‘liq nomi"],
	["legalForm", "company", "text", ALL, "Legal form (LLC, GmbH, sole proprietor…)", "Організаційно-правова форма (ТОВ, ФОП…)", "Rechtsform (GmbH, e. K. …)", "Tashkiliy-huquqiy shakl (MChJ, YaTT …)"],
	["activity", "company", "text", ALL, "Line of business", "Вид діяльності", "Geschäftstätigkeit", "Faoliyat turi"],
	["person", "representative", "text", ALL, "Representative / contact person", "Представник / контактна особа", "Vertreter / Ansprechpartner", "Vakil / aloqa shaxsi"],
	["representativePosition", "representative", "text", ALL, "Representative position (director, CEO…)", "Посада представника (директор…)", "Position des Vertreters (Geschäftsführer …)", "Vakil lavozimi (direktor …)"],
	["representativeBasis", "representative", "text", ALL, "Acting on the basis of (charter, power of attorney)", "Діє на підставі (статут, довіреність)", "Vertretungsbefugnis (Satzung, Vollmacht)", "Asosida harakat qiladi (ustav, ishonchnoma)"],
	["powerOfAttorney", "representative", "text", ALL, "Power of attorney (number and date)", "Довіреність (номер і дата)", "Vollmacht (Nummer und Datum)", "Ishonchnoma (raqami va sanasi)"],
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SIDE_LABEL: Record<Side, Record<Lang, string>> = {
	customer: { en: "Client", ua: "Клієнт", de: "Kunde", uz: "Mijoz" },
	firm: { en: "Our firm", ua: "Наша фірма", de: "Unsere Firma", uz: "Bizning firma" },
	contract: { en: "", ua: "", de: "", uz: "" },
};
// Исторические имена ключей (они уже стоят в сохранённых шаблонах): customer, firm, signer и т.д. не переименовываются
const LEGACY_KEY: Record<string, string> = {
	"customer.companyName": "customer", "firm.companyName": "firm", "customer.person": "customerPerson", "firm.person": "signer",
};

const keyOf = (side: "customer" | "firm", base: string) => LEGACY_KEY[`${side}.${base}`] ?? `${side}${cap(base)}`;

function partyFields(): CatalogField[] {
	const out: CatalogField[] = [];
	for (const side of ["customer", "firm"] as const) {
		for (const r of PARTY) {
			const [base, group, type, countries, en, ua, de, uz, flags] = r;
			const l = (lang: Lang, text: string) => `${SIDE_LABEL[side][lang]}: ${text}`;
			out.push({
				key: keyOf(side, base), base, side, group, type, countries,
				label: { en: l("en", en), ua: l("ua", ua), de: l("de", de), uz: l("uz", uz) },
				computed: flags === "c" || undefined,
			});
		}
	}
	return out;
}

// ── поля самого договора ──────────────────────────────────────────────────────────────────────────
// Системные подставляются сами; «условия» (manual) вводятся в форме договора — их список зависит от того, какие метки есть в тексте.
const CONTRACT: Row[] = [
	["number", "contract", "text", ALL, "Contract number", "Номер договору", "Vertragsnummer", "Shartnoma raqami", "s"],
	["date", "contract", "date", ALL, "Contract date", "Дата договору", "Vertragsdatum", "Shartnoma sanasi", "s"],
	["today", "contract", "date", ALL, "Today’s date (printing day)", "Сьогоднішня дата (день друку)", "Heutiges Datum (Druckdatum)", "Bugungi sana (chop etilgan kun)", "s"],
	["value", "contract", "money", ALL, "Contract amount", "Сума договору", "Vertragssumme", "Shartnoma summasi", "s"],
	["currency", "contract", "text", ALL, "Contract currency", "Валюта договору", "Vertragswährung", "Shartnoma valyutasi", "s"],
	["start", "contract", "date", ALL, "Start date", "Початок дії / робіт", "Beginn", "Boshlanish sanasi", "s"],
	["end", "contract", "date", ALL, "End date", "Завершення дії / робіт", "Ende", "Tugash sanasi", "s"],
	["contractCity", "terms", "text", ALL, "City of signing", "Місто укладення", "Ort des Vertragsschlusses", "Tuzilgan joy", "m"],
	["contractSubject", "terms", "text", ALL, "Subject of the contract", "Предмет договору", "Vertragsgegenstand", "Shartnoma predmeti", "m"],
	["duration", "terms", "text", ALL, "Term (e.g. 12 months)", "Строк дії (напр. 12 місяців)", "Laufzeit (z. B. 12 Monate)", "Amal qilish muddati (masalan, 12 oy)", "m"],
	["paymentDays", "terms", "number", ALL, "Payment term, days", "Строк оплати, днів", "Zahlungsfrist in Tagen", "To‘lov muddati, kun", "m"],
	["prepaymentPercent", "terms", "number", ALL, "Prepayment, %", "Передоплата, %", "Anzahlung, %", "Avans, %", "m"],
	["penaltyRate", "terms", "number", ALL, "Penalty rate, % per day", "Пеня, % за день", "Verzugszins, % pro Tag", "Penya, kuniga %", "m"],
	["acceptanceDays", "terms", "number", ALL, "Acceptance period, days", "Строк приймання, днів", "Abnahmefrist in Tagen", "Qabul qilish muddati, kun", "m"],
	["warrantyMonths", "terms", "number", ALL, "Warranty, months", "Гарантія, місяців", "Gewährleistung in Monaten", "Kafolat, oy", "m"],
	["noticeDays", "terms", "number", ALL, "Termination notice, days", "Строк попередження про розірвання, днів", "Kündigungsfrist in Tagen", "Bekor qilish haqida ogohlantirish, kun", "m"],
	["jurisdiction", "terms", "text", ALL, "Court / jurisdiction", "Підсудність (суд)", "Gerichtsstand", "Sudlov (sud)", "m"],
	["governingLaw", "terms", "text", ALL, "Governing law", "Право, що застосовується", "Anwendbares Recht", "Qo‘llaniladigan huquq", "m"],
	["objectDescription", "rent", "text", ALL, "Object description (premises, equipment)", "Опис об’єкта (приміщення, обладнання)", "Beschreibung des Objekts", "Obyekt tavsifi", "m"],
	["objectAddress", "rent", "text", ALL, "Object address", "Адреса об’єкта", "Anschrift des Objekts", "Obyekt manzili", "m"],
	["objectArea", "rent", "number", ALL, "Area, m²", "Площа, м²", "Fläche in m²", "Maydon, m²", "m"],
	["objectCadastral", "rent", "text", ALL, "Cadastral number", "Кадастровий номер", "Flurstücks-/Katasternummer", "Kadastr raqami", "m"],
	["monthlyRent", "rent", "money", ALL, "Monthly rent", "Орендна плата на місяць", "Monatsmiete", "Oylik ijara haqi", "m"],
	["deposit", "rent", "money", ALL, "Security deposit", "Гарантійний внесок (застава)", "Kaution", "Kafolat depoziti", "m"],
	["utilitiesTerms", "rent", "text", ALL, "Utilities terms", "Умови оплати комунальних послуг", "Nebenkosten-Regelung", "Kommunal xizmatlar shartlari", "m"],
	["jobTitle", "work", "text", ALL, "Job title", "Посада", "Stellenbezeichnung", "Lavozim", "m"],
	["salary", "work", "money", ALL, "Salary", "Заробітна плата", "Gehalt", "Ish haqi", "m"],
	["probationMonths", "work", "number", ALL, "Probation, months", "Випробувальний строк, місяців", "Probezeit in Monaten", "Sinov muddati, oy", "m"],
	["workplace", "work", "text", ALL, "Place of work", "Місце роботи", "Arbeitsort", "Ish joyi", "m"],
	["workSchedule", "work", "text", ALL, "Working hours", "Режим роботи", "Arbeitszeit", "Ish tartibi", "m"],
	["vacationDays", "work", "number", ALL, "Vacation days per year", "Відпустка, днів на рік", "Urlaubstage pro Jahr", "Yillik ta’til, kun", "m"],
	["goodsDescription", "sale", "text", ALL, "Goods / services description", "Опис товару / послуг", "Beschreibung der Ware / Leistung", "Tovar / xizmat tavsifi", "m"],
	["deliveryTerms", "sale", "text", ALL, "Delivery terms (Incoterms)", "Умови поставки", "Lieferbedingungen", "Yetkazib berish shartlari", "m"],
	["deliveryPlace", "sale", "text", ALL, "Delivery place", "Місце поставки", "Lieferort", "Yetkazib berish joyi", "m"],
	["deliveryDate", "sale", "date", ALL, "Delivery date", "Дата поставки", "Lieferdatum", "Yetkazib berish sanasi", "m"],
	["loanAmount", "loan", "money", ALL, "Loan amount", "Сума позики", "Darlehensbetrag", "Qarz summasi", "m"],
	["interestRate", "loan", "number", ALL, "Interest rate, % per year", "Відсоткова ставка, % річних", "Zinssatz, % p. a.", "Foiz stavkasi, yillik %", "m"],
	["loanTerm", "loan", "text", ALL, "Loan term", "Строк позики", "Darlehenslaufzeit", "Qarz muddati", "m"],
	["repaymentSchedule", "loan", "text", ALL, "Repayment schedule", "Графік повернення", "Rückzahlungsplan", "Qaytarish jadvali", "m"],
	["vehicleMake", "vehicle", "text", ALL, "Vehicle make and model", "Марка та модель авто", "Fahrzeug (Marke, Modell)", "Avtomobil markasi va modeli", "m"],
	["vehicleVin", "vehicle", "text", ALL, "VIN", "VIN-код", "Fahrgestellnummer (VIN)", "VIN kod", "m"],
	["vehiclePlate", "vehicle", "text", ALL, "Licence plate", "Державний номер", "Kennzeichen", "Davlat raqami", "m"],
	["witnessName", "terms", "text", ALL, "Witness name", "Свідок (ПІБ)", "Zeuge (Name)", "Guvoh (F.I.Sh.)", "m"],
];

function contractFields(): CatalogField[] {
	return CONTRACT.map(([key, group, type, countries, en, ua, de, uz, flags]) => ({
		key, base: key, side: "contract" as const, group, type, countries, label: { en, ua, de, uz },
		system: flags === "s" || undefined, manual: flags === "m" || undefined,
	}));
}

export const CATALOG: CatalogField[] = [...contractFields(), ...partyFields()];
export const CATALOG_BY_KEY = new Map(CATALOG.map((f) => [f.key.toLowerCase(), f]));

/** Поле договора по имени метки (регистр не важен), учитывая синонимы вроде {{Name}}. */
export function fieldOf(token: string): CatalogField | undefined {
	const k = token.toLowerCase();
	return CATALOG_BY_KEY.get(k) ?? CATALOG_BY_KEY.get((ALIASES[k] ?? "").toLowerCase());
}

// Синонимы: юрист пишет {{Name}}, {{address}}, {{passport}} — подставляется то, что имел в виду
export const ALIASES: Record<string, string> = {
	name: "customer", fullname: "customerFullName", fio: "customerFullName", client: "customer", clientname: "customer", customername: "customer",
	firstname: "customerFirstName", lastname: "customerLastName", surname: "customerLastName", middlename: "customerMiddleName", patronymic: "customerMiddleName",
	address: "customerAddress", phone: "customerPhone", mobile: "customerMobilePhone", email: "customerEmail", mail: "customerEmail",
	passport: "customerPassportFull", passportseries: "customerPassportSeries", passportnumber: "customerPassportNumber",
	birthdate: "customerBirthDate", dob: "customerBirthDate", birthday: "customerBirthDate",
	inn: "customerTaxId", tin: "customerTaxId", taxid: "customerTaxId", edrpou: "customerEdrpou", ipn: "customerRnokpp", pinfl: "customerPinfl", stir: "customerStir",
	company: "firm", executor: "firm", contractor: "firm", seller: "firm", landlord: "firm", employer: "firm",
	buyer: "customer", tenant: "customer", employee: "customer", customercompany: "customer",
	sum: "value", amount: "value", price: "value", total: "value", city: "contractCity", place: "contractCity", subject: "contractSubject",
	startdate: "start", enddate: "end", contractnumber: "number", contractdate: "date",
};

export const GROUP_LABEL: Record<GroupId, Record<Lang, string>> = {
	person: { en: "Person: name & birth", ua: "Особа: ім’я та народження", de: "Person: Name & Geburt", uz: "Shaxs: ism va tug‘ilish" },
	idDoc: { en: "ID documents (passport, ID card)", ua: "Документи (паспорт, ID-картка)", de: "Ausweisdokumente", uz: "Hujjatlar (pasport, ID-karta)" },
	taxReg: { en: "Tax & registration numbers", ua: "Податкові та реєстраційні номери", de: "Steuer- & Registernummern", uz: "Soliq va ro‘yxat raqamlari" },
	address: { en: "Address", ua: "Адреса", de: "Anschrift", uz: "Manzil" },
	contact: { en: "Contacts", ua: "Контакти", de: "Kontakt", uz: "Aloqa" },
	bank: { en: "Bank details", ua: "Банківські реквізити", de: "Bankverbindung", uz: "Bank rekvizitlari" },
	company: { en: "Company", ua: "Юридична особа", de: "Unternehmen", uz: "Yuridik shaxs" },
	representative: { en: "Representative", ua: "Представник", de: "Vertreter", uz: "Vakil" },
	contract: { en: "Contract (filled automatically)", ua: "Договір (підставляється сам)", de: "Vertrag (automatisch)", uz: "Shartnoma (avtomatik)" },
	terms: { en: "Terms (entered in the contract form)", ua: "Умови (вводяться у формі договору)", de: "Konditionen (im Vertragsformular)", uz: "Shartlar (shartnoma shaklida)" },
	rent: { en: "Property / lease", ua: "Об’єкт / оренда", de: "Objekt / Miete", uz: "Obyekt / ijara" },
	work: { en: "Employment", ua: "Найм працівника", de: "Arbeitsverhältnis", uz: "Mehnat shartnomasi" },
	sale: { en: "Sale / delivery", ua: "Купівля-продаж / поставка", de: "Kauf / Lieferung", uz: "Oldi-sotdi / yetkazib berish" },
	loan: { en: "Loan", ua: "Позика", de: "Darlehen", uz: "Qarz" },
	vehicle: { en: "Vehicle", ua: "Транспортний засіб", de: "Fahrzeug", uz: "Transport vositasi" },
};
export const GROUP_ORDER: GroupId[] = ["contract", "person", "idDoc", "taxReg", "address", "contact", "bank", "company", "representative", "terms", "rent", "work", "sale", "loan", "vehicle"];

export const pickLang = (l: string): Lang => (l === "de" || l === "ua" || l === "uz" ? l : "en");
export const labelOf = (f: CatalogField, locale: string) => f.label[pickLang(locale)] ?? f.label.en;

/** Поля для страны фирмы: общие и своей страны; country = null — все. */
export const fieldsForCountry = (country: Country | null | undefined, list: CatalogField[] = CATALOG) =>
	list.filter((f) => !country || f.countries === "all" || f.countries.includes(country));

// ── значения ───────────────────────────────────────────────────────────────────────────────────────
export type Raw = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const first = (...vs: unknown[]) => vs.map(s).find(Boolean) ?? "";

/** «Иванов Иван Иванович» → «Иванов И. И.» */
export function initialsOf(last: string, first: string, middle: string): string {
	const ini = (w: string) => (w ? `${w.charAt(0).toUpperCase()}.` : "");
	return [last, [ini(first), ini(middle)].filter(Boolean).join(" ")].filter(Boolean).join(" ");
}

/**
 * Значения реквизитов одной стороны (base → текст). Приоритет: введённое вручную в карточку (extra) → колонки карточки → производные.
 * core — известные колонки (firstName, address, taxId…), extra — свободные реквизиты карточки по именам base из каталога.
 */
export function partyValues(core: Raw, extra: Raw): Record<string, string> {
	const v: Record<string, string> = {};
	for (const r of PARTY) { const b = r[0]; v[b] = first(extra[b], core[b]); }
	// из имени и ФИО
	if (!v.lastName && !v.firstName && core.name) {
		const [l = "", f = "", ...m] = s(core.name).split(/\s+/);
		if (!core.companyName) { v.lastName = v.lastName || l; v.firstName = v.firstName || f; v.middleName = v.middleName || m.join(" "); }
	}
	v.fullName = first(extra.fullName, [v.lastName, v.firstName, v.middleName].filter(Boolean).join(" "), core.name);
	v.initials = initialsOf(v.lastName, v.firstName, v.middleName) || v.fullName;
	v.passportFull = first(extra.passportFull, [v.passportSeries, v.passportNumber].filter(Boolean).join(" "));
	if (!v.taxId) v.taxId = first(v.edrpou, v.rnokpp, v.stir, v.pinfl, v.steuernummer, v.vatId);
	if (!v.address) v.address = first(v.registeredAddress, v.actualAddress, [v.postalCode, v.city, [v.street, v.house].filter(Boolean).join(" ")].filter(Boolean).join(", "));
	return v;
}

/** Ключи подстановок стороны: base → {{customerLastName}} / {{firmIban}}. */
export function partyVars(side: "customer" | "firm", values: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const r of PARTY) out[keyOf(side, r[0])] = values[r[0]] ?? "";
	return out;
}

/** Метки {{…}} в тексте (в порядке появления, без повторов). */
export function tokensIn(text: string): string[] {
	if (isHtmlBody(text)) return tokensInHtml(text); // богатый текст редактора: поля-меточки и {{ключи}}
	const seen = new Set<string>();
	const out: string[] = [];
	for (const m of Array.from(String(text ?? "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g))) {
		const k = m[1];
		if (!seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); }
	}
	return out;
}

/** Допустимые имена свободных реквизитов карточки (extra): каталог плюс собственные a–z0–9_. */
export const isExtraKey = (k: string) => /^[a-zA-Z][a-zA-Z0-9_]{0,59}$/.test(k);
/** Очистка extra из запроса: строки до 500 символов; пустая строка = удалить ключ (возвращается как null). */
export function cleanExtra(input: unknown): Record<string, string | null> {
	const out: Record<string, string | null> = {};
	if (!input || typeof input !== "object" || Array.isArray(input)) return out;
	for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 300)) {
		if (!isExtraKey(k)) continue;
		const t = typeof v === "string" ? v.trim().slice(0, 500) : typeof v === "number" ? String(v) : "";
		out[k] = t || null;
	}
	return out;
}
/** Слияние extra: null удаляет ключ. */
export function mergeExtra(current: unknown, patch: Record<string, string | null>): Record<string, string> {
	const base: Record<string, string> = {};
	if (current && typeof current === "object" && !Array.isArray(current)) for (const [k, v] of Object.entries(current as Record<string, unknown>)) if (typeof v === "string" && v) base[k] = v;
	for (const [k, v] of Object.entries(patch)) { if (v === null) delete base[k]; else base[k] = v; }
	return base;
}
