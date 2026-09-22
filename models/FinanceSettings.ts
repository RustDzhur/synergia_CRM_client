import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Настройки бухгалтерии фирмы (один документ на org): страна определяет налоговую ставку по умолчанию (lib/finance/taxRates.ts),
// остальное — данные для шапки счёта/договора. Ничего из этого не обязательно: пока не заполнено, система просто
// использует разумные умолчания (ставка страны, простая нумерация «RE-2026-1»).
const FinanceSettingsSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
        country: { type: String, default: "" }, // ISO 3166-1 alpha-2, например "DE" — по нему lib/finance/taxRates.ts выбирает ставку НДС
        currency: { type: String, default: "EUR" }, // ISO 4217
        smallBusiness: { type: Boolean, default: false }, // «Kleinunternehmerregelung» §19 UStG и аналоги — считает 0% и добавляет пометку на счёт
        legalName: { type: String, default: "" },
        address: { type: String, default: "" },
        taxId: { type: String, default: "" }, // USt-IdNr / VAT ID / ЄДРПОУ и т.п., как принято в стране
        iban: { type: String, default: "" },
        bic: { type: String, default: "" },
        paymentTermsDays: { type: Number, default: 14 },
        invoicePrefix: { type: String, default: "RE" }, // нумерация «{prefix}-{год}-{порядковый}»; RE — Rechnung (счёт)
        quotePrefix: { type: String, default: "AN" }, // Angebot (предложение)
        // счётчики последнего использованного номера по типу документа и году — атомарно инкрементируются, без пропусков
        counters: { type: Map, of: Number, default: {} },
    },
    { timestamps: true }
);

export default registerModel("FinanceSettings", FinanceSettingsSchema);
