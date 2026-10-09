import { describe, expect, it } from "vitest";
import { ALIASES, CATALOG, CATALOG_BY_KEY, GROUP_ORDER, cleanExtra, fieldOf, fieldsForCountry, initialsOf, mergeExtra, partyValues, tokensIn } from "@/lib/finance/contractFields";
import { CONTRACT_VAR_KEYS, fillContractText } from "@/lib/finance/contractText";
import { makeZip } from "@/lib/zip";
import { deflateRawSync } from "node:zlib";
import { docxToText } from "@/lib/docxText";
import { hasDb, makeOrg, prisma } from "./helpers/db";
import { contractVars } from "@/lib/finance/contractVars";

describe("каталог полей договора", () => {
    it("ключи уникальны (без учёта регистра), у каждого поля есть подписи на 4 языках", () => {
        const seen = new Set<string>();
        for (const f of CATALOG) {
            expect(seen.has(f.key.toLowerCase()), f.key).toBe(false);
            seen.add(f.key.toLowerCase());
            for (const l of ["en", "de", "ua", "uz"] as const) expect(f.label[l]?.length, `${f.key}/${l}`).toBeGreaterThan(1);
            expect(GROUP_ORDER).toContain(f.group);
        }
        expect(CATALOG.length).toBeGreaterThan(150);
    });
    it("прежние метки сохранённых шаблонов остаются в каталоге", () => {
        for (const k of [...CONTRACT_VAR_KEYS, "customerPerson", "customerPhone", "customerEmail", "today", "firmPhone", "firmEmail", "firmWebsite", "firmBank", "firmIban"]) expect(CATALOG_BY_KEY.has(k.toLowerCase()), k).toBe(true);
    });
    it("синонимы указывают на существующие поля: {{Name}}, {{passport}}, {{address}}", () => {
        for (const target of Object.values(ALIASES)) expect(CATALOG_BY_KEY.has(target.toLowerCase()), target).toBe(true);
        expect(fieldOf("Name")?.key).toBe("customer");
        expect(fieldOf("PASSPORT")?.key).toBe("customerPassportFull");
    });
    it("страны: узбекские коды видны только UZ, немецкие — только DE; общие — везде", () => {
        const uz = fieldsForCountry("UZ").map((f) => f.key);
        expect(uz).toContain("customerPinfl");
        expect(uz).not.toContain("customerSteuerId");
        expect(fieldsForCountry("DE").map((f) => f.key)).toContain("customerSteuerId");
        expect(fieldsForCountry("UA").map((f) => f.key)).toEqual(expect.arrayContaining(["customerRnokpp", "customerEdrpou", "customerMfo"]));
        expect(fieldsForCountry(null).length).toBe(CATALOG.length);
    });
});

describe("значения реквизитов", () => {
    it("ФИО, инициалы и паспорт собираются из частей; имя разбирается на фамилию и имя", () => {
        const v = partyValues({ name: "Каримов Рустам Бахтиёрович" }, { passportSeries: "AA", passportNumber: "1234567" });
        expect(v).toMatchObject({ lastName: "Каримов", firstName: "Рустам", middleName: "Бахтиёрович", passportFull: "AA 1234567", initials: "Каримов Р. Б." });
        expect(initialsOf("Müller", "Anna", "")).toBe("Müller A.");
    });
    it("введённое в карточку важнее колонок; общий код берётся из специальных кодов", () => {
        const v = partyValues({ firstName: "Иван", email: "a@b.c" }, { firstName: "Иоанн", pinfl: "12345678901234" });
        expect(v.firstName).toBe("Иоанн");
        expect(v.taxId).toBe("12345678901234");
    });
    it("extra: чистка и слияние; пустая строка удаляет ключ, мусорные ключи отбрасываются", () => {
        const patch = cleanExtra({ passportSeries: " AB ", pinfl: "", "bad key": "x", __proto__x: "y", n: 5 });
        expect(patch).toEqual({ passportSeries: "AB", pinfl: null, n: "5" });
        expect(mergeExtra({ pinfl: "1", city: "Ташкент" }, patch)).toEqual({ passportSeries: "AB", city: "Ташкент", n: "5" });
    });
});

describe("подстановка в текст", () => {
    it("синонимы работают, прямое имя важнее, неизвестная метка остаётся как есть", () => {
        const vars = { customer: "ООО Рога", customerPassportFull: "AA 1", customerAddress: "Киев" };
        expect(fillContractText("{{Name}}, {{passport}}, {{address}}, {{unknownThing}}", vars)).toBe("ООО Рога, AA 1, Киев, {{unknownThing}}");
        expect(tokensIn("{{a}} {{A}} {{ b }}")).toEqual(["a", "b"]);
    });
});

describe("импорт .docx", () => {
    it("текст абзацев, табуляции и сжатие deflate", () => {
        const xml = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>ДОГОВІР № {{number}}</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Клієнт: </w:t></w:r><w:r><w:t>{{customer}} &amp; Co</w:t></w:r></w:p><w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t></w:r></w:p></w:body></w:document>`;
        const stored = makeZip([{ name: "word/document.xml", data: xml }]);
        expect(docxToText(stored)).toBe("ДОГОВІР № {{number}}\nКлієнт: {{customer}} & Co\nA\tB");
        // тот же файл, но запись сжата deflate: подменяем метод и размеры вручную
        const raw = Buffer.from(xml, "utf8"), comp = deflateRawSync(raw);
        const name = Buffer.from("word/document.xml");
        const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
        const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28);
        const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(46 + name.length, 12); eocd.writeUInt32LE(30 + name.length + comp.length, 16);
        const zip = Buffer.concat([lh, name, comp, ch, name, eocd]);
        expect(docxToText(zip)).toContain("Клієнт: {{customer}} & Co");
        expect(() => docxToText(Buffer.from("not a zip file at all, definitely"))).toThrow();
    });
});

describe.skipIf(!hasDb)("подстановки договора из карточек", () => {
    it("клиент-человек и компания: паспорт, коды, адрес подставляются сами; ручной ввод в договоре важнее; фирма из настроек", async () => {
        const { org } = await makeOrg();
        const company = await prisma.company.create({ data: { owner: org, name: "ООО Ромашка", code: "12345678", address: "Ташкент, ул. Навои 1", extra: { stir: "305123456", mfo: "00014", accountNumber: "20208000" } } });
        const contact = await prisma.contact.create({ data: { owner: org, name: "Каримов Рустам", firstName: "Рустам", lastName: "Каримов", phone: "+998901112233", email: "r@k.uz", companyId: company.id, extra: { middleName: "Бахтиёрович", passportSeries: "AA", passportNumber: "1234567", pinfl: "31234567890123", birthDate: "1985-03-07" } } });
        await prisma.financeSettings.create({ data: { org, country: "UZ", legalName: "Firmspace LLC", address: "Ташкент, Амир Темур 5", taxId: "309876543", uaIban: "UZ00X", contractData: { representativePosition: "Директор", registerNumber: "REG-77" } as never } });
        const settings = await prisma.financeSettings.findUniqueOrThrow({ where: { org } });
        const c = { number: "HF-1", contact: contact.id, company: company.id, customerName: "ООО Ромашка", value: 1500, startDate: "2026-11-01", endDate: "", fields: { contractCity: "Ташкент", customerPassportSeries: "ZZ" } };
        const v = await contractVars(org, c, settings, { currency: "UZS" });
        expect(v).toMatchObject({
            number: "HF-1", customer: "ООО Ромашка", customerLastName: "Каримов", customerMiddleName: "Бахтиёрович", customerPassportNumber: "1234567", customerPinfl: "31234567890123",
            customerBirthDate: "07.03.1985", customerStir: "305123456", customerMfo: "00014", customerAccountNumber: "20208000", customerAddress: "Ташкент, ул. Навои 1",
            customerPhone: "+998901112233", customerTaxId: "12345678", customerInitials: "Каримов Р. Б.", firm: "Firmspace LLC", firmAddress: "Ташкент, Амир Темур 5",
            firmRepresentativePosition: "Директор", firmRegisterNumber: "REG-77", firmIban: "UZ00X", contractCity: "Ташкент", start: "01.11.2026",
        });
        expect(v.customerPassportSeries).toBe("ZZ"); // введено в форме договора — важнее карточки
        expect(v.customerPassportFull).toBe("AA 1234567");
        // чужая фирма данных не видит
        const other = await makeOrg();
        const v2 = await contractVars(other.org, { ...c, number: "X" }, settings, { currency: "UZS" });
        expect(v2.customerLastName).toBe("");
        expect(v2.customerStir).toBe("");
    });
});

import jwt from "jsonwebtoken";
import { asUser } from "./helpers/http";
import { PATCH as patchContact } from "@/app/api/contacts/[id]/route";
import { PATCH as patchCompany } from "@/app/api/companies/[id]/route";
import { PATCH as putSettings } from "@/app/api/finance/settings/route";
import { GET as clientData } from "@/app/api/contract-templates/client-data/route";
import { POST as importFile } from "@/app/api/contract-templates/import/route";

describe.skipIf(!hasDb)("реквизиты клиента и фирмы через API", () => {
    it("extra в карточках и contractData в настройках сливаются, пустое удаляет, чужая карточка недоступна; client-data отдаёт итог", async () => {
        const a = await makeOrg(), b = await makeOrg();
        const contact = await prisma.contact.create({ data: { owner: a.org, name: "Иван Петров", firstName: "Иван", lastName: "Петров" } });
        const company = await prisma.company.create({ data: { owner: a.org, name: "Acme" } });
        const call = asUser(a.userId);
        const json = (r: Response) => r.json();
        const p1 = await patchContact(call(`/api/contacts/${contact.id}`, "PATCH", { extra: { passportSeries: "KM", pinfl: "1" } }), { params: { id: contact.id } });
        expect((await json(p1)).extra).toEqual({ passportSeries: "KM", pinfl: "1" });
        const p2 = await patchContact(call(`/api/contacts/${contact.id}`, "PATCH", { extra: { pinfl: "", passportNumber: "777" } }), { params: { id: contact.id } });
        expect((await json(p2)).extra).toEqual({ passportSeries: "KM", passportNumber: "777" });
        const p3 = await patchCompany(call(`/api/companies/${company.id}`, "PATCH", { extra: { stir: "305" } }), { params: { id: company.id } });
        expect((await json(p3)).extra).toEqual({ stir: "305" });
        // чужая фирма: карточка не находится, ничего не меняется
        const foreign = await patchContact(asUser(b.userId)(`/api/contacts/${contact.id}`, "PATCH", { extra: { pinfl: "hack" } }), { params: { id: contact.id } });
        expect(foreign.status).toBe(404);
        const s1 = await putSettings(call("/api/finance/settings", "PATCH", { country: "UZ", legalName: "Firmspace", contractData: { representativePosition: "Директор" } }));
        expect((await json(s1)).contractData).toEqual({ representativePosition: "Директор" });
        const s2 = await putSettings(call("/api/finance/settings", "PATCH", { contractData: { representativeBasis: "Устав" } }));
        expect((await json(s2)).contractData).toEqual({ representativePosition: "Директор", representativeBasis: "Устав" });
        const cd = await json(await clientData(call(`/api/contract-templates/client-data?contact=${contact.id}&company=${company.id}&name=Acme`)));
        expect(cd.vars).toMatchObject({ customer: "Acme", customerPassportFull: "KM 777", customerStir: "305", firmRepresentativePosition: "Директор", firm: "Firmspace" });
        expect(cd.extra).toMatchObject({ passportSeries: "KM", stir: "305" });
        // чужая фирма видит пустые реквизиты
        const cdForeign = await json(await clientData(asUser(b.userId)(`/api/contract-templates/client-data?contact=${contact.id}&company=${company.id}`)));
        expect(cdForeign.vars.customerPassportFull).toBe("");
    });
    it("импорт файла: .txt принимается, неподдерживаемый формат отклоняется", async () => {
        const { userId } = await makeOrg();
        const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET as string);
        const mk = (name: string, content: string, type: string) => { const f = new FormData(); f.append("file", new File([content], name, { type })); return new Request("http://localhost/api/contract-templates/import", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: f }); };
        const ok = await importFile(mk("dogovor.txt", "ДОГОВІР {{customer}}", "text/plain"));
        expect((await ok.json()).text).toBe("ДОГОВІР {{customer}}");
        expect((await importFile(mk("x.pdf", "%PDF", "application/pdf"))).status).toBe(400);
    });
});
