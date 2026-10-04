import { PrismaClient } from "@prisma/client";

// Один экземпляр PrismaClient на процесс (в dev Next перезагружает модули — держим в globalThis).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaWatch?: boolean };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Сторож базы данных: сообщает владельцу о сбоях запросов (lib/errorHub.ts), но только о тех, что говорят о проблеме, а не о штатной
// ситуации. Дубликаты (P2002), «не найдено» (P2025) и связи (P2003) код обрабатывает сам — их не трогаем, иначе чат утонул бы в шуме.
// Сообщаем о недоступности базы и подключениях (P1001/P1002/P1008/P1017/P2024), взаимных блокировках (P2034), неверных запросах
// (PrismaClientValidationError — это ошибка в коде), неизвестных и фатальных сбоях.
const REPORT_CODES = new Set(["P1000", "P1001", "P1002", "P1003", "P1008", "P1011", "P1017", "P2024", "P2028", "P2034", "P2021", "P2022"]);

if (!globalForPrisma.prismaWatch && typeof prisma.$use === "function") {
    globalForPrisma.prismaWatch = true;
    prisma.$use(async (params, next) => {
        try {
            return await next(params);
        } catch (e) {
            try {
                const err = e as { name?: string; code?: string; message?: string; stack?: string };
                const worth = (err.code && REPORT_CODES.has(err.code)) || /PrismaClientValidationError|PrismaClientUnknownRequestError|PrismaClientInitializationError|PrismaClientRustPanicError/.test(err.name ?? "");
                if (worth) {
                    void import("@/lib/errorHub").then(({ ingest }) =>
                        ingest({ source: "database", kind: "запрос к базе", message: `${err.name ?? "Error"}${err.code ? ` ${err.code}` : ""}: ${(err.message ?? "").split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 400)}`, stack: err.stack, where: `${params.model ?? "raw"}.${params.action}` })
                    ).catch(() => undefined);
                }
            } catch { /* сторож не должен ломать сам запрос */ }
            throw e;
        }
    });
}
