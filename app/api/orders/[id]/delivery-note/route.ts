import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { customerParty, deliveryNotePdfBuffer, pdfLocale, pdfTemplate } from "@/lib/finance/document";
import { financeSettings } from "@/lib/finance/settings";
import { checkCompliance, complianceMessage } from "@/lib/finance/compliance";
import { nextNumber } from "@/lib/finance/numbering";
import { logAudit } from "@/lib/audit";
import Order from "@/models/Order";
import User from "@/models/User";
import { numberPrefix } from "@/lib/finance/documents/store";

export const dynamic = "force-dynamic";

// GET /api/orders/:id/delivery-note?locale=&template=&deliveryDate= — накладная (Lieferschein) по заказу.
// Номер присваивается один раз: если у заказа его ещё нет, берём следующий из общей последовательности
// и сохраняем. Повторная печать отдаёт тот же документ с тем же номером — иначе каждый просмотр
// съедал бы номер из последовательности, а у клиента оказались бы разные накладные на одну поставку.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return notFound();
        await connectDB();

        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        if (order.status === "cancelled") return badRequest("This order is cancelled");

        const url = new URL(req.url);
        const dateParam = url.searchParams.get("deliveryDate");
        const deliveryDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : order.deliveryDate || "";

        if (!order.deliveryNoteNumber || deliveryDate !== order.deliveryDate) {
            const settings = await financeSettings(user.id);
            // Чек-лист обязательных реквизитов (ТЗ §14): накладная без подписанта (Украина) не выпускается.
            // Покупателя берём так же, как его напечатает PDF (имя из заказа, иначе из контакта/фирмы)
            const party = await customerParty(user.id, order);
            const issues = checkCompliance(
                { kind: "delivery_note", number: order.deliveryNoteNumber || "", issueDate: deliveryDate || new Date().toISOString().slice(0, 10), currency: order.currency, party: { name: party.name }, items: (order.items ?? []) as never },
                settings as never
            );
            if (issues.length) return NextResponse.json({ message: complianceMessage(issues), code: "compliance", missing: issues.map((i) => i.code) }, { status: 400 });
            const number = order.deliveryNoteNumber || (await nextNumber(user.id, await numberPrefix(user.id, "delivery_note", settings.deliveryNotePrefix || "LS")));
            order.deliveryNoteNumber = number;
            order.deliveryDate = deliveryDate;
            await order.save();
            const author = await User.findById(user.userId).select("firstname lastname");
            await logAudit({
                org: user.id,
                userName: author ? `${author.firstname} ${author.lastname}`.trim() : "—",
                action: "order.delivery_note_created",
                entityType: "order",
                entityId: String(order._id),
                summary: `Delivery note ${number} issued for order ${order.number}`,
            });
        }

        const buffer = await deliveryNotePdfBuffer(
            user.id, order,
            pdfLocale(url.searchParams.get("locale")),
            pdfTemplate(url.searchParams.get("template"))
        );
        return new Response(buffer as unknown as BodyInit, {
            headers: {
                "content-type": "application/pdf",
                "content-disposition": `inline; filename="${order.deliveryNoteNumber}.pdf"`,
                "cache-control": "private, no-store",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
