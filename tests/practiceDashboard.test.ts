import { describe, expect, it } from "vitest";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { asUser, ctx } from "./helpers/http";
import { POST as createPractice } from "@/app/api/practice/route";
import { POST as invite } from "@/app/api/practice/[id]/invites/route";
import { POST as acceptInvite } from "@/app/api/practice/accept/route";
import { GET as dashboard } from "@/app/api/practice/[id]/dashboard/route";
import { GET as accessLog } from "@/app/api/practice/access-log/route";
import { upcomingDeadlines } from "@/lib/practice/deadlines";

async function newUser(tag: string) {
    const o = await makeOrg();
    await prisma.user.update({ where: { id: o.userId }, data: { email: `${tag}${o.userId}@t.local`, firstname: tag, lastname: "T" } });
    return o;
}

describe("сроки отчётности", () => {
    it("ближайший срок — в этом месяце, если не прошёл, иначе в следующем; UZ помечен непроверенным", () => {
        const a = upcomingDeadlines("DE", new Date("2026-03-05T10:00:00Z"));
        expect(a[0].date).toBe("2026-03-10");
        expect(a[0].daysLeft).toBe(5);
        expect(upcomingDeadlines("DE", new Date("2026-03-11T10:00:00Z"))[0].date).toBe("2026-04-10");
        expect(upcomingDeadlines("UZ")[0].verified).toBe(false);
        expect(upcomingDeadlines(null)).toEqual([]);
    });
});

describe.skipIf(!hasDb)("панель «Мои клиенты»", () => {
    it("показывает агрегаты по действующей связи, пишет в журнал клиента, чужой практике и завершённой связи не отдаёт", async () => {
        const client = await newUser("client"), acc = await newUser("acc"), stranger = await newUser("stranger");
        const reqA = asUser(acc.userId);
        const p = await (await createPractice(reqA("/api/practice", "POST", { name: "Buh", kind: "accountant", market: "UZ", acceptTerms: true }))).json();
        const inv = await (await invite(reqA(`/api/practice/${p.id}/invites`, "POST", { access: "review", modules: ["inventory"], expiresInDays: 30 }), ctx(p.id))).json();
        expect((await acceptInvite(asUser(client.userId)("/api/practice/accept", "POST", { token: inv.token }))).status).toBeLessThan(300);
        await prisma.financeSettings.create({ data: { org: client.org, country: "DE" } });
        await prisma.bankTransaction.create({ data: { org: client.org, account: "a", date: "2026-03-01", amount: 5 } });
        await prisma.invoice.create({ data: { org: client.org, number: "D-1", customerName: "X", issueDate: "2020-01-01", dueDate: "2020-02-01", status: "sent" } });
        await prisma.clientRequest.create({ data: { org: client.org, link: "l", subject: "s", createdBy: acc.userId } });

        const res = await dashboard(reqA(`/api/practice/${p.id}/dashboard`), ctx(p.id));
        expect(res.status).toBe(200);
        const { clients } = await res.json();
        expect(clients).toHaveLength(1);
        expect(clients[0]).toMatchObject({ org: client.org, market: "DE", unmatchedBank: 1, overdueInvoices: 1, openRequests: 1, access: "review" });
        expect(clients[0].deadlines[0].code).toBe("vat_return");
        // клиент видит в журнале, что панель смотрели
        const log = await (await accessLog(asUser(client.userId)("/api/practice/access-log"))).json();
        expect(JSON.stringify(log)).toContain("dashboard");
        // посторонний — 404
        expect((await dashboard(asUser(stranger.userId)(`/api/practice/${p.id}/dashboard`), ctx(p.id))).status).toBe(404);
        // связь завершена — клиент пропадает из панели
        await prisma.clientLink.updateMany({ where: { practice: p.id }, data: { status: "ended" } });
        expect((await (await dashboard(reqA(`/api/practice/${p.id}/dashboard`), ctx(p.id))).json()).clients).toHaveLength(0);
    });
});

import { makeZip, crc32 } from "@/lib/zip";
import { GET as handoff } from "@/app/api/finance/handoff/route";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("пакет бухгалтеру", () => {
    it("ZIP корректен: crc32 известного значения и распаковка системным unzip", () => {
        expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
        const dir = mkdtempSync(join(tmpdir(), "zip-"));
        const f = join(dir, "a.zip");
        writeFileSync(f, makeZip([{ name: "a.csv", data: "x;y\r\n" }, { name: "б.txt", data: "привет" }]));
        try {
            const out = execFileSync("python3", ["-I", "-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(z.read('a.csv').decode())", f]).toString();
            expect(out).toContain("None");
            expect(out).toContain("x;y");
        } catch (e) { if ((e as { code?: string }).code !== "ENOENT") throw e; }
    });
    it.skipIf(!hasDb)("маршрут отдаёт архив только за период и только данные своей фирмы", async () => {
        const a = await makeOrg(), b = await makeOrg();
        await prisma.invoice.create({ data: { org: a.org, number: "H-1", customerName: "Mine", issueDate: "2026-03-10", status: "sent" } });
        await prisma.invoice.create({ data: { org: b.org, number: "H-2", customerName: "Other", issueDate: "2026-03-10", status: "sent" } });
        await prisma.financeSettings.create({ data: { org: a.org, country: "DE" } });
        const res = await handoff(asUser(a.userId)("/api/finance/handoff?from=2026-03-01&to=2026-03-31"));
        expect(res.status).toBe(200);
        const buf = Buffer.from(await res.arrayBuffer());
        expect(buf.includes("H-1")).toBe(true);
        expect(buf.includes("H-2")).toBe(false);
        expect(buf.includes("EXTF_Buchungsstapel_2026.csv")).toBe(true); // DATEV для DE
        expect(buf.includes("documents/H-1.pdf")).toBe(true); // печатная форма счёта
        expect((await handoff(asUser(a.userId)("/api/finance/handoff?from=x&to=y"))).status).toBe(400);
    });
});
