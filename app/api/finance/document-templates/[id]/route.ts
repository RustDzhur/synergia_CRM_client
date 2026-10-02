import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toTemplateDTO } from "@/lib/finance/dto";

export const dynamic = "force-dynamic";

// Правка бланка документа: какие блоки печатаются, тексты (условия оплаты, примечания, подвал),
// префикс номера, подпись/печать, язык и валюта. Выключить активность нельзя «в ноль» —
// у каждого вида документа всегда есть бланк по умолчанию (это тот же документ, не новая сущность).

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const BLOCKS = ["logo", "qr", "notes", "footer", "signature", "seal", "rate"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const tpl = await prisma.documentTemplate.findFirst({ where: { id: params.id, org: user.id } });
    if (!tpl) return notFound();
    const texts = (tpl.texts ?? {}) as any;
    const data: Record<string, unknown> = {};

    if (typeof b.name === "string") {
        const name = str(b.name, 100);
        if (!name) return badRequest("Name is required");
        data.name = name;
    }
    if (Array.isArray(b.blocks)) data.blocks = b.blocks.map((x: unknown) => String(x)).filter((x: string) => BLOCKS.includes(x));
    if (b.texts && typeof b.texts === "object") {
        data.texts = {
            ua: str(b.texts.ua, 600) ?? texts.ua ?? "",
            en: str(b.texts.en, 600) ?? texts.en ?? "",
            de: str(b.texts.de, 600) ?? texts.de ?? "",
            notes: str(b.texts.notes, 600) ?? texts.notes ?? "",
        };
    }
    const prefix = str(b.prefix, 10);
    if (prefix !== undefined) data.prefix = prefix.toUpperCase();
    if (typeof b.showStamp === "boolean") data.showStamp = b.showStamp;
    if (typeof b.showSignature === "boolean") data.showSignature = b.showSignature;
    const footer = str(b.footer, 600);
    if (footer !== undefined) data.footer = footer;
    const paymentTerms = str(b.paymentTerms, 600);
    if (paymentTerms !== undefined) data.paymentTerms = paymentTerms;
    if (b.language === "ua" || b.language === "en" || b.language === "de") data.language = b.language;
    if (typeof b.currency === "string") data.currency = str(b.currency, 6)?.toUpperCase() ?? "";
    const saved = await prisma.documentTemplate.update({ where: { id: tpl.id }, data: data as any });
    return NextResponse.json(toTemplateDTO(saved));
}
