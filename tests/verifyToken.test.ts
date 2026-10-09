import { describe, expect, it } from "vitest";
import { derivedVerifyToken, safeEqual } from "@/lib/crypto";
import { verifyTokenOf } from "@/lib/integrations";

describe("verify-токен вебхука Meta", () => {
    it("safeEqual не падает на пустом значении и не пускает пустой токен", () => {
        expect(safeEqual("a", undefined)).toBe(false);
        expect(safeEqual("", "")).toBe(false);
        expect(safeEqual("abc", "abc")).toBe(true);
        expect(safeEqual(undefined, "abc")).toBe(false);
    });
    it("без сохранённого токена берётся постоянный производный, сохранённый имеет приоритет", () => {
        process.env.JWT_SECRET ||= "t";
        const doc = { token: "marker1", config: {} };
        expect(verifyTokenOf(doc)).toBe(derivedVerifyToken("marker1"));
        expect(verifyTokenOf(doc)).toBe(verifyTokenOf(doc));
        expect(verifyTokenOf({ token: "marker1", config: { verifyToken: "mine" } })).toBe("mine");
        expect(derivedVerifyToken("marker1")).not.toBe(derivedVerifyToken("marker2"));
    });
});
