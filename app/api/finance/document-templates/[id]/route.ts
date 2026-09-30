import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import DocumentTemplate from "@/models/DocumentTemplate";
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
    await connectDB();
    const tpl = await DocumentTemplate.findOne({ _id: params.id, org: user.id });
    if (!tpl) return notFound();

    if (typeof b.name === "string") {
        const name = str(b.name, 100);
        if (!name) return badRequest("Name is required");
        tpl.name = name;
    }
    if (Array.isArray(b.blocks)) tpl.blocks = b.blocks.map((x: unknown) => String(x)).filter((x: string) => BLOCKS.includes(x));
    if (b.texts && typeof b.texts === "object") {
        tpl.texts = {
            ua: str(b.texts.ua, 600) ?? tpl.texts?.ua ?? "",
            en: str(b.texts.en, 600) ?? tpl.texts?.en ?? "",
            de: str(b.texts.de, 600) ?? tpl.texts?.de ?? "",
            notes: str(b.texts.notes, 600) ?? tpl.texts?.notes ?? "",
        };
        tpl.markModified("texts");
    }
    const prefix = str(b.prefix, 10);
    if (prefix !== undefined) tpl.prefix = prefix.toUpperCase();
    if (typeof b.showStamp === "boolean") tpl.showStamp = b.showStamp;
    if (typeof b.showSignature === "boolean") tpl.showSignature = b.showSignature;
    const footer = str(b.footer, 600);
    if (footer !== undefined) tpl.footer = footer;
    const paymentTerms = str(b.paymentTerms, 600);
    if (paymentTerms !== undefined) tpl.paymentTerms = paymentTerms;
    if (b.language === "ua" || b.language === "en" || b.language === "de") tpl.language = b.language;
    if (typeof b.currency === "string") tpl.currency = str(b.currency, 6)?.toUpperCase() ?? "";
    await tpl.save();
    return NextResponse.json(toTemplateDTO(tpl));
}
