import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Счёт в банке или касса (Kasse) — то, где реально лежат деньги.
// kind разделяет их, потому что кассовая книга в Германии ведётся отдельно и по своим правилам
// (ежедневный подсчёт остатка), а банковские операции просто выгружаются и сверяются со счетами.
const BankAccountSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        // Режим рынка счёта (ТЗ §1: режимы не смешиваются): счета, заведённые до появления поля,
        // считаются немецкими — украинская фирма их не видит, свои заводит заново.
        market: { type: String, enum: ["DE", "UA", ""], default: "" },
        kind: { type: String, enum: ["bank", "cash"], default: "bank" },
        name: { type: String, required: true },
        iban: { type: String, default: "" },
        bic: { type: String, default: "" },
        currency: { type: String, default: "EUR" },
        // Остаток на начало: без него сальдо по счёту не сойдётся с банковской выпиской
        openingBalance: { type: Number, default: 0 },
        openingDate: { type: String, default: "" }, // "YYYY-MM-DD"
        active: { type: Boolean, default: true },
        // ── Подключение к банку (выписка по API) ─────────────────────────────────────────────
        // Счёт может быть привязан к счёту в банке: тогда движения забираются сами (lib/banks/monobank.ts),
        // а providerSecret хранит токен в зашифрованном виде (lib/crypto.ts) и в браузер не уходит.
        provider: { type: String, enum: ["", "monobank"], default: "" },
        providerAccountId: { type: String, default: "" }, // id счёта на стороне банка
        providerSecret: { type: String, default: "" }, // зашифрованный {token}
        providerSyncAt: { type: Date }, // до какого момента движения уже забраны — следующая синхронизация продолжает с него
    },
    { timestamps: true }
);
BankAccountSchema.index({ org: 1, name: 1 }, { unique: true });

export default registerModel("BankAccount", BankAccountSchema);
