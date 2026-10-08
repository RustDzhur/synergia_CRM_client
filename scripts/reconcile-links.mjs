// Согласование связей между сущностями. Связи в базе — строки без внешних ключей, и со временем появляются:
//  • повторяющиеся номера документов (мешают уникальному индексу новой схемы);
//  • осиротевшие ссылки (счёт ссылается на удалённую сделку, задача — на удалённого контакта и т.п.);
//  • устаревшие копии имени клиента в сделках и черновиках документов;
//  • задачи сделки без контакта и фирмы сделки (нужны карточке клиента).
// Запуск (нужен DATABASE_URL):
//   node scripts/reconcile-links.mjs            — только отчёт, ничего не меняет
//   node scripts/reconcile-links.mjs --apply    — исправить то, что исправляется безопасно:
//        обнулить осиротевшие ссылки, подтянуть имена в сделках и черновиках, заполнить контакт/фирму у задач сделок.
// ЗАПУСКАТЬ ДО `prisma db push`: первой выполняется проверка дублей номеров (чистый SQL, работает на любой схеме).
// Остальные проверки используют новые колонки; если их в базе ещё нет, шаг пропускается и это написано в отчёте —
// после накатки схемы запустите скрипт ещё раз.
// Код выхода: 0 — всё чисто; 2 — есть дубли номеров (db push на них остановится, разберите их с бухгалтером).
// Дубли номеров выпущенных документов скрипт только показывает: перенумерация запрещена законом.
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();
const report = [];
const skipped = [];
const note = (kind, text, n) => { if (n) report.push({ kind, text, n }); };
const safe = async (name, fn) => {
    try { await fn(); } catch (e) {
        if (e?.code === "P2021" || e?.code === "P2022") skipped.push(name);
        else throw e;
    }
};

// 1. Дубли номеров — всегда, до всего остального
for (const [model, table] of [["invoice", "invoices"], ["quote", "quotes"], ["order", "orders"], ["contract", "contracts"]]) {
    const dup = await prisma.$queryRawUnsafe(`SELECT "org", "number", COUNT(*)::int AS n FROM "${table}" GROUP BY "org", "number" HAVING COUNT(*) > 1`);
    note("duplicate", `${model}: повторяющийся номер (исправить вручную, перенумерация выпущенных документов запрещена): ${dup.slice(0, 5).map((d) => d.number).join(", ")}`, dup.length);
}

await safe("осиротевшие ссылки", async () => {
    const idsOf = async (model) => new Set((await prisma[model].findMany({ select: { id: true } })).map((r) => r.id));
    const [deals, contacts, companies, orders, contracts, projects] = await Promise.all([idsOf("deal"), idsOf("contact"), idsOf("company"), idsOf("order"), idsOf("contract"), idsOf("project")]);
    const LINKS = [
        ["invoice", "deal", deals], ["invoice", "contact", contacts], ["invoice", "company", companies], ["invoice", "order", orders], ["invoice", "contract", contracts],
        ["quote", "deal", deals], ["quote", "contact", contacts], ["quote", "company", companies],
        ["order", "deal", deals], ["order", "contact", contacts], ["order", "company", companies],
        ["contract", "deal", deals], ["contract", "contact", contacts], ["contract", "company", companies],
        ["expense", "deal", deals], ["expense", "order", orders],
        ["task", "deal", deals], ["task", "contact", contacts], ["task", "company", companies], ["task", "project", projects],
        ["deal", "contact", contacts], ["deal", "company", companies],
        ["conversation", "contact", contacts],
    ];
    for (const [model, field, exist] of LINKS) {
        await safe(`${model}.${field}`, async () => {
            const rows = await prisma[model].findMany({ where: { [field]: { not: null } }, select: { id: true, [field]: true } });
            const orphans = rows.filter((r) => r[field] && !exist.has(r[field]));
            note("orphan", `${model}.${field} ссылается на несуществующую запись`, orphans.length);
            if (apply && orphans.length) await prisma[model].updateMany({ where: { id: { in: orphans.map((r) => r.id) } }, data: { [field]: null } });
        });
    }
});

await safe("копии имён в сделках", async () => {
    for (const [field, relation, model] of [["contactName", "contact", "contact"], ["companyName", "company", "company"]]) {
        const rows = await prisma.deal.findMany({ where: { [relation]: { not: null } }, select: { id: true, [field]: true, [relation]: true } });
        let stale = 0;
        for (const r of rows) {
            const doc = await prisma[model].findUnique({ where: { id: r[relation] }, select: { name: true } });
            if (doc && r[field] !== doc.name) { stale++; if (apply) await prisma.deal.update({ where: { id: r.id }, data: { [field]: doc.name } }); }
        }
        note("stale", `deal.${field} расходится с именем клиента`, stale);
    }
});

await safe("имена в черновиках документов", async () => {
    for (const [model, drafts] of [["invoice", ["draft"]], ["quote", ["draft"]], ["order", ["draft", "confirmed"]], ["contract", ["draft"]]]) {
        const rows = await prisma[model].findMany({ where: { contact: { not: null }, status: { in: drafts } }, select: { id: true, contact: true, customerName: true } });
        let stale = 0;
        for (const r of rows) {
            const c = await prisma.contact.findUnique({ where: { id: r.contact }, select: { name: true } });
            if (c && c.name !== r.customerName) { stale++; if (apply) await prisma[model].update({ where: { id: r.id }, data: { customerName: c.name } }); }
        }
        note("stale", `${model} (черновик): customerName расходится с контактом`, stale);
    }
});

await safe("контакт и фирма у задач сделок", async () => {
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
});

console.log(apply ? "Режим: ИСПРАВЛЕНИЕ" : "Режим: только отчёт (добавьте --apply для исправления)");
if (!report.length) console.log("Расхождений нет.");
for (const r of report) console.log(`- [${r.kind}] ${r.text}: ${r.n}`);
if (skipped.length) console.log(`Пропущено (в базе ещё нет новых колонок — накатите схему и запустите скрипт снова): ${skipped.join(", ")}`);
await prisma.$disconnect();
process.exit(report.some((r) => r.kind === "duplicate") ? 2 : 0);
