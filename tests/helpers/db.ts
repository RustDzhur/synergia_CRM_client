import { prisma } from "@/lib/prisma";

// Интеграционные тесты идут на настоящей PostgreSQL (DATABASE_URL). Без неё они пропускаются:
// чисто логические тесты (права, арифметика) работают и так. В CI база поднимается сервисом postgres.
export const hasDb = !!process.env.DATABASE_URL;

let seq = 0;
// Фирма-арендатор для теста: личная фирма создаётся вместе с пользователем (id фирмы == id пользователя)
export async function makeOrg(role: "owner" | "manager" | "employee" | "viewer" = "owner") {
    const id = `t${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id, email: `${id}@test.local`, firstname: "Test", lastname: id, passwordHash: "x" } });
    await prisma.organization.create({ data: { id, name: `Org ${id}`, ownerUser: id } });
    await prisma.membership.create({ data: { org: id, user: id, role } });
    return { org: id, userId: user.id };
}

export { prisma };
