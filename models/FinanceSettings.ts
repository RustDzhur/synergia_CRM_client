import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Настройки бухгалтерии фирмы (один документ на org): страна определяет налоговую ставку по умолчанию (lib/finance/taxRates.ts),
// остальное — данные для шапки счёта/договора. Ничего из этого не обязательно: пока не заполнено, система просто
// использует разумные умолчания (ставка страны, простая нумерация «RE-2026-1»).
const FinanceSettingsSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
        country: { type: String, default: "" }, // ISO 3166-1 alpha-2, например "DE" — по нему lib/finance/taxRates.ts выбирает ставку НДС
        vatId: { type: String, default: "" }, // USt-IdNr. — отдельно от налогового номера: на счёте в Германии это разные строки
        currency: { type: String, default: "EUR" }, // ISO 4217
        smallBusiness: { type: Boolean, default: false }, // «Kleinunternehmerregelung» §19 UStG и аналоги — считает 0% и добавляет пометку на счёт
        legalName: { type: String, default: "" },
        address: { type: String, default: "" },
        taxId: { type: String, default: "" }, // USt-IdNr / VAT ID / ЄДРПОУ и т.п., как принято в стране
        // Контакты и регистровый номер: в Германии счёт без обратного адреса и контактов продавца
        // считается неполным, а Handelsregister-Nummer обычно указывают рядом с налоговым номером.
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
        website: { type: String, default: "" },
        registerNumber: { type: String, default: "" },
        managingDirector: { type: String, default: "" }, // руководитель — подпись внизу документа
        logo: { type: String, default: "" }, // data-URL логотипа; печатается в шапке документа
        footerText: { type: String, default: "" }, // свой текст фирмы внизу документа (благодарность за оплату и т.п.)
        iban: { type: String, default: "" },
        bic: { type: String, default: "" },
        paymentTermsDays: { type: Number, default: 14 },
        template: { type: String, default: "classic" }, // шаблон оформления по умолчанию для новых документов
        paymentQr: { type: Boolean, default: true }, // печатать ли QR-код на оплату в счетах
        invoicePrefix: { type: String, default: "RE" }, // нумерация «{prefix}-{год}-{порядковый}»; RE — Rechnung (счёт)
        quotePrefix: { type: String, default: "AN" }, // Angebot (предложение)
        creditNotePrefix: { type: String, default: "GS" }, // Gutschrift (кредит-нота/сторно) — своя последовательность номеров
        deliveryNotePrefix: { type: String, default: "LS" }, // Lieferschein (накладная)
        reminderIntervalDays: { type: Number, default: 7 }, // раз в сколько дней слать напоминание по просроченному счёту
        // Манаведение: сбор за каждую ступень напоминания (0 — не брать) и ставка процентов за просрочку.
        // По умолчанию сборы нулевые: брать их или нет — решение фирмы, а не наше.
        dunningFees: { type: [Number], default: [0, 0, 2.5, 5, 10] }, // индекс = ступень (0 не используется)
        dunningInterestRate: { type: Number, default: 0 }, // % годовых; 0 — не считать
        dunningPaymentDays: { type: Number, default: 7 }, // срок оплаты, который даёт каждое напоминание
        // счётчики последнего использованного номера по типу документа и году — атомарно инкрементируются, без пропусков
        counters: { type: Map, of: Number, default: {} },
    },
    { timestamps: true }
);

export default registerModel("FinanceSettings", FinanceSettingsSchema);
