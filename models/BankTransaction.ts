import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Движение по счёту или кассе: приходит из выписки банка (импорт CSV) или вносится вручную в кассовой
// книге. Автоматически такие записи не создаются — ни оплата счёта, ни расход их не порождают.
//
// match — к чему движение привязано: счёт клиенту (invoice) или расход (expense). Пока привязки нет,
// движение считается несверенным и висит в списке «Unvollständig» — это и есть сверка. Привязка к счёту
// учитывает оплату по нему (lib/finance/payments.ts), снятие привязки — возвращает.
const BankTransactionSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        account: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
        date: { type: String, required: true }, // "YYYY-MM-DD"
        amount: { type: Number, required: true }, // плюс — приход, минус — расход
        currency: { type: String, default: "EUR" },
        counterparty: { type: String, default: "" }, // контрагент из выписки, как он там написан
        reference: { type: String, default: "" }, // назначение платежа
        // Внешний ключ строки выписки: по нему повторный импорт того же файла не создаёт дубликатов
        externalId: { type: String, default: "" },
        matchType: { type: String, enum: ["", "invoice", "expense", "manual"], default: "" },
        matchId: { type: Schema.Types.ObjectId },
        source: { type: String, enum: ["import", "manual", "auto"], default: "manual" },
        notes: { type: String, default: "" },
    },
    { timestamps: true }
);
BankTransactionSchema.index({ org: 1, account: 1, date: -1 });
// Повторный импорт той же выписки не должен задваивать движения
BankTransactionSchema.index({ org: 1, account: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: "string", $ne: "" } } });

export default registerModel("BankTransaction", BankTransactionSchema);
