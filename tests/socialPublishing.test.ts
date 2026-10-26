import { describe, expect, it } from "vitest";
import { publishPost, readPublicVideo } from "@/lib/social/publish";
import { createPkce, makeTikTokState, readTikTokState, tiktokAuthorizeUrl, tiktokChunkPlan } from "@/lib/social/tiktok";
import { normalizeMediaType, normalizePrivacy, normalizeTags, normalizeTargets, tagsFromText, titleFromText } from "@/lib/social/types";
import { youtubeMetadata } from "@/lib/social/youtube";

process.env.JWT_SECRET ||= "test-secret";

const MB = 1024 * 1024;

describe("публикация в соцсети: цели, приватность и метаданные", () => {
    it("цели по умолчанию зависят от типа медиа, явный список чистится от мусора и повторов", () => {
        expect(normalizeTargets(undefined, "image")).toEqual(["facebook", "instagram"]);
        expect(normalizeTargets([], "video")).toEqual(["youtube", "tiktok"]);
        expect(normalizeTargets("youtube, tiktok, youtube, myspace", "video")).toEqual(["youtube", "tiktok"]);
        expect(normalizeTargets(["Instagram", "facebook"], "image")).toEqual(["instagram", "facebook"]);
        expect(normalizeTargets("", "image")).toEqual(["facebook", "instagram"]);
    });

    it("тип медиа и приватность: неизвестное не открывает public", () => {
        expect(normalizeMediaType("video")).toBe("video");
        expect(normalizeMediaType(undefined)).toBe("image");
        expect(normalizePrivacy("public")).toBe("public");
        expect(normalizePrivacy("unlisted")).toBe("unlisted");
        expect(normalizePrivacy("PUBLIC")).toBe("private");
        expect(normalizePrivacy(undefined)).toBe("private");
    });

    it("YouTube: public только с явным подтверждением; private/unlisted — безопасный путь", () => {
        expect(() => youtubeMetadata({ privacyStatus: "public" })).toThrow(/explicit confirmation/i);
        expect(youtubeMetadata({ privacyStatus: "public", confirmPublic: true }).privacyStatus).toBe("public");
        const meta = youtubeMetadata({ title: "  ", description: "Erste Zeile\nZweite Zeile", privacyStatus: "unlisted" });
        expect(meta.title).toBe("Erste Zeile");
        expect(meta.privacyStatus).toBe("unlisted");
        expect(meta.description).toContain("Zweite Zeile");
    });

    it("заголовок берётся из первой строки, теги — из хештегов, лимит YouTube соблюдается", () => {
        expect(titleFromText("\n  Firmspace im Alltag  \nBody")).toBe("Firmspace im Alltag");
        expect(tagsFromText("Text #CRM #Buchhaltung, #CRM #хороший")).toEqual(["CRM", "Buchhaltung", "хороший"]);
        expect(normalizeTags("CRM, Buchhaltung, CRM, #Kundenbindung")).toEqual(["CRM", "Buchhaltung", "Kundenbindung"]);
        const long = normalizeTags(Array.from({ length: 30 }, (_, i) => `tag${i}${"x".repeat(30)}`).join(","), 100);
        expect(long.join(",").length).toBeLessThanOrEqual(100);
    });
});

describe("TikTok Content Posting API: раскладка файла и PKCE", () => {
    it("файл до 64 МБ уходит одним куском, больше — несколькими по правилам TikTok", () => {
        expect(tiktokChunkPlan(3 * MB)).toEqual({ chunkSize: 3 * MB, totalChunkCount: 1 });
        expect(tiktokChunkPlan(50 * MB)).toEqual({ chunkSize: 50 * MB, totalChunkCount: 1 });
        const mid = tiktokChunkPlan(65 * MB);
        expect(mid.totalChunkCount).toBe(2);
        expect(mid.chunkSize).toBeLessThanOrEqual(64 * MB);
        expect(mid.chunkSize * mid.totalChunkCount).toBeGreaterThanOrEqual(65 * MB);
        const large = tiktokChunkPlan(200 * MB);
        expect(large).toEqual({ chunkSize: 64 * MB, totalChunkCount: 3 });
        expect(() => tiktokChunkPlan(0)).toThrow();
        expect(() => tiktokChunkPlan(4 * 1024 * MB + 1)).toThrow(/4 GB/);
    });

    it("PKCE: verifier длинный, challenge — S256; verifier не попадает в URL authorize", () => {
        const { verifier, challenge } = createPkce();
        expect(verifier.length).toBeGreaterThanOrEqual(43);
        expect(challenge).not.toContain("=");
        const url = tiktokAuthorizeUrl({
            clientKey: "client-key",
            redirectUri: "https://firmspace.de/api/social/tiktok/callback",
            state: "state-token",
            codeChallenge: challenge,
            scopes: "user.info.basic video.upload video.publish",
        });
        const parsed = new URL(url);
        expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
        expect(parsed.searchParams.get("code_challenge")).toBe(challenge);
        expect(parsed.searchParams.get("scope")).toBe("user.info.basic,video.upload,video.publish");
        expect(parsed.searchParams.get("redirect_uri")).toBe("https://firmspace.de/api/social/tiktok/callback");
        expect(url).not.toContain(verifier);
    });

    it("state TikTok подписан и не принимает чужой/битый токен", () => {
        const state = makeTikTokState("user-1", "de");
        expect(readTikTokState(state)).toEqual({ sub: "user-1", l: "de" });
        expect(readTikTokState("not-a-jwt")).toBeNull();
    });
});

describe("publishPost: mock и защита путей", () => {
    it("mock возвращает фиктивные id и не требует токенов, файлов и базы", async () => {
        const result = await publishPost({
            text: "Test video",
            mediaType: "video",
            targets: ["youtube", "tiktok"],
            mock: true,
        });
        expect(result.mock).toBe(true);
        expect(result.youtubeVideoId).toMatch(/^mock-yt-/);
        expect(result.youtubeUrl).toContain("youtu.be");
        expect(result.tiktokPublishId).toMatch(/^mock-tt-/);
        expect(result.errors).toEqual({});
    });

    it("видео можно читать только из public/", async () => {
        await expect(readPublicVideo("../package.json")).rejects.toThrow(/inside public/i);
        await expect(readPublicVideo("")).rejects.toThrow(/No video/i);
        await expect(readPublicVideo("public/social/does-not-exist.mp4")).rejects.toThrow(/not found/i);
    });
});
