import { isValidObjectId } from "mongoose";
import Contact from "@/models/Contact";
import Company from "@/models/Company";

// Ссылка Deal.contact/Deal.company принимается, только если такая запись действительно существует у этого владельца —
// иначе через POST/PATCH можно было бы привязать сделку к чужим данным, зная только чужой ObjectId.
// Возвращает: undefined — поле не прислано (не трогать), null — прислано пустым/невалидным (снять ссылку), id — привязать.
async function ownedRef(Model: typeof Contact | typeof Company, id: unknown, owner: string) {
    if (id === undefined) return undefined;
    if (typeof id !== "string" || !id || !isValidObjectId(id)) return null;
    const doc = await Model.findOne({ _id: id, owner }).select("_id");
    return doc ? doc._id : null;
}

export const ownedContact = (id: unknown, owner: string) => ownedRef(Contact, id, owner);
export const ownedCompany = (id: unknown, owner: string) => ownedRef(Company, id, owner);
