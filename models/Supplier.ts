import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Поставщик (ТЗ §12): у него заказывают товар и ему же возвращают. Отдельная сущность, а не клиентская
// компания: у поставщика свои условия — отсрочка, лимит, валюта расчётов, и смешивать их в одной
// таблице с покупателями неудобно и опасно (случайная рассылка, случайный прайс).

const SupplierSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        name: { type: String, required: true },
        code: { type: String, default: "" }, // ЄДРПОУ / USt-IdNr
        contactName: { type: String, default: "" },
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
        address: { type: String, default: "" },
        iban: { type: String, default: "" },
        paymentDays: { type: Number, default: 0 }, // отсрочка, дней
        currency: { type: String, default: "" }, // валюта закупок; пусто — валюта фирмы
        notes: { type: String, default: "" },
        archived: { type: Boolean, default: false },
    },
    { timestamps: true }
);

SupplierSchema.index({ org: 1, name: 1 }, { unique: true });

export default registerModel("Supplier", SupplierSchema);
