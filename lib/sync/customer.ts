import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/automation/emit";
import { logActivity } from "@/lib/sync/feed";
import { recordSyncError } from "@/lib/sync/errors";
import { fx } from "@/lib/sync/texts";

// Согласованность клиента с тем, что на него ссылается. Связи в базе — строки без внешних ключей, а в документах
// и сделках лежат копии имени клиента. Здесь одно место, которое их обновляет при правке клиента и
// размыкает связи при его удалении.
//
// Правило неизменности: документ, который уже ушёл клиенту (отправленный/оплаченный счёт, подписанный договор,
// принятое предложение), не переписывается — иначе напечатанный документ разошёлся бы с записью в системе.
// Меняются только черновики и не выпущенные документы; факт переименования остаётся в ленте клиента.

const DRAFT = { invoices: ["draft"], quotes: ["draft"], orders: ["draft", "confirmed"], contracts: ["draft"] } as const;

export interface Blockers { unpaidInvoices: number; openDeals: number; openTasks: number }

// Что мешает или должно насторожить при удалении клиента. Неоплаченные счета — жёсткая преграда: деньги ждут
// именно этого клиента. Открытые сделки и задачи — предупреждение, их связь просто снимается.
export async function customerBlockers(org: string, ref: { contact?: string; company?: string }): Promise<Blockers> {
    const where = ref.contact ? { contact: ref.contact } : { company: ref.company };
    const [unpaidInvoices, openDeals, openTasks] = await Promise.all([
        prisma.invoice.count({ where: { org, ...where, kind: "invoice", status: { in: ["sent", "overdue"] } } }),
        prisma.deal.count({ where: { owner: org, ...where, wonAt: null } }),
        prisma.task.count({ where: { owner: org, ...where, completed: false } }),
    ]);
    return { unpaidInvoices, openDeals, openTasks };
}

// После удаления клиента ссылки обнуляются, а имя (customerName / contactName) остаётся в записи: документ
// продолжает показывать, кому он выставлен, и не висит на несуществующем id.
export async function unlinkCustomer(org: string, ref: { contact?: string; company?: string }) {
    const key = ref.contact ? "contact" : "company";
    const id = (ref.contact ?? ref.company) as string;
    const where = { [key]: id } as Record<string, string>;
    const data = { [key]: null } as Record<string, null>;
    await Promise.all([
        prisma.deal.updateMany({ where: { owner: org, ...where }, data }),
        prisma.task.updateMany({ where: { owner: org, ...where }, data }),
        prisma.invoice.updateMany({ where: { org, ...where }, data }),
        prisma.quote.updateMany({ where: { org, ...where }, data }),
        prisma.order.updateMany({ where: { org, ...where }, data }),
        prisma.contract.updateMany({ where: { org, ...where }, data }),
        ...(ref.contact ? [prisma.conversation.updateMany({ where: { owner: org, contact: id }, data: { contact: null } })] : []),
        ...(ref.company ? [prisma.contact.updateMany({ where: { owner: org, companyId: id }, data: { companyId: null } })] : []),
    ]);
}

// Сделка удалена: задачи, документы и расходы остаются у клиента, но больше не ссылаются на несуществующую сделку
export async function unlinkDeal(org: string, dealId: string) {
    await Promise.all([
        prisma.task.updateMany({ where: { owner: org, deal: dealId }, data: { deal: null } }),
        prisma.invoice.updateMany({ where: { org, deal: dealId }, data: { deal: null } }),
        prisma.quote.updateMany({ where: { org, deal: dealId }, data: { deal: null } }),
        prisma.order.updateMany({ where: { org, deal: dealId }, data: { deal: null } }),
        prisma.contract.updateMany({ where: { org, deal: dealId }, data: { deal: null } }),
        prisma.expense.updateMany({ where: { org, deal: dealId }, data: { deal: null } }),
    ]);
}

export interface NamedChange { id: string; before: string; after: string }

async function renameCopies(org: string, key: "contact" | "company", c: NamedChange) {
    const where = { [key]: c.id } as Record<string, string>;
    const nameField = key === "contact" ? "contactName" : "companyName";
    // сделки: копия имени клиента в карточке сделки (заголовок сделки clientName не трогаем — это название, а не копия)
    await prisma.deal.updateMany({ where: { owner: org, ...where }, data: { [nameField]: c.after } as never });
    // документы: только черновики, и только те, где имя клиента совпадало со старым (ручную правку не затираем)
    const same = { customerName: c.before };
    await Promise.all([
        prisma.invoice.updateMany({ where: { org, ...where, ...same, status: { in: [...DRAFT.invoices] } }, data: { customerName: c.after } }),
        prisma.quote.updateMany({ where: { org, ...where, ...same, status: { in: [...DRAFT.quotes] } }, data: { customerName: c.after } }),
        prisma.order.updateMany({ where: { org, ...where, ...same, status: { in: [...DRAFT.orders] } }, data: { customerName: c.after } }),
        prisma.contract.updateMany({ where: { org, ...where, ...same, status: { in: [...DRAFT.contracts] } }, data: { customerName: c.after } }),
    ]);
}

export async function propagateContactChange(org: string, before: { id: string; name: string; email?: string | null; phone?: string | null; company?: string | null }, after: { name: string; email?: string | null; phone?: string | null; company?: string | null }) {
    try {
        const changed: string[] = [];
        if (before.name !== after.name) changed.push("name");
        if ((before.email ?? "") !== (after.email ?? "")) changed.push("email");
        if ((before.phone ?? "") !== (after.phone ?? "")) changed.push("phone");
        if ((before.company ?? "") !== (after.company ?? "")) changed.push("company");
        if (!changed.length) return;
        if (changed.includes("name")) {
            await renameCopies(org, "contact", { id: before.id, before: before.name, after: after.name });
            await prisma.conversation.updateMany({ where: { owner: org, contact: before.id, name: before.name }, data: { name: after.name } });
            await logActivity(org, { contact: before.id }, { type: "note", text: fx("contact_renamed", { before: before.name, after: after.name }), meta: "rename" });
        }
        await emit(org, { type: "contact_updated", data: { id: before.id, name: after.name, email: after.email ?? "", phone: after.phone ?? "", changed: changed.join(",") } });
    } catch (e) {
        await recordSyncError(org, "customer.contact", e, { id: before.id });
    }
}

export async function propagateCompanyChange(org: string, before: { id: string; name: string }, after: { name: string }) {
    try {
        if (before.name === after.name) return;
        await renameCopies(org, "company", { id: before.id, before: before.name, after: after.name });
        // строка «Компания» в карточках контактов этой фирмы
        await prisma.contact.updateMany({ where: { owner: org, companyId: before.id }, data: { company: after.name } });
        await logActivity(org, { company: before.id }, { type: "note", text: fx("company_renamed", { before: before.name, after: after.name }), meta: "rename" });
        await emit(org, { type: "company_updated", data: { id: before.id, name: after.name, changed: "name" } });
    } catch (e) {
        await recordSyncError(org, "customer.company", e, { id: before.id });
    }
}

// Фирма контакта: явно выбранная (companyId) проверяется на принадлежность; иначе фирма находится по точному названию
// из текстового поля «Компания». Так контакт связывается с карточкой фирмы, и переименование фирмы доходит до него.
// Возвращает { companyId, company }: undefined — поле не менять.
export async function resolveContactCompany(org: string, input: { companyId?: unknown; company?: unknown }): Promise<{ companyId?: string | null; company?: string } | undefined> {
    if (typeof input.companyId === "string" && input.companyId) {
        const found = await prisma.company.findFirst({ where: { id: input.companyId, owner: org }, select: { id: true, name: true } });
        return found ? { companyId: found.id, company: found.name } : { companyId: null };
    }
    if (input.companyId === "" || input.companyId === null) return { companyId: null };
    if (typeof input.company === "string") {
        const name = input.company.trim();
        if (!name) return { companyId: null, company: "" };
        const found = await prisma.company.findFirst({ where: { owner: org, name: { equals: name, mode: "insensitive" } }, select: { id: true, name: true } });
        return found ? { companyId: found.id, company: found.name } : { companyId: null };
    }
    return undefined;
}
