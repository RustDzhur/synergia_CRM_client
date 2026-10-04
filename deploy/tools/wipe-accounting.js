#!/usr/bin/env node
// Очистка бухгалтерии, склада и справочников ОДНОЙ фирмы — для тех, кто тестировал на «настоящих» счетах и хочет начать с чистого листа.
// Запускается ВРУЧНУЮ владельцем на сервере внутри контейнера сайта; по умолчанию только показывает, что будет удалено (ничего не меняет).
//
//   docker cp ~/crm-duplicate/deploy/tools/wipe-accounting.js firmspace-crm:/app/wipe-accounting.js     # именно в /app: там лежит @prisma/client
//   docker exec -w /app firmspace-crm node wipe-accounting.js <начало id фирмы>            # посмотреть, сколько записей
//   docker exec -w /app firmspace-crm node wipe-accounting.js <начало id фирмы> --yes      # удалить
//
// Удаляются (только у указанной фирмы): счета и кредит-ноты, регулярные счета, расходы, КП, заказы, договоры, закупки, счета поставщиков,
// складские документы и движения, производственные заказы и спецификации, импортированные банковские операции, основные средства,
// пакеты импорта, товары и поставщики. Счётчики нумерации сбрасываются (нумерация начнётся с 1, без «дыр»).
// НЕ затрагиваются: аккаунты, настройки фирмы, склады (сами помещения), контакты, сделки, задачи, почта, чаты, интеграции, ключи, переменные
// окружения, журнал действий и другие фирмы. Перед удалением сделайте копию базы: /opt/infrastructure/backup/postgres/backup.sh
const { PrismaClient } = require("@prisma/client");
const prefix = process.argv[2];
const yes = process.argv.includes("--yes");
if (!prefix || prefix.startsWith("--") || prefix.length < 6) { console.error("Укажите начало id фирмы (не короче 6 знаков)."); process.exit(1); }
const p = new PrismaClient();
const MODELS = ["stockMovement", "stockDoc", "supplierInvoice", "purchaseOrder", "productionOrder", "bom", "invoice", "recurringInvoice", "expense", "quote", "order", "contract", "bankTransaction", "asset", "importBatch", "product", "supplier"];
(async () => {
    const orgs = await p.organization.findMany({ where: { id: { startsWith: prefix } }, select: { id: true, name: true } });
    if (orgs.length !== 1) { console.error(orgs.length ? "Под префикс подходит несколько фирм: " + orgs.map((o) => o.name).join(", ") : "Фирма не найдена"); process.exit(1); }
    const { id: org, name } = orgs[0];
    console.log(`Фирма: ${name} (${org})`);
    const counts = {};
    for (const m of MODELS) counts[m] = await p[m].count({ where: { org } });
    console.log("Записей сейчас:", JSON.stringify(counts));
    if (!yes) { console.log("\nЭто просмотр. Чтобы удалить, добавьте --yes (сначала сделайте копию базы)."); return; }
    const out = await p.$transaction(async (tx) => {
        const res = {};
        for (const m of MODELS) res[m] = (await tx[m].deleteMany({ where: { org } })).count;
        await tx.financeSettings.update({ where: { org }, data: { counters: {} } });
        return res;
    }, { timeout: 60000 });
    console.log("Удалено:", JSON.stringify(out));
    console.log("Нумерация сброшена. Остальные данные фирмы не тронуты.");
})().catch((e) => { console.error("Ошибка:", e.message); process.exit(1); }).finally(() => p.$disconnect());
