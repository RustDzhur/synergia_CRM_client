import { describe, expect, it } from "vitest";
import { toInvoiceDTO } from "@/lib/finance/dto";

describe("toInvoiceDTO: журнал напоминаний", () => {
    it("даты в dunningLog — строки ISO (JSON из базы), а не Date: не падает", () => {
        const now = new Date();
        const inv: any = { id: "i1", org: "o", number: "RE-1", status: "sent", items: [], createdAt: now, updatedAt: now, sentAt: now, dunningLog: [{ level: 1, sentAt: "2026-10-01T10:00:00.000Z", fee: 5 }, { level: 2, sentAt: now, fee: 0 }, { level: 3 }] };
        const dto = toInvoiceDTO(inv);
        expect(dto.dunningLog.map((e: any) => typeof e.sentAt)).toEqual(["string", "string", "string"]);
        expect(dto.dunningLog[0].sentAt).toBe("2026-10-01T10:00:00.000Z");
        expect(dto.dunningLog[2].sentAt).toBe("");
    });
});
