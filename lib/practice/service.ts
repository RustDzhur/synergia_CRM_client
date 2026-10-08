import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { assertCanAddClient } from "./terms";
import { PRACTICE_GRANTABLE, type Module } from "@/lib/access";
import { registeredMarkets } from "@/lib/finance/market";

// Практика: бухгалтер или юрист ведёт нескольких клиентов. Ключевое правило — доступ специалиста существует только через
// действующую связь (ClientLink) и согласие клиента (ConsentRecord): отзыв закрывает доступ немедленно (docs/TZ_MASTER.md §5).
// Все функции получают уже проверенного вызывающего (userId) и сами проверяют его право на действие.

export class PracticeError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

/** Версия текста договора обработки данных и обязательства о сохранении тайны. Тексты готовит юрист; платформа хранит версию и время акцепта. */
export const PRACTICE_TERMS_VERSION = "2026-10-draft";

export const PRACTICE_KINDS = ["accountant", "lawyer"] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];
export const MEMBER_ROLES = ["partner", "senior", "junior", "assistant"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const ACCESS_LEVELS = ["read", "review", "edit"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];
export const AI_MODES = ["none", "own", "platform"] as const;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без похожих символов
const genCode = () => Array.from(randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
const genToken = () => randomBytes(24).toString("base64url");
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const roleFor = (kind: string) => (kind === "lawyer" ? "counsel" : "advisor");

export function cleanModules(v: unknown): Module[] {
    const list = Array.isArray(v) ? v : [];
    const out = Array.from(new Set(list.filter((m): m is Module => typeof m === "string" && (PRACTICE_GRANTABLE as string[]).includes(m))));
    return out.length ? out : ["inventory"];
}
const cleanAccess = (v: unknown): AccessLevel => ((ACCESS_LEVELS as readonly string[]).includes(String(v)) ? (v as AccessLevel) : "read");
const cleanDays = (v: unknown) => Math.min(730, Math.max(1, Math.round(Number(v) || 365)));

// ── кто есть кто ───────────────────────────────────────────────────────────────────────────────────────────

export async function memberOf(practice: string, userId: string) {
    return prisma.practiceMember.findFirst({ where: { practice, user: userId } });
}
async function requirePartner(practice: string, userId: string) {
    const m = await memberOf(practice, userId);
    if (!m) throw new PracticeError("Practice not found", 404); // чужая практика «не существует»
    if (m.role !== "partner") throw new PracticeError("Only a partner can do this", 403);
    return m;
}
/** Владелец или администратор фирмы — только они решают, кого пускать к данным фирмы. */
const requireOrgAdmin = (role: string) => { if (role !== "owner" && role !== "admin") throw new PracticeError("Only the owner or an administrator can do this", 403); };

// ── практика и её сотрудники ───────────────────────────────────────────────────────────────────────────────

export async function createPractice(userId: string, input: { name?: unknown; kind?: unknown; market?: unknown; acceptTerms?: unknown }) {
    const name = text(input.name, 120);
    if (name.length < 2) throw new PracticeError("Enter the practice name");
    const kind = (PRACTICE_KINDS as readonly string[]).includes(String(input.kind)) ? (input.kind as PracticeKind) : "accountant";
    const market = typeof input.market === "string" && registeredMarkets().includes(input.market.toUpperCase()) ? input.market.toUpperCase() : "";
    // без акцепта договора обработки данных и обязательства о тайне практику не регистрируем (условие запуска для DE)
    if (input.acceptTerms !== true) throw new PracticeError("The data processing agreement and the confidentiality commitment must be accepted");
    const practice = await prisma.practice.create({ data: { name, kind, market, code: genCode(), ownerUser: userId, termsVersion: PRACTICE_TERMS_VERSION, termsAcceptedAt: new Date(), termsAcceptedBy: userId } });
    await prisma.practiceMember.create({ data: { practice: practice.id, user: userId, role: "partner" } });
    return practice;
}

export async function myPractices(userId: string) {
    const rows = await prisma.practiceMember.findMany({ where: { user: userId } });
    if (!rows.length) return [];
    const practices = await prisma.practice.findMany({ where: { id: { in: rows.map((r) => r.practice) } } });
    return practices.map((p) => ({ ...p, myRole: rows.find((r) => r.practice === p.id)?.role as MemberRole }));
}

export async function practiceDetails(practiceId: string, userId: string) {
    const me = await memberOf(practiceId, userId);
    if (!me) throw new PracticeError("Practice not found", 404);
    const [practice, members, links] = await Promise.all([
        prisma.practice.findUnique({ where: { id: practiceId } }),
        prisma.practiceMember.findMany({ where: { practice: practiceId } }),
        prisma.clientLink.findMany({ where: { practice: practiceId }, orderBy: { createdAt: "desc" } }),
    ]);
    const users = await prisma.user.findMany({ where: { id: { in: members.map((m) => m.user) } }, select: { id: true, firstname: true, lastname: true, email: true } });
    const orgs = await prisma.organization.findMany({ where: { id: { in: links.map((l) => l.org).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    return {
        practice, myRole: me.role as MemberRole,
        members: members.map((m) => { const u = users.find((x) => x.id === m.user); return { userId: m.user, name: u ? `${u.firstname} ${u.lastname}`.trim() : "—", email: u?.email ?? "", role: m.role }; }),
        // токен приглашения виден только партнёрам: по нему клиент подключает свою фирму
        links: links.map((l) => ({ id: l.id, status: l.status, initiatedBy: l.initiatedBy, org: l.org, orgName: orgs.find((o) => o.id === l.org)?.name ?? "", access: l.access, modules: l.modules, members: l.members, note: l.note, expiresAt: l.expiresAt, endedAt: l.endedAt, endReason: l.endReason, createdAt: l.createdAt, ...(me.role === "partner" && l.status === "invited" && l.initiatedBy === "practice" ? { token: l.token } : {}) })),
    };
}

export async function addMember(practiceId: string, actor: string, email: unknown, role: unknown) {
    await requirePartner(practiceId, actor);
    const r = (MEMBER_ROLES as readonly string[]).includes(String(role)) ? (role as MemberRole) : "junior";
    const user = await prisma.user.findUnique({ where: { email: text(email, 200).toLowerCase() } });
    if (!user) throw new PracticeError("There is no account with this e-mail — the colleague must register first", 404);
    if (await memberOf(practiceId, user.id)) throw new PracticeError("Already in the practice", 409);
    return prisma.practiceMember.create({ data: { practice: practiceId, user: user.id, role: r } });
}

export async function removeMember(practiceId: string, actor: string, userId: string) {
    await requirePartner(practiceId, actor);
    const target = await memberOf(practiceId, userId);
    if (!target) throw new PracticeError("Member not found", 404);
    if (target.role === "partner" && (await prisma.practiceMember.count({ where: { practice: practiceId, role: "partner" } })) <= 1) throw new PracticeError("The last partner cannot be removed", 409);
    await prisma.practiceMember.delete({ where: { id: target.id } });
    // сотрудник уходит из практики — доступ ко всем клиентам закрывается сразу
    const links = await prisma.clientLink.findMany({ where: { practice: practiceId, members: { has: userId } } });
    for (const l of links) {
        await prisma.clientLink.update({ where: { id: l.id }, data: { members: l.members.filter((m) => m !== userId) } });
        await prisma.membership.deleteMany({ where: { link: l.id, user: userId } });
    }
}

export async function setAiMode(practiceId: string, actor: string, mode: unknown) {
    await requirePartner(practiceId, actor);
    if (!(AI_MODES as readonly string[]).includes(String(mode))) throw new PracticeError("Invalid mode");
    return prisma.practice.update({ where: { id: practiceId }, data: { aiMode: String(mode) } });
}

// ── приглашения и связи ────────────────────────────────────────────────────────────────────────────────────

async function validMembers(practiceId: string, ids: unknown, fallback: string): Promise<string[]> {
    const wanted = Array.isArray(ids) && ids.length ? ids.filter((x): x is string => typeof x === "string") : [fallback];
    const ok = await prisma.practiceMember.findMany({ where: { practice: practiceId, user: { in: wanted } } });
    if (!ok.length) throw new PracticeError("Choose at least one practice member");
    return ok.map((m) => m.user);
}

/** Практика приглашает клиента: создаётся связь без фирмы и токен, который клиент вводит у себя. */
export async function inviteFromPractice(practiceId: string, actor: string, input: { access?: unknown; modules?: unknown; expiresInDays?: unknown; members?: unknown; note?: unknown }) {
    await requirePartner(practiceId, actor);
    await assertCanAddClient(practiceId);
    return prisma.clientLink.create({
        data: {
            practice: practiceId, status: "invited", initiatedBy: "practice", token: genToken(), access: cleanAccess(input.access), modules: cleanModules(input.modules),
            members: await validMembers(practiceId, input.members, actor), note: text(input.note, 300), invitedByUser: actor,
            expiresAt: new Date(Date.now() + cleanDays(input.expiresInDays) * 86400_000),
        },
    });
}

/** Клиент (владелец/администратор) принимает приглашение практики по токену — фирма клиента привязывается к связи. */
export async function acceptInvite(org: string, actor: { userId: string; role: string }, token: unknown) {
    requireOrgAdmin(actor.role);
    const link = typeof token === "string" ? await prisma.clientLink.findUnique({ where: { token } }) : null;
    // токен чужой/просроченный/уже использованный — одинаково «не найден»
    if (!link || link.status !== "invited" || link.initiatedBy !== "practice" || link.org || (link.expiresAt && link.expiresAt < new Date())) throw new PracticeError("Invitation not found", 404);
    const existing = await prisma.clientLink.findFirst({ where: { practice: link.practice, org, status: "active" } });
    if (existing) throw new PracticeError("This practice already has access to your firm", 409);
    await prisma.clientLink.deleteMany({ where: { practice: link.practice, org, status: { in: ["ended", "invited"] } } }); // одна связь на пару
    return activate(await prisma.clientLink.update({ where: { id: link.id }, data: { org } }), actor.userId);
}

/** Клиент приглашает «своего» специалиста по коду практики; практика подтверждает и назначает сотрудников. */
export async function inviteFromClient(org: string, actor: { userId: string; role: string }, input: { practiceCode?: unknown; access?: unknown; modules?: unknown; expiresInDays?: unknown; note?: unknown }) {
    requireOrgAdmin(actor.role);
    const practice = await prisma.practice.findUnique({ where: { code: text(input.practiceCode, 20).toUpperCase() } });
    if (!practice || !practice.termsAcceptedAt) throw new PracticeError("Practice not found", 404);
    const existing = await prisma.clientLink.findFirst({ where: { practice: practice.id, org } });
    if (existing?.status === "active") throw new PracticeError("This practice already has access to your firm", 409);
    const data = { status: "invited", initiatedBy: "client", access: cleanAccess(input.access), modules: cleanModules(input.modules), members: [] as string[], note: text(input.note, 300), invitedByUser: actor.userId, expiresAt: new Date(Date.now() + cleanDays(input.expiresInDays) * 86400_000), endedAt: null, endedBy: "", endReason: "" };
    return existing ? prisma.clientLink.update({ where: { id: existing.id }, data }) : prisma.clientLink.create({ data: { ...data, practice: practice.id, org, token: genToken() } });
}

/** Практика подтверждает приглашение клиента и назначает сотрудников. */
export async function acceptByPractice(practiceId: string, actor: string, linkId: string, members: unknown) {
    await requirePartner(practiceId, actor);
    const link = await prisma.clientLink.findFirst({ where: { id: linkId, practice: practiceId } });
    if (!link || link.status !== "invited" || link.initiatedBy !== "client" || !link.org) throw new PracticeError("Invitation not found", 404);
    await assertCanAddClient(practiceId);
    if (link.expiresAt && link.expiresAt < new Date()) throw new PracticeError("The invitation has expired", 410);
    const ids = await validMembers(practiceId, members, actor);
    return activate(await prisma.clientLink.update({ where: { id: link.id }, data: { members: ids } }), actor);
}

/** Включает связь: согласие клиента + членство специалистов с ограниченной ролью. Единственное место, где доступ появляется. */
async function activate(link: { id: string; practice: string; org: string | null; access: string; modules: string[]; members: string[]; expiresAt: Date | null }, confirmedBy: string) {
    if (!link.org) throw new PracticeError("Invitation not found", 404);
    const practice = await prisma.practice.findUnique({ where: { id: link.practice } });
    if (!practice) throw new PracticeError("Practice not found", 404);
    const org = link.org;
    const activeMembers = (await prisma.practiceMember.findMany({ where: { practice: link.practice, user: { in: link.members } } })).map((m) => m.user);
    if (!activeMembers.length) throw new PracticeError("Choose at least one practice member");
    const updated = await prisma.clientLink.update({ where: { id: link.id }, data: { status: "active", confirmedBy, confirmedAt: new Date(), members: activeMembers } });
    await prisma.consentRecord.create({
        data: { org, kind: "practice_access", subjectType: "client_link", subjectId: link.id, purpose: practice.kind === "lawyer" ? "legal_services" : "accounting_services", scope: { modules: link.modules, access: link.access, practice: practice.id, members: activeMembers } as never, grantedBy: confirmedBy, expiresAt: link.expiresAt, version: PRACTICE_TERMS_VERSION },
    });
    for (const userId of activeMembers) {
        const has = await prisma.membership.findFirst({ where: { org, user: userId } });
        if (has) continue; // человек уже сотрудник фирмы со своей ролью — её не переписываем
        await prisma.membership.create({ data: { org, user: userId, role: roleFor(practice.kind), modules: link.modules, link: link.id } });
    }
    return updated;
}

/** Завершение связи клиентом (владелец/администратор) или партнёром практики. Доступ закрывается немедленно: членства удаляются. */
export async function endLink(linkId: string, actor: { userId: string; role?: string; org?: string }, reason: unknown) {
    const link = await prisma.clientLink.findUnique({ where: { id: linkId } });
    if (!link) throw new PracticeError("Link not found", 404);
    const byClient = !!link.org && actor.org === link.org && (actor.role === "owner" || actor.role === "admin");
    const byPractice = (await memberOf(link.practice, actor.userId))?.role === "partner";
    if (!byClient && !byPractice) throw new PracticeError("Link not found", 404);
    if (link.status === "ended") return link;
    await prisma.membership.deleteMany({ where: { link: link.id } });
    if (link.org) await prisma.consentRecord.updateMany({ where: { org: link.org, subjectType: "client_link", subjectId: link.id, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: actor.userId } });
    return prisma.clientLink.update({ where: { id: link.id }, data: { status: "ended", endedAt: new Date(), endedBy: actor.userId, endReason: text(reason, 300) } });
}

/** Связи фирмы с практиками: для экрана клиента. Токен приглашения клиенту не отдаём. */
export async function linksForOrg(org: string, role: string) {
    requireOrgAdmin(role);
    const links = await prisma.clientLink.findMany({ where: { org }, orderBy: { createdAt: "desc" } });
    const practices = await prisma.practice.findMany({ where: { id: { in: links.map((l) => l.practice) } } });
    const users = await prisma.user.findMany({ where: { id: { in: links.flatMap((l) => l.members) } }, select: { id: true, firstname: true, lastname: true } });
    return links.map((l) => {
        const p = practices.find((x) => x.id === l.practice);
        return { id: l.id, status: l.status, initiatedBy: l.initiatedBy, practice: { id: l.practice, name: p?.name ?? "", kind: p?.kind ?? "" }, access: l.access, modules: l.modules, expiresAt: l.expiresAt, confirmedAt: l.confirmedAt, endedAt: l.endedAt, endReason: l.endReason, members: l.members.map((id) => { const u = users.find((x) => x.id === id); return { userId: id, name: u ? `${u.firstname} ${u.lastname}`.trim() : "—" }; }) };
    });
}

/** Журнал доступа специалистов к данным фирмы — клиенту (владельцу/администратору). */
export async function accessLogForOrg(org: string, role: string, opts: { link?: string; limit?: number } = {}) {
    requireOrgAdmin(role);
    return prisma.accessLogEntry.findMany({ where: { org, ...(opts.link ? { link: opts.link } : {}) }, orderBy: { at: "desc" }, take: Math.min(500, Math.max(1, opts.limit ?? 100)) });
}
