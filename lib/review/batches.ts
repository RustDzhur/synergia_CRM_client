import { prisma } from "@/lib/prisma";
import { PeriodLockedError } from "@/lib/finance/periodLock";
import { categoryFor } from "./rules";
import { ReviewError } from "./service";

// Роботы и правила практики (docs/TZ_MASTER.md §5.2 п. 9): работают только в режиме «спрашивать перед изменениями».
// 1) propose — подбираем изменения по правилам, ничего не записывая (пакет в статусе proposed, виден отчёт «что сделает»);
// 2) apply — человек применяет пакет; 3) rollback — человек откатывает весь пакет, если с тех пор поле не менялось.
// ИИ здесь не используется: правила явные, поэтому настройка «ИИ для данных клиентов практики» не затрагивается.

const ACTOR_ROLES = ["owner", "admin", "advisor", "counsel"];
type Actor = { userId: string; name: string; role: string };
export interface Change { id: string; field: "category"; from: string; to: string; rule: string }

const need = (a: Actor) => { if (!ACTOR_ROLES.includes(a.role)) throw new ReviewError("Only the owner, an administrator or a specialist can do this", 403); };

export async function proposeRulesBatch(org: string, actor: Actor) {
    need(actor);
    const rules = await prisma.practiceRule.findMany({ where: { org }, orderBy: { createdAt: "asc" } });
    if (!rules.length) throw new ReviewError("There are no rules yet");
    const rows = await prisma.bankTransaction.findMany({ where: { org, category: "" }, select: { id: true, counterparty: true, reference: true }, take: 1000 });
    const changes: Change[] = [];
    for (const r of rows) {
        const hit = categoryFor(rules, r);
        if (hit) changes.push({ id: r.id, field: "category", from: "", to: hit.category, rule: hit.rule });
    }
    if (!changes.length) throw new ReviewError("Nothing to change — no unlabelled transaction matches a rule", 409);
    return prisma.practiceBatch.create({ data: { org, kind: "rules", status: "proposed", changes: changes as never, createdBy: actor.userId, createdByName: actor.name } });
}

export const listBatches = (org: string) => prisma.practiceBatch.findMany({ where: { org }, orderBy: { createdAt: "desc" }, take: 30 });

async function load(org: string, id: string) {
    const b = await prisma.practiceBatch.findFirst({ where: { id, org } });
    if (!b) throw new ReviewError("Not found", 404);
    return b;
}

export async function applyBatch(org: string, actor: Actor, id: string) {
    need(actor);
    const b = await load(org, id);
    if (b.status !== "proposed") throw new ReviewError("Only a proposed batch can be applied", 409);
    const changes = b.changes as unknown as Change[];
    const done: Change[] = [];
    let skipped = 0;
    for (const c of changes) {
        const cur = await prisma.bankTransaction.findFirst({ where: { id: c.id, org }, select: { category: true } });
        if (!cur || cur.category !== c.from) { skipped++; continue; } // с момента предложения запись изменили — не трогаем
        try {
            await prisma.bankTransaction.update({ where: { id: c.id }, data: { category: c.to } });
            done.push(c);
        } catch (e) {
            if (e instanceof PeriodLockedError) { skipped++; continue; }
            throw e;
        }
    }
    return prisma.practiceBatch.update({ where: { id }, data: { status: "applied", changes: done as never, skipped, appliedBy: actor.userId, appliedAt: new Date() } });
}

export async function rollbackBatch(org: string, actor: Actor, id: string) {
    need(actor);
    const b = await load(org, id);
    if (b.status !== "applied") throw new ReviewError("Only an applied batch can be rolled back", 409);
    let restored = 0, kept = 0;
    for (const c of b.changes as unknown as Change[]) {
        // откатываем, только если поле всё ещё то, что поставил пакет (человек мог поправить сам)
        const cur = await prisma.bankTransaction.findFirst({ where: { id: c.id, org }, select: { category: true } });
        if (!cur || cur.category !== c.to) { kept++; continue; }
        try {
            await prisma.bankTransaction.update({ where: { id: c.id }, data: { category: c.from } });
            restored++;
        } catch (e) {
            if (e instanceof PeriodLockedError) { kept++; continue; }
            throw e;
        }
    }
    await prisma.practiceBatch.update({ where: { id }, data: { status: "rolled_back", rolledBackAt: new Date() } });
    return { restored, kept };
}

export async function dismissBatch(org: string, actor: Actor, id: string) {
    need(actor);
    const b = await load(org, id);
    if (b.status !== "proposed") throw new ReviewError("Only a proposed batch can be dismissed", 409);
    return prisma.practiceBatch.update({ where: { id }, data: { status: "dismissed" } });
}
