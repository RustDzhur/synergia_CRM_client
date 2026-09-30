import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Строка счёта: снимок на момент выставления — если товар потом переименуют или изменят цену, старые счета не меняются.
const LineItemSchema = new Schema(
    {
        description: { type: String, required: true },
        qty: { type: Number, required: true, default: 1 },
        unitPrice: { type: Number, required: true, default: 0 }, // без налога
        taxRate: { type: Number, required: true, default: 0 }, // %
        product: { type: Schema.Types.ObjectId, ref: "Product" }, // не обязателен — можно вписать произвольную строку
    },
    { _id: false }
);

// Счёт на оплату (Rechnung/Invoice). Номер — последовательный без пропусков (lib/finance/numbering.ts), это требование
// закона о счетах во многих странах (например §14 UStG в Германии) — номер, однажды выданный, не меняется и не удаляется
// повторно (при отмене счёта — CreditNote или статус "cancelled", сам документ остаётся).
// Клиент и его адрес — тоже снимок (customerName/customerAddress/customerTaxId), а не только ссылка: юридический счёт должен
// показывать те данные, что были на момент выставления, даже если контакт потом переехал.
const InvoiceSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        number: { type: String, required: true }, // «RE-2026-1»
        kind: { type: String, enum: ["invoice", "credit_note"], default: "invoice" },
        creditFor: { type: Schema.Types.ObjectId, ref: "Invoice" }, // для kind "credit_note" — какой счёт корректирует

        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        company: { type: Schema.Types.ObjectId, ref: "Company" },
        customerName: { type: String, required: true },
        customerAddress: { type: String, default: "" },
        customerTaxId: { type: String, default: "" },

        deal: { type: Schema.Types.ObjectId, ref: "Deal" },
        order: { type: Schema.Types.ObjectId }, // Order, из которого выставлен счёт
        contract: { type: Schema.Types.ObjectId }, // Contract, если счёт по договору

        items: { type: [LineItemSchema], default: [] },
        currency: { type: String, default: "EUR" },
        // Курс НБУ, зафиксированный на дату документа (для счетов в валюте): база, наценка фирмы и
        // итоговый курс. Снимок — чтобы перепечатка через месяц показывала ту же сумму в ₴.
        rate: { base: { type: Number, default: 0 }, margin: { type: Number, default: 0 }, value: { type: Number, default: 0 }, at: { type: String, default: "" } },
        smallBusinessNote: { type: Boolean, default: false }, // «Kleinunternehmerregelung»-пометка вместо налоговой строки

        issueDate: { type: String, required: true }, // "YYYY-MM-DD"
        dueDate: { type: String, default: "" },
        // Дата поставки/услуги (§14 Abs. 4 Nr. 6 UStG) — обязательное поле немецкого счёта, печатается как Leistungsdatum.
        // Если услуга оказывалась периодом, вместо даты печатается период (supplyPeriodFrom – supplyPeriodTo).
        supplyDate: { type: String, default: "" },
        supplyPeriodFrom: { type: String, default: "" },
        supplyPeriodTo: { type: String, default: "" },
        notes: { type: String, default: "" },
        // ВЭД (ТЗ §12): условие поставки и данные таможенной декларации/валютного контроля
        incoterms: { type: String, default: "" },
        customsDeclaration: { type: String, default: "" },
        // Шаблон оформления PDF: у каждого документа он свой, чтобы счёт клиенту и договор могли выглядеть по-разному
        template: { type: String, default: "" },

        status: { type: String, enum: ["draft", "sent", "paid", "overdue", "cancelled"], default: "draft" },
        sentAt: { type: Date },
        sentTo: { type: String, default: "" }, // адрес, на который счёт ушёл письмом (кнопка «Отправить») — для истории
        paidAt: { type: Date },
        paidAmount: { type: Number, default: 0 },

        lastReminderAt: { type: Date },
        reminderCount: { type: Number, default: 0 }, // сколько напоминаний об оплате уже отправлено (lib/finance/reminders.ts)
        // Манаведение (Mahnwesen): ступень напоминания и накопленные за неё сборы.
        // Уровни: 0 — напоминаний не было, 1 — Zahlungserinnerung, 2 — 1. Mahnung, 3 — 2. Mahnung, 4 — letzte Mahnung.
        dunningLevel: { type: Number, default: 0 },
        dunningFee: { type: Number, default: 0 }, // сумма выставленных за напоминания сборов, без налога
        // История напоминаний: что и когда ушло, чтобы клиентская переписка была воспроизводима
        dunningLog: {
            type: [new Schema({ level: Number, sentAt: Date, fee: Number, dueDate: String, method: String }, { _id: false })],
            default: [],
        },
        recurringSource: { type: Schema.Types.ObjectId, ref: "RecurringInvoice" },
        // Фискальный чек ПРРО (Украина): номер чека у Checkbox, фискальный номер и ссылка для клиента.
        // Пробивается автоматически при полной оплате (lib/finance/fiscal.ts) или вручную из счёта.
        fiscalId: { type: String, default: "" },
        fiscalCode: { type: String, default: "" },
        fiscalUrl: { type: String, default: "" },
        fiscalAt: { type: Date },
        fiscalError: { type: String, default: "" },
        fiscalPayType: { type: String, enum: ["", "CASH", "CARD"], default: "" }, // способ оплаты в чеке (готівка/картка)
        // Чек возврата (при кредит-ноте): ссылается на чек продажи — без него возврат не сойдётся в кассе
        fiscalReturnId: { type: String, default: "" },
        fiscalReturnCode: { type: String, default: "" },
        fiscalReturnAt: { type: Date },
        fiscalReturnError: { type: String, default: "" },
        // Ссылка на оплату (эквайринг фирмы): способ, адрес и платёж у провайдера. paidVia — чем закрыли счёт.
        payLink: { provider: { type: String, default: "" }, url: { type: String, default: "" }, id: { type: String, default: "" }, at: { type: Date } },
        paidVia: { type: String, default: "" }, // счёт создан автоматически по шаблону

        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
InvoiceSchema.index({ org: 1, number: 1 }, { unique: true });
InvoiceSchema.index({ org: 1, status: 1, dueDate: 1 });
InvoiceSchema.index({ org: 1, createdAt: -1 });

export default registerModel("Invoice", InvoiceSchema);
