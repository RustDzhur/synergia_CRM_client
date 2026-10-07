// Согласование связей между сущностями. Связи в базе — строки без внешних ключей, и со временем появляются:
//  • осиротевшие ссылки (счёт ссылается на удалённую сделку, задача — на удалённого контакта и т.п.);
//  • устаревшие копии имени клиента в сделках и черновиках документов;
//  • повторяющиеся номера документов;
//  • задачи сделки без контакта и фирмы сделки (нужны карточке клиента).
// Запуск (нужен DATABASE_URL):
//   node scripts/reconcile-links.mjs            — только отчёт, ничего не меняет
//   node scripts/reconcile-links.mjs --apply    — исправить то, что исправляется безопасно:
//        обнулить осиротевшие ссылки, подтянуть имена в сделках и черновиках, заполнить контакт/фирму у задач сделок.
// Дубли номеров документов только показываются: перенумерация выпущенных документов запрещена законом, решает бухгалтер.
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();
const report = [];
const note = (kind, text, n) => { if (n) report.push({ kind, text, n }); };

const idsOf = async (model, where = {}) => new Set((await prisma[model].findMany({ where, select: { id: true } })).map((r) => r.id));
const [deals, contacts, companies, orders, contractsSet, projects] = await Promise.all([
    idsOf("deal"), idsOf("contact"), idsOf("company"), idsOf("order"), idsOf("contract"), idsOf("project"),
]);

// ссылки: [модель, поле, множество существующих id, ключ фирмы]
const LINKS = [
    ["invoice", "deal", deals], ["invoice", "contact", contacts], ["invoice", "company", companies], ["invoice", "order", orders], ["invoice", "contract", contractsSet],
    ["quote", "deal", deals], ["quote", "contact", contacts], ["quote", "company", companies],
    ["order", "deal", deals], ["order", "contact", contacts], ["order", "company", companies],
    ["contract", "deal", deals], ["contract", "contact", contacts], ["contract", "company", companies],
    ["expense", "deal", deals], ["expense", "order", orders],
    ["task", "deal", deals], ["task", "contact", contacts], ["task", "company", companies], ["task", "project", projects],
    ["deal", "contact", contacts], ["deal", "company", companies],
    ["conversation", "contact", contacts],
];
for (const [model, field, exist] of LINKS) {
    const rows = await prisma[model].findMany({ where: { [field]: { not: null } }, select: { id: true, [field]: true } });
    const orphans = rows.filter((r) => r[field] && !exist.has(r[field]));
    note("orphan", `${model}.${field} ссылается на несуществующую запись`, orphans.length);
    if (apply && orphans.length) await prisma[model].updateMany({ where: { id: { in: orphans.map((r) => r.id) } }, data: { [field]: null } });
}

// устаревшие копии имени клиента в сделках
for (const [field, relation, nameOf] of [["contactName", "contact", async (id) => (await prisma.contact.findUnique({ where: { id } }))?.name], ["companyName", "company", async (id) => (await prisma.company.findUnique({ where: { id } }))?.name]]) {
    const rows = await prisma.deal.findMany({ where: { [relation]: { not: null } }, select: { id: true, [field]: true, [relation]: true } });
    let stale = 0;
    for (const r of rows) {
        const name = await nameOf(r[relation]);
        if (name && r[field] !== name) { stale++; if (apply) await prisma.deal.update({ where: { id: r.id }, data: { [field]: name } }); }
    }
    note("stale", `deal.${field} расходится с именем клиента`, stale);
}

// черновики документов: имя клиента в документе, привязанном к контакту
for (const [model, drafts] of [["invoice", ["draft"]], ["quote", ["draft"]], ["order", ["draft", "confirmed"]], ["contract", ["draft"]]]) {
    const rows = await prisma[model].findMany({ where: { contact: { not: null }, status: { in: drafts } }, select: { id: true, contact: true, customerName: true } });
    let stale = 0;
    for (const r of rows) {
        const c = await prisma.contact.findUnique({ where: { id: r.contact }, select: { name: true } });
        if (c && c.name !== r.customerName) { stale++; if (apply) await prisma[model].update({ where: { id: r.id }, data: { customerName: c.name } }); }
    }
    note("stale", `${model} (черновик): customerName расходится с контактом`, stale);
}

// задачи сделки без контакта и фирмы
{
    const tasks = await prisma.task.findMany({ where: { deal: { not: null }, OR: [{ contact: null }, { company: null }] }, select: { id: true, deal: true, contact: true, company: true } });
    let fixable = 0;
    for (const t of tasks) {
        const d = await prisma.deal.findUnique({ where: { id: t.deal }, select: { contact: true, company: true } });
        const data = {};
        if (!t.contact && d?.contact) data.contact = d.contact;
        if (!t.company && d?.company) data.company = d.company;
        if (Object.keys(data).length) { fixable++; if (apply) await prisma.task.update({ where: { id: t.id }, data }); }
    }
    note("missing", "задача сделки без контакта/фирмы сделки", fixable);
}

// дубли номеров документов (только отчёт)
for (const [model, table] of [["invoice", "invoices"], ["quote", "quotes"], ["order", "orders"], ["contract", "contracts"]]) {
    const dup = await prisma.$queryRawUnsafe(`SELECT "org", "number", COUNT(*)::int AS n FROM "${table}" GROUP BY "org", "number" HAVING COUNT(*) > 1`);
    note("duplicate", `${model}: повторяющийся номер (исправить вручную, перенумерация выпущенных документов запрещена): ${dup.slice(0, 5).map((d) => d.number).join(", ")}`, dup.length);
}

console.log(apply ? "Режим: ИСПРАВЛЕНИЕ" : "Режим: только отчёт (добавьте --apply для исправления)");
if (!report.length) console.log("Расхождений нет.");
for (const r of report) console.log(`- [${r.kind}] ${r.text}: ${r.n}`);
await prisma.$disconnect();
// код 2 — остались дубли номеров, их скрипт не исправляет
process.exit(report.some((r) => r.kind === "duplicate") ? 2 : 0);
