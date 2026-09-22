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
