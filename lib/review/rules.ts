import { prisma } from "@/lib/prisma";
import { PeriodLockedError } from "@/lib/finance/periodLock";
import { ReviewError } from "./service";

// Правила сверки фирмы (docs/TZ_MASTER.md §5, п. 9, сокращённый объём): «контрагент/назначение содержит … → статья».
// Применяются при загрузке выписки и по кнопке к ещё не размеченным движениям. Правило — явное и видимое: никакого самообучения.
// Задают владелец, администратор и специалист практики; закрытый период правилами не переписывается.

export const RULE_FIELDS = ["counterparty", "reference"] as const;
export type RuleField = (typeof RULE_FIELDS)[number];
const RULE_ROLES = ["owner", "admin", "advisor", "counsel"];
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");

export interface RuleLike { id: string; field: string; pattern: string; category: string }

/** Категория первого подходящего правила (регистр не важен); пусто — правил нет. */
export function categoryFor(rules: RuleLike[], row: { counterparty?: string; reference?: string }): { category: string; rule: string } | null {
    for (const r of rules) {
        const hay = (r.field === "reference" ? row.reference : row.counterparty) ?? "";
        if (r.pattern && hay.toLowerCase().includes(r.pattern.toLowerCase())) return { category: r.category, rule: r.id };
    }
    return null;
}

export const listRules = (org: string) => prisma.practiceRule.findMany({ where: { org }, orderBy: { createdAt: "asc" } });

export async function createRule(org: string, actor: { userId: string; name: string; role: string }, input: { field?: unknown; pattern?: unknown; category?: unknown }) {
    if (!RULE_ROLES.includes(actor.role)) throw new ReviewError("Only the owner, an administrator or a specialist can set rules", 403);
    const field = (RULE_FIELDS as readonly string[]).includes(String(input.field)) ? (input.field as RuleField) : "counterparty";
    const pattern = clean(input.pattern, 80), category = clean(input.category, 80);
    if (pattern.length < 3) throw new ReviewError("The pattern must be at least 3 characters");
    if (!category) throw new ReviewError("Enter the category");
    if ((await prisma.practiceRule.count({ where: { org } })) >= 200) throw new ReviewError("Too many rules (200 max)", 409);
    const rule = await prisma.practiceRule.create({ data: { org, field, pattern, category, createdBy: actor.userId, createdByName: actor.name } });
    return { rule, applied: await applyToExisting(org, [rule]) };
}

export async function deleteRule(org: string, role: string, id: string) {
    if (!RULE_ROLES.includes(role)) throw new ReviewError("Only the owner, an administrator or a specialist can remove rules", 403);
    const r = await prisma.practiceRule.deleteMany({ where: { id, org } });
    if (!r.count) throw new ReviewError("Rule not found", 404);
}

/** Размечает движения без категории; строки в закрытом периоде пропускаются, а не ломают пакет. */
export async function applyToExisting(org: string, rules: RuleLike[]): Promise<number> {
    const rows = await prisma.bankTransaction.findMany({ where: { org, category: "" }, select: { id: true, counterparty: true, reference: true }, take: 2000 });
    let n = 0;
    const hits = new Map<string, number>();
    for (const row of rows) {
        const hit = categoryFor(rules, row);
        if (!hit) continue;
        try {
            await prisma.bankTransaction.update({ where: { id: row.id }, data: { category: hit.category } });
            n++;
            hits.set(hit.rule, (hits.get(hit.rule) ?? 0) + 1);
        } catch (e) {
            if (!(e instanceof PeriodLockedError)) throw e;
        }
    }
    for (const [id, c] of Array.from(hits)) await prisma.practiceRule.update({ where: { id }, data: { hits: { increment: c } } }).catch(() => undefined);
    return n;
}
