import { PrismaClient } from "@prisma/client";

// Один экземпляр PrismaClient на процесс (в dev Next перезагружает модули — держим в globalThis).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
