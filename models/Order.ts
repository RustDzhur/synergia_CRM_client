import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

const OrderItemSchema = new Schema(
    {
        description: { type: String, required: true },
        qty: { type: Number, required: true, default: 1 },
        unitPrice: { type: Number, required: true, default: 0 },
        taxRate: { type: Number, required: true, default: 0 },
        product: { type: Schema.Types.ObjectId, ref: "Product" },
    },
    { _id: false }
);

// Внутренний заказ — связующее звено между сделкой и деньгами: «оформили контракт → создали заказ → закупка/резервирование
// товара под заказ (StockMovement с reason "sale") → выполнили → выставили счёт». Создание и смена статуса заказа сами
// становятся событиями автоматизации (order_created, order_status), поэтому от них можно завести уведомление «подготовить
// предложение», задачу и т.п. — как у сделок и задач.
const OrderSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        number: { type: String, required: true },

        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        company: { type: Schema.Types.ObjectId, ref: "Company" },
        customerName: { type: String, default: "" },
        deal: { type: Schema.Types.ObjectId, ref: "Deal" },
        contract: { type: Schema.Types.ObjectId },

        items: { type: [OrderItemSchema], default: [] },
        currency: { type: String, default: "EUR" },
        // Курс НБУ, зафиксированный на дату документа (для счетов в валюте): база, наценка фирмы и
        // итоговый курс. Снимок — чтобы перепечатка через месяц показывала ту же сумму в ₴.
        rate: { base: { type: Number, default: 0 }, margin: { type: Number, default: 0 }, value: { type: Number, default: 0 }, at: { type: String, default: "" } },

        status: { type: String, enum: ["draft", "confirmed", "fulfilled", "invoiced", "closed", "cancelled"], default: "draft" },
        // Накладная (Lieferschein): номер присваивается один раз при первой выписке, чтобы повторная
        // печать давала тот же документ, и дата фактической поставки.
        deliveryNoteNumber: { type: String, default: "" },
        deliveryDate: { type: String, default: "" },
        // Акт виконаних робіт (Украина): свой номер и дата, как у накладной — документ выписывается один раз
        actNumber: { type: String, default: "" },
        actDate: { type: String, default: "" },

        // Укрпошта: штрихкод отправления (ШКІ) вписывает менеджер, статус тянем по нему из API Укрпошти.
        // Создание отправления у них требует договора и адресного классификатора — это отдельная работа.
        ukrposhta: {
            uuid: { type: String, default: "" }, // id отправления в Укрпоште (для печати формы и отмены)
            barcode: { type: String, default: "" },
            status: { type: String, default: "" },
            place: { type: String, default: "" },
            statusAt: { type: Date },
            postOffice: { type: String, default: "" }, // отделение получателя (как выбрали)
            cod: { type: Number, default: 0 }, // наложенный платёж, ₴
        },
        invoice: { type: Schema.Types.ObjectId, ref: "Invoice" }, // счёт, выставленный по этому заказу

        // Доставка «Новою Поштою» (Украина): номер ТТН называют клиенту, по нему же виден статус посылки.
        // Данные получателя храним снимком: они уходят в накладную и не должны меняться задним числом.
        waybill: {
            number: { type: String, default: "" },
            ref: { type: String, default: "" },
            status: { type: String, default: "" },
            statusAt: { type: Date },
            cost: { type: Number, default: 0 },
            city: { type: String, default: "" },
            cityRef: { type: String, default: "" },
            warehouse: { type: String, default: "" },
            warehouseRef: { type: String, default: "" },
            recipient: { type: String, default: "" },
            phone: { type: String, default: "" },
            weight: { type: Number, default: 0 },
            cod: { type: Number, default: 0 }, // наложений платёж
            seats: { type: Number, default: 1 }, // мест в посылке
            // Адресная доставка курьером: когда заполнена улица, посылка идёт на адрес, а не в отделение
            street: { type: String, default: "" },
            house: { type: String, default: "" },
            flat: { type: String, default: "" },
            // Возврат/перенаправление по ТТН (AdditionalService Новой Пошты)
            returnNumber: { type: String, default: "" },
            returnAt: { type: Date },
        },

        notes: { type: String, default: "" },
        // Шаблон оформления PDF: у каждого документа он свой, чтобы счёт клиенту и договор могли выглядеть по-разному
        template: { type: String, default: "" },
        responsible: { type: String, default: "" },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
OrderSchema.index({ org: 1, number: 1 }, { unique: true });
OrderSchema.index({ org: 1, createdAt: -1 });

export default registerModel("Order", OrderSchema);
