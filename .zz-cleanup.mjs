// Временный скрипт: удаляет тестовые аккаунты, созданные при проверке, вместе с их данными.
// Запускается вручную, после себя ничего не оставляет (файл удаляется следом).
import { readFileSync } from "node:fs";
import mongoose from "mongoose";

const env = readFileSync("./.env.local", "utf8");
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!uri) { console.error("MONGODB_URI не найден"); process.exit(1); }

const emails = process.argv.slice(2);
if (!emails.length) { console.error("укажите e-mail тестовых аккаунтов"); process.exit(1); }

await mongoose.connect(uri);
const db = mongoose.connection.db;

// Коллекции, где данные принадлежат фирме (поле owner или org = _id пользователя/фирмы)
const BY_OWNER = ["contacts", "deals", "stages", "tasks", "projects", "companies", "events", "conversations",
    "messages", "feedposts", "sectionrecords", "memberships", "integrations", "bankaccounts", "banktransactions",
    "assets", "expenses", "invoices", "orders", "quotes", "contracts", "recurringinvoices", "products",
    "financesettings", "notifications", "invitations", "employess", "employees", "records", "blogposts"];
const BY_ORG = ["financesettings", "sectionrecords", "bankaccounts", "banktransactions"];

for (const email of emails) {
    const user = await db.collection("users").findOne({ email });
    if (!user) { console.log(`— ${email}: нет такого пользователя`); continue; }
    const id = user._id;
    let total = 0;
    for (const name of BY_OWNER) {
        const col = db.collection(name);
        for (const field of ["owner", "org", "user"]) {
            const r = await col.deleteMany({ [field]: id }).catch(() => null);
            if (r?.deletedCount) { total += r.deletedCount; console.log(`  ${name}.${field}: -${r.deletedCount}`); }
        }
    }
    await db.collection("organizations").deleteMany({ $or: [{ _id: id }, { ownerUser: id }] });
    await db.collection("users").deleteOne({ _id: id });
    console.log(`— ${email}: удалено ${total} записей, пользователь и фирма убраны`);
}

await mongoose.disconnect();
