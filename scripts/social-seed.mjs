// Одноразовая (идемпотентная) настройка публикации в соцсети: читает токен страницы из stdin и кладёт
// его зашифрованным в platformsettings/social вместе с id страницы и аккаунта Instagram.
// Токен в код и в git не попадает: он приходит по stdin (см. отчёт агента). Запускать в контейнере:
//   cat page-token.txt | docker exec -i firmspace-crm node /tmp/social-seed.mjs
import { PrismaClient } from "@prisma/client";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const token = readFileSync(0, "utf8").trim();
if (!token) {
    console.error("no token on stdin");
    process.exit(1);
}
const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
if (!secret) {
    console.error("ENCRYPTION_KEY / JWT_SECRET is not set");
    process.exit(1);
}
// формат совпадает с lib/crypto.ts: AES-256-GCM, iv 12 байт, ключ = sha256(secret)
const key = createHash("sha256").update(secret).digest();
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const data = Buffer.concat([cipher.update(JSON.stringify({ pageToken: token }), "utf8"), cipher.final()]);
const secrets = [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
const value = JSON.stringify({ pageId: "1334056129793648", igUserId: "17841462923280272" });

const prisma = new PrismaClient();
await prisma.platformSettings.upsert({
    where: { key: "social" },
    create: { key: "social", value, secrets },
    update: { value, secrets },
});
await prisma.$disconnect();
console.log("social settings saved: pageId/igUserId + encrypted pageToken");
