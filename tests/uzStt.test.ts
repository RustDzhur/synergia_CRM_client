import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "@/lib/ai/provider";

const ok = (text: string) => new Response(JSON.stringify({ text }), { status: 200, headers: { "content-type": "application/json" } });
const err = (status: number) => new Response(JSON.stringify({ error: { message: "boom" } }), { status, headers: { "content-type": "application/json" } });

describe("узбекское распознавание: устойчивость", () => {
    afterEach(() => { vi.unstubAllGlobals(); });
    it("временный отказ провайдера проходит со второго захода", async () => {
        process.env.OPENAI_API_KEY = "k";
        const f = vi.fn().mockResolvedValueOnce(err(503)).mockResolvedValueOnce(ok("Salom, Ayris"));
        vi.stubGlobal("fetch", f);
        expect(await transcribeAudio(Buffer.from("x"), "audio/webm", "uz")).toBe("Salom, Ayris");
        expect(f).toHaveBeenCalledTimes(2);
    });
    it("если лучшая модель отказала дважды, выручает whisper-1", async () => {
        process.env.OPENAI_API_KEY = "k";
        const models: string[] = [];
        vi.stubGlobal("fetch", vi.fn(async (_u: string, init: any) => {
            const m = String((init.body as FormData).get("model"));
            models.push(m);
            return m.startsWith("gpt-4o") ? err(500) : ok("hisob-fakturalarni ko‘rsat");
        }));
        expect(await transcribeAudio(Buffer.from("x"), "audio/webm", "uz")).toBe("hisob-fakturalarni ko‘rsat");
        expect(models).toEqual(["gpt-4o-transcribe", "gpt-4o-transcribe", "whisper-1"]);
    });
    it("неверный ключ не повторяется", async () => {
        process.env.OPENAI_API_KEY = "k";
        const f = vi.fn(async () => err(401));
        vi.stubGlobal("fetch", f);
        await expect(transcribeAudio(Buffer.from("x"), "audio/webm", "uz")).rejects.toThrow(/key/i);
        expect(f.mock.calls.length).toBe(2); // по одному заходу на каждую модель, без повтора
    });
});
