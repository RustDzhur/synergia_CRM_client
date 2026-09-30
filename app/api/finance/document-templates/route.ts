import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { marketOf } from "@/lib/finance/market";
import { financeSettings } from "@/lib/finance/settings";
import { listTemplates } from "@/lib/finance/documents/store";
import { DOC_PRESETS } from "@/lib/finance/documents/presets";
import { toTemplateDTO } from "@/lib/finance/dto";
import DocumentTemplate from "@/models/DocumentTemplate";

export const dynamic = "force-dynamic";

// Бланки документов фирмы (ТЗ §7): «Налаштування → Документи» показывает список бланков своего
// режима рынка, позволяет править и вернуть исходный вид пресета.
//
// GET  — список бланков (пресеты режима копируются в базу при первом обращении)
// POST — вернуть бланк к виду пресета { key: "ua-invoice" } (обновляет существующий, не плодит дубли)

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const settings = await financeSettings(user.id);
    const market = marketOf(settings.country) ?? "UA";
    const list = await listTemplates(user.id, market);
    return NextResponse.json({ market, templates: list.map(toTemplateDTO) });
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const preset = DOC_PRESETS.find((p) => p.key === String(b?.key ?? ""));
    if (!preset) return badRequest("Unknown preset");
    await connectDB();
    const existing = await DocumentTemplate.findOne({ org: user.id, kind: preset.kind, name: preset.name });
    if (!existing) return badRequest("Template not found");
    existing.set({
        blocks: preset.blocks,
        texts: { ua: preset.texts.ua, en: preset.texts.en, de: preset.texts.de, notes: preset.notes[preset.language] ?? "" },
        prefix: preset.prefix,
        showSignature: preset.showSignature,
        showStamp: preset.showStamp,
        footer: preset.footer,
        paymentTerms: preset.texts[preset.language] ?? "",
        language: preset.language,
    });
    existing.markModified("texts");
    await existing.save();
    return NextResponse.json(toTemplateDTO(existing));
}
