import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { marketOf } from "@/lib/finance/market";
import { financeSettings } from "@/lib/finance/settings";
import { listTemplates } from "@/lib/finance/documents/store";
import { DOC_PRESETS } from "@/lib/finance/documents/presets";
import { toTemplateDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Бланки документов фирмы (ТЗ §7): «Налаштування → Документи» показывает список бланков своего
// режима рынка, позволяет править и вернуть исходный вид пресета.
//
// GET  — список бланков (пресеты режима копируются в базу при первом обращении)
// POST — вернуть бланк к виду пресета { key: "ua-invoice" } (обновляет существующий, не плодит дубли)

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
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
    const existing = await prisma.documentTemplate.findFirst({ where: { org: user.id, kind: preset.kind, name: preset.name } });
    if (!existing) return badRequest("Template not found");
    const updated = await prisma.documentTemplate.update({
        where: { id: existing.id },
        data: {
            blocks: preset.blocks as any,
            texts: { ua: preset.texts.ua, en: preset.texts.en, de: preset.texts.de, notes: preset.notes[preset.language] ?? "" } as any,
            prefix: preset.prefix,
            showSignature: preset.showSignature,
            showStamp: preset.showStamp,
            footer: preset.footer,
            paymentTerms: preset.texts[preset.language] ?? "",
            language: preset.language,
        },
    });
    return NextResponse.json(toTemplateDTO(updated));
}
