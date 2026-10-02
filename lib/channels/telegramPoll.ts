import { secretsOf } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { recordMessage } from "./index";
import { getUpdates, parseTelegramUpdate } from "./telegram";

// Режим без вебхука: забираем новые сообщения бота методом getUpdates. Вызывается, когда открыт Chat and Calls
// (он опрашивает /api/conversations). Номер последнего обработанного update хранится в config.updateOffset;
// повторно обработанное сообщение не создаёт дубля (recordMessage опознаёт его по id).
export async function pullTelegram(doc: any) {
    const config = (doc.config ?? {}) as Record<string, unknown>;
    const offset = Number(config.updateOffset) || 0;
    const updates = await getUpdates(secretsOf(doc).botToken, offset);
    for (const u of updates) {
        const message = parseTelegramUpdate(u);
        if (message) await recordMessage(doc, message);
    }
    if (updates.length) {
        // запись могла прийти и из Mongoose-времён: id берём у Prisma-записи либо приводим _id
        const id = String(doc.id ?? doc._id ?? "");
        if (id) await prisma.integration.update({ where: { id }, data: { config: { ...config, updateOffset: String(updates[updates.length - 1].update_id + 1) } as any } });
    }
}

export async function pullAllTelegram(owner: string) {
    const list = await prisma.integration.findMany({ where: { owner, type: "telegram", config: { path: ["polling"], equals: "1" } } });
    await Promise.all(list.map((d) => pullTelegram(d).catch(() => undefined))); // бот занят вебхуком или токен отозван — не мешаем остальным
}
