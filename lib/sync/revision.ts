import { prisma } from "@/lib/prisma";

// «Ревизия» данных фирмы: меняется, когда кто угодно из фирмы изменил сделку, контакт, фирму, задачу, счёт, заказ, КП
// или расход. Клиент получает её с каждым опросом уведомлений (раз в 30 секунд); если она отличается от прошлой —
// открытые разделы перечитывают данные. Так изменения коллеги появляются без перезагрузки страницы.
// Считается по числу записей и времени последнего изменения (индексы (owner|org, updatedAt)).
export async function orgRevision(org: string): Promise<string> {
    const agg = { _max: { updatedAt: true }, _count: { _all: true } } as const;
    const [deals, tasks, contacts, companies, invoices, orders, quotes, expenses] = await Promise.all([
        prisma.deal.aggregate({ where: { owner: org }, ...agg }),
        prisma.task.aggregate({ where: { owner: org }, ...agg }),
        prisma.contact.aggregate({ where: { owner: org }, ...agg }),
        prisma.company.aggregate({ where: { owner: org }, ...agg }),
        prisma.invoice.aggregate({ where: { org }, ...agg }),
        prisma.order.aggregate({ where: { org }, ...agg }),
        prisma.quote.aggregate({ where: { org }, ...agg }),
        prisma.expense.aggregate({ where: { org }, ...agg }),
    ]);
    return [deals, tasks, contacts, companies, invoices, orders, quotes, expenses]
        .map((a) => `${a._count._all}.${a._max.updatedAt ? a._max.updatedAt.getTime().toString(36) : 0}`)
        .join("-");
}
