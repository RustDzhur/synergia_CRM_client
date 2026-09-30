import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Настраиваемый бланк документа (ТЗ §7): фирма выбирает, как выглядит её рахунок, акт, видаткова
// чи ТТН — какие блоки печатаются, какие тексты стоят в условиях оплаты и примечаниях, ставить ли
// подпись и печать, какой префикс у номера и на каком языке документ.
//
// Бланки принадлежат фирме (org) и режиму рынка: украинские пресеты не должны появляться у немецкой
// фирмы. Из пресета бланк копируется в базу при первом открытии экрана «Документы» и дальше
// редактируется свободно — пресет остаётся только образцом.

const DocumentTemplateSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        market: { type: String, enum: ["DE", "UA"], required: true }, // какому режиму принадлежит бланк
        kind: { type: String, required: true }, // вид документа: invoice, act, delivery_note, quote, order, contract, credit_note
        name: { type: String, default: "" }, // человеческое имя бланка («UA-рахунок», «Акт: базовый»)
        // Какие блоки печатаются. Пусто — печатается всё (значения по умолчанию для вида документа).
        // Допустимые: logo, qr, notes, footer, signature, seal, rate (строка курса НБУ).
        blocks: { type: [String], default: [] },
        // Тексты бланка: условия оплаты, примечания, подвал — на трёх языках интерфейса.
        // notes — тот же словарь для примечаний (у акта это «претензій немає» и подобное).
        texts: { type: { ua: String, en: String, de: String, notes: String }, default: {} },
        prefix: { type: String, default: "" }, // префикс номера; пусто — берётся из настроек бухгалтерии
        // Нумерация: год в номере и обнуление счётчика с новым годом (как в nextNumber)
        numbering: { type: { yearly: Boolean, resetEachYear: Boolean }, default: { yearly: true, resetEachYear: true } },
        showStamp: { type: Boolean, default: false }, // печать изображения печати фирмы
        showSignature: { type: Boolean, default: false }, // печать изображения подписи фирмы
        footer: { type: String, default: "" }, // свой подвал бланка (сильнее общего из настроек)
        paymentTerms: { type: String, default: "" }, // текст условий оплаты вместо «Термін оплати: N днів»
        language: { type: String, enum: ["ua", "en", "de"], default: "ua" }, // язык документа
        currency: { type: String, default: "" }, // валюта бланка; пусто — валюта фирмы
        active: { type: Boolean, default: true }, // выбранный бланк вида: его и берёт выпуск документов
    },
    { timestamps: true }
);

DocumentTemplateSchema.index({ org: 1, kind: 1, name: 1 }, { unique: true });

export default registerModel("DocumentTemplate", DocumentTemplateSchema);
