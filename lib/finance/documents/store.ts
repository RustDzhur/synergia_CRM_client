import DocumentTemplate from "@/models/DocumentTemplate";
import { marketOf, type Market } from "../market";
import { financeSettings } from "../settings";
import { presetsFor, DOC_PRESETS } from "./presets";
import type { PdfSettings } from "../pdf";

// Бланки документов фирмы: при первом обращении пресеты режима копируются в базу организации,
// дальше всё живёт и правится там. Выпуск документов берёт активный бланк вида — его тексты,
// блоки, подпись/печать и префикс номера (ТЗ §7).

/** Скопировать пресеты режима в базу, если их там ещё нет (идемпотентно). */
export async function ensureTemplates(org: string, market: Market): Promise<void> {
    const existing = await DocumentTemplate.find({ org, market }).select("kind name");
    const have = new Set(existing.map((t) => `${t.kind}:${t.name}`));
    const missing = presetsFor(market).filter((p) => !have.has(`${p.kind}:${p.name}`));
    if (!missing.length) return;
    await Promise.all(
        missing.map((p) =>
            DocumentTemplate.create({
                org,
                market,
                kind: p.kind,
                name: p.name,
                blocks: p.blocks,
                texts: { ua: p.texts.ua, en: p.texts.en, de: p.texts.de, notes: p.notes[p.language] ?? "" },
                prefix: p.prefix,
                numbering: { yearly: true, resetEachYear: true },
                showStamp: p.showStamp,
                showSignature: p.showSignature,
                footer: p.footer,
                paymentTerms: p.texts[p.language] ?? "",
                language: p.language,
                active: true,
            }).catch(() => undefined) // параллельное создание тем же запросом — не ошибка
        )
    );
}

export async function listTemplates(org: string, market: Market) {
    await ensureTemplates(org, market);
    return DocumentTemplate.find({ org, market }).sort({ kind: 1, name: 1 });
}

/** Активный бланк вида (или null — тогда действуют общие настройки бухгалтерии). */
export async function activeTemplate(org: string, kind: string) {
    return DocumentTemplate.findOne({ org, kind, active: true }).sort({ updatedAt: -1 });
}

/**
 * Префикс номера для нового документа: у активного бланка вида он свой (РАХ, АКТ, ВН…),
 * иначе — префикс из настроек бухгалтерии. Год и счётчик добавляет nextNumber.
 */
export async function numberPrefix(org: string, kind: string, fallback: string): Promise<string> {
    try {
        const tpl = await activeTemplate(org, kind);
        return String(tpl?.prefix ?? "").trim() || fallback;
    } catch {
        return fallback;
    }
}

/** Текст пресета/бланка на нужном языке: язык документа → язык бланка → украинский → пусто. */
function pickText(map: { ua?: string; en?: string; de?: string; notes?: string } | undefined, locale: string, fallbackLang: string): string {
    if (!map) return "";
    const byLocale = (map as Record<string, string | undefined>)[locale];
    if (byLocale) return byLocale;
    const byLang = (map as Record<string, string | undefined>)[fallbackLang];
    return byLang ?? map.ua ?? map.en ?? map.de ?? "";
}

/**
 * Наложить бланк на настройки PDF: тексты (условия оплаты, примечания, подвал), блоки
 * (логотип, QR, подпись, печать) и флаги подписи. Общие настройки фирмы остаются основой —
 * бланк лишь заменяет то, что в нём задано.
 */
export function applyTemplate(base: PdfSettings, tpl: { blocks?: string[]; texts?: { ua?: string; en?: string; de?: string; notes?: string }; footer?: string; paymentTerms?: string; showSignature?: boolean; showStamp?: boolean; language?: string } | null, locale: string): PdfSettings {
    if (!tpl) return base;
    const blocks = Array.isArray(tpl.blocks) ? tpl.blocks : [];
    const blockOn = (id: string) => !blocks.length || blocks.includes(id);
    // Тексты бланка важнее общих: «Оплата протягом 5 днів…» вместо шаблонной строки
    const paymentTerms = String(tpl.paymentTerms ?? "").trim() || pickText(tpl.texts, locale, tpl.language ?? "ua");
    const notes = pickText(tpl.texts, locale, tpl.language ?? "ua");
    return {
        ...base,
        logo: blockOn("logo") ? base.logo : "",
        paymentQr: blockOn("qr") ? base.paymentQr : false,
        showSignature: !!tpl.showSignature,
        showStamp: !!tpl.showStamp,
        texts: {
            paymentTerms,
            notes: blockOn("notes") ? notes : "",
            footer: blockOn("footer") ? String(tpl.footer ?? "") : "",
        },
    };
}

/** Примет ли документ строку курса НБУ: блок rate можно выключить в бланке. */
export function templateAllowsRate(tpl: { blocks?: string[] } | null): boolean {
    const blocks = Array.isArray(tpl?.blocks) ? tpl!.blocks! : [];
    return !blocks.length || blocks.includes("rate");
}

/** Режим фирмы — по настройкам бухгалтерии (нужен, чтобы брать бланки своего рынка). */
export async function orgMarketOrDefault(org: string): Promise<Market> {
    const s = await financeSettings(org);
    return marketOf(s.country) ?? "UA";
}

export { DOC_PRESETS };
