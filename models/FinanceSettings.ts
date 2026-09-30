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
        actPrefix: { type: String, default: "АКТ" }, // акт виконаних робіт (Украина) — своя последовательность
        reminderIntervalDays: { type: Number, default: 7 }, // раз в сколько дней слать напоминание по просроченному счёту
        // Манаведение: сбор за каждую ступень напоминания (0 — не брать) и ставка процентов за просрочку.
        // По умолчанию сборы нулевые: брать их или нет — решение фирмы, а не наше.
        dunningFees: { type: [Number], default: [0, 0, 2.5, 5, 10] }, // индекс = ступень (0 не используется)
        dunningInterestRate: { type: Number, default: 0 }, // % годовых; 0 — не считать
        dunningPaymentDays: { type: Number, default: 7 }, // срок оплаты, который даёт каждое напоминание
        // ── Украина ────────────────────────────────────────────────────────────────────────────────
        // Налоговая модель украинской фирмы отличается от немецкой, поэтому хранится отдельно и
        // показывается только при стране UA. Значения — умолчания на 2025 год (lib/finance/ua/rules.ts),
        // их можно менять: ставки и лимиты время от времени пересматриваются, поэтому они настройки,
        // а не константы кода. Профиль полнее пары полей: система налогообложения (uaTaxSystem),
        // реквизиты (ЄДРПОУ/ІПН/свідоцтво ПДВ/КВЕД/IBAN/МФО/банк), подписант с изображениями подписи
        // и печати, лимиты групп по годам (uaLimits) и допустимые ставки ПДВ (uaVatRates).
        uaLegalForm: { type: String, enum: ["fop", "tov", "other"], default: "fop" }, // ФОП, ТОВ (или ПП/ПрАТ как юрособа)
        uaTaxSystem: { type: String, default: "" }, // single_1..single_4 | general_fop | general_tov | single_tov ("" — выводится из uaGroup и uaLegalForm)
        uaGroup: { type: Number, default: 3 }, // группа єдиного податку: 1, 2, 3, 4; 0 — общая система
        uaSingleRate: { type: Number, default: 5 }, // 3-я группа: 5 % без ПДВ или 3 % с ПДВ
        uaVatPayer: { type: Boolean, default: false }, // платник ПДВ
        uaVatRegDate: { type: String, default: "" }, // дата регистрации плательщиком ПДВ (YYYY-MM-DD)
        uaVatCertificate: { type: String, default: "" }, // номер свідоцтва/витягу платника ПДВ
        uaVatRates: { type: [Number], default: [20, 7, 0] }, // допустимые ставки по строкам; «звільнено» — фирма без ПДВ
        uaEdrpou: { type: String, default: "" }, // ЄДРПОУ (юрлицо, 8 цифр)
        uaIpn: { type: String, default: "" }, // ІПН/РНОКПП (10 или 12 цифр)
        uaKved: { type: [String], default: [] }, // КВЕД (виды деятельности), каждый вида «62.01»
        uaBank: { type: String, default: "" },
        uaIban: { type: String, default: "" }, // украинский IBAN: UA + 27 знаков, проверяется mod-97
        uaMfo: { type: String, default: "" }, // МФО банка, 6 цифр
        uaSignerName: { type: String, default: "" }, // подписант документов (ФОП или директор ТОВ)
        uaSignerPosition: { type: String, default: "" }, // должность подписанта
        uaSignature: { type: String, default: "" }, // data-URL изображения подписи для документов
        uaSeal: { type: String, default: "" }, // data-URL изображения печати
        uaLimits: { type: [{ _id: false, year: Number, group: Number, amount: Number }], default: [] }, // свои лимиты групп по годам (перекрывают справочник)
        uaEsvMonthly: { type: Number, default: 1760 }, // ЄСВ за себя в месяц (22 % от минимальной зарплаты)
        uaMilitaryRate: { type: Number, default: 1 }, // военный сбор 3-й группы, % от дохода
        uaMilitaryFixed: { type: Number, default: 800 }, // военный сбор 1, 2 и 4 групп, ₴ в месяц
        uaVatLimit: { type: Number, default: 1000000 }, // лимит дохода для обязательной регистрации плательщиком ПДВ
        uaVatPeriod: { type: String, enum: ["month", "quarter"], default: "month" }, // как отчитываться по ПДВ
        // Наценка к курсу НБУ: фирма может считать по своему курсу («НБУ + 2 %»). 0 — чистый курс.
        rateMargin: { type: Number, default: 0 },
        // счётчики последнего использованного номера по типу документа и году — атомарно инкрементируются, без пропусков
        counters: { type: Map, of: Number, default: {} },
    },
    { timestamps: true }
);

export default registerModel("FinanceSettings", FinanceSettingsSchema);
