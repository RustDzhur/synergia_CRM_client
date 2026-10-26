import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { channelContactFallbackName, channelContactName, ensureChannelContact, isChannelContactChannel } from "@/lib/channels/contact";

// Контакт собеседника внешнего канала: имя из провайдера (или понятная заглушка), стабильный ключ
// канал + externalId и одна карточка на человека, сколько бы сообщений он ни прислал.
describe("контакты из внешних каналов", () => {
    it("каналы собеседников опознаются, телефонные — нет", () => {
        for (const channel of ["instagram", "messenger", "telegram", "viber", "webchat"]) expect(isChannelContactChannel(channel)).toBe(true);
        for (const channel of ["twilio", "sip", "whatsapp", "mail"]) expect(isChannelContactChannel(channel)).toBe(false);
    });

    it("настоящее имя сохраняется, заглушка провайдера заменяется", () => {
        expect(channelContactName("instagram", "17841400000000001", "anna.weber")).toBe("anna.weber");
        expect(channelContactName("viber", "abc123", "Viber")).toBe("Viber c123");
        expect(channelContactFallbackName("telegram", "1238839657")).toBe("Telegram 9657");
        expect(channelContactName("webchat", "visitor-abcdef", "")).toBe("Web chat cdef");
    });

    describe.skipIf(!hasDb)("карточка в базе", () => {
        it("создаётся один раз по ключу канала и обновляет имя-заглушку", async () => {
            const { org } = await makeOrg();
            const integration = { id: "test-channel-contact", owner: org, type: "webchat" };
            const externalId = `visitor-${Date.now().toString(36)}`;

            const first = await ensureChannelContact(integration, externalId);
            expect(first?.name).toBe(channelContactFallbackName("webchat", externalId));

            const stored = await prisma.contact.findFirstOrThrow({ where: { id: first!.id } });
            expect(stored.channel).toBe("webchat");
            expect(stored.externalId).toBe(externalId);
            expect(stored.source).toBe(`webchat:${externalId}`);
            expect(stored.firstContactAt).toBeInstanceOf(Date);

            const updated = await ensureChannelContact(integration, externalId, { name: "Anna Weber", avatar: "https://example.com/a.jpg" });
            expect(updated?.id).toBe(first?.id);
            expect(updated?.name).toBe("Anna Weber");
            expect(await prisma.contact.count({ where: { owner: org, channel: "webchat", externalId } })).toBe(1);
            const after = await prisma.contact.findUniqueOrThrow({ where: { id: first!.id } });
            expect(after.firstName).toBe("Anna");
            expect(after.lastName).toBe("Weber");
            expect(after.avatar).toBe("https://example.com/a.jpg");
        });
    });
});
