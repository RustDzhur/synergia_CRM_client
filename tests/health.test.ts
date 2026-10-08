import { describe, expect, it } from "vitest";
import { hasDb, prisma } from "./helpers/db";
import { missingTables } from "@/lib/schemaCheck";
import { GET as health } from "@/app/api/health/route";

describe.skipIf(!hasDb)("проверка схемы", () => {
    it("на накатанной базе недостающих таблиц нет; пропажа таблицы видна в списке и в /api/health", async () => {
        expect(await missingTables()).toEqual([]);
        await prisma.$executeRawUnsafe('ALTER TABLE "platform_agents" RENAME TO "platform_agents_x"');
        try {
            expect(await missingTables()).toEqual(["platform_agents"]);
            const body = await (await health()).json();
            expect(body.schema).toEqual(["platform_agents"]);
        } finally {
            await prisma.$executeRawUnsafe('ALTER TABLE "platform_agents_x" RENAME TO "platform_agents"');
        }
    });
});
