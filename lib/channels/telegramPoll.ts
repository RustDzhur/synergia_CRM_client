import type { HydratedDocument } from "mongoose";
import { secretsOf } from "@/lib/integrations";
import Integration from "@/models/Integration";
import { recordMessage } from "./index";
import { getUpdates, parseTelegramUpdate } from "./telegram";

type Doc = HydratedDocument<any>;

// Режим без вебхука: забираем новые сообщения бота методом getUpdates. Вызывается, когда открыт Chat and Calls
// (он опрашивает /api/conversations). Номер последнего обработанного update хранится в config.updateOffset;
// повторно обработанное сообщение не создаёт дубля (recordMessage опознаёт его по id).
export async function pullTelegram(doc: Doc) {
    const offset = Number(doc.config.updateOffset) || 0;
    const updates = await getUpdates(secretsOf(doc).botToken, offset);
    for (const u of updates) {
        const message = parseTelegramUpdate(u);
        if (message) await recordMessage(doc, message);
    }
    if (updates.length) {
        doc.set("config.updateOffset", String(updates[updates.length - 1].update_id + 1));
        doc.markModified("config");
        await doc.save();
    }
}

export async function pullAllTelegram(owner: string) {
    const list = await Integration.find({ owner, type: "telegram", "config.polling": "1" });
    await Promise.all(list.map((d) => pullTelegram(d).catch(() => undefined))); // бот занят вебхуком или токен отозван — не мешаем остальным
}
