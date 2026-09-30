import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";
import { ActivitySchema } from "@/lib/activities";

const DealSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        stage: { type: Schema.Types.ObjectId, ref: "Stage", required: true, index: true },
        // Название сделки («Name» / «New Task» в макете). Поле называется clientName исторически.
        clientName: { type: String, required: true },
        order: { type: Number, required: true }, // порядок карточки внутри колонки

        contactName: { type: String, default: "" }, // «Client → Contact» — свободный текст (может быть несколько участников через запятую)
        companyName: { type: String, default: "" }, // «Client → Company»
        // Реальная ссылка, если контакт/компания выбраны из подсказки (не просто вписаны текстом) — contactName/companyName
        // остаются как отображаемый текст/снимок, contact/company — источник истины для трассировки и отчётов.
        contact: { type: Schema.Types.ObjectId, ref: "Contact", default: null },
        company: { type: Schema.Types.ObjectId, ref: "Company", default: null },
        startDate: { type: String, default: "" }, // "YYYY-MM-DD"
        endDate: { type: String, default: "" },

        // раздел «More» в карточке сделки
        dealType: { type: String, default: "" },
        responsible: { type: String, default: "" },
        availableToAll: { type: Boolean, default: true },
        utm: { type: String, default: "" },
        recurring: { type: String, default: "" }, // раздел «Recurring Deal»
        // разделы карточки, скрытые кнопкой «Удалить раздел»: сами данные очищаются, а здесь остаётся
        // отметка, что блок не показывать («more», «recurring»)
        hiddenSections: { type: [String], default: [] },
        // сделка выиграна: карточку вытянули за последний этап воронки. Пусто — сделка ещё в работе;
        // отметка снимается, как только карточку вернули в обычный этап
        wonAt: { type: Date, default: null },

        // Откуда пришла заявка: пусто — завели вручную, иначе код площадки (prom, rozetka, horoshop, olx)
        // или канал. externalId — номер заказа у площадки: по нему повторная синхронизация не создаёт дубль.
        source: { type: String, default: "" },
        externalId: { type: String, default: "" },
        // Снимок заказа площадки: состав и сумма попадают в заказ при конвертации, а комиссия —
        // в расходы, чтобы маржа сделки не выглядела больше, чем она есть
        market: {
            amount: { type: Number, default: 0 },
            currency: { type: String, default: "" },
            items: { type: [{ _id: false, name: String, qty: Number, price: Number }], default: [] },
            commission: { type: Number, default: 0 }, // % комиссии площадки из настроек подключения
            order: { type: Schema.Types.ObjectId, ref: "Order" }, // заказ, созданный из этой заявки
        },

        activities: { type: [ActivitySchema], default: [] },
    },
    { timestamps: true }
);

// Повторный импорт того же заказа площадки не должен создавать вторую сделку
DealSchema.index({ owner: 1, source: 1, externalId: 1 });

export default registerModel("Deal", DealSchema);
