import { prisma } from "@/lib/prisma";
import { validId } from "@/lib/api";

// Ссылка на Contact/Company/Deal/Contract принимается, только если такая запись действительно существует у этого
// владельца — иначе через POST/PATCH можно было бы привязать документ к чужим данным, зная только чужой id.
// Используется не только для Deal.contact/Deal.company, но и для Quote/Order/Invoice/Contract.contact/company/deal.
// CRM-модели (Contact/Company/Deal) хранят владельца в поле "owner", Finance-модели (Contract) — в поле "org";
// это одно и то же значение (id организации), просто исторически разное имя поля.
// Возвращает: undefined — поле не прислано (не трогать), null — прислано пустым/невалидным (снять ссылку), id — привязать.
async function ownedRef(delegate: any, field: "owner" | "org", id: unknown, owner: string) {
    if (id === undefined) return undefined;
    if (typeof id !== "string" || !id || !validId(id)) return null;
    const doc = await delegate.findFirst({ where: { id, [field]: owner }, select: { id: true } });
    return doc ? doc.id : null;
}

export const ownedContact = (id: unknown, owner: string) => ownedRef(prisma.contact, "owner", id, owner);
export const ownedCompany = (id: unknown, owner: string) => ownedRef(prisma.company, "owner", id, owner);
export const ownedDeal = (id: unknown, owner: string) => ownedRef(prisma.deal, "owner", id, owner);
export const ownedContract = (id: unknown, owner: string) => ownedRef(prisma.contract, "org", id, owner);

// Сделка клиента для документа, созданного в финансовой части без явной привязки: берём самую свежую
// ещё не выигранную сделку этого контакта, фирмы или клиента с тем же именем. Так счёт или договор,
// оформленный в Finance, сам появляется в карточке клиента — ради этого привязка и нужна.
export async function dealForCustomer(owner: string, contact?: unknown, company?: unknown, customerName?: unknown) {
    const or: any[] = [];
    if (contact && validId(String(contact))) or.push({ contact: String(contact) });
    if (company && validId(String(company))) or.push({ company: String(company) });
    const name = typeof customerName === "string" ? customerName.trim() : "";
    if (name) {
        or.push({ companyName: { equals: name, mode: "insensitive" } }, { contactName: { equals: name, mode: "insensitive" } }, { clientName: { equals: name, mode: "insensitive" } });
    }
    if (!or.length) return null;
    // select { id } возвращает объект { id }, а сюда нужна строка: иначе prisma.*.create
    // получает { id } в скалярное поле и падает «Expected String or Null, provided Object»
    const found = await prisma.deal.findFirst({ where: { owner, wonAt: null, OR: or }, orderBy: { updatedAt: "desc" }, select: { id: true } }).catch(() => null);
    return found ? found.id : null;
}

// Контакт клиента для финансового документа: выбранный из подсказки → найденный по точному имени →
// СОЗДАННЫЙ. Правило владельца: «карточка клиента ведётся по CRM» — документ, оформленный на новое
// имя, заводит карточку сам, и счёт/заказ сразу виден в ней (как в карточке сделки). Без этого
// клиент жил бы текстом в счёте, а в CRM его бы не было. Фирму не трогаем: если выбрана Company,
// контакт не нужен — документ привязан к фирме.
export async function contactForCustomer(owner: string, input: { contact?: unknown; company?: unknown; customerName?: unknown; email?: unknown }) {
    if (input.contact && validId(String(input.contact))) {
        const found = await prisma.contact.findFirst({ where: { id: String(input.contact), owner }, select: { id: true } });
        if (found) return found.id;
    }
    const name = typeof input.customerName === "string" ? input.customerName.trim() : "";
    if (!name) return null;
    // Уже выбрана фирма CRM — документ и так виден в её карточке, отдельный контакт не создаём
    if (input.company && validId(String(input.company))) return null;
    const existing = await prisma.contact.findFirst({ where: { owner, name: { equals: name, mode: "insensitive" } }, select: { id: true } }).catch(() => null);
    if (existing) return existing.id;
    // «Роздрібний покупець» и подобные заглушки карточек не заслуживают — это не клиент
    if (/^(роздрібний покупець|рozdr|barverkauf|retail customer|laufkunde)/i.test(name)) return null;
    const email = typeof input.email === "string" && input.email.includes("@") ? input.email.trim().slice(0, 200) : "";
    const created = await prisma.contact.create({ data: { owner, name: name.slice(0, 200), ...(email ? { email } : {}), source: "finance" } }).catch(() => null);
    return created ? created.id : null;
}
