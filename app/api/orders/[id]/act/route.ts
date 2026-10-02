import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { actPdfBuffer, customerParty, pdfLocale, pdfTemplate } from "@/lib/finance/document";
import { financeSettings } from "@/lib/finance/settings";
import { checkCompliance, complianceMessage } from "@/lib/finance/compliance";
import { nextNumber } from "@/lib/finance/numbering";
import { logAudit } from "@/lib/audit";
import { requireMarket } from "@/lib/finance/marketGuard";
import { prisma } from "@/lib/prisma";
import { numberPrefix } from "@/lib/finance/documents/store";

export const dynamic = "force-dynamic";

// GET /api/orders/:id/act?locale=&template=&actDate= — акт виконаних робіт по заказу.
// В украинском учёте это самостоятельный документ со своим номером и датой; подписи исполнителя
// и заказчика печатает сам PDF (lib/finance/layouts.ts). Номер, как у накладной, присваивается
// один раз: повторная печать отдаёт тот же документ, а не съедает номер из последовательности.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return notFound();
        // Акт виконаних робіт — украинский документ: в немецком режиме его не выпускаем.
        // Отказ должен быть 409 с кодом market (его переводит интерфейс), а не 500 от брошенного исключения
        await requireMarket(user.id, "UA");

        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        if (order.status === "cancelled") return badRequest("This order is cancelled");

        const url = new URL(req.url);
        const dateParam = url.searchParams.get("actDate");
        const actDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : order.actDate || "";

        if (!order.actNumber || actDate !== order.actDate) {
            const settings = await financeSettings(user.id);
            // Чек-лист обязательных реквизитов (ТЗ §14): акт без подписанта и реквизитов не выпускается.
            // Покупателя берём так же, как его напечатает PDF (имя из заказа, иначе из контакта/фирмы, —
            // иначе акт с привязанной фирмой без текста в customerName отклонялся бы зря).
            const party = await customerParty(user.id, order);
            const issues = checkCompliance(
                { kind: "act", number: order.actNumber || "", issueDate: actDate || new Date().toISOString().slice(0, 10), currency: order.currency, party: { name: party.name }, items: (order.items ?? []) as never, totals: undefined },
                settings as never
            );
            if (issues.length) return NextResponse.json({ message: complianceMessage(issues), code: "compliance", missing: issues.map((i) => i.code) }, { status: 400 });
            const number = order.actNumber || (await nextNumber(user.id, await numberPrefix(user.id, "act", settings.actPrefix || "АКТ")));
            await prisma.order.update({ where: { id: order.id }, data: { actNumber: number, actDate } });
            const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
            await logAudit({
                org: user.id,
                userName: author ? `${author.firstname} ${author.lastname}`.trim() : "—",
                action: "order.act_created",
                entityType: "order",
                entityId: order.id,
                summary: `Act ${number} issued for order ${order.number}`,
            });
        }

        // номер и дату акта могли только что присвоить — печатаем актуальную запись
        const fresh = (await prisma.order.findUnique({ where: { id: order.id } })) ?? order;
        const buffer = await actPdfBuffer(user.id, fresh, pdfLocale(url.searchParams.get("locale")), pdfTemplate(url.searchParams.get("template")));
        return new Response(buffer as unknown as BodyInit, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": contentDisposition(`${fresh.actNumber}.pdf`),
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
