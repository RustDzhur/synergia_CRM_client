import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { bankProvider } from "@/lib/banks/provider";

// Банк-партнёр (docs/TZ_MASTER.md §7): атрибуция, агрегаты для банка, лиды по согласию клиента.
// Правила: банк не получает данных фирм без согласия; эксклюзивности нет (другие банки доступны всегда); кабинет банка
// возвращает только числа и лиды, которые клиент сам выбрал передать (и пока согласие действует).

export class PartnerError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () => Array.from(randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");
/** Агрегаты по объёму показываются, только когда согласий не меньше порога: иначе по числам можно узнать конкретную фирму. */
export const MIN_VOLUME_GROUP = 3;

// ── платформа: банки и их сотрудники ──────────────────────────────────────────────────────────────────────

export async function createPartner(input: { name?: unknown; bankProvider?: unknown; memberEmail?: unknown }) {
    const name = text(input.name, 80);
    if (name.length < 2) throw new PartnerError("Enter the bank name");
    const provider = text(input.bankProvider, 30);
    if (provider && !bankProvider(provider)) throw new PartnerError("Unknown bank connector");
    const partner = await prisma.bankPartner.create({ data: { name, bankProvider: provider } });
    await prisma.bankPartnerCode.create({ data: { partner: partner.id, code: genCode(), label: "main" } });
    const email = text(input.memberEmail, 200).toLowerCase();
    if (email) await addMember(partner.id, email);
    return partner;
}

export async function addMember(partnerId: string, email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new PartnerError("There is no account with this e-mail — the bank employee must register first", 404);
    return prisma.bankPartnerMember.upsert({ where: { partner_user: { partner: partnerId, user: user.id } }, create: { partner: partnerId, user: user.id }, update: {} });
}

/** Банк, сотрудником которого является пользователь (иначе null — маршруты кабинета отвечают 404). */
export async function partnerOfUser(userId: string) {
    const m = await prisma.bankPartnerMember.findFirst({ where: { user: userId } });
    if (!m) return null;
    const p = await prisma.bankPartner.findUnique({ where: { id: m.partner } });
    return p && p.active ? p : null;
}

// ── публичная страница и атрибуция ────────────────────────────────────────────────────────────────────────

export async function landing(code: string) {
    const c = await prisma.bankPartnerCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!c || !c.active) return null;
    const p = await prisma.bankPartner.findUnique({ where: { id: c.partner } });
    if (!p || !p.active) return null;
    return { name: p.name, bankProvider: p.bankProvider, code: c.code };
}

export async function countVisit(code: string) {
    await prisma.bankPartnerCode.updateMany({ where: { code: code.toUpperCase(), active: true }, data: { visits: { increment: 1 } } });
}

/** Фирма пришла по коду. Повторный вызов не создаёт дубль и не отзывает согласие на объём, пока клиент сам не изменит. */
export async function attachReferral(org: string, codeIn: string, shareVolume: boolean) {
    const c = await prisma.bankPartnerCode.findUnique({ where: { code: codeIn.toUpperCase() } });
    if (!c || !c.active) throw new PartnerError("Unknown partner code", 404);
    const p = await prisma.bankPartner.findUnique({ where: { id: c.partner } });
    if (!p || !p.active) throw new PartnerError("Unknown partner code", 404);
    const ref = await prisma.partnerReferral.upsert({
        where: { partner_org: { partner: p.id, org } },
        create: { partner: p.id, code: c.code, org, shareVolume },
        update: {},
    });
    return { partner: { id: p.id, name: p.name, bankProvider: p.bankProvider }, referral: { id: ref.id, shareVolume: ref.shareVolume } };
}

export async function referralsOfOrg(org: string) {
    const refs = await prisma.partnerReferral.findMany({ where: { org } });
    const partners = await prisma.bankPartner.findMany({ where: { id: { in: refs.map((r) => r.partner) } } });
    return refs.map((r) => ({ id: r.id, shareVolume: r.shareVolume, partner: partners.find((p) => p.id === r.partner)?.name ?? "", partnerId: r.partner, bankProvider: partners.find((p) => p.id === r.partner)?.bankProvider ?? "" }));
}

export async function setShareVolume(org: string, referralId: string, value: boolean) {
    const r = await prisma.partnerReferral.updateMany({ where: { id: referralId, org }, data: { shareVolume: value } });
    if (!r.count) throw new PartnerError("Not found", 404);
}

// ── кабинет банка: только агрегаты и управление кодами ───────────────────────────────────────────────────

export async function stats(partnerId: string) {
    const [p, codes, refs] = await Promise.all([
        prisma.bankPartner.findUnique({ where: { id: partnerId } }),
        prisma.bankPartnerCode.findMany({ where: { partner: partnerId } }),
        prisma.partnerReferral.findMany({ where: { partner: partnerId }, select: { org: true, shareVolume: true } }),
    ]);
    const orgs = refs.map((r) => r.org);
    const [invoiceGroups, accounts] = await Promise.all([
        orgs.length ? prisma.invoice.groupBy({ by: ["org"], where: { org: { in: orgs } }, _count: { _all: true } }) : [],
        p?.bankProvider && orgs.length ? prisma.bankAccount.findMany({ where: { org: { in: orgs }, provider: p.bankProvider }, select: { id: true, org: true } }) : [],
    ]);
    const activated = invoiceGroups.length;
    const connectedOrgs = new Set(accounts.map((a) => a.org));
    // объём платежей через банк — только по фирмам, давшим на это согласие, и только когда их достаточно
    const sharing = new Set(refs.filter((r) => r.shareVolume).map((r) => r.org));
    const sharingAccounts = accounts.filter((a) => sharing.has(a.org));
    let volume: number | null = null;
    if (sharing.size >= MIN_VOLUME_GROUP) {
        const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
        const agg = sharingAccounts.length ? await prisma.bankTransaction.aggregate({ where: { account: { in: sharingAccounts.map((a) => a.id) }, date: { gte: since }, amount: { gt: 0 } }, _sum: { amount: true } }) : null;
        volume = Math.round((agg?._sum.amount ?? 0) * 100) / 100;
    }
    return {
        bank: p?.name ?? "",
        funnel: { visits: codes.reduce((s, c) => s + c.visits, 0), registered: refs.length, activated, connected: connectedOrgs.size },
        connectedAccounts: accounts.length,
        volumeLast30d: volume,
        volumeNote: volume === null ? `hidden until ${MIN_VOLUME_GROUP} firms have agreed to share it` : "",
        codes: codes.map((c) => ({ id: c.id, code: c.code, label: c.label, active: c.active, visits: c.visits })),
    };
}

export async function createCode(partnerId: string, label: unknown) {
    if ((await prisma.bankPartnerCode.count({ where: { partner: partnerId } })) >= 50) throw new PartnerError("Too many codes", 409);
    return prisma.bankPartnerCode.create({ data: { partner: partnerId, code: genCode(), label: text(label, 60) } });
}
export async function setCodeActive(partnerId: string, id: string, active: boolean) {
    const r = await prisma.bankPartnerCode.updateMany({ where: { id, partner: partnerId }, data: { active } });
    if (!r.count) throw new PartnerError("Not found", 404);
}

// ── лиды по согласию клиента ──────────────────────────────────────────────────────────────────────────────

export const LEAD_FIELDS = ["companyName", "contactName", "contactEmail", "country"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

export async function createLead(org: string, userId: string, partnerId: string, fieldsIn: unknown, daysIn: unknown) {
    const p = await prisma.bankPartner.findUnique({ where: { id: partnerId } });
    if (!p || !p.active) throw new PartnerError("Unknown bank", 404);
    const fields = Array.from(new Set((Array.isArray(fieldsIn) ? fieldsIn : []).filter((f): f is LeadField => (LEAD_FIELDS as readonly string[]).includes(String(f)))));
    if (!fields.length) throw new PartnerError("Choose what to share with the bank");
    const days = Math.min(90, Math.max(1, Math.round(Number(daysIn) || 30)));
    const [orgRow, user, fs] = await Promise.all([
        prisma.organization.findUnique({ where: { id: org }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { firstname: true, lastname: true, email: true } }),
        prisma.financeSettings.findUnique({ where: { org }, select: { country: true } }),
    ]);
    const all: Record<LeadField, string> = { companyName: orgRow?.name ?? "", contactName: `${user?.firstname ?? ""} ${user?.lastname ?? ""}`.trim(), contactEmail: user?.email ?? "", country: fs?.country ?? "" };
    const snapshot = Object.fromEntries(fields.map((f) => [f, all[f]]));
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const consent = await prisma.consentRecord.create({ data: { org, kind: "bank_lead", subjectType: "bank_partner", subjectId: partnerId, purpose: "bank offer", scope: { fields } as never, grantedBy: userId, expiresAt } });
    return prisma.bankLead.create({ data: { partner: partnerId, org, consent: consent.id, fields, snapshot: snapshot as never, expiresAt } });
}

export async function revokeLead(org: string, userId: string, leadId: string) {
    const lead = await prisma.bankLead.findFirst({ where: { id: leadId, org } });
    if (!lead) throw new PartnerError("Not found", 404);
    const now = new Date();
    await prisma.bankLead.update({ where: { id: lead.id }, data: { revokedAt: now, snapshot: {} as never } }); // данные банку больше не отдаются и стираются
    await prisma.consentRecord.updateMany({ where: { id: lead.consent, org }, data: { revokedAt: now, revokedBy: userId } });
}

export async function leadsOfOrg(org: string) {
    const rows = await prisma.bankLead.findMany({ where: { org }, orderBy: { createdAt: "desc" }, take: 50 });
    const partners = await prisma.bankPartner.findMany({ where: { id: { in: rows.map((r) => r.partner) } } });
    return rows.map((r) => ({ id: r.id, bank: partners.find((p) => p.id === r.partner)?.name ?? "", fields: r.fields, expiresAt: r.expiresAt, revokedAt: r.revokedAt }));
}

/** Лиды банка: только действующие (не отозваны, не истекли). Содержат лишь то, что клиент выбрал. */
export async function leadsForPartner(partnerId: string) {
    const rows = await prisma.bankLead.findMany({ where: { partner: partnerId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 200 });
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, expiresAt: r.expiresAt, data: r.snapshot }));
}

/** Сколько банков предлагается клиенту: список активных банков (без эксклюзивности — выбор всегда за клиентом). */
export async function activeBanks() {
    return (await prisma.bankPartner.findMany({ where: { active: true }, orderBy: { name: "asc" } })).map((p) => ({ id: p.id, name: p.name, bankProvider: p.bankProvider }));
}
