import { prisma } from "@/lib/prisma";
import { validId } from "@/lib/api";
import { contractDate, contractValueText } from "./contractText";
import { partyValues, partyVars, type Raw } from "./contractFields";

// Значения всех меток договора (docs/CONTRACT_FIELDS.md). Приоритет, от сильного к слабому:
//   1. то, что введено в форме этого договора (contract.fields) — человек поправил для конкретного клиента;
//   2. реквизиты в карточке клиента (extra) → стандартные колонки карточки контакта/компании;
//   3. данные фирмы: настройки бухгалтерии и раздел «Реквизиты для договоров» (contractData).
// Контакт даёт сведения о человеке (имя, паспорт, дата рождения), компания — о юрлице (коды, адрес, банк); для общих полей
// (адрес, телефон, e-mail, код) побеждает компания, если она привязана, иначе — контакт.

const PERSON_GROUP = new Set(["lastName", "firstName", "middleName", "fullName", "initials", "birthDate", "birthPlace", "gender", "citizenship", "maritalStatus", "idDocType", "passportSeries", "passportNumber", "passportFull", "passportIssuedBy", "passportIssueDate", "passportExpiryDate", "idCardNumber", "unzr", "residencePermit", "rnokpp", "pinfl", "steuerId", "socialNumber", "mobilePhone", "telegram"]);

const asRaw = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});

/** Реквизиты клиента (base → текст) из связанных карточек: контакт и/или компания. */
export async function customerValues(org: string, link: { contact?: unknown; company?: unknown; customerName?: string }): Promise<Record<string, string>> {
    const contact = link.contact && validId(String(link.contact)) ? await prisma.contact.findFirst({ where: { id: String(link.contact), owner: org } }) : null;
    const company = link.company && validId(String(link.company)) ? await prisma.company.findFirst({ where: { id: String(link.company), owner: org } }) : null;
    const forContact = contact
        ? partyValues({ ...contact, address: "", companyName: "" }, asRaw(contact.extra))
        : null;
    const forCompany = company
        ? partyValues(
              {
                  companyName: company.name, email: company.email, taxId: company.code, address: company.address, person: company.authorisedPerson,
                  registrationDate: company.registrationDate, legalForm: company.ownershipForm, activity: company.businessType || company.field,
              },
              asRaw(company.extra)
          )
        : null;
    const out: Record<string, string> = {};
    const keys = new Set([...Object.keys(forContact ?? {}), ...Object.keys(forCompany ?? {})]);
    for (const k of Array.from(keys)) {
        const c = forContact?.[k] ?? "";
        const o = forCompany?.[k] ?? "";
        out[k] = PERSON_GROUP.has(k) ? c || o : o || c;
    }
    // Контактное лицо и полное имя клиента: имя на документе — то, что выбрано в договоре; иначе название компании или ФИО контакта
    const name = String(link.customerName ?? "").trim() || company?.name || contact?.name || "";
    out.companyName = forCompany?.companyName || company?.name || out.companyName || "";
    out.person = out.person || contact?.name || "";
    out.__name = name;
    return out;
}

/** Реквизиты нашей фирмы (base → текст). */
export function firmValues(settings: any): Record<string, string> {
    const extra = asRaw(settings.contractData);
    return partyValues(
        {
            companyName: settings.legalName, address: settings.address, taxId: settings.taxId, phone: settings.phone, email: settings.email, website: settings.website,
            iban: settings.uaIban || settings.iban, bank: settings.uaBank, bic: settings.bic, vatId: settings.vatId, registerNumber: settings.registerNumber,
            person: settings.uaSignerName || settings.managingDirector,
        },
        extra
    );
}

/** Все подстановки договора: ключ метки → текст. */
export async function contractVars(org: string, c: any, settings: any, opts: { currency: string }): Promise<Record<string, string>> {
    const cust = await customerValues(org, c);
    const firm = firmValues(settings);
    const manual: Record<string, string> = {};
    for (const [k, v] of Object.entries(asRaw(c.fields))) if (typeof v === "string" && v.trim()) manual[k] = v.trim();
    const today = contractDate(new Date().toISOString().slice(0, 10));
    const base: Record<string, string> = {
        ...partyVars("firm", firm),
        ...partyVars("customer", cust),
        number: c.number,
        date: today,
        today,
        value: contractValueText(Number(c.value) || 0, opts.currency),
        currency: opts.currency,
        start: contractDate(c.startDate),
        end: contractDate(c.endDate),
        // исторические имена, которые уже стоят в сохранённых шаблонах
        firm: firm.companyName,
        signer: firm.person,
        customer: cust.__name || cust.companyName || cust.fullName,
        customerPerson: cust.person,
    };
    // даты карточек и ручного ввода (дд.мм.гггг), если они хранятся как ГГГГ-ММ-ДД
    const out = { ...base, ...manual };
    for (const [k, v] of Object.entries(out)) if (/^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = contractDate(v);
    return out;
}
