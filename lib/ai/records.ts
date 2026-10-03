import { prisma } from "@/lib/prisma";
import { CONTACT_FIELDS, COMPANY_FIELDS, DEAL_TEXT_FIELDS, contactFullName } from "@/lib/crmFields";

// Карточки CRM (сделка, контакт, компания) для ассистента: поиск по id или названию, правка полей, открытие карточки.
// Память Айрис (то, что человек ей объяснил: «“перейди в CRM” — это раздел CRM») лежит в SectionRecord под ключом
// ai:mem:<пользователь>: отдельная таблица не нужна, миграция базы тоже.
export class RecordError extends Error {}

export type Entity = "deal" | "contact" | "company";
const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(v);
const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });

const FIELDS = {
    deal: { owner: "owner", search: ["clientName", "contactName", "companyName"], title: "clientName" },
    contact: { owner: "owner", search: ["name", "email", "company", "phone"], title: "name" },
    company: { owner: "owner", search: ["name", "email", "field"], title: "name" },
} as const;

type Row = Record<string, any>;
const delegate = (e: Entity) => (prisma as unknown as Record<string, any>)[e];

/** Карточка по id или по названию (точное совпадение важнее частичного; несколько — ошибка со списком). */
export async function resolveRecord(org: string, entity: Entity, ref: { id?: unknown; name?: unknown }): Promise<Row> {
    const f = FIELDS[entity];
    if (isId(ref.id)) {
        const hit = await delegate(entity).findFirst({ where: { id: ref.id, [f.owner]: org } });
        if (hit) return hit;
    }
    const q = typeof ref.name === "string" ? ref.name.trim().slice(0, 120) : "";
    if (!q) throw new RecordError(`${entity} id or name is required`);
    const rows: Row[] = await delegate(entity).findMany({ where: { [f.owner]: org, OR: f.search.map((k) => ({ [k]: ci(q) })) }, orderBy: { updatedAt: "desc" }, take: 20 });
    const exact = rows.filter((r) => String(r[f.title]).toLowerCase() === q.toLowerCase());
    const hit = exact.length ? exact : rows;
    if (hit.length === 1) return hit[0];
    if (!hit.length) throw new RecordError(`No ${entity} matches "${q}"`);
    throw new RecordError(`Several ${entity}s match "${q}": ${hit.slice(0, 6).map((r) => `${r[f.title]} (${r.id})`).join("; ")} — ask which one or use the id`);
}

export const titleOf = (entity: Entity, r: Row) => String(r[FIELDS[entity].title] ?? "");

/** Где открывается карточка: контакт и компания — своя страница, сделка — окно на доске (?deal=). */
export function recordLink(entity: Entity, id: string) {
    if (entity === "contact") return `/crm/crm/contacts/${id}`;
    if (entity === "company") return `/crm/crm/companies/${id}`;
    return `/crm/crm?deal=${id}&n=${Date.now().toString(36)}`;
}

const clip = (v: unknown, n = 500) => String(v ?? "").trim().slice(0, n);

export const DEAL_EDITABLE = ["title", ...DEAL_TEXT_FIELDS] as const;
export const CONTACT_EDITABLE = CONTACT_FIELDS;
export const COMPANY_EDITABLE = COMPANY_FIELDS;

/** Меняет поля карточки. Возвращает название и перечень изменённых полей. */
export async function updateRecord(org: string, entity: Entity, ref: { id?: unknown; name?: unknown }, fields: Record<string, unknown>) {
    const row = await resolveRecord(org, entity, ref);
    const data: Record<string, unknown> = {};
    const changed: string[] = [];
    if (entity === "deal") {
        for (const k of DEAL_TEXT_FIELDS) if (fields[k] !== undefined) { data[k] = clip(fields[k], 200); changed.push(k); }
        if (fields.title !== undefined) { const t = clip(fields.title, 200); if (!t) throw new RecordError("title must not be empty"); data.clientName = t; changed.push("title"); }
    } else if (entity === "contact") {
        for (const k of CONTACT_FIELDS) if (fields[k] !== undefined) { data[k] = clip(fields[k], k === "notes" ? 4000 : 300); changed.push(k); }
        if ("firstName" in data || "lastName" in data) {
            const name = contactFullName({ firstName: String(data.firstName ?? row.firstName ?? ""), lastName: String(data.lastName ?? row.lastName ?? "") }, row.name);
            if (name) data.name = name;
        }
        if (typeof data.email === "string" && data.email && !/^\S+@\S+\.\S+$/.test(data.email)) throw new RecordError("email is not a valid address");
    } else {
        for (const k of COMPANY_FIELDS) if (fields[k] !== undefined) { data[k] = clip(fields[k], k === "address" ? 400 : 200); changed.push(k); }
        if ("name" in data && !data.name) throw new RecordError("name must not be empty");
    }
    if (!changed.length) throw new RecordError("Nothing to change: give at least one field");
    await delegate(entity).update({ where: { id: row.id }, data });
    return { id: row.id as string, title: titleOf(entity, { ...row, ...data, clientName: data.clientName ?? row.clientName }), changed };
}

// ── память ──
const memKey = (userId: string) => `ai:mem:${userId}`;
const MEM_MAX = 80;

export async function loadMemory(org: string, userId: string): Promise<{ id: string; text: string }[]> {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key: memKey(userId) }, orderBy: { createdAt: "asc" }, take: MEM_MAX + 5 });
    return rows.map((r) => ({ id: r.rid, text: String((r.values as { text?: string } | null)?.text ?? "") })).filter((m) => m.text);
}

export async function remember(org: string, userId: string, text: string) {
    const t = clip(text, 400);
    if (t.length < 4) throw new RecordError("Nothing to remember");
    const all = await loadMemory(org, userId);
    const dup = all.find((m) => m.text.toLowerCase() === t.toLowerCase());
    if (dup) return { id: dup.id, text: dup.text, saved: false };
    if (all.length >= MEM_MAX) await prisma.sectionRecord.deleteMany({ where: { org, key: memKey(userId), rid: all[0].id } }); // самое старое уступает место
    const rid = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await prisma.sectionRecord.create({ data: { org, key: memKey(userId), rid, values: { text: t, at: new Date().toISOString() } as never } });
    return { id: rid, text: t, saved: true };
}

export async function forget(org: string, userId: string, ref: string) {
    const r = clip(ref, 200).toLowerCase();
    if (!r) throw new RecordError("What should be forgotten?");
    const all = await loadMemory(org, userId);
    const hit = all.filter((m) => m.id === ref || m.text.toLowerCase().includes(r));
    if (!hit.length) throw new RecordError("Nothing like that in memory");
    await prisma.sectionRecord.deleteMany({ where: { org, key: memKey(userId), rid: { in: hit.map((h) => h.id) } } });
    return { removed: hit.map((h) => h.text) };
}

/** Память одним блоком для промпта (последнее важнее — идёт в конце, лишнее обрезается с начала). */
export function memoryBlock(items: { text: string }[]): string {
    if (!items.length) return "";
    let out = "";
    for (const m of [...items].reverse()) { const line = `- ${m.text}\n`; if (out.length + line.length > 3000) break; out = line + out; }
    return out.trim();
}
