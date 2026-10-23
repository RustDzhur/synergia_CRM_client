#!/usr/bin/env node
// Создаёт интеграции «landing» для публичного приёма заявок с лендингов (POST /api/webhooks/landing/<token>):
// config.site = "copilot" (burokratie-landing-page) и "automatisation" (automatisation-landing-page).
// Идемпотентно: если интеграция с теми же owner + type + site уже есть — токен не меняется, печатается
// существующий. Запуск:
//   node scripts/seed-landing-tokens.mjs --owner=<orgId>                    # обе интеграции
//   node scripts/seed-landing-tokens.mjs --owner=<orgId> --site=copilot     # только burokratie
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const SITES = [
    { site: "copilot", name: "Burokratie landing" },
    { site: "automatisation", name: "Automatisation landing" },
];

const arg = (name) => {
    const prefix = `--${name}=`;
    const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : "";
};

const owner = arg("owner") || process.env.OWNER || "";
const siteArg = arg("site");
if (!owner) {
    console.error("Укажите --owner=<orgId> (id фирмы в CRM)");
    process.exit(1);
}
const wanted = siteArg ? SITES.filter((s) => s.site === siteArg) : SITES;
if (!wanted.length) {
    console.error(`Неизвестный сайт "${siteArg}" — нужно copilot или automatisation`);
    process.exit(1);
}

const prisma = new PrismaClient();
const tokens = {};
try {
    const all = await prisma.integration.findMany({ where: { owner, type: "landing" } });
    for (const { site, name } of wanted) {
        const found = all.find((i) => (i.config ?? {}).site === site);
        if (found) {
            tokens[site] = String(found.token);
            continue;
        }
        const token = randomBytes(32).toString("hex");
        await prisma.integration.create({
            data: { owner, type: "landing", name, token, config: { site }, status: "connected" },
        });
        tokens[site] = token;
    }
    console.log(JSON.stringify(tokens));
} finally {
    await prisma.$disconnect();
}
