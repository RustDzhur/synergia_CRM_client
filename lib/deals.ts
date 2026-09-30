import { isValidObjectId } from "mongoose";
import Contact from "@/models/Contact";
import Company from "@/models/Company";
import Deal from "@/models/Deal";
import Contract from "@/models/Contract";

// Ссылка на Contact/Company/Deal/Contract принимается, только если такая запись действительно существует у этого
// владельца — иначе через POST/PATCH можно было бы привязать документ к чужим данным, зная только чужой ObjectId.
// Используется не только для Deal.contact/Deal.company, но и для Quote/Order/Invoice/Contract.contact/company/deal
// (Finance-модели раньше принимали эти id вообще без проверки — тот же пробел, что был у Deal до Phase 1).
// CRM-модели (Contact/Company/Deal) хранят владельца в поле "owner", Finance-модели (Contract) — в поле "org";
// это одно и то же значение (id организации), просто исторически разное имя поля.
// Возвращает: undefined — поле не прислано (не трогать), null — прислано пустым/невалидным (снять ссылку), id — привязать.
async function ownedRef(Model: typeof Contact | typeof Company | typeof Deal | typeof Contract, field: "owner" | "org", id: unknown, owner: string) {
    if (id === undefined) return undefined;
    if (typeof id !== "string" || !id || !isValidObjectId(id)) return null;
    const doc = await Model.findOne({ _id: id, [field]: owner }).select("_id");
    return doc ? doc._id : null;
}

export const ownedContact = (id: unknown, owner: string) => ownedRef(Contact, "owner", id, owner);
export const ownedCompany = (id: unknown, owner: string) => ownedRef(Company, "owner", id, owner);
export const ownedDeal = (id: unknown, owner: string) => ownedRef(Deal, "owner", id, owner);
export const ownedContract = (id: unknown, owner: string) => ownedRef(Contract, "org", id, owner);

// Сделка клиента для документа, созданного в финансовой части без явной привязки: берём самую свежую
// ещё не выигранную сделку этого контакта, фирмы или клиента с тем же именем. Так счёт или договор,
// оформленный в Finance, сам появляется в карточке клиента — ради этого привязка и нужна.
// Имя сравниваем потому, что в формах финансов клиент вводится текстом: ссылки на контакт и фирму
// там не выбираются, и без сверки по имени привязка не сработала бы почти никогда.
export async function dealForCustomer(owner: string, contact?: unknown, company?: unknown, customerName?: unknown) {
    const or: Record<string, unknown>[] = [];
    if (contact && isValidObjectId(String(contact))) or.push({ contact });
    if (company && isValidObjectId(String(company))) or.push({ company });
    const name = typeof customerName === "string" ? customerName.trim() : "";
    if (name) {
        const exact = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
        or.push({ companyName: exact }, { contactName: exact }, { clientName: exact });
    }
    if (!or.length) return null;
    return Deal.findOne({ owner, wonAt: null, $or: or }).sort({ updatedAt: -1 }).select("_id").catch(() => null);
}

// Контакт клиента для финансового документа: выбранный из подсказки → найденный по точному имени →
// СОЗДАННЫЙ. Правило владельца: «карточка клиента ведётся по CRM» — документ, оформленный на новое
// имя, заводит карточку сам, и счёт/заказ сразу виден в ней (как в карточке сделки). Без этого
// клиент жил бы текстом в счёте, а в CRM его бы не было. Фирму не трогаем: если выбрана Company,
// контакт не нужен — документ привязан к фирме.
export async function contactForCustomer(owner: string, input: { contact?: unknown; company?: unknown; customerName?: unknown; email?: unknown }) {
    if (input.contact && isValidObjectId(String(input.contact))) {
        const found = await Contact.findOne({ _id: input.contact, owner }).select("_id");
        if (found) return found._id;
    }
    const name = typeof input.customerName === "string" ? input.customerName.trim() : "";
    if (!name) return null;
    // Уже выбрана фирма CRM — документ и так виден в её карточке, отдельный контакт не создаём
    if (input.company && isValidObjectId(String(input.company))) return null;
    const exact = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const existing = await Contact.findOne({ owner, name: exact }).select("_id").catch(() => null);
    if (existing) return existing._id;
    // «Роздрібний покупець» и подобные заглушки карточек не заслуживают — это не клиент
    if (/^(роздрібний покупець|рozdr|barverkauf|retail customer|laufkunde)/i.test(name)) return null;
    const email = typeof input.email === "string" && input.email.includes("@") ? input.email.trim().slice(0, 200) : "";
    const created = await Contact.create({ owner, name: name.slice(0, 200), ...(email ? { email } : {}), source: "finance" }).catch(() => null);
    return created ? created._id : null;
}
