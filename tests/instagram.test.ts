import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { parseInstagramBody } from "@/lib/channels/instagram";
import { verifyMetaSignature } from "@/lib/channels/messenger";
import { webhookPath } from "@/lib/integrations";

// Instagram Direct принимает события той же формы, что Messenger, но object=instagram и собеседник — IGSID.
// Проверяем разбор, отсев эха и подпись: без этого вебхук либо теряет сообщения, либо записывает наши же ответы.
describe("Instagram Direct", () => {
    it("адрес вебхука собирается по типу интеграции", () => {
        expect(webhookPath("instagram", "abc123")).toBe("/api/webhooks/instagram/abc123");
    });

    it("входящее сообщение: собеседник, текст и id сообщения", () => {
        const events = parseInstagramBody({
            object: "instagram",
            entry: [
                {
                    messaging: [
                        { sender: { id: "17841400000000001" }, recipient: { id: "17841462923280272" }, message: { mid: "m_1", text: "Hello" } },
                    ],
                },
            ],
        });
        expect(events).toEqual([{ externalId: "17841400000000001", text: "Hello", direction: "in", messageId: "m_1" }]);
    });

    it("чужой объект, эхо и вложения без текста", () => {
        expect(parseInstagramBody({ object: "page", entry: [{ messaging: [{ sender: { id: "1" }, message: { mid: "m" } }] }] })).toEqual([]);
        const body = {
            object: "instagram",
            entry: [
                {
                    messaging: [
                        { sender: { id: "1" }, message: { mid: "echo", text: "our reply", is_echo: true } },
                        { sender: { id: "2" }, message: { mid: "photo", attachments: [{ type: "image" }] } },
                    ],
                },
            ],
        };
        expect(parseInstagramBody(body)).toEqual([{ externalId: "2", text: "[image]", direction: "in", messageId: "photo" }]);
    });

    it("подпись Meta проверяется секретом приложения", () => {
        const raw = JSON.stringify({ object: "instagram" });
        const secret = "test-app-secret";
        const header = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
        expect(verifyMetaSignature(raw, header, secret)).toBe(true);
        expect(verifyMetaSignature(raw, header, "other-secret")).toBe(false);
        expect(verifyMetaSignature(raw, null, secret)).toBe(false);
    });
});
